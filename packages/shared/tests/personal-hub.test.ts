// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  PERSONAL_ASSET_CARDS,
  PERSONAL_HUB_ALL_ENTRIES,
  PERSONAL_HUB_SECTIONS,
  PERSONAL_MENU_SECTIONS,
  PERSONAL_WEB_SIDEBAR_FLAT,
  PERSONAL_WEB_SIDEBAR_GROUPS,
  canOpenPersonalHubEntry,
  filterLabelledSections,
  findPersonalHubEntry,
} from '../src/navigation/personal-hub'

/**
 * 「我的」页单源清单的结构锁。
 *
 * 锁什么(以及为什么):
 *  1. 资产卡恰好 4 张 —— 两端 UserCard 都是 2×2 宫格,多一张或少一张就是版式塌;
 *  2. key 全清单唯一 —— key 是端侧导航分派的唯一身份,重复 = 点击落到别人家页面;
 *  3. webHref 唯一 —— 两条入口指向同一页在 web 侧栏会变成两个同名入口;
 *  4. 每条至少 web + 一个移动端落点 —— 防"清单里有、点了没反应"(旧 122 条里有一批);
 *  5. 同一条不得既做资产卡又做列表行 —— 那正是用户抱怨的"重复菜单"。
 */
describe('PERSONAL_ASSET_CARDS', () => {
  it('恰好 4 张,且覆盖订单/钱包/公司/智汇值', () => {
    expect(PERSONAL_ASSET_CARDS).toHaveLength(4)
    expect(PERSONAL_ASSET_CARDS.map((entry) => entry.key)).toEqual([
      'order',
      'wallet',
      'company',
      'token',
    ])
  })

  it('每张卡都有副标题中文兜底(卡片第二行不允许空)', () => {
    for (const entry of PERSONAL_ASSET_CARDS) {
      expect(entry.desc?.trim().length, `${entry.key} 缺 desc`).toBeGreaterThan(0)
      expect(entry.descKey, `${entry.key} 缺 descKey`).toBeTruthy()
    }
  })
})

describe('PERSONAL_MENU_SECTIONS', () => {
  it('分组至少 4 组,每组非空且标题有中文兜底', () => {
    expect(PERSONAL_MENU_SECTIONS.length).toBeGreaterThanOrEqual(4)
    for (const section of PERSONAL_MENU_SECTIONS) {
      expect(section.items.length, `${section.titleKey} 是空组`).toBeGreaterThan(0)
      expect(section.title.trim().length, `${section.titleKey} 缺中文兜底`).toBeGreaterThan(0)
      expect(section.titleKey.trim().length).toBeGreaterThan(0)
    }
  })

  it('首组是「权益与积分」:积分与会员不再进资产卡,避免同一入口两处出现', () => {
    const first = PERSONAL_MENU_SECTIONS[0]
    expect(first.titleKey).toBe('personalHub.sections.points')
    expect(first.items.map((entry) => entry.key)).toEqual(['points', 'vip'])
  })

  it('移动端 23 条:不含资产卡、不含 webOnly(5 条 web 历史项)', () => {
    const total = PERSONAL_MENU_SECTIONS.reduce((sum, section) => sum + section.items.length, 0)
    expect(total).toBe(23)
    for (const section of PERSONAL_MENU_SECTIONS) {
      expect(section.id).not.toBe('assets')
      for (const entry of section.items) expect(entry.webOnly).toBeFalsy()
    }
  })
})

