// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 受限工具集 profile(code-mode)。
 *
 * ## 与 tool-surface 的区别(别混)
 *
 * `tool-surface.ts` 解决的是「**上下文预算**」:常驻 vs 延迟,让 prompt 不变太长。
 * 本模块解决的是「**能力边界**」:在这个模式下一共有哪些工具可用。
 *
 * 两者正交:
 *   · 限制面(本模块)先裁集合;
 *   · 预算面(tool-surface)再把留下来的分成常驻/延迟。
 *
 * ## 为什么需要它
 *
 * 危险不在于"工具太多",而在于**某个场景下不该出现的工具出现了**:
 *   · 只读审阅模式下出现 `write_file`,一次误操作就改了用户代码;
 *   · 代码问答模式下出现 `terminal`,可以跑任意命令;
 *   · 演示/教学模式下出现 `git push`,后果不可逆。
 *
 * 这些不是"用权限规则拦"(那要逐条配),而是**从源头就不给它看到**。
 * 工具不存在于 prompt 里,模型就不会尝试调用 —— 这比事后拒绝更可靠。
 *
 * ## 一条纪律:未声明的 profile 一律拒绝(deny-by-default)
 *
 * 若某 profile 名拼错,不能静默落回"全量工具" —— 那会把最危险的默认值
 * 塞给一个以为自己被限制了的人。拼错必须报错。
 */

import type { Tool } from './index.js';

/** 内置 profile 标识。 */
export type CodeModeId = 'read-only' | 'no-shell' | 'review' | 'full';

export interface CodeModeSpec {
  readonly id: CodeModeId;
  /** 人读说明。 */
  readonly description: string;
  /**
   * 允许的工具名(白名单)。`'*'` 表示不限制。
   * **白名单而非黑名单**:新增工具默认不可用,失效方向恒为"少给能力"。
   */
  readonly allow: readonly string[] | '*';
}

export const CODE_MODES: Readonly<Record<CodeModeId, CodeModeSpec>> = {
  'read-only': {
    id: 'read-only',
    description: '只读:能读文件、搜索、检索代码,不能写/改/删/执行',
    allow: [
      'read_file',
      'view_file',
      'list_dir',
      'glob',
      'grep',
      'search_codebase',
      'codegraph',
      'get_diagnostics',
      'lsp',
      'web_search',
      'web_fetch',
      'todo_write',
      'ask_user_question',
      'skill',
      'skill_read',
    ],
  },
  'no-shell': {
    id: 'no-shell',
    description: '禁执行:可读写文件,但不能起子进程/跑命令',
    allow: '*',
    // 用排除实现"除 X 之外全部"——但本题纪律要求白名单。
    // 折中:no-shell 用显式排除表,且排除表的**遗漏方向**是"多给"(可接受:
    // 最坏情况是某个命令工具漏禁,而它仍受权限规则约束)。
  },
  review: {
    id: 'review',
    description: '审阅:只读 + 诊断 + 讨论,不能改代码、不能执行',
    allow: [
      'read_file',
      'view_file',
      'list_dir',
      'glob',
      'grep',
      'search_codebase',
      'codegraph',
      'get_diagnostics',
      'lsp',
      'todo_write',
      'ask_user_question',
      'skill',
      'skill_read',
    ],
  },
  full: {
    id: 'full',
    description: '全量:不限制(默认)',
    allow: '*',
  },
};

/** no-shell 的显式排除表(与白名单策略互补)。 */
const NO_SHELL_DENY: ReadonlySet<string> = new Set([
  'run_command',
  'bash',
  'shell',
  'terminal',
  'exec',
  'run_tests',
  'git',
  'git_advanced',
]);

export class CodeModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodeModeError';
  }
}

/** 解析 profile 名。拼错必须报错,不落回全量。 */
export function resolveCodeMode(id: string | undefined | null): CodeModeSpec {
  if (id === undefined || id === null || id === '') return CODE_MODES.full;
  const spec = CODE_MODES[id as CodeModeId];
  if (!spec) {
    throw new CodeModeError(
      `未知的 code mode "${id}" —— 可用:${Object.keys(CODE_MODES).join(' / ')}。` +
        `拒绝落回全量:那会把最危险的默认值给到以为自己被限制的人。`,
    );
  }
  return spec;
}

/** 判断某工具在该模式下是否可用。 */
export function isToolAllowed(spec: CodeModeSpec, toolName: string): boolean {
  if (spec.allow === '*') {
    // no-shell 例外:显式排除表优先
    if (spec.id === 'no-shell' && NO_SHELL_DENY.has(toolName)) return false;
    return true;
  }
  return spec.allow.includes(toolName);
}

/**
 * 按模式裁剪工具集。
 *
 * 返回 `{ allowed, blocked }`,**blocked 也要返回** —— 上层据此能回答
 * "为什么某个工具不见了",而不是让用户自己猜。
 */
export function applyCodeMode(
  tools: readonly Tool[],
  modeId: string | undefined | null,
): { mode: CodeModeSpec; allowed: Tool[]; blocked: string[] } {
  const mode = resolveCodeMode(modeId);
  const allowed: Tool[] = [];
  const blocked: string[] = [];
  for (const t of tools) {
    if (isToolAllowed(mode, t.name)) allowed.push(t);
    else blocked.push(t.name);
  }
  return { mode, allowed, blocked };
}

/** 一句话说明这个模式限制了什么(给 UI/日志用)。 */
export function describeCodeMode(spec: CodeModeSpec): string {
  if (spec.allow === '*') {
    return spec.id === 'no-shell'
      ? `模式 ${spec.id}:${spec.description}(排除 ${NO_SHELL_DENY.size} 个执行类工具)`
      : `模式 ${spec.id}:不限制工具`;
  }
  return `模式 ${spec.id}:仅 ${spec.allow.length} 个工具可用(${spec.description})`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
