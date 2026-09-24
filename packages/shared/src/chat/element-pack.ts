// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// D64 小元素包 —— 判定层(G-72/75/77/79/82/83,2026-09-24 立)
//
// **自证结论(改本文件前先读,六项逐条 HEAD 实证)**:
//   · ①Credits 热力图:通用组件 `apps/web/src/components/charts/Heatmap.tsx` 已存在,
//     但**业务卡未建**;credits 数据面 web 侧仅 `lib/models-api.ts:289` 的模型类目
//     `category:'credits'`,**无按日消耗时序**(stores/api 路由零命中)→ 卡片
//     props 注入 + 无数据返回 null(同 D59「不得用假数据占位」纪律)。
//   · ②图片预览器:`media/FilePreview.tsx` 的 ImagePreview **单图无翻页/无缩放/
//     无计数/无保存复制成败**;多图接线点在 message-list(在途)→ 只做判定层
//     (翻页钳制/循环 + 缩放档位穷尽 + 计数 + 保存复制成败键),接线另票。
//   · ③思考卡双态:`thinking-section.tsx` 只有「思考过程」单态(ai.pane.thinkingTitle,
//     五语言在位),无「使用了 N 个引用」态 → 判定层 thinkingTitleView + 最小 patch。
//   · ④后台子任务:`components/ai/types.ts` AgentStatus 十态里**没有**
//     stopping/stopFailed;「停止失败」唯一命中在 spec-panel 域
//     (useSpecHandlers.ts:574,watch 域,非后台子任务)→ 八态词汇表 +
//     stopFailed 显式渲染 + 重试停止入口。
//   · ⑤反馈问卷:HEAD 全仓零命中,确定未做 → 三段结构 + 免打扰判定 + 渲染卡。
//   · ⑥goal 卡:对照表见报告(不产判定层)——判据 `scripts/data/chat-element-coverage.json`
//     qoder-goal-bar(active/paused/blocked/budgetLimited/usageLimited+时长三档)、
//     codex-goal-card(6态含 usage_limited)、trae-goal-engine(我方已有)。
//
// 范式同 D71 turn-status / D67 quota-ownership / D89 input-sources:
// 常量 + 纯函数 + 穷尽 switch 零 default + assertNever;端内不得再建第二套判定。
//
// 词包命名空间(自证后定档):本票四项(①②④⑤)归 `ai.pane.elementPack` 子命名空间
// (heatmap/imagePreview/backgroundTask/feedbackSurvey);③的键与既有
// `ai.pane.thinkingTitle` 同族同域,放 ai.pane 根(thinkingRefsTitle),不另立域。

/** 词包命名空间(web 侧 `useTranslations('ai.pane.elementPack')`) */
export const ELEMENT_PACK_NAMESPACE = 'ai.pane.elementPack' as const

/** 统一键名生成器:相对段 → `ai.pane.elementPack.<path>` */
export function elementPackKey(path: string): string {
  return `${ELEMENT_PACK_NAMESPACE}.${path}`
}

/** 语义色档(判定层只给语义,具体样式由渲染件决定;复用 turn-status 同族五档) */
export const ELEMENT_PACK_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const
export type ElementPackTone = (typeof ELEMENT_PACK_TONES)[number]

// ---------------------------------------------------------------------------
// ① Credits 热力图:桶级色阶判定 + 单日下钻
// ---------------------------------------------------------------------------

/** 桶级四档:0 / 低 / 中 / 高(取值即 i18n 键片段;`elementPack.heatmap.legend.<key>`) */
export const HEATMAP_BUCKETS = ['zero', 'low', 'mid', 'high'] as const
export type HeatmapBucket = (typeof HEATMAP_BUCKETS)[number]

/**
 * 桶级阈值(可配):zero = count ≤ 0;low = (0, mid);mid = [mid, high);high = ≥ high。
 * 低档下界即 0/1 自然边界,无需第三阈值。
 */
export interface HeatmapThresholds {
  readonly mid: number
  readonly high: number
}

/** 缺省阈值:{ mid: 5, high: 20 } */
export const DEFAULT_HEATMAP_THRESHOLDS: HeatmapThresholds = { mid: 5, high: 20 }

