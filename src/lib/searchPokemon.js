import { pinyin } from 'pinyin-pro'

export function buildSearchIndex(entries) {
  return entries.map((entry) => ({
    entry,
    initials: pinyin(entry.name, { pattern: 'first', toneType: 'none', type: 'array' }).join(''),
  }))
}

export function searchPokemon(index, query) {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  if (!normalized) return []

  const numericQuery = normalized.match(/^#?(\d{1,4})$/)
  return index
    .filter(({ entry, initials }) => {
      if (numericQuery) return entry.nationalId === Number(numericQuery[1])
      return initials.startsWith(normalized) || [entry.name, entry.formLabel, entry.region]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized))
    })
    .slice(0, 8)
    .map(({ entry }) => entry)
}
