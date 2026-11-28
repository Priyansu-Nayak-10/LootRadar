import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rawgImage, getOriginalRawgUrl } from '../rawgImage.js'

describe('rawgImage helper', () => {
  const sample = 'https://media.rawg.io/media/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg'

  it('applies /media/resize/<width>/-/ to media.rawg.io URLs', () => {
    assert.equal(
      rawgImage(sample, 420),
      'https://media.rawg.io/media/resize/420/-/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg'
    )
    assert.equal(
      rawgImage(sample, 200),
      'https://media.rawg.io/media/resize/200/-/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg'
    )
    assert.equal(
      rawgImage(sample, 640),
      'https://media.rawg.io/media/resize/640/-/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg'
    )
  })

  it('leaves already-resized and cropped RAWG URLs untouched', () => {
    const resized = 'https://media.rawg.io/media/resize/640/-/games/20a/20aa.jpg'
    const cropped = 'https://media.rawg.io/media/crop/600/400/games/20a/20aa.jpg'
    assert.equal(rawgImage(resized, 420), resized)
    assert.equal(rawgImage(cropped, 420), cropped)
  })

  it('leaves other hosts untouched (Epic, Steam, ITAD, GamerPower, FreeToGame)', () => {
    const urls = [
      'https://cdn1.epicgames.com/spt-assets/foo/bar.jpg',
      'https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg',
      'https://assets.isthereanydeal.com/01957c20/banner600.jpg',
      'https://www.gamerpower.com/offers/1/abc.jpg',
      'https://www.freetogame.com/g/540/thumbnail.jpg',
    ]
    for (const u of urls) {
      assert.equal(rawgImage(u, 420), u)
    }
  })

  it('handles null, undefined, and empty strings safely', () => {
    assert.equal(rawgImage(null, 420), null)
    assert.equal(rawgImage(undefined, 420), undefined)
    assert.equal(rawgImage('', 420), '')
  })

  it('extracts original RAWG URL from a resized URL for fallback', () => {
    const resized = rawgImage(sample, 420)
    assert.equal(getOriginalRawgUrl(resized), sample)
    assert.equal(getOriginalRawgUrl(sample), null)
  })
})
