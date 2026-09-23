// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13 静态回归:受控出口的应用角色 + owner 策略「清单一致性」守门。
 *
 * 为什么只做静态断言:真实连库行为(超级用户是否绕过、策略是否恒真)需要活的
 * PostgreSQL **且**一条活的非超级用户连接,CI 里没有,也不允许拿生产库试
 * (AGENTS.md §5 测试隔离铁律)。所以这里机械挡住的是最容易出事、且纯静态就能判的那一类:
 *  1. 迁移与运维脚本(owner-rls.mjs)各写一份表/权限清单 → 迟早漂(本用例即镜像同步守门);
 *  2. "权限一把梭"回潮:GRANT ALL ON SCHEMA / 授了 DDL / 授了序列 / 授了 users;
 *  3. 角色属性被改回 SUPERUSER / BYPASSRLS —— 那会让整套 RLS 断言重新变成装饰;
 *  4. `ENABLE ROW LEVEL SECURITY` 被悄悄塞进迁移(应用侧上下文钉死之前开了就是全量 0 行);
 *  5. 幂等性破了(没先 DROP POLICY / 没 IF EXISTS)。
 * 全程只读文件系统,一条 SQL 都不下发。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { __test__ as ownerRls } from '../scripts/owner-rls.mjs'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION_PATH = resolve(PKG_DIR, 'drizzle', `${ownerRls.MIGRATION_TAG}.sql`)
const migrationSql = readFileSync(MIGRATION_PATH, 'utf8')

/** 去掉 `--` 行注释后的**正文**:注释里允许写 ENABLE / DROP POLICY(那是文档),正文不许失控。 */
const body = migrationSql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

/** 只出现在注释里的内容(取舍说明 + 激活与回滚清单)。 */
const commentLines = migrationSql
  .split(/\r?\n/)
  .filter((line) => line.trimStart().startsWith('--'))
  .join('\n')

/**
 * 从迁移正文里把 `specs` 那份 [表, 授权 DML, owner 谓词] 抠出来 ——
 * 它是唯一事实源;脚本那份必须与之逐项相等(下面第 4 个用例)。
 */
