/**
 * /status 综合状态面板 — 一屏看尽当前 REPL 全部状态。
 *
 * 设计目标(对标 codex/claude-code/mimo code 的状态可见性):
 *   - 用户反馈"提示程度不够"
 *   - 一行命令看全:模型/workspace/权限/MCP/skills/memory/todo/context
 *   - 替代散落在 /workspace /context /skills /memory /todo 多个命令的零散信息
 *
 * 数据来源:
 *   - ReplState(传入):opts/history/skills/memory
 *   - settings.ts:权限模式/locale
 *   - tasks.ts:任务统计
 *   - mcp-config.ts:MCP 服务器数
 *   - session.ts:会话 ID
 */

import * as path from 'node:path';
import chalk from 'chalk';
import type { ChatMessage } from './session.js';
import type { PermissionMode } from '../tools/permissions.js';
import type { Skill } from '../skills/index.js';
import type { MemoryEntry } from '../memory/index.js';
import { loadSettings } from './settings.js';
import { loadMcpConfig } from './mcp-config.js';
import { getTaskStats } from './tasks.js';
import { estimateMessagesTokens } from '../context.js';

/** /status 命令所需的状态快照(由 repl.ts 调用时填充) */
export interface StatusSnapshot {
  modelId: string;
  workspacePath: string;
  permissionMode: PermissionMode;
  enableMcp: boolean;
  planFirst: boolean;
  planApproved?: boolean;
  sessionId?: string;
  history: ChatMessage[];
  skills: Skill[];
  memory: MemoryEntry[];
  maxIterations: number;
  allowDangerous: boolean;
}

/** 渲染状态面板,返回要打印的字符串 */
export function renderStatusPanel(snap: StatusSnapshot): string {
  const settings = loadSettings();
  const lines: string[] = [];

  // === 头部:模型 + workspace ===
  lines.push(chalk.cyan(`\n╭─ IHUI CLI 状态面板`));
  lines.push(chalk.cyan('│'));
  const wsName = path.basename(snap.workspacePath);
  lines.push(`│  ${chalk.dim('模型:       ')} ${chalk.green(snap.modelId)}`);
  lines.push(`│  ${chalk.dim('工作区:     ')} ${chalk.cyan(wsName)}`);
  lines.push(`│  ${chalk.dim('路径:       ')} ${chalk.dim(snap.workspacePath)}`);
  if (snap.sessionId) {
    lines.push(`│  ${chalk.dim('会话 ID:    ')} ${chalk.dim(snap.sessionId.slice(0, 8) + '…')}`);
  }

  // === 配置区:权限/MCP/Plan ===
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('├─ 配置'));
  const permColor = snap.permissionMode === 'bypassPermissions'
    ? chalk.red
    : snap.permissionMode === 'acceptEdits'
      ? chalk.yellow
      : chalk.green;
  lines.push(`│  ${chalk.dim('权限模式:   ')} ${permColor(snap.permissionMode)}`);
  lines.push(`│  ${chalk.dim('MCP 工具:   ')} ${snap.enableMcp ? chalk.green('启用') : chalk.dim('关闭')}`);
  const planState = snap.planFirst
    ? (snap.planApproved ? chalk.green('on (approved)') : chalk.yellow('on (pending)'))
    : chalk.dim('off');
  lines.push(`│  ${chalk.dim('Plan Mode:  ')} ${planState}`);
  lines.push(`│  ${chalk.dim('危险工具:   ')} ${snap.allowDangerous ? chalk.red('允许 ⚠') : chalk.dim('需确认')}`);
  lines.push(`│  ${chalk.dim('最大循环:   ')} ${snap.maxIterations}`);
  lines.push(`│  ${chalk.dim('界面语言:   ')} ${settings.locale ?? 'zh-CN'}`);

  // === 资源区:MCP/skills/memory ===
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('├─ 资源'));
  let mcpCount = 0;
  try {
    mcpCount = loadMcpConfig().servers.length;
  } catch {
    mcpCount = 0;
  }
  lines.push(`│  ${chalk.dim('MCP 服务器: ')} ${mcpCount > 0 ? chalk.green(String(mcpCount)) : chalk.dim('0')}`);
  lines.push(`│  ${chalk.dim('Skills:     ')} ${snap.skills.length > 0 ? chalk.green(String(snap.skills.length)) : chalk.dim('0')}`);
  const globalMemCount = snap.memory.filter((e) => e.source === 'global').length;
  const projMemCount = snap.memory.length - globalMemCount;
  lines.push(`│  ${chalk.dim('Memory:     ')} ${snap.memory.length > 0 ? chalk.green(String(snap.memory.length)) + chalk.dim(` (全局 ${globalMemCount} · 项目 ${projMemCount})`) : chalk.dim('0')}`);

  // === 任务区:tasks ===
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('├─ 任务清单'));
  const stats = getTaskStats(snap.workspacePath);
  if (stats.total === 0) {
    lines.push(`│  ${chalk.dim('暂无任务')}  ${chalk.dim('/tasks add <内容> 添加')}`);
  } else {
    const pct = Math.round((stats.completed / stats.total) * 100);
    const barWidth = 10;
    const filled = Math.min(barWidth, Math.round((stats.completed / stats.total) * barWidth));
    const empty = barWidth - filled;
    const bar = '▰'.repeat(filled) + '▱'.repeat(empty);
    lines.push(`│  ${chalk.dim('进度:       ')} ${chalk.green(String(stats.completed))}/${chalk.bold(String(stats.total))} ${chalk.cyan(bar)} ${pct}%`);
    lines.push(`│  ${chalk.dim('待办:       ')} ${stats.pending}  ${chalk.dim('进行中:')} ${stats.in_progress}  ${chalk.dim('完成:')} ${stats.completed}`);
  }

  // === 上下文区:token 用量 ===
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('├─ 上下文用量'));
  const maxTokens = 24_000;
  const tokens = snap.history.length === 0
    ? 0
    : estimateMessagesTokens(
        snap.history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      );
  const pct = Math.min(100, (tokens / maxTokens) * 100);
  const filled = Math.min(20, Math.floor((pct / 100) * 20));
  const empty = 20 - filled;
  const barColor = pct >= 85 ? chalk.red : pct >= 50 ? chalk.yellow : chalk.green;
  const bar = barColor('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  lines.push(`│  ${chalk.dim('消息数:     ')} ${snap.history.length}`);
  lines.push(`│  ${chalk.dim('Token:      ')} ${tokens} / ${maxTokens} (${pct.toFixed(1)}%)`);
  lines.push(`│  ${chalk.dim('进度条:     ')} ${bar} ${pct.toFixed(1)}%`);
  lines.push(`│  ${chalk.dim('压缩阈值:   ')} ${maxTokens} (达 85% 自动压缩到 60%)`);

  // === 底部:快捷键 ===
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('╰─ /help 命令 · /model 切换 · /tasks 任务 · /config 配置 · /quickstart 示例'));
  lines.push('');
  return lines.join('\n');
}
