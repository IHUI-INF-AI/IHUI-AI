/**
 * YOLO 逃生舱统一入口。
 *
 * 此前 YOLO(跳过危险确认)状态分散在三层,判定逻辑各自为政:
 *   1. 环境变量 IHUI_YOLO(builtins.ts run_command / terminal.ts terminal_open 内直读)
 *   2. 权限模式 permissionMode === 'bypassPermissions'(permissions.ts decideWithMode)
 *   3. allowDangerous 档位(ACP server / 各启动入口)
 *
 * 本模块提供统一读取函数:每次调用实时聚合三层 + 本档位(yolo),任一开启即生效(OR 语义)。
 * 注意:必须每次调用实时读取 process.env 与配置,禁止在模块加载时缓存
 * (测试会在运行中动态增删环境变量,见 terminal.test.ts 的 IHUI_YOLO save/restore 模式)。
 */

import type { Settings } from '../commands/settings.js';
import { loadConfig } from './index.js';
import { envBool } from './env.js';

/** YOLO 状态:enabled = 是否任一层开启;sources = 已开启的层列表(用于诊断展示) */
export interface YoloStatus {
  enabled: boolean;
  sources: string[];
}

/**
 * 聚合读取 YOLO 状态(每次调用实时读取,不缓存)。
 * @param settings 可选,传入已合并的配置(缺省时现场走 6 层 config merge 读取)
 */
export function getYoloStatus(settings?: Partial<Settings>): YoloStatus {
  const sources: string[] = [];
  // 层 1:环境变量 IHUI_YOLO(1/true/yes/on/enabled,大小写不敏感)
  if (envBool('IHUI_YOLO') === true) sources.push('env:IHUI_YOLO');
  // 层 2-4:config 档位(yolo / permissionMode=bypassPermissions / allowDangerous)
  const s = settings ?? loadConfig();
  if (s.yolo === true) sources.push('config:yolo');
  if (s.permissionMode === 'bypassPermissions') sources.push('config:permissionMode=bypassPermissions');
  if (s.allowDangerous === true) sources.push('config:allowDangerous');
  return { enabled: sources.length > 0, sources };
}

/** YOLO 是否启用(任一层开启即生效)— 各处危险命令判定统一调用本函数 */
export function isYoloEnabled(settings?: Partial<Settings>): boolean {
  return getYoloStatus(settings).enabled;
}