/** 阈值合法性:两者有限、0 < mid < high;不合法回落缺省(坏配置不炸渲染) */
function resolveThresholds(t: HeatmapThresholds): HeatmapThresholds {
  const ok = Number.isFinite(t.mid) && Number.isFinite(t.high) && t.mid > 0 && t.mid < t.high
  return ok ? t : DEFAULT_HEATMAP_THRESHOLDS
}

/**
 * 当日次数 → 桶级四档。非有限 / 负数 / 0 一律 zero(坏数据归零,不抛异常)。
 */
export function heatmapBucket(
  count: number,
  thresholds: HeatmapThresholds = DEFAULT_HEATMAP_THRESHOLDS,
): HeatmapBucket {
  if (!Number.isFinite(count) || count <= 0) return 'zero'
  const { mid, high } = resolveThresholds(thresholds)
  if (count < mid) return 'low'
  if (count < high) return 'mid'
  return 'high'
}

/** 桶 → 语义色档的唯一派发点。switch 穷尽四档、零 default。 */
export function heatmapBucketTone(bucket: HeatmapBucket): ElementPackTone {
  switch (bucket) {
    case 'zero':
      return 'neutral'
    case 'low':
      return 'info'
    case 'mid':
      return 'warning'
    case 'high':
      return 'danger'
  }
  return assertNeverBucket(bucket)
}

function assertNeverBucket(bucket: never): never {
  throw new Error(`unhandled heatmap bucket: ${String(bucket)}`)
}

/** 图例文案键(`elementPack.heatmap.legend.<key>`) */
export function heatmapLegendKey(bucket: HeatmapBucket): string {
  return `legend.${bucket}`
}

export interface HeatmapDayDetail {
  readonly dateKey: string
  readonly count: number
  readonly bucket: HeatmapBucket
  readonly tone: ElementPackTone
  /** `elementPack.heatmap.dayTitle`;键段与 heatmapLegendKey 同域(相对 heatmap 命名空间,不得双前缀) */
  readonly titleKey: 'dayTitle'
  readonly values: { readonly date: string }
}

/**
 * 单日下钻判定:dateKey 空 / 非字符串 → null(不渲染空壳);
 * count 坏数据由 heatmapBucket 归零兜底。
 */
export function dayDetailView(
  dateKey: string,
  count: number,
  thresholds: HeatmapThresholds = DEFAULT_HEATMAP_THRESHOLDS,
): HeatmapDayDetail | null {
  const key = typeof dateKey === 'string' ? dateKey.trim() : ''
  if (!key) return null
  const bucket = heatmapBucket(count, thresholds)
  return {
    dateKey: key,
    count,
    bucket,
    tone: heatmapBucketTone(bucket),
    titleKey: 'dayTitle',
    values: { date: key },
  }
}

/** 视图模式:会话明细 / 热力(任务原文「会话/热力切换」) */
export const HEATMAP_VIEW_MODES = ['sessions', 'heatmap'] as const
export type HeatmapViewMode = (typeof HEATMAP_VIEW_MODES)[number]

// ---------------------------------------------------------------------------
// ② 图片预览:翻页 / 缩放 / 计数 / 保存复制成败(判定层;接线点在途,另票)
// ---------------------------------------------------------------------------

/** 缩放档位(穷尽数组,渲染层按此档进退,不自由取值) */
export const IMAGE_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export type ZoomDirection = 'in' | 'out'

/**
 * 取档位数组的端点。数组是 `as const` 非空元组,越界结构上不可达;
 * 但 `noUncheckedIndexedAccess` 下索引取值仍带 `undefined`,故显式抛而非 `??` 兜底 ——
 * 兜底等于把档位值抄第二份。
 */
function zoomEdge(index: number): number {
  const step = IMAGE_ZOOM_STEPS[index]
  if (step === undefined) throw new Error(`image zoom step missing at index ${index}`)
  return step
}

/**
 * 缩放档位进退:'in' 取严格大于 current 的最小档;'out' 取严格小于 current 的最大档;
 * 已在端点则原地不动(钳制,不循环)。current 不在档位数组里也成立(按上述比较语义)。
 */
