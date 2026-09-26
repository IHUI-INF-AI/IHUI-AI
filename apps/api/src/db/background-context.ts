// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13 第三格前置(2026-09-27):「运维 / 后台上下文」的**唯一出口**。
 *
 * 要解决的问题:生产连接角色 `ihui` 目前带 `rolbypassrls=t`,RLS 策略对它是装饰;
 * 第三格执行 `ALTER ROLE ihui NOBYPASSRLS` 后,**所有不设上下文的查询**在
 * `20260927100000_tenant_rls_policies_batch1.sql` 里 ENABLE+FORCE 成对的 8 张表
 * (team_knowledge_spaces / team_knowledge_items / team_knowledge_revisions /
 *  zhs_knowledge_doc / zhs_knowledge_chunk / user_memories / image_gen_favorites / notes)
 * 上会看到 0 行 —— worker / 定时器 / 维护脚本 / 导入导出不走 HTTP,拿不到 app.user_id,
 * 它们需要的不是"归属谓词"而是那条策略 OR 分支(**`app.bypass_rls=true` 的运维通道**)。
 *
 * 为什么是"事务 + SET LOCAL"而不是"SET 会话级 + 归还前 RESET":
 *   `plugins/rls-context.ts` 用的是 `set_config(..., false)`(会话级),而
 *   `db/index.ts:204` 起自己写着「Drizzle 内部自动管理连接(不暴露 acquire/release 钩子)」
 *   —— 池里根本没有"归还前 RESET"这个挂点,会话级 GUC 会顺着连接被下一个使用者继承。
 *   本出口走 `withBypassRls`(@ihui/database):`db.transaction()` 让 postgres.js 把整段
 *   钉在**同一条物理连接**上,`set_config('app.bypass_rls','true', true)` 第三参 is_local=true
 *   ⇒ 事务 COMMIT/ROLLBACK 的瞬间 GUC 自动失效,**复位点由事务边界保证,不依赖 release 钩子**。
 *   结构性后果:作用域内只能经 `tx` 发查询;若有人误用外层 `db`,那条查询落在**另一条**
 *   没设 GUC 的连接上 ⇒ 看见 0 行 —— 失效方向是"少放行"(窄),永不"多放行"(宽)。
 *   真库回归 `tests/o13-bg-rls-live.test.ts` 把这一点判成可证伪断言:作用域结束后,
 *   同池(max=1,必然同一条连接)再读必须回到 0 行、current_setting 必须为 NULL。
 *
 * 为什么它不是后门(守卫原文):
 *   1. **请求路径一律拒绝**:`assertOutsideRequestScope` 见 `currentPrincipalScope()` 有值即抛。
 *      刻意判"任何 scope"而不是只判 `store.request` —— `runWithPrincipal()` 会用
 *      `{principal}` 覆盖栈内 store,若只认 request 字段,路由处理器里套一层
 *      runWithPrincipal 就能把守卫洗掉(伪装成后台)。任何 principal 上下文 = 拒,
 *      是这条断言**有牙**的形态;方向与 §安全口径一致(宁可少放行)。
 *   2. **reason 白名单 + 审计**:`withBypassRls` 要求 reason ∈ 白名单,每次调用
 *      console.warn 打 reason + 调用栈前 5 帧;生产环境禁 `test-cleanup`。
 *   3. **事务级寿命**:is_local=true ⇒ 不跨 COMMIT 存活,天然不可被后续请求继承。
 *
 * 用法:
 *   import { runWithOpsBypass } from '../db/background-context.js'
 *   await runWithOpsBypass('background', async (tx) => { ...全部经 tx 发查询... })
 * 自带独立池的脚本 / 测试用 `createOpsBypassRunner(yourDrizzleDb)` 得到同一机制,
 * **禁止**再写第二套 set_config('app.bypass_rls', ...) 通路。
 */
import { withBypassRls, type Database } from '@ihui/database'
import { currentPrincipalScope } from '../plugins/principal.js'
import { db } from './index.js'

/** 与 @ihui/database 的 BYPASS_RLS_REASON_WHITELIST 同集合(双保险,漂移即红在类型层)。 */
export type OpsBypassReason = 'migration' | 'seed' | 'cleanup' | 'test-cleanup' | 'background'

const OPS_BYPASS_REASONS: readonly OpsBypassReason[] = [
  'migration',
  'seed',
  'cleanup',
  'test-cleanup',
  'background',
] as const

/** 作用域内允许发查询的事务句柄类型(withBypassRls 注入的那一个);只此一条连接带旁路 GUC。 */
export type OpsBypassTx = Parameters<Parameters<Database['transaction']>[0]>[0]

/** 唯一出口的调用形态。 */
export type OpsBypassRunner = <T>(
  reason: OpsBypassReason,
  fn: (tx: OpsBypassTx) => Promise<T>,
) => Promise<T>

/**
 * 守卫:当前若处在任何 principal 上下文(Fastify 请求生命周期,或 runWithPrincipal
 * 显式注入的主体作用域)内,一律拒绝发放旁路。抛错只带自家长字符串,不回显任何
 * 查询 / 响应体(守门 67 同族纪律)。
 */
export function assertOutsideRequestScope(callerHint: string): void {
  const scope = currentPrincipalScope()
  if (scope !== undefined) {
    throw new Error(
      '[ops-bypass] 拒绝发放 RLS 旁路:检测到活动中的 principal 上下文' +
        `(Fastify 请求生命周期或 runWithPrincipal 作用域;caller=${callerHint})。` +
        'HTTP 请求路径必须走归属谓词(app.user_id),运维旁路仅限无请求上下文的 ' +
        'worker / 定时器 / 维护脚本。确属后台任务却被拒:检查调用链是否被请求协程包裹。',
    )
  }
}

/**
 * 对给定 drizzle 池构造一个运维上下文执行器。
 * `db/index.ts` 的主池用导出的 `runWithOpsBypass` 即可;自带独立池的脚本 / 测试
 * 把它们的 Database 传进来 —— 机制只有一份(委托 @ihui/database 的 withBypassRls)。
 */
export function createOpsBypassRunner(target: Database): OpsBypassRunner {
  return async <T>(
    reason: OpsBypassReason,
    fn: (tx: OpsBypassTx) => Promise<T>,
  ): Promise<T> => {
    if (!OPS_BYPASS_REASONS.includes(reason)) {
      // withBypassRls 内部同样校验;这里先行拒绝,保证未知 reason 连审计行都不产生
      throw new Error(`[ops-bypass] 未知 reason: ${String(reason)}`)
    }
    assertOutsideRequestScope(reason)
    return withBypassRls(target, reason, (tx) => fn(tx))
  }
}

/** 绑定主池(写库 `db`)的默认出口 —— worker / 定时器 / scripts 一律用它。 */
export const runWithOpsBypass: OpsBypassRunner = createOpsBypassRunner(db)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
