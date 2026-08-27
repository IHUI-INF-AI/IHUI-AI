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
