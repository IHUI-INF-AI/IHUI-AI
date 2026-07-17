/**
 * AskUserQuestion 工具 — Agent 向用户提问的多选/单选工具。
 *
 * 灵感来源:TRAE IDE 的 AskUserQuestion + cli 的 ask_user 工具。
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

export const ask_user_question: Tool = {
  name: 'ask_user_question',
  description: '向用户提问以获取决策(单选/多选)。参数:question(问题文本),header(简短标签,可选),multiSelect(是否多选,默认 false),options(选项数组,每项含 label + description)。REPL 模式弹 inquirer 选择;headless 模式拒绝并返回错误。适用于:在多路径方案中让用户决定、确认 destructive 操作的细节、获取缺失的配置参数。',
  dangerLevel: 'read',
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
    // 单选 + "Other(自定义输入)" 选项(对齐 TRAE AskUserQuestion 行为)
    const otherChoice = { name: chalk.dim('Other(自定义输入)'), value: '__OTHER__', short: 'Other' };
    const answers = await inquirer.prompt([
      {
        type: 'list',
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
