// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 抽屉动作契约的接线锁（2026-11-24 立）。
 *
 * 目的：让「三端动作集合 + 各端词条键」只有一个可判定的真相源。
 * 判据分三类：
 *  A. 表自身完整性（id 唯一 / 缺席必写理由 / 每端动作数）
 *  B. 词条存在性（契约里每对 (端, 键) 必须在该端词包里取到值）——钉住「运行时显示裸键」
 *  C. 接线形状（移动两端渲染层不得再写 `'drawer.batchDelete'` 这类字面量；web 参照端键名与契约一致）
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DRAWER_ACTION_SOURCE,
  drawerAbsentActions,
  drawerActionKey,
  drawerActionSpec,
  drawerActionsFor,
} from '../src/navigation/drawer-ui-contract'

const ROOT = resolve(__dirname, '../../..')
const readJson = (rel: string) =>
  JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')) as Record<string, unknown>

const MESSAGES = {
  web: (loc: string) => readJson(`packages/i18n/messages/web/${loc}.json`),
  'mobile-rn': (loc: string) => readJson(`packages/i18n/messages/mobile-rn/${loc}.json`),
  'miniapp-taro': (loc: string) => readJson(`packages/i18n/messages/miniapp-taro/${loc}.json`),
} as const

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const getPath = (obj: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[seg]
    return undefined
  }, obj)

const SOURCES = {
  rn: 'apps/mobile-rn/src/components/Drawer.tsx',
  miniapp: 'apps/miniapp-taro/src/components/DrawerComponent.tsx',
  web: [
    'apps/web/src/components/sidebar-chat-history.tsx',
    'apps/web/src/components/sidebar/conversation-batch-bar.tsx',
  ],
} as const

describe('A. 动作表完整性', () => {
  it('11 个动作 id 全部登记且唯一', () => {
    const ids = DRAWER_ACTION_SOURCE.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'search',
      'multiSelect',
      'folderFilter',
      'sort',
      'selectAll',
      'invertSelection',
      'moveToFolder',
      'archive',
      'unarchive',
      'delete',
      'cancelSelection',
    ])
  })

  it('每端动作数：web 11 / rn 10 / miniapp 9（差集必须逐条登记理由）', () => {
    const count = (p: 'web' | 'rn' | 'miniapp') =>
      DRAWER_ACTION_SOURCE.filter((s) => s.platforms.includes(p)).length
    expect(count('web')).toBe(11)
    expect(count('rn')).toBe(10)
    expect(count('miniapp')).toBe(9)
  })

  it('任何端缺席的动作都写了非空理由（禁止静默消失）', () => {
    for (const platform of ['web', 'rn', 'miniapp'] as const) {
      for (const scope of ['historyHeader', 'batchBar'] as const) {
        for (const absent of drawerAbsentActions(scope, platform)) {
          expect(
            absent.reason.length,
            `缺席动作 ${absent.id}@${platform} 未写理由`,
          ).toBeGreaterThan(8)
        }
      }
    }
  })

  it('取键入口对未登记 id 直接抛错（不静默给 undefined）', () => {
    expect(() => drawerActionSpec('notAnAction' as never)).toThrow(/未登记的动作/)
    expect(drawerActionKey('multiSelect')).toBe('drawer.multiSelect')
  })

  it('抽屉首层顺序：历史卡从左到右 = search → multiSelect → folderFilter → sort', () => {
    expect(drawerActionsFor('historyHeader', 'web').map((s) => s.id)).toEqual([
      'search',
      'multiSelect',
      'folderFilter',
      'sort',
    ])
    expect(drawerActionsFor('batchBar', 'web').map((s) => s.id)).toEqual([
      'selectAll',
      'invertSelection',
      'moveToFolder',
      'archive',
      'unarchive',
      'delete',
      'cancelSelection',
    ])
  })
})

