// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * tool_search 响应经济学 —— 重复检索不重复返回 schema;空结果给近名落点。
 *
 * 立因:`revealed` 命中的 schema 已经进模型前缀,同一条查询再查一次仍整段返回,
 * 实测 `合并分支` 重复一次 1,416B、`浏览器截图` 731B,全是重复占位。
 * 空结果一侧:光列 113 个延迟工具名,模型改不出词;给 3 个近名(含错拼档)才有下一句。
 */
import { describe, expect, it } from 'vitest'

import '../src/tools/index.js'
import { listTools, registerTools } from '../src/tools/index.js'
import { createToolSearchTool } from '../src/tools/tool-search.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { HR_TOOLS } from '../src/tools/hr.js'
import { GIT_TOOLS } from '../src/tools/git.js'
import { GIT_ADVANCED_TOOLS } from '../src/tools/git-advanced.js'
import { BROWSER_TOOLS } from '../src/tools/browser.js'
import { createFileEditTools } from '../src/tools/file-edit.js'

const CTX = {
  workspacePath: process.cwd(),
  sessionId: 'tool-search-economy',
  turnId: 'turn-1',
  permissions: { mode: 'default' },
} as never

const FAMILIES = [BUILTIN_TOOLS, HR_TOOLS, GIT_TOOLS, GIT_ADVANCED_TOOLS, BROWSER_TOOLS, createFileEditTools(CTX)]

function setup() {
  registerTools(FAMILIES.flat() as never)
  const tools = listTools()
  const revealed = new Set<string>()
  return { tools, revealed, search: createToolSearchTool({ revealed, tools: () => tools }) }
}

describe('tool_search 响应经济学', () => {
  it('同一查询重复检索:第二次不再整段返回 schema,体量降到 1/3 以下', async () => {
    const { search, revealed } = setup()
    const first = await search.execute({ queries: ['合并分支'] }, CTX)
    const repeat = await search.execute({ queries: ['合并分支'] }, CTX)
    const firstBytes = String(first.output).length
    const repeatBytes = String(repeat.output).length
    console.log(`[tool-search] repeat ${firstBytes}B -> ${repeatBytes}B, revealed=${revealed.size}`)
    // 首次只回"尚未在前缀"的 schema(危险/常驻工具本来就在前缀,不再重发),基数比旧版小。
    expect(firstBytes).toBeGreaterThan(350)
    expect(repeatBytes).toBeLessThan(firstBytes / 3)
    expect(String(repeat.output)).toContain('已在本会话前缀里')
    expect(String(repeat.output)).not.toContain('### ')
  })

  it('部分已揭示:只回新增工具的 schema,已在前缀的不再整段重发', async () => {
    const { search, revealed } = setup()
    await search.execute({ queries: ['合并分支'] }, CTX)
    const second = await search.execute({ queries: ['合并分支', '列出分支'] }, CTX)
    const out = String(second.output)
    console.log(`[tool-search] partial ${out.length}B, revealed=${revealed.size}`)
    // git_merge/git_branch_list 等已在前缀;这次只应补 gh_issue_list 的 schema。
    expect(out).toContain('### gh_issue_list')
    expect(out).not.toContain('### git_merge')
    expect(out).not.toContain('### git_branch_list')
    expect(out).toContain('已在前缀')
  })

  it('常驻工具本来就在前缀:查它不必再回 schema', async () => {
    const { search } = setup()
    const r = await search.execute({ queries: ['读取文件'] }, CTX)
    // read_file 未延迟,前缀里已有;这里只回名字,不回参数段。
    expect(String(r.output)).not.toContain('### ')
    expect(String(r.output)).toMatch(/read_file|参数 schema 已在本会话前缀里/)
  })

  it('首次揭示延迟工具仍要回完整 schema(不能把"已在prefix"的短路用在首查上)', async () => {
    const { search, revealed } = setup()
    const r = await search.execute({ queries: ['员工列表'] }, CTX)
    expect(revealed.has('hr_employee_list')).toBe(true)
    expect(String(r.output)).toContain('参数 schema 常驻')
    expect(String(r.output)).toContain('### hr_employee_list')
  })

  it('空结果给近名落点(含错拼),不是一堆无提示的名字', async () => {
    const { search } = setup()
    const r = await search.execute({ queries: ['read_filez'] }, CTX)
    expect(String(r.output)).toContain('最接近的名字')
    expect(String(r.output)).toContain('read_file')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
