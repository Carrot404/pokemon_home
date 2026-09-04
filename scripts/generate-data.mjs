import { mkdir, writeFile } from 'node:fs/promises'

const MAX_NATIONAL_ID = 1025
const SIMPLIFIED_CHINESE_LANGUAGE_ID = '12'

const SOURCES = {
  speciesNames:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv',
  pokemon:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv',
  pokemonTypes:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_types.csv',
  typeNames:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/type_names.csv',
  wikiList:
    'https://wiki.52poke.com/wiki/%E5%AE%9D%E5%8F%AF%E6%A2%A6%E5%88%97%E8%A1%A8%EF%BC%88%E6%8C%89%E5%85%A8%E5%9B%BD%E5%9B%BE%E9%89%B4%E7%BC%96%E5%8F%B7%EF%BC%89',
  wikiApi: 'https://wiki.52poke.com/api.php',
}

const REGIONAL_FORMS = [
  ['rattata-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['raticate-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['raichu-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['sandshrew-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['sandslash-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['vulpix-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['ninetales-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['diglett-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['dugtrio-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['meowth-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['persian-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['geodude-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['graveler-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['golem-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['grimer-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['muk-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['exeggutor-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['marowak-alola', 7, '阿罗拉', '阿罗拉的样子'],
  ['meowth-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['ponyta-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['rapidash-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['slowpoke-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['slowbro-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['farfetchd-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['weezing-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['mr-mime-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['articuno-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['zapdos-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['moltres-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['slowking-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['corsola-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['zigzagoon-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['linoone-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['darumaka-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['darmanitan-galar-standard', 8, '伽勒尔', '伽勒尔的样子'],
  ['yamask-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['stunfisk-galar', 8, '伽勒尔', '伽勒尔的样子'],
  ['growlithe-hisui', 8, '洗翠', '洗翠的样子'],
  ['arcanine-hisui', 8, '洗翠', '洗翠的样子'],
  ['voltorb-hisui', 8, '洗翠', '洗翠的样子'],
  ['electrode-hisui', 8, '洗翠', '洗翠的样子'],
  ['typhlosion-hisui', 8, '洗翠', '洗翠的样子'],
  ['qwilfish-hisui', 8, '洗翠', '洗翠的样子'],
  ['sneasel-hisui', 8, '洗翠', '洗翠的样子'],
  ['samurott-hisui', 8, '洗翠', '洗翠的样子'],
  ['lilligant-hisui', 8, '洗翠', '洗翠的样子'],
  ['zorua-hisui', 8, '洗翠', '洗翠的样子'],
  ['zoroark-hisui', 8, '洗翠', '洗翠的样子'],
  ['braviary-hisui', 8, '洗翠', '洗翠的样子'],
  ['sliggoo-hisui', 8, '洗翠', '洗翠的样子'],
  ['goodra-hisui', 8, '洗翠', '洗翠的样子'],
  ['avalugg-hisui', 8, '洗翠', '洗翠的样子'],
  ['decidueye-hisui', 8, '洗翠', '洗翠的样子'],
  ['tauros-paldea-combat-breed', 9, '帕底亚', '帕底亚的样子·斗战种'],
  ['tauros-paldea-blaze-breed', 9, '帕底亚', '帕底亚的样子·火炽种'],
  ['tauros-paldea-aqua-breed', 9, '帕底亚', '帕底亚的样子·水澜种'],
  ['wooper-paldea', 9, '帕底亚', '帕底亚的样子'],
].map(([identifier, generation, region, formLabel], formOrder) => ({
  identifier,
  generation,
  region,
  formLabel,
  formOrder: formOrder + 1,
}))

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const [headers, ...values] = rows
  return values.map((valuesRow) =>
    Object.fromEntries(headers.map((header, index) => [header, valuesRow[index] ?? ''])),
  )
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'pokemon-home-box-guide/1.0 (local data generator)' },
  })

  if (!response.ok) {
    throw new Error(`请求失败 ${response.status}: ${url}`)
  }

  return response.text()
}

function decodeHtml(text) {
  const namedEntities = {
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
  }

  return text
    .replace(/&(amp|quot|#39|lt|gt|nbsp);/g, (entity) => namedEntities[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([\da-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
}

function extractWikiNames(html) {
  const names = new Map()
  const rowPattern = /<td class="rdexn-id">#(\d+)\s*<\/td>([\s\S]*?)<\/tr>/g
  let match

  while ((match = rowPattern.exec(html))) {
    const nationalId = Number(match[1])
    if (nationalId > MAX_NATIONAL_ID) continue

    const nameMatch = match[2].match(
      /<td class="rdexn-name">[\s\S]*?<a\s[^>]*>([^<]+)<\/a>/,
    )
    if (nameMatch) names.set(nationalId, decodeHtml(nameMatch[1]).trim())
  }

  if (names.size !== MAX_NATIONAL_ID) {
    throw new Error(`52Poké 名称解析数量异常：应为 ${MAX_NATIONAL_ID}，实际为 ${names.size}`)
  }

  return names
}

function generationForNationalId(nationalId) {
  const lastIds = [151, 251, 386, 493, 649, 721, 809, 905, 1025]
  return lastIds.findIndex((lastId) => nationalId <= lastId) + 1
}

async function fetchWikiCategory(name) {
  const url = new URL(SOURCES.wikiApi)
  url.search = new URLSearchParams({
    action: 'parse',
    format: 'json',
    prop: 'wikitext',
    redirects: '1',
    page: name,
  })

  const response = JSON.parse(await fetchText(url))
  const wikiText = response?.parse?.wikitext?.['*'] ?? ''
  const match = wikiText.match(/^\|species\s*=\s*(.+?)\s*$/m)

  if (!match) throw new Error(`无法从 52Poké 获取“${name}”的分类`)
  return `${match[1].trim()}宝可梦`
}

function typesForPokemon(pokemonId, pokemonTypeRows, typeNames) {
  const types = pokemonTypeRows
    .filter((row) => Number(row.pokemon_id) === pokemonId)
    .sort((left, right) => Number(left.slot) - Number(right.slot))
    .map((row) => typeNames.get(Number(row.type_id)))

  if (!types.length || types.some((type) => !type)) {
    throw new Error(`宝可梦数据 ${pokemonId} 缺少中文属性`)
  }

  return types
}

async function main() {
  console.log('正在下载 PokéAPI CSV 与 52Poké 全国图鉴列表…')
  const [speciesNamesText, pokemonText, pokemonTypesText, typeNamesText, wikiHtml] =
    await Promise.all([
      fetchText(SOURCES.speciesNames),
      fetchText(SOURCES.pokemon),
      fetchText(SOURCES.pokemonTypes),
      fetchText(SOURCES.typeNames),
      fetchText(SOURCES.wikiList),
    ])

  const speciesNameRows = parseCsv(speciesNamesText).filter(
    (row) =>
      row.local_language_id === SIMPLIFIED_CHINESE_LANGUAGE_ID &&
      Number(row.pokemon_species_id) <= MAX_NATIONAL_ID,
  )
  const pokemonRows = parseCsv(pokemonText)
  const pokemonTypeRows = parseCsv(pokemonTypesText)
  const typeNames = new Map(
    parseCsv(typeNamesText)
      .filter((row) => row.local_language_id === SIMPLIFIED_CHINESE_LANGUAGE_ID)
      .map((row) => [Number(row.type_id), row.name]),
  )
  const wikiNames = extractWikiNames(wikiHtml)

  const speciesNames = new Map(
    speciesNameRows.map((row) => [Number(row.pokemon_species_id), row]),
  )
  const pokemonByIdentifier = new Map(pokemonRows.map((row) => [row.identifier, row]))
  const defaultPokemonBySpecies = new Map(
    pokemonRows
      .filter(
        (row) => row.is_default === '1' && Number(row.species_id) <= MAX_NATIONAL_ID,
      )
      .map((row) => [Number(row.species_id), row]),
  )

  if (speciesNames.size !== MAX_NATIONAL_ID || defaultPokemonBySpecies.size !== MAX_NATIONAL_ID) {
    throw new Error('PokéAPI 的 #0001–1025 数据不完整')
  }

  const missingCategories = speciesNameRows.filter((row) => !row.genus)
  const wikiCategories = new Map(
    await Promise.all(
      missingCategories.map(async (row) => {
        const nationalId = Number(row.pokemon_species_id)
        return [nationalId, await fetchWikiCategory(wikiNames.get(nationalId))]
      }),
    ),
  )

  const defaultEntries = Array.from({ length: MAX_NATIONAL_ID }, (_, index) => {
    const nationalId = index + 1
    const pokemon = defaultPokemonBySpecies.get(nationalId)
    const species = speciesNames.get(nationalId)

    return {
      key: `${nationalId}-default`,
      nationalId,
      name: wikiNames.get(nationalId),
      slug: pokemon.identifier,
      formLabel: null,
      region: null,
      generation: generationForNationalId(nationalId),
      formOrder: 0,
      imageId: Number(pokemon.id),
      category: species.genus || wikiCategories.get(nationalId),
      types: typesForPokemon(Number(pokemon.id), pokemonTypeRows, typeNames),
    }
  })

  const regionalEntries = REGIONAL_FORMS.map((regionalForm) => {
    const pokemon = pokemonByIdentifier.get(regionalForm.identifier)
    if (!pokemon) throw new Error(`PokéAPI 缺少地区形态：${regionalForm.identifier}`)

    const nationalId = Number(pokemon.species_id)
    const species = speciesNames.get(nationalId)

    return {
      key: `${nationalId}-${regionalForm.identifier}`,
      nationalId,
      name: wikiNames.get(nationalId),
      slug: regionalForm.identifier,
      formLabel: regionalForm.formLabel,
      region: regionalForm.region,
      generation: regionalForm.generation,
      formOrder: regionalForm.formOrder,
      imageId: Number(pokemon.id),
      category: species.genus || wikiCategories.get(nationalId),
      types: typesForPokemon(Number(pokemon.id), pokemonTypeRows, typeNames),
    }
  })

  const entries = [...defaultEntries, ...regionalEntries].sort(
    (left, right) =>
      left.generation - right.generation ||
      left.nationalId - right.nationalId ||
      left.formOrder - right.formOrder,
  )

  const pokeApiNames = new Map(
    speciesNameRows.map((row) => [Number(row.pokemon_species_id), row.name]),
  )
  const correctedNameCount = [...wikiNames].filter(
    ([nationalId, name]) => pokeApiNames.get(nationalId) !== name,
  ).length

  const output = {
    version: 1,
    coverage: { firstNationalId: 1, lastNationalId: MAX_NATIONAL_ID },
    sources: {
      names: SOURCES.wikiList,
      structuredData: 'https://pokeapi.co/',
      sprites: 'https://github.com/PokeAPI/sprites',
    },
    entries,
  }

  await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
  await writeFile(
    new URL('../src/data/pokemon.json', import.meta.url),
    `${JSON.stringify(output, null, 2)}\n`,
  )

  console.log(
    `已生成 ${defaultEntries.length} 个默认形态＋${regionalEntries.length} 个地区形态；` +
      `52Poké 校正 ${correctedNameCount} 个名称。`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
