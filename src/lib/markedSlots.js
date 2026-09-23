export function loadMarkedSlots(storage, key, validSlotKeys) {
  try {
    const stored = JSON.parse(storage.getItem(key) ?? '[]')
    if (!Array.isArray(stored)) return new Set()
    return new Set(stored.filter((slotKey) => typeof slotKey === 'string' && validSlotKeys.has(slotKey)))
  } catch {
    return new Set()
  }
}

export function removeCollectedMarks(marks, collected) {
  return new Set([...marks].filter((key) => !collected.has(key)))
}
