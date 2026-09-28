// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// Stub for @ihui/shared/tasks/dispatch - vitest mock
// Provides useAgentRuntime hook stub used by AgentRuntimePanel.

export interface AgentRuntime {
  isRunning: boolean
  start: () => void
  stop: () => void
  logs: string[]
}

export function useAgentRuntime(_opts?: Record<string, unknown>): AgentRuntime {
  return {
    isRunning: false,
    start() {},
    stop() {},
    logs: [],
  }
}
