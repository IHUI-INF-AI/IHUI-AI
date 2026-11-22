// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具面 → 产品能力 的**端内映射**(goal-b49 Y3,2026-11-05)。
 *
 * 判据本体在 `@ihui/types` 的 `product-form-capabilities`(形态 → 能力布尔的那一张表 +
 * 纯函数 `evaluateProductFormCapability`);本文件**不复制任何一行表** —— 它只回答一个问题:
 * **「这枚工具属于哪个能力面」**(端内事实:工具名与它实际做的事)。
 *
 * 为什么映射住在这里而不是进 `@ihui/types`:工具名是 CLI 端内事实(`write_file` / `git_*` /
 * `browser_*` …),共享层不该知道某一端有哪些工具;而「形态 → 能力」是跨端声明,必须单源在
 * `@ihui/types`(§0.6:同类判据全仓只许一份)。
 *
 * 逐条出处(工具名取自各工具族的 `name` 字面量):
 * - `localWorkspace`(本机工作区面):文件族 `tools/file-edit.ts`(write_file / edit_file /
 *   delete_file)、批量文件族 `tools/file-batch-edit.ts`(batch_edit / batch_undo / batch_preview)、
 *   内建族 `tools/builtins.ts`(read_file / list_dir / grep / glob / run_command /
 *   list_background_tasks / get_command_output / wait_command / kill_command)、
 *   git 族 `tools/git.ts` + `tools/git-advanced.ts`(git_*)、worktree 族 `tools/worktree.ts`
 *   (enter_worktree / exit_worktree)、终端族 `tools/terminal.ts`(terminal_*)、
 *   测试族 `tools/run-tests.ts`(run_tests)、语言服务族 `tools/lsp*.ts`(lsp_*,拉本机语言服务器)、
 *   代码图族 `tools/codegraph.ts`(codegraph / goto_definition / find_references,读本机仓库)。
 * - `browserRuntime`(浏览器自动化面):`tools/browser.ts` + `tools/browser-page.ts`(browser_*)。
 *
 * **未映射 = 有意为之**:其余工具(取页 / 搜索 / 记忆 / 技能 / 子代理 / 诊断 / GitHub / 剪贴板 /
 * 调试 / MCP)走的是**服务面或独立进程面**,与本仓「产品形态」这一维无关(§0.9:无宿主语义的
 * 档位一律不补)。它们**不受形态门管**,因此行为与改前逐字相同。
 */

import type { ProductCapability, ProductCapabilityVerdict } from '@ihui/types';

import { gateProductFormCapability, resolveProductForm, type ResolvedProductForm } from '../lib/product-form.js';

/** 本机工作区面的工具名(逐族枚举,出处见文件头注)。 */
const LOCAL_WORKSPACE_TOOLS: ReadonlySet<string> = new Set([
  // 文件面
  'write_file',
  'edit_file',
  'delete_file',
  'batch_edit',
  'batch_undo',
  'batch_preview',
  // 内建面
  'read_file',
  'list_dir',
  'grep',
  'glob',
  'run_command',
  'list_background_tasks',
  'get_command_output',
  'wait_command',
  'kill_command',
  // 测试面
  'run_tests',
  // worktree 面
  'enter_worktree',
  'exit_worktree',
  // 代码图面
  'codegraph',
  'goto_definition',
  'find_references',
]);

/** 本机工作区面的工具名前缀(git / 终端 / 语言服务族)。 */
const LOCAL_WORKSPACE_PREFIXES: readonly string[] = ['git_', 'terminal_', 'lsp_'];

/** 浏览器自动化面的工具名前缀(CDP 浏览器族)。 */
const BROWSER_RUNTIME_PREFIXES: readonly string[] = ['browser_'];

/**
 * 这枚工具属于哪个能力面;`undefined` = 不受产品形态门管(服务面工具)。
 */
export function capabilityOfToolName(name: string): ProductCapability | undefined {
  if (LOCAL_WORKSPACE_TOOLS.has(name)) return 'localWorkspace';
  if (LOCAL_WORKSPACE_PREFIXES.some((p) => name.startsWith(p))) return 'localWorkspace';
  if (BROWSER_RUNTIME_PREFIXES.some((p) => name.startsWith(p))) return 'browserRuntime';
  return undefined;
}

export interface ToolProductFormGate {
  /** 该工具在本形态下是否允许挂载 */
  readonly allowed: boolean;
  /** 该工具归属的能力面(undefined = 不受形态门管) */
  readonly capability?: ProductCapability;
  /** 判定回执(不受门管时给出"不归门管"的说明,便于日志与测试读数) */
  readonly verdict: ProductCapabilityVerdict;
}

/**
 * 判「当前形态下这枚工具能不能挂」—— 消费点(`tools/index.ts` 的 `registerTools`)据此**降权**:
 * 形态表里关掉/未登记的能力面,在该形态下**不得被启用**。
 *
 * 不受形态门管的工具:直接放行(判定结论与改前逐字相同,零回归)。
 */
export function gateToolForProductForm(
  name: string,
  resolved: ResolvedProductForm = resolveProductForm(),
): ToolProductFormGate {
  const capability = capabilityOfToolName(name);
  if (capability === undefined) {
    return {
      allowed: true,
      verdict: {
        state: 'enabled',
        form: resolved.form,
        capability: '(不受形态门管)',
        reason: `工具 ${name} 不属于本机执行面 ⇒ 不受产品形态门管`,
      },
    };
  }
  const verdict = gateProductFormCapability(capability, resolved);
  return {
    allowed: verdict.state === 'enabled',
    capability,
    verdict,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
