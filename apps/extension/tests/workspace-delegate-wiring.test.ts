// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票㉑ 第三枚:工作区状态源与委托链的接线自证。
 *
 * 两组判据,缺一组都会留下"看着齐了其实空转"的口子:
 *  ① store 行为:pick 成功才登记执行代理、四种失败一种都不登记、clear 必须收回 ——
 *     闸门(`workspace-capability.fileToolsAllowed`)读的就是这个登记结果;
 *     收回执行代理之外还必须收回共享层那份工作区上下文缓存(补账②),否则换一个目录
 *     仍可能吃到上一个目录的快照;
 *  ② ChatPage 源码级接线:委托回调 / 上下文上行 / 审批回传 / 流末收回,
 *     任一条被摘掉即红(本仓最高频失效型是"造好没装车",守门 64/70/81/115 同族)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { invalidateWorkspaceContextCache } from '@ihui/shared/chat/workspace-context-loader'

/**
 * 缓存出口做成 spy:本端 store 与该缓存的**关系**就是要判的行为(换目录必须收回旧快照),
 * 而把它按真身跑进这里判不了"到底有没有被叫到"。
 * 判据面(源码级)那条在 `packages/shared/src/chat/__tests__/workspace-context-cache.test.ts` ⑥,
 * 两条互补:那条防"搬家搬一半",这条防"搬完了但没接"。
 */
vi.mock('@ihui/shared/chat/workspace-context-loader', () => ({
  invalidateWorkspaceContextCache: vi.fn(),
}))

import {
  clearActiveWorkspace,
  getActiveWorkspace,
  pickWorkspaceDirectory,
  subscribeActiveWorkspace,
} from '../lib/workspace-store'
import { hasWorkspaceToolExecutor } from '../lib/workspace-capability'

const HERE = dirname(fileURLToPath(import.meta.url))
/** tests → extension 包根:少算一层会拼出 apps/entrypoints/... 这种"看着像"的路径,
 *  而它报的是 ENOENT 而不是判红 —— 所以根必须当场验一枚一定存在的文件。 */
const ROOT = resolve(HERE, '..')
if (!readFileSync(join(ROOT, 'package.json'), 'utf8').includes('"@ihui/extension"')) {
  throw new Error(`ROOT 解析异常:${ROOT} 的 package.json 不是 @ihui/extension`)
}
const CHAT_PAGE = join(ROOT, 'entrypoints/sidepanel/pages/ChatPage.tsx')

/**
 * 本端 tsconfig 用的那版 lib.dom **不带** `FileSystemHandle.queryPermission / requestPermission`
 * (TS lib 的 FSA 类型只到句柄本身),所以 `Partial<FileSystemDirectoryHandle>` 装不下这两个方法,
 * 写它会得 TS2353「不存在该属性」—— 那不是"浏览器没有这个 API"(实测原型上就是 function),
 * 而是类型面比运行面窄。刻意用本地形状描述伪造象,只在交给被测函数时做一次窄转宽。
 */
interface FakePickerHandle {
  name: string
  queryPermission?: (d: { mode: string }) => Promise<string>
  requestPermission?: (d: { mode: string }) => Promise<string>
}

function fakeWin(handle: FakePickerHandle | null, err?: unknown) {
  return {
    showDirectoryPicker: () =>
      err ? Promise.reject(err) : Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
  }
}
const writableHandle = (name: string, state = 'granted'): FakePickerHandle => ({
  name,
  queryPermission: () => Promise.resolve(state),
  requestPermission: () => Promise.resolve(state),
})

afterEach(() => clearActiveWorkspace())

describe('① store:执行代理只在真有可写句柄时登记', () => {
  it('没有选择器(非浏览器宿主)⇒ unsupported,且不登记执行代理', async () => {
    const r = await pickWorkspaceDirectory({})
    expect(r.failure?.kind).toBe('unsupported')
    expect(getActiveWorkspace()).toBeNull()
    expect(hasWorkspaceToolExecutor()).toBe(false)
  })

  it('readwrite 验证不到 granted ⇒ not-writable,同样不登记(宁可不带工具)', async () => {
    const r = await pickWorkspaceDirectory(
      fakeWin({ name: 'proj', queryPermission: () => Promise.resolve('prompt') }),
    )
    expect(r.failure?.kind).toBe('not-writable')
    expect(getActiveWorkspace()).toBeNull()
    expect(hasWorkspaceToolExecutor()).toBe(false)
  })

  it('用户取消 ⇒ aborted:不登记,也不当成故障写进界面态', async () => {
    const r = await pickWorkspaceDirectory(fakeWin(null, { name: 'AbortError' }))
    expect(r.failure?.kind).toBe('aborted')
    expect(hasWorkspaceToolExecutor()).toBe(false)
  })

  it('拿到可写句柄 ⇒ 活动工作区 + 执行代理登记(闸门这才放行文件族)', async () => {
    const r = await pickWorkspaceDirectory(fakeWin(writableHandle('demo')))
    expect(r.failure).toBeNull()
    expect(getActiveWorkspace()?.name).toBe('demo')
    expect(hasWorkspaceToolExecutor()).toBe(true)
  })

  it('clear 收回执行代理 ⇒ 闸门立刻关,不留"带着工具却没有执行方"的窗口', async () => {
    await pickWorkspaceDirectory(fakeWin(writableHandle('demo2')))
    expect(hasWorkspaceToolExecutor()).toBe(true)
    clearActiveWorkspace()
    expect(getActiveWorkspace()).toBeNull()
    expect(hasWorkspaceToolExecutor()).toBe(false)
  })

  it('换一个目录 ⇒ 旧身份被收回,只剩新身份在登记', async () => {
    await pickWorkspaceDirectory(fakeWin(writableHandle('A')))
    await pickWorkspaceDirectory(fakeWin(writableHandle('B')))
    clearActiveWorkspace() // 只应清掉当前活动的那个
    expect(hasWorkspaceToolExecutor()).toBe(false)
  })

  it('订阅者取消后不再收回调(面板卸载不得被后续状态打中)', async () => {
    const seen: (string | null)[] = []
    const off = subscribeActiveWorkspace((ws) => seen.push(ws?.name ?? null))
    off()
    await pickWorkspaceDirectory(fakeWin(writableHandle('C')))
    expect(seen).toEqual([null]) // 取消订阅后那次 emit 不得到达
  })
})

