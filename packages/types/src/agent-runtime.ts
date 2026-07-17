export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'manual'

export type PermissionDecision = 'allow' | 'deny' | 'ask'

export type DangerLevel = 'read' | 'write' | 'dangerous'

export interface PermissionRules {
  allow?: string[]
  deny?: string[]
  ask?: string[]
  mode?: PermissionMode
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

export type PlanState =
  | 'initialized'
  | 'gathering'
  | 'executing'
  | 'done'
  | 'cancelled'

export type PlanEvent =
  | 'start'
  | 'gather_complete'
  | 'execute_complete'
  | 'cancel'
  | 'reset'

export interface PlanContext {
  currentState?: PlanState
  messages?: unknown[]
  planSteps?: string[]
  currentStepIndex?: number
}

export type HookEvent =
  | 'preToolCall'
  | 'postToolCall'
  | 'userPromptSubmit'
  | 'preCompact'
  | 'postCompact'
  | 'notification'
  | 'stop'
  | 'stopFailure'
  | 'postToolUseFailure'
  | 'permissionDenied'
  | 'subagentStart'
  | 'subagentStop'
  | 'sessionStart'
  | 'sessionEnd'

export interface HookContext {
  workspacePath?: string
  sessionId?: string
  toolName?: string
  toolArgs?: unknown
  toolResult?: unknown
  prompt?: string
  error?: string
  reason?: string
  subagentId?: string
  subagentType?: string
  compactedTokensBefore?: number
  compactedTokensAfter?: number
  notificationText?: string
}

export interface HookEntry {
  name: string
  command?: string
  webhook?: string
  method?: 'POST' | 'PUT' | 'GET'
  headers?: Record<string, string>
  body?: string
  matchTool?: string
  blockOnError?: boolean
  timeout?: number
}

export interface HooksConfig {
  preToolCall?: HookEntry[]
  postToolCall?: HookEntry[]
  sessionStart?: HookEntry[]
  sessionEnd?: HookEntry[]
  userPromptSubmit?: HookEntry[]
  preCompact?: HookEntry[]
  postCompact?: HookEntry[]
  notification?: HookEntry[]
  stop?: HookEntry[]
  stopFailure?: HookEntry[]
  postToolUseFailure?: HookEntry[]
  permissionDenied?: HookEntry[]
  subagentStart?: HookEntry[]
  subagentStop?: HookEntry[]
}

export interface HookResult {
  proceed: boolean
  reason?: string
}

export type JSONSchemaType =
  | 'object'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'null'

export interface JSONSchema {
  type?: JSONSchemaType | JSONSchemaType[]
  description?: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema
  enum?: (string | number | boolean | null)[]
  additionalProperties?: boolean | JSONSchema
  [key: string]: unknown
}

export interface PersonaContract {
  input_schema: JSONSchema
  output_schema: JSONSchema
}

export type PersonaContracts = Record<string, PersonaContract>

export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: string
  toolCallId?: string
  toolName?: string
}

export interface SessionState {
  id: string
  sessionId: string
  createdAt: string
  updatedAt: string
  model?: string
  messages: SessionMessage[]
  toolState?: Record<string, unknown>
  cwd?: string
  status: SessionStatus
  error?: string
}

export interface SessionSummary {
  id: string
  createdAt: string
  updatedAt: string
  status: SessionStatus
}

export type SubagentPersona = 'researcher' | 'coder' | 'reviewer' | 'planner' | 'general'

export type CapabilityMode = 'read-only' | 'read-write' | 'execute' | 'all'

export type IsolationMode = 'none' | 'worktree'

export interface SkillFrontmatter {
  name?: string
  description?: string
  allowedTools?: string[]
  tools?: string[]
  model?: string
  tags?: string[]
}

export interface SkillDefinition {
  filePath: string
  sourceDir: string
  frontmatter: SkillFrontmatter
  content: string
  hasFrontmatter: boolean
}
