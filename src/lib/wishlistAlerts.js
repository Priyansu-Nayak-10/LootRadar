// ─── Pure functions for Wishlist deal evaluation & smart alert rules ───────────

export function titleKey(title = '') {
  return String(title)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatUsd(value) {
  if (value === null || value === undefined || value === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  if (amount === 0) return 'Free'
  return `$${amount.toFixed(2)} USD`
}

export function normalizeFreeTitle(rawTitle = '') {
  return String(rawTitle || '')
    .replace(/\s*\([^)]*(?:giveaway|free|epic|gog|steam|itch|prime|pc|ubisoft)[^)]*\)/gi, '')
    .replace(/\s+giveaway\b/gi, '')
    .trim()
}

export function isConsoleGame(input = '') {
  const platform =
    typeof input === 'object' && input !== null ? input.platform || '' : String(input || '')
  if (!platform) return false
  const p = platform.toLowerCase()
  const hasConsole =
    p.includes('playstation') ||
    p.includes('ps5') ||
    p.includes('ps4') ||
    p.includes('ps3') ||
    p.includes('xbox') ||
    p.includes('nintendo') ||
    p.includes('switch')
  const hasPc =
    p.includes('pc') ||
    p.includes('windows') ||
    p.includes('linux') ||
    p.includes('mac') ||
    p.includes('steam') ||
    p.includes('epic') ||
    p.includes('gog')
  return hasConsole && !hasPc
}

/**
 * Evaluate if a deal triggers an alert based on user sensitivity:
 * - Free (100% off): always notify.
 * - Good deals (default): discount >= 25% AND sale price within ~10% of lowest price ever.
 *   If lowest price is missing, fallback to >= 40% off.
 * - Any sale: discount >= 25%.
 * - Only great deals: discount >= 50% OR sale price at/below all-time low.
 * - Ignore anything under 15% off in all modes.
 */
export function evaluateWishlistDeal(deal, sensitivity = 'good', cheapestEver = null) {
  if (!deal) return { fires: false, shouldAlert: false, reason: 'No active deal' }

  const discount = Math.round(Number(deal.savings ?? 0))
  const salePrice = Number(deal.salePrice ?? deal.price ?? 0)
  const lowest =
    cheapestEver != null && Number.isFinite(Number(cheapestEver))
      ? Number(cheapestEver)
      : deal.cheapest && Number.isFinite(Number(deal.cheapest))
        ? Number(deal.cheapest)
        : deal.lowestPrice && Number.isFinite(Number(deal.lowestPrice))
          ? Number(deal.lowestPrice)
          : null

  // 1. Free giveaway always notifies
  if (discount >= 100 || salePrice === 0 || deal.isFree) {
    return { fires: true, shouldAlert: true, reason: 'Free giveaway', isFree: true, isNearLow: true }
  }

  // 3. Ignore anything under 15% off in all modes
  if (discount < 15) {
    return { fires: false, shouldAlert: false, reason: 'Under 15% discount threshold' }
  }

  // 2. Sensitivity modes
  if (sensitivity === 'any') {
    if (discount >= 25) {
      return { fires: true, shouldAlert: true, reason: 'Any sale 25%+ threshold met', isNearLow: false }
    }
    return { fires: false, shouldAlert: false, reason: 'Below 25% threshold' }
  }

  if (sensitivity === 'great') {
    const isAllTimeLow = lowest != null && lowest > 0 && salePrice <= lowest
    if (discount >= 50 || isAllTimeLow) {
      return {
        fires: true,
        shouldAlert: true,
        reason: isAllTimeLow ? 'All-time low price' : '50%+ discount',
        isAllTimeLow,
        isNearLow: true,
      }
    }
    return { fires: false, shouldAlert: false, reason: 'Below great deals threshold' }
  }

  // Default: 'good' deals
  if (lowest != null && Number.isFinite(lowest) && lowest > 0) {
    // Within ~10% of the lowest price ever (e.g. salePrice <= lowest * 1.10)
    const isWithin10Percent = salePrice <= lowest * 1.10
    if (discount >= 25 && isWithin10Percent) {
      return {
        fires: true,
        shouldAlert: true,
        reason: 'Within 10% of all-time low',
        isNearLow: true,
      }
    }
    return { fires: false, shouldAlert: false, reason: 'Not near all-time low' }
  }

  // Fallback when lowest-price data is missing: >= 40% off
  if (discount >= 40) {
    return {
      fires: true,
      shouldAlert: true,
      reason: '40%+ off (lowest price data missing)',
      isNearLow: true,
    }
  }

  return { fires: false, shouldAlert: false, reason: 'Below good deals threshold' }
}

