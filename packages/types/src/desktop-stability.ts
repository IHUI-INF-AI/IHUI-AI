/**
 * 桌面稳定性遥测契约 —— crashKind 封闭集的唯一真相源(TS 侧,2026-09-27 立)。
 *
 * 上游事实(票面已复验):上游 ZCode `packages/desktop/src/main/desktopStabilityTelemetry.ts:17`
 * 定义 5s ANR / 30s 挂死两档、`:44` 定义 crashKind 封闭集;我方此前全仓
 * `watchdog|unresponsive|longtask|PerformanceObserver` 生产代码零命中(仅 e2e 探针用过
 * PerformanceObserver),崩溃上报链路上游没有桌面生产者 ⇒ 管理端桌面崩溃率恒为 0 的那一格
 * 补的就是这份生产者契约。
 *
 * **类型只许一份**:本文件是 TS 侧唯一封闭集;Rust 侧
 * `apps/desktop/src-tauri/src/stability_watch.rs` 的 `STABILITY_KINDS` 与本枚提交落地、
 * 双方单测各自锁死成员清单(两侧对账靠"改一侧必红另一侧的测试"钉住,没有第二份手抄表)。
 * 禁止在端内散写字符串字面量 —— 消费方一律 `import { CRASH_KINDS, type CrashKind } from '@ihui/types'`。
 *
 * ⚠️ **前端生效依赖生产部署**:桌面端 WebView 加载的是线上站点(https://aizhs.top),
 * 本包改动要等 web 生产部署 + 桌面端重新加载页面后才在真机生效 —— 代码合入 ≠ 已生效。
 */

/**
 * 崩溃/卡顿事件的封闭分类。
 *
 * 成员按**我方实际事件源**裁剪(不是照抄上游全集):
 * - `anr`:渲染进程 5s 级主线程卡顿(前端看门狗 drift 达 5s 档,前端自报);
 * - `hang`:渲染进程 30s 级挂死(前端看门狗 drift 达 30s 档,前端自报);
 * - `renderer-gone`:WebView 渲染端异常销毁(Tauri 主进程 Destroyed 且非用户主动退出,
 *   Rust 侧记录进积压、下次启动由前端取回补报;Tauri 2.11 公开事件面没有
 *   Electron 的 render-process-gone,以"非退出路径的 Destroyed"为代理,见 stability_watch.rs 头注);
 * - `startup-failure`:main 窗口创建失败导致进程退出(Rust 侧记录,同走积压补报)。
 */
export const CRASH_KINDS = ['anr', 'hang', 'renderer-gone', 'startup-failure'] as const

export type CrashKind = (typeof CRASH_KINDS)[number]

/** Rust → 前端稳定性事件的载荷(实时链与积压补投共用同一形状)。 */
export interface DesktopStabilityNotice {
  readonly kind: CrashKind
  /** 事件来源:live = Rust 实时 emit;backlog = 启动时从 Rust 积压取回(上次会话的)。 */
  readonly source: 'live' | 'backlog'
  /** 可读细节(如最长 longtask 时长 / 销毁原因),上报前统一过 redactCrashText。 */
  readonly detail?: string
  /** 事件发生时刻(epoch ms)。Rust 积压项携带原时刻,实时项由前端填当前时间。 */
  readonly at: number
}
