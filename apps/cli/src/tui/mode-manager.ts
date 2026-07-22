/**
 * Plan/Build 模式管理器 — Tab 切换,右下角模式指示器。
 * - build 模式 = 全权修改(对应 permissionMode 'default')
 * - plan 模式 = 只读分析(对应 permissionMode 'plan',禁止 write/edit/delete 工具)
 * 灵感来源:OpenCode 的 Tab mode switch。
 */

import chalk from 'chalk';
import type { PermissionMode } from '../tools/permissions.js';

export type WorkMode = 'build' | 'plan';

export interface ModeManagerOptions {
  initialMode?: WorkMode;
  onChange?: (mode: WorkMode) => void;
}

export class ModeManager {
  private mode: WorkMode;
  private readonly onChangeCb?: (mode: WorkMode) => void;

  constructor(opts: ModeManagerOptions = {}) {
    this.mode = opts.initialMode ?? 'build';
    this.onChangeCb = opts.onChange;
  }

  get currentMode(): WorkMode {
    return this.mode;
  }

  /** 切换 build ↔ plan,触发 onChange 回调,返回新模式 */
  toggle(): WorkMode {
    this.mode = this.mode === 'build' ? 'plan' : 'build';
    this.onChangeCb?.(this.mode);
    return this.mode;
  }

  /** 显式设置模式(相同模式不触发回调) */
  setMode(mode: WorkMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onChangeCb?.(mode);
  }

  /** 映射到 permissionMode:build→default,plan→plan */
  getPermissionMode(): PermissionMode {
    return this.mode === 'plan' ? 'plan' : 'default';
  }

  /** 渲染右下角模式指示器字符串 */
  renderIndicator(): string {
    return this.mode === 'plan'
      ? chalk.yellow('[PLAN]')
      : chalk.green('[BUILD]');
  }
}
