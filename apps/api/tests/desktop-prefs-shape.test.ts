// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 桌面端偏好漫游 —— 校验面与"形状只有一份"对账(2026-09-28 立)。
 *
 * 端点级的属主绑定/写诚实性由 `apps/api/tests/desktop-prefs.test.ts` 那一份覆盖
 * (令牌主体是唯一能决定读哪行写哪行的东西、校验不过一条写都不发)。本文件刻意不重复
 * 那一族的断言,只钉两件它结构上看不见的事:
 *
 * ① `checkDesktopPrefs` 是 jsonb 载荷的**唯一**判据:不 coercion、不放多余键、返回新建对象。
 *    这几条都是"端上以后改了字段名而服务端还照收"的兜底,只能逐档判。
 * ② schema 那张表的列集必须与迁移 SQL 里那份**逐字同列**。立因是本票当天真实发生的一次:
 *    `desktop_prefs` 先落 SQL、schema 后来才补 `created_at` —— 两把尺子(门 3/schema drift、
 *    门 49/记账 B1-B5)都只判"journal ↔ .sql 一一对应"与"journal 结构",**没有一道**判
 *    "TS 列集 == SQL 列集",于是这类分叉账面全绿而只在第一次 INSERT 才炸
 *    (`column "created_at" of relation "desktop_prefs" does not exist` 反向亦然)。
 *
 * 全程离线,不连任何 PostgreSQL(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { desktopPrefs } from '@ihui/database'
import {
  checkDesktopPrefs,
  isDesktopPrefs,
  projectDesktopPrefsPayload,
  DESKTOP_PREFS_KEYS,
  type DesktopPrefs,
} from '@ihui/types'

const VALID: DesktopPrefs = {
  showTrayIcon: true,
  closeBehavior: 'ask',
  launchMinimized: false,
  traySingleClick: 'toggle_window',
  unreadBadge: true,
  trayMenuItems: ['open', 'settings'],
}

describe('① checkDesktopPrefs:jsonb 载荷的唯一判据', () => {
  it('合法载荷 ⇒ 通过,且回的是新建对象而不是入参引用', () => {
    const input = { ...VALID, trayMenuItems: [...VALID.trayMenuItems] }
    const result = checkDesktopPrefs(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual(VALID)
    // 不把调用方的数组引用留在返回值里:否则外部一 push,已校验的值就跟着变
    expect(result.value.trayMenuItems).not.toBe(input.trayMenuItems)
  })

  it('两个枚举档各自的全集都收(档位表改了这里就红)', () => {
    for (const closeBehavior of ['hide', 'quit', 'ask'] as const) {
      for (const traySingleClick of ['menu', 'toggle_window'] as const) {
        expect(checkDesktopPrefs({ ...VALID, closeBehavior, traySingleClick }).ok).toBe(true)
      }
    }
  })

  it('非对象 / 数组 / null 一律拒', () => {
    for (const bad of ['prefs', 42, null, undefined, [], ['showTrayIcon']]) {
      expect(checkDesktopPrefs(bad).ok).toBe(false)
    }
  })

  it('缺任意一个键都拒(半吊子载荷落库后,下一次读的人会以为默认值生效了)', () => {
    for (const key of DESKTOP_PREFS_KEYS) {
      const partial = { ...VALID } as Record<string, unknown>
      delete partial[key]
      const result = checkDesktopPrefs(partial)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toContain(key)
    }
  })

  it('多余键拒,且点名是哪一根', () => {
    const result = checkDesktopPrefs({ ...VALID, notAField: 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('notAField')
  })

  it('不做任何强转:"true" 不是布尔、1 不是布尔、null 不是布尔', () => {
    expect(checkDesktopPrefs({ ...VALID, showTrayIcon: 'true' }).ok).toBe(false)
    expect(checkDesktopPrefs({ ...VALID, unreadBadge: 1 }).ok).toBe(false)
    expect(checkDesktopPrefs({ ...VALID, launchMinimized: null }).ok).toBe(false)
    expect(checkDesktopPrefs({ ...VALID, closeBehavior: 'Ask' }).ok).toBe(false)
    expect(checkDesktopPrefs({ ...VALID, traySingleClick: 'toggle' }).ok).toBe(false)
    expect(checkDesktopPrefs({ ...VALID, trayMenuItems: ['ok', 7] }).ok).toBe(false)
  })

  it('isDesktopPrefs 是同一个判据的降格投影,不另立第二份真相', () => {
    expect(isDesktopPrefs(VALID)).toBe(true)
    expect(isDesktopPrefs({ ...VALID, extra: 1 })).toBe(false)
    for (const bad of [null, undefined, 'x', {}]) {
      expect(isDesktopPrefs(bad)).toBe(checkDesktopPrefs(bad).ok)
    }
  })
})

describe('② projectDesktopPrefsPayload:开关与载荷的关系只有一个答案', () => {
  it('没有行 ⇒ { enabled:false, prefs:null }(未登录/未开过漫游不是 404)', () => {
    expect(projectDesktopPrefsPayload(undefined)).toEqual({ enabled: false, prefs: null })
  })

  it('关着漫游 ⇒ 载荷一律 null,哪怕库里还躺着旧的(非权威值不得被读成权威)', () => {
    expect(projectDesktopPrefsPayload({ enabled: false, prefs: VALID })).toEqual({
      enabled: false,
      prefs: null,
    })
  })

  it('开着但载荷已不合法 ⇒ prefs 回 null,而 enabled 不替用户翻成 false', () => {
    expect(projectDesktopPrefsPayload({ enabled: true, prefs: { showTrayIcon: 'yes' } })).toEqual({
      enabled: true,
      prefs: null,
    })
  })

  it('开着且合法 ⇒ 带回归一后的那份', () => {
    expect(projectDesktopPrefsPayload({ enabled: true, prefs: VALID })).toEqual({
      enabled: true,
      prefs: VALID,
    })
  })
})

describe('③ schema 列集 ↔ 迁移 SQL 列集逐字同列', () => {
  const MIGRATION = fileURLToPath(
    new URL('../../../packages/database/drizzle/20260928120000_desktop_prefs.sql', import.meta.url),
  )
  const sql = readFileSync(MIGRATION, 'utf8')
  // 只取 CREATE TABLE 的列定义区(排除注释与那条 ALTER TABLE)
  const body = /CREATE TABLE "desktop_prefs" \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? ''
  const sqlColumns = [...body.matchAll(/^\s*"([a-z0-9_]+)"\s/gm)].map((m) => m[1])

  it('TS 侧每一列都在 SQL 里,且顺序一致(补列忘补迁移 = INSERT 直接炸)', () => {
    // 取"值是列对象"的那些自有属性,而不是 `.columns`:后者是 drizzle 在代理上给的访问器,
    // 经 workspace 链接解析到 `@ihui/database` 的 src 时那个代理不生效(实测 own keys 只有
    // 六列 + enableRLS,`.columns` 为 undefined)。自有属性这份是同一批列实例,顺序即声明顺序。
    const tsColumns = Object.entries(desktopPrefs)
      .filter(
        ([, v]) =>
          typeof v === 'object' && v !== null && typeof (v as { name?: unknown }).name === 'string',
      )
      .map(([, v]) => (v as { name: string }).name)
    expect(tsColumns).toContain('user_id')
    expect(sqlColumns.length).toBeGreaterThan(0)
    expect(sqlColumns).toEqual(tsColumns)
  })

  it('主键 = id,user_id 上那个唯一约束是 upsert 的冲突键', () => {
    expect(body).toMatch(/"id" uuid PRIMARY KEY/)
    expect(sql).toContain('CONSTRAINT "desktop_prefs_user_id_unique" UNIQUE("user_id")')
    expect(sql).toMatch(/ALTER TABLE "desktop_prefs" ADD CONSTRAINT .*FOREIGN KEY \("user_id"\)/)
  })
})
