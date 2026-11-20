// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-20 第 31 项:命令钩子配置面的只读自述(web 侧消费)。
 *
 * 目的:让"配了钩子却没生效"在线可见。后端唯一判据 = ai-service
 * `GET /api/agent/command-hooks`(core.command_hooks.describe_command_hooks),
 * 本 Hook 只做取数与形状收窄,不重算信任状态、不改配置(写面仍只有本机 CLI)。
 *
 * 取不到(网络/鉴权/形状)一律返回 null —— 面板不因此报错,不冒充"未配置"。
 */

import React from 'react'
import { fetchAiServiceJson } from '@/lib/api'

export type CommandHookConfigStatus =
  'not-configured' | 'empty' | 'invalid' | 'untrusted' | 'trusted'

export interface CommandHookSpecView {
  name: string
  event: string
  matcher: string
  timeout: number
  commandPreview: string
  argCount: number
}

export interface CommandHooksConfig {
  configured: boolean
  status: CommandHookConfigStatus
  error: string | null
  specs: CommandHookSpecView[]
}

function toStatus(value: unknown): CommandHookConfigStatus | null {
  switch (value) {
    case 'not-configured':
    case 'empty':
    case 'invalid':
    case 'untrusted':
    case 'trusted':
      return value
    default:
      return null
  }
}

function toView(raw: unknown): CommandHooksConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const status = toStatus(body.status)
  if (!status) return null
  const specs = Array.isArray(body.specs)
    ? body.specs.filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    : []
  return {
    configured: body.configured === true,
    status,
    error: typeof body.error === 'string' ? body.error : null,
    specs: specs.map((s) => ({
      name: String(s.name ?? ''),
      event: String(s.event ?? ''),
      matcher: String(s.matcher ?? ''),
      timeout: typeof s.timeout === 'number' ? s.timeout : 0,
      commandPreview: String(s.command_preview ?? ''),
      argCount: typeof s.arg_count === 'number' ? s.arg_count : 0,
    })),
  }
}

/**
 * @param enabled 有活动 agent 时才取(workbench 面板未打开/无会话不产生请求)
 */
export function useCommandHooksConfig(enabled: boolean): CommandHooksConfig | null {
  const [config, setConfig] = React.useState<CommandHooksConfig | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchAiServiceJson<{
          data?: unknown
        }>('/api/agent/command-hooks')
        if (cancelled) return
        const payload = res.success ? res.data?.data : undefined
        setConfig(toView(payload))
      } catch {
        if (!cancelled) setConfig(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return config
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
