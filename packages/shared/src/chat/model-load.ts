// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// D59 模型负载与排队条(G-73,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:负载/排队五态(负载档位/排位/慢速队列/速通免排/
// 预计等待)在 D59 定性(2026-09-24)时**全无数据源** —— `queuePosition|queuedTurns|
// slowLane|fastPass|loadLevel` 在 ai-service/api-client/packages-shared/web 全 0 命中;
// 唯一相近信号 `GET /llm/providers/health` 是 provider 连通性四态,不是负载档位,
// 把 latency 推导成负载 = 编造语义。因此本模块先立**判定层词汇表**,等 D34 同批的
// `model_queue` 帧落地即可接线;帧没来之前渲染层必须返 null(不得用假数据占位)。
//
// **与 D71 turn-status 的协同(边界划清,不另立第二套 turn 判定)**:
//   · turn 生命周期十态(queued/preparing/thinking/…/completed)归 D71 `turn-status.ts`
//     唯一负责 —— "本轮处于什么阶段"是 turn 维度;
//   · 本模块只做**负载/等待维度** —— "这一轮可能要等多久/排在第几位/通道是否拥堵",
//     与 turn 阶段正交:turn 可以同时是 `thinking` 且高负载排队。两者互不替代,
//     端内禁止用本模块的态去顶替 turn 徽章,也禁止在 turn 徽章里内联排队文案。
//
// **与 D34 的对接形状(数据面,本票不改 sse/contract.ts)**:
//   排队位次与预估等待**由网关产出**(ai-service `llm_gateway.py`),端侧不得自算。
//   D59 定性留档建议帧 `model_queue`,字段形状见下方 `ModelLoadFrame` 注释;接入点:
//   ① `packages/shared/src/sse/contract.ts` 的 `SSE_EVENTS` 增加事件名 + 判别联合
//      增加成员(帧字段与 ModelLoadFrame 对齐);
//   ② `apps/ai-service/app/core/sse_contract.py` 的 `SSE_EVENTS`(frozenset)同步,
//      由 `scripts/check-agent-event-parity.mjs` 断言两侧集合一致;
//   ③ web 侧 stream handler 消费帧后把 `ModelLoadFrame` 传给 `ModelLoadBar`。
//
// **「不充值可用心智」边界(2026-09-21 三轮口径,判据机器化)**:
//   免费档仍可用(freeTierAvailable)时,负载/排队场景的免费出路是"等" —— 任何
//   付费加速出口(开通速通免排等)都判为诱导风险(isLoadInducementRisk),渲染层必须
//   剔除。口径对齐 D67 `quota-ownership.ts:242` 的 isLoadInducementRisk:同一心智边界
//   ("免费档可用时付费出路=诱导"),只是入参从额度归属换成负载档位,不共用函数
//   以免把两个维度耦死;若未来判定规则变化,两处须同步改并互为测试镜像。
//
// 范式同 D67 quota-ownership / D71 turn-status:常量 + 纯函数 + 穷尽 switch
// 零 default + assertNever;端内不得再建第二套负载/排队判定。

/** 负载三级(取值即 i18n 键片段;`ai.pane.modelLoad.load.<key>`) */
export const MODEL_LOAD_LEVELS = ['low', 'medium', 'high'] as const
export type ModelLoadLevel = (typeof MODEL_LOAD_LEVELS)[number]

/** 排队条五态(对齐 G-73 原文五段;`ai.pane.modelLoad` 内逐段取词) */
export const QUEUE_BAR_STATES = [
  /** 低/中/高负载可能排队(按档位取 load.<level> 文案) */
  'mayQueue',
  /** 已进入慢速队列 · 当前排位 N */
  'slowLane',
  /** 已开启速通免排 */
  'fastPass',
  /** 模型可用,正在继续请求 */
  'recovering',
  /** 预计等待(按 waitBucket 四档取词) */
  'waitingEstimate',
] as const
export type QueueBarState = (typeof QUEUE_BAR_STATES)[number]

/** 等待时长四档(取值即 i18n 键片段;`ai.pane.modelLoad.wait.<key>`) */
export const WAIT_BUCKETS = ['under1min', 'about1min', 'aboutNmin', 'over10min'] as const
export type WaitBucket = (typeof WAIT_BUCKETS)[number]

/** 词包命名空间(web 侧 `useTranslations('ai.pane.modelLoad')`) */
export const MODEL_LOAD_NAMESPACE = 'ai.pane.modelLoad' as const

// ---------------------------------------------------------------------------
// ModelLoadFrame —— 与 D34 的对接形状(建议帧,本票不改 contract.ts)
// ---------------------------------------------------------------------------

