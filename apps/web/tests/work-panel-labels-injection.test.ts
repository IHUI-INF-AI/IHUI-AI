// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * WorkPanel 标签注入契约测试(2026-09-22)
 *
 * @ihui/ui-react 的 WorkPanel 用 `labels`(Partial)注入文案,不传就回退 DEFAULT_LABELS(简体中文)。
 * "回退"正是缺陷温床:调用方少传一个键不会报错,只会在英文界面上安静地显示中文。
 * 本测试把三方契约钉住:ui-react 的每个 label 键 ⇒ web 必须注入 ⇒ 5 语言包必须有键。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function repoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'packages/i18n/messages/web/zh-CN.json'))) return dir
    dir = dirname(dir)
  }
  throw new Error('未找到仓库根')
}
const ROOT = repoRoot()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** ui-react DEFAULT_LABELS 的键集合(判据的唯一来源,避免手工抄表漂移) */
function defaultLabelKeys(): string[] {
  const src = read('packages/ui-react/src/components/work-panel.tsx')
  const start = src.indexOf('const DEFAULT_LABELS')
  expect(start, '未找到 DEFAULT_LABELS').toBeGreaterThan(-1)
  const block = src.slice(start, src.indexOf('\n}', start) + 2)
  return [...block.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]).filter(Boolean)
}

describe('WorkPanel labels 注入契约', () => {
  const keys = defaultLabelKeys()

  it('能从 ui-react 读到非空 label 键表(哨兵:解析失配会在此先红)', () => {
    expect(keys.length).toBeGreaterThanOrEqual(15)
    expect(keys).toContain('closeTab')
    expect(keys).toContain('favoritesAndHistory')
  })

  it('web 端为每个 label 键注入取词,且真的传给 WorkPanel', () => {
    const web = read('apps/web/src/components/work-panel/web-work-panel.tsx')
    const missing = keys.filter((k) => !new RegExp(`${k}:\\s*tw\\('${k}'\\)`).test(web))
    expect(missing, `web 未注入的 label 键:${missing.join(', ')}`).toEqual([])
    expect(web).toContain('labels={workPanelLabels}')
    expect(web).toContain("useTranslations('workPanel')")
  })

  it('5 语言包每个 label 键都存在(缺一即静默回退中文)', () => {
    for (const lang of LOCALES) {
      const json = JSON.parse(read(`packages/i18n/messages/web/${lang}.json`)) as Record<
        string,
        Record<string, string>
      >
      const wp = json.workPanel
      expect(wp, `${lang}: 缺 workPanel 命名空间`).toBeTruthy()
      const missing = keys.filter((k) => typeof wp[k] !== 'string' || wp[k] === '')
      expect(missing, `${lang}: workPanel 缺键 ${missing.join(', ')}`).toEqual([])
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
