// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-12 超越点A:模型用途枚举分类 + 用途感知路由(2026-11-26)。
 *
 * 立因(对标 Qoder QoderModelPurpose,取证见 recon/RECON_ADVANCE_PLAN.md 超越点A):
 * Qoder 把「哪个模型干什么」做成 13 类显式用途枚举(Main/Plan/Task/Compact/...),
 * 用途是一等契约而非自由字符串。本仓 `channel-registry.ts` 的 `purpose` 是**通道用途**
 * (自由串),与「模型用途」语义不同 —— 本模块**不改动**通道注册表,而是新建
 * 「模型用途」单一真相源,供路由/计费/预算闸消费。
 *
 * 超越轴(§0.13):Qoder 只做「用途 → 模型」映射;本仓把用途接进**成本账本**
 * (ai-service `models.list` 已有模型单价 + 缓存乘数),实现「按用途计费 + 用途级预算闸」
 * —— 同类产品未见。
 *
 * 三条纪律(沿 capability-manifest):
 *   1. **fail-closed**:未知用途 ⇒ `unknown`,调用方必须拒绝,不「降级到 main」猜;
 *   2. **单一真相源**:用途值域只此一份,TS 与 Python 各自派生但取值一致(契约测试钉住);
 *   3. **零依赖零 IO**:纯函数 + 常量表,不碰进程全局、不读盘。
 */

/**
 * 模型用途值域(封闭集合)。
 *
 * 对齐本仓已有面推导(非照抄 Qoder 13 类,而是取本仓真实存在的用途):
 *  - `main`        主对话/主推理轮(会话主力模型);
 *  - `plan`        规划/拆解轮(只读规划,不落改);
 *  - `compact`     上下文压缩摘要轮(agent_engine 已有 compaction);
 *  - `title`       会话标题/摘要生成(短产出、低成本模型即可);
 *  - `subagent`    子代理轮(spawn_subagent,防递归由引擎管);
 *  - `web_fetch`   抓取/网页理解轮;
 *  - `image_gen`   图像生成轮;
 *  - `embedding`   向量嵌入(检索/记忆);
 *  - `asr`         语音识别(实时语音会话已有);
 *  - `rerank`      检索重排;
 *  - `utility`     杂项低价值辅助(纠错回执、did-you-mean 等)。
 *
 * 刻意不做的:不发明本仓尚无消费方的用途(每条都要有真实落点,否则删);
 * 不把 `unknown` 列进正常值域 —— 它是 fail-closed 哨兵,只能由 lookup 返回。
 */
export const MODEL_PURPOSES = [
  'main',
  'plan',
  'compact',
  'title',
  'subagent',
  'web_fetch',
  'image_gen',
  'embedding',
  'asr',
  'rerank',
  'utility',
] as const

export type ModelPurpose = (typeof MODEL_PURPOSES)[number]

/** 哨兵:未知用途(fail-closed,不在 MODEL_PURPOSES 内,只能由 lookup 产出)。 */
export const MODEL_PURPOSE_UNKNOWN = 'unknown'

/** 用途是否为已登记值域内的合法用途(unknown 恒为 false)。 */
export function isModelPurpose(value: unknown): value is ModelPurpose {
  return typeof value === 'string' && (MODEL_PURPOSES as readonly string[]).includes(value)
}

/**
 * 单条用途路由规则:某用途应路由到哪个候选模型 + 是否允许降级。
 * `candidates` 按优先级排列(首个可用者优先);空数组 ⇒ 该用途未配路由(调用方拒绝)。
 */
export interface ModelPurposeRoute {
  readonly purpose: ModelPurpose
  /** 候选模型 id,按优先级;空 ⇒ 未配路由。 */
  readonly candidates: readonly string[]
  /** 是否允许在候选全部不可用时降级到 main(默认 false,不静默降级)。 */
  readonly allowFallbackToMain?: boolean
}

/** 用途路由表:用途 → 路由规则。缺某用途 ⇒ 该用途未配路由(拒绝,不猜)。 */
export type ModelPurposeRouteTable = Readonly<Record<ModelPurpose, ModelPurposeRoute | undefined>>

/** 用途预算策略:某用途的 token/成本上限(接成本账本,实现用途级预算闸)。 */
export interface ModelPurposeBudget {
  readonly purpose: ModelPurpose
  /** 单轮 token 上限;省略 ⇒ 不限。 */
  readonly maxTokensPerTurn?: number
  /** 累计成本上限(记账本币种);省略 ⇒ 不限。 */
  readonly maxCostTotal?: number
}

/**
 * 解析某用途的路由:返回候选模型列表;用途未登记/未配路由 ⇒ 空数组(调用方拒绝)。
 * fail-closed:传入 unknown / 未知串 ⇒ 空数组,绝不「降级到 main」猜。
 */
export function resolvePurposeModels(
  purpose: unknown,
  table: Readonly<Partial<Record<ModelPurpose, ModelPurposeRoute>>>,
): readonly string[] {
  if (!isModelPurpose(purpose)) return []
  const route = table[purpose]
  if (!route) return []
  return [...route.candidates]
}

/**
 * 判定一次用途级调用是否超预算。
 * fail-closed:未知用途 ⇒ 超预算(拒绝);缺策略项 ⇒ 不限(该项未设闸)。
 * 纯计算,零 IO;真实累计值由调用方从成本账本读入传入。
 */
export function isWithinBudget(
  purpose: unknown,
  used: { readonly tokens?: number; readonly cost?: number },
  budgets: Readonly<Partial<Record<ModelPurpose, ModelPurposeBudget>>>,
): boolean {
  if (!isModelPurpose(purpose)) return false
  const budget = budgets[purpose]
  if (!budget) return true
  if (
    budget.maxTokensPerTurn !== undefined &&
    typeof used.tokens === 'number' &&
    used.tokens > budget.maxTokensPerTurn
  ) {
    return false
  }
  if (
    budget.maxCostTotal !== undefined &&
    typeof used.cost === 'number' &&
    used.cost > budget.maxCostTotal
  ) {
    return false
  }
  return true
}

export const __test__ = {
  MODEL_PURPOSES,
  MODEL_PURPOSE_UNKNOWN,
  isModelPurpose,
  resolvePurposeModels,
  isWithinBudget,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
