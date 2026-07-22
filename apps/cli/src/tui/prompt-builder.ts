/**
 * 模式提示构建器 — 为 Plan/Build/Review 三模式生成 system prompt 片段、可视化 banner、历史格式化。
 * - buildModePrompt(mode):模式特定的 system prompt 增强
 * - buildModeBanner(mode):模式切换时的 ANSI 彩色 banner
 * - buildModeHistory(mode, actions):模式操作历史格式化字符串
 *
 * 设计:纯函数,无副作用,不直接打印(由调用方输出)。
 * 运行时依赖:仅 chalk;类型依赖 mode-manager.ts(仅 import type,编译期擦除,无循环依赖)。
 */

import chalk from 'chalk';
import type { WorkMode, ModeHistoryEntry } from './mode-manager.js';

/** 模式特定的 system prompt 片段(注入到对话 system message 末尾) */
export function buildModePrompt(mode: WorkMode): string {
  switch (mode) {
    case 'plan':
      return [
        '【PLAN MODE — 只读调研模式】',
        '你当前处于 PLAN 模式,这是一个只读模式。',
        '目标:深入调研、分析、规划,为后续 BUILD 阶段产出清晰的执行计划。',
        '约束:',
        '- 严禁修改任何文件(不调用 write_file/edit_file/delete_file/run_command 写操作)。',
        '- 只能使用只读工具:read_file/list_dir/grep/glob/git_(status|diff|log)/lsp_*/codegraph/web_search/fetch_url。',
        '- 输出结构化调研结论:现状分析、问题定位、影响范围、建议方案、风险点。',
        '- 若任务必须修改才能完成,请在计划末尾明确标注「需切换 BUILD 模式执行」并给出具体步骤。',
      ].join('\n');
    case 'review':
      return [
        '【REVIEW MODE — 代码审查模式】',
        '你当前处于 REVIEW 模式,这是一个只读审查模式。',
        '目标:审查代码变更(git diff),提供专业 review 意见,不直接修改代码。',
        '约束:',
        '- 严禁修改任何文件,所有写工具被屏蔽。',
        '- 优先使用 git_diff / git_status 查看变更,read_file 阅读上下文。',
        '- 输出结构化 review:变更摘要、正确性、安全性、性能、可维护性、风格一致性、阻塞/建议项。',
        '- 明确区分「阻塞项(必须修复)」与「建议项(可选优化)」。',
        '- 不要直接提交修复代码;如需修复,在审查结论末尾建议切换 BUILD 模式。',
      ].join('\n');
    case 'build':
    default:
      return [
        '【BUILD MODE — 执行修改模式】',
        '你当前处于 BUILD 模式,全工具开放。',
        '目标:高效执行任务,直接修改文件完成任务目标。',
        '约束:',
        '- 每个修改都要有明确依据,避免无关重构。',
        '- 修改前先理解上下文(必要时 read_file/grep),修改后给出变更说明。',
        '- 保持最小化改动,复用现有代码与模式,不做超范围的"改进"。',
        '- 危险操作(删除/强推/删库表)前先与用户确认。',
      ].join('\n');
  }
}

/** 模式切换时的可视化 banner(ANSI 彩色),适合打印到终端 */
export function buildModeBanner(mode: WorkMode): string {
  switch (mode) {
    case 'plan':
      return chalk.blue.bold('📖 PLAN MODE — 只读调研,不修改文件');
    case 'review':
      return chalk.magenta.bold('🔍 REVIEW MODE — 审查变更,不直接修改');
    case 'build':
    default:
      return chalk.green.bold('🔨 BUILD MODE — 全工具开放,执行修改');
  }
}

/**
 * 格式化模式操作历史为可读字符串(带时间戳与类型标记)。
 * @param mode 模式(用于标题)
 * @param actions 历史条目列表
 * @returns 多行字符串;空列表返回"暂无操作历史"
 */
export function buildModeHistory(mode: WorkMode, actions: ModeHistoryEntry[]): string {
  if (actions.length === 0) {
    return `${mode.toUpperCase()} 模式暂无操作历史。`;
  }
  const header = chalk.cyan(`── ${mode.toUpperCase()} 模式操作历史(共 ${actions.length} 条)──`);
  const lines = actions.map((entry, i) => {
    const time = new Date(entry.ts).toLocaleTimeString('zh-CN', { hour12: false });
    const typeTag =
      entry.type === 'write'
        ? chalk.red('[W]')
        : entry.type === 'query'
          ? chalk.blue('[Q]')
          : entry.type === 'read'
            ? chalk.gray('[R]')
            : chalk.gray('[S]');
    const idx = String(i + 1).padStart(3, ' ');
    return `${typeTag} ${chalk.gray(time)} ${idx}. ${entry.action}`;
  });
  return [header, ...lines].join('\n');
}
