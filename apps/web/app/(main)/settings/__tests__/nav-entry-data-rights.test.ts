// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `/settings/data-rights` 设置页导航入口回归锁(2026-10-24,票「P1 侧边栏收敛批次:
 * 去重 4 处 + 设置项归位 3 项」的唯一残余)。
 *
 * 立因:2026-10-19 那批把 `/settings` 与 `/settings/data-rights` 移出主侧边栏
 * (`src/components/sidebar/nav-data.ts` 的归位注释自述"归设置页统一管理"),但设置页
 * 自己的 `NAV_GROUPS` 从来没补上这一枚 —— 于是"归设置页"变成了"哪一面都没有",
 * 全站零导航入口,用户只能手敲 URL。本测试把"入口在册 + 落组正确 + 文案键取得到"
 * 钉成确定性判据,再丢一次即红。
 *
 * 落组理由(不许自创分组,故必须二选一):本页是 GDPR 数据主体权利(访问/导出/
 * 携带/擦除),同族条目是 navSecurity 组里的 `/settings/privacy`(隐私设置);
 * RN 端 `src/navigation/drawer-nav.ts` 也把 `dataRights.title` 挂在
 * `moreAccount`(账号与安全)组、图标同为 Shield 族 —— 两端同判。navOverview 只放
 * 设置页根入口(/settings),放功能叶子页会破该组语义;navBilling(账单)里那枚
 * `/settings/data-export` 是数据导出而非数据权利,语义不覆盖"擦除/携带"。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { NAV_GROUPS } from '../helpers'

const HREF = '/settings/data-rights'
const EXPECTED_GROUP_LABEL_KEY = 'navSecurity'

/** helpers.ts 既有分组基线:归位这一枚不许新增/改名分组 */
const KNOWN_GROUP_LABEL_KEYS = [
  'navOverview',
  'navAccount',
  'navSecurity',
  'navPreferences',
  'navDeveloper',
  'navBilling',
] as const

/** 五语种(AGENTS §19):入口文案键必须在每一语都取得到词 */
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

// 本文件位于 apps/web/app/(main)/settings/__tests__/ ⇒ 上溯 6 层为仓库根
// (§15 禁 process.cwd() 定根:共享工作树里 cwd 不可靠)
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')

function settingsNamespace(lang: string): Record<string, unknown> {
  const file = join(REPO_ROOT, 'packages', 'i18n', 'messages', 'web', `${lang}.json`)
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { settings?: Record<string, unknown> }
  return doc.settings ?? {}
}

const allItems = NAV_GROUPS.flatMap((group) => group.items)
const entryWithGroup = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupLabelKey: group.labelKey })),
).find((item) => item.href === HREF)

describe('/settings/data-rights 设置页导航入口(回归锁)', () => {
  it('NAV_GROUPS 真被读到(防判据空转:条目枚举到 0 不算绿)', () => {
    expect(allItems.length).toBeGreaterThan(15)
  })

  it('导航集合必须含 /settings/data-rights', () => {
    expect(entryWithGroup, `NAV_GROUPS 里没有 ${HREF}(入口又丢了)`).toBeDefined()
  })

  it('落在 navSecurity(隐私同族)组,且分组集合没因它扩充', () => {
    expect(entryWithGroup?.groupLabelKey).toBe(EXPECTED_GROUP_LABEL_KEY)
    expect(NAV_GROUPS.map((group) => group.labelKey)).toEqual([...KNOWN_GROUP_LABEL_KEYS])
  })

  it('href 全表唯一(同 href 双条目 = React key 相撞,即 P1 记档的同型病)', () => {
    const hrefs = allItems.map((item) => item.href)
    const duplicated = hrefs.filter((href, i) => hrefs.indexOf(href) !== i)
    expect(duplicated, `重复 href: ${duplicated.join(', ')}`).toEqual([])
  })

  for (const lang of LANGS) {
    it(`${lang} 的 settings 命名空间含该入口的 labelKey(缺键须停手回报,不许自创词包)`, () => {
      const labelKey = entryWithGroup?.labelKey
      expect(labelKey, `${HREF} 条目未定义`).toBeTypeOf('string')
      const ns = settingsNamespace(lang)
      expect(
        ns[labelKey as string],
        `web/${lang}.json 的 settings.${labelKey} 取不到词`,
      ).toBeTypeOf('string')
    })
  }

  it('条目字段形状仍是 href/labelKey/icon(§4 三层分治:可见性/鉴权字段不得并进 helpers)', () => {
    expect(Object.keys(entryWithGroup ?? {}).sort()).toEqual([
      'groupLabelKey',
      'href',
      'icon',
      'labelKey',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
