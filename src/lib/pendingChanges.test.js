import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acknowledgePendingChange,
  clearAcknowledgedChanges,
  loadStoredPendingChanges,
  parsePendingChanges,
  recordPendingChange,
  savePendingChange,
  serializePendingChanges,
} from './pendingChanges.js'

const validKeys = new Set(['bulbasaur:normal', 'bulbasaur:shiny'])
const prefix = 'pending-collection:v1'

function memoryStorage() {
  const values = new Map()
  return {
    get length() { return values.size },
    key(index) { return [...values.keys()][index] ?? null },
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) { values.delete(key) },
  }
}

test('待同步修改经过校验后可以持久化和恢复', () => {
  const changes = parsePendingChanges(
    JSON.stringify([
      ['bulbasaur:normal', true],
      ['invalid', true],
      ['bulbasaur:shiny', 'yes'],
    ]),
    validKeys,
  )

  assert.deepEqual(changes.get('bulbasaur:normal'), { collected: true, operationId: 0 })
  assert.equal(changes.size, 1)
  assert.deepEqual(
    parsePendingChanges(serializePendingChanges(changes), validKeys),
    changes,
  )
  assert.equal(parsePendingChanges('{', validKeys).size, 0)
})

test('两个标签页分别保存的离线修改在重新打开后都能恢复', () => {
  const storage = memoryStorage()
  const first = savePendingChange(storage, prefix, 'bulbasaur:normal', true)
  const second = savePendingChange(storage, prefix, 'bulbasaur:shiny', true)

  const restored = loadStoredPendingChanges(storage, prefix, validKeys)
  assert.equal(restored.get('bulbasaur:normal').collected, true)
  assert.equal(restored.get('bulbasaur:shiny').collected, true)
  clearAcknowledgedChanges(storage, prefix, 'bulbasaur:normal', first)
  assert.equal(storage.getItem(first.id), null)
  assert.notEqual(storage.getItem(second.id), null)
  assert.deepEqual([...loadStoredPendingChanges(storage, prefix, validKeys).keys()], ['bulbasaur:shiny'])
})

test('旧版待同步列表会迁移，确认旧修改不会删除同箱位的新修改', () => {
  const storage = memoryStorage()
  storage.setItem(prefix, JSON.stringify([['bulbasaur:normal', true]]))
  const [old] = loadStoredPendingChanges(storage, prefix, validKeys).values()
  assert.equal(storage.getItem(prefix), null)

  const newer = savePendingChange(storage, prefix, 'bulbasaur:normal', false)
  clearAcknowledgedChanges(storage, prefix, 'bulbasaur:normal', old)
  assert.equal(loadStoredPendingChanges(storage, prefix, validKeys).get('bulbasaur:normal').collected, false)
  clearAcknowledgedChanges(storage, prefix, 'bulbasaur:normal', newer)
  assert.equal(loadStoredPendingChanges(storage, prefix, validKeys).size, 0)
})

test('旧请求不能确认同一箱位的较新修改', () => {
  const changes = new Map()
  recordPendingChange(changes, 'bulbasaur:normal', true, 1)
  recordPendingChange(changes, 'bulbasaur:normal', false, 2)
  recordPendingChange(changes, 'bulbasaur:normal', true, 3)

  assert.equal(acknowledgePendingChange(changes, 'bulbasaur:normal', 1), false)
  assert.deepEqual(changes.get('bulbasaur:normal'), { collected: true, operationId: 3 })
  assert.equal(acknowledgePendingChange(changes, 'bulbasaur:normal', 3), true)
  assert.equal(changes.size, 0)
})
