// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815967:异步回调回来时必须复核"我等的还是不是原来那个作业"——身份标记的唯一实现。
//
// 为什么"只判 mounted"是半个守卫:mountedRef 回答的是"这个组件还在不在",
// 而真实事故形态是**组件还挂着、用户已切到另一个作业**(上游
// `packages/ui/src/feedback/FeatureRequestDialog.tsx:143-160` 的三重条件正是这一型:
// `mountedRef.current && activeSubmissionJobRef.current?.id === job.id`)。
// 那一刻 mounted 为真、身份为旧 —— 迟到的回调会把**上一个作业**的结果落进当前作业的状态,
// 界面看起来"响应了",内容却是别人的。
//
// 三条不可漂的写法:
//  ① 比对的是**身份标记**(代次戳 generation + 作业 id),**不是时间戳**、**不是 mounted 位**。
//     时间戳在同毫秒内换作业会判成"同一个",而本模块的 generation 是单调自增的整数。
//  ② 三态不并桶:`current`(就是它在等)/ `stale`(确证被换掉了)/ `unknown`(拿不出可比的身份)。
//     把 unknown 折成 stale 会把"调用方忘了带 token"洗成"作业已作废";折成 current
//     就是把"没判"写成"判过了"(本仓最高频失效型)。两型都必须各自有出口。
//  ③ 每一次拒绝都记账(可数、可点名)—— 静默跳过与"没有跳过"在账面上必须不同形。
//
// 本文件是**纯逻辑**(不碰 React),`hooks/use-job-scope.ts` 只把挂载位作为 `isAlive` 探针
// 注入进来 —— 挂载与身份**同一条铰链、同一本账**(两处各写一遍判据必然漂开,而漂开的表现
// 是"有的回调被拦、有的被静默放行")。

/** 作业身份:调用方给什么就用什么(字符串 id / 数字序号都算),内部不解释其含义。 */
export type JobIdentity = string | number

/** 一次作业的凭证:代次戳单调自增,jobId 是可点名的身份标记(可为空 = 只按代次判)。 */
export interface JobToken {
  readonly generation: number
  readonly jobId: JobIdentity | null
}

/** 复核结论的三态。 */
export type JobScopeVerdict = 'current' | 'stale' | 'unknown'

/** 一次被拒的迟到回调:计数与点名用的两个量纲都在。 */
export interface DroppedCallback {
  readonly verdict: Exclude<JobScopeVerdict, 'current'>
  readonly token: JobToken
  readonly currentGeneration: number | null
  readonly reason: string
}

export interface JobScopeOptions {
  /**
   * 宿主的"还活着"探针(React 侧传挂载位)。它只是**第二个**条件:
   * 判活失败一律落 `stale` 并记账,而不是静默 return —— 否则"没清理订阅"与"没有迟到回调"
   * 在账面上长得一模一样。
   */
  readonly isAlive?: () => boolean
  /** 探针失败时记进 reason 的名字(默认 `host-not-alive`) */
  readonly deadReason?: string
}

