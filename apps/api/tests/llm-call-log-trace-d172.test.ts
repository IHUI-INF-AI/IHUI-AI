// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D172(2026-09-29 立):provider 调用流水表的 **trace 关联键** 契约。
 *
 * 这一票守的是两格,各自都有过"账面全绿而实际为空"的前科:
 *  ① **取值出口的判据**(traceparent → 可用作等值键的 trace id,或老实返回 null);
 *  ② **三件必须同形的登记**(schema 列 / 迁移 .sql / journal 条目)—— 少任何一件,
 *     要么代码读写一个库里不存在的列,要么迁移应用了而 schema 不知道,两种都不报错。
 *
 * 刻意**不**在这里断言"库里真有这一列":本机 PG 是真实开发库,§5 测试隔离铁律禁止用例
 * 对它有副作用;到端生效由 `scripts/check-migration-from-zero.mjs`(一次性空库全链重放)
 * 与守门 49 的账本对账负责。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FastifyRequest } from 'fastify'
import { getTableColumns } from 'drizzle-orm'
import { llmCallLogs } from '@ihui/database'
import { traceIdFromRequest } from '../src/utils/trace-context.js'

/** 伪造一个只用到 headers 的 request(本判据只读 traceparent 这一项)。 */
const req = (traceparent?: string | string[]): FastifyRequest =>
  ({ headers: traceparent === undefined ? {} : { traceparent } }) as unknown as FastifyRequest

/** 仓库根由**向上找 pnpm-workspace.yaml** 定位 —— 不写死盘符,也不假设 vitest 的 cwd。 */
function repoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir
    const up = resolve(dir, '..')
    if (up === dir) break
    dir = up
  }
  throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 本测试的三件对账无从取数')
}

describe('D172 ① traceIdFromRequest:只有"能当等值键"才返回 id', () => {
  it('合法 W3C traceparent ⇒ 取出 32 位 trace id', () => {
    const tp = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
    expect(traceIdFromRequest(req(tp))).toBe('0af7651916cd43dd8448eb211c80319c')
  })

  /**
   * PG 的等值比较区分大小写,而 W3C 规定 trace id 是小写十六进制。
   * 不归一 = 同一个编号在表里存成两种形状、按其一查不到另一条(排查时正是等值命中)。
   */
  it('大写形态归一为小写(同一个 trace 只能有一个键形状)', () => {
    const tp = '00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-01'
    expect(traceIdFromRequest(req(tp))).toBe('0af7651916cd43dd8448eb211c80319c')
  })

  it('缺头 / 头是数组 / 非法形态 ⇒ null(不猜、不造一个看起来像的)', () => {
    expect(traceIdFromRequest(req())).toBeNull()
    // 同名重复头时"哪一条是本轮的"没有定义 ⇒ 刻意不取第一条
    expect(
      traceIdFromRequest(req(['00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01', 'x'])),
    ).toBeNull()
    expect(traceIdFromRequest(req('00-deadbeef-01'))).toBeNull() // 段数不对
    expect(traceIdFromRequest(req('00-zzz-aaaaaaaaaaaaaaaa-01'))).toBeNull() // 非十六进制
    expect(traceIdFromRequest(req('00-abc-aaaaaaaaaaaaaaaa-01'))).toBeNull() // 长度不对
    expect(traceIdFromRequest(null)).toBeNull()
    expect(traceIdFromRequest(undefined)).toBeNull()
  })

  /**
   * 全 0 的 trace id 按 W3C 表示"没有 trace",而本地那把宽松解析器只看"32 位 hex"。
   * 落库层必须拒绝它:存进去等于给一批互不相关的调用发**同一个**编号,反查必然串台。
   * 这条用例同时是"本出口比 parseTraceparent 更严"的证明 —— 有人在出口里放宽判据即红。
   */
  it('全 0 trace id ⇒ null(非法值不配当关联键)', () => {
    const tp = `00-${'0'.repeat(32)}-b7ad6b7169203331-01`
    expect(traceIdFromRequest(req(tp))).toBeNull()
  })
})

