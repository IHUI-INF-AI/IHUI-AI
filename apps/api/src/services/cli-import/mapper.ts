import { randomUUID } from 'node:crypto'

import type { CliApiFormat, CliAppType, CliConfigSource, ImportedProvider } from '@ihui/types'

/**
 * providerCode 三重推断:
 * 1. baseUrl 域名匹配
 * 2. apiFormat 暗示
 * 3. modelId 前缀兜底
 * 都不匹配 → 'custom'
 */
export function inferProviderCode(
  baseUrl: string,
  apiFormat: CliApiFormat,
  model?: string,
): string {
  const url = baseUrl.toLowerCase()
  if (url.includes('anthropic.com')) return 'anthropic'
  if (url.includes('openai.com')) return 'openai'
  if (url.includes('googleapis.com') || apiFormat === 'gemini_native') return 'google'
  if (url.includes('deepseek.com')) return 'deepseek'
  if (url.includes('moonshot.cn') || url.includes('kimi')) return 'moonshot'
  if (url.includes('bigmodel.cn') || url.includes('zhipuai')) return 'zhipu'
  if (url.includes('dashscope.aliyuncs.com') || url.includes('bailian')) return 'alibaba'
  if (url.includes('baidubce.com') || url.includes('qianfan')) return 'baidu'
  if (url.includes('volces.com') || url.includes('doubao') || url.includes('ark.cn-beijing'))
    return 'bytedance'
  if (url.includes('api.stepfun.com')) return 'stepfun'
  if (url.includes('groq.com')) return 'groq'
  if (url.includes('openrouter.ai')) return 'openrouter'
  if (url.includes('127.0.0.1') || url.includes('localhost')) return 'local'
  if (url.includes('siliconflow.cn')) return 'siliconflow'
  if (url.includes('packyapi.com') || url.includes('packycode')) return 'packycode'
  if (url.includes('aigocode.com')) return 'aigocode'
  // 模型名兜底
  if (model?.startsWith('claude-')) return 'anthropic'
  if (model?.startsWith('gpt-')) return 'openai'
  if (model?.startsWith('gemini-')) return 'google'
  if (model?.startsWith('deepseek-')) return 'deepseek'
  if (model?.startsWith('kimi-') || model?.startsWith('moonshot-')) return 'moonshot'
  if (model?.startsWith('glm-')) return 'zhipu'
  if (model?.startsWith('qwen-')) return 'alibaba'
  if (model?.startsWith('ernie-')) return 'baidu'
  if (model?.startsWith('doubao-')) return 'bytedance'
  return 'custom'
}

/**
 * 名称去重:同 cc-switch db 中 (id, app_type) 复合主键可能导致同 name 跨 app_type。
 * 单 app_type 时返回原名;多 app_type 时加后缀 (appType)。
 */
export function deduplicateName(name: string, appType?: CliAppType): string {
  if (!appType) return name
  // 仅在 cc-switch 多 app_type 场景需要后缀;claude-desktop/cli/opencode/openclaw 等不常见
  const multiAppTypes: CliAppType[] = ['claude', 'codex', 'gemini', 'hermes']
  if (multiAppTypes.includes(appType)) {
    return `${name} (${appType})`
  }
  return name
}

/**
 * 校验并规范化 ImportedProvider 必填字段。
 * - baseUrl 为空 → 标警告
 * - apiKey 为空 → 标警告(不阻断导入,UI 显示"需手动补全")
 * - apiFormat 不在枚举 → fallback 'openai_chat'
 */
export function normalizeProvider(p: ImportedProvider): ImportedProvider {
  const warnings = [...p.warnings]
  if (!p.baseUrl) {
    warnings.push('baseUrl 为空,需手动补全')
  }
  if (!p.apiKey) {
    warnings.push('apiKey 为空,需手动补全')
  }
  const validFormats: CliApiFormat[] = [
    'openai_chat',
    'anthropic_messages',
    'openai_responses',
    'gemini_native',
  ]
  const apiFormat = validFormats.includes(p.apiFormat) ? p.apiFormat : 'openai_chat'
  return {
    ...p,
    apiFormat,
    warnings,
  }
}

/**
 * HTML/XSS 清洗 provider.name(只允许纯文本,不允许任何标签)。
 */
export function sanitizeProviderName(name: string): string {
  return name
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim()
    .slice(0, 100) // 对齐 ai_model_config.name varchar(100)
}

/**
 * 生成 previewId(Node 14.17+ 原生 randomUUID)。
 */
export function generatePreviewId(): string {
  return randomUUID()
}

/**
 * 推断源工具版本(用于 cli_provider_imports.source_version)。
 * 这里是占位实现,具体版本号由各 parser 内部从配置文件中读取(如 cc-switch settings 表的 schemaVersion)。
 */
export function inferSourceVersion(source: CliConfigSource, raw?: unknown): string | undefined {
  if (!raw) return undefined
  if (source === 'cc-switch') {
    const r = raw as { schemaVersion?: number; version?: string }
    return r.version ?? (r.schemaVersion ? `v3.x (schema ${r.schemaVersion})` : undefined)
  }
  if (source === 'codex++') {
    const r = raw as { appVersion?: string; version?: string }
    return r.appVersion ?? r.version
  }
  return undefined
}