/**
 * 建议帧 `model_queue` 的字段形状(D59 定性留档沿用;**字段全可选**)。
 * 排队位次/预估等待由网关 `llm_gateway.py` 产出 —— 帧没给就不渲染,
 * 端侧**严禁**用本地推算(延迟/并发猜测)填这些字段伪装数据面已就绪。
 * wire 事件名建议 `model_queue`(snake_case,同 plan_updated/terminal_end 家族),
 * 接入点见文件头;在 D34 帧落地前,本类型只作调用方构造入参的契约。
 */
export interface ModelLoadFrame {
  /** 负载档位,由网关判定;缺省/非法不渲染负载行 */
  loadLevel?: ModelLoadLevel | null
  /** 慢速队列当前排位(1 起);网关产出,端侧不得自算占位 */
  queuePosition?: number | null
  /** 通道:slow = 慢速队列,fast = 速通免排 */
  lane?: 'slow' | 'fast' | null
  /** 预估等待(秒),网关产出;0 视为未产出(端侧不渲染"预计等待") */
  estimatedWaitSeconds?: number | null
  /** 拥堵缓解,模型恢复可用、正在继续请求 */
  recovering?: boolean | null
}

const LOAD_LEVEL_SET: ReadonlySet<string> = new Set<string>(MODEL_LOAD_LEVELS)

/** 宽松判档:帧里来的字符串认得才收,认不得返回 null(不硬塞) */
export function isModelLoadLevel(value: unknown): value is ModelLoadLevel {
  return typeof value === 'string' && LOAD_LEVEL_SET.has(value)
}

/** 三级 → i18n 键(`ai.pane.modelLoad.load.<key>`) */
export function loadLevelKey(level: ModelLoadLevel): string {
  return `load.${level}`
}

/** 三级 → 视图判据的**唯一**派发点(穷尽 switch 零 default,漏档编译失败) */
export function loadLevelView(level: ModelLoadLevel): { readonly level: ModelLoadLevel; readonly titleKey: string } {
  switch (level) {
    case 'low':
      return { level, titleKey: loadLevelKey(level) }
    case 'medium':
      return { level, titleKey: loadLevelKey(level) }
    case 'high':
      return { level, titleKey: loadLevelKey(level) }
  }
  return assertNeverLevel(level)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverLevel(level: never): never {
  throw new Error(`unhandled model load level: ${String(level)}`)
}

// ---------------------------------------------------------------------------
// 等待时长分档(纯函数;验收硬项,边界用例逐条钉死)
// ---------------------------------------------------------------------------

/**
 * 预估等待毫秒 → 四档。分档边界(左闭右开):
 *   · [0, 60s)      → under1min   (不足1分钟;59s 落此档,60s 不落)
 *   · [60s, 120s)   → about1min   (约1分钟;61s 落此档)
 *   · [120s, 600s)  → aboutNmin   (约N分钟,N = floor(ms/60000);9m59s=599s 落此档)
 *   · [600s, +∞)    → over10min   (超过10分钟;10m=600s 落此档)
 * null/undefined/负数/NaN/Infinity → **null 不抛异常**(渲染层拿到的等待时长来自
 * 网关,坏数据不该炸掉对话流;null 表示"分不了档,不渲染")。
 */
export function waitBucket(ms: number | null | undefined): WaitBucket | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null
  if (ms < 60_000) return 'under1min'
  if (ms < 120_000) return 'about1min'
  if (ms < 600_000) return 'aboutNmin'
  return 'over10min'
}

/** 四档 → i18n 键(`ai.pane.modelLoad.wait.<key>`) */
export function waitBucketKey(bucket: WaitBucket): string {
  return `wait.${bucket}`
}

/**
 * 排位 → 插值参数。n 为 1 起的正整数才有意义:
 *   · n <= 0 / 非有限 → null(**不显示「第 0 位」这类鬼话,排位无效就不渲染**)
 *   · 小数向下取整(网关若给 2.7,显示第 2 位;端侧不四舍五入虚增排位)
 */
export function queuePositionView(n: number | null | undefined): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (n < 1) return null
  return Math.floor(n)
}

// ---------------------------------------------------------------------------
// 「不充值可用心智」边界(机器判据;口径对齐 D67 quota-ownership)
// ---------------------------------------------------------------------------

export interface LoadInducementContext {
  /** 免费档仍可用(true ⇒ 剔除付费加速出口) */
  readonly freeTierAvailable: boolean
  /** 当前负载档位;null = 未知(未知时按有风险处理,宁可不诱导) */
  readonly loadLevel: ModelLoadLevel | null
}

/**
 * 诱导风险判据:**免费档仍可用** 且负载**不是 low**(可能排队,付费加速有"卖点")
 * ⇒ true,渲染层必须剔除付费出口、只给状态陈述。
 * 正例:{freeTierAvailable: true, loadLevel: 'high'} → true
 *      {freeTierAvailable: true, loadLevel: null}(未知负载,保守判诱导)→ true
 * 反例:{freeTierAvailable: true, loadLevel: 'low'}(低负载无排队可能,无卖点)→ false
 *      {freeTierAvailable: false, ...}(免费档已不可用,付费出路是真实出路)→ false
 */
