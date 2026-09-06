import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acknowledgePendingChange,
  parsePendingChanges,
  recordPendingChange,
  serializePendingChanges,
} from './pendingChanges.js'

const validKeys = new Set(['bulbasaur:normal', 'bulbasaur:shiny'])

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
