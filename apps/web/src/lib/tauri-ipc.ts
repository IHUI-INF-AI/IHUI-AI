// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Channel as CoreChannel, invoke as coreInvoke } from '@tauri-apps/api/core'
import * as coreDialog from '@tauri-apps/plugin-dialog'
import * as coreEvent from '@tauri-apps/api/event'
import * as coreWindow from '@tauri-apps/api/window'
import type { EventCallback, Options as ListenOptions, UnlistenFn } from '@tauri-apps/api/event'
import type {
  OpenDialogOptions,
  OpenDialogReturn,
  SaveDialogOptions,
} from '@tauri-apps/plugin-dialog'

/**
 * RP-3(L04/P0)桌面 IPC 的**唯一**原生能力命名空间。
 *
 * 桌面壳是 Tauri 而非 Electron:没有 preload / contextBridge / ipcRenderer 这三层,
 * 等价的暴露面是「web 生产代码里谁能拿到 @tauri-apps/* 的原生能力」。这里把 invoke、
 * Channel、事件、窗口、对话框全部收进一个对象,并把键数钉在 20 以内;业务代码一律
 * `import { ihuiIpc } from '@/lib/tauri-ipc'`,不得再直接 import @tauri-apps/*。
 *
 * 与 `withGlobalTauri:false` 配套:不往 window 上挂任何全局对象,只给渲染层这一枚模块级
 * 命名空间。每枚键都必须带 owner / purpose 注释,由 check-tauri-ipc-budget.mjs 静态钉住。
 */

export type IpcChannel<T> = CoreChannel<T>

export const ihuiIpc = {
  /** owner: desktop-platform · purpose: 所有 Rust 命令与 plugin 命令的唯一 invoke 出口,统一错误归一由调用方 tauri-bridge 负责 */
  call: <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
    args === undefined ? coreInvoke<T>(cmd) : coreInvoke<T>(cmd, args),
  /** owner: desktop-platform · purpose: 长任务进度回传的 Channel 构造器,只用于 Rust 侧进度回调参数 */
  channel: <T>(): CoreChannel<T> => new CoreChannel<T>(),
  /** owner: desktop-platform · purpose: Rust emit 事件订阅;返回 unlisten,由调用方在卸载时调用 */
  listen: <T>(
    event: string,
    handler: EventCallback<T>,
    options?: ListenOptions,
  ): Promise<UnlistenFn> => coreEvent.listen<T>(event, handler, options),
  /** owner: desktop-platform · purpose: 当前 WebView 窗口句柄,只用于窗口标题/尺寸/主题/监听 */
  getCurrentWindow: (): ReturnType<typeof coreWindow.getCurrentWindow> =>
    coreWindow.getCurrentWindow(),
  /** owner: desktop-platform · purpose: 枚举窗口句柄,只供画中画接管查目标窗 */
  getAllWindows: (): ReturnType<typeof coreWindow.getAllWindows> => coreWindow.getAllWindows(),
  /** owner: desktop-platform · purpose: 原生文件选择对话框(打开),不暴露任意路径写能力 */
  openDialog: <T extends OpenDialogOptions>(options?: T): Promise<OpenDialogReturn<T>> =>
    coreDialog.open<T>(options),
  /** owner: desktop-platform · purpose: 原生文件选择对话框(保存),不暴露任意路径写能力 */
  saveDialog: (options?: SaveDialogOptions): Promise<string | null> => coreDialog.save(options),
} as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
