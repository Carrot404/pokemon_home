import { useEffect, useMemo, useRef, useState } from 'react'
import pokemonData from './data/pokemon.json'
import {
  GENERATION_NAMES,
  buildBoxPlan,
  formatNationalId,
  getItemSpriteUrl,
  getSpriteUrl,
  getWikiUrl,
} from './lib/boxPlanner.js'
import {
  acknowledgePendingChange,
  clearAcknowledgedChanges,
  loadStoredPendingChanges,
  recordPendingChange,
  savePendingChange,
} from './lib/pendingChanges.js'
import { SyncApiError, syncApi } from './lib/syncApi.js'
import { buildSearchIndex, searchPokemon } from './lib/searchPokemon.js'
import { loadMarkedSlots, removeCollectedMarks } from './lib/markedSlots.js'

const searchIndex = buildSearchIndex(pokemonData.entries)
const plan = buildBoxPlan(pokemonData.entries)
const entriesByKey = new Map(pokemonData.entries.map((entry) => [entry.key, entry]))
const validSlotKeys = new Set(plan.slots.map((slot) => slot.key))
const STORAGE_KEY = 'pokemon-home-box-guide:collection:v1'
const PENDING_STORAGE_KEY = 'pokemon-home-box-guide:pending-collection:v1'
const MARKED_STORAGE_KEY = 'pokemon-home-box-guide:marked-slots:v1'
const PLACEHOLDER_IMAGE = `${import.meta.env.BASE_URL}pokemon-placeholder.svg`
const KEY_STONE_IMAGE = getItemSpriteUrl('key-stone')

const STATUS_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'missing', label: '未收集' },
  { id: 'collected', label: '已收集' },
]

const VARIANT_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'normal', label: '普通' },
  { id: 'shiny', label: '闪光' },
]

function collectionFromKeys(keys, source = '收藏数据') {
  if (!Array.isArray(keys)) throw new Error(`${source}格式无效`)

  const collection = new Set()
  for (const key of keys) {
    if (typeof key !== 'string' || !validSlotKeys.has(key) || collection.has(key)) {
      throw new Error(`${source}包含无效箱位`)
    }
    collection.add(key)
  }
  return collection
}

function loadPendingChanges() {
  try {
    return loadStoredPendingChanges(window.localStorage, PENDING_STORAGE_KEY, validSlotKeys)
  } catch {
    return new Map()
  }
}

function loadLocalState() {
  let collection
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    collection = Array.isArray(stored)
      ? new Set(stored.filter((key) => typeof key === 'string' && validSlotKeys.has(key)))
      : new Set()
  } catch {
    collection = new Set()
  }

  const pendingChanges = loadPendingChanges()
  for (const [key, change] of pendingChanges) {
    if (change.collected) collection.add(key)
    else collection.delete(key)
  }
  return { collection, pendingChanges }
}

