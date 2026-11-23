// ─── Search ranking & query helpers (pure, unit-testable) ────────────────────

// ─── Alias map ───────────────────────────────────────────────────────────────
// Keys are lowercased, normalized queries. Values are the full RAWG title forms.
// Add new abbreviations here — the rest of the pipeline picks them up.
export const ALIASES = {
  gta: 'grand theft auto',
  'gta 5': 'grand theft auto v',
  'gta v': 'grand theft auto v',
  'gta 6': 'grand theft auto vi',
  'gta vi': 'grand theft auto vi',
  cod: 'call of duty',
  rdr: 'red dead redemption',
  rdr2: 'red dead redemption 2',
  'rdr 2': 'red dead redemption 2',
  botw: 'breath of the wild',
  totk: 'tears of the kingdom',
  bg3: "baldur's gate 3",
  ac: "assassin's creed",
  nfs: 'need for speed',
  fc: 'ea sports fc',
  'ea fc': 'ea sports fc',
  eafc: 'ea sports fc',
  mw2: 'modern warfare 2',
  'modern warfare 2': 'call of duty modern warfare ii',
  mw3: 'modern warfare 3',
  'modern warfare 3': 'call of duty modern warfare iii',
  spiderman: "marvel's spider-man",
  'spider-man': "marvel's spider-man",
  gow: 'god of war',
  'black myth': 'black myth wukong',
  hk: 'hollow knight',
  tlou: 'the last of us',
  re4: 'resident evil 4',
  ff7: 'final fantasy vii',
  ds: 'dark souls',
  mgs: 'metal gear solid',
  mc: 'minecraft',
  lol: 'league of legends',
}

// ─── Digit ↔ Roman numeral ──────────────────────────────────────────────────
const DIGIT_TO_ROMAN = {
  2: 'ii', 3: 'iii', 4: 'iv', 5: 'v',
  6: 'vi', 7: 'vii', 8: 'viii', 9: 'ix', 10: 'x',
  11: 'xi', 12: 'xii', 13: 'xiii', 14: 'xiv', 15: 'xv',
  16: 'xvi', 17: 'xvii', 18: 'xviii', 19: 'xix', 20: 'xx',
}
const ROMAN_TO_DIGIT = Object.fromEntries(
  Object.entries(DIGIT_TO_ROMAN).map(([d, r]) => [r, d])
)

/**
 * Normalize a raw search query for matching / caching.
 * Returns a lowercased, whitespace-collapsed, punctuation-stripped string.
 */
export function normalizeQuery(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032`]/g, "'") // normalize smart quotes & backticks
    .replace(/[^a-z0-9\s'\-]/g, ' ')                    // strip other punctuation
    .replace(/\s+/g, ' ')                                // collapse whitespace
    .trim()
}

/**
 * Swap digits ↔ roman numerals in a query string.
 * "gta 5" → "gta v", "final fantasy vii" → "final fantasy 7"
 */
export function swapNumerals(query) {
  return query.replace(/\b(\d{1,2}|[ivxlc]{1,5})\b/gi, (match) => {
    const lower = match.toLowerCase()
    if (ROMAN_TO_DIGIT[lower]) return ROMAN_TO_DIGIT[lower]
    if (DIGIT_TO_ROMAN[lower]) return DIGIT_TO_ROMAN[lower]
    return match
  })
}

/**
 * Generate hyphen / apostrophe / spacing variants.
 * "spiderman" → ["spider man", "spider-man"]
 * "spider-man" → ["spiderman", "spider man"]
 * "marvels" → ["marvel's"]
 */
export function generateVariants(normalized) {
  const variants = new Set()

  // If it contains a hyphen, also try without and with space
  if (normalized.includes('-')) {
    variants.add(normalized.replace(/-/g, ''))
    variants.add(normalized.replace(/-/g, ' '))
  }

  // If it's one long word (no spaces, no hyphens), try common split points
  const words = normalized.split(/[\s-]+/)
  if (words.length === 1 && normalized.length > 5) {
    // Try inserting a space / hyphen at every position after char 2
    for (let i = 3; i < normalized.length - 2; i++) {
      const left = normalized.slice(0, i)
      const right = normalized.slice(i)
      variants.add(`${left} ${right}`)
      variants.add(`${left}-${right}`)
    }
  }

  // If it ends with an "s" after a consonant cluster, try apostrophe
  if (/[a-z]s$/.test(normalized) && !normalized.includes("'")) {
    variants.add(normalized.slice(0, -1) + "'s")
  }

  // Numeral swap
  const numSwap = swapNumerals(normalized)
  if (numSwap !== normalized) variants.add(numSwap)

  // Remove the original
  variants.delete(normalized)
  return [...variants]
}

/**
 * Expand aliases.  Returns the expansion or null.
 */
export function expandAlias(normalized) {
  if (ALIASES[normalized]) return ALIASES[normalized]

  // Try matching "alias N" patterns, e.g. "cod mw2"
  for (const [abbrev, expansion] of Object.entries(ALIASES)) {
    if (normalized.startsWith(abbrev + ' ')) {
      const rest = normalized.slice(abbrev.length + 1)
      return expansion + ' ' + rest
    }
  }
  return null
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function normalizeTitle(title) {
  if (!title) return ''
  return title
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032`]/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * textScore: how well the game title matches the query.
 * Returns 0.0 – 1.0
 */
