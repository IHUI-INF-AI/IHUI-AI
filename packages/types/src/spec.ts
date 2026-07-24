/**
 * Spec 模式类型定义(2026-07-22 立,2026-07-24 整合去重)。
 *
 * 跨端共享类型(SpecScopeType / SpecSection / SpecScope / SpecGenerateInput / SpecTemplate
 * / SpecDocument / SpecGenerateResult / SpecHistoryEntry / SpecDiff / SpecVariable 等)
 * 已统一到 @ihui/shared/spec(index.ts),本文件仅保留 @ihui/types 独有类型:
 *  - ChatMode(web stores/mode.ts + mode-switcher.tsx 独有,4 态对话模式)
 *  - SpecStats(api spec-service.ts + web spec-panel.tsx 独有,字段与 shared SpecGenerateResult.stats 不同)
 *  - SpecGenerateOutput(api spec-service.ts + web spec-panel.tsx 独有,与 shared SpecGenerateResult 字段不同)
 *
 * 设计说明:@ihui/types 与 @ihui/shared 互不依赖(平级包,见两者 package.json dependencies),
 * 因此 SpecGenerateOutput.sections 不能引用 @ihui/shared 的 SpecSection,采用内联结构类型
 * (TypeScript 结构类型系统下与 shared SpecSection 兼容,可互相赋值)。
 *
 * 历史清理(2026-07-24):
 *  - 删除重复的 SpecScopeType 定义(与 @ihui/shared/spec 重复,消费者改从 @ihui/shared 导入)
 *  - 删除重复的 SpecSection 导出(与 @ihui/shared/spec 重复,改为 SpecGenerateOutput 内联)
 *  - SpecGenerateResponseData / SpecTemplatesResponseData 为死代码(零消费者),已删除
 */

/** 对话模式(对标 CLI mode-manager.ts 的 WorkMode,扩展 spec 四态) */
export type ChatMode = 'build' | 'plan' | 'review' | 'spec'

/** Spec 生成统计信息(api 独有,字段与 shared SpecGenerateResult.stats 不同) */
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

/** Spec 生成输出(api 独有,与 shared SpecGenerateResult 字段不同) */
export interface SpecGenerateOutput {
  /** 完整 markdown 文档 */
  spec: string
  /** 结构化章节(便于前端分块渲染,结构与 @ihui/shared SpecSection 兼容) */
  sections: Array<{ title: string; content: string; level: number }>
  /** 统计信息 */
  stats: SpecStats
  /** 生成耗时(ms) */
  durationMs: number
}
