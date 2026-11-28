// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌‌‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具检索的自然说法回归 —— golden 49 条之外的**同义表达**。
 *
 * 立因(2026-11-28):golden 集里的查询多是"分支/暂存/考勤"这类标准词,真实用户会说
 * "看下有哪些分支""取回暂存的改动""待我审批的"。只靠标准词命中,模型换个口语说法就
 * 找不到工具 —— 延迟工具面等于对这些人关着。
 *
 * 口径:
 *   - 查询先写、实现后改;第一组 32 条写完后量得基线 15/32,补同义词后 32/32;
 *   - 第二组 16 条在实现改动完成后才写(写时未参考当轮结果),基线 9/16,当前 16/16;
 *   - 两组都只覆盖**语义唯一**的查询;同一动作有多个合法工具("点一下按钮"可走
 *     browser_click 或 browser_page_click)不入集,避免把偏好当成正确性。
 *
 * 这不是"没被调过参"的留出集:第一组确实参与了同义词补齐。它的价值是回归棘轮,
 * 不是对外宣称的独立泛化读数。
 */
import { describe, expect, it } from 'vitest'

import '../src/tools/index.js'
import { listTools, registerTools } from '../src/tools/index.js'
import { searchTools } from '../src/tools/tool-search.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { GIT_TOOLS } from '../src/tools/git.js'
import { GIT_ADVANCED_TOOLS } from '../src/tools/git-advanced.js'
import { GITHUB_PR_TOOLS } from '../src/tools/github-pr.js'
import { FETCH_TOOLS } from '../src/tools/fetch-url.js'
import { WEB_SEARCH_TOOLS } from '../src/tools/web-search.js'
import { TEST_TOOLS } from '../src/tools/run-tests.js'
import { DIAGNOSTIC_TOOLS } from '../src/tools/diagnostics.js'
import { DEBUG_TOOLS } from '../src/tools/debug.js'
import { CODEGRAPH_TOOLS } from '../src/tools/codegraph.js'
import { SKILL_TOOLS } from '../src/tools/skill-tool.js'
import { LSP_TOOLS } from '../src/tools/lsp.js'
import { MEMORY_TOOLS } from '../src/tools/memory.js'
import { BROWSER_TOOLS } from '../src/tools/browser.js'
import { BROWSER_PAGE_TOOLS } from '../src/tools/browser-page.js'
import { WORKTREE_TOOLS } from '../src/tools/worktree.js'
import { CLIPBOARD_TOOLS } from '../src/tools/clipboard.js'
import { HR_TOOLS } from '../src/tools/hr.js'
import { RELAY_TOOLS } from '../src/tools/relay.js'
import { API_BRIDGE_TOOLS } from '../src/tools/api-bridge.js'
import { AI_BRIDGE_TOOLS } from '../src/tools/ai-bridge.js'
import { createFileEditTools } from '../src/tools/file-edit.js'
import {
  terminal_close,
  terminal_exec_sandboxed,
  terminal_open,
  terminal_read,
  terminal_resize,
  terminal_send,
} from '../src/tools/terminal.js'

const TEST_CTX = {
  workspacePath: process.cwd(),
  sessionId: 'tool-search-natural',
  turnId: 'turn-1',
  permissions: { mode: 'default' },
} as never

const FAMILIES = [
  BUILTIN_TOOLS,
  GIT_TOOLS,
  GIT_ADVANCED_TOOLS,
  GITHUB_PR_TOOLS,
  FETCH_TOOLS,
  WEB_SEARCH_TOOLS,
  TEST_TOOLS,
  DIAGNOSTIC_TOOLS,
  DEBUG_TOOLS,
  CODEGRAPH_TOOLS,
  SKILL_TOOLS,
  LSP_TOOLS,
  MEMORY_TOOLS,
  BROWSER_TOOLS,
  BROWSER_PAGE_TOOLS,
  WORKTREE_TOOLS,
  CLIPBOARD_TOOLS,
  HR_TOOLS,
  RELAY_TOOLS,
  API_BRIDGE_TOOLS,
  AI_BRIDGE_TOOLS,
  createFileEditTools(TEST_CTX),
  [terminal_open, terminal_send, terminal_read, terminal_resize, terminal_close, terminal_exec_sandboxed],
]

