/**
 * DAP Debug API client. 端点经 /api/debug/* 代理到 ai-service。
 * 复用 @ihui/web 的 fetchApi 封装,统一返回 {code, message, data} 中的 data 字段。
 */
import { fetchApi } from '@/lib/api'

export interface LaunchParams {
  language: string
  program: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface AttachParams {
  language: string
  port: number
  host?: string
}

export interface BreakpointLine {
  line: number
  condition?: string
}

export interface SetBreakpointsParams {
  file: string
  lines: BreakpointLine[]
}

export type StepType = 'next' | 'stepIn' | 'stepOut'

export interface StoppedInfo {
  reason: string
  threadId?: number
  allThreadsStopped?: boolean
  [key: string]: unknown
}

export interface StackFrame {
  id: number
  name: string
  source?: { path?: string; name?: string }
  line: number
  column: number
  [key: string]: unknown
}

export interface DebugVariable {
  name: string
  value: string
  type?: string
  variablesReference?: number
  [key: string]: unknown
}

export interface DebugSessionInfo {
  sessionId: string
  language: string
  status: string
  [key: string]: unknown
}

export interface LaunchResult { sessionId: string }
export interface AttachResult { sessionId: string }
export interface BreakpointsResult { breakpoints: unknown[] }
export interface ContinueResult { stopped: StoppedInfo | null }
export interface StepResult { stopped: StoppedInfo | null }
export interface StackResult { stackFrames: StackFrame[] }
export interface VariablesResult { variables: DebugVariable[] }
export interface EvalResult { result: string; type?: string }
export interface DisconnectResult { disconnected: boolean }
export interface ListSessionsResult { sessions: DebugSessionInfo[] }

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetchApi<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function postEmpty<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url, { method: 'POST' })
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function delJson<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url, { method: 'DELETE' })
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function launchDebugSession(params: LaunchParams): Promise<LaunchResult> {
  return postJson<LaunchResult>('/api/debug/launch', params)
}

export function attachDebugSession(params: AttachParams): Promise<AttachResult> {
  return postJson<AttachResult>('/api/debug/attach', params)
}

export function setBreakpoints(sessionId: string, params: SetBreakpointsParams): Promise<BreakpointsResult> {
  return postJson<BreakpointsResult>(`/api/debug/sessions/${encodeURIComponent(sessionId)}/breakpoints`, params)
}

export function continueExecution(sessionId: string): Promise<ContinueResult> {
  return postEmpty<ContinueResult>(`/api/debug/sessions/${encodeURIComponent(sessionId)}/continue`)
}

export function stepExecution(sessionId: string, stepType: StepType): Promise<StepResult> {
  return postJson<StepResult>(`/api/debug/sessions/${encodeURIComponent(sessionId)}/step`, { stepType })
}

export function getStackTrace(sessionId: string): Promise<StackResult> {
  return getJson<StackResult>(`/api/debug/sessions/${encodeURIComponent(sessionId)}/stack`)
}

export function getVariables(sessionId: string, frameId: number): Promise<VariablesResult> {
  return getJson<VariablesResult>(
    `/api/debug/sessions/${encodeURIComponent(sessionId)}/variables?frameId=${encodeURIComponent(frameId)}`,
  )
}

export function evaluateExpression(
  sessionId: string,
  expression: string,
  frameId?: number,
): Promise<EvalResult> {
  return postJson<EvalResult>(
    `/api/debug/sessions/${encodeURIComponent(sessionId)}/eval`,
    { expression, frameId },
  )
}

export function disconnectSession(sessionId: string): Promise<DisconnectResult> {
  return delJson<DisconnectResult>(`/api/debug/sessions/${encodeURIComponent(sessionId)}`)
}

export function listDebugSessions(): Promise<ListSessionsResult> {
  return getJson<ListSessionsResult>('/api/debug/sessions')
}
