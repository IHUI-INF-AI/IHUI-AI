// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-162 回归锁:数据清理声称「单批上限 50000 行」,实际 DELETE 无 LIMIT ⇒ 一次删光整表历史。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-162):
 *   POST /admin/relay/data-management/cleanup 的 SQL 为全表条件 DELETE(WHERE created_at < ...),
 *   无 LIMIT/分批 ⇒ 大表长事务、锁表与 WAL 膨胀,且不可回滚地一次删光历史;
 *   dryRun: z.coerce.boolean() 把字符串 "false"/"0" 解析为 true ⇒ 真实清理被当预览、误判;
 *   日志模板 `清理完成 table= keepDays= deleted=` 未插值 ⇒ 审计恒为空。
 *
 * 修复:DELETE 改 ctid 分批(LIMIT 单批上限,循环到删空);dryRun 改严格布尔 schema;
 *   日志补齐插值。本锁钉住三分支。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const routePath = resolve(REPO_ROOT, 'apps/api/src/routes/admin/relay-data-management.ts')
const src = readFileSync(routePath, 'utf8')

describe('F-162:数据清理 DELETE 必须分批、dryRun 必须严格布尔、日志必须插值', () => {
  it('接线锁:DELETE 走 ctid 分批 + LIMIT,不再全表条件一次删光', () => {
    // 修复痕迹:子查询按 ctid LIMIT 取批,外层 DELETE WHERE ctid IN (...)
    expect(src).toMatch(/ctid IN \(SELECT ctid/)
    expect(src).toMatch(/LIMIT \$\{BATCH\}/)
    // 存在单批上限常量(与注释「单批上限 50000」自述对齐)
    expect(src).toMatch(/BATCH = 50_000|BATCH = 50000/)
    // 循环到本批删空为止(batchDeleted < BATCH 退出)
    expect(src).toMatch(/if \(batchDeleted < BATCH\) break/)
  })

  it('行为锁:dryRun 改严格布尔 schema,不再 z.coerce.boolean() 把 "false" 解析为 true', () => {
    // 修复痕迹:改用共享严格布尔工具;且不得再用 z.coerce.boolean()
    expect(src).toMatch(/booleanStringSchemaOptional/)
    expect(src).not.toMatch(/dryRun:\s*z\.coerce\.boolean\(\)/)
    // 缺省视为 false
    expect(src).toMatch(/dryRun:\s*booleanStringSchemaOptional\.default\(false\)/)
  })

  it('行为锁:审计日志补齐插值(table/keepDays/deleted 不再为空模板)', () => {
    // 修复痕迹:日志模板占位符带变量取值,非裸 table= keepDays= deleted=
    expect(src).toMatch(/清理完成 table=\$\{meta\.table\} keepDays=\$\{keepDays\} deleted=\$\{deleted\}/)
    expect(src).not.toMatch(/清理完成 table= keepDays= deleted=`/)
  })

  it('接线锁:表名仍走白名单 sql.identifier,不拼接用户输入', () => {
    // 不得回退成字符串拼接表名
    expect(src).toMatch(/sql\.identifier\(meta\.table\)/)
    expect(src).toMatch(/v in CLEANABLE/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
