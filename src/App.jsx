import { useEffect, useMemo, useRef, useState } from 'react'
import pokemonData from './data/pokemon.json'
import {
  GENERATION_NAMES,
  buildBoxPlan,
  formatNationalId,
  getSpriteUrl,
  getWikiUrl,
} from './lib/boxPlanner.js'

const plan = buildBoxPlan(pokemonData.entries)
const entriesByKey = new Map(pokemonData.entries.map((entry) => [entry.key, entry]))
const validSlotKeys = new Set(plan.slots.map((slot) => slot.key))
const STORAGE_KEY = 'pokemon-home-box-guide:collection:v1'
const PLACEHOLDER_IMAGE = `${import.meta.env.BASE_URL}pokemon-placeholder.svg`

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

function loadCollection() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return new Set()
    return new Set(stored.filter((key) => typeof key === 'string' && validSlotKeys.has(key)))
  } catch {
    return new Set()
  }
}

function displayName(entry) {
  return entry.formLabel ? `${entry.name}（${entry.formLabel}）` : entry.name
}

function handleImageError(event) {
  if (event.currentTarget.dataset.fallback === 'true') return
  event.currentTarget.dataset.fallback = 'true'
  event.currentTarget.src = PLACEHOLDER_IMAGE
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

function PokemonSlot({ slot, isCollected, isMuted, isHighlighted, onOpen, onToggle }) {
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
        aria-label={`${name}，${slot.label}，箱子 ${slot.boxNumber} 第 ${slot.position} 格，查看详情`}
      >
        <span className="slot-meta">
          <span className="slot-dex-number">{formatNationalId(entry.nationalId)}</span>
          <span className="slot-position">{String(slot.position).padStart(2, '0')}</span>
        </span>
        <span className="slot-image-wrap">
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

function App() {
  const [activeBoxNumber, setActiveBoxNumber] = useState(1)
  const [selectedEntryKey, setSelectedEntryKey] = useState(null)
  const [highlightedEntryKey, setHighlightedEntryKey] = useState(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [variantFilter, setVariantFilter] = useState('all')
  const [collected, setCollected] = useState(loadCollection)
  const boxViewportRef = useRef(null)

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
    boxViewportRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [activeBoxNumber])

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

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN')
    if (!normalized) return []

    const numericQuery = normalized.match(/^#?(\d{1,4})$/)
    return pokemonData.entries
      .filter((entry) => {
        if (numericQuery) return entry.nationalId === Number(numericQuery[1])
        return [entry.name, entry.formLabel, entry.region]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized))
      })
      .slice(0, 8)
  }, [query])

  const currentBoxCollected = currentBox.cells.filter(
    (slot) => slot && collected.has(slot.key),
  ).length
  const progress = Math.round((collected.size / plan.slots.length) * 100)

  function toggleCollected(slotKey) {
    if (!validSlotKeys.has(slotKey)) return
    setCollected((current) => {
      const next = new Set(current)
      if (next.has(slotKey)) next.delete(slotKey)
      else next.add(slotKey)
      return next
    })
  }

  function goToBox(boxNumber) {
    const next = Math.min(plan.boxes.length, Math.max(1, Number(boxNumber) || 1))
    setActiveBoxNumber(next)
    setHighlightedEntryKey(null)
  }

  function goToGeneration(generationNumber) {
    const generation = plan.generations[generationNumber - 1]
    setActiveBoxNumber(generation.firstBox)
    setHighlightedEntryKey(null)
  }

  function selectSearchResult(entry) {
    const slot = plan.slotByKey.get(`${entry.key}:normal`)
    setActiveBoxNumber(slot.boxNumber)
    setHighlightedEntryKey(entry.key)
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

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-glow hero-glow--one" aria-hidden="true" />
        <div className="hero-glow hero-glow--two" aria-hidden="true" />
        <div className="hero-copy">
          <div className="brand-mark" aria-hidden="true">
            <BoxIcon />
          </div>
          <div>
            <p className="eyebrow">NATIONAL DEX · BOX GUIDE</p>
            <h1>HOME 全国图鉴收纳册</h1>
            <p className="hero-description">
              普通与闪光左右相邻，按世代规划每一个 HOME 箱位。
            </p>
          </div>
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
                搜索全国编号或中文名
              </label>
              <input
                id="pokemon-search"
                value={query}
                type="search"
                autoComplete="off"
                placeholder="搜索编号、名称或地区形态…"
                aria-expanded={searchOpen && Boolean(query.trim())}
                aria-controls="search-results"
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchOpen(true)
                  setHighlightedEntryKey(null)
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
          <p className="filter-hint">筛选仅淡化不符合项，不会改变固定箱位。</p>
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
                    isMuted={isSlotMuted(slot)}
                    isHighlighted={highlightedEntryKey === slot.entry.key}
                    onOpen={setSelectedEntryKey}
                    onToggle={toggleCollected}
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
