export function parsePendingChanges(serialized, validKeys) {
  if (typeof serialized !== 'string') return new Map()

  let parsed
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return new Map()
  }
  if (!Array.isArray(parsed)) return new Map()

  const changes = new Map()
  for (const entry of parsed) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      !validKeys.has(entry[0]) ||
      typeof entry[1] !== 'boolean'
    ) {
      continue
    }
    changes.set(entry[0], { collected: entry[1], operationId: 0 })
  }
  return changes
}

export function serializePendingChanges(changes) {
  return JSON.stringify(
    [...changes].map(([key, change]) => [key, change.collected]),
  )
}

// Each operation gets its own key so independent tabs never overwrite each other's queue.
export function savePendingChange(storage, prefix, key, collected) {
  const id = `${prefix}:${[...crypto.getRandomValues(new Uint32Array(4))].join('-')}`
  const recordedAt = performance.timeOrigin + performance.now()
  storage.setItem(id, JSON.stringify({ key, collected, recordedAt }))
  return { id, recordedAt }
}

export function loadStoredPendingChanges(storage, prefix, validKeys) {
  const legacy = parsePendingChanges(storage.getItem(prefix), validKeys)
  if (legacy.size) {
    try {
      for (const [key, change] of legacy) {
        savePendingChange(storage, prefix, key, change.collected)
      }
      storage.removeItem(prefix)
    } catch {
      // Preserve the old queue if migration could not be saved.
    }
  }

  const changes = new Map()
  for (let index = 0; index < storage.length; index += 1) {
    const id = storage.key(index)
    if (!id?.startsWith(`${prefix}:`)) continue
    try {
      const record = JSON.parse(storage.getItem(id))
      if (
        typeof record?.key !== 'string' ||
        !validKeys.has(record.key) ||
        typeof record.collected !== 'boolean' ||
        typeof record.recordedAt !== 'number' ||
        !Number.isFinite(record.recordedAt)
      ) {
        continue
      }
      const previous = changes.get(record.key)
      if (
        !previous ||
        record.recordedAt > previous.recordedAt ||
        (record.recordedAt === previous.recordedAt && id > previous.id)
      ) {
        changes.set(record.key, { ...record, id, operationId: 0 })
      }
    } catch {
      // Ignore malformed data from browser storage.
    }
  }
  for (const [key, change] of legacy) {
    if (!changes.has(key)) changes.set(key, { ...change, recordedAt: 0, id: null })
  }
  return changes
}

export function clearAcknowledgedChanges(storage, prefix, key, acknowledged) {
  const legacy = storage.getItem(prefix)
  if (legacy) {
    try {
      const entries = JSON.parse(legacy)
      if (Array.isArray(entries)) {
        const remaining = entries.filter((entry) => !Array.isArray(entry) || entry[0] !== key)
        if (remaining.length) storage.setItem(prefix, JSON.stringify(remaining))
        else storage.removeItem(prefix)
      }
    } catch {
      // Leave malformed legacy data untouched.
    }
  }
  const ids = Array.from({ length: storage.length }, (_, index) => storage.key(index))
  for (const id of ids) {
    if (!id?.startsWith(`${prefix}:`)) continue
    try {
      const record = JSON.parse(storage.getItem(id))
      if (
        record?.key === key &&
        (record.recordedAt < acknowledged.recordedAt ||
          (record.recordedAt === acknowledged.recordedAt && id <= acknowledged.id))
      ) {
        storage.removeItem(id)
      }
    } catch {
      // Leave malformed entries untouched.
    }
  }
}

export function recordPendingChange(changes, key, collected, operationId, stored = {}) {
  changes.set(key, { collected, operationId, ...stored })
}

export function acknowledgePendingChange(changes, key, operationId) {
  if (changes.get(key)?.operationId !== operationId) return false
  changes.delete(key)
  return true
}
