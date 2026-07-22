/**
 * Plan/Build/Review 模式管理器 — Tab 切换,右下角模式指示器。
 * - build 模式 = 全权修改(对应 permissionMode 'default',全工具开放)
 * - plan 模式 = 只读分析(对应 permissionMode 'plan',禁止 write/edit/delete 工具)
 * - review 模式 = 只读审查(对应 permissionMode 'plan',禁止写工具,聚焦 diff 审查)
 * 灵感来源:OpenCode 的 Tab mode switch;新增 review 模式 + 模式自动建议 + 模式历史超越之。
 */

import chalk from 'chalk';
import type { PermissionMode } from '../tools/permissions.js';
import { buildModePrompt, buildModeBanner } from './prompt-builder.js';

export type WorkMode = 'build' | 'plan' | 'review';

/** 模式操作历史条目 */
export interface ModeHistoryEntry {
  /** 时间戳(ms) */
  ts: number;
  /** 操作描述 */
  action: string;
  /** 操作类型 */
  type: 'read' | 'write' | 'query' | 'system';
}

/** 模式自动建议结果 */
export interface ModeSuggestion {
  mode: WorkMode;
  /** 置信度 0-1(命中关键词占比) */
  confidence: number;
  /** 推荐理由(含命中关键词) */
  reason: string;
}

/** 模式历史上限 */
const MAX_HISTORY = 100;

/** 只读工具集(plan / review 模式允许的工具) */
const READONLY_TOOLS: readonly string[] = [
  'read_file',
  'list_dir',
  'grep',
  'glob',
  'git_status',
  'git_diff',
  'git_log',
  'clipboard_read',
  'fetch_url',
  'web_search',
  'lsp_goto_definition',
  'lsp_find_references',
  'lsp_diagnostics',
  'lsp_hover',
  'codegraph',
  'goto_definition',
  'find_references',
  'get_diagnostics',
  'ask_user_question',
  'list_background_tasks',
  'get_command_output',
  'wait_command',
];

/** 写/副作用工具集(build 模式额外开放;plan / review 屏蔽) */
const WRITE_TOOLS: readonly string[] = [
  'write_file',
  'edit_file',
  'delete_file',
  'git_add',
  'git_commit',
  'clipboard_write',
  'todo_write',
  'run_command',
  'run_tests',
  'dispatch_subagent',
  'kill_command',
];

/** 关键词 → 模式 映射(用于 suggestMode) */
const SUGGEST_KEYWORDS: { mode: WorkMode; keywords: string[] }[] = [
  { mode: 'plan', keywords: ['调研', '分析', '了解', '看看', '查看', '研究', '探索', '梳理', 'plan'] },
  { mode: 'build', keywords: ['修改', '实现', '重构', '添加', '删除', '编写', '创建', '修复', '更新', 'build'] },
  { mode: 'review', keywords: ['审查', '检查', '对比', '评审', 'review', 'diff'] },
];

/** 三模式循环顺序 */
const CYCLE_ORDER: readonly WorkMode[] = ['build', 'plan', 'review'];

export interface ModeManagerOptions {
  initialMode?: WorkMode;
  onChange?: (mode: WorkMode) => void;
}

export class ModeManager {
  private mode: WorkMode;
  private readonly onChangeCb?: (mode: WorkMode) => void;
  /** 各模式的操作历史(build/plan/review 各一个,切换模式时前一个被"封存") */
  private readonly histories: Record<WorkMode, ModeHistoryEntry[]>;

  constructor(opts: ModeManagerOptions = {}) {
    this.mode = opts.initialMode ?? 'build';
    this.onChangeCb = opts.onChange;
    this.histories = { build: [], plan: [], review: [] };
  }

  get currentMode(): WorkMode {
    return this.mode;
  }

  /** 当前模式图标 */
  get currentIcon(): string {
    switch (this.mode) {
      case 'plan':
        return '📖';
      case 'review':
        return '🔍';
      case 'build':
      default:
        return '🔨';
    }
  }

  /** 切换 build ↔ plan(保留原有二态行为,向后兼容),触发 onChange 回调,返回新模式 */
  toggle(): WorkMode {
    this.mode = this.mode === 'build' ? 'plan' : 'build';
    this.onChangeCb?.(this.mode);
    return this.mode;
  }

  /** 三态循环:build → plan → review → build,触发 onChange 回调,返回新模式 */
  cycleMode(): WorkMode {
    const idx = CYCLE_ORDER.indexOf(this.mode);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
    if (next) {
      this.mode = next;
      this.onChangeCb?.(this.mode);
    }
    return this.mode;
  }

  /** 显式设置模式(相同模式不触发回调) */
  setMode(mode: WorkMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onChangeCb?.(mode);
  }

  /** 映射到 permissionMode:build→default,plan/review→plan(只读) */
  getPermissionMode(): PermissionMode {
    return this.mode === 'build' ? 'default' : 'plan';
  }

  /** 返回当前模式允许的工具名列表(build=只读+写,plan/review=只读集) */
  getActiveTools(): readonly string[] {
    return this.mode === 'build'
      ? [...READONLY_TOOLS, ...WRITE_TOOLS]
      : READONLY_TOOLS;
  }

  /** 返回当前模式的 system prompt 片段(委托 prompt-builder 构建) */
  getModePrompt(): string {
    return buildModePrompt(this.mode);
  }

  /** 返回当前模式的可视化 banner(委托 prompt-builder 构建,调用方负责打印) */
  getModeBanner(): string {
    return buildModeBanner(this.mode);
  }

  /** 根据用户输入文本推荐模式(关键词匹配,置信度 = 命中数 / 总命中数) */
  suggestMode(userInput: string): ModeSuggestion {
    const text = userInput.toLowerCase();
    const matched = new Map<WorkMode, string[]>();
    let total = 0;
    let best: WorkMode = 'build';
    let max = 0;
    for (const { mode, keywords } of SUGGEST_KEYWORDS) {
      const hits: string[] = [];
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) hits.push(kw);
      }
      matched.set(mode, hits);
      total += hits.length;
      if (hits.length > max) {
        max = hits.length;
        best = mode;
      }
    }
    const confidence = total === 0 ? 0 : max / total;
    const reason =
      total === 0
        ? '未匹配到明显意图,默认 build 模式'
        : `命中关键词 [${(matched.get(best) ?? []).join(', ')}]`;
    return { mode: best, confidence, reason };
  }

  /** 向当前模式的历史追加一条操作记录(超过上限丢弃最旧的) */
  addHistoryEntry(action: string, type: ModeHistoryEntry['type'] = 'system'): void {
    const list = this.histories[this.mode];
    if (!list) return;
    list.push({ ts: Date.now(), action, type });
    if (list.length > MAX_HISTORY) list.shift();
  }

  /** 返回指定模式(默认当前模式)的历史条目 */
  getModeHistory(mode?: WorkMode): ModeHistoryEntry[] {
    return this.histories[mode ?? this.mode] ?? [];
  }

  /** 渲染右下角模式指示器字符串(含图标 + 彩色标签) */
  renderIndicator(): string {
    switch (this.mode) {
      case 'plan':
        return chalk.yellow('📖 [PLAN]');
      case 'review':
        return chalk.magenta('🔍 [REVIEW]');
      case 'build':
      default:
        return chalk.green('🔨 [BUILD]');
    }
  }

  /** 返回当前模式的 prompt 前缀(图标 + 模式名,用于对话头部显示) */
  renderPromptPrefix(): string {
    return `${this.currentIcon} ${this.mode.toUpperCase()}`;
  }
}
