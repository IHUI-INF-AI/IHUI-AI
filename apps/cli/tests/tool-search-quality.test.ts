// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具检索质量(中文自然语言查询) —— 把"模型用中文找工具"这条链路量成命中率。
 *
 * 立因:`tool_search` 是延迟装载的唯一开口。此前打分只有"整词子串",中文没有空格分词,
 * 真实查询("合并分支""查看提交历史")在描述里往往不是连续子串 ⇒ 整条落空,模型只能靠
 * 猜工具名。工具检索失败不是"少一次调用",而是**能力面直接掉一档**:它拿不到参数 schema。
 *
 * 本用例做两件事:
 *   1. 钉住一批真实口吻的 golden 查询(中英混合),要求期望工具出现在 top5 —— top5 是
 *      `tool_search` 的默认返回条数,所以这就是"模型实际能不能看到"的判据;
 *   2. 打印 hit@1 / hit@5 读数,供人看质量趋势(hit@1 不钉死:排序优化会动它)。
 *
 * 口径边界:这是**纯检索算法**的离线读数,不测模型会不会想到调 `tool_search`(那要真模型)。
 * 查询集不按当前实现调参:写的是"一个用户会怎么问",实现按这个目标改,而不是反过来。
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

/** 文件编辑族与终端族要构造上下文才能拿实例:测试里给最小可用的假 ctx(不执行任何工具)。 */
const TEST_CTX = {
  workspacePath: process.cwd(),
  sessionId: 'tool-search-quality',
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

/** [查询, 期望工具] —— 查询按真实口吻写:短句、口语、中英混排。 */
const CASES: Array<[string, string]> = [
  ['合并分支', 'git_merge'],
  ['切换分支', 'git_branch_switch'],
  ['创建分支', 'git_branch_create'],
  ['查看提交历史', 'git_log'],
  ['暂存改动', 'git_stash_push'],
  ['恢复暂存', 'git_stash_pop'],
  ['解决冲突', 'git_conflict_resolve'],
  ['打标签', 'git_tag_create'],
  ['读取文件', 'read_file'],
  ['写入文件', 'write_file'],
  ['编辑文件', 'edit_file'],
  ['搜索代码内容', 'grep'],
  ['查找文件', 'glob'],
  ['运行命令', 'run_command'],
  ['跑测试', 'run_tests'],
  ['调试断点', 'debug_set_breakpoints'],
  ['启动调试', 'debug_launch'],
  ['浏览器截图', 'browser_screenshot'],
  ['打开网页', 'browser_navigate'],
  ['点击页面元素', 'browser_page_click'],
  ['剪贴板读取', 'clipboard_read'],
  ['打开终端', 'terminal_open'],
  ['保存记忆', 'memory_save'],
  ['召回记忆', 'memory_recall'],
  ['进入工作树', 'enter_worktree'],
  ['代码图谱', 'codegraph'],
  ['创建PR', 'gh_pr_create'],
  ['查看PR', 'gh_pr_view'],
  ['跳转定义', 'goto_definition'],
  ['查找引用', 'find_references'],
  ['批量编辑', 'batch_edit'],
  ['merge branch', 'git_merge'],
  ['stash pop', 'git_stash_pop'],
  ['read file', 'read_file'],
  // ==== 业务域族(2026-11-28):这几族已被 defer-policy 延迟,检索是唯一入口 ====
  ['员工列表', 'hr_employee_list'],
  ['部门列表', 'hr_department_list'],
  ['查看考勤记录', 'hr_attendance_records'],
  ['请假申请', 'hr_leave_create'],
  ['审批待办', 'hr_approval_pending_list'],
  ['补卡申请', 'hr_punch_fix_submit'],
  ['考勤统计', 'hr_attendance_stats'],
  ['号池列表', 'relay_pool_list'],
  ['重认证状态', 'relay_reauth_status'],
  ['接口列表', 'api_list_endpoints'],
  ['端点说明', 'api_describe_endpoint'],
]

describe('工具检索质量(中文查询命中率)', () => {
  it('golden 查询的期望工具必须落在 top5(tool_search 默认返回条数)', () => {
    const tools = (() => {
      registerTools(FAMILIES.flat())
      return listTools()
    })()
    expect(tools.length).toBeGreaterThan(80)

    const misses: string[] = []
    let hitAt1 = 0
    for (const [query, expected] of CASES) {
      const hits = searchTools(tools, [query], [], 5)
      const names = hits.map((hit) => hit.tool.name)
      if (names[0] === expected) hitAt1 += 1
      if (!names.includes(expected)) {
        misses.push(`${query} → 期望 ${expected},实得 [${names.join(', ')}]`)
      }
    }
    const pct = (n: number) => `${((n / CASES.length) * 100).toFixed(0)}%`
    console.log(
      `[tool-search] hit@1 ${hitAt1}/${CASES.length}(${pct(hitAt1)})·` +
        `hit@5 ${CASES.length - misses.length}/${CASES.length}(${pct(CASES.length - misses.length)})`,
    )
    expect(misses).toEqual([])
  })

  it('中文整串不连续时也要命中(此前"合并分支"整条落空的回归点)', () => {
    const tools = (() => {
      registerTools(FAMILIES.flat())
      return listTools()
    })()
    // 描述里是"合并指定分支到当前分支",并不含连续子串"合并分支"。
    const hits = searchTools(tools, ['合并分支'], [], 5)
    expect(hits.map((hit) => hit.tool.name)).toContain('git_merge')
  })

  it('中英混排要切开("创建PR" 不能整串落空)', () => {
    const tools = (() => {
      registerTools(FAMILIES.flat())
      return listTools()
    })()
    const hits = searchTools(tools, ['创建PR'], [], 5)
    expect(hits.map((hit) => hit.tool.name)).toContain('gh_pr_create')
  })

  it('空查询与纯符号查询不得返回任何命中(不能靠零分工具凑满 top5)', () => {
    const tools = (() => {
      registerTools(FAMILIES.flat())
      return listTools()
    })()
    expect(searchTools(tools, [''], [], 5)).toEqual([])
    expect(searchTools(tools, ['   ', '，'], [], 5)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