/**
 * Anti-spam rules:
 * - One alert per sale.
 * - Re-alert only if discount is >= 15 points deeper than last alert, OR price hits a new all-time low.
 * - Cap at 3 alerts per game per week.
 */
export function shouldSendWishlistAlert(arg1, arg2, arg3, arg4, arg5) {
  let gameRecord, deal, sensitivity, cheapestEver, now
  if (arg1 && typeof arg1 === 'object' && ('gameRecord' in arg1 || 'deal' in arg1)) {
    gameRecord = arg1.gameRecord
    deal = arg1.deal
    sensitivity = arg1.sensitivity ?? 'good'
    cheapestEver = arg1.cheapestEver ?? null
    now = arg1.now ?? new Date()
  } else {
    gameRecord = arg1
    deal = arg2
    sensitivity = arg3 ?? 'good'
    cheapestEver = arg4 ?? null
    now = arg5 ?? new Date()
  }

  if (!gameRecord || gameRecord.notify === false) {
    return { shouldAlert: false, reason: 'Alerts disabled by user' }
  }

  // 1. Weekly cap check (max 3 alerts per game per week)
  const weekStart = gameRecord.alert_week_start ? new Date(gameRecord.alert_week_start) : null
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  const isNewWeek = !weekStart || now.getTime() - weekStart.getTime() > oneWeekMs
  const currentWeekCount = isNewWeek ? 0 : Number(gameRecord.alert_count_this_week || 0)

  if (currentWeekCount >= 3) {
    return { shouldAlert: false, reason: 'Weekly limit of 3 alerts reached' }
  }

  const evalResult = evaluateWishlistDeal(deal, sensitivity, cheapestEver)
  if (!evalResult.shouldAlert) {
    return { shouldAlert: false, reason: evalResult.reason }
  }

  const discount = Math.round(Number(deal?.savings ?? 0))
  const salePrice = Number(deal?.salePrice ?? deal?.price ?? 0)
  const lowest =
    cheapestEver != null && Number.isFinite(Number(cheapestEver))
      ? Number(cheapestEver)
      : deal?.cheapest && Number.isFinite(Number(deal.cheapest))
        ? Number(deal.cheapest)
        : deal?.lowestPrice && Number.isFinite(Number(deal.lowestPrice))
          ? Number(deal.lowestPrice)
          : null

  // 2. Anti-spam / re-alert conditions
  if (gameRecord.last_alerted_at) {
    const lastDiscount = Number(gameRecord.last_alerted_discount || 0)
    const lastPrice = Number(gameRecord.last_alerted_price ?? 0)
    const hasLastPrice =
      gameRecord.last_alerted_price !== null &&
      gameRecord.last_alerted_price !== undefined &&
      Number.isFinite(Number(gameRecord.last_alerted_price))

    const is15PointsDeeper = discount >= lastDiscount + 15
    const isNewAllTimeLow =
      lowest != null &&
      salePrice < lowest &&
      (!hasLastPrice || salePrice < lastPrice)
    const wasLastFree = lastDiscount >= 100 || (hasLastPrice && lastPrice === 0)
    const isNewlyFree = Boolean(evalResult.isFree) && !wasLastFree

    if (!is15PointsDeeper && !isNewAllTimeLow && !isNewlyFree) {
      return {
        shouldAlert: false,
        reason: 'Already alerted for this sale (must be 15% deeper, new all-time low, or newly free)',
      }
    }
  }

  return {
    shouldAlert: true,
    reason: evalResult.reason,
    isNewWeek,
    currentWeekCount: currentWeekCount + 1,
  }
}

export function isAlertDue({ kind, target, end = null, candidates = [], now = new Date() }) {
  if (!target) return false

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const targetMs = target instanceof Date ? target.getTime() : new Date(target).getTime()
  if (Number.isNaN(nowMs) || Number.isNaN(targetMs)) return false

  // 1. Due time must have passed
  if (nowMs < targetMs) return false

  // 2. Window has not ended
  if (end) {
    const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime()
    if (!Number.isNaN(endMs) && nowMs >= endMs) return false
  }

  // 3. For day_before and mid_window, skip if a later alert for the same game is already due
  const isCandidateDue = (checkKind) => {
    const c = candidates.find((item) => item.kind === checkKind)
    if (!c?.target) return false
    const t = c.target instanceof Date ? c.target.getTime() : new Date(c.target).getTime()
    return !Number.isNaN(t) && nowMs >= t
  }

  if (kind === 'day_before') {
    if (isCandidateDue('mid_window') || isCandidateDue('ending_soon')) {
      return false
    }
  }

  if (kind === 'mid_window') {
    if (isCandidateDue('ending_soon')) {
      return false
    }
  }

  return true
}