interface MigrationSpec {
  table: string
  privs: string[]
  ownerPredicate: string
}
function parseMigrationSpecs(sql: string): MigrationSpec[] {
  const out: MigrationSpec[] = []
  const re = /\[\s*'([a-z_][a-z0-9_]*)'\s*,\s*'([A-Z,]+)'\s*,\s*\$\$([\s\S]*?)\$\$\s*\]/g
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    const table = m[1]
    const privs = m[2]
    const predicate = m[3]
    if (!table || !privs || !predicate) continue
    out.push({
      table,
      // 迁移里写的是 SQL 关键字(大写),脚本清单里是策略名后缀(小写)—— 归一再比
      privs: privs.toLowerCase().split(','),
      ownerPredicate: predicate.replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}

const migrationSpecs = parseMigrationSpecs(body)
const scriptSpecs = ownerRls.OWNER_TABLES.map((t) => ({
  table: String(t.table),
  privs: t.privs.map((p) => String(p)),
  ownerPredicate: String(t.ownerPredicate).replace(/\s+/g, ' ').trim(),
}))

describe('O13 迁移 20260921160000:应用角色 + owner 策略', () => {
  it('迁移文件已登记进 journal(手写迁移不登记 = drizzle-kit migrate 静默跳过)', () => {
    const journal = JSON.parse(
      readFileSync(resolve(PKG_DIR, 'drizzle', 'meta', '_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string; idx: number; when: number }> }
    expect(journal.entries.some((e) => e.tag === ownerRls.MIGRATION_TAG)).toBe(true)
    // 2026-09-22 修:原断言「O13 必须是 journal 最后一条」只在下一次迁移落库之前成立 ——
    // 20260921200000_vip_levels_dedupe_unique 落库后它必然变红(存量红,与本迁移无关)。
    // 换成 drizzle-kit 真正依赖的结构不变量:`when` 恒升序 + `idx` 与位置一一对应。
    // 这比「排最后」更严:有人把迁移插到中间(导致 when 乱序)照样被拦下。
    const whens = journal.entries.map((e) => e.when)
    expect([...whens].sort((a, b) => a - b)).toEqual(whens)
    expect(journal.entries.every((e, i) => e.idx === i + 1)).toBe(true)
  })

  it('整份只有一个 dollar-quoted DO 块:任何语句分割器看到的都是单条语句', () => {
    expect(migrationSql).not.toMatch(/statement-breakpoint/)
    expect(body.match(/\bDO\s+\$o13\$/gi)?.length).toBe(1)
    expect(body).toMatch(/\$o13\$\s*;\s*$/)
    // 除这一个块之外正文不该剩任何语句
    expect(body.replace(/DO \$o13\$[\s\S]*\$o13\$\s*;/, '').trim()).toBe('')
  })

  it('角色属性:NOSUPERUSER + NOBYPASSRLS,CREATE 与"已存在则重刷"两条分支都钉住', () => {
    const createAttrs = body.match(/CREATE ROLE %I WITH ([^']*)'/)?.[1] ?? ''
    const alterAttrs = body.match(/ALTER ROLE %I WITH ([^']*)'/)?.[1] ?? ''
    expect(createAttrs).not.toBe('')
    expect(alterAttrs).not.toBe('')
    for (const attrs of [createAttrs, alterAttrs]) {
      for (const must of [
        'NOSUPERUSER',
        'NOBYPASSRLS',
        'NOINHERIT',
        'NOCREATEROLE',
        'NOCREATEDB',
        'LOGIN',
      ]) {
        expect(attrs, `角色属性缺 ${must}`).toContain(must)
      }
      // 密码不落仓;也不许出现裸 SUPERUSER(只允许 NOSUPERUSER)
      expect(attrs.toUpperCase()).not.toMatch(/\bPASSWORD\b/)
      expect(
        attrs.replace(/NO(SUPERUSER|BYPASSRLS|CREATEROLE|CREATEDB|INHERIT|REPLICATION)/g, ''),
      ).not.toMatch(/(^|\s)SUPERUSER/)
    }
  })

  it('不收"一把梭":schema 只给 USAGE,不给 DDL,不给序列', () => {
    expect(body).not.toMatch(/GRANT\s+ALL\s+(ON\s+SCHEMA|PRIVILEGES)/i)
    const schemaGrants = body.match(/GRANT[^']*ON SCHEMA[^']*/gi) ?? []
    expect(schemaGrants.length).toBeGreaterThan(0)
    for (const g of schemaGrants) expect(g.toUpperCase()).toContain('USAGE')
    // 先全清再逐表发:REVOKE 覆盖 tables / sequences / functions
    expect(body).toMatch(/REVOKE ALL ON SCHEMA public/i)
    expect(body).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA public/i)
    expect(body).toMatch(/REVOKE ALL ON ALL SEQUENCES IN SCHEMA public/i)
    expect(body).toMatch(/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public/i)
    expect(body).not.toMatch(/GRANT[^']*ON ALL SEQUENCES/i)
    expect(body).not.toMatch(/GRANT[^']*\bCREATE\b[^']*ON SCHEMA/i)
  })

  it('迁移 specs ↔ owner-rls.mjs 清单逐项相等(§22c:两份真相必漂,这里钉住)', () => {
    expect(migrationSpecs.length).toBeGreaterThan(0)
    expect(migrationSpecs).toEqual(scriptSpecs)
  })

  it('逐表逐 DML 授权:表名与 DML 都只可能来自 specs 那份清单(format 参数化)', () => {
    // 唯一的 GRANT 出口就是模板本身 —— 没有第二处硬编码 GRANT 能绕过清单
    const grantTemplates = body.match(/GRANT [A-Z,]+ ON TABLE public\.\w+/gi) ?? []
    expect(grantTemplates.length).toBe(0)
    expect(body).toMatch(/GRANT %s ON TABLE public\.%I TO %I/)
    // 而且只有这一条 GRANT ... ON TABLE 语句模板
    expect(body.match(/GRANT[^']*ON TABLE/gi)?.length).toBe(1)
  })

  it('不越清单授权:无 owner 列的共享表、未接线白名单表、users 一张都不给,且注释交代了为什么', () => {
    const neverGranted = [
      'content_generation_templates',
      'zhs_faq',
      'llm_call_logs',
      'agent_runs',
      'agent_checkpoints',
      'api_key_usage_windows',
      'webhook_delivery_logs',
      'audit_logs',
      'security_logs',
      'users',
    ]
    for (const table of neverGranted) {
      expect(
        migrationSpecs.some((s) => s.table === table),
        `不该进清单:${table}`,
      ).toBe(false)
      // 表名只能出现在注释(取舍说明)里,不能出现在正文任何一条语句里
      expect(body, `正文出现了不该授权的表 ${table}`).not.toContain(table)
      expect(commentLines.includes(table), `注释未说明 ${table} 的取舍`).toBe(true)
    }
  })

  it('owner 策略:先 DROP 再 CREATE、命名 <表>_owner_<dml>、DML 由清单派生而非另写一份', () => {
    expect(body).toContain(`DROP POLICY IF EXISTS %I ON public.%I`)
    expect(body).toContain(`t || '_owner_' || pol_kind`)
    // 策略种类 = string_to_array(privs):授权与策略在结构上不可能漂移
    expect(body).toMatch(/FOREACH pol_kind IN ARRAY string_to_array\(lower\(privs\), ','\)/)
    for (const kind of ['INSERT', 'UPDATE', 'DELETE', 'SELECT']) {
      expect(body, `缺 CREATE POLICY 分支:${kind}`).toContain(
        kind === 'UPDATE'
          ? 'CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)'
          : `CREATE POLICY %I ON public.%I FOR ${kind}`,
      )
    }
    // INSERT 只给 WITH CHECK、DELETE 只给 USING(反过来写就是外行)
    expect(body).toMatch(/FOR INSERT WITH CHECK \(%s\)/)
    expect(body).toMatch(/FOR DELETE USING \(%s\)/)
    expect(body).not.toMatch(/FOR INSERT USING/i)
    expect(body).not.toMatch(/FOR DELETE WITH CHECK/i)
  })

  it('策略谓词只认会话主体,不硬编码 UUID、不恒真;missing_ok=true 保证未设值时是拒绝而非报错', () => {
    expect(body).toContain(`current_setting('app.user_id', true)`)
    for (const spec of migrationSpecs) {
      expect(spec.ownerPredicate).toContain(`current_setting('app.user_id', true)`)
      expect(spec.ownerPredicate).toMatch(/::text = /)
    }
    expect(body).not.toMatch(/USING\s*\(\s*true\s*\)/i)
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  it('messages 用真实归属列(sender_id/receiver_id),不硬造 user_id,且只给读', () => {
    const messages = migrationSpecs.find((s) => s.table === 'messages')
    expect(messages?.privs).toEqual(['select'])
    expect(messages?.ownerPredicate).toContain('sender_id::text')
    expect(messages?.ownerPredicate).toContain('receiver_id::text')
    // 谓词里的**列**只有这两根;app.user_id 那个字符串是 GUC 名,不是列
    expect(messages?.ownerPredicate.replace(/current_setting\([^)]*\)/g, '')).not.toMatch(
      /user_id::text/,
    )
  })

  it('迁移**不执行**行级强制(应用侧上下文未钉死前,开了就是全量 0 行)', () => {
    expect(body.toUpperCase()).not.toContain('ENABLE ROW LEVEL SECURITY')
    expect(body.toUpperCase()).not.toContain('DISABLE ROW LEVEL SECURITY')
    expect(body).not.toMatch(/FORCE ROW LEVEL SECURITY/i)
    // 但注释必须把"为什么不开 / 怎么开"写清楚,并指向激活脚本
    expect(commentLines).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(commentLines).toContain('owner-rls.mjs')
    expect(commentLines).toMatch(/FORCE/)
  })

  it('回滚清单齐备:每条建出来的策略都有对应 DROP POLICY,角色回收也在内', () => {
    for (const spec of migrationSpecs) {
      for (const kind of spec.privs) {
        const name = ownerRls.policyNameOf(spec.table, kind)
        expect(commentLines, `回滚清单缺:${name}`).toContain(`DROP POLICY IF EXISTS "${name}"`)
      }
    }
    expect(commentLines).toContain('DROP ROLE IF EXISTS')
    expect(commentLines).toMatch(/DATABASE_APP_URL/)
  })
})

describe('O13 owner-rls.mjs:生成的 SQL 与判据', () => {
  it('幂等:ENABLE/DISABLE 是纯 ALTER,DROP POLICY 全带 IF EXISTS', () => {
    for (const spec of scriptSpecs) {
      expect(ownerRls.enableSqlOf(spec.table)).toBe(
        `ALTER TABLE "${spec.table}" ENABLE ROW LEVEL SECURITY`,
      )
      expect(ownerRls.disableSqlOf(spec.table)).toBe(
        `ALTER TABLE "${spec.table}" DISABLE ROW LEVEL SECURITY`,
      )
      const drops = ownerRls.dropPoliciesOf(spec.table, spec.privs)
      expect(drops.length).toBe(spec.privs.length)
      for (const s of drops) expect(s).toContain('DROP POLICY IF EXISTS')
    }
  })

  it('catalog 判据只读:常量 SQL 全是 SELECT,标识符一律走参数', () => {
    const texts = Object.values(ownerRls.CATALOG_SQL as Record<string, string>)
    expect(texts.length).toBeGreaterThan(0)
    for (const sqlText of texts) {
      expect(sqlText.trimStart().toLowerCase().startsWith('select'), sqlText).toBe(true)
      expect(sqlText).not.toMatch(
        /\b(insert|update|delete|create|drop|alter|grant|revoke|truncate)\b/i,
      )
      expect(sqlText).not.toContain('ihui_app')
    }
    expect(ownerRls.CATALOG_SQL.role).toContain('$1')
    expect(ownerRls.CATALOG_SQL.grants).toContain('$2')
  })

  it('清单里的每张表在脚本侧也只有 DML 权限,且都落在迁移正文里', () => {
    for (const spec of scriptSpecs) {
      for (const kind of spec.privs) {
        expect(['select', 'insert', 'update', 'delete']).toContain(kind)
      }
      expect(body).toContain(spec.table)
    }
  })

  it('isDirectRun 为假时不触发 main(§22d:被 import 不得连库)', () => {
    // 本文件本身就是"被 import"的形态:能跑到这里就说明 main() 没执行、没连库
    expect(ownerRls.isDirectRun).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
