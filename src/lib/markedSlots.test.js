import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMarkedSlots, removeCollectedMarks } from './markedSlots.js'

const validKeys = new Set(['1-default:normal', '1-default:shiny'])

test('读取本地标记时仅接受有效箱位并忽略重复项', () => {
  const storage = { getItem: () => JSON.stringify(['1-default:normal', '1-default:normal', 'bad', 42]) }
  assert.deepEqual(loadMarkedSlots(storage, 'marks', validKeys), new Set(['1-default:normal']))
  assert.deepEqual(loadMarkedSlots({ getItem: () => '{' }, 'marks', validKeys), new Set())
  assert.deepEqual(loadMarkedSlots({ getItem: () => { throw new Error('disabled') } }, 'marks', validKeys), new Set())
})

test('已收集箱位自动从标记中移除，未收集的闪光保留', () => {
  const marks = new Set(validKeys)
  assert.deepEqual(removeCollectedMarks(marks, new Set(['1-default:normal'])), new Set(['1-default:shiny']))
  assert.equal(marks.size, 2)
})
