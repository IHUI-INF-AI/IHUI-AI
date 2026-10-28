// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 迁移行为用例:把 compat 单数 group='notification' 的存量并入复数 —— 正向对照 + 冲突收敛。
//
// 铁律:测试禁止连生产库(PG 8810)。本用例只连**显式提供的非生产测试库** URL,
// 未提供 IHUI_TEST_DB_URL 时整组 describe.skip ⇒ 如实"未执行"(§0.3:不记绿也不冒红),
// 绝不去 import 默认 db/index.js(那条会读生产配置)。
//
// 覆盖:
//   正向对照:迁前同一 (user_id,key) 在单数/复数各一份(分叉)、迁后只剩一份;
//   冲突收敛:较新者胜 —— 复数较新 ⇒ 留复数删单数;单数严格较新 ⇒ 改判复数删旧复数;
//   无对照:仅单数行 ⇒ 直接并入复数;
//   幂等:再跑一次不产生任何变化。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const TEST_URL = process.env.IHUI_TEST_DB_URL?.trim()
const suite = TEST_URL ? describe : describe.skip

const here = dirname(fileURLToPath(import.meta.url))
const migrationPath = resolve(
  here,
  '../../../packages/database/drizzle/20261018150000_user_preferences_notification_group_plural.sql',
)

const U = '11111111-1111-4111-8111-111111111111'
const V = '22222222-2222-4222-8222-222222222222'

type Client = {
  unsafe: (sql: string) => Promise<Array<Record<string, unknown>>>
  end: () => Promise<void>
}

suite('迁移行为:notification→notifications 冲突收敛(需 IHUI_TEST_DB_URL)', () => {
  let client: Client

  beforeAll(async () => {
    const mod = (await import('postgres')) as unknown as {
      default: (url: string, opts?: Record<string, unknown>) => Client
    }
    client = mod.default(TEST_URL as string, { max: 1 })
    // 独立建最小表(不带 FK,只为本 DO 块服务);列与 schema/user-preferences.ts 对齐
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        "group" varchar(50) NOT NULL,
        "key" varchar(100) NOT NULL,
        value text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT user_preferences_user_group_key_unique UNIQUE (user_id, "group", "key")
      );
    `)
    await client.unsafe('DELETE FROM user_preferences')
  })

  afterAll(async () => {
    if (client) await client.end()
  })

  it('正向对照 + 冲突收敛:较新者胜、仅单数者并入、迁后无单数残留', async () => {
    // 播种(迁前分叉):
    //   U.pushEnabled: 单数旧(2020) + 复数新(2026) ⇒ 复数胜,删单数
    //   U.emailEnabled: 只有单数 ⇒ 直接并入复数
    //   V.smsEnabled:   单数新(2026) + 复数旧(2020) ⇒ 单数改判复数、删旧复数(保住用户最新值)
    await client.unsafe(`
      INSERT INTO user_preferences (user_id, "group", "key", value, updated_at) VALUES
        ('${U}', 'notification', 'pushEnabled', 'true',  '2020-01-01T00:00:00Z'),
        ('${U}', 'notifications','pushEnabled', 'false', '2026-01-01T00:00:00Z'),
        ('${U}', 'notification', 'emailEnabled','true',  '2020-01-01T00:00:00Z'),
        ('${V}', 'notification', 'smsEnabled',  'true',  '2026-01-01T00:00:00Z'),
        ('${V}', 'notifications','smsEnabled',  'false', '2020-01-01T00:00:00Z');
    `)

    const sqlText = readFileSync(migrationPath, 'utf8')
    await client.unsafe(sqlText)

    // 迁后:单数族彻底清空
    const remaining = await client.unsafe(
      `SELECT count(*)::int AS c FROM user_preferences WHERE "group" = 'notification'`,
    )
    expect(remaining[0]?.c).toBe(0)

    // U.pushEnabled 剩一份,取复数胜者的值(false)
    const uPush = await client.unsafe(
      `SELECT "group", value FROM user_preferences WHERE user_id='${U}' AND "key"='pushEnabled'`,
    )
    expect(uPush.length).toBe(1)
    expect(uPush[0]?.group).toBe('notifications')
    expect(uPush[0]?.value).toBe('false')

    // U.emailEnabled 并入复数(只有过单数)
    const uEmail = await client.unsafe(
      `SELECT "group", value FROM user_preferences WHERE user_id='${U}' AND "key"='emailEnabled'`,
    )
    expect(uEmail.length).toBe(1)
    expect(uEmail[0]?.group).toBe('notifications')
    expect(uEmail[0]?.value).toBe('true')

    // V.smsEnabled 单数较新者胜:剩一份复数,值是单数那份(true)
    const vSms = await client.unsafe(
      `SELECT "group", value FROM user_preferences WHERE user_id='${V}' AND "key"='smsEnabled'`,
    )
    expect(vSms.length).toBe(1)
    expect(vSms[0]?.group).toBe('notifications')
    expect(vSms[0]?.value).toBe('true')
  })

  it('幂等:再跑一次不改变任何行', async () => {
    await client.unsafe('DELETE FROM user_preferences')
    await client.unsafe(`
      INSERT INTO user_preferences (user_id, "group", "key", value, updated_at) VALUES
        ('${U}', 'notification', 'pushEnabled', 'true', '2020-01-01T00:00:00Z');
    `)
    const sqlText = readFileSync(migrationPath, 'utf8')
    await client.unsafe(sqlText)
    const before = await client.unsafe(
      `SELECT count(*)::int AS c FROM user_preferences WHERE "group"='notifications' AND user_id='${U}'`,
    )
    await client.unsafe(sqlText) // 第二次:游标为空,无副作用
    const after = await client.unsafe(
      `SELECT count(*)::int AS c FROM user_preferences WHERE "group"='notifications' AND user_id='${U}'`,
    )
    expect(after[0]?.c).toBe(before[0]?.c)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
