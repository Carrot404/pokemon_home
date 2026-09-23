import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchIndex, searchPokemon } from './searchPokemon.js'

const entries = [
  { name: '妙蛙种子', nationalId: 1, formLabel: null, region: null },
  { name: '雷丘', nationalId: 26, formLabel: '阿罗拉的样子', region: '阿罗拉' },
  { name: '妙蛙草', nationalId: 2, formLabel: null, region: null },
]
const index = buildSearchIndex(entries)

test('搜索中文名拼音首字母，支持不区分大小写的前缀', () => {
  assert.deepEqual(searchPokemon(index, 'MWZZ'), [entries[0]])
  assert.deepEqual(searchPokemon(index, 'mw').map((entry) => entry.nationalId), [1, 2])
  assert.deepEqual(searchPokemon(index, 'wzz'), [])
})

test('原有编号、中文名和地区形态搜索保持不变', () => {
  assert.deepEqual(searchPokemon(index, '#26'), [entries[1]])
  assert.deepEqual(searchPokemon(index, '种子'), [entries[0]])
  assert.deepEqual(searchPokemon(index, '阿罗拉'), [entries[1]])
  assert.deepEqual(searchPokemon(index, '  '), [])
})
