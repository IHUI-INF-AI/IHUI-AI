// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展侧栏的"活动工作区"唯一状态源(票㉑ 第三枚,2026-09-28)。
 *
 * 这里同时是三件事的交点,所以必须是一处:
 *  1. **委托开关** —— `apps/ai-service/app/routers/llm.py` 的分支是
 *     `if req.workspace_context and tool_name in _FS_DEPENDENT_TOOLS`;没有这里产出的
 *     context,fs 类工具就不回客户端执行,而是落到服务端(`write_file`/`file_edit` 在
 *     `_ADMIN_ONLY_TOOLS` 而对话链 `__user_role` 恒 0 ⇒ 必败)。
 *  2. **闸门的一半** —— `lib/workspace-capability.ts` 的 `fileToolsAllowed()` 读这里的
 *     执行代理注册结果;设了工作区才带文件族,清了就不带。带工具 = 向模型承诺本端能执行。
 *  3. **写能力的当场验证** —— pick 时就要 `mode:'readwrite'`,并确认权限态是 granted,
 *     否则不声明"能执行写类工具"。
 *
 * 2026-09-28 实测(真实产物 `chrome-extension://<id>/sidepanel.html`,Edge headless=new):
 * `mode:'readwrite'` 是被接受的枚举(与 `mode:'read'` 同报"需要用户手势",而 bogus 报 TypeError),
 * 受信任点击后错误从 SecurityError 翻成 AbortError ⇒ 侧栏里点按钮确实能唤起选择器。
 * `queryPermission` / `requestPermission` 在 `FileSystemHandle.prototype` 上均在位。
 *
 * 一条**没有实测**的:只读档句柄调 `createWritable()` 的具体报错(拖放通道取不到句柄)。
 * 所以本模块不依赖"读档写会怎么失败",而是要求读档当场就验证到 readwrite granted。
 */

import {
  detectWorkspaceCapability,
  registerWorkspaceToolExecutor,
  unregisterWorkspaceToolExecutor,
} from './workspace-capability'

export interface ActiveWorkspace {
  /** 目录名(FSA 安全模型只暴露 name,拿不到绝对路径 —— 与 web 同一限制) */
  name: string
  handle: FileSystemDirectoryHandle
}

export type WorkspaceFailureKind = 'unsupported' | 'denied' | 'not-writable' | 'aborted'

export interface WorkspaceFailure {
  kind: WorkspaceFailureKind
  /** DOMException 的 name(语言中立的技术标识,不进界面文案;新文案要走语言包) */
  detail: string
}

export interface PickOutcome {
  workspace: ActiveWorkspace | null
  failure: WorkspaceFailure | null
}

/**
 * 选择器与权限 API 的最小面。刻意自己声明而不 `lib.dom` 全取:
 * 扩展的 tsconfig 未必带 FileSystem* 全局类型,而这三条就是本模块真正用到的全部。
 */
interface PickableWindow {
  showDirectoryPicker?: (opts?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}
interface PermissionQueryableHandle {
  queryPermission?: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
}

let active: ActiveWorkspace | null = null
const listeners = new Set<(ws: ActiveWorkspace | null) => void>()

export function getActiveWorkspace(): ActiveWorkspace | null {
  return active
}

/** 订阅即拿当前值;返回取消函数(组件卸载必须调,否则切工作区会打到已卸载的面板) */
export function subscribeActiveWorkspace(cb: (ws: ActiveWorkspace | null) => void): () => void {
  listeners.add(cb)
  cb(active)
  return () => {
    listeners.delete(cb)
  }
}

function emit(): void {
  for (const cb of [...listeners]) cb(active)
}

/** 执行代理身份带目录名:换一个目录就是一个新的可执行面,旧的那份必须收回 */
const executorIdFor = (name: string) => `sidepanel:${name}`

/**
 * 用户手势里唤起目录选择器。三步都不能省:
 *  ① 能力探测(不在位就直接返回,不装作"点了没反应");
 *  ② `mode:'readwrite'` —— 读档句柄写文件会失败,而失败前用户已经看到一条流中 diff;
 *  ③ 落位前验证 readwrite granted —— 浏览器可以只给读(或用户在选择器里降档),
 *     那种情况下宁可不开委托面,也不要让工具带过去再逐个失败。
 */
export async function pickWorkspaceDirectory(
  win: PickableWindow | undefined = (globalThis as { window?: PickableWindow }).window,
): Promise<PickOutcome> {
  const cap = detectWorkspaceCapability(win as Parameters<typeof detectWorkspaceCapability>[0])
  if (!cap.fsaPick)
    return { workspace: null, failure: { kind: 'unsupported', detail: 'no-picker' } }

  let handle: FileSystemDirectoryHandle
  try {
    handle = await win!.showDirectoryPicker!({ mode: 'readwrite' })
  } catch (err) {
    const e = err as { name?: string }
    const name = e?.name ?? 'Error'
    // 用户主动取消不是故障,但也不能静默:调用方按 kind 决定"不吭声"还是"喊出来"
    if (name === 'AbortError')
      return { workspace: null, failure: { kind: 'aborted', detail: name } }
    return { workspace: null, failure: { kind: 'denied', detail: name } }
  }

  const grantable = handle as unknown as PermissionQueryableHandle
  try {
    let state = (await grantable.queryPermission?.({ mode: 'readwrite' })) ?? 'granted'
    if (state === 'prompt')
      state = (await grantable.requestPermission?.({ mode: 'readwrite' })) ?? 'denied'
    if (state !== 'granted') {
      return { workspace: null, failure: { kind: 'not-writable', detail: state } }
    }
  } catch (err) {
    const e = err as { name?: string }
    return { workspace: null, failure: { kind: 'not-writable', detail: e?.name ?? 'Error' } }
  }

  // 先收旧身份再登记新身份:换目录时若只登记不收回,闸门会一直开着指向一个已经没人用的句柄
  if (active) unregisterWorkspaceToolExecutor(executorIdFor(active.name))
  active = { name: handle.name, handle }
  registerWorkspaceToolExecutor(executorIdFor(handle.name))
  emit()
  return { workspace: active, failure: null }
}

/** 收回执行面:清活动工作区 ⇒ 闸门立刻关 ⇒ 请求不再带文件族(不留"带着工具却没有执行方"的窗口) */
export function clearActiveWorkspace(): void {
  if (active) unregisterWorkspaceToolExecutor(executorIdFor(active.name))
  active = null
  emit()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
