/**
 * /quickstart 快速入门示例 — 5 个典型场景引导新手。
 *
 * 设计目标(对标 codex/claude-code/mimo code 的示例引导):
 *   - 用户反馈"刚进 cli 界面使用友好度 提示程度不够"
 *   - /quickstart 展示 5 个典型用法,降低首次使用心智门槛
 *   - /quickstart <编号> 把示例直接回填到输入(用户回车即可发送)
 *
 * 5 个场景(对标竞品最高频用法):
 *   1. 修复 bug        — "TypeError: Cannot read property 'x' of undefined"
 *   2. 重构模块        — 把 callback 风格重构成 async/await
 *   3. 写单元测试      — 给 utils.ts 写 vitest 测试
 *   4. 生成文档        — 给当前模块生成 README
 *   5. 调试性能问题    — 分析 hot path,找出 N+1 查询
 */

import chalk from 'chalk';

export interface QuickstartExample {
  /** 编号(1-5) */
  id: number;
  /** 场景名 */
  title: string;
  /** 一句话说明 */
  description: string;
  /** 推荐用法的 prompt 模板(可含 <占位符>) */
  prompt: string;
  /** 推荐搭配的 slash 命令(可选) */
  relatedCommands?: string[];
}

export const QUICKSTART_EXAMPLES: readonly QuickstartExample[] = [
  {
    id: 1,
    title: '修复 Bug',
    description: '粘贴报错栈 + 相关代码,Agent 定位根因并给出修复方案',
    prompt: '修复以下报错:\n\n```\nTypeError: Cannot read property \'map\' of undefined\n    at UserList (src/components/UserList.tsx:12:18)\n```\n\n文件 src/components/UserList.tsx 第 12 行:`users.map(u => ...)`',
    relatedCommands: ['/model', '/checkpoint'],
  },
  {
    id: 2,
    title: '重构模块',
    description: '把 callback 风格代码重构成 async/await,保持行为不变',
    prompt: '把 src/utils/file-helpers.ts 里所有 callback 风格的函数重构成 async/await,保持函数签名和对外行为不变,不引入新依赖。',
    relatedCommands: ['/model', '/plan on'],
  },
  {
    id: 3,
    title: '写单元测试',
    description: '为指定文件生成 vitest 测试,覆盖核心分支',
    prompt: '为 src/utils/date-utils.ts 生成 vitest 单元测试,覆盖 formatDate / parseISO / relativeTime 三个函数的核心分支,测试文件放在 tests/date-utils.test.ts。',
    relatedCommands: ['/model', '/bash'],
  },
  {
    id: 4,
    title: '生成文档',
    description: '为当前模块生成 README,含用法示例和 API 说明',
    prompt: '为 packages/shared/src/hooks/ 目录生成 README.md,列出所有 hook 的用法、参数、返回值,每个 hook 附带一个可运行的代码示例。',
    relatedCommands: ['/model', '/read'],
  },
  {
    id: 5,
    title: '调试性能问题',
    description: '分析热点路径,找出 N+1 查询或重复计算',
    prompt: '分析 src/api/routes/agents.ts 的 listAgents 接口性能瓶颈,我观察到 1000 个 agent 时响应时间从 50ms 涨到 3s。重点排查 N+1 查询、循环内 await、重复计算。',
    relatedCommands: ['/model', '/grep', '/bash'],
  },
];

/** 渲染快速入门列表(默认) */
export function renderQuickstartList(): string {
  const lines: string[] = [];
  lines.push(chalk.cyan('\n╭─ 快速入门 · 5 个典型场景'));
  lines.push(chalk.cyan('│'));
  lines.push(chalk.dim('│  复制 prompt 到输入框即可开始,或用 /quickstart <编号> 查看详情'));
  lines.push(chalk.cyan('│'));
  for (const ex of QUICKSTART_EXAMPLES) {
    const idStr = chalk.cyan(`[${ex.id}]`);
    const title = chalk.bold(ex.title.padEnd(10));
    lines.push(`│  ${idStr} ${title}  ${chalk.dim(ex.description)}`);
    if (ex.relatedCommands && ex.relatedCommands.length > 0) {
      lines.push(`│       ${chalk.dim('推荐: ' + ex.relatedCommands.join('  '))}`);
    }
  }
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('╰─ /quickstart <1-5> 查看示例 · 直接输入问题开始对话'));
  lines.push('');
  return lines.join('\n');
}

/** 渲染单个示例详情(可复制 prompt) */
export function renderQuickstartExample(id: number): string {
  const ex = QUICKSTART_EXAMPLES.find((e) => e.id === id);
  if (!ex) {
    return chalk.yellow(`未找到示例 #${id},可选 1-${QUICKSTART_EXAMPLES.length}`);
  }
  const lines: string[] = [];
  lines.push(chalk.cyan(`\n╭─ 示例 [${ex.id}] ${ex.title}`));
  lines.push(chalk.cyan('│'));
  lines.push(`│  ${chalk.dim('说明:')} ${ex.description}`);
  if (ex.relatedCommands && ex.relatedCommands.length > 0) {
    lines.push(`│  ${chalk.dim('推荐:')} ${ex.relatedCommands.join('  ')}`);
  }
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('├─ Prompt(复制到输入框)'));
  lines.push(chalk.cyan('│'));
  for (const line of ex.prompt.split('\n')) {
    lines.push(`│  ${line}`);
  }
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('╰─ 直接粘贴以上 prompt 回车即可开始 · /quickstart 查看其他示例'));
  lines.push('');
  return lines.join('\n');
}

/**
 * /quickstart 命令入口,返回要打印的字符串。
 *
 * 用法:
 *   /quickstart             → 列出 5 个示例
 *   /quickstart <1-5>       → 查看指定示例详情
 *   /quickstart help        → 帮助
 */
export function handleQuickstartCommand(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed === 'list') {
    return renderQuickstartList();
  }
  if (trimmed === 'help' || trimmed === '?') {
    return chalk.cyan('\n/quickstart              列出 5 个示例\n/quickstart <1-5>        查看指定示例详情\n/quickstart help         显示本帮助\n');
  }
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n)) {
    return chalk.yellow(`无效参数: ${trimmed}\n  ↳ /quickstart 查看列表 · /quickstart <1-5> 查看详情`);
  }
  return renderQuickstartExample(n);
}
