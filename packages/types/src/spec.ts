/**
 * Spec 模式类型定义(2026-07-22 立)。
 *
 * 此文件保留被 @ihui/types barrel 消费的独有类型:
 *  - ChatMode(web stores/mode.ts + mode-switcher.tsx)
 *  - SpecScopeType + SpecSection + SpecStats + SpecGenerateOutput(api spec-service.ts + web spec-panel.tsx)
 *
 * SpecScope / SpecGenerateInput / SpecTemplate 等重复类型已统一到 @ihui/shared/spec(index.ts)。
 * SpecGenerateResponseData / SpecTemplatesResponseData 为死代码(零消费者),已删除。
 */

/** 对话模式(对标 CLI mode-manager.ts 的 WorkMode,扩展 spec 四态) */
export type ChatMode = 'build' | 'plan' | 'review' | 'spec'

/** Spec 生成范围类型 */
export type SpecScopeType = 'file' | 'dir' | 'workspace'

/** Spec 文档单个章节 */
export interface SpecSection {
  /** 章节标题(如 "模块结构" / "API 契约" / "数据模型") */
  title: string
  /** 章节内容(markdown 片段) */
  content: string
  /** 章节级别(1=H1 / 2=H2 ...) */
  level: number
}

/** Spec 生成统计信息 */
export interface SpecStats {
  /** 扫描文件数 */
  files: number
  /** 提取符号数(类/函数/接口/类型) */
  symbols: number
  /** 识别 API endpoint 数 */
  endpoints: number
  /** 识别数据模型(schema/表)数 */
  schemas: number
}

/** Spec 生成输出 */
export interface SpecGenerateOutput {
  /** 完整 markdown 文档 */
  spec: string
  /** 结构化章节(便于前端分块渲染) */
  sections: SpecSection[]
  /** 统计信息 */
  stats: SpecStats
  /** 生成耗时(ms) */
  durationMs: number
}