describe('B. 词条存在性（钉住运行时裸键）', () => {
  it('移动两端：契约里各端可用动作的 mobileKey / mobileAltKey 在 5 语言里都有值', () => {
    const missing: string[] = []
    for (const loc of LOCALES) {
      for (const spec of DRAWER_ACTION_SOURCE) {
        for (const key of [spec.mobileKey, spec.mobileAltKey].filter(Boolean) as string[]) {
          for (const [app, platform] of [
            ['mobile-rn', 'rn'],
            ['miniapp-taro', 'miniapp'],
          ] as const) {
            if (!spec.platforms.includes(platform)) continue
            const value = getPath(MESSAGES[app](loc), key)
            if (typeof value !== 'string' || !value) missing.push(`${app}/${loc}/${key}`)
          }
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('web：契约里的 webNs + webKey 在 5 语言里都有值', () => {
    const missing: string[] = []
    for (const loc of LOCALES) {
      for (const spec of DRAWER_ACTION_SOURCE) {
        const value = getPath(MESSAGES.web(loc), `${spec.webNs}.${spec.webKey}`)
        if (typeof value !== 'string' || !value)
          missing.push(`web/${loc}/${spec.webNs}.${spec.webKey}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('同义动作的中文兜底与 zh-CN 值一致（改值必须同改兜底）', () => {
    const drift: string[] = []
    const zhWeb = MESSAGES.web('zh-CN')
    const zhRn = MESSAGES['mobile-rn']('zh-CN')
    const zhMini = MESSAGES['miniapp-taro']('zh-CN')
    for (const spec of DRAWER_ACTION_SOURCE) {
      // sort 在移动两端是「按当前状态播报」的切换钮，主键存的是状态词而非区块名，不与 label 比对
      if (spec.id === 'sort') continue
      if (spec.platforms.includes('web')) {
        const webValue = getPath(zhWeb, `${spec.webNs}.${spec.webKey}`)
        if (webValue !== spec.label)
          drift.push(`web ${spec.id}: ${String(webValue)} ≠ ${spec.label}`)
      }
      if (spec.platforms.includes('miniapp')) {
        const miniValue = getPath(zhMini, spec.mobileKey)
        if (miniValue !== spec.label)
          drift.push(`miniapp ${spec.id}: ${String(miniValue)} ≠ ${spec.label}`)
      }
      if (spec.platforms.includes('rn')) {
        const rnValue = getPath(zhRn, spec.mobileKey)
        if (rnValue !== spec.label) drift.push(`rn ${spec.id}: ${String(rnValue)} ≠ ${spec.label}`)
      }
    }
    expect(drift).toEqual([])
  })
})

describe('C. 接线形状（防端内私写第二份键）', () => {
  it('移动两端渲染层不再出现契约内动作的 drawer.* 字面量', () => {
    const literalKeys = [
      'drawer.search',
      'drawer.multiSelect',
      'drawer.filterLabel',
      'drawer.selectAll',
      'drawer.invertSelection',
      'drawer.moveToFolder',
      'drawer.batchArchive',
      'drawer.batchUnarchive',
      'drawer.batchDelete',
      'drawer.cancelSelection',
      'drawer.sortPinnedFirst',
      'drawer.sortByTime',
    ]
    for (const file of [SOURCES.rn, SOURCES.miniapp] as const) {
      const src = readFileSync(resolve(ROOT, file), 'utf8')
      const hits = literalKeys.filter((key) => new RegExp(`['"\`]${key}['"\`]`).test(src))
      expect(hits, `${file} 仍硬编码动作键，应改走 drawerActionKey()`).toEqual([])
    }
  })

  it('移动两端都从契约导入取键函数', () => {
    for (const file of [SOURCES.rn, SOURCES.miniapp] as const) {
      const src = readFileSync(resolve(ROOT, file), 'utf8')
      expect(src, `${file} 缺 drawerActionKey 导入`).toMatch(/drawerActionKey/)
      expect(src, `${file} 未实际调用取键入口`).toMatch(/drawerActionKey\('/)
    }
  })

  it('web 参照端：动作键名与契约逐项一致（改 web 键必须同步改契约）', () => {
    const src = SOURCES.web.map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('\n')
    const missing = DRAWER_ACTION_SOURCE.filter((spec) => !src.includes(`'${spec.webKey}'`)).map(
      (spec) => `${spec.webNs}.${spec.webKey}`,
    )
    expect(missing).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
