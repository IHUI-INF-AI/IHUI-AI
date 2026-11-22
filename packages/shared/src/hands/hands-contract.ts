// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Hands(屏幕即手)协议 —— Android AccessibilityService 与 apps/ai-service 的通信契约(2026-10-26 立)。
 *
 * 与 nanoMuse 对比判出的硬差距「屏幕即手」在此落地:我们此前端侧完全没有 Android 无障碍能力,
 * 这条契约把「端上执行权」这一格从空洞补成有协议、可后续真机验证。
 *
 * 流转(对照 dispatch.ts 的跨端任务调度风格 —— 那里管「委派/结果」,这里管「端上执行」):
 *   ai-service ──HandsCommand──▶ AccessibilityOperatorService(端)
 *   ai-service ◀──HandsResult─── AccessibilityOperatorService(端,经 HandsBridge)
 *
 * 字段级与端侧 `apps/mobile-rn/android/app/src/main/java/zh/ai/sq/hands/HandsContract.kt`
 * 对齐(人工同步;Kotlin 端是同一组概念的类型翻译,不引入额外字段)。
 *
 * 设计约定:所有结构纯值、可 JSON 序列化;端侧不持有 Android 对象(`Bounds` 已拍平矩形)。
 */

/** 命令类型:click 点击 / type 输入 / scroll 滚动 / back 返回 / snapshot 采集界面树。 */
type HandsCommandType = 'click' | 'type' | 'scroll' | 'back' | 'snapshot'

/** 滚动方向(仅 scroll 命令使用)。 */
export type ScrollDirection = 'up' | 'down' | 'left' | 'right'

/**
 * 目标选择器:按视图 id / 可见文本 / 屏幕绝对坐标 之一定位。
 * 与端侧 `HandsTarget`(sealed interface)对齐。
 */
export type HandsTarget =
  | { kind: 'viewId'; viewId: string }
  | { kind: 'text'; text: string; exact?: boolean }
  | { kind: 'coords'; x: number; y: number }

/** 一条 Hands 命令。`id` 用于与 `HandsResult.id` 对账。 */
export interface HandsCommand {
  id: string
  type: HandsCommandType
  /** BACK / SNAPSHOT 时为 undefined。 */
  target?: HandsTarget
  /** TYPE 命令要输入的文本。 */
  text?: string
  /** SCROLL 方向。 */
  direction?: ScrollDirection
  /** SCROLL 滚动距离(像素);缺省端侧取一屏高度。 */
  distance?: number
}

/** 屏幕矩形(由 Android Rect 拍平,纯值)。 */
export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** 单节点界面树表示(从 AccessibilityNodeInfo 抽取,不持有 Android 对象)。 */
export interface UiNodeSchema {
  viewId: string | null
  text: string | null
  className: string | null
  bounds: Bounds
  clickable: boolean
  scrollable: boolean
  editable: boolean
  contentDescription: string | null
  children?: UiNodeSchema[]
}

/** 一次界面快照:根节点 + 采集时间戳(毫秒)。 */
export interface UiTreeSchema {
  root: UiNodeSchema
  capturedAt: number
}

/** 执行结果状态。 */
type HandsStatus = 'success' | 'failure' | 'unsupported'

/**
 * 一条命令的执行结果。
 * `uiTree` 在 snapshot 成功时附带;`screenshotAvailable` 为截屏占位(端侧暂不真正截屏,
 * 仅记录「是否具备采集意图/能力」,真机验证阶段再补 MediaProjection 实现)。
 */
export interface HandsResult {
  id: string
  status: HandsStatus
  error?: string
  uiTree?: UiTreeSchema
  screenshotAvailable?: boolean
  /** 执行回执(如实际点击坐标、动作类型),便于调试与对账。 */
  detail?: string
}

/**
 * 传输信封:WebSocket/本地通道上实际跑的是这个,command/result 套一层便于对账与版本化。
 * `v` 固定 1,避免 ai-service 与老端侧不兼容;`deviceId` 复用 dispatch.ts 的设备寻址。
 */
export interface HandsEnvelope<TPayload> {
  v: 1
  kind: 'command' | 'result'
  deviceId: string
  payload: TPayload
}
