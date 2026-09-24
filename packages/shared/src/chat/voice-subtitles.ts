// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D62 语音字幕与讨论纪要(G-76,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:现有语音栈全部在 `apps/web/src/components/chat/`,
// 无需新建录音栈 ——
//   · `voice-toolbar.tsx`(VoiceToolbar)— 麦克风主按钮 + 三合一 dropdown;
//   · `voice-input.tsx`(VoiceInput)— MediaRecorder→faster-whisper 实时转写 +
//     原生 SpeechRecognition 备选;错误处理只有**一条**笼统文案
//     ("无法访问麦克风,请在浏览器设置中允许麦克风权限"),无权限 / 无设备 /
//     被占用 / 启动失败四类**不分类**;
//   · `voice-stream-speaker.tsx`(VoiceStreamSpeaker)— 流式 done 边沿 TTS 播报,
//     播报状态是组件内 audioRef,**没有全局 speaking 态**;
//   · 两者之间**没有任何互斥**:录音纪要进行中时 TTS 照播,抢麦即双输。
// 因此本票的真实缺口是:① 四类麦克风错误不分类;② 录音与播报无状态机互斥;
// ③ 字幕可见性无"静音 ≠ 隐藏字幕"语义;④ 纪要双视图(讨论纪要 / 任务流)缺判定层。
//
// 本模块与 D71 `turn-status` / D72 `worktree-lifecycle` 同范式:
//   常量 + 纯函数 + 穷尽 switch 零 default + `assertNever`。
// 端内不得再建第二套麦克风错误分类或互斥判定(禁止在组件里写
// `err === 'NotAllowedError' ? … : …`)。
//
// **平台豁免标注**:`PLATFORM_EXCLUSIVE = 'miniapp'` —— 本判定层的错误分类
// 依赖浏览器 `getUserMedia` 的 DOMException 命名,字幕条也依赖 DOM 渲染;
// miniapp 端有原生录音 API(wx.getRecorderManager)与原生字幕位,**整族豁免**,
// 不参与 miniapp 侧的同名文案 / 判据 parity。渲染位以
// `data-platform-exempt="miniapp"` 落标,审计脚本按此跳过。

/** 词包命名空间(web 侧 `useTranslations('ai.pane.voiceSubtitles')`) */
export const VOICE_SUBTITLES_NAMESPACE = 'ai.pane.voiceSubtitles' as const

/** 平台豁免标注:本判定层与渲染位为 web 独占,miniapp 端整族豁免(见文件头) */
export const PLATFORM_EXCLUSIVE = 'miniapp' as const

// ---------------------------------------------------------------------------
// 麦克风四类错误
// ---------------------------------------------------------------------------

/** 麦克风错误四类(取值即 i18n 键片段;`ai.pane.voiceSubtitles.micError.<key>`) */
export const MIC_ERROR_KINDS = ['noPermission', 'noDevice', 'occupied', 'startFailed'] as const
export type MicErrorKind = (typeof MIC_ERROR_KINDS)[number]

export interface MicErrorView {
  readonly kind: MicErrorKind
  /** 语义色档:无权限 / 无设备 = 环境问题(warning);被占用 = 可等待(info);启动失败 = 未知(danger) */
  readonly tone: 'warning' | 'info' | 'danger'
  /** `ai.pane.voiceSubtitles` 内的标题键 */
  readonly titleKey: string
  /** `ai.pane.voiceSubtitles` 内的 aria-label 键(读屏用) */
  readonly ariaKey: string
  /** 仅重试能否恢复:false = 必须先改环境(授权 / 接设备),提示文案要指路 */
  readonly recoverableByRetry: boolean
}

/**
 * 四类 → 视图判据的**唯一**派发点。switch 穷尽四类、**无 default**:
 * 漏改任一类 ⇒ `kind` 无法收窄为 `never`,`assertNeverKind` 处编译失败。
 */
export function micErrorView(kind: MicErrorKind): MicErrorView {
  switch (kind) {
    case 'noPermission':
      // 无权限:必须去浏览器/系统设置授权,重试无效 → 指路文案
      return { kind, tone: 'warning', titleKey: `micError.${kind}`, ariaKey: `micErrorAria.${kind}`, recoverableByRetry: false }
    case 'noDevice':
      // 无设备:必须先接入麦克风,重试无效 → 指路文案
      return { kind, tone: 'warning', titleKey: `micError.${kind}`, ariaKey: `micErrorAria.${kind}`, recoverableByRetry: false }
    case 'occupied':
      // 被占用:关掉占用的应用即可,单纯重试也可能撞回 → 可重试但建议先释放
      return { kind, tone: 'info', titleKey: `micError.${kind}`, ariaKey: `micErrorAria.${kind}`, recoverableByRetry: true }
    case 'startFailed':
      // 启动失败:未知原因,给"请重试"兜底
      return { kind, tone: 'danger', titleKey: `micError.${kind}`, ariaKey: `micErrorAria.${kind}`, recoverableByRetry: true }
  }
  return assertNeverKind(kind)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverKind(kind: never): never {
  throw new Error(`unhandled mic error kind: ${String(kind)}`)
}

/**
 * 浏览器 `getUserMedia` / `MediaRecorder` 异常 → 四类的唯一归一入口。
 * 只认 DOMException 命名(NotAllowedError / NotFoundError / NotReadableError 等),
 * 其余一律兜底 startFailed —— 与 voice-input.tsx 现有 catch-all 对齐,不丢错误态。
 */
export function classifyMicError(error: unknown): MicErrorKind {
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'noPermission'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'noDevice'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'occupied'
    default:
      // AbortError / TypeError / 未知 → 启动失败兜底
      return 'startFailed'
  }
}

