// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AskUserQuestion 工具 — Agent 向用户提问的多选/单选工具。
 *
 * 灵感来源:自研 IDE 的 AskUserQuestion + 参考行业 Agent 框架的 ask_user 工具。
 * 简化策略(做减法):
 *   - 基于 inquirer 的 list/rawlist prompt(已有依赖,不引入新库)
 *   - 支持单选/multiselect/select-or-input 三种模式
 *   - REPL 模式直接弹窗;headless 模式拒绝(无交互)并返回错误
 *
 * 调用格式:
 *   {
 *     "question": "选择部署策略?",
 *     "header": "Deploy",
 *     "multiSelect": false,
 *     "options": [
 *       { "label": "蓝绿", "description": "..." },
 *       { "label": "滚动", "description": "..." }
 *     ]
 *   }
 *   返回:{ "selected": ["蓝绿"] } 或 { "selected": ["蓝绿","滚动"], "custom": "..." }
 */

import chalk from 'chalk';
import type { Tool, ToolResult } from './index.js';

interface AskOption {
  label: string;
  description?: string;
}

interface AskUserArgs {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: AskOption[];
}

/** 检测是否在交互式终端(非 headless) */
function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

// ───────────────── escalation budget (mechanism twin of upstream escalate) ─────────────────
// 上游机制(escalate: timeout kind:"none" + per-ask 上限 3 次,refused 是普通结果不是 error)
// 的机制等价落点:
//  - 等待面:本工具的 execBudget.notInterruptible 已表达"墙钟不代答"——预算框架对它连
//    定时器都不建(取消除外),等待不设超时这一半由既有结构面承担,不在此重复;
//  - 预算面:每个 ask(= 一次 dispatch_subagent 子任务,对应上游工作流的一次 ask)内最多
//    ASK_USER_ESCALATION_BUDGET 次求助;第 4 次返回**普通结果**(非 error):把"预算耗尽"
//    渲染成错误只会让模型反复撞同一堵墙,而自行判断正是预算要引导的行为。
//  - 预算窗口只在子代理 ask 域生效(上游只有工作流 actor 才有 escalate;主 loop 的提问
//    不设预算)。窗口由 dispatch_subagent 开/关,见 subagent.ts 的开窗点。
export const ASK_USER_ESCALATION_BUDGET = 3;

let budgetWindowActive = false;
let budgetUsedInWindow = 0;

/**
 * Open the per-ask budget window (called when a dispatch_subagent ask starts).
 * Already-active window is left untouched: concurrent sibling dispatches share
 * the same ask window instead of silently resetting each other's count.
 */
export function beginAskUserEscalationBudget(): void {
  if (budgetWindowActive) return;
  budgetWindowActive = true;
  budgetUsedInWindow = 0;
}

/** Close the window (called when the whole top-level ask has settled). */
export function endAskUserEscalationBudget(): void {
  budgetWindowActive = false;
}

