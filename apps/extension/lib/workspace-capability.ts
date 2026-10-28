// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展端"本地工作区"能力的唯一判据(票㉑ 第一枚,2026-09-28 立)。
 *
 * 立因:扩展此前**完全不带**文件族工具,理由是"带过去就是每次必失败"(见
 * `lib/ui-control-tools.ts` 的 `toolsForChatRequest` 头注,四条实测)。那句结论要翻,
 * 前提是本端真有一个**能执行的委托面**;而"有没有委托面"和"这个浏览器能不能给用户
 * 一个目录句柄"是两件事,过去都只写在注释里。注释不能挡住一次顺手放行,所以摆成代码。
 *
 * 2026-09-28 在真实产物上的实测(`.output/chrome-mv3/sidepanel.html`,Edge/Chromium headless=new):
 *  - `isSecureContext: true`,`typeof showDirectoryPicker === 'function'`(与同机 https 对照页同形);
 *  - `mode:'read'` 与 `mode:'readwrite'` 都**被接受**(报的是 SecurityError「需要用户手势」,
 *    而 `mode:'bogus'` 报 TypeError「无法解析枚举」)⇒ 写档在本 build 是合法枚举值;
 *  - 注入一次受信任点击后,错误从 SecurityError 翻成 `AbortError: The user aborted a request`
 *    ⇒ 用户激活判定**通过**了,调用走到了选择器那一步(headless 没有对话框可答,才中止);
 *  - `FileSystemHandle.prototype.queryPermission / requestPermission`、
 *    `FileSystemFileHandle.prototype.createWritable`、`navigator.storage.getDirectory()` 全在位。
 *
 * 一条**没量到**的:只读档句柄调 `createWritable()` 具体报什么(拖放通道取不到句柄)。
 * 所以本端不依赖"读档写文件会怎么失败"这个假设 —— 它要求 pick 时就要 `readwrite`,
 * 并用 `queryPermission({mode:'readwrite'})` 当场验一遍,验不过就不声明写能力(见 `permissionQuery`)。
 */

/** 注入面:测试与非浏览器宿主(如 content script 里没有 window)都传自己那份进来。 */
export interface PickerCapableWindow {
  isSecureContext?: boolean
  showDirectoryPicker?: unknown
  FileSystemHandle?: { prototype?: { queryPermission?: unknown } }
}

export interface WorkspaceCapability {
  /** 安全上下文:非 secure context 下 FSA 整个不暴露(chrome-error:// 与 http:// 实测皆 undefined) */
  secureContext: boolean
  /** 目录选择器可用 */
  fsaPick: boolean
  /** 权限查询可用 —— 拿不到就不声明"我能写",因为写能力需要当场验证 */
  permissionQuery: boolean
}

/**
 * 只认 `typeof === 'function'`,不做特性名猜测。
 * 默认读 `globalThis.window`:测试环境是 node(`window` 不存在)⇒ 三项全 false,
 * 这正是"探测不到就保持今天的状态"的落点,不是需要额外兜住的缺陷。
 */
export function detectWorkspaceCapability(
  win: PickerCapableWindow | undefined = typeof globalThis === 'undefined'
    ? undefined
    : (globalThis as { window?: PickerCapableWindow }).window,
): WorkspaceCapability {
  if (!win) return { secureContext: false, fsaPick: false, permissionQuery: false }
  return {
    secureContext: win.isSecureContext === true,
    fsaPick: typeof win.showDirectoryPicker === 'function',
    permissionQuery: typeof win.FileSystemHandle?.prototype?.queryPermission === 'function',
  }
}

/**
 * 「此刻有没有人能执行文件族工具」。
 *
 * 由委托面在**确实拿到活动工作区句柄**时注册、句柄失效/面板卸载时注销 —— 一个 id 一份,
 * 用计数而不是布尔,是因为 sidepanel 与 options 页可能同时存活,任一在位就都算有人接。
 * 这一格是防"promise-then-fail"的正闸:工具带过去 = 向模型承诺本端能执行。
 */
const executors = new Set<string>()

export function registerWorkspaceToolExecutor(id: string): void {
  executors.add(id)
}

export function unregisterWorkspaceToolExecutor(id: string): void {
  executors.delete(id)
}

export function hasWorkspaceToolExecutor(): boolean {
  return executors.size > 0
}

/**
 * 能力 ∧ 委托面 才允许带文件族。两条缺任意一条 ⇒ 只带 UI 操控族(即今天的行为)。
 *
 * 刻意不把"有委托面"当充分条件:能力缺失(如非安全上下文)时,pick 这一步就不可能成,
 * 委托面注册不上,而请求已经把工具发出去了 —— 症状是流中出现一条 diff、执行永远失败。
 */
export function fileToolsAllowed(capability?: WorkspaceCapability): boolean {
  const cap = capability ?? detectWorkspaceCapability()
  return hasWorkspaceToolExecutor() && cap.secureContext && cap.fsaPick && cap.permissionQuery
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
