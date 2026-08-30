/**
 * 内置默认值层 — 6 层 config merge 的第 1 层(最低优先级)。
 *
 * 灵感来源:参考行业 Agent 框架的 DEFAULT_SETTINGS + Claude Code 的默认配置。
 * 所有字段均提供回退值,确保任一上层缺失时仍有可用配置。
 */

import type { Settings } from '../commands/settings.js'

export const DEFAULT_SETTINGS: Settings = {
  apiUrl: 'http://localhost:8802',
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
  // 原生 function calling:默认 'auto'(先携带 tools 探测,provider 拒绝时自动降级 prompt 模式)
  nativeFunctionCalling: 'auto',
  compactionV2: { enabled: false },
  fsWatcher: { enabled: false },
  announcements: { enabled: false },
  clipboard: { enabled: false },
  // P2-6 Voice STT:默认开启(2026-07-28 改,ai-service 已用 faster-whisper 本地推理,零成本)
  voice: { enabled: true, durationSec: 5 },
  // P3-1 Mermaid 渲染:默认关闭(零回归)
  mermaid: { enabled: false },
  // P3-2 Telemetry:默认开启(2026-08-31 改,补全 CLI 埋点盲区)
  // 事件仅含 session_start/session_end/tool_call/prompt_completed/error_logged,
  // 敏感字段自动 redact;endpoint 未配置时默认上报到项目自身 /api/analytics/track(由 agent.ts 派生)。
  // 用户可在配置中显式 telemetry.enabled = false 关闭。
  telemetry: { enabled: true },
}
