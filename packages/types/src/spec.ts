/**
 * Spec 模式跨端契约类型(2026-07-22 立,对标 Trae IDE Spec 模式)。
 *
 * 从代码 AST 反向生成规格文档(markdown),跨端共享: web + api + ai-service + cli。
 * 调用链路: web SpecPanel → POST /api/spec/generate → ai-service /api/spec/generate
 *           → spec_generator.py(tree-sitter AST 解析 → markdown)
 */

/** 对话模式(对标 CLI mode-manager.ts 的 WorkMode,扩展 spec 四态) */
export type ChatMode = 'build' | 'plan' | 'review' | 'spec'

/** Spec 生成范围类型 */
export type SpecScopeType = 'file' | 'dir' | 'workspace'

/** Spec 生成范围 */
export interface SpecScope {
  /** 范围类型:file=单文件 / dir=目录 / workspace=全工作区 */
  type: SpecScopeType
  /** 目标路径(file/dir 相对工作区根;workspace 时可省略) */
  path?: string
}

/** Spec 生成请求输入 */
export interface SpecGenerateInput {
  /** 生成范围 */
  scope: SpecScope
  /** 工作区根路径(沙箱边界 + 相对路径基准) */
  workspacePath: string
  /** 是否包含依赖关系分析(默认 true) */
  includeDependencies?: boolean
  /** 目标语言过滤(为空则全语言) */
  languages?: string[]
}

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

/** Spec 模板(预置生成模板,GET /spec/templates 返回) */
export interface SpecTemplate {
  /** 模板 ID */
  id: string
  /** 模板名称 */
  name: string
  /** 模板描述 */
  description: string
  /** 模板适用的章节结构 */
  sections: string[]
}

/** Spec 生成响应(API 契约,{ code, message, data } 中 data 字段) */
export type SpecGenerateResponseData = SpecGenerateOutput

/** Spec 模板列表响应 data 字段 */
export type SpecTemplatesResponseData = {
  templates: SpecTemplate[]
}
