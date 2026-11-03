// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上下文占用采样的"瞬时 0"投影判据(G-404,2026-09-29 立;跨端共享,纯函数)。
 *
 * 解决的问题:流式过程中**普通工具调用期间会短暂上报 used=0**,那不是上下文
 * 真被清空;消费端只判 `!== undefined` 时,这一枚瞬时 0 会把上一个可信采样
 * 覆盖成 0%(界面闪断)。真话只有一种:显式压缩/重置阶段落的那一枚 0
 * (`/compact`、`/compress`、流内 auto-compaction 帧之后的首个采样)。
 * 与 AGENTS.md §30"没有终态不得渲染成完成"、守门 135"身份不得从文案重建"同族 ——
 * 所以**阶段必须来自结构化信号(事件类型/显式登记),禁止从文案关键词猜**。
 *
 * 三条设计约束:
 * 1. **例外表是封闭枚举,不是散文**:`CONTEXT_TRUSTED_ZERO_PHASES` 是唯一登记表,
 *    判据只从这张表推导(`isContextTrustedZeroPhase`),不得在端内另写第二份名单。
 * 2. **新增例外必须同笔有消费方**(照 §4 圆角角色表纪律):每个表员都必须在生产面
 *    有 `noteBudgetTrustedZeroPhase('<该员>')` 形态的调用点,由消费端镜像测试
 *    (apps/web/src/hooks/use-chat/__tests__/context-used-sample-wiring.test.ts)
 *    逐名对账 —— 先建表再等人用 = 测试直接判红。
 *    注:票例举的第三条"显式 reset"**刻意不入表** —— 显式重置把 prev 清成 null,
 *    此后任何 0 都命中"无prev⇒如实接受"分支,held 语义结构上不可达;
 *    没有可达消费方的表员就是本纪律禁止的死表。
 * 3. **held 不改写数值本身**:`undefined ⇒ { used: undefined }` 逐字维持
 *    "未收到"语义(与 G-404 落地前的消费端行为一致);非例外阶段的 0 ⇒
 *    返回上一个可信采样并置 `held: true`,由消费端决定整帧丢弃还是继续挂旧值。
 */

/** 例外阶段封闭表:处在这几个阶段收到的 0 是真话(接受为 0),其余阶段的 0 是瞬时噪声。 */
export const CONTEXT_TRUSTED_ZERO_PHASES = ['auto-compaction', 'compact', 'compress'] as const

/** 例外阶段的类型形态 —— 登记口(消费端 noteBudgetTrustedZeroPhase)以此收窄参数。 */
export type ContextTrustedZeroPhase = (typeof CONTEXT_TRUSTED_ZERO_PHASES)[number]

/** 采样写入时可处的阶段:例外阶段 ∪ 非例外阶段。
 *  'streaming' = 消费端写点未登记例外时的默认档(含普通工具调用在途);
 *  'unknown' = 拿不到阶段信号时的如实档位 —— 按非例外处理(held 兜底),不猜。 */
export type ContextSamplePhase = ContextTrustedZeroPhase | 'streaming' | 'unknown'

/** 一次采样:used=undefined 表示"这一帧没带用量"(未收到),与 0 严格两态。 */
export interface ContextUsedSample {
  readonly used: number | undefined
}

/** 投影结果:held=true ⇔ 这一枚 0 被判为瞬时噪声,returned.used 是上一个可信采样。 */
export interface ResolvedContextUsedSample {
  readonly used: number | undefined
  readonly held: boolean
}

export interface ResolveContextUsedSampleOptions {
  /** 例外表覆盖口 —— 仅供测试构造正反例;生产面一律用默认表,不得在端内自立第二份。 */
  readonly exceptions?: readonly ContextTrustedZeroPhase[]
}

/** 判据只从表推导:phase 是否落在例外表内(表由参数覆盖时同理)。 */
export function isContextTrustedZeroPhase(
  phase: ContextSamplePhase,
  exceptions: readonly ContextTrustedZeroPhase[] = CONTEXT_TRUSTED_ZERO_PHASES,
): boolean {
  return (exceptions as readonly string[]).includes(phase)
}

/**
 * 唯一投影出口:把"下一枚采样 next 能不能覆盖 prev"判成 { used, held }。
 *
 * 规则(逐条各有成对测试,见 shared tests 与 web wiring 测试):
 * - next.used === undefined ⇒ { used: undefined, held: false } —— "未收到"语义逐字不变;
 * - next.used === 0 ∧ phase 在例外表 ⇒ { used: 0, held: false } —— 真 0,必须落下;
 * - next.used === 0 ∧ phase 不在例外表 ∧ prev 有可信数值 ⇒ { used: prev.used, held: true };
 * - next.used === 0 ∧ phase 不在例外表 ∧ prev 无可信数值 ⇒ { used: 0, held: false }
 *   —— 没有可信值可保,0 就是当下唯一事实,不得凭空造一个别的数(禁兜底魔法数字);
 * - 其余(next.used 非 0)⇒ 原样接受。
 */
export function resolveContextUsedSample(
  prev: ContextUsedSample | null | undefined,
  next: ContextUsedSample,
  phase: ContextSamplePhase,
  options: ResolveContextUsedSampleOptions = {},
): ResolvedContextUsedSample {
  const exceptions = options.exceptions ?? CONTEXT_TRUSTED_ZERO_PHASES
  if (next.used === undefined) {
    return { used: undefined, held: false }
  }
  if (next.used === 0) {
    if (isContextTrustedZeroPhase(phase, exceptions)) {
      return { used: 0, held: false }
    }
    if (prev && prev.used !== undefined) {
      return { used: prev.used, held: true }
    }
    return { used: 0, held: false }
  }
  return { used: next.used, held: false }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
