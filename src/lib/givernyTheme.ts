export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
export type SeasonPref = 'auto' | SeasonKey

export const GIVERNY_MODE_KEY = 'giverny-mode'
export const GIVERNY_SEASON_KEY = 'giverny-season'

export function seasonOfMonth(month1to12: number): SeasonKey {
  if (month1to12 >= 3 && month1to12 <= 5) return 'spring'
  if (month1to12 >= 6 && month1to12 <= 8) return 'summer'
  if (month1to12 >= 9 && month1to12 <= 11) return 'autumn'
  return 'winter'
}

export function currentSeason(): SeasonKey {
  return seasonOfMonth(new Date().getMonth() + 1)
}

export function readSeasonPref(): SeasonPref {
  try {
    const raw = window.localStorage.getItem(GIVERNY_SEASON_KEY)
    if (raw === 'spring' || raw === 'summer' || raw === 'autumn' || raw === 'winter') return raw
  } catch {
    // 隐私模式下回退自动季节
  }
  return 'auto'
}

export function resolveSeason(pref: SeasonPref = readSeasonPref()): SeasonKey {
  return pref === 'auto' ? currentSeason() : pref
}

export function initializeGivernyTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.season = resolveSeason()
  try {
    if (window.localStorage.getItem(GIVERNY_MODE_KEY) === 'on') {
      document.documentElement.dataset.giverny = 'on'
    }
  } catch {
    // 隐私模式下保持工具模式
  }
}
