import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  titleKey,
  formatUsd,
  isConsoleGame,
  normalizeFreeTitle,
  evaluateWishlistDeal,
  shouldSendWishlistAlert,
} from '../wishlistAlerts.js';

describe('wishlistAlerts pure functions', () => {
  it('titleKey normalizes titles properly', () => {
    assert.equal(titleKey('Spider-Man: Miles Morales'), 'spider man miles morales');
    assert.equal(titleKey('Grand Theft Auto V'), 'grand theft auto v');
    assert.equal(titleKey("Assassin's Creed Valhalla"), 'assassins creed valhalla');
  });

  it('normalizeFreeTitle strips giveaway and store tags cleanly', () => {
    assert.equal(
      normalizeFreeTitle('Mark of the Deep (Epic Games) Giveaway'),
      'Mark of the Deep'
    );
    assert.equal(
      normalizeFreeTitle('Ghostwire: Tokyo (GOG) Giveaway'),
      'Ghostwire: Tokyo'
    );
    assert.equal(
      normalizeFreeTitle('Dishonored 2 (Prime Gaming) Giveaway'),
      'Dishonored 2'
    );
    assert.equal(
      titleKey(normalizeFreeTitle('Mark of the Deep (Epic Games) Giveaway')),
      titleKey('Mark of the Deep')
    );
  });

  it('formatUsd formats numbers and currency strings correctly', () => {
    assert.equal(formatUsd(0), 'Free');
    assert.equal(formatUsd('0.00'), 'Free');
    assert.equal(formatUsd(19.99), '$19.99 USD');
    assert.equal(formatUsd('9.5'), '$9.50 USD');
    assert.equal(formatUsd(null), '');
  });

  it('isConsoleGame detects pure console games correctly', () => {
    assert.equal(isConsoleGame({ platform: 'PlayStation 5' }), true);
    assert.equal(isConsoleGame('Xbox Series X/S'), true);
    assert.equal(isConsoleGame({ platform: 'Nintendo Switch' }), true);
    assert.equal(isConsoleGame({ platform: 'PC, PlayStation 5' }), false);
    assert.equal(isConsoleGame('Steam'), false);
    assert.equal(isConsoleGame({ platform: 'Windows' }), false);
    assert.equal(isConsoleGame({}), false);
  });

  describe('evaluateWishlistDeal', () => {
    const freeGiveaway = {
      isFree: true,
      price: 0,
      savings: 100,
      giveaway: { title: 'Ghostwire Tokyo' },
    };

    const modestDeal = {
      isFree: false,
      price: 49.99,
      retailPrice: 59.99,
      savings: 16.6,
      lowestPrice: 29.99,
    };

    const goodDealNotLowest = {
      isFree: false,
      price: 29.99,
      retailPrice: 59.99,
      savings: 50,
      lowestPrice: 19.99,
    };

    const goodDealNearLowest = {
      isFree: false,
      price: 20.99,
      retailPrice: 59.99,
      savings: 65,
      lowestPrice: 19.99, // 20.99 <= 19.99 * 1.10 (21.989) -> near lowest!
    };

    const tinyDiscount = {
      isFree: false,
      price: 54.99,
      retailPrice: 59.99,
      savings: 8,
      lowestPrice: 40,
    };

    it('always triggers for free giveaways', () => {
      const result = evaluateWishlistDeal(freeGiveaway, 'good');
      assert.equal(result.shouldAlert, true);
      assert.equal(result.isFree, true);
    });

    it('ignores deals with discount < 15% across all sensitivities', () => {
      assert.equal(evaluateWishlistDeal(tinyDiscount, 'any').shouldAlert, false);
      assert.equal(evaluateWishlistDeal(tinyDiscount, 'good').shouldAlert, false);
      assert.equal(evaluateWishlistDeal(tinyDiscount, 'great').shouldAlert, false);
    });

    it('handles "any" sensitivity (>= 25%)', () => {
      assert.equal(evaluateWishlistDeal(modestDeal, 'any').shouldAlert, false); // 16.6% < 25%
      assert.equal(evaluateWishlistDeal(goodDealNotLowest, 'any').shouldAlert, true); // 50% >= 25%
    });

    it('handles "good" sensitivity (>= 25% AND near lowest ever or fallback >= 40%)', () => {
      // Near lowest: 65% off, price 20.99 vs lowest 19.99
      const resNear = evaluateWishlistDeal(goodDealNearLowest, 'good');
      assert.equal(resNear.shouldAlert, true);
      assert.equal(resNear.isNearLow, true);

      // Not near lowest (29.99 vs 19.99 is > 10% above), but 50% >= 40% fallback
      const resNoLowest = evaluateWishlistDeal({ ...goodDealNotLowest, lowestPrice: null }, 'good');
      assert.equal(resNoLowest.shouldAlert, true);
    });

    it('handles "great" sensitivity (>= 50% OR at all-time low)', () => {
      const deal40 = { isFree: false, price: 30, retailPrice: 50, savings: 40, lowestPrice: 20 };
      assert.equal(evaluateWishlistDeal(deal40, 'great').shouldAlert, false);

      const deal50 = { isFree: false, price: 25, retailPrice: 50, savings: 50, lowestPrice: 20 };
      assert.equal(evaluateWishlistDeal(deal50, 'great').shouldAlert, true);

      const dealAtLowest = { isFree: false, price: 15, retailPrice: 20, savings: 25, lowestPrice: 15.5 };
      assert.equal(evaluateWishlistDeal(dealAtLowest, 'great').shouldAlert, true);
    });
  });

  describe('shouldSendWishlistAlert (anti-spam)', () => {
    const baseDeal = {
      isFree: false,
      savings: 50,
      price: 29.99,
      lowestPrice: 19.99,
    };

    it('blocks alert if notify is false', () => {
      const decision = shouldSendWishlistAlert({ notify: false }, baseDeal);
      assert.equal(decision.shouldAlert, false);
      assert.equal(decision.reason, 'Alerts disabled by user');
    });

    it('blocks alert if weekly cap of 3 is reached', () => {
      const savedGame = {
        notify: true,
        alert_count_this_week: 3,
        alert_week_start: new Date().toISOString(),
        last_alerted_discount: 30,
        last_alerted_price: 39.99,
      };
      const decision = shouldSendWishlistAlert(savedGame, baseDeal);
      assert.equal(decision.shouldAlert, false);
      assert.equal(decision.reason, 'Weekly limit of 3 alerts reached');
    });

    it('allows first alert when game was never alerted before', () => {
      const savedGame = { notify: true, last_alerted_discount: null, last_alerted_price: null };
      const decision = shouldSendWishlistAlert(savedGame, baseDeal, 'any');
      assert.equal(decision.shouldAlert, true);
    });

    it('blocks re-alert if discount is not 15 points deeper and not at all-time low', () => {
      const savedGame = {
        notify: true,
        last_alerted_at: new Date().toISOString(),
        last_alerted_discount: 45,
        last_alerted_price: 25.00,
      };
      // 50% is only 5 points deeper than 45%, and price 29.99 is higher than lastPrice 25.00
      const decision = shouldSendWishlistAlert(savedGame, baseDeal, 'any');
      assert.equal(decision.shouldAlert, false);
    });

    it('allows re-alert if discount is at least 15 points deeper', () => {
      const savedGame = {
        notify: true,
        last_alerted_at: new Date().toISOString(),
        last_alerted_discount: 30,
        last_alerted_price: 42.00,
      };
      // 50% is 20 points deeper than 30% (>= 15) -> allow
      const decision = shouldSendWishlistAlert(savedGame, baseDeal, 'any');
      assert.equal(decision.shouldAlert, true);
    });

    it('allows re-alert if price hits all-time low even if delta < 15', () => {
      const savedGame = {
        notify: true,
        last_alerted_at: new Date().toISOString(),
        last_alerted_discount: 45,
        last_alerted_price: 25.00,
      };
      const allTimeLowDeal = { ...baseDeal, price: 14.99, lowestPrice: 15.00 };
      const decision = shouldSendWishlistAlert(savedGame, allTimeLowDeal, 'any');
      assert.equal(decision.shouldAlert, true);
    });
  });
});