export function zoomStep(current: number, direction: ZoomDirection): number {
  const last = IMAGE_ZOOM_STEPS.length - 1
  if (!Number.isFinite(current)) return direction === 'in' ? zoomEdge(0) : zoomEdge(last)
  if (direction === 'in') {
    for (const step of IMAGE_ZOOM_STEPS) {
      if (step > current) return step
    }
    return zoomEdge(last)
  }
  for (let i = last; i >= 0; i--) {
    const step = IMAGE_ZOOM_STEPS[i]
    if (step !== undefined && step < current) return step
  }
  return zoomEdge(0)
}

/**
 * 翻页索引(0 基):total ≤ 0 或非有限 → null(无图可翻,渲染层不渲染);
 * 越界钳制到 [0, total-1];wrap=true 时循环(末张下一步回首张)。
 */
export function pageImage(
  index: number,
  total: number,
  opts: { wrap?: boolean } = {},
): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  const last = Math.floor(total) - 1
  if (!Number.isFinite(index)) return opts.wrap ? 0 : 0
  if (opts.wrap) {
    const n = Math.floor(total)
    return ((Math.floor(index) % n) + n) % n
  }
  if (index < 0) return 0
  if (index > last) return last
  return Math.floor(index)
}

export interface ImageCounterView {
  /** `elementPack.imagePreview.counter`,词包原文:「第 {index} · {total} 张」 */
  readonly labelKey: 'imagePreview.counter'
  /** 展示为 1 基(index 入参 0 基) */
  readonly values: { readonly index: number; readonly total: number }
}

/** 「第 N · M 张」计数判定:total 非法 → null;index 越界按钳制值展示(与翻页同口径)。 */
export function imageCounterView(index: number, total: number): ImageCounterView | null {
  const safeIndex = pageImage(index, total)
  if (safeIndex === null) return null
  return {
    labelKey: 'imagePreview.counter',
    values: { index: safeIndex + 1, total: Math.floor(total) },
  }
}

/** 保存 / 复制两类传输动作的成败文案键(成败都显式,不静默吞) */
export const IMAGE_TRANSFER_KINDS = ['save', 'copy'] as const
export type ImageTransferKind = (typeof IMAGE_TRANSFER_KINDS)[number]
export const IMAGE_TRANSFER_RESULTS = ['success', 'failed'] as const
export type ImageTransferResult = (typeof IMAGE_TRANSFER_RESULTS)[number]

/** 成败 → 文案键(`elementPack.imagePreview.<kind><Result>`)。switch 穷尽,零 default。 */
export function imageTransferView(kind: ImageTransferKind, result: ImageTransferResult): string {
  switch (kind) {
    case 'save':
      return result === 'success' ? 'imagePreview.saveSuccess' : 'imagePreview.saveFailed'
    case 'copy':
      return result === 'success' ? 'imagePreview.copySuccess' : 'imagePreview.copyFailed'
  }
  return assertNeverTransfer(kind)
}

function assertNeverTransfer(kind: never): never {
  throw new Error(`unhandled image transfer kind: ${String(kind)}`)
}

// ---------------------------------------------------------------------------
// ③ 思考卡双态标题:有思考 → thinkingTitle;无思考有引用 → thinkingRefsTitle
// ---------------------------------------------------------------------------

export type ThinkingTitleVariant = 'thinking' | 'refs'

export interface ThinkingTitleView {
  readonly variant: ThinkingTitleVariant
  /** ai.pane 域内键:thinking → 'thinkingTitle'(既有);refs → 'thinkingRefsTitle'(本票新增) */
  readonly titleKey: string
  /** 读屏 aria 同标题 */
  readonly ariaKey: string
  /** refs 态插值;thinking 态无插值(undefined) */
  readonly values?: { readonly count: number }
}

/**
 * 双态判定:
 *   · 有思考(content 非空或有执行节点)→ thinking 键(现状单态,不回退);
 *   · 无思考且 refsCount 为正有限数 → 「使用了 {count} 个引用」同族键;
 *   · 两者皆无 → null(调用方不渲染,与现状「无内容 return null」一致)。
 */
