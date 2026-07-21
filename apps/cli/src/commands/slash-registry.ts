/**
 * Slash 命令注册表 — 元数据驱动,用于 /help 自动渲染 + 未知命令建议。
 *
 * 灵感来源:参考行业 Agent 框架的 SlashCommand 注册表设计。
 * 简化策略(做减法):只存元数据,handler 仍走 switch,避免大重写。
 * 价值:(1) /help 文本单一来源,新增命令只改注册表;
 *       (2) 未知命令给相似度建议(Levenshtein ≤ 2),降低用户记忆负担。
 */

import chalk from 'chalk';

export type SlashCommandCategory = 'basic' | 'session' | 'task' | 'checkpoint' | 'file';

export interface SlashCommandMeta {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  category: SlashCommandCategory;
}

export const SLASH_COMMANDS: readonly SlashCommandMeta[] = [
  { name: 'help', description: '显示帮助', usage: '/help', category: 'basic' },
  { name: 'exit', aliases: ['quit'], description: '退出', usage: '/exit', category: 'basic' },
  { name: 'clear', description: '清除对话历史', usage: '/clear', category: 'basic' },
  { name: 'model', description: '切换模型', usage: '/model [id]', category: 'basic' },
  { name: 'workspace', description: '显示当前工作区', usage: '/workspace', category: 'basic' },
  { name: 'tools', description: '列出可用工具', usage: '/tools', category: 'basic' },
  { name: 'init', description: '创建 AGENTS.md 模板', usage: '/init', category: 'basic' },
  { name: 'mcp', description: '列出已配置的 MCP 服务器', usage: '/mcp', category: 'basic' },
  { name: 'skills', description: '列出已加载的 skills', usage: '/skills', category: 'session' },
  { name: 'skill', description: '查看 skill 内容', usage: '/skill <name>', category: 'session' },
  { name: 'memory', description: '管理跨会话记忆', usage: '/memory [on|off|show|add|clear|search]', category: 'session' },
  { name: 'todo', description: '管理任务清单(显示/清除)', usage: '/todo [clear]', category: 'session' },
  { name: 'plan', description: 'Plan Mode 控制', usage: '/plan [on|off|approve|reject|edit|show]', category: 'session' },
  { name: 'context', description: '显示当前会话 token 用量', usage: '/context', category: 'session' },
  { name: 'announcements', aliases: ['announce'], description: '查看公告', usage: '/announcements [list|unread|read <id>|read-all|refresh]', category: 'session' },
  { name: 'voice', description: '语音输入(录音+转写)', usage: '/voice [秒数]', category: 'session' },
  { name: 'queue', description: '提示词排队(agent 完成后自动执行)', usage: '/queue [list|clear|rm <id>|<prompt>]', category: 'session' },
  { name: 'rewind', description: '回退 N 步(一步=一对 user+assistant)', usage: '/rewind [N]', category: 'session' },
  { name: 'fork', description: '从指定消息位置 fork 新 session', usage: '/fork [msg-index]', category: 'session' },
  { name: 'repair', description: '自愈当前会话历史', usage: '/repair', category: 'session' },
  { name: 'bg', aliases: ['background'], description: '启动/管理后台任务', usage: '/bg <cmd> | /bg list|out <id>|wait <id>|kill <id>', category: 'task' },
  { name: 'loop', description: '周期执行命令', usage: '/loop <intvl> <cmd> | /loop list|stop <id>|clear', category: 'task' },
  { name: 'checkpoint', aliases: ['cp'], description: '创建/列出检查点', usage: '/checkpoint [files...]', category: 'checkpoint' },
  { name: 'rollback', aliases: ['rb'], description: '回滚到检查点', usage: '/rollback <id|auto>', category: 'checkpoint' },
  { name: 'diff', description: '对比检查点与当前工作区', usage: '/diff [id]', category: 'checkpoint' },
  { name: 'read', description: '读取文件 (带行号)', usage: '/read <file>', category: 'file' },
  { name: 'ls', description: '列出目录内容', usage: '/ls [dir]', category: 'file' },
  { name: 'grep', description: '递归搜索内容', usage: '/grep <pat> [path]', category: 'file' },
  { name: 'glob', description: '匹配文件名', usage: '/glob <pattern>', category: 'file' },
  { name: 'bash', aliases: ['sh'], description: '执行 shell 命令', usage: '/bash <cmd>', category: 'file' },
];

const CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
  basic: '基础',
  session: '会话',
  task: '后台任务',
  checkpoint: '检查点',
  file: '文件操作',
};

const CATEGORY_ICONS: Record<SlashCommandCategory, string> = {
  basic: '◆',
  session: '◐',
  task: '◈',
  checkpoint: '▣',
  file: '▤',
};

const CATEGORY_COLORS: Record<SlashCommandCategory, (s: string) => string> = {
  basic: chalk.cyan,
  session: chalk.magenta,
  task: chalk.yellow,
  checkpoint: chalk.green,
  file: chalk.blue,
};

const CATEGORY_ORDER: SlashCommandCategory[] = ['basic', 'session', 'task', 'checkpoint', 'file'];

/** 查找命令(支持别名) */
export function findSlashCommand(name: string): SlashCommandMeta | undefined {
  return SLASH_COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));
}

/** 渲染帮助文本(分类色带 + 图标 + 别名对齐,单一来源) */
export function renderSlashHelp(): string {
  const lines: string[] = [];
  const totalCmds = SLASH_COMMANDS.length;
  lines.push(chalk.cyan(`╭─ 可用命令 (${totalCmds}) `) + chalk.dim('─'.repeat(40)));
  for (const cat of CATEGORY_ORDER) {
    const cmds = SLASH_COMMANDS.filter((c) => c.category === cat);
    if (cmds.length === 0) continue;
    const color = CATEGORY_COLORS[cat];
    const icon = CATEGORY_ICONS[cat];
    // 分类色带
    lines.push(color(`\n${icon} ${CATEGORY_LABELS[cat]} · ${cmds.length} 项`));
    lines.push(color('─'.repeat(46)));
    for (const c of cmds) {
      const aliases = c.aliases ? chalk.dim(`  /${c.aliases.join(' /')}`) : '';
      const usage = color(c.usage.padEnd(26));
      lines.push(`  ${usage} ${chalk.gray(c.description)}${aliases}`);
    }
  }
  lines.push(chalk.cyan('╰─ 输入命令开始 · Tab 自动补全 · 未知命令给相似度建议 '));
  lines.push('');
  return lines.join('\n');
}

/** 模糊查找建议(Levenshtein 距离 ≤ 2),用于未知命令提示 */
export function suggestSlashCommands(input: string, max = 3): SlashCommandMeta[] {
  const lower = input.toLowerCase();
  const scored = SLASH_COMMANDS.map((c) => {
    const candidates = [c.name, ...(c.aliases ?? [])];
    const best = Math.min(...candidates.map((s) => levenshtein(lower, s.toLowerCase())));
    return { cmd: c, score: best };
  });
  return scored
    .filter((s) => s.score <= 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, max)
    .map((s) => s.cmd);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length]!;
}
