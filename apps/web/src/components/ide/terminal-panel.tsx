'use client'

// 纯重构(2026-08):terminal-panel 原单文件已拆分为同目录子模块,
// 本文件仅作为薄 barrel/容器,转发主组件,保证既有 importer 不变。
// 子模块:
//   ./terminal-panel/TerminalPanel.tsx      主组件(tab bar + 分屏容器)
//   ./terminal-panel/SplitPaneContainer.tsx 分屏容器
//   ./terminal-panel/TerminalViewport.tsx   单 pane xterm 视口
//   ./terminal-panel/useTerminalSearch.ts   搜索逻辑 hook
//   ./terminal-panel/*.tsx                  工具条 / 搜索条 / AI 浮层 / 历史 / 菜单 / 状态
export { TerminalPanel } from './terminal-panel/TerminalPanel'
