import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { DatabaseSync } from 'node:sqlite'
import { buildBoxPlan } from '../src/lib/boxPlanner.js'

const pokemonData = JSON.parse(
  readFileSync(new URL('../src/data/pokemon.json', import.meta.url), 'utf8'),
)

const SCRYPT_PARAMETERS = { N: 16384, r: 8, p: 1 }
const PASSWORD_HASH_BYTES = 64
const SESSION_COOKIE = 'pokemon_sync_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_BODY_BYTES = 256 * 1024
const LOGIN_ATTEMPT_LIMIT = 10
const LOGIN_LOCK_MS = 15 * 60 * 1000
const MAX_LOGIN_CLIENTS = 1024
const scrypt = promisify(scryptCallback)

export const validSlotKeys = new Set(
  buildBoxPlan(pokemonData.entries).slots.map((slot) => slot.key),
)

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('密码长度必须为 12–256 个字符')
  }
}

function validateUsername(username) {
  if (typeof username !== 'string') throw new Error('用户名不能为空')
  const normalized = username.trim()
  if (!normalized || normalized.length > 64 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error('用户名必须为 1–64 个可见字符')
  }
  return normalized
}

function decodePasswordHash(encodedHash) {
  if (typeof encodedHash !== 'string') throw new Error('缺少 SYNC_PASSWORD_HASH')

  const [version, n, r, p, saltText, digestText, ...extra] = encodedHash.split(':')
  if (
    version !== 'scrypt-v1' ||
    Number(n) !== SCRYPT_PARAMETERS.N ||
    Number(r) !== SCRYPT_PARAMETERS.r ||
    Number(p) !== SCRYPT_PARAMETERS.p ||
    !/^[\w-]+$/.test(saltText ?? '') ||
    !/^[\w-]+$/.test(digestText ?? '') ||
    extra.length
  ) {
    throw new Error('SYNC_PASSWORD_HASH 格式无效，请运行 npm run password:hash 重新生成')
  }

  const salt = Buffer.from(saltText, 'base64url')
  const digest = Buffer.from(digestText, 'base64url')
  if (salt.length !== 16 || digest.length !== PASSWORD_HASH_BYTES) {
    throw new Error('SYNC_PASSWORD_HASH 格式无效，请运行 npm run password:hash 重新生成')
  }

  return { salt, digest }
}

async function derivePassword(password, salt) {
  return scrypt(password, salt, PASSWORD_HASH_BYTES, {
    ...SCRYPT_PARAMETERS,
    maxmem: 64 * 1024 * 1024,
  })
}

export async function createPasswordHash(password) {
  validatePassword(password)
  const salt = randomBytes(16)
  const digest = await derivePassword(password, salt)
  return [
    'scrypt-v1',
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    salt.toString('base64url'),
    digest.toString('base64url'),
  ].join(':')
}

async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || password.length > 256) return false
  const { salt, digest } = decodePasswordHash(encodedHash)
  const candidate = await derivePassword(password, salt)
  return timingSafeEqual(candidate, digest)
}

function openDatabase(databasePath) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })

  const database = new DatabaseSync(databasePath)
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      collection_initialized INTEGER NOT NULL DEFAULT 0 CHECK (collection_initialized IN (0, 1)),
      collection_updated_at INTEGER,
      collection_version INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS collection (
      account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      slot_key TEXT NOT NULL,
      PRIMARY KEY (account_id, slot_key)
    );
  `)

  const accountColumns = database.prepare('PRAGMA table_info(account)').all()
  if (!accountColumns.some((column) => column.name === 'collection_version')) {
    database.exec('ALTER TABLE account ADD COLUMN collection_version INTEGER NOT NULL DEFAULT 0')
  }
  return database
}

function configureAccount(database, username, passwordHash) {
  const normalizedUsername = validateUsername(username)
  decodePasswordHash(passwordHash)

  const current = database
    .prepare('SELECT username, password_hash AS passwordHash FROM account WHERE id = 1')
    .get()

  if (!current) {
    database
      .prepare('INSERT INTO account (id, username, password_hash) VALUES (1, ?, ?)')
      .run(normalizedUsername, passwordHash)
  } else if (current.username !== normalizedUsername || current.passwordHash !== passwordHash) {
    database.exec('BEGIN IMMEDIATE')
    try {
      database
        .prepare('UPDATE account SET username = ?, password_hash = ? WHERE id = 1')
        .run(normalizedUsername, passwordHash)
      database.prepare('DELETE FROM sessions').run()
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }

  return normalizedUsername
}

function sendJson(response, status, body, extraHeaders = {}) {
  const content = JSON.stringify(body)
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content),
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  response.end(content)
}

async function readJson(request) {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim()
  if (contentType !== 'application/json') {
    throw new HttpError(415, '请求必须使用 application/json')
  }

  const declaredLength = Number(request.headers['content-length'] ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, '请求内容过大')
  }

  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, '请求内容过大')
    chunks.push(chunk)
  }

  if (!chunks.length) throw new HttpError(400, '请求内容不能为空')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'JSON 格式无效')
  }
}

function parseCookie(request, name) {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return null

  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=')
    if (separator === -1) continue
    if (segment.slice(0, separator).trim() === name) {
      return segment.slice(separator + 1).trim()
    }
  }
  return null
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function loginClientKey(request) {
  const forwardedFor = Array.isArray(request.headers['x-forwarded-for'])
    ? request.headers['x-forwarded-for'].join(',')
    : String(request.headers['x-forwarded-for'] ?? '')
  const realIp = Array.isArray(request.headers['x-real-ip'])
    ? request.headers['x-real-ip'].join(',')
    : String(request.headers['x-real-ip'] ?? '')
  const remoteAddress = request.socket.remoteAddress ?? ''
  return createHash('sha256')
    .update(`${remoteAddress}\n${realIp}\n${forwardedFor}`)
    .digest('hex')
}

function requestUsesHttps(request) {
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] ?? '')
    .split(',', 1)[0]
    .trim()
    .toLowerCase()
  return forwardedProtocol === 'https'
}

function sessionCookie(token, request, maxAgeSeconds) {
  const secure = requestUsesHttps(request) ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`
}