export function isLoadInducementRisk(ctx: LoadInducementContext): boolean {
  return ctx.freeTierAvailable && ctx.loadLevel !== 'low'
}

// ---------------------------------------------------------------------------
// 排队条五态视图
// ---------------------------------------------------------------------------

export interface QueueBarContext {
  /** 负载档位(mayQueue 态必填;其余态可缺) */
  readonly loadLevel?: ModelLoadLevel | null
  /** 慢速队列排位(slowLane 态) */
  readonly position?: number | null
  /** 预估等待毫秒(waitingEstimate 态) */
  readonly waitMs?: number | null
  /** 免费档仍可用;缺省按 true 处理(「不充值可用心智」保守侧) */
  readonly freeTierAvailable?: boolean
}

export interface QueueBarView {
  readonly state: QueueBarState
  /** `ai.pane.modelLoad` 内的文案键(mayQueue → load.<level>;waitingEstimate → wait.<bucket>) */
  readonly labelKey: string
  /** 仅 slowLane:已通过 queuePositionView 校验的排位(>0);其余态 null */
  readonly position: number | null
  /** 仅 waitingEstimate:等待分档键;其余态 null */
  readonly waitBucketKey: string | null
  /** 仅 waitingEstimate 且 aboutNmin:分钟插值;其余态 null */
  readonly minutes: number | null
  /** true = 免费档可用时的付费诱导风险,渲染层据此不给付费出口 */
  readonly inducementRisk: boolean
}

/**
 * 五态 → 视图判据的**唯一**派发点。switch 穷尽五态、**无 default**。
 * 缺数据返回 null 不硬塞(mayQueue 无档位 / slowLane 无有效排位 /
 * waitingEstimate 分不了档 ⇒ 调用方对 null 一律不渲染,绝不显示残缺态)。
 */
export function queueBarView(state: QueueBarState, ctx: QueueBarContext): QueueBarView | null {
  const inducementRisk = isLoadInducementRisk({
    freeTierAvailable: ctx.freeTierAvailable ?? true,
    loadLevel: ctx.loadLevel ?? null,
  })
  const base = { position: null, waitBucketKey: null, minutes: null, inducementRisk } as const
  switch (state) {
    case 'mayQueue': {
      // 低/中/高负载可能排队:档位缺失就不渲染(不猜档位)
      if (!ctx.loadLevel) return null
      return { state, labelKey: loadLevelKey(ctx.loadLevel), ...base }
    }
    case 'slowLane': {
      // 已进入慢速队列·当前排位 N:排位无效(<=0)就不渲染,不显示「第 0 位」
      const position = queuePositionView(ctx.position)
      if (position === null) return null
      return { state, labelKey: 'slowLane', position, waitBucketKey: null, minutes: null, inducementRisk }
    }
    case 'fastPass':
      // 已开启速通免排:状态陈述,无插值
      return { state, labelKey: 'fastPass', ...base }
    case 'recovering':
      // 模型可用,正在继续请求:状态陈述,无插值
      return { state, labelKey: 'recovering', ...base }
    case 'waitingEstimate': {
      // 预计等待:分不了档就不渲染
      const bucket = waitBucket(ctx.waitMs)
      if (bucket === null) return null
      const minutes = bucket === 'aboutNmin' ? Math.floor((ctx.waitMs as number) / 60_000) : null
      return {
        state,
        labelKey: waitBucketKey(bucket),
        position: null,
        waitBucketKey: waitBucketKey(bucket),
        minutes,
        inducementRisk,
      }
    }
  }
  return assertNeverQueueState(state)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverQueueState(state: never): never {
  throw new Error(`unhandled queue bar state: ${String(state)}`)
}

/**
 * 帧 → 五态派发(一帧多字段时的优先级,高到低):
 *   recovering(拥堵已缓解,最重要的"好消息") > fastPass(速通免排,用户已不排队)
 *   > slowLane(排位具体,比模糊等待更有信息量) > waitingEstimate > mayQueue。
 * 空帧/全字段无效 → null(**反假数据核心负例:没帧就没条**)。
 */
export function queueStateFromFrame(frame: ModelLoadFrame): QueueBarState | null {
  if (frame.recovering === true) return 'recovering'
  if (frame.lane === 'fast') return 'fastPass'
  if (queuePositionView(frame.queuePosition) !== null) return 'slowLane'
  if (typeof frame.estimatedWaitSeconds === 'number' && Number.isFinite(frame.estimatedWaitSeconds) && frame.estimatedWaitSeconds > 0) {
    return 'waitingEstimate'
  }
  if (isModelLoadLevel(frame.loadLevel)) return 'mayQueue'
  return null
}

// ⁠[tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
