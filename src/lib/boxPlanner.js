export const SLOTS_PER_BOX = 30
export const BOX_COLUMNS = 6
export const GENERATION_NUMBERS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9])

export const GENERATION_NAMES = Object.freeze({
  1: '第一世代',
  2: '第二世代',
  3: '第三世代',
  4: '第四世代',
  5: '第五世代',
  6: '第六世代',
  7: '第七世代',
  8: '第八世代',
  9: '第九世代',
})

export const VARIANTS = Object.freeze([
  { id: 'normal', label: '普通', isShiny: false },
  { id: 'shiny', label: '闪光', isShiny: true },
])

const SPRITE_ROOT =
  'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/home'
const ITEM_SPRITE_ROOT =
  'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items'

export function formatNationalId(nationalId) {
  return `#${String(nationalId).padStart(4, '0')}`
}

export function getSpriteUrl(imageId, isShiny) {
  return `${SPRITE_ROOT}${isShiny ? '/shiny' : ''}/${imageId}.png`
}

export function getItemSpriteUrl(itemSlug) {
  return `${ITEM_SPRITE_ROOT}/${itemSlug}.png`
}

export function getWikiUrl(name) {
  return `https://wiki.52poke.com/wiki/${encodeURIComponent(name)}`
}

export function buildBoxPlan(entries) {
  const boxes = []
  const generations = []
  const slots = []
  const slotByKey = new Map()
  let nextBoxNumber = 1

  for (const generation of GENERATION_NUMBERS) {
    const generationEntries = entries
      .filter((entry) => entry.generation === generation)
      .sort(
        (left, right) =>
          left.nationalId - right.nationalId ||
          left.formOrder - right.formOrder ||
          left.key.localeCompare(right.key),
      )

    const generationSlots = generationEntries.flatMap((entry) =>
      VARIANTS.map((variant) => ({ entry, ...variant })),
    )
    const boxCount = Math.ceil(generationSlots.length / SLOTS_PER_BOX)
    const firstBox = nextBoxNumber

    for (let generationBox = 1; generationBox <= boxCount; generationBox += 1) {
      const boxNumber = nextBoxNumber
      const start = (generationBox - 1) * SLOTS_PER_BOX
      const boxSlots = generationSlots.slice(start, start + SLOTS_PER_BOX)
      const cells = Array.from({ length: SLOTS_PER_BOX }, (_, cellIndex) => {
        const pendingSlot = boxSlots[cellIndex]
        if (!pendingSlot) return null

        const position = cellIndex + 1
        const slot = {
          ...pendingSlot,
          key: `${pendingSlot.entry.key}:${pendingSlot.id}`,
          boxNumber,
          position,
          row: Math.floor(cellIndex / BOX_COLUMNS) + 1,
          column: (cellIndex % BOX_COLUMNS) + 1,
          generation,
          generationBox,
        }
        slots.push(slot)
        slotByKey.set(slot.key, slot)
        return slot
      })

      boxes.push({
        number: boxNumber,
        generation,
        generationBox,
        generationBoxCount: boxCount,
        cells,
        occupiedCount: boxSlots.length,
      })
      nextBoxNumber += 1
    }

    generations.push({
      number: generation,
      name: GENERATION_NAMES[generation],
      firstBox,
      lastBox: nextBoxNumber - 1,
      boxCount,
      entryCount: generationEntries.length,
      slotCount: generationSlots.length,
    })
  }

  return { boxes, generations, slots, slotByKey }
}