export function textScore(gameTitle, queryNorm) {
  const title = normalizeTitle(gameTitle)
  const query = normalizeTitle(queryNorm)
  if (!title || !query) return 0

  // Exact match
  if (title === query) return 1.0

  // Title starts with the query
  if (title.startsWith(query + ' ') || title.startsWith(query)) return 0.8

  // Query words appear as distinct words in the title
  const titleWords = title.split(' ').filter(Boolean)
  const queryWords = query.split(' ').filter(Boolean)
  const matchCount = queryWords.filter((w) =>
    titleWords.some((tw) => tw === w || (w.length >= 4 && tw.startsWith(w)))
  ).length

  if (matchCount === queryWords.length) return 0.6
  if (matchCount >= queryWords.length * 0.7) return 0.4

  return 0.2
}

/**
 * Check match against the query, its alias expansion, numeral swaps, and variants.
 * Returns the highest textScore (0.0 – 1.0).
 */
export function bestTextScore(gameTitle, queryNorm) {
  const norm = normalizeQuery(queryNorm)
  let best = textScore(gameTitle, norm)

  // Check numeral swapped query (e.g. "gta 5" <-> "gta v")
  const numSwap = swapNumerals(norm)
  if (numSwap !== norm) {
    best = Math.max(best, textScore(gameTitle, numSwap))
  }

  // Check alias expansion (e.g. "bg3" -> "baldur's gate 3")
  const alias = expandAlias(norm)
  if (alias) {
    best = Math.max(best, textScore(gameTitle, alias))
    const aliasNum = swapNumerals(alias)
    if (aliasNum !== alias) {
      best = Math.max(best, textScore(gameTitle, aliasNum))
    }
  }

  // Check hyphen/space/apostrophe variants (e.g. "spiderman" -> "spider-man")
  const variants = generateVariants(norm)
  for (const v of variants) {
    best = Math.max(best, textScore(gameTitle, v))
  }

  return best
}

/**
 * Popularity score from RAWG "added" count.
 * Returns 0.0 – 1.0  (log-scaled against the max in the result set)
 */
export function popularityScore(added, maxAdded) {
  if (!added || !maxAdded || maxAdded <= 0) return 0
  return Math.log10(1 + added) / Math.log10(1 + maxAdded)
}

/**
 * Combined score = textScore × 3 + popularityScore
 * Range: 0 – 4
 */
export function scoreGame(game, queryNorm, maxAdded) {
  const ts = bestTextScore(game.name, queryNorm)
  const ps = popularityScore(game.added || 0, maxAdded)
  return ts * 3 + ps
}

// ─── Dedup & rank ────────────────────────────────────────────────────────────

/**
 * Deduplicate games by id, keeping the one with the highest `added`.
 */
export function dedupeGames(games) {
  const map = new Map()
  for (const game of games) {
    if (!game || !game.id) continue
    const existing = map.get(game.id)
    if (!existing || (game.added || 0) > (existing.added || 0)) {
      map.set(game.id, game)
    }
  }
  return [...map.values()]
}

function isWebOnly(game) {
  if (!Array.isArray(game.platforms) || game.platforms.length === 0) return false
  const slugs = game.platforms.map((p) => (p.platform?.slug || p.platform?.name || '').toLowerCase())
  return slugs.every((s) => s === 'web')
}

/**
 * Filter out low-quality results:
 * - Drop games with no background image
 * - Drop web-only platform games
 * - Drop added < 50 unless result set would have fewer than 5 results
 */
export function filterGames(games, queryNorm) {
  if (!Array.isArray(games)) return []

  const viableCount = games.filter(
    (g) => g && g.name && g.background_image && !isWebOnly(g) && (g.added || 0) >= 50
  ).length

  return games.filter((game) => {
    if (!game || !game.name) return false
    // Drop games with no background image
    if (!game.background_image || typeof game.background_image !== 'string' || !game.background_image.trim()) {
      return false
    }
    // Drop web-only platform games
    if (isWebOnly(game)) {
      return false
    }
    // Drop added < 50 unless we have fewer than 5 viable results
    if ((game.added || 0) < 50 && viableCount >= 5) {
      return false
    }
    return true
  })
}

/**
 * Full pipeline: dedupe → filter → score → sort → slice.
 */
export function rankAndFilter(games, queryNorm, limit = 25) {
  const deduped = dedupeGames(games)
  const filtered = filterGames(deduped, queryNorm)
  const maxAdded = Math.max(1, ...filtered.map((g) => g.added || 0))

  return filtered
    .map((game) => ({
      ...game,
      _score: scoreGame(game, queryNorm, maxAdded),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
}
