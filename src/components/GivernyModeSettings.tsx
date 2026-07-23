import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  GIVERNY_MODE_KEY,
  GIVERNY_SEASON_KEY,
  currentSeason,
  readSeasonPref,
  resolveSeason,
  type SeasonKey,
  type SeasonPref,
} from '../lib/givernyTheme'

export function GivernyModeSettings() {
  const [on, setOn] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.giverny === 'on',
  )
  const [seasonPref, setSeasonPref] = useState<SeasonPref>(() => readSeasonPref())

  const applyMode = (next: boolean) => {
    setOn(next)
    if (next) document.documentElement.dataset.giverny = 'on'
    else delete document.documentElement.dataset.giverny
    try {
      window.localStorage.setItem(GIVERNY_MODE_KEY, next ? 'on' : 'off')
    } catch {
      // 隐私模式下仅保留当前会话效果
    }
  }

  const applySeason = (pref: SeasonPref) => {
    setSeasonPref(pref)
    try {
      if (pref === 'auto') window.localStorage.removeItem(GIVERNY_SEASON_KEY)
      else window.localStorage.setItem(GIVERNY_SEASON_KEY, pref)
    } catch {
      // 隐私模式下仅保留当前会话效果
    }
    document.documentElement.dataset.season = resolveSeason(pref)
  }

  const seasons: Array<[SeasonKey, string]> = [
    ['spring', '春 · 萌芽'],
    ['summer', '夏 · 盛放'],
    ['autumn', '秋 · 暮光'],
    ['winter', '冬 · 冷静'],
  ]
  const autoLabel: Record<SeasonKey, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }

  return (
    <details className="settings-group-panel" open>
      <summary className="settings-group-summary">
        <div>
          <h2>外观 · 吉维尼模式</h2>
          <p>莫奈花园主题，随季节自然流转</p>
        </div>
        <ChevronDown size={18} />
      </summary>
      <div className="settings-group-body">
        <section className="panel giverny-settings-panel">
          <div className="panel-header compact">
            <div>
              <h2>吉维尼模式</h2>
              <p>致敬莫奈的睡莲池。开启后整站切换到莫奈花园色系，主题随季节流转。默认关闭，冷静的工具模式不受影响。</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              className={`giverny-toggle ${on ? 'on' : ''}`}
              onClick={() => applyMode(!on)}
            >
              <span className="giverny-toggle-track"><span className="giverny-toggle-thumb" /></span>
              <span className="giverny-toggle-label">{on ? '已开启' : '已关闭'}</span>
            </button>
          </div>
          {on && (
            <div className="giverny-season-pref">
              <span className="giverny-season-pref-title">季节</span>
              <div className="giverny-season-options" role="group" aria-label="季节选择">
                <button type="button" className={seasonPref === 'auto' ? 'active' : ''} onClick={() => applySeason('auto')}>
                  跟随当前季节（{autoLabel[currentSeason()]}）
                </button>
                {seasons.map(([key, label]) => (
                  <button type="button" key={key} className={seasonPref === key ? 'active' : ''} onClick={() => applySeason(key)}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="giverny-season-hint">默认跟随当前真实季节；也可手动锁定某一季。</p>
            </div>
          )}
        </section>
      </div>
    </details>
  )
}
