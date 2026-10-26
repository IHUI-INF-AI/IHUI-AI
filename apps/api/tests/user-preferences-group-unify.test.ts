// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 单/复数收口(2026-10-18)的零连接回归锁 —— 不碰生产库(禁止连 PG 8810)。
//
// 这里判的是"收口这件事有没有回潮",不是"函数跑没跑通":
//   ① group 取值唯一出口 USER_PREFERENCE_GROUPS 只有复数,单数 'notification' 不得再作为一个取值存在;
//   ② compat 路由不再写裸 group 字面量(读/写都取自常量),且不再回 { settings } 而改回 { list };
//   ③ compat PUT 用 .returning 回库确认写入集合并带 missedIds(守门 134),不把请求侧 length 当 affected;
//   ④ language/theme 仍落复数 'preferences'(这一族本就正确,收口不得把它误当分叉改掉);
//   ⑤ 权威腿 settings-routes 与 compat 共用同一常量出口;
//   ⑥ 迁移件 + journal 齐备,且迁移正文把冲突规则(updated_at 较新者胜)与三计数 RAISE NOTICE 写死。
// 迁移的**行为**(迁前两份分叉、迁后一份 / 冲突收敛)在另一枚 real 用例里对着测试库跑;本机无测试库 ⇒
// 那枚 describe.skip,如实"未执行",不在此文件里冒绿。

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// 常量出口本身不需要连接池;mock 掉 db/index.js 以免 import 期读取 DATABASE_* 配置或建池。
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {}, dbScoped: {} }))

const here = dirname(fileURLToPath(import.meta.url))
// apps/api/tests → repo 根
const repoRoot = resolve(here, '../../..')
const readSrc = (rel: string): string => readFileSync(resolve(repoRoot, rel), 'utf8')

const compatPath = 'apps/api/src/routes/miniapp-compat-routes.ts'
const settingsPath = 'apps/api/src/routes/user/settings-routes.ts'
const queriesPath = 'apps/api/src/db/user-preferences-queries.ts'
const migrationPath =
  'packages/database/drizzle/20261018150000_user_preferences_notification_group_plural.sql'
const journalPath = 'packages/database/drizzle/meta/_journal.json'

const { USER_PREFERENCE_GROUPS } = await import('../src/db/user-preferences-queries.js')

describe('USER_PREFERENCE_GROUPS 单一真相源:通知族只有复数', () => {
  it('notifications 取复数,且不存在单数取值', () => {
    expect(USER_PREFERENCE_GROUPS.notifications).toBe('notifications')
    expect(Object.values(USER_PREFERENCE_GROUPS)).not.toContain('notification')
  })

  it('词表覆盖 schema 自述的分组(notifications/privacy/preferences/devices)', () => {
    for (const g of ['notifications', 'privacy', 'preferences', 'devices'] as const) {
      expect(USER_PREFERENCE_GROUPS[g]).toBe(g)
    }
  })
})

describe('compat 路由收口:读写都取自常量、形状对齐端上 list、PUT 计数诚实', () => {
  const src = readSrc(compatPath)

  it('不再出现裸的单数 group 字面量', () => {
    expect(src).not.toContain("group: 'notification'")
    expect(src).not.toContain("group, 'notification')")
  })

  it('读/写通知偏好都引用常量出口', () => {
    expect(src).toContain('USER_PREFERENCE_GROUPS.notifications')
  })

  it('GET 回 { list } 而非 { settings }(端上契约形状)', () => {
    expect(src).toContain('success({ list })')
    // 该路由体里不得再有 Object.fromEntries 造 settings 的旧形状
    expect(src).not.toContain(
      'const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))',
    )
  })

  it('PUT 用 .returning 回库确认集合并回 missedIds(守门 134)', () => {
    expect(src).toContain('.returning({ id: userPreferences.id, key: userPreferences.key })')
    expect(src).toContain('missedIds')
    // 不得再把请求侧 length 当 affected,也不得无条件回 { success: true }
    expect(src).not.toContain('success({ success: true })')
  })

  it('language/theme 仍落复数 preferences 常量(不得被误改)', () => {
    expect(src).toContain('USER_PREFERENCE_GROUPS.preferences')
    expect(src).not.toContain("group: 'preferences'")
  })
})

