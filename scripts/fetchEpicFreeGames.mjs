import { mkdir, writeFile } from 'node:fs/promises'

const EPIC_URL =
  'https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=IN&allowCountries=IN'
const OUTPUT_FILE = new URL('../public/data/epic-free-games.json', import.meta.url)

function getImage(element) {
  const preferredTypes = ['OfferImageWide', 'DieselStoreFrontWide', 'Thumbnail']
  const images = element.keyImages || []
  return (
    preferredTypes
      .map((type) => images.find((image) => image.type === type)?.url)
      .find(Boolean) || images[0]?.url || ''
  )
}

function getOffer(element, collectionName) {
  const collections = element.promotions?.[collectionName] || []
  return collections
    .flatMap((collection) => collection.promotionalOffers || [])
    .find((offer) => offer.discountSetting?.discountPercentage === 0)
}

function cleanElement(element, type) {
  const offer = getOffer(element, type === 'current' ? 'promotionalOffers' : 'upcomingPromotionalOffers')
  if (!offer) return null

  return {
    id: element.id,
    namespace: element.namespace,
    title: element.title,
    description: element.description || '',
    slug: element.urlSlug || element.catalogNs?.mappings?.[0]?.pageSlug || '',
    image: getImage(element),
    startDate: offer.startDate,
    endDate: offer.endDate,
  }
}

async function main() {
  const response = await fetch(EPIC_URL, {
    headers: { 'User-Agent': 'WishRadar/1.0' },
  })
  if (!response.ok) {
    throw new Error(`Epic promotions request failed (${response.status})`)
  }

  const payload = await response.json()
  const elements = payload.data?.Catalog?.searchStore?.elements
  if (!Array.isArray(elements)) {
    throw new Error('Epic promotions response did not contain a catalog')
  }

  const current = elements.map((element) => cleanElement(element, 'current')).filter(Boolean)
  const upcoming = elements.map((element) => cleanElement(element, 'upcoming')).filter(Boolean)

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: 'Epic Games Store',
    sourceUrl: 'https://store.epicgames.com/free-games',
    current,
    upcoming,
  }

  await mkdir(new URL('../public/data/', import.meta.url), { recursive: true })
  await writeFile(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  console.log(`Saved ${current.length} current and ${upcoming.length} upcoming Epic free games`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