/** 第一组:开发期同义词补齐时逐条诊断过,基线(9f5f31c9e)15/32。 */
const PHRASINGS: Array<[string, string]> = [
  ['看下有哪些分支', 'git_branch_list'], ['新开一条分支', 'git_branch_create'], ['删掉这个分支', 'git_branch_delete'],
  ['把改动暂存起来', 'git_stash_push'], ['取回暂存的改动', 'git_stash_pop'], ['看这两次提交差异', 'git_diff'],
  ['当前工作区状态', 'git_status'], ['列一下远端仓库', 'git_remote_list'], ['打开目录', 'list_dir'], ['看文件内容', 'read_file'],
  ['把内容覆盖写入', 'write_file'], ['在代码里找函数名', 'grep'], ['列出匹配的文件名', 'glob'],
  ['跑一遍单测', 'run_tests'], ['执行 shell 命令', 'run_command'], ['截图当前页面', 'browser_screenshot'],
  ['读取剪贴板', 'clipboard_read'], ['存一条长期记忆', 'memory_save'], ['搜一下过去的记忆', 'memory_recall'],
  ['新建工作树', 'enter_worktree'], ['退出工作树', 'exit_worktree'], ['建一个 PR', 'gh_pr_create'],
  ['看 PR 详情', 'gh_pr_view'], ['查符号定义', 'goto_definition'], ['找符号引用', 'find_references'],
  ['批量改多个文件', 'batch_edit'], ['提交补卡', 'hr_punch_fix_submit'], ['待我审批的', 'hr_approval_pending_list'],
  ['号池里哪些掉线', 'relay_pool_list'], ['看接口清单', 'api_list_endpoints'], ['这个接口的参数', 'api_describe_endpoint'],
  ['改请求超时', 'run_command'],
]

/** 第二组:实现改完才写,只收语义唯一的查询,基线 9/16。 */
const FRESH: Array<[string, string]> = [
  ['给当前提交打个标签', 'git_tag_create'], ['标签都列出来', 'git_tag_list'], ['新增一个远端地址', 'git_remote_add'],
  ['远端地址有哪些', 'git_remote_list'], ['用浏览器打开网址', 'browser_navigate'], ['截个图看看页面', 'browser_screenshot'],
  ['整理一下记忆', 'memory_dream'], ['忘掉这段记忆', 'memory_forget'], ['部门都有哪些', 'hr_department_list'],
  ['加一个部门', 'hr_department_create'], ['巡检号池', 'relay_pool_sweep'], ['接口有哪些', 'api_list_endpoints'],
  ['说说这个接口', 'api_describe_endpoint'], ['审批通过', 'hr_approval_decide'], ['看看考勤统计', 'hr_attendance_stats'],
  ['运行一条系统命令', 'run_command'],
]

describe('工具检索的自然说法回归', () => {
  it('48 条同义表达:期望工具必须落在 top5,且 hit@1 不回退', () => {
    registerTools(FAMILIES.flat())
    const tools = listTools()
    const cases = [...PHRASINGS, ...FRESH]
    const misses: string[] = []
    let hitAt1 = 0
    for (const [query, expected] of cases) {
      const names = searchTools(tools, [query], [], 5).map((hit) => hit.tool.name)
      if (names[0] === expected) hitAt1 += 1
      if (!names.includes(expected)) misses.push(`${query} → 期望 ${expected},实得 [${names.join(', ')}]`)
    }
    console.log(
      `[tool-search-natural] hit@1 ${hitAt1}/${cases.length}·hit@5 ${cases.length - misses.length}/${cases.length}`,
    )
    expect(misses).toEqual([])
    // 2026-11-28:基线 25/48(第一组 15 + 第二组 10),当前 48/48。留 2 例余量防词语抖动。
    expect(hitAt1).toBeGreaterThanOrEqual(46)
  })
})
