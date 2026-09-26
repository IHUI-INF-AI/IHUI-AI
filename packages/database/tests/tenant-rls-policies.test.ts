// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13 第一格的回归面:租户 RLS 迁移的策略文本对账。
 *
 * 判据**不在这里**写第二份 —— 全部从 `scripts/tenant-rls-policy-check.mjs` import
 * (AGENTS.md §22c:测试里复制实现 = 两份真相,源改了就假绿)。本文件负责的是
 * "跑在被审文件上 + 反例真的会红"这两件事,以及一条别的测试容易漏的方向:
 * **纳管清单本身不能是空表**(空清单会让所有逐表判据集体"通过")。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  __test__ as tenantRlsCheck,
  TENANT_RLS_TABLES,
} from '../scripts/tenant-rls-policy-check.mjs'

const {
  MIGRATION_TAG,
  MIGRATION_PATH,
  REQUIRED_POLICY_SUFFIXES,
  ALLOWED_GUCS,
  stripLineComments,
  parsePolicies,
  checkTenantRlsMigration,
} = tenantRlsCheck

const migrationSql = readFileSync(MIGRATION_PATH, 'utf8')
const journalJson = readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')
const verdict = checkTenantRlsMigration(migrationSql, journalJson)

describe('O13 迁移 20260927100000:租户面行级策略第一批', () => {
  it('纳管清单非空,且不超过本票的 12 张上限', () => {
    expect(TENANT_RLS_TABLES.length).toBeGreaterThan(0)
    expect(TENANT_RLS_TABLES.length).toBeLessThanOrEqual(12)
    const names = TENANT_RLS_TABLES.map((t) => t.table)
    expect(new Set(names).size).toBe(names.length)
    // 每张表都必须自带"为什么它可以进第一批"的理由 —— 清单不是名字堆
    for (const t of TENANT_RLS_TABLES) expect(t.why.length).toBeGreaterThan(10)
  })

  it('真迁移文本必须 0 问题(正向:判据不冤枉正当写法)', () => {
    expect(verdict.problems, verdict.problems.slice(0, 5).join('\n     ')).toEqual([])
  })

  it('策略族齐备:每张表 4 条租户策略 + 1 条旁路,一条不多一条不少', () => {
    const code = stripLineComments(migrationSql)
    const policies = parsePolicies(code)
    expect(policies.length).toBe(TENANT_RLS_TABLES.length * REQUIRED_POLICY_SUFFIXES.length)
    for (const { table } of TENANT_RLS_TABLES) {
      const names = policies.filter((p) => p.table === table).map((p) => p.name)
      for (const suffix of REQUIRED_POLICY_SUFFIXES) {
        expect(names, `${table} 缺 ${suffix}`).toContain(`${table}_${suffix}`)
      }
    }
  })

  it('会话变量契约只有两个在册名字,且都在用(不复活 0214 留下的死名字)', () => {
    expect(ALLOWED_GUCS).toEqual(['app.user_id', 'app.bypass_rls'])
    const used = new Set([...stripLineComments(migrationSql).matchAll(/current_setting\(\s*'([^']+)'/g)].map((m) => m[1]))
    expect([...used].sort()).toEqual([...ALLOWED_GUCS].sort())
    expect(migrationSql).toContain('app.tenant_id') // 只允许出现在注释里(解释为什么不用它)
    expect(stripLineComments(migrationSql)).not.toMatch(/app\.tenant_id/)
  })

  it('本迁移不改任何角色属性(ALTER ROLE 是第三格)', () => {
    const code = stripLineComments(migrationSql)
    expect(code).not.toMatch(/ALTER\s+ROLE/i)
    expect(code).not.toMatch(/CREATE\s+ROLE/i)
    expect(code).not.toMatch(/BYPASSRLS/i)
    expect(code).not.toMatch(/^\s*GRANT\s/mi)
  })

  it('反例逐条对照:每条判据都必须"能红",且红在该判据上(§22c:只有正向断言的测试等于没写)', () => {
    const red = (mutated, expectFragment, label) => {
      const r = checkTenantRlsMigration(mutated, journalJson)
      expect(r.problems.length, `${label}: 期望判红`).toBeGreaterThan(0)
      expect(r.problems.join('\n'), label).toContain(expectFragment)
    }
    // 只改代码面:头注释里也写着这些字样,打在注释上的变异会被剥注释后当成"没改"。
    red(
      migrationSql.replace('FOR SELECT TO PUBLIC\n  USING (public."team_knowledge_space_visible"', 'FOR SELECT\n  USING (public."team_knowledge_space_visible"'),
      '缺 TO 子句',
      'N1 漏写 TO 子句',
    )
    red(
      migrationSql.replace(
        'USING ("user_id"::text = current_setting(\'app.user_id\', true))\n  WITH CHECK ("user_id"::text = current_setting(\'app.user_id\', true));',
        'USING (true)\n  WITH CHECK ("user_id"::text = current_setting(\'app.user_id\', true));',
      ),
      '空壳',
      'N2 USING(true) 空壳',
    )
    red(
      migrationSql.replace('ALTER TABLE public."notes" FORCE ROW LEVEL SECURITY;', '-- x;'),
      '不成对',
      'N3 抽掉一张表的 FORCE',
    )
    red(
      migrationSql.replace(/DROP POLICY IF EXISTS "user_memories_tenant_update"[\s\S]*?statement-breakpoint[\s\S]*?statement-breakpoint/, ''),
      '缺策略 user_memories_tenant_update',
      'N4 抽掉一整个策略块',
    )
    red(
      migrationSql.replace(
        'USING ("owner_uuid" = current_setting(\'app.user_id\', true));',
        'USING (current_setting(\'app.current_user_role\', true) IN (\'1\',\'2\',\'3\') OR "owner_uuid" = current_setting(\'app.user_id\', true));',
      ),
      'app.current_user_role',
      'N5 靠会话变量的管理员放行',
    )
    red(
      migrationSql.replace("current_setting('app.user_id', true)", "current_setting('app.org_id', true)"),
      '未在契约里的会话变量',
      'N6 新造第三个会话变量名',
    )
    red(
      migrationSql.replace('SECURITY INVOKER\nSET search_path', 'SECURITY DEFINER\nSET search_path'),
      'SECURITY DEFINER',
      'N7 判定函数提权',
    )
    red(
      migrationSql.replace(/\nSET search_path TO pg_catalog, public/g, ''),
      '未固定 search_path',
      'N8 判定函数不固定 search_path',
    )
    red(
      migrationSql.replace('DROP POLICY IF EXISTS "notes_tenant_select" ON public."notes";--> statement-breakpoint\n', ''),
      'DROP POLICY IF EXISTS',
      'N9 CREATE 前缺 DROP ⇒ 不可重放',
    )
    red(
      migrationSql + '\nCREATE POLICY "tenants_tenant_select" ON public."tenants" FOR SELECT TO PUBLIC USING ("owner_id"::text = current_setting(\'app.user_id\', true));',
      '清单外的表',
      'N11 清单外的表被建策略',
    )
    const notRegistered = checkTenantRlsMigration(migrationSql, journalJson.replace(`"tag": "${MIGRATION_TAG}"`, '"tag": "other_tag"'))
    expect(notRegistered.problems.join('\n')).toContain('未登记')
    const empty = checkTenantRlsMigration('', journalJson)
    expect(empty.problems.length).toBeGreaterThan(0)
    expect(empty.undetermined.length).toBeGreaterThan(0)
  })

  it('journal 结构不变量:when 严格递增、idx 与位置一一对应(门 49 之外的本包自检)', () => {
    const entries = JSON.parse(journalJson).entries
    expect(Array.isArray(entries) && entries.length).toBeGreaterThan(0)
    const whens = entries.map((e) => e.when)
    expect([...whens].sort((a, b) => a - b)).toEqual(whens)
    for (let i = 1; i < whens.length; i += 1) expect(whens[i] > whens[i - 1]).toBe(true)
    expect(entries.every((e, i) => e.idx === i + 1)).toBe(true)
    expect(entries[entries.length - 1].tag).toBe(MIGRATION_TAG)
  })

  it('本判据不判求值结果:未覆盖方向必须被打印出来(禁止"扫到 0 条"当成通过)', () => {
    expect(verdict.undetermined.length).toBeGreaterThanOrEqual(3)
    expect(verdict.undetermined.join('\n')).toContain('策略**求值结果**')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