/** 四类 → i18n 标题键(`ai.pane.voiceSubtitles.micError.<kind>`) */
export function micErrorTitleKey(kind: MicErrorKind): string {
  return `micError.${kind}`
}

/** 四类 → i18n aria-label 键(`ai.pane.voiceSubtitles.micErrorAria.<kind>`) */
export function micErrorAriaKey(kind: MicErrorKind): string {
  return `micErrorAria.${kind}`
}

// ---------------------------------------------------------------------------
// 录音纪要 ↔ 播报(TTS)互斥(本票核心)
// ---------------------------------------------------------------------------

/** 语音活动三态:idle = 无活动;recordingSummary = 录音纪要进行中;speaking = 播报(TTS)进行中 */
export const VOICE_ACTIVITIES = ['idle', 'recordingSummary', 'speaking'] as const
export type VoiceActivity = (typeof VOICE_ACTIVITIES)[number]

/**
 * 「录音纪要进行中」与「播报(TTS)进行中」**不得同时激活**(状态机层面互斥)。
 * 判定层只回布尔;UI 层拿 false 时给 `conflict` 互斥提示文案。
 * 穷举正反例见 `__tests__/voice-subtitles.test.ts`(3×3 = 9 组合全覆盖)。
 */
export function voiceModeConflict(a: VoiceActivity, b: VoiceActivity): boolean {
  return (
    (a === 'recordingSummary' && b === 'speaking') ||
    (a === 'speaking' && b === 'recordingSummary')
  )
}

export type VoiceModeDecision =
  | { readonly ok: true; readonly activity: VoiceActivity }
  | {
      readonly ok: false
      readonly from: VoiceActivity
      readonly to: VoiceActivity
      /** `ai.pane.voiceSubtitles` 内的互斥提示键 */
      readonly messageKey: 'conflict'
    }

/**
 * 状态机迁移判定:current → next。
 * 只有「录音纪要 ↔ 播报」跨向迁移被拦;同态(含同为 recordingSummary / 同为
 * speaking)是幂等无操作,不是冲突 —— 拦同态会把正常的重复点击也误报。
 */
export function resolveVoiceMode(next: VoiceActivity, current: VoiceActivity): VoiceModeDecision {
  if (voiceModeConflict(next, current)) {
    return { ok: false, from: current, to: next, messageKey: 'conflict' }
  }
  return { ok: true, activity: next }
}

/** 互斥提示 → i18n 键(`ai.pane.voiceSubtitles.conflict`) */
export function conflictMessageKey(): string {
  return 'conflict'
}

// ---------------------------------------------------------------------------
// 字幕可见性(静音 ≠ 隐藏字幕)
// ---------------------------------------------------------------------------

export const SUBTITLE_STATES = ['hidden', 'live', 'mutedSubtitles'] as const
export type SubtitleState = (typeof SUBTITLE_STATES)[number]

export interface SubtitleView {
  readonly visible: boolean
  readonly state: SubtitleState
  /** `ai.pane.voiceSubtitles` 内的标题键 */
  readonly titleKey: string
  /** `ai.pane.voiceSubtitles` 内的 aria-label 键 */
  readonly ariaKey: string
}

/**
 * 字幕可见性判定:
 *   · 未播报 → 字幕隐藏(没话可显,留空壳只会让读屏念空条);
 *   · 播报中且未静音 → 字幕显示(live);
 *   · 播报中且已静音 → **字幕仍然显示**(mutedSubtitles)——
 *     「静音并显示字幕」语义:静音只是关掉音频输出,字幕是播报的可见替身,
 *     静音 ≠ 隐藏字幕。这条由用例钉死,任何人改成"静音即隐藏"必须在用例层翻案。
 */
export function subtitleView(speaking: boolean, muted: boolean): SubtitleView {
  if (!speaking) {
    return { visible: false, state: 'hidden', titleKey: 'subtitleTitle', ariaKey: 'ariaLabel' }
  }
  if (muted) {
    return { visible: true, state: 'mutedSubtitles', titleKey: 'muteAndShowSubtitles', ariaKey: 'ariaLabel' }
  }
  return { visible: true, state: 'live', titleKey: 'subtitleTitle', ariaKey: 'ariaLabel' }
}

// ---------------------------------------------------------------------------
// 讨论纪要 / 任务流双视图
// ---------------------------------------------------------------------------

/** 纪要双视图(取值即 i18n 键片段;`ai.pane.voiceSubtitles.view.<key>`) */
export const SUMMARY_VIEWS = ['discussionSummary', 'taskFlow'] as const
export type SummaryView = (typeof SUMMARY_VIEWS)[number]

const SUMMARY_VIEW_SET: ReadonlySet<string> = new Set<string>(SUMMARY_VIEWS)

export function isSummaryView(value: string): value is SummaryView {
  return SUMMARY_VIEW_SET.has(value)
}

/** 双视图 → i18n 标签键(`ai.pane.voiceSubtitles.view.<view>`) */
export function summaryViewLabelKey(view: SummaryView): string {
  return `view.${view}`
}

/**
 * 视图切换判定:二视图互为对侧。switch 穷尽两视图、无 default(与 micErrorView
 * 同范式);新增第三视图时此函数编译失败,必须补对侧语义。
 */
export function toggleSummaryView(current: SummaryView): SummaryView {
  switch (current) {
    case 'discussionSummary':
      return 'taskFlow'
    case 'taskFlow':
      return 'discussionSummary'
  }
  return assertNeverSummaryView(current)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverSummaryView(view: never): never {
  throw new Error(`unhandled summary view: ${String(view)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
