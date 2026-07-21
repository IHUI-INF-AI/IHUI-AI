/**
 * Spinner 封装 — 基于 ora,统一管理首 token 等待 / 工具运行中 / 网络请求 等。
 *
 * 设计:
 * - 静默降级:无 TTY 时 ora 退化为纯文本 console.info
 * - 主题一致:spinner 颜色对齐 CLI 主色 cyan
 * - 状态切换:succeed / fail / warn / stop 都返回结束消息
 * - 自动复用:同一 spinner 可多次 start/stop
 */

import ora, { type Ora } from 'ora';
import chalk from 'chalk';

export interface SpinnerOptions {
  text?: string;
  /** spinner 颜色(默认 cyan) */
  color?: 'cyan' | 'magenta' | 'yellow' | 'green' | 'blue' | 'red';
  /** spinner 图形(默认 'dots') */
  spinner?: 'dots' | 'line' | 'arrow3' | 'bouncingBar' | 'moon';
}

export interface Spinner {
  start(text?: string): void;
  update(text: string): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  warn(text?: string): void;
  stop(): void;
  isSpinning(): boolean;
}

/** 创建一个 spinner 实例 */
export function createSpinner(opts: SpinnerOptions = {}): Spinner {
  const color = opts.color ?? 'cyan';
  const spinnerType = opts.spinner ?? 'dots';
  let instance: Ora | null = null;
  let spinning = false;

  const ensureInstance = (): Ora => {
    if (!instance) {
      instance = ora({
        text: opts.text ?? '',
        color,
        spinner: spinnerType,
        // 非 TTY 时 ora 自动降级为不显示 spinner 图形,但仍可用 text/succeed/fail
        isEnabled: true,
        discardStdin: false,
      });
    }
    return instance;
  };

  return {
    start(text?: string) {
      const inst = ensureInstance();
      if (text !== undefined) inst.text = text;
      if (!spinning) {
        inst.start();
        spinning = true;
      }
    },
    update(text: string) {
      if (instance) instance.text = text;
    },
    succeed(text?: string) {
      const inst = ensureInstance();
      inst.succeed(text ? chalk.green(text) : undefined);
      spinning = false;
    },
    fail(text?: string) {
      const inst = ensureInstance();
      inst.fail(text ? chalk.red(text) : undefined);
      spinning = false;
    },
    warn(text?: string) {
      const inst = ensureInstance();
      inst.warn(text ? chalk.yellow(text) : undefined);
      spinning = false;
    },
    stop() {
      if (instance) instance.stop();
      spinning = false;
    },
    isSpinning() {
      return spinning;
    },
  };
}

/**
 * 通用 "等待首 token" spinner — 配合 sendToAgent 使用。
 *
 * 用法:
 *   const spinner = createWaitingSpinner('glm-4.5 · 正在思考...');
 *   // 流式 onDelta 第一段到达时:
 *   spinner.stop();
 *   process.stdout.write(delta);
 */
export function createWaitingSpinner(text?: string): Spinner {
  return createSpinner({
    text: text ?? '正在思考...',
    color: 'cyan',
    spinner: 'moon',
  });
}

/** 通用 "工具运行中" spinner */
export function createToolSpinner(toolName: string, args?: string): Spinner {
  const text = args
    ? `🔧 ${toolName} · ${args.slice(0, 80)}`
    : `🔧 ${toolName} 执行中...`;
  return createSpinner({
    text,
    color: 'magenta',
    spinner: 'bouncingBar',
  });
}