export function thinkingTitleView(
  hasThinking: boolean,
  refsCount?: number,
): ThinkingTitleView | null {
  if (hasThinking) {
    return { variant: 'thinking', titleKey: 'thinkingTitle', ariaKey: 'thinkingTitle' }
  }
  if (typeof refsCount === 'number' && Number.isFinite(refsCount) && refsCount > 0) {
    const count = Math.floor(refsCount)
    return {
      variant: 'refs',
      titleKey: 'thinkingRefsTitle',
      ariaKey: 'thinkingRefsTitle',
      values: { count },
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// ④ 后台子任务八态 + 「停止失败」显式文案
// ---------------------------------------------------------------------------

/**
 * 后台子任务八态(自证定名:required 语义族 running/stopping/stopFailed/completed/
 * failed/cancelled 全含;pending/timeout 是生命周期两端——待启动与超时终态)。
 * 取值即 i18n 键片段;`elementPack.backgroundTask.state.<key>`。
 */
export const BACKGROUND_TASK_STATES = [
  'pending',
  'running',
  'stopping',
  'stopFailed',
  'completed',
  'failed',
  'cancelled',
  'timeout',
] as const
export type BackgroundTaskState = (typeof BACKGROUND_TASK_STATES)[number]

export type BackgroundTaskAction = 'none' | 'stop' | 'retryStop' | 'retry'

export interface BackgroundTaskView {
  readonly state: BackgroundTaskState
  readonly tone: ElementPackTone
  /** `elementPack.backgroundTask` 内的状态标题键 */
  readonly titleKey: string
  /** 补充说明键;null = 该态无需说明 */
  readonly hintKey: string | null
  /** 动作:stop=可停止;retryStop=停止失败后的重试停止(显式,不静默吞);retry=失败/超时重试 */
  readonly action: BackgroundTaskAction
  /** 是否仍在进行中(未到终态) */
  readonly busy: boolean
  /** 是否终态 */
  readonly terminal: boolean
}

const BACKGROUND_TASK_STATE_SET: ReadonlySet<string> = new Set<string>(BACKGROUND_TASK_STATES)

export function isBackgroundTaskState(value: string): value is BackgroundTaskState {
  return BACKGROUND_TASK_STATE_SET.has(value)
}

/** 态 → i18n 标题键(`elementPack.backgroundTask.state.<key>`) */
export function backgroundTaskStateKey(state: BackgroundTaskState): string {
  return `state.${state}`
}

/** 动作 → i18n 键(`elementPack.backgroundTask.action.<key>`) */
export function backgroundTaskActionKey(action: BackgroundTaskAction): string {
  return `action.${action}`
}

/**
 * 八态 → 视图判据的**唯一**派发点。
 *
 * switch 穷尽八态、**无 default**:漏改任一态 ⇒ `state` 无法收窄为 `never`,
 * assertNeverTaskState 处编译失败(新增态必须同步补判据,否则构建拦截)。
 * **stopFailed 必须显式渲染**:tone=danger + hint.stopFailed + action=retryStop,
 * 静默留空 = 把「停止失败」伪装成「已停止」,子任务会在用户以为已停时继续跑。
 */
export function backgroundTaskView(state: BackgroundTaskState): BackgroundTaskView {
  switch (state) {
    case 'pending':
      // 待启动:已受理未开跑;此时反悔仍可停(取消待启)。
      return {
        state,
        tone: 'neutral',
        titleKey: backgroundTaskStateKey('pending'),
        hintKey: null,
        action: 'stop',
        busy: true,
        terminal: false,
      }
    case 'running':
      return {
        state,
        tone: 'info',
        titleKey: backgroundTaskStateKey('running'),
        hintKey: null,
        action: 'stop',
        busy: true,
        terminal: false,
      }
    case 'stopping':
      // 正在停止:停止请求已发未完成,不得再给停止入口(重复点击无意义)。
      return {
        state,
        tone: 'neutral',
        titleKey: backgroundTaskStateKey('stopping'),
        hintKey: 'hint.stopping',
        action: 'none',
        busy: true,
        terminal: false,
      }
    case 'stopFailed':
      // **停止失败(显式,不得静默吞)**:子任务仍在运行,必须让用户知道并给重试入口。
      return {
        state,
        tone: 'danger',
        titleKey: backgroundTaskStateKey('stopFailed'),
        hintKey: 'hint.stopFailed',
        action: 'retryStop',
        busy: true,
        terminal: false,
      }
    case 'completed':
      return {
        state,
        tone: 'success',
        titleKey: backgroundTaskStateKey('completed'),
        hintKey: null,
        action: 'none',
        busy: false,
        terminal: true,
      }
    case 'failed':
      // 失败:给重试入口(与 D71 turn failed 同族,重试不回退)。
      return {
        state,
        tone: 'danger',
        titleKey: backgroundTaskStateKey('failed'),
        hintKey: null,
        action: 'retry',
        busy: false,
        terminal: true,
      }
    case 'cancelled':
      // 已取消:用户主动停成,与失败不同形(无重试入口,重开是新任务)。
      return {
        state,
        tone: 'neutral',
        titleKey: backgroundTaskStateKey('cancelled'),
        hintKey: null,
        action: 'none',
        busy: false,
        terminal: true,
      }
    case 'timeout':
      // 已超时:终态但可重试(与 failed 同族,给恢复出路)。
      return {
        state,
        tone: 'warning',
        titleKey: backgroundTaskStateKey('timeout'),
        hintKey: 'hint.timeout',
        action: 'retry',
        busy: false,
        terminal: true,
      }
  }
  return assertNeverTaskState(state)
}

function assertNeverTaskState(state: never): never {
  throw new Error(`unhandled background task state: ${String(state)}`)
}

/**
 * 既有数据面桥接:web 侧 `components/ai/types.ts` AgentStatus 十态(共享层镜像,
 * 真相源在 web;thinking/acting/reflecting/waiting 是运行中的细分阶段,
 * 全部归并 running,不另立第二套状态)。
 */
export const AGENT_STATUS_LITERALS = [
  'idle',
  'pending',
  'thinking',
  'acting',
  'reflecting',
  'waiting',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const
export type AgentStatusLiteral = (typeof AGENT_STATUS_LITERALS)[number]

/** AgentStatus 十态 → 后台子任务八态的唯一归并点。switch 穷尽十态、零 default。 */
export function fromAgentStatus(status: AgentStatusLiteral): BackgroundTaskState {
  switch (status) {
    case 'idle':
      return 'pending'
    case 'pending':
      return 'pending'
    case 'thinking':
      return 'running'
    case 'acting':
      return 'running'
    case 'reflecting':
      return 'running'
    case 'waiting':
      return 'running'
    case 'running':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
  }
  return assertNeverAgentStatus(status)
}

function assertNeverAgentStatus(status: never): never {
  throw new Error(`unhandled agent status: ${String(status)}`)
}

// ---------------------------------------------------------------------------
// ⑤ 反馈问卷化:三段结构 + 免打扰判定 + 分档标签
// ---------------------------------------------------------------------------

/** 分值档位(1-5,穷尽) */
export const SURVEY_SCALES = [1, 2, 3, 4, 5] as const
export type SurveyScale = (typeof SURVEY_SCALES)[number]

export function isSurveyScale(value: number): value is SurveyScale {
  return SURVEY_SCALES.includes(value as SurveyScale)
}

/**
 * 分值 → 分档标签键(`elementPack.feedbackSurvey.scale.<n>`)。
 * switch 穷尽五档、零 default;入参先过 isSurveyScale 收窄,越界由调用方处理。
 */
export function scaleLabelKey(n: SurveyScale): string {
  switch (n) {
    case 1:
      return 'feedbackSurvey.scale.1'
    case 2:
      return 'feedbackSurvey.scale.2'
    case 3:
      return 'feedbackSurvey.scale.3'
    case 4:
      return 'feedbackSurvey.scale.4'
    case 5:
      return 'feedbackSurvey.scale.5'
  }
  return assertNeverScale(n)
}

function assertNeverScale(n: never): never {
  throw new Error(`unhandled survey scale: ${String(n)}`)
}

/**
 * 三选答复(D64 ⑤ 台账原文「三选+可跳过」的正身)。
 * 与五档 SURVEY_SCALES 并存不冲突:五档是**打分**(趋势统计),三选是**本轮结论**
 * (有没有帮上忙),问卷卡渲染的是三选;端内不得再自己列第三个选项集。
 * `elementPack.feedbackSurvey.answer.<key>`。
 */
export const SURVEY_ANSWERS = ['solved', 'partial', 'notSolved'] as const
export type SurveyAnswer = (typeof SURVEY_ANSWERS)[number]

export function isSurveyAnswer(value: string): value is SurveyAnswer {
  return (SURVEY_ANSWERS as readonly string[]).includes(value)
}

/** 答复 → 文案键(`elementPack.feedbackSurvey.answer.<key>`)。switch 穷尽三档、零 default。 */
export function surveyAnswerKey(answer: SurveyAnswer): string {
  switch (answer) {
    case 'solved':
      return 'feedbackSurvey.answer.solved'
    case 'partial':
      return 'feedbackSurvey.answer.partial'
    case 'notSolved':
      return 'feedbackSurvey.answer.notSolved'
  }
  return assertNeverAnswer(answer)
}

function assertNeverAnswer(answer: never): never {
  throw new Error(`unhandled survey answer: ${String(answer)}`)
}

/**
 * 落库载荷形状(**唯一**出口)。后端 `/api/chat/messages/feedback` 现仅收
 * `{ messageId, rating:'like'|'dislike' }`(packages/api-client/src/endpoints/chat.ts:545),
 * 三选 + 评论 + 跳过**无处可落** → 本票只产载荷,建端点/加字段属后端另票。
 */
export interface FeedbackSurveyPayload {
  readonly messageId: string
  /** 三选答复;skip 时为 null(可跳过 = 明确记「未答」,不猜) */
  readonly answer: SurveyAnswer | null
  readonly comment: string | null
  readonly skipped: boolean
}

/** 载荷判定:messageId 空 → null(不落脏票);评论 trim 后空 → null;skip 强制 answer=null。 */
export function feedbackSurveyPayload(input: {
  messageId: string
  answer?: SurveyAnswer | null
  comment?: string | null
  skipped?: boolean
}): FeedbackSurveyPayload | null {
  const id = typeof input.messageId === 'string' ? input.messageId.trim() : ''
  if (!id) return null
  const skipped = input.skipped === true
  const comment = typeof input.comment === 'string' ? input.comment.trim() : ''
  return {
    messageId: id,
    answer: skipped ? null : (input.answer ?? null),
    comment: comment === '' ? null : comment,
    skipped,
  }
}

export interface FeedbackSurveyContext {
  /** 该会话本轮**已经提交过**问卷(已答过不打扰) */
  readonly alreadyAnswered: boolean
  /** 该会话本轮**已经问过**(无论答没答,每会话至多问一次) */
  readonly alreadyAskedInSession: boolean
  /** 本轮是否失败轮次(失败轮次不弹——失败另走错误链路,不掺满意度) */
  readonly turnFailed: boolean
}

/**
 * 免打扰判定(判据正反例):
 *   正例:没答过 ∧ 没问过 ∧ 非失败轮次 → true(问一次)。
 *   反例:alreadyAnswered(已答过)/ alreadyAskedInSession(问过即止,至多一次)/
 *         turnFailed(失败轮次不弹)→ 均 false。
 */
export function shouldShowSurvey(ctx: FeedbackSurveyContext): boolean {
  return !ctx.alreadyAnswered && !ctx.alreadyAskedInSession && !ctx.turnFailed
}

/**
 * 问卷三段结构(question / scale / comment)+ 动作文案键的静态描述表。
 * question 键词包原文(任务原文逐字):「这次回复有没有帮你解决问题?」
 */
export interface FeedbackSurveyState {
  readonly questionKey: 'feedbackSurvey.question'
  /** 五档标签键,序与 SURVEY_SCALES 一致 */
  readonly scaleKeys: readonly string[]
  /** 评论输入占位键(可选填写) */
  readonly commentKey: 'feedbackSurvey.commentPlaceholder'
  readonly submitKey: 'feedbackSurvey.submit'
  readonly dismissKey: 'feedbackSurvey.dismiss'
  readonly submittedKey: 'feedbackSurvey.submitted'
}

export const FEEDBACK_SURVEY_STATE: FeedbackSurveyState = {
  questionKey: 'feedbackSurvey.question',
  scaleKeys: SURVEY_SCALES.map((n) => scaleLabelKey(n)),
  commentKey: 'feedbackSurvey.commentPlaceholder',
  submitKey: 'feedbackSurvey.submit',
  dismissKey: 'feedbackSurvey.dismiss',
  submittedKey: 'feedbackSurvey.submitted',
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