describe('权威腿 settings-routes 与 compat 共用同一常量出口', () => {
  const src = readSrc(settingsPath)
  /**
   * 判"调用形态"用的归一:压掉全部空白,并去掉闭括号前的尾逗号。
   *
   * 原因:prettier printWidth=100,而
   * `findUserPreferences(request.userId!, USER_PREFERENCE_GROUPS.notifications)` 单行是 101 列
   * ⇒ prettier 必然把它折成多行(现读 settings-routes.ts:42-45 就是折行形态,折行后源码里
   * 留下 `notifications,)` 这种带尾逗号的写法)⇒ 拿单行子串去判,判到的是**排版**不是**语义**。
   * 反向断言更吃亏:裸字面量只要折行就判不出来 ⇒ 漏放(判据自己先失效)。
   * 归一后判的仍是同一件事:通知读腿取的是常量、不是裸字面量。
   */
  const flat = (s: string): string => s.replace(/\s+/g, '').replace(/,\)/g, ')')
  const flatSrc = flat(src)

  it('import 了 USER_PREFERENCE_GROUPS', () => {
    expect(src).toContain('USER_PREFERENCE_GROUPS')
  })

  it('通知读腿取复数常量,旧裸字面量调用形态已消除', () => {
    expect(flatSrc).toContain(
      flat('findUserPreferences(request.userId!, USER_PREFERENCE_GROUPS.notifications)'),
    )
    expect(flatSrc).not.toContain(flat("findUserPreferences(request.userId!, 'notifications')"))
  })

  it('清数据腿对通知族取常量,不再写裸复数字面量', () => {
    expect(flatSrc).toContain(
      flat('deleteUserPreferencesByGroup(userId, USER_PREFERENCE_GROUPS.notifications)'),
    )
    expect(flatSrc).not.toContain(flat("deleteUserPreferencesByGroup(userId, 'notifications')"))
  })
})

describe('查询层常量文件与迁移件/journal 齐备', () => {
  it('queries 文件导出常量且值全为复数', () => {
    const src = readSrc(queriesPath)
    expect(src).toContain('export const USER_PREFERENCE_GROUPS')
    expect(src).toContain("notifications: 'notifications'")
    expect(src).not.toMatch(/notification:\s*'notification'/)
  })

  it('迁移件存在,并把冲突规则(较新者胜)与三计数写死', () => {
    const sqlText = readSrc(migrationPath)
    expect(sqlText).toContain('WHERE "group" = \'notification\'')
    expect(sqlText).toContain("'notifications'")
    // 冲突裁决:严格比较 updated_at,较新者胜
    expect(sqlText).toMatch(/r\.updated_at > n\.updated_at/)
    // 不许静默:三条计数现报
    expect(sqlText).toContain('RAISE NOTICE')
    for (const c of ['migrated', 'conflicts', 'dropped']) expect(sqlText).toContain(c)
    // 幂等:游标只圈单数行(跑完即空)
    expect(sqlText).toMatch(/FOR r IN[\s\S]*'notification'/)
  })

  it('journal 登记了该迁移,tag 与 when 齐备且严格递增', () => {
    const journal = JSON.parse(readSrc(journalPath)) as {
      entries: { idx: number; when: number; tag: string }[]
    }
    const entries = journal.entries
    const mine = entries.find(
      (e) => e.tag === '20261018150000_user_preferences_notification_group_plural',
    )
    expect(mine).toBeTruthy()
    const prev = entries[entries.indexOf(mine!) - 1]
    expect(mine!.when).toBeGreaterThan(prev.when)
    expect(mine!.idx).toBe(prev.idx + 1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
