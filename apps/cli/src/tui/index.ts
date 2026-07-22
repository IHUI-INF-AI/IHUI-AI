/**
 * TUI 增强模块 — 聚合导出 @ 文件模糊搜索 / Plan-Build 模式切换 / 图片输入 / 提示增强。
 * 供 repl.ts 后续集成调用,本模块不直接操作 readline。
 */

export { findFiles, type FuzzyFileResult } from './fuzzy-file.js';
export {
  ModeManager,
  type WorkMode,
  type ModeManagerOptions,
  type ModeHistoryEntry,
  type ModeSuggestion,
} from './mode-manager.js';
export { readImageFromPath, readImageFromClipboard, type ImageInput, type ImageReadResult } from './image-input.js';
export { enhancePrompt, enhanceWithImage, type EnhancedPrompt } from './prompt-enhancer.js';
export { buildModePrompt, buildModeBanner, buildModeHistory } from './prompt-builder.js';
