import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeQuery,
  swapNumerals,
  generateVariants,
  expandAlias,
  textScore,
  popularityScore,
  scoreGame,
  dedupeGames,
  rankAndFilter,
} from '../searchRank.js'

test('normalizeQuery - trims, lowercases, collapses whitespace, strips punctuation', () => {
  assert.equal(normalizeQuery('  SPIDER-MAN  '), 'spider-man')
  assert.equal(normalizeQuery('Grand   Theft   Auto:  V'), 'grand theft auto v')
  assert.equal(normalizeQuery("Marvel’s Spider-Man"), "marvel's spider-man")
  assert.equal(normalizeQuery('  '), '')
  assert.equal(normalizeQuery(null), '')
})

test('swapNumerals - converts digits to roman numerals and vice versa', () => {
  assert.equal(swapNumerals('gta 5'), 'gta v')
  assert.equal(swapNumerals('gta v'), 'gta 5')
  assert.equal(swapNumerals('final fantasy vii'), 'final fantasy 7')
  assert.equal(swapNumerals('modern warfare 2'), 'modern warfare ii')
  assert.equal(swapNumerals('modern warfare ii'), 'modern warfare 2')
  assert.equal(swapNumerals('witcher 3'), 'witcher iii')
})

test('generateVariants - creates hyphen, space, apostrophe, and numeral variants', () => {
  const spidermanVariants = generateVariants('spiderman')
  assert.ok(spidermanVariants.includes('spider man'), 'spiderman has spider man variant')
  assert.ok(spidermanVariants.includes('spider-man'), 'spiderman has spider-man variant')

  const spiderManVariants = generateVariants('spider-man')
  assert.ok(spiderManVariants.includes('spiderman'), 'spider-man has spiderman variant')
  assert.ok(spiderManVariants.includes('spider man'), 'spider-man has spider man variant')

  const marvelsVariants = generateVariants('marvels')
  assert.ok(marvelsVariants.includes("marvel's"), "marvels has marvel's variant")

  const gtaVariants = generateVariants('gta 5')
  assert.ok(gtaVariants.includes('gta v'), 'gta 5 has gta v variant')
})

test('expandAlias - expands known game abbreviations', () => {
  assert.equal(expandAlias('gta'), 'grand theft auto')
  assert.equal(expandAlias('gta 5'), 'grand theft auto v')
  assert.equal(expandAlias('gta 6'), 'grand theft auto vi')
  assert.equal(expandAlias('cod'), 'call of duty')
  assert.equal(expandAlias('rdr2'), 'red dead redemption 2')
  assert.equal(expandAlias('bg3'), "baldur's gate 3")
  assert.equal(expandAlias('ac'), "assassin's creed")
  assert.equal(expandAlias('nfs'), 'need for speed')
  assert.equal(expandAlias('fc'), 'ea sports fc')
  assert.equal(expandAlias('ea fc'), 'ea sports fc')
  assert.equal(expandAlias('spiderman'), "marvel's spider-man")
  assert.equal(expandAlias('gow'), 'god of war')
  assert.equal(expandAlias('hk'), 'hollow knight')
  assert.equal(expandAlias('botw'), 'breath of the wild')
  assert.equal(expandAlias('totk'), 'tears of the kingdom')
  assert.equal(expandAlias('unknown abbreviation'), null)
})

test('textScore - rewards exact match, prefix match, and word inclusion', () => {
  // Exact match
  assert.equal(textScore('Spider-Man', 'spider man'), 1.0)
  assert.equal(textScore('Elden Ring', 'elden ring'), 1.0)

  // Starts with
  const startsScore = textScore("Marvel's Spider-Man Remastered", "marvel's spider-man")
  assert.equal(startsScore, 0.8)

  // Word inclusion (any order)
  const wordScore = textScore('Grand Theft Auto V', 'v grand theft auto')
  assert.equal(wordScore, 0.6)

  // Weak or no match
  const weakScore = textScore('Candy Crush Saga', 'spider-man')
  assert.equal(weakScore, 0.2)
})

test('popularityScore - log-scales added count relative to max', () => {
  assert.equal(popularityScore(0, 1000), 0)
  assert.equal(popularityScore(1000, 1000), 1)
  const mid = popularityScore(100, 1000)
  assert.ok(mid > 0.6 && mid < 0.7, `Expected mid around ~0.66, got ${mid}`)
})

test('scoreGame - computes textScore * 3 + popularityScore', () => {
  const game = { name: 'Elden Ring', added: 10000 }
  const score = scoreGame(game, 'elden ring', 10000)
  // 1.0 * 3 + 1.0 = 4.0
  assert.equal(score, 4.0)

  const obscureGame = { name: 'Spider Fan Project', added: 10 }
  const obscureScore = scoreGame(obscureGame, 'spider-man', 10000)
  // textScore (0.2) * 3 + popularityScore (~0.26) = ~0.86
  assert.ok(obscureScore < 1.5)
})

test('dedupeGames - deduplicates by id keeping highest added', () => {
  const games = [
    { id: 1, name: 'Spider-Man', added: 500 },
    { id: 2, name: 'Batman', added: 300 },
    { id: 1, name: 'Spider-Man Remastered', added: 1200 },
  ]
  const deduped = dedupeGames(games)
  assert.equal(deduped.length, 2)
  const id1 = deduped.find((g) => g.id === 1)
  assert.equal(id1.added, 1200)
  assert.equal(id1.name, 'Spider-Man Remastered')
})

test('rankAndFilter - ranks exact match and AAA titles above obscure fan games', () => {
  const games = [
    { id: 101, name: 'Spider Man Fun Fan Game 2019', added: 12, background_image: 'fan.jpg' },
    { id: 102, name: "Marvel's Spider-Man", added: 15400, background_image: 'real.jpg' },
    { id: 103, name: "Marvel's Spider-Man: Miles Morales", added: 9800, background_image: 'miles.jpg' },
    { id: 104, name: 'Spider Simulator', added: 5, background_image: 'sim.jpg' },
  ]

  const ranked = rankAndFilter(games, 'spiderman')
  assert.ok(ranked.length > 0)
  // The AAA games with high added and good match should rank top
  assert.ok(
    ranked[0].name.includes("Spider-Man"),
    `Top result should be an official game, got: ${ranked[0].name}`
  )
  assert.ok(ranked[0].added > 1000, 'Top result should have high popularity')
})
