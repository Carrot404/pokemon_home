import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildBoxPlan, getSpriteUrl } from '../src/lib/boxPlanner.js'

const data = JSON.parse(
  await readFile(new URL('../src/data/pokemon.json', import.meta.url), 'utf8'),
)
const plan = buildBoxPlan(data.entries)

const expectedByGeneration = [
  { entries: 151, slots: 302, boxes: 11, firstBox: 1, lastBox: 11 },
  { entries: 100, slots: 200, boxes: 7, firstBox: 12, lastBox: 18 },
  { entries: 135, slots: 270, boxes: 9, firstBox: 19, lastBox: 27 },
  { entries: 107, slots: 214, boxes: 8, firstBox: 28, lastBox: 35 },
  { entries: 156, slots: 312, boxes: 11, firstBox: 36, lastBox: 46 },
  { entries: 72, slots: 144, boxes: 5, firstBox: 47, lastBox: 51 },
  { entries: 106, slots: 212, boxes: 8, firstBox: 52, lastBox: 59 },
  { entries: 131, slots: 262, boxes: 9, firstBox: 60, lastBox: 68 },
  { entries: 124, slots: 248, boxes: 9, firstBox: 69, lastBox: 77 },
]

assert.equal(data.entries.length, 1082, '应包含 1025 个默认形态和 57 个地区形态')
assert.equal(data.entries.filter((entry) => entry.formLabel).length, 57)
assert.equal(new Set(data.entries.map((entry) => entry.key)).size, data.entries.length)
assert.equal(plan.boxes.length, 77)
assert.equal(plan.slots.length, 2164)
assert.equal(plan.slotByKey.size, plan.slots.length)

for (const [index, generation] of plan.generations.entries()) {
  assert.deepEqual(
    {
      entries: generation.entryCount,
      slots: generation.slotCount,
      boxes: generation.boxCount,
      firstBox: generation.firstBox,
      lastBox: generation.lastBox,
    },
    expectedByGeneration[index],
  )
}

for (const box of plan.boxes) {
  assert.equal(box.cells.length, 30)
  let reachedEmptyCell = false

  for (const cell of box.cells) {
    if (!cell) {
      reachedEmptyCell = true
      continue
    }
    assert.equal(reachedEmptyCell, false, `箱子 ${box.number} 的空位后不应再有内容`)
  }
}

for (const entry of data.entries) {
  assert.ok(entry.name)
  assert.ok(entry.category)
  assert.ok(entry.types.length >= 1 && entry.types.length <= 2)

  const normal = plan.slotByKey.get(`${entry.key}:normal`)
  const shiny = plan.slotByKey.get(`${entry.key}:shiny`)
  assert.ok(normal && shiny, `${entry.key} 缺少普通或闪光箱位`)
  assert.equal(normal.boxNumber, shiny.boxNumber, `${entry.key} 的普通与闪光应在同一箱`)
  assert.equal(shiny.position, normal.position + 1, `${entry.key} 的闪光应紧邻普通形态`)
  assert.equal(normal.position % 2, 1, `${entry.key} 的普通形态应位于奇数格`)
  assert.match(getSpriteUrl(entry.imageId, false), /\/home\/\d+\.png$/)
  assert.match(getSpriteUrl(entry.imageId, true), /\/home\/shiny\/\d+\.png$/)
}

const nameByNationalId = new Map(
  data.entries
    .filter((entry) => !entry.formLabel)
    .map((entry) => [entry.nationalId, entry.name]),
)
assert.equal(nameByNationalId.get(233), '多边兽Ⅱ')
assert.equal(nameByNationalId.get(563), '死神棺')
assert.equal(nameByNationalId.get(1025), '桃歹郎')

console.log('数据检查通过：1082 个形态，2164 个有效箱位，77 个箱子。')
