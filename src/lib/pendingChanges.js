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

export function recordPendingChange(changes, key, collected, operationId) {
  changes.set(key, { collected, operationId })
}

export function acknowledgePendingChange(changes, key, operationId) {
  if (changes.get(key)?.operationId !== operationId) return false
  changes.delete(key)
  return true
}