export interface JobScope {
  /** 开启一次新作业(自动作废旧作业)。`jobId` 给得越具体,迟到回调越点得出名。 */
  readonly begin: (jobId?: JobIdentity) => JobToken
  /** 复核:这一枚凭证是不是当前作业。判不出来的形态一律落 `unknown`,不猜。 */
  readonly verdict: (token: JobToken) => JobScopeVerdict
  /** `verdict(token) === 'current'`;为 false 时自动记账(可数、可点名) */
  readonly isCurrent: (token: JobToken) => boolean
  /** 当前在等的作业;从未 begin 且未 invalidate ⇒ null(与"已作废"分两型) */
  readonly current: () => JobToken | null
  /** 作废旧作业(卸载 / 用户点停止)。之后所有凭证都判 `stale`(invalidated)。 */
  readonly invalidate: (reason?: string) => void
  /** 被拒的迟到回调清单(只追加,不静默清空) */
  readonly dropped: () => readonly DroppedCallback[]
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function isJobIdentity(value: unknown): value is JobIdentity | null {
  return value === null || typeof value === 'string' || typeof value === 'number'
}

/** 形状对不对:`begin()` 的产物必然带整数代次;手搓/序列化回来的凭证先验形状再比。 */
function tokenShaped(token: unknown): token is JobToken {
  if (typeof token !== 'object' || token === null) return false
  const candidate = token as { generation?: unknown; jobId?: unknown }
  if (!isFiniteInteger(candidate.generation)) return false
  return isJobIdentity(candidate.jobId ?? null)
}

/** 点名用:有作业 id 就把 id 带上,免得"报了数却查不到站点"。 */
function nameOf(token: JobToken): string {
  return token.jobId === null ? '' : `/${String(token.jobId)}`
}

/**
 * 建一个作业作用域。
 *
 * 每个组件/每段流各持一份实例(它记的是"这一个界面在等谁"),不要跨界面共享。
 */
export function createJobScope(options: JobScopeOptions = {}): JobScope {
  const { isAlive, deadReason = 'host-not-alive' } = options
  let generation = 0
  let current: JobToken | null = null
  // neverBegun 与"已作废"是两个不同的结论:前者说明调用方压根没登记作业(拿不出可比身份),
  // 后者说明作业确实被显式取消了。混成一句"stale"会把漏传凭证伪装成正当拒绝。
  let neverBegun = true
  let invalidated = false
  const drops: DroppedCallback[] = []

  const record = (verdict: Exclude<JobScopeVerdict, 'current'>, token: JobToken, reason: string) => {
    drops.push({ verdict, token, currentGeneration: current?.generation ?? null, reason })
  }

  const decide = (token: JobToken): { verdict: JobScopeVerdict; reason: string } => {
    // ① 宿主判活放在身份比对**之前**:界面都没了,后面任何比对都是在给一具尸体判血型。
    //    但它记的是 `stale` + 具名 reason,而不是静默 return —— "没清理订阅"与
    //    "没有迟到回调"必须是两种读数(承 §5e"失败必须响")。
    if (isAlive && !isAlive()) {
      return { verdict: 'stale', reason: `${deadReason}(回调落在已拆掉的宿主上)` }
    }
    // ② 再验凭证形状:手搓/序列化回来的凭证可能缺字段,那一律 `unknown` 不猜。
    if (!tokenShaped(token)) {
      return { verdict: 'unknown', reason: 'token-malformed(拿不出可比的身份标记)' }
    }
    if (current === null) {
      if (neverBegun && !invalidated) {
        return { verdict: 'unknown', reason: 'no-job-ever(从未 begin,无从对账)' }
      }
      return { verdict: 'stale', reason: 'invalidated(作业已被显式作废)' }
    }
    // 代次超出本作用域发过的最大值 ⇒ 这枚凭证压根不是这里发的(串了作用域/手搓/伪造)。
    // 它必须落 `unknown` 而不是 `stale`:"被换掉了"与"来历不明"是两种诊断,
    // 并成一桶会让人去查错的那一侧(本仓"查不到"与"没有"分两型,G-721 同一条口径)。
    if (token.generation > generation) {
      return {
        verdict: 'unknown',
        reason: `foreign-token(代次 ${token.generation} 超出本作用域发过的最大 ${generation},无从对账)`,
      }
    }
    if (token.generation !== current.generation) {
      return {
        verdict: 'stale',
        reason: `generation-changed(等待中开了新作业:旧 gen=${token.generation}${nameOf(token)} vs 当前 gen=${current.generation}${nameOf(current)})`,
      }
    }
    // jobId 两端都有值才比 —— 调用方没命名批次时只按代次判,那仍是身份标记而不是时间戳。
    if (token.jobId !== null && current.jobId !== null && token.jobId !== current.jobId) {
      return {
        verdict: 'stale',
        reason: `job-changed(同一代次但作业换了:旧 ${String(token.jobId)} vs 当前 ${String(current.jobId)})`,
      }
    }
    return { verdict: 'current', reason: '' }
  }

  return {
    begin(jobId?: JobIdentity): JobToken {
      generation += 1
      invalidated = false
      neverBegun = false
      current = { generation, jobId: jobId ?? null }
      return current
    },
    verdict(token: JobToken): JobScopeVerdict {
      return decide(token).verdict
    },
    isCurrent(token: JobToken): boolean {
      const { verdict, reason } = decide(token)
      if (verdict !== 'current') record(verdict, token, reason)
      return verdict === 'current'
    },
    current(): JobToken | null {
      return current
    },
    invalidate(reason?: string): void {
      if (current !== null && !neverBegun) {
        // 作废本身也记一笔:之后到达的迟到回调会各自再记一条 stale,
        // 而"是谁把它们取消的"必须能从这条 reason 里读出来。
        drops.push({
          verdict: 'stale',
          token: current,
          currentGeneration: null,
          reason: `invalidated-by:${reason ?? 'caller'}`,
        })
      }
      current = null
      invalidated = true
    },
    dropped(): readonly DroppedCallback[] {
      return drops
    },
  }
}

/**
 * 被拒清单的人读摘要;没有任何拒绝时返回 null(免打噪音,但不等于"没判")。
 *
 * 三态分列计数:`stale` 是"确证换人了","unknown" 是"没带凭证" —— 后者是本模块
 * 存在的理由之一(它拒绝把"判不出"写成"没有"),绝不能被折进前者一起报"已拦截 N 次"。
 */
export function summarizeDroppedCallbacks(drops: readonly DroppedCallback[]): string | null {
  if (drops.length === 0) return null
  const stale = drops.filter((d) => d.verdict === 'stale')
  const unknown = drops.filter((d) => d.verdict === 'unknown')
  const lines = drops.map(
    (d) =>
      `gen=${d.token.generation}${d.token.jobId !== null ? `/${String(d.token.jobId)}` : ''} ${d.verdict}: ${d.reason}`,
  )
  return `job-scope: stale=${stale.length} unknown=${unknown.length}\n${lines.join('\n')}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
