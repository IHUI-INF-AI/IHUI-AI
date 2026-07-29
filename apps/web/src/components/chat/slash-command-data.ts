/**
 * 斜杠命令静态数据(2026-07-29 立,纯数据模块 — 与运行时 / i18n / 状态完全解耦)
 *
 * 设计意图:
 * - 与 message-input.tsx 中的 `slashCommands` 构造逻辑分离
 *   `slashCommands` 依赖 t() / aiSkills / skillsLoading 等动态数据,留在组件内 useMemo 构造
 *   本文件只放纯静态 id 列表,方便其他模块(测试/文档/CLI)复用同一份 source of truth
 * - 不加 'use client'(纯数据,无 React 运行时依赖)
 * - 全部用 `import type` 处理类型依赖,确保编译后 0 运行时引用
 *
 * 命名约定:本文件名 `slash-command-data.ts`(纯数据)区别于同目录 `slash-command-palette.tsx`(组件)
 */

export const SLASH_COMMAND_IDS = [
  'summary',
  'translate',
  'explain',
  'code',
  'polish',
  'wechat-article',
  'koubo-script',
] as const

export type SlashCommandId = (typeof SLASH_COMMAND_IDS)[number]