describe('①′ 换目录 / 清目录必须收回共享缓存那一份快照', () => {
  it('pick 第二个目录时清第一个的名字,clear 时清当前名字', async () => {
    const spy = vi.mocked(invalidateWorkspaceContextCache)
    spy.mockClear()
    await pickWorkspaceDirectory(fakeWin(writableHandle('first')))
    await pickWorkspaceDirectory(fakeWin(writableHandle('second')))
    // 缓存按目录名建索引,而 name 只是键不是身份:不清就得等签名恰好全等才重载
    expect(spy).toHaveBeenCalledWith('first')
    clearActiveWorkspace()
    expect(spy).toHaveBeenCalledWith('second')
  })
})

describe('② ChatPage 接线:摘掉任一条即红', () => {
  const src = readFileSync(CHAT_PAGE, 'utf8')
  const flat = src.replace(/\s+/g, ' ')

  it('workspaceContext 与 workspacePath 真被带上,且来自同一句读到的活动工作区', () => {
    expect(flat).toContain('workspacePath: workspace?.name')
    expect(flat).toContain('workspaceContext,')
    // 票㉑ 补账②:请求路径必须走**带缓存**的那一份。无缓存版本每轮全扫一遍目录树,
    // 大工作区下"发一句话"要先等一次遍历 —— 而它不会因为"结果一样"而报错,只会慢。
    expect(flat).toContain('loadWorkspaceContextCached(workspace.handle)')
    expect(flat).not.toContain('loadWorkspaceContext(workspace.handle)')
  })

  it('onToolDelegate:有句柄走共享执行器,没句柄也必须回传错误(不得让后端干等)', () => {
    expect(flat).toContain('onToolDelegate: async (event) =>')
    expect(flat).toContain('executeWorkspaceTool(event.tool_name, event.args, ws.handle)')
    expect(flat).toMatch(
      /if \(!ws\) \{[\s\S]*?postToolResult\(event\.session_id, event\.tool_call_id, null, 'No active workspace'\)/,
    )
    expect(flat).toContain(
      'postToolResult(event.session_id, event.tool_call_id, exec.result, exec.error)',
    )
  })

  it('onToolApproval 注册(这条回调本身是 api-client 的解析开关,不注册就根本不解析该帧)', () => {
    expect(flat).toContain('onToolApproval: (event) =>')
    expect(flat).toContain('setPendingApproval(event)')
  })

  it('审批回传缺 sessionId 不发、成功才收横幅、失败要喊', () => {
    expect(flat).toMatch(/if \(!evt\?\.sessionId\) return/)
    expect(flat).toMatch(
      /await postToolApprovalResponse\(\{[\s\S]*?sessionId: evt\.sessionId,[\s\S]*?approvalId: evt\.approvalId,[\s\S]*?decision,[\s\S]*?scope,/,
    )
    // 顺序判据只看 resolveApproval 函数体内部:整篇文件里 `setPendingApproval(null)`
    // 还出现在流结束的 finally 里(那是另一条判据,见下一条),按全文件 indexOf 比会拿错锚。
    const body = flat.slice(flat.indexOf('const resolveApproval = async'))
    const okIdx = body.indexOf('setPendingApproval(null)')
    const postIdx = body.indexOf('await postToolApprovalResponse(')
    expect(okIdx).toBeGreaterThan(postIdx)
    expect(flat).toMatch(/catch \(err\) \{\s*setError\(formatSSEError\(err\)\.message\)/)
  })

  it('流结束必收回横幅(finally 里),否则按钮指向已结束的轮次', () => {
    expect(flat).toMatch(/finally \{[\s\S]*?setPendingApproval\(null\)/)
  })

  it('两个新组件都真被渲染,不是只 import 进来供着', () => {
    expect(flat).toContain('<WorkspacePicker />')
    expect(flat).toContain(
      '<ToolApprovalBanner event={pendingApproval} onResolve={resolveApproval} />',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