function downloadCollection(collection) {
  const content = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      keys: [...collection],
    },
    null,
    2,
  )
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `pokemon-home-collection-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function collectionFromBackup(file) {
  if (!file || file.size > 256 * 1024) throw new Error('备份文件无效或超过 256 KB')

  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('备份文件不是有效的 JSON')
  }
  return collectionFromKeys(Array.isArray(parsed) ? parsed : parsed?.keys, '备份文件')
}

function displayName(entry) {
  return entry.formLabel ? `${entry.name}（${entry.formLabel}）` : entry.name
}

function handleImageError(event) {
  if (event.currentTarget.dataset.fallback === 'true') return
  event.currentTarget.dataset.fallback = 'true'
  event.currentTarget.src = PLACEHOLDER_IMAGE
}

function handleStoneImageError(event) {
  if (event.currentTarget.dataset.fallback === 'true') return
  event.currentTarget.dataset.fallback = 'true'
  event.currentTarget.src = KEY_STONE_IMAGE
}

function uniqueMegaStones(megaForms = []) {
  return [...new Map(megaForms.map((form) => [form.stone.slug, form.stone])).values()]
}

function AnniversaryMark() {
  return (
    <div className="anniversary-mark" role="img" aria-label="宝可梦 30 周年，1996 至 2026，非官方纪念设计">
      <span className="anniversary-mark-top" aria-hidden="true">POKÉMON</span>
      <strong aria-hidden="true">3<span className="anniversary-ball">0</span></strong>
      <span className="anniversary-mark-label" aria-hidden="true">周年 · 相伴</span>
      <span className="anniversary-mark-years" aria-hidden="true">1996 — 2026</span>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.25 4.25" />
    </svg>
  )
}

function ChevronIcon({ direction = 'right' }) {
  return (
    <svg
      className={direction === 'left' ? 'icon--left' : undefined}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 1.55 5.1L18 10l-4.45 2.9L12 18l-1.55-5.1L6 10l4.45-2.9L12 2Z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
      <path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z" />
      <path d="M12 11v10" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

function FilterGroup({ label, value, options, onChange }) {
  return (
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            className={value === option.id ? 'is-active' : undefined}
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function TypeBadge({ type }) {
  return (
    <span className="type-badge" data-type={type}>
      {type}
    </span>
  )
}

function MegaStoneMark({ megaForms }) {
  const stones = uniqueMegaStones(megaForms)
  if (!stones.length) return null

  return (
    <span
      className="mega-stone-mark"
      title={stones.map((stone) => stone.name).join('、')}
      aria-hidden="true"
    >
      {stones.map((stone) => (
        <img
          key={stone.slug}
          src={getItemSpriteUrl(stone.spriteSlug)}
          alt=""
          onError={handleStoneImageError}
        />
      ))}
    </span>
  )
}

function PokemonSlot({ slot, isCollected, isMarked, isMuted, isHighlighted, onOpen, onToggle, onMark }) {
  const { entry, isShiny } = slot
  const name = displayName(entry)

  return (
    <article
      className={`pokemon-slot pokemon-slot--${slot.id}${isCollected ? ' is-collected' : ''}${
        isMuted ? ' is-muted' : ''
      }${isHighlighted ? ' is-highlighted' : ''}`}
      data-position={slot.position}
    >
      <button
        className="slot-main"
        type="button"
        onClick={() => onOpen(entry.key)}
        aria-label={`${name}，${slot.label}，箱子 ${slot.boxNumber} 第 ${slot.position} 格${entry.megaForms?.length ? '，可以超级进化' : ''}，查看详情`}
      >
        <span className="slot-meta">
          <span className="slot-dex-number">{formatNationalId(entry.nationalId)}</span>
          <span className="slot-position">{String(slot.position).padStart(2, '0')}</span>
        </span>
        <span className="slot-image-wrap">
          <MegaStoneMark megaForms={entry.megaForms} />
          {isShiny && (
            <span className="shiny-mark" aria-label="闪光">
              <SparkleIcon />
            </span>
          )}
          <img
            src={getSpriteUrl(entry.imageId, isShiny)}
            alt={`${name}${isShiny ? '闪光' : '普通'}形态`}
            loading="lazy"
            onError={handleImageError}
          />
        </span>
        <span className="slot-name" title={name}>
          {entry.name}
        </span>
        <span
          className="slot-form"
          title={entry.formLabel ? `${entry.formLabel} · ${slot.label}` : slot.label}
        >
          {entry.formLabel ? `${entry.formLabel} · ${slot.label}` : slot.label}
        </span>
      </button>
      <div className="slot-actions">
        <button
          className="collection-toggle"
          type="button"
          aria-pressed={isCollected}
          aria-label={`${isCollected ? '取消收集' : '标记已收集'}：${name}${slot.label}`}
          onClick={() => onToggle(slot.key)}
        >
          <span className="check-box" aria-hidden="true">
            {isCollected && <CheckIcon />}
          </span>
          {isCollected ? '已收集' : '待收集'}
        </button>
        {!isCollected && (
          <button
            className="mark-toggle"
            type="button"
            aria-pressed={isMarked}
            aria-label={`${isMarked ? '取消标记' : '标记待找'}：${name}${slot.label}`}
            onClick={() => onMark(slot.key)}
          >
            {isMarked ? '已标记' : '标记待找'}
          </button>
        )}
      </div>
    </article>
  )
}

function EmptySlot({ position }) {
  return (
    <div className="empty-slot" aria-label={`第 ${position} 格留空`}>
      <span>{String(position).padStart(2, '0')}</span>
      <div className="empty-slot-mark" aria-hidden="true" />
      <small>留空</small>
    </div>
  )
}

function MegaGallery({ megaForms }) {
  if (!megaForms?.length) return null

  return (
    <section className="mega-gallery" aria-labelledby="mega-gallery-title">
      <header className="mega-gallery-header">
        <div className="mega-gallery-symbol" aria-hidden="true">
          <img src={KEY_STONE_IMAGE} alt="" onError={handleStoneImageError} />
        </div>
        <div>
          <span>MEGA EVOLUTION</span>
          <h3 id="mega-gallery-title">超级进化形态</h3>
          <p>战斗中的暂时形态，不占用 HOME 箱位，也不计入收藏进度。</p>
        </div>
        <strong>{megaForms.length} 种</strong>
      </header>

      <div className="mega-gallery-grid">
        {megaForms.map((megaForm) => (
          <article className="mega-form-card" key={megaForm.key}>
            <header>
              <div>
                <h4>{megaForm.name}</h4>
                <div className="type-list">
                  {megaForm.types.map((type) => (
                    <TypeBadge key={type} type={type} />
                  ))}
                </div>
              </div>
              <div className="mega-stone-detail" title={megaForm.stone.name}>
                <img
                  src={getItemSpriteUrl(megaForm.stone.spriteSlug)}
                  alt={`${megaForm.stone.name}图标`}
                  onError={handleStoneImageError}
                />
                <span>{megaForm.stone.name}</span>
              </div>
            </header>

            <div className="mega-image-pair">
              <figure>
                <div className="mega-image-wrap">
                  <img
                    src={getSpriteUrl(megaForm.imageId, false)}
                    alt={`${megaForm.name}普通形态`}
                    loading="lazy"
                    onError={handleImageError}
                  />
                </div>
                <figcaption>普通</figcaption>
              </figure>
              <figure className="is-shiny">
                <div className="mega-image-wrap">
                  <span className="mega-shiny-mark" aria-hidden="true">
                    <SparkleIcon />
                  </span>
                  <img
                    src={getSpriteUrl(megaForm.imageId, true)}
                    alt={`${megaForm.name}闪光形态`}
                    loading="lazy"
                    onError={handleImageError}
                  />
                </div>
                <figcaption>闪光</figcaption>
              </figure>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function EntryDialog({ entry, collected, onToggle, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (entry && !dialog.open) dialog.showModal()
    if (!entry && dialog.open) dialog.close()
  }, [entry])

  const variantSlots = entry
    ? ['normal', 'shiny'].map((variant) => plan.slotByKey.get(`${entry.key}:${variant}`))
    : []

  return (
    <dialog
      ref={dialogRef}
      className="entry-dialog"
      aria-labelledby="entry-dialog-title"
      onClose={onClose}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      {entry && (
        <div className="dialog-content">
          <button
            className="dialog-close"
            type="button"
            aria-label="关闭详情"
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            <CloseIcon />
          </button>

          <header className="dialog-header">
            <div className="dialog-number">{formatNationalId(entry.nationalId)}</div>
            <h2 id="entry-dialog-title">{entry.name}</h2>
            <p>{entry.formLabel ?? '默认形态'}</p>
            <div className="type-list">
              {entry.types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </div>
          </header>

          <dl className="entry-facts">
            <div>
              <dt>分类</dt>
              <dd>{entry.category}</dd>
            </div>
            <div>
              <dt>归属</dt>
              <dd>{GENERATION_NAMES[entry.generation]}</dd>
            </div>
            <div>
              <dt>地区形态</dt>
              <dd>{entry.region ?? '无'}</dd>
            </div>
          </dl>

          <div className="variant-details">
            {variantSlots.map((slot) => {
              const isCollected = collected.has(slot.key)
              return (
                <section className={`variant-card variant-card--${slot.id}`} key={slot.key}>
                  <div className="variant-card-heading">
                    <span>{slot.label}</span>
                    {slot.isShiny && <SparkleIcon />}
                  </div>
                  <img
                    src={getSpriteUrl(entry.imageId, slot.isShiny)}
                    alt={`${displayName(entry)}${slot.label}形态`}
                    onError={handleImageError}
                  />
                  <strong>
                    箱子 {String(slot.boxNumber).padStart(2, '0')} · 第{' '}
                    {String(slot.position).padStart(2, '0')} 格
                  </strong>
                  <span>
                    第 {slot.row} 行 · 第 {slot.column} 列
                  </span>
                  <button
                    type="button"
                    className={isCollected ? 'is-collected' : undefined}
                    aria-pressed={isCollected}
                    onClick={() => onToggle(slot.key)}
                  >
                    <span className="check-box" aria-hidden="true">
                      {isCollected && <CheckIcon />}
                    </span>
                    {isCollected ? '已收集' : '标记为已收集'}
                  </button>
                </section>
              )
            })}
          </div>

          <MegaGallery megaForms={entry.megaForms} />

          <a
            className="source-link"
            href={getWikiUrl(entry.name)}
            target="_blank"
            rel="noreferrer"
          >
            在 52Poké 查看资料
            <ExternalIcon />
          </a>
        </div>
      )}
    </dialog>
  )
}

function LoginScreen({ localCount, busy, error, onLogin, onExport }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="app-shell sync-shell">
      <main className="sync-card" aria-labelledby="sync-login-title">
        <AnniversaryMark />
        <p className="eyebrow">宝可梦 30 周年 · 非官方纪念主题</p>
        <h1 id="sync-login-title">欢迎回到你的图鉴</h1>
        <p className="sync-card-description">
          三十年冒险，每一份相遇都值得珍藏。登录 HOME 全国图鉴收纳册，在不同设备间同步你的收藏。
        </p>

        <form
          className="sync-form"
          onSubmit={async (event) => {
            event.preventDefault()
            await onLogin(username, password)
          }}
        >
          <label htmlFor="sync-username">用户名</label>
          <input
            id="sync-username"
            name="username"
            autoComplete="username"
            required
            maxLength="64"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="sync-password">密码</label>
          <input
            id="sync-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength="256"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="sync-error" role="alert">{error}</p>}
          <button className="sync-primary-button" type="submit" disabled={busy}>
            {busy ? '正在登录…' : '登录，继续收藏之旅'}
          </button>
        </form>

        {localCount > 0 && (
          <aside className="local-backup-note">
            <div>
              <strong>检测到本机有 {localCount} 项收藏</strong>
              <p>首次登录后可将它们导入服务器；也可以先下载备份。</p>
            </div>
            <button type="button" onClick={onExport}>导出本机备份</button>
          </aside>
        )}
      </main>
    </div>
  )
}

function MigrationScreen({
  username,
  localCount,
  busy,
  error,
  onImport,
  onUpload,
  onStartEmpty,
  onLogout,
}) {
  return (
    <div className="app-shell sync-shell">
      <main className="sync-card" aria-labelledby="sync-migration-title">
        <AnniversaryMark />
        <p className="eyebrow">首次同步 · {username}</p>
        <h1 id="sync-migration-title">初始化服务器收藏</h1>
        <p className="sync-card-description">
          服务器尚无收藏数据。你可以上传当前浏览器中的进度，或先导入从旧地址导出的备份。
        </p>

        <div className="migration-summary" aria-live="polite">
          当前待上传 <strong>{localCount.toLocaleString('zh-CN')}</strong> 项收藏
        </div>

        <div className="migration-actions">
          <button className="sync-primary-button" type="button" disabled={busy} onClick={onUpload}>
            {busy ? '正在上传…' : localCount ? `上传这 ${localCount} 项收藏` : '初始化空收藏'}
          </button>
          <label className="sync-secondary-button">
            导入 JSON 备份
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) await onImport(file)
              }}
            />
          </label>
          {localCount > 0 && (
            <button className="sync-link-button" type="button" disabled={busy} onClick={onStartEmpty}>
              忽略本机数据并从空白开始
            </button>
          )}
          <button className="sync-link-button" type="button" disabled={busy} onClick={onLogout}>
            退出登录
          </button>
        </div>
        {error && <p className="sync-error" role="alert">{error}</p>}
      </main>
    </div>
  )
}

function SyncStatusScreen({ title, description, error, onRetry, onLogout }) {
  return (
    <div className="app-shell sync-shell">
      <main className="sync-card" aria-labelledby="sync-status-title">
        <AnniversaryMark />
        <p className="eyebrow">宝可梦 30 周年 · 收藏同步</p>
        <h1 id="sync-status-title">{title}</h1>
        <p className="sync-card-description">{description}</p>
        {error && <p className="sync-error" role="alert">{error}</p>}
        {(onRetry || onLogout) && (
          <div className="migration-actions">
            {onRetry && <button className="sync-primary-button" type="button" onClick={onRetry}>重试</button>}
            {onLogout && <button className="sync-link-button" type="button" onClick={onLogout}>退出登录</button>}
          </div>
        )}
      </main>
    </div>
  )
}

function App() {
  const [initialLocalState] = useState(loadLocalState)
  const [activeBoxNumber, setActiveBoxNumber] = useState(1)
  const [selectedEntryKey, setSelectedEntryKey] = useState(null)
  const [highlightedSlot, setHighlightedSlot] = useState(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [markedOpen, setMarkedOpen] = useState(false)
  const [markedSlots, setMarkedSlots] = useState(() =>
    loadMarkedSlots(window.localStorage, MARKED_STORAGE_KEY, validSlotKeys),
  )
  const [statusFilter, setStatusFilter] = useState('all')
  const [variantFilter, setVariantFilter] = useState('all')
  const [collected, setCollected] = useState(initialLocalState.collection)
  const [account, setAccount] = useState({ status: 'checking', username: '' })
  const [collectionReady, setCollectionReady] = useState(false)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [syncStatus, setSyncStatus] = useState('loading')
  const [syncError, setSyncError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const boxViewportRef = useRef(null)
  const collectedRef = useRef(collected)
  const dirtySlotsRef = useRef(initialLocalState.pendingChanges)
  const pendingChangesRef = useRef(0)
  const syncQueueRef = useRef(Promise.resolve())
  const serverVersionRef = useRef(-1)
  const nextOperationIdRef = useRef(0)

  const currentBox = plan.boxes[activeBoxNumber - 1]
  const currentGeneration = plan.generations[currentBox.generation - 1]
  const selectedEntry = selectedEntryKey ? entriesByKey.get(selectedEntryKey) : null

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...collected]))
    } catch {
      // Browsers can disable storage; the current session still remains usable.
    }
  }, [collected])

  useEffect(() => {
    try {
      window.localStorage.setItem(MARKED_STORAGE_KEY, JSON.stringify([...markedSlots]))
    } catch {
      // Marking still works for this session when storage is unavailable.
    }
  }, [markedSlots])

  useEffect(() => {
    if (!collectionReady || ![...markedSlots].some((key) => collected.has(key))) return
    setMarkedSlots((current) => removeCollectedMarks(current, collected))
  }, [collected, collectionReady, markedSlots])

  useEffect(() => {
    const controller = new AbortController()

    async function restoreSession() {
      let authenticated = false
      try {
        const session = await syncApi.session(controller.signal)
        if (!session.authenticated) {
          setAccount({ status: 'signed-out', username: '' })
          setSyncStatus('idle')
          return
        }
        authenticated = true
        await loadRemoteCollection(session.username, controller.signal)
      } catch (error) {
        if (error.name === 'AbortError') return
        if (error instanceof SyncApiError && error.status === 401) {
          setAccount({ status: 'signed-out', username: '' })
          setLoginError('登录已过期，请重新登录')
          return
        }
        if (authenticated) {
          setSyncStatus('error')
          setSyncError(error.message || '无法读取服务器收藏数据')
        } else {
          setAccount({ status: 'signed-out', username: '' })
          setLoginError(error.message || '无法连接收藏同步服务')
        }
      }
    }

    restoreSession()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (account.status !== 'authenticated' || !collectionReady || migrationRequired) return undefined

    const controller = new AbortController()
    async function refreshWhenActive() {
      if (document.visibilityState === 'hidden' || pendingChangesRef.current) return
      try {
        await refreshRemoteCollection(controller.signal)
      } catch (error) {
        if (error.name !== 'AbortError') handleSyncFailure(error)
      }
    }
    const interval = window.setInterval(refreshWhenActive, 15_000)
    window.addEventListener('focus', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [account.status, collectionReady, migrationRequired])

  useEffect(() => {
    boxViewportRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [activeBoxNumber])

  useEffect(() => {
    if (!highlightedSlot) return
    const target = boxViewportRef.current?.querySelector(
      `[data-position="${highlightedSlot.position}"]`,
    )
    target?.querySelector('.slot-main')?.focus({ preventScroll: true })
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }, [highlightedSlot])

  const generationCollected = useMemo(
    () =>
      Object.fromEntries(
        plan.generations.map((generation) => [
          generation.number,
          plan.slots.filter(
            (slot) => slot.generation === generation.number && collected.has(slot.key),
          ).length,
        ]),
      ),
    [collected],
  )

  const searchResults = useMemo(() => searchPokemon(searchIndex, query), [query])
  const markedList = plan.slots.filter(
    (slot) => markedSlots.has(slot.key) && !collected.has(slot.key),
  )

  const currentBoxCollected = currentBox.cells.filter(
    (slot) => slot && collected.has(slot.key),
  ).length
  const progress = Math.round((collected.size / plan.slots.length) * 100)

  function setCurrentCollection(next) {
    collectedRef.current = next
    setCollected(next)
  }

  function applyRemoteCollection(keys, version, force = false) {
    if (!force && version < serverVersionRef.current) return false

    const next = collectionFromKeys(keys, '服务器收藏数据')
    for (const [key, change] of dirtySlotsRef.current) {
      if (change.collected) next.add(key)
      else next.delete(key)
    }
    serverVersionRef.current = version
    setCurrentCollection(next)
    return true
  }

  function handleSyncFailure(error) {
    if (error instanceof SyncApiError && error.status === 401) {
      setAccount({ status: 'signed-out', username: '' })
      setCollectionReady(false)
      setLoginError('登录已过期，本机未同步的修改仍已保留，请重新登录')
    }
    setSyncStatus('error')
    setSyncError(error.message || '收藏同步失败')
  }

  async function refreshRemoteCollection(signal) {
    const remote = await syncApi.collection(signal)
    if (!remote.initialized) {
      setMigrationRequired(true)
      setCollectionReady(false)
      setSyncStatus('idle')
      return
    }

    applyRemoteCollection(remote.keys, remote.version)
    if (!dirtySlotsRef.current.size) {
      setSyncStatus('synced')
      setSyncError('')
    }
  }

  async function loadRemoteCollection(username, signal) {
    setAccount({ status: 'authenticated', username })
    setCollectionReady(false)
    setMigrationRequired(false)
    setSyncStatus('loading')
    setSyncError('')

    const remote = await syncApi.collection(signal)
    if (!remote.initialized) {
      setMigrationRequired(true)
      setSyncStatus('idle')
      return
    }

    applyRemoteCollection(remote.keys, remote.version, true)
    setCollectionReady(true)
    if (dirtySlotsRef.current.size) {
      for (const [key, change] of [...dirtySlotsRef.current]) {
        enqueueSlotSync(key, change.collected, change)
      }
    } else {
      setSyncStatus('synced')
    }
  }

  async function handleLogin(username, password) {
    setAccountBusy(true)
    setLoginError('')
    let authenticated = false
    try {
      const session = await syncApi.login(username, password)
      authenticated = true
      await loadRemoteCollection(session.username)
    } catch (error) {
      if (authenticated) {
        handleSyncFailure(error)
      } else {
        setAccount({ status: 'signed-out', username: '' })
        setLoginError(error.message || '登录失败')
      }
    } finally {
      setAccountBusy(false)
    }
  }

  async function handleLogout() {
    setAccountBusy(true)
    setSyncError('')
    try {
      await syncQueueRef.current.catch(() => {})
      if (dirtySlotsRef.current.size) {
        throw new Error('仍有未同步的修改，请先重试同步后再退出')
      }
      await syncApi.logout()
      setAccount({ status: 'signed-out', username: '' })
      setCollectionReady(false)
      setMigrationRequired(false)
      setSyncStatus('idle')
      serverVersionRef.current = -1
    } catch (error) {
      setSyncStatus('error')
      setSyncError(error.message || '退出登录失败')
    } finally {
      setAccountBusy(false)
    }
  }

  async function initializeServerCollection(keys) {
    setAccountBusy(true)
    setSyncError('')
    try {
      const remote = await syncApi.initializeCollection(keys)
      for (const [key, change] of dirtySlotsRef.current) {
        try {
          clearAcknowledgedChanges(window.localStorage, PENDING_STORAGE_KEY, key, change)
        } catch {
          // The server is initialized even when browser storage is unavailable.
        }
      }
      dirtySlotsRef.current.clear()
      applyRemoteCollection(remote.keys, remote.version, true)
      setMigrationRequired(false)
      setCollectionReady(true)
      setSyncStatus('synced')
    } catch (error) {
      handleSyncFailure(error)
    } finally {
      setAccountBusy(false)
    }
  }

  async function importMigrationBackup(file) {
    setAccountBusy(true)
    setSyncError('')
    try {
      setCurrentCollection(await collectionFromBackup(file))
    } catch (error) {
      setSyncError(error.message || '无法导入备份')
    } finally {
      setAccountBusy(false)
    }
  }

  function enqueueSlotSync(key, isCollected, existing = null) {
    const operationId = ++nextOperationIdRef.current
    let stored = existing
    if (!stored?.id) {
      try {
        stored = savePendingChange(window.localStorage, PENDING_STORAGE_KEY, key, isCollected)
      } catch {
        // Browsers can disable storage; keep the modification for this session.
      }
    }
    recordPendingChange(dirtySlotsRef.current, key, isCollected, operationId, stored ?? {})
    pendingChangesRef.current += 1
    setSyncStatus('syncing')

    const operation = syncQueueRef.current
      .catch(() => {})
      .then(() => syncApi.updateSlot(key, isCollected))
    syncQueueRef.current = operation

    operation
      .then((remote) => {
        serverVersionRef.current = Math.max(serverVersionRef.current, remote.version)
        if (stored) {
          try {
            clearAcknowledgedChanges(window.localStorage, PENDING_STORAGE_KEY, key, stored)
          } catch {
            // A later visit can safely replay the idempotent update.
          }
        }
        acknowledgePendingChange(dirtySlotsRef.current, key, operationId)
      })
      .catch(handleSyncFailure)
      .finally(() => {
        pendingChangesRef.current -= 1
        if (pendingChangesRef.current === 0) {
          if (dirtySlotsRef.current.size) {
            setSyncStatus('error')
          } else {
            setSyncStatus('synced')
            setSyncError('')
          }
        }
      })
  }

  async function retrySync() {
    if (pendingChangesRef.current) return
    if (dirtySlotsRef.current.size) {
      for (const [key, change] of [...dirtySlotsRef.current]) {
        enqueueSlotSync(key, change.collected, change)
      }
      return
    }

    setSyncStatus('syncing')
    try {
      await refreshRemoteCollection()
    } catch (error) {
      handleSyncFailure(error)
    }
  }

  function toggleCollected(slotKey) {
    if (!validSlotKeys.has(slotKey)) return
    const next = new Set(collectedRef.current)
    const isCollected = !next.has(slotKey)
    if (isCollected) next.add(slotKey)
    else next.delete(slotKey)
    setCurrentCollection(next)
    enqueueSlotSync(slotKey, isCollected)
  }

  function toggleMarked(slotKey) {
    if (!validSlotKeys.has(slotKey) || collectedRef.current.has(slotKey)) return
    setMarkedSlots((current) => {
      const next = new Set(current)
      if (next.has(slotKey)) next.delete(slotKey)
      else next.add(slotKey)
      return next
    })
  }

  function goToMarkedSlot(slot) {
    setActiveBoxNumber(slot.boxNumber)
    setHighlightedSlot({ entryKey: slot.entry.key, position: slot.position })
    setStatusFilter('all')
    setVariantFilter('all')
    setSearchOpen(false)
  }

  function goToBox(boxNumber) {
    const next = Math.min(plan.boxes.length, Math.max(1, Number(boxNumber) || 1))
    setActiveBoxNumber(next)
    setHighlightedSlot(null)
  }

  function goToGeneration(generationNumber) {
    const generation = plan.generations[generationNumber - 1]
    setActiveBoxNumber(generation.firstBox)
    setHighlightedSlot(null)
  }

  function selectSearchResult(entry) {
    const slot = plan.slotByKey.get(`${entry.key}:normal`)
    setActiveBoxNumber(slot.boxNumber)
    setHighlightedSlot({ entryKey: entry.key, position: slot.position })
    setQuery(`${formatNationalId(entry.nationalId)} ${displayName(entry)}`)
    setStatusFilter('all')
    setVariantFilter('all')
    setSearchOpen(false)
  }

  function isSlotMuted(slot) {
    const collectedStatus = collected.has(slot.key)
    const statusMismatch =
      (statusFilter === 'missing' && collectedStatus) ||
      (statusFilter === 'collected' && !collectedStatus)
    const variantMismatch = variantFilter !== 'all' && slot.id !== variantFilter
    return statusMismatch || variantMismatch
  }

  if (account.status === 'checking') {
    return (
      <SyncStatusScreen
        title="正在连接同步服务"
        description="正在检查登录状态并读取服务器收藏数据…"
      />
    )
  }

  if (account.status === 'signed-out') {
    return (
      <LoginScreen
        localCount={collected.size}
        busy={accountBusy}
        error={loginError}
        onLogin={handleLogin}
        onExport={() => downloadCollection(collectedRef.current)}
      />
    )
  }

  if (migrationRequired) {
    return (
      <MigrationScreen
        username={account.username}
        localCount={collected.size}
        busy={accountBusy}
        error={syncError}
        onImport={importMigrationBackup}
        onUpload={() => initializeServerCollection([...collectedRef.current])}
        onStartEmpty={() => {
          if (window.confirm('确定忽略当前浏览器中的收藏记录并从空白开始吗？')) {
            initializeServerCollection([])
          }
        }}
        onLogout={handleLogout}
      />
    )
  }

  if (!collectionReady) {
    return (
      <SyncStatusScreen
        title={syncStatus === 'error' ? '无法读取收藏数据' : '正在读取收藏数据'}
        description="本机缓存保持不变，连接恢复后可继续同步。"
        error={syncError}
        onRetry={async () => {
          try {
            await loadRemoteCollection(account.username)
          } catch (error) {
            handleSyncFailure(error)
          }
        }}
        onLogout={handleLogout}
      />
    )
  }

  const syncStatusLabel = {
    synced: '已同步',
    syncing: '正在同步…',
    error: '同步失败',
  }[syncStatus] ?? '已连接'

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <div>
            <p className="eyebrow">1996 — 2026 · 宝可梦 30 周年</p>
            <h1><span>HOME 全国图鉴</span>收纳册<span className="hero-title-dot" aria-hidden="true">。</span></h1>
            <p className="hero-description">
              三十年冒险，每一份相遇都值得珍藏。
              <span>普通与闪光并肩，让每一位伙伴都有自己的位置。</span>
            </p>
            <div className="sync-account" aria-live="polite">
              <span className="sync-indicator" data-status={syncStatus} aria-hidden="true" />
              <span className="sync-account-copy">
                <strong>{account.username}</strong>
                <small>{syncStatusLabel}</small>
              </span>
              {syncStatus === 'error' && (
                <button type="button" onClick={retrySync}>重试同步</button>
              )}
              <button type="button" onClick={() => downloadCollection(collectedRef.current)}>
                导出备份
              </button>
              <button type="button" disabled={accountBusy} onClick={handleLogout}>
                退出
              </button>
            </div>
            {syncError && syncStatus === 'error' && (
              <p className="hero-sync-error" role="alert">{syncError}</p>
            )}
          </div>
        </div>

        <div className="hero-anniversary">
          <AnniversaryMark />
          <p>始于相遇，未完待续。</p>
          <span>非官方纪念主题</span>
        </div>

        <div className="hero-stats" aria-label="收藏总览">
          <div
            className="progress-ring"
            style={{ '--progress-angle': `${progress * 3.6}deg` }}
            aria-label={`总进度 ${progress}%`}
          >
            <div>
              <strong>{progress}%</strong>
              <span>总进度</span>
            </div>
          </div>
          <div className="collection-caption">
            <span>MY COLLECTION</span>
            <strong>把热爱，一格格珍藏</strong>
          </div>
          <dl className="metric-list">
            <div>
              <dt>已收集</dt>
              <dd>
                {collected.size.toLocaleString('zh-CN')}
                <span> / {plan.slots.length.toLocaleString('zh-CN')}</span>
              </dd>
            </div>
            <div>
              <dt>箱子规划</dt>
              <dd>
                {plan.boxes.length}<span> 箱</span>
              </dd>
            </div>
            <div>
              <dt>图鉴范围</dt>
              <dd>
                1–9<span> 世代</span>
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <main>
        <section className="control-panel" aria-label="查找与筛选">
          <div
            className="search-area"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false)
            }}
          >
            <form
              className="search-box"
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                if (searchResults[0]) selectSearchResult(searchResults[0])
              }}
            >
              <SearchIcon />
              <label className="sr-only" htmlFor="pokemon-search">
                搜索全国编号、中文名或拼音首字母
              </label>
              <input
                id="pokemon-search"
                value={query}
                type="search"
                autoComplete="off"
                placeholder="搜索编号、中文名、拼音首字母或地区形态…"
                aria-expanded={searchOpen && Boolean(query.trim())}
                aria-controls="search-results"
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchOpen(true)
                  setHighlightedSlot(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false)
                }}
              />
            </form>

            {searchOpen && query.trim() && (
              <div className="search-results" id="search-results">
                {searchResults.length ? (
                  searchResults.map((entry) => {
                    const slot = plan.slotByKey.get(`${entry.key}:normal`)
                    return (
                      <button
                        type="button"
                        key={entry.key}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSearchResult(entry)}
                      >
                        <img
                          src={getSpriteUrl(entry.imageId, false)}
                          alt=""
                          onError={handleImageError}
                        />
                        <span>
                          <strong>{displayName(entry)}</strong>
                          <small>
                            {formatNationalId(entry.nationalId)} · {GENERATION_NAMES[entry.generation]}
                          </small>
                        </span>
                        <em>
                          箱 {String(slot.boxNumber).padStart(2, '0')} ·{' '}
                          {String(slot.position).padStart(2, '0')}
                        </em>
                      </button>
                    )
                  })
                ) : (
                  <p>没有找到对应的宝可梦</p>
                )}
              </div>
            )}
          </div>

          <div className="filter-row">
            <FilterGroup
              label="收集状态"
              value={statusFilter}
              options={STATUS_FILTERS}
              onChange={setStatusFilter}
            />
            <FilterGroup
              label="形态类型"
              value={variantFilter}
              options={VARIANT_FILTERS}
              onChange={setVariantFilter}
            />
          </div>
          <p className="filter-hint">普通在左 · 闪光在右 · 筛选仅淡化，不改变固定箱位</p>
          <div className="marked-section">
            <button
              className="marked-toggle"
              type="button"
              aria-expanded={markedOpen}
              aria-controls="marked-list"
              onClick={() => setMarkedOpen((open) => !open)}
            >
              待找清单（{markedList.length}）{markedOpen ? '收起' : '展开'}
            </button>
            <span>标记仅保存在此浏览器</span>
            <div id="marked-list" className="marked-list" hidden={!markedOpen}>
              {markedList.length ? markedList.map((slot) => (
                <div className="marked-item" key={slot.key}>
                  <button type="button" onClick={() => goToMarkedSlot(slot)}>
                    <strong>{formatNationalId(slot.entry.nationalId)} {displayName(slot.entry)} · {slot.label}</strong>
                    <span>箱 {String(slot.boxNumber).padStart(2, '0')} · 第 {String(slot.position).padStart(2, '0')} 格</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`取消标记：${displayName(slot.entry)}${slot.label}`}
                    onClick={() => toggleMarked(slot.key)}
                  >
                    取消标记
                  </button>
                </div>
              )) : <p>暂无待找的宝可梦</p>}
            </div>
          </div>
        </section>

        <nav className="generation-tabs" aria-label="按世代跳转">
          {plan.generations.map((generation) => {
            const isActive = generation.number === currentBox.generation
            const collectedCount = generationCollected[generation.number]
            const generationProgress = Math.round((collectedCount / generation.slotCount) * 100)
            return (
              <button
                type="button"
                key={generation.number}
                className={isActive ? 'is-active' : undefined}
                aria-current={isActive ? 'page' : undefined}
                data-generation={generation.number}
                onClick={() => goToGeneration(generation.number)}
              >
                <span>GEN {generation.number}</span>
                <strong>{generation.name}</strong>
                <small>
                  箱 {generation.firstBox}–{generation.lastBox} · {generationProgress}%
                </small>
              </button>
            )
          })}
        </nav>

        <section className="box-panel" data-generation={currentBox.generation}>
          <header className="box-panel-header">
            <button
              className="box-nav-button"
              type="button"
              aria-label="上一个箱子"
              disabled={activeBoxNumber === 1}
              onClick={() => goToBox(activeBoxNumber - 1)}
            >
              <ChevronIcon direction="left" />
            </button>

            <div className="box-title-group">
              <span className="generation-pill">{GENERATION_NAMES[currentBox.generation]}</span>
              <div className="box-title-line">
                <BoxIcon />
                <h2>箱子 {String(currentBox.number).padStart(2, '0')}</h2>
                <label className="box-picker">
                  <span aria-hidden="true">跳转</span>
                  <span className="sr-only">跳转到箱子</span>
                  <select
                    value={activeBoxNumber}
                    onChange={(event) => goToBox(event.target.value)}
                    aria-label="选择箱子"
                  >
                    {plan.generations.map((generation) => (
                      <optgroup key={generation.number} label={generation.name}>
                        {plan.boxes
                          .filter((box) => box.generation === generation.number)
                          .map((box) => (
                            <option value={box.number} key={box.number}>
                              箱子 {String(box.number).padStart(2, '0')}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
              <p>
                本世代第 {currentBox.generationBox} / {currentBox.generationBoxCount} 箱 ·{' '}
                {currentBox.occupiedCount} / 30 个有效箱位
              </p>
            </div>

            <button
              className="box-nav-button"
              type="button"
              aria-label="下一个箱子"
              disabled={activeBoxNumber === plan.boxes.length}
              onClick={() => goToBox(activeBoxNumber + 1)}
            >
              <ChevronIcon />
            </button>
          </header>

          <div className="box-progress-row">
            <span>
              本箱已收集 <strong>{currentBoxCollected}</strong> / {currentBox.occupiedCount}
            </span>
            <div className="linear-progress" aria-hidden="true">
              <span
                style={{
                  width: `${
                    currentBox.occupiedCount
                      ? (currentBoxCollected / currentBox.occupiedCount) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <span className="swipe-hint">横向滑动查看完整 6 列</span>
          </div>

          <div className="box-viewport" ref={boxViewportRef} tabIndex="0">
            <div className="home-box-grid" aria-label={`箱子 ${currentBox.number}，六列五行`}>
              {currentBox.cells.map((slot, index) =>
                slot ? (
                  <PokemonSlot
                    key={slot.key}
                    slot={slot}
                    isCollected={collected.has(slot.key)}
                    isMarked={markedSlots.has(slot.key)}
                    isMuted={isSlotMuted(slot)}
                    isHighlighted={highlightedSlot?.entryKey === slot.entry.key}
                    onOpen={setSelectedEntryKey}
                    onToggle={toggleCollected}
                    onMark={toggleMarked}
                  />
                ) : (
                  <EmptySlot key={`empty-${index + 1}`} position={index + 1} />
                ),
              )}
            </div>
          </div>

          <footer className="box-panel-footer">
            <span>
              第 {currentGeneration.firstBox}–{currentGeneration.lastBox} 箱属于
              {currentGeneration.name}
            </span>
            <span>
              共 {currentGeneration.entryCount} 个形态 · {currentGeneration.slotCount} 个箱位
            </span>
          </footer>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <strong>数据来源</strong>
          <a href={pokemonData.sources.names} target="_blank" rel="noreferrer">
            52Poké 全国图鉴
            <ExternalIcon />
          </a>
          <a href={pokemonData.sources.structuredData} target="_blank" rel="noreferrer">
            PokéAPI
            <ExternalIcon />
          </a>
        </div>
        <p>
          非官方收藏辅助工具。宝可梦相关名称与图像版权归其各自权利人所有。
        </p>
      </footer>

      <EntryDialog
        entry={selectedEntry}
        collected={collected}
        onToggle={toggleCollected}
        onClose={() => setSelectedEntryKey(null)}
      />
    </div>
  )
}

export default App
