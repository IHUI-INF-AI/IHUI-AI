// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { LucideIcon } from 'lucide-react'

export type PluginCategory =
  | 'builtin'
  | 'mcp'
  | 'agent'
  | 'workflow'
  | 'tool'
  | 'model'
  | 'market'
  | 'ide'
  | 'knowledge'
  | 'creation'
  | 'browser'
  | 'computer'
  | 'video'
  | 'devops'
  | 'data'
  | 'search'
  | 'communication'
  | 'design'
  | 'productivity'
  | 'security'

export interface ProjectPlugin {
  id: string
  name: string
  description: string
  href: string
  icon: LucideIcon
  tags: string[]
  category: PluginCategory
}

export interface MarketPlugin {
  id: string
  name: string
  description: string
  url: string
  /** lobehub 厂商代码(小写),用于 BrandIcon;为空则用 fallbackIcon */
  vendor?: string
  fallbackIcon: LucideIcon
  tags: string[]
  category: PluginCategory
  free?: boolean
  official?: boolean
  /**
   * 调用模式(2026-07-22 新增,用户需求:插件内置可在平台内调用,不跳转外部)
   * - 'dialog'(默认):点击后打开 AI 对话面板,注入"使用该插件"消息,由 AI 调用对应工具完成
   * - 'external':纯外部参考链接,点击后新窗口跳转(仅极少数无法内置化的插件)
   *
   * 默认所有插件都是 'dialog',让用户在平台内直接调用,而不是被甩到外部平台。
   */
  invokeMode?: 'dialog' | 'external'
  /**
   * 真实集成度(2026-07-22 新增,基于 ai-service mcp_server.py 36 工具 + llm_gateway 80+ provider 调研)
   * - true:ai-service 后端有对应 MCP 工具/原生 provider 适配器,点击"添加到对话"后
   *        LLM 真的能调用对应工具(浏览器控制/电脑控制/文件系统/数据库/搜索/代码执行/视觉/git 等)
   * - false/未填:仅前端 prompt 意图,后端无对应实现,添加到对话仅作 UI 标记
   * - 'model':LLM 模型供应商已接入(LiteLLM catchall 或原生 provider),需用户配 .env 激活
   *
   * 用户在卡片上看到"已集成"徽章即知道真能用,"外部参考"则只是导航链接。
   */
  realIntegrated?: boolean | 'model'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