describe('PERSONAL_HUB_ALL_ENTRIES', () => {
  it('汇总 32 条(4 卡 + 28 行;web 域页全集)', () => {
    expect(PERSONAL_HUB_ALL_ENTRIES).toHaveLength(32)
  })

  it('key 唯一', () => {
    const keys = PERSONAL_HUB_ALL_ENTRIES.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('webHref 唯一', () => {
    const hrefs = PERSONAL_HUB_ALL_ENTRIES.map((entry) => entry.webHref)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('每条都有中文兜底标签', () => {
    for (const entry of PERSONAL_HUB_ALL_ENTRIES) {
      expect(entry.label.trim().length, `${entry.key} 缺中文兜底`).toBeGreaterThan(0)
      expect(entry.labelKey.trim().length, `${entry.key} 缺 labelKey`).toBeGreaterThan(0)
    }
  })

  it('web 端每条都可落地(webHref 必填)', () => {
    for (const entry of PERSONAL_HUB_ALL_ENTRIES) {
      expect(canOpenPersonalHubEntry(entry, 'web'), `${entry.key} 在 web 无落点`).toBe(true)
    }
  })

  it('RN 与小程序每条都至少有一个落点(原生或 web 兜底)', () => {
    for (const entry of PERSONAL_HUB_ALL_ENTRIES) {
      expect(canOpenPersonalHubEntry(entry, 'rn'), `${entry.key} 在 RN 无落点`).toBe(true)
      expect(canOpenPersonalHubEntry(entry, 'miniapp'), `${entry.key} 在小程序无落点`).toBe(true)
    }
  })

  it('资产卡与菜单段不重复(同一 key 只出现一次)', () => {
    const cardKeys = new Set(PERSONAL_ASSET_CARDS.map((entry) => entry.key))
    for (const section of PERSONAL_MENU_SECTIONS) {
      for (const entry of section.items) {
        expect(cardKeys.has(entry.key), `${entry.key} 同时出现在资产卡与菜单段`).toBe(false)
      }
    }
  })

  it('findPersonalHubEntry 能命中每一条,未知 key 返回 undefined', () => {
    for (const entry of PERSONAL_HUB_ALL_ENTRIES) {
      expect(findPersonalHubEntry(entry.key)?.key).toBe(entry.key)
    }
    expect(findPersonalHubEntry('__not_exists__')).toBeUndefined()
  })
})

/**
 * web 侧栏派生锁(2026-11-24):web `PERSONAL_HUB_ITEMS` 由本清单派生,21 条 href
 * 必须与 web 历史清单逐条相等 —— 少一条 = 侧栏丢入口,多一条 = 与其它域重复
 * (门 128「重复 web 键」)。
 */
describe('PERSONAL_WEB_SIDEBAR_GROUPS', () => {
  const WEB_HREF = [
    '/favorites',
    '/following',
    '/subscriptions',
    '/user/profile',
    '/user/security',
    '/notifications',
    '/user/realname',
    '/user/subscription',
    '/user/learn-record',
    '/user/comment',
    '/user/fans',
    '/user/follow',
    '/user/ask',
    '/user/circle',
    '/user/resource',
    '/user/exam',
    '/user/sign-up',
    '/student',
    '/feedback',
    '/help',
    '/share',
  ]

  const all = [
    ...PERSONAL_WEB_SIDEBAR_GROUPS.flatMap((group) => group.entries),
    ...PERSONAL_WEB_SIDEBAR_FLAT,
  ]

  it('learning 父项 3 条 / account 父项 15 条 / 一级平铺 3 条', () => {
    expect(PERSONAL_WEB_SIDEBAR_GROUPS[0].parentKey).toBe('myLearning')
    expect(PERSONAL_WEB_SIDEBAR_GROUPS[0].entries).toHaveLength(3)
    expect(PERSONAL_WEB_SIDEBAR_GROUPS[1].parentKey).toBe('user')
    expect(PERSONAL_WEB_SIDEBAR_GROUPS[1].entries).toHaveLength(15)
    expect(PERSONAL_WEB_SIDEBAR_FLAT).toHaveLength(3)
  })

  it('21 条 href 与 web 历史清单逐条相等,且没有 omit 项混入', () => {
    expect([...all.map((entry) => entry.webHref)].sort()).toEqual([...WEB_HREF].sort())
    for (const entry of all) expect(entry.webSidebar).not.toBe('omit')
  })
})

/**
 * 三端同键锁(2026-11-24 机主令「必须打通同键」)。
 *
 * 判据:
 *  1. 清单里每个 `labelKey` / `descKey` / 组 `titleKey` 都能在 **shared 五语言包**解析到非空字符串;
 *  2. 五语言的 `personalHub` 子树键集完全一致(某语言缺键 = 该语言用户看到中文兜底);
 *  3. 三个端包(web / mobile-rn / miniapp-taro)五语言里 **不得**出现 `personalHub` 子树
 *     —— 端包重复登记 = 第二份真相源(AGENTS §0.6),merge 时端包会静默覆盖 shared。
 */
describe('三端同键(personalHub 只在 shared 五语言)', () => {
  const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
  const ROOT = new URL('../../i18n/messages/', import.meta.url)

  function readPack(scope: string, locale: string): Record<string, unknown> {
    return JSON.parse(readFileSync(new URL(`${scope}/${locale}.json`, ROOT), 'utf8'))
  }

  function resolve(pack: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((cur, seg) => {
      if (!cur || typeof cur !== 'object') return undefined
      return (cur as Record<string, unknown>)[seg]
    }, pack)
  }

  const keys = [
    ...PERSONAL_HUB_ALL_ENTRIES.map((entry) => entry.labelKey),
    ...PERSONAL_HUB_ALL_ENTRIES.flatMap((entry) => (entry.descKey ? [entry.descKey] : [])),
    ...PERSONAL_HUB_SECTIONS.map((section) => section.titleKey),
    'personalHub.title',
    'personalHub.subtitle',
  ]

  it('每个键在 shared 五语言都能解析到非空字符串', () => {
    for (const locale of LOCALES) {
      const pack = readPack('shared', locale)
      for (const key of keys) {
        const value = resolve(pack, key)
        expect(typeof value === 'string' && value.trim().length > 0, `${locale} 缺键 ${key}`).toBe(
          true,
        )
      }
    }
  })

  it('五语言 personalHub 子树键集完全一致(44 键 = 标题 2 + 分组 6 + 条目 32 + 卡片副标题 4)', () => {
    const leaves = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.keys(obj).flatMap((key) => {
        const value = obj[key]
        if (value && typeof value === 'object') {
          return leaves(value as Record<string, unknown>, `${prefix}${key}.`)
        }
        return `${prefix}${key}`
      })
    const base = leaves(readPack('shared', 'zh-CN').personalHub as Record<string, unknown>).sort()
    expect(base).toHaveLength(44)
    for (const locale of LOCALES) {
      const set = leaves(readPack('shared', locale).personalHub as Record<string, unknown>).sort()
      expect(set, `${locale} personalHub 键集与 zh-CN 不一致`).toEqual(base)
    }
  })

  it('端包五语言都不得出现 personalHub(重复登记即第二份真相源)', () => {
    for (const scope of ['web', 'mobile-rn', 'miniapp-taro']) {
      for (const locale of LOCALES) {
        const pack = readPack(scope, locale)
        expect(pack.personalHub, `${scope}/${locale} 重复登记了 personalHub`).toBeUndefined()
      }
    }
  })
})

/**
 * 搜索过滤的判据锁(2026-11-24):两端菜单区共用 `filterLabelledSections`,
 * 任何一端「另写一份 includes」都会让同一句搜索词在两个端给出不同结果集。
 */
describe('filterLabelledSections', () => {
  const sections = [
    { title: '账号与安全', items: [{ label: '个人资料' }, { label: '实名认证' }] },
    { title: '服务与支持', items: [{ label: '设置' }, { label: '帮助中心' }] },
  ]

  it('空查询(含纯空白)原样返回全部组与条目,顺序不变', () => {
    const all = filterLabelledSections(sections, '   ')
    expect(all.map((s) => s.title)).toEqual(['账号与安全', '服务与支持'])
    expect(all[0].items.map((i) => i.label)).toEqual(['个人资料', '实名认证'])
  })

  it('按条目 label 子串命中,无命中的条目被剔除、空组整组消失', () => {
    const hit = filterLabelledSections(sections, '认证')
    expect(hit).toHaveLength(1)
    expect(hit[0].title).toBe('账号与安全')
    expect(hit[0].items.map((i) => i.label)).toEqual(['实名认证'])
  })

  it('组标题命中返回整组;全无命中返回空数组(空态由宿主渲染)', () => {
    expect(filterLabelledSections(sections, '服务与支持')[0].items).toHaveLength(2)
    expect(filterLabelledSections(sections, '__none__')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
