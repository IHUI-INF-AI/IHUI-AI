// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 插件市场数据源(2026-07-22 v3 重构,扩充至 24 内置 + 100+ 市场主流)
// 本文件已拆分为子模块(types / project-plugins / market-plugins),对外 API 通过再导出保持兼容。

export type { PluginCategory, ProjectPlugin, MarketPlugin } from './plugins-data/types'
export { PROJECT_PLUGINS } from './plugins-data/project-plugins'
export { MARKET_PLUGINS } from './plugins-data/market-plugins'

const REAL_INTEGRATED_IDS = new Set<string>([
  // 浏览器控制(12)→ 走 ai-service 12 个 browser_* MCP 工具(桥接到 extension 端)
  'playwright-mcp',
  'puppeteer',
  'browser-use',
  'browserbase',
  'stagehand',
  'skyvern',
  'browserless',
  'selenium',
  'playwright',
  'multion',
  'axiom',
  'brightdata',
  // 电脑控制(7)→ 走 ai-service 10 个 computer_* MCP 工具(桥接到 desktop 端)
  'anthropic-computer-use',
  'claude-desktop',
  'self-operating-computer',
  'openadapt',
  'adept-act',
  'agsafety-agent',
  'openai-operator',
  // 文件系统(1)
  'filesystem-mcp',
  // 数据库(1)→ ai-service db_query MCP 工具(只读 SELECT/WITH)
  'postgres-mcp',
  // 搜索(1)→ ai-service search_web / web_search MCP 工具
  'duckduckgo',
  // 代码执行(2)
  'code-interpreter-mcp',
  'e2b',
  // Build Web Apps(走 e2b/code-interpreter MCP 真实调用)
  'build-web-apps',
  // git(1)→ ai-service git_operations MCP 工具
  'github-mcp',
  // LangGraph 已用
  'langgraph',
])

/** LiteLLM 已接入的模型供应商 plugin id(需用户配 .env 激活) */
const MODEL_INTEGRATED_IDS = new Set<string>([
  // 原生 provider 适配器(14 个)
  'claude-skills',
  'doubao',
  'zhipu',
  'qwen',
  'hunyuan',
  'volcengine',
  'kling',
  'openrouter',
  // LiteLLM catchall(模型前缀路由,60+ env key)
  'grok',
  'mistral',
  'cohere',
  'perplexity',
  'deepseek',
  'moonshot',
  'baidu-ernie',
  'minimax',
  'yi',
  'spark',
  'baichuan',
  'together-ai',
  'fireworks-ai',
  'groq',
  'replicate',
  'ollama',
  'lm-studio',
  'jan',
  'cerebras',
  'sambanova',
  'siliconcloud',
  'modelscope',
  'bailian',
  'alibaba-cloud-bailian',
  'aws-bedrock',
  'azure-ai',
  'vertex-ai',
  'watsonx',
  'huggingface-models',
  'huggingface-spaces',
  'workers-ai',
  'github-models',
])

/** 查询 plugin 的真实集成度
 *  - true:ai-service 后端有对应 MCP 工具,LLM 真能调用
 *  - 'model':LLM 供应商已接入(LiteLLM),需用户配 .env 激活
 *  - undefined:仅前端 prompt 意图或纯外链,后端无对应实现 */
export function getPluginIntegration(pluginId: string): boolean | 'model' | undefined {
  if (REAL_INTEGRATED_IDS.has(pluginId)) return true
  if (MODEL_INTEGRATED_IDS.has(pluginId)) return 'model'
  return undefined
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