export const ask_user_question: Tool = {
  name: 'ask_user_question',
  description: '向用户提问以获取决策(单选/多选)。参数:question(问题文本),header(简短标签,可选),multiSelect(是否多选,默认 false),options(选项数组,每项含 label + description)。REPL 模式弹 inquirer 选择;headless 模式拒绝并返回错误。适用于:在多路径方案中让用户决定、确认 destructive 操作的细节、获取缺失的配置参数。',
  dangerLevel: 'read',
  /**
   * 结构性声明(不是豁免账):本工具的全部工作就是**等人回答**,墙钟打断它等于
   * "用户还没想完,系统替他选了失败"。headless 分支在进 prompt 之前就已返回,不占用这一档。
   *
   * 用 `notInterruptible` 而不是 `*-exempt:` 注释,是刻意的两件事:
   * ① 守门 108 管的是"带到期日的豁免账",而这一条是**结构性定性**(位置性质不随时间改变),
   *    给它挂到期日只会逼人删标记、删了又被预算门判红(两道门互咬);
   * ② 理由写在数据里而不是注释里 —— 注释能被下一次编辑顺手带走,字段不能,且缺 reason 直接不合法。
   */
  execBudget: {
    notInterruptible: true,
    reason: 'Waits for a human answer at the inquirer prompt; a wall-clock abort would answer on their behalf.',
  },
  parameters: {
    question: { type: 'string', description: '问题文本' },
    header: { type: 'string', description: '简短标签(最多 12 字符,如 "Auth method")' },
    multiSelect: { type: 'boolean', description: '是否多选(默认 false 单选)' },
    options: {
      type: 'array',
      description: '选项数组(2-4 项)',
      items: {
        type: 'object',
        description: '单个选项',
        properties: {
          label: { type: 'string', description: '选项文本(1-5 字)' },
          description: { type: 'string', description: '说明(可选,描述含义或权衡)' },
        },
        required: ['label'],
      },
    },
  },
  required: ['question', 'options'],
  async execute(args): Promise<ToolResult> {
    const opts = args as unknown as AskUserArgs;
    if (!opts.question || typeof opts.question !== 'string') {
      return { success: false, output: '', error: 'question 参数必须为非空字符串' };
    }
    if (!Array.isArray(opts.options) || opts.options.length < 2 || opts.options.length > 4) {
      return { success: false, output: '', error: 'options 必须是 2-4 项数组' };
    }
    for (let i = 0; i < opts.options.length; i++) {
      const o = opts.options[i]!;
      if (!o || typeof o.label !== 'string' || o.label.length === 0) {
        return { success: false, output: '', error: `options[${i}].label 必须为非空字符串` };
      }
    }
    if (!isInteractive()) {
      return {
        success: false,
        output: '',
        error: 'headless 模式不支持 ask_user_question(无交互终端)。请改用默认值或在 REPL 模式运行,或通过 --allow-dangerous 跳过询问。',
        errorType: 'not_interactive',
      };
    }
    // Per-ask escalation budget: the 4th ask within an open window is REFUSED as
    // a plain result (not an error) — same shape as upstream escalate refused.
    // Headless branch above returned before this, so it never consumes budget.
    if (budgetWindowActive) {
      budgetUsedInWindow++;
      if (budgetUsedInWindow > ASK_USER_ESCALATION_BUDGET) {
        return {
          success: true,
          output:
            `Escalation budget for this ask is spent (${ASK_USER_ESCALATION_BUDGET}/${ASK_USER_ESCALATION_BUDGET}). ` +
            'No answer is coming; proceed on your own best judgement and state the assumption you are proceeding on.',
        };
      }
    }
    // 动态导入 inquirer(避免 headless 模式启动时也加载)
    const inquirer = (await import('inquirer')).default;
    const headerPrefix = opts.header ? chalk.cyan(`[${opts.header}] `) : '';
    const multiSelect = opts.multiSelect === true;
    const choices = opts.options.map((o) => {
      const desc = o.description ? chalk.dim(` — ${o.description}`) : '';
      return { name: `${o.label}${desc}`, value: o.label, short: o.label };
    });
    if (multiSelect) {
      const answers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: `${headerPrefix}${opts.question}`,
          choices,
          validate: (val: unknown) => Array.isArray(val) && val.length > 0 ? true : '至少选择一项',
        },
      ]);
      const selected = answers.selected as string[];
      return {
        success: true,
        output: `用户选择(多选): ${selected.join(', ')}\n继续基于这些选择执行。`,
      };
    }
    // 单选 + "Other(自定义输入)" 选项(对齐 AI 工作台 AskUserQuestion 行为)
    const otherChoice = { name: chalk.dim('Other(自定义输入)'), value: '__OTHER__', short: 'Other' };
    const answers = await inquirer.prompt([
      {
        type: 'select',
        name: 'selected',
        message: `${headerPrefix}${opts.question}`,
        choices: [...choices, otherChoice],
      },
    ]);
    if (answers.selected === '__OTHER__') {
      const custom = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: '输入自定义答案:',
          validate: (v: string) => v.trim().length > 0 ? true : '不能为空',
        },
      ]);
      return {
        success: true,
        output: `用户自定义输入: ${custom.value as string}\n继续基于该输入执行。`,
      };
    }
    return {
      success: true,
      output: `用户选择: ${answers.selected as string}\n继续基于该选择执行。`,
    };
  },
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
