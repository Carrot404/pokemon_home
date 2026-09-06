import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createPasswordHash, createSyncServer, validSlotKeys } from './server.mjs'

const username = 'collector'
const password = 'correct-horse-battery-staple'

async function startServer(options) {
  const { server } = createSyncServer({ ...options, logger: { error() {} } })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
  }
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function request(
  baseUrl,
  path,
  { method = 'GET', body, cookie, https = false, forwardedFor } = {},
) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  if (https) headers['X-Forwarded-Proto'] = 'https'
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  return { response, payload }
}

test('单账户认证与收藏数据持久化', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pokemon-sync-'))
  const databasePath = join(directory, 'sync.sqlite')
  const passwordHash = await createPasswordHash(password)
  const firstKeys = [...validSlotKeys].slice(0, 2)
  let running

  try {
    running = await startServer({ databasePath, syncUsername: username, syncPasswordHash: passwordHash })

    const health = await request(running.baseUrl, '/api/health')
    assert.equal(health.response.status, 200)
    assert.deepEqual(health.payload, { ok: true })

    const anonymousSession = await request(running.baseUrl, '/api/session')
    assert.deepEqual(anonymousSession.payload, { authenticated: false })

    const rejectedLogin = await request(running.baseUrl, '/api/login', {
      method: 'POST',
      body: { username, password: 'incorrect-password' },
    })
    assert.equal(rejectedLogin.response.status, 401)

    const login = await request(running.baseUrl, '/api/login', {
      method: 'POST',
      body: { username, password },
      https: true,
    })
    assert.equal(login.response.status, 200)
    const setCookie = login.response.headers.get('set-cookie')
    assert.match(setCookie, /pokemon_sync_session=[a-f0-9]{64}/)
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /SameSite=Strict/)
    assert.match(setCookie, /Secure/)
    const cookie = setCookie.split(';', 1)[0]

    const emptyCollection = await request(running.baseUrl, '/api/collection', { cookie })
    assert.equal(emptyCollection.response.status, 200)
    assert.deepEqual(emptyCollection.payload.keys, [])
    assert.equal(emptyCollection.payload.initialized, false)
    assert.equal(emptyCollection.payload.version, 0)

    const invalidCollection = await request(running.baseUrl, '/api/collection', {
      method: 'PUT',
      body: { keys: ['not-a-valid-slot'] },
      cookie,
    })
    assert.equal(invalidCollection.response.status, 400)

    const savedCollection = await request(running.baseUrl, '/api/collection', {
      method: 'PUT',
      body: { keys: firstKeys },
      cookie,
    })
    assert.equal(savedCollection.response.status, 200)
    assert.equal(savedCollection.payload.initialized, true)
    assert.equal(savedCollection.payload.version, 1)
    assert.deepEqual(new Set(savedCollection.payload.keys), new Set(firstKeys))

    const rejectedReplacement = await request(running.baseUrl, '/api/collection', {
      method: 'PUT',
      body: { keys: [] },
      cookie,
    })
    assert.equal(rejectedReplacement.response.status, 409)
    const collectionAfterRejectedReplacement = await request(running.baseUrl, '/api/collection', {
      cookie,
    })
    assert.deepEqual(new Set(collectionAfterRejectedReplacement.payload.keys), new Set(firstKeys))
    assert.equal(collectionAfterRejectedReplacement.payload.version, 1)

    const patchedCollection = await request(running.baseUrl, '/api/collection', {
      method: 'PATCH',
      body: { key: firstKeys[0], collected: false },
      cookie,
    })
    assert.equal(patchedCollection.response.status, 200)
    assert.equal(patchedCollection.payload.version, 2)

    await stopServer(running.server)
    running = await startServer({ databasePath, syncUsername: username, syncPasswordHash: passwordHash })

    const secondLogin = await request(running.baseUrl, '/api/login', {
      method: 'POST',
      body: { username, password },
    })
    const secondCookie = secondLogin.response.headers.get('set-cookie').split(';', 1)[0]
    const persistedCollection = await request(running.baseUrl, '/api/collection', {
      cookie: secondCookie,
    })
    assert.deepEqual(persistedCollection.payload.keys, [firstKeys[1]])
    assert.equal(persistedCollection.payload.initialized, true)
    assert.equal(persistedCollection.payload.version, 2)

    const logout = await request(running.baseUrl, '/api/logout', {
      method: 'POST',
      cookie: secondCookie,
    })
    assert.equal(logout.response.status, 200)
    assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/)

    const rejectedCollection = await request(running.baseUrl, '/api/collection', {
      cookie: secondCookie,
    })
    assert.equal(rejectedCollection.response.status, 401)
  } finally {
    if (running?.server.listening) await stopServer(running.server)
    await rm(directory, { recursive: true, force: true })
  }
})

test('登录失败限制不会阻止其他客户端登录', async () => {
  const passwordHash = await createPasswordHash(password)
  const running = await startServer({
    databasePath: ':memory:',
    syncUsername: username,
    syncPasswordHash: passwordHash,
  })

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const rejected = await request(running.baseUrl, '/api/login', {
        method: 'POST',
        body: { username: 'unknown', password: 'incorrect-password' },
        forwardedFor: '198.51.100.10',
      })
      assert.equal(rejected.response.status, 401)
    }

    const blocked = await request(running.baseUrl, '/api/login', {
      method: 'POST',
      body: { username, password },
      forwardedFor: '198.51.100.10',
    })
    assert.equal(blocked.response.status, 429)

    const otherClientLogin = await request(running.baseUrl, '/api/login', {
      method: 'POST',
      body: { username, password },
      forwardedFor: '203.0.113.20',
    })
    assert.equal(otherClientLogin.response.status, 200)
  } finally {
    await stopServer(running.server)
  }
})

test('拒绝过短密码和无效密码哈希', async () => {
  await assert.rejects(createPasswordHash('too-short'), /12–256/)
  assert.throws(
    () => createSyncServer({ databasePath: ':memory:', syncUsername: username, syncPasswordHash: 'bad' }),
    /格式无效/,
  )
})
