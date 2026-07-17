/**
 * 内置默认值层 — 6 层 config merge 的第 1 层(最低优先级)。
 *
 * 灵感来源:grok-build 的 DEFAULT_SETTINGS + Claude Code 的默认配置。
 * 所有字段均提供回退值,确保任一上层缺失时仍有可用配置。
 */

import type { Settings } from '../commands/settings.js'

export const DEFAULT_SETTINGS: Settings = {
  apiUrl: 'http://localhost:8000',
  defaultModel: 'default',
  maxIterations: 25,
  auditEnabled: true,
  allowDangerous: false,
  planFirst: false,
  enableMcp: false,
  sandbox: { profile: 'trusted' },
  sampler: { temperature: 0.7, maxTokens: 4096 },
  locale: 'zh-CN',
  permissionMode: 'default',
  compactionV2: { enabled: false },
}
