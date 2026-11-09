// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * XUI-017 接线锁(小程序「关于我们」入口)。
 * 旧实现:所有条目共用 onOpenPortal(点哪条都跳官网首页),label 也未按条目取词。
 * 本夹具钉两件事:入口表来自带 url 的 ABOUT_MENUS;每条 onPress 走 menu.url;
 * 且这些 url 必须是 app.config.ts 里真实在册的页面。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(APP_ROOT, p), 'utf8')

const ABOUT_SHARED = read('src/pkg-about/about-shared/index.tsx')
const APP_CONFIG = read('src/app.config.ts')

const MENU_URLS = [
  '/pkg-about/about/protocol',
  '/pkg-about/about/privacy',
  '/pkg-about/about/app-permission/index',
  '/pkg-about/about/usage-rules/index',
  '/pkg-about/about/business-license/index',
  '/pkg-about/about/icp-record/index',
  '/pkg-about/about/model-record/index',
  '/pkg-about/about/api-settings/index',
  '/pkg-about/about/help',
  '/pkg-about/about/contact',
]

/** 接线判据:正反两面对同一实现 */
export function detectAboutEntriesWiring(src: string): string[] {
  const missing: string[] = []
  if (!src.includes('import { ABOUT_MENUS }')) missing.push('import ABOUT_MENUS')
  if (!src.includes('ABOUT_MENUS.map(')) missing.push('entries from ABOUT_MENUS')
  if (!src.includes('label: t(menu.labelKey)')) missing.push('label resolved per entry')
  if (!src.includes('Taro.navigateTo({ url: menu.url })')) missing.push('onPress -> menu.url')
  if (src.includes('onPress: onOpenPortal')) missing.push('still all entries open portal')
  return missing
}

describe('XUI-017 关于我们入口逐条路由', () => {
  it('正向:入口表取自 ABOUT_MENUS,label 取词,onPress 走各自 url', () => {
    expect(detectAboutEntriesWiring(ABOUT_SHARED)).toEqual([])
  })

  it('反向对照:旧实现(共用 onOpenPortal)必须判红', () => {
    const oldImpl = `
import { ABOUT_ENTRY_IDS } from '@ihui/shared/constants'
entries={ABOUT_ENTRY_IDS.map((id: string) => ({
  id,
  label: t(\`about.\${id}\`),
  onPress: onOpenPortal,
}))}
`
    expect(detectAboutEntriesWiring(oldImpl)).toEqual([
      'import ABOUT_MENUS',
      'entries from ABOUT_MENUS',
      'label resolved per entry',
      'onPress -> menu.url',
      'still all entries open portal',
    ])
  })

  it('10 条 url 全部在 app.config.ts 注册', () => {
    for (const url of MENU_URLS) {
      const page = url.replace('/pkg-about/', '')
      expect(APP_CONFIG).toContain(`'${page}'`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
