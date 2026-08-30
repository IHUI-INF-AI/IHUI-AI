/**
 * 浏览器自动化工具（占位恢复，2026-08-31）。
 *
 * 背景：`apps/cli/src/tools/index.ts:21`（commit 33955c14b2）已 import 并注册
 * `BROWSER_TOOLS`，但源文件 `browser.ts` 是未跟踪半成品，被并发会话的
 * `git clean` 删除后丢失。此处补最小占位实现（空工具集）保证编译与
 * `registerBrowserTools()` 幂等行为正常；完整浏览器自动化工具待后续补充。
 *
 * 用法：`registerBrowserTools()` 注册后无浏览器工具（空集，不改变现有行为）。
 */
import type { Tool } from './index.js';

/** 浏览器自动化工具集（当前为空占位，待完整实现）。 */
export const BROWSER_TOOLS: Tool[] = [];