function validateCollectionKeys(keys) {
  if (!Array.isArray(keys) || keys.length > validSlotKeys.size) {
    throw new HttpError(400, '收藏数据格式无效')
  }

  const uniqueKeys = new Set()
  for (const key of keys) {
    if (typeof key !== 'string' || !validSlotKeys.has(key) || uniqueKeys.has(key)) {
      throw new HttpError(400, '收藏数据包含无效箱位')
    }
    uniqueKeys.add(key)
  }
  return [...uniqueKeys]
}

export function createSyncServer({
  databasePath = process.env.DATABASE_PATH ?? './data/pokemon-sync.sqlite',
  syncUsername = process.env.SYNC_USERNAME,
  syncPasswordHash = process.env.SYNC_PASSWORD_HASH,
  sessionTtlMs = SESSION_TTL_MS,
  now = () => Date.now(),
  logger = console,
} = {}) {
  const database = openDatabase(databasePath)
  let configuredUsername
  try {
    configuredUsername = configureAccount(database, syncUsername, syncPasswordHash)
  } catch (error) {
    database.close()
    throw error
  }

  const selectAccount = database.prepare(
    'SELECT id, username, password_hash AS passwordHash FROM account WHERE id = 1',
  )
  const selectSession = database.prepare(`
    SELECT account.id, account.username
    FROM sessions
    JOIN account ON account.id = sessions.account_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `)
  const deleteSession = database.prepare('DELETE FROM sessions WHERE token_hash = ?')
  const deleteExpiredSessions = database.prepare('DELETE FROM sessions WHERE expires_at <= ?')
  const insertSession = database.prepare(
    'INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, 1, ?)',
  )
  const selectCollection = database.prepare(
    'SELECT slot_key AS key FROM collection WHERE account_id = 1 ORDER BY slot_key',
  )
  const selectCollectionMetadata = database.prepare(`
    SELECT
      collection_initialized AS initialized,
      collection_updated_at AS updatedAt,
      collection_version AS version
    FROM account WHERE id = 1
  `)
  const deleteCollection = database.prepare('DELETE FROM collection WHERE account_id = 1')
  const insertCollectionKey = database.prepare(
    'INSERT OR IGNORE INTO collection (account_id, slot_key) VALUES (1, ?)',
  )
  const deleteCollectionKey = database.prepare(
    'DELETE FROM collection WHERE account_id = 1 AND slot_key = ?',
  )
  const updateCollectionMetadata = database.prepare(`
    UPDATE account
    SET collection_initialized = 1,
        collection_updated_at = ?,
        collection_version = collection_version + 1
    WHERE id = 1
  `)

  const loginAttemptsByClient = new Map()

  function loginAttemptState(request, currentTime) {
    const key = loginClientKey(request)
    let state = loginAttemptsByClient.get(key)
    if (state && currentTime - state.lastAttemptAt >= LOGIN_LOCK_MS) {
      loginAttemptsByClient.delete(key)
      state = undefined
    }

    if (!state) {
      if (loginAttemptsByClient.size >= MAX_LOGIN_CLIENTS) {
        const oldestKey = loginAttemptsByClient.keys().next().value
        loginAttemptsByClient.delete(oldestKey)
      }
      state = { failedAttempts: 0, blockedUntil: 0, lastAttemptAt: currentTime }
      loginAttemptsByClient.set(key, state)
    }
    state.lastAttemptAt = currentTime
    return { key, state }
  }

  function authenticatedAccount(request) {
    const token = parseCookie(request, SESSION_COOKIE)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null

    const currentTime = now()
    deleteExpiredSessions.run(currentTime)
    return selectSession.get(hashSessionToken(token), currentTime) ?? null
  }

  function requireAccount(request) {
    const account = authenticatedAccount(request)
    if (!account) throw new HttpError(401, '请先登录')
    return account
  }

  function initializeCollection(keys) {
    const updatedAt = now()
    database.exec('BEGIN IMMEDIATE')
    try {
      const current = selectCollectionMetadata.get()
      if (current.initialized) {
        throw new HttpError(409, '服务器收藏已经初始化，请刷新后重试')
      }
      deleteCollection.run()
      for (const key of keys) insertCollectionKey.run(key)
      updateCollectionMetadata.run(updatedAt)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return selectCollectionMetadata.get()
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')

      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/session') {
        const account = authenticatedAccount(request)
        sendJson(
          response,
          200,
          account
            ? { authenticated: true, username: account.username }
            : { authenticated: false },
        )
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        const currentTime = now()
        const loginAttempt = loginAttemptState(request, currentTime)
        if (currentTime < loginAttempt.state.blockedUntil) {
          const retryAfter = Math.max(
            1,
            Math.ceil((loginAttempt.state.blockedUntil - currentTime) / 1000),
          )
          sendJson(
            response,
            429,
            { error: '登录失败次数过多，请稍后再试' },
            { 'Retry-After': retryAfter },
          )
          return
        }

        const body = await readJson(request)
        const account = selectAccount.get()
        const suppliedUsername = typeof body?.username === 'string' ? body.username.trim() : ''
        const passwordMatches = await verifyPassword(body?.password, account.passwordHash)

        if (suppliedUsername !== account.username || !passwordMatches) {
          loginAttempt.state.failedAttempts += 1
          if (loginAttempt.state.failedAttempts >= LOGIN_ATTEMPT_LIMIT) {
            loginAttempt.state.blockedUntil = currentTime + LOGIN_LOCK_MS
            loginAttempt.state.failedAttempts = 0
          }
          throw new HttpError(401, '用户名或密码错误')
        }

        loginAttemptsByClient.delete(loginAttempt.key)
        deleteExpiredSessions.run(currentTime)
        const token = randomBytes(32).toString('hex')
        insertSession.run(hashSessionToken(token), currentTime + sessionTtlMs)
        sendJson(
          response,
          200,
          { authenticated: true, username: configuredUsername },
          { 'Set-Cookie': sessionCookie(token, request, Math.floor(sessionTtlMs / 1000)) },
        )
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        const token = parseCookie(request, SESSION_COOKIE)
        if (token && /^[a-f0-9]{64}$/.test(token)) deleteSession.run(hashSessionToken(token))
        sendJson(
          response,
          200,
          { authenticated: false },
          { 'Set-Cookie': sessionCookie('', request, 0) },
        )
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/collection') {
        requireAccount(request)
        const metadata = selectCollectionMetadata.get()
        sendJson(response, 200, {
          keys: selectCollection.all().map((row) => row.key),
          initialized: Boolean(metadata.initialized),
          updatedAt: metadata.updatedAt,
          version: metadata.version,
        })
        return
      }

      if (request.method === 'PUT' && url.pathname === '/api/collection') {
        requireAccount(request)
        const body = await readJson(request)
        const keys = validateCollectionKeys(body?.keys)
        const metadata = initializeCollection(keys)
        sendJson(response, 200, {
          keys,
          initialized: true,
          updatedAt: metadata.updatedAt,
          version: metadata.version,
        })
        return
      }

      if (request.method === 'PATCH' && url.pathname === '/api/collection') {
        requireAccount(request)
        const body = await readJson(request)
        if (
          typeof body?.key !== 'string' ||
          !validSlotKeys.has(body.key) ||
          typeof body.collected !== 'boolean'
        ) {
          throw new HttpError(400, '箱位更新格式无效')
        }

        const updatedAt = now()
        database.exec('BEGIN IMMEDIATE')
        try {
          if (body.collected) insertCollectionKey.run(body.key)
          else deleteCollectionKey.run(body.key)
          updateCollectionMetadata.run(updatedAt)
          database.exec('COMMIT')
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
        const metadata = selectCollectionMetadata.get()
        sendJson(response, 200, {
          key: body.key,
          collected: body.collected,
          updatedAt: metadata.updatedAt,
          version: metadata.version,
        })
        return
      }

      sendJson(response, 404, { error: '接口不存在' })
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message })
      } else {
        logger.error('同步接口错误', error)
        sendJson(response, 500, { error: '服务器内部错误' })
      }
    }
  })

  server.on('clientError', (_error, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
  })
  server.on('close', () => database.close())

  return { server, database }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT 必须是有效端口号')
  }

  const { server } = createSyncServer()
  server.listen(port, '0.0.0.0', () => {
    console.log(`收藏同步服务正在监听 ${port} 端口`)
  })

  const shutdown = () => server.close(() => process.exit(0))
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