describe('D172 ② 列 / 迁移 / journal 三件同形', () => {
  const MIGRATION_TAG = '20260929120000_llm_call_logs_trace_id'

  it('schema 声明了 trace_id 列,且长度为 32(与"只接受已验形 id"的写入口同判据)', () => {
    const cols = getTableColumns(llmCallLogs) as Record<string, { name: string }>
    const col = Object.values(cols).find((c) => c.name === 'trace_id')
    expect(col, 'llm_call_logs 必须声明 trace_id 列').toBeTruthy()
    const src = readFileSync(
      resolve(repoRoot(), 'packages/database/src/schema/llm-call-logs.ts'),
      'utf8',
    )
    // 判据取"这一列的声明原文"而不是全文出现次数:varchar(32) 在别的列上也合法。
    const decl = /traceId:\s*varchar\('trace_id',\s*\{\s*length:\s*32\s*\}\s*\)/.exec(src)
    expect(decl, "schema 里 trace_id 必须是 varchar(32)(改长度要同时改迁移与写入口判据)").toBeTruthy()
  })

  it('迁移文件在册,且做幂等写法(O18 那型:裸 ADD COLUMN 会让空库重放中途炸)', () => {
    const root = repoRoot()
    const file = resolve(root, `packages/database/drizzle/${MIGRATION_TAG}.sql`)
    expect(existsSync(file), `迁移文件缺失:${MIGRATION_TAG}.sql`).toBe(true)
    const sql = readFileSync(file, 'utf8')
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "trace_id"/)
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS "llm_call_logs_trace_idx"/)
    expect(sql).toMatch(/WHERE "trace_id" IS NOT NULL/) // partial index:历史 NULL 行不进索引
  })

  it('journal 有该 tag 的条目,且 when 严格大于前一条(守门 49 的 B3 判据)', () => {
    const root = repoRoot()
    const journal = JSON.parse(
      readFileSync(resolve(root, 'packages/database/drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; when: number; tag: string }[] }
    const i = journal.entries.findIndex((e) => e.tag === MIGRATION_TAG)
    expect(i, `journal 里没有 ${MIGRATION_TAG} 条目`).toBeGreaterThan(-1)
    if (i > 0) {
      const prev = journal.entries[i - 1] as { when: number }
      const cur = journal.entries[i] as { when: number; idx: number; tag: string }
      expect(cur.when).toBeGreaterThan(prev.when)
      expect(cur.idx).toBe((prev as { idx: number }).idx + 1)
    }
  })

  /**
   * 装车证明(本仓最高频失效型就是"造好了没装车"):三处落库点必须**真的**把 id 递进去,
   * 而不是只有列和出口。判据点名到具体写法,防"写了个不读的变量"。
   */
  it('三个 llm_call_logs 写入点都在递 traceId(源码面)', () => {
    const root = repoRoot()
    const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')
    expect(read('apps/api/src/routes/other/llm-stream-routes.ts')).toMatch(
      /traceId:\s*traceIdFromRequest\(request\)/,
    )
    expect(read('apps/api/src/routes/admin/relay-channels.ts')).toMatch(
      /traceId:\s*traceIdFromRequest\(request\)/,
    )
    expect(read('apps/api/src/services/relay-billing-service.ts')).toMatch(
      /traceId:\s*resolveTraceId\(input\.traceId\)/,
    )
  })

  /**
   * 反向锁:落库侧不得出现第二份 traceparent 解析(split('-') / 判长 32)。
   * 两处算同一件事必漂移 —— 本仓记过多次,而漂移的表现是"两边都绿、值不一样"。
   */
  it('写入点文件里没有自建 traceparent 解析', () => {
    const root = repoRoot()
    for (const rel of [
      'apps/api/src/routes/other/llm-stream-routes.ts',
      'apps/api/src/routes/admin/relay-channels.ts',
      'apps/api/src/services/relay-billing-service.ts',
    ]) {
      const src = readFileSync(resolve(root, rel), 'utf8')
      expect(src, `${rel} 不得自己 split traceparent`).not.toMatch(/traceparent['"]\]?.split\(/)
      expect(src, `${rel} 应经唯一出口`).toMatch(/trace-context\.js|traceIdFromRequest/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
