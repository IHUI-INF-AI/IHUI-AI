import { describe, expect, it } from 'vitest'
import {
  isWorkspaceRequest,
  isToolChunk,
  isWorkspaceEvent,
  type WorkspaceRequest,
  type WorkspaceEvent,
  type ToolChunk,
  type ConversationItem,
  type PermissionRequest,
  type PermissionDecision,
  type BeginPromptData,
  type EndPromptData,
  type CreateSessionData,
  type SessionCreatedData,
  type UserMessage,
  type AssistantMessage,
  type ToolCallMessage,
  type ToolResultMessage,
  type SystemMessage,
  type PermissionRequestData,
  type PermissionAllowData,
  type PermissionDenyData,
  type PromptMode,
} from '../src/workspace.js'

describe('Workspace wire 类型 - adjacent tagging({ type, data })', () => {
  describe('类型守卫:isWorkspaceRequest', () => {
    it('合法 WorkspaceRequest 通过', () => {
      const req: WorkspaceRequest = {
        type: 'begin_prompt',
        data: { sessionId: 's1', prompt: 'hi' },
      }
      expect(isWorkspaceRequest(req)).toBe(true)
    })

    it('合法 create_session 通过', () => {
      const req: WorkspaceRequest = {
        type: 'create_session',
        data: { workspaceRoot: '/tmp' },
      }
      expect(isWorkspaceRequest(req)).toBe(true)
    })

    it('null 不通过', () => {
      expect(isWorkspaceRequest(null)).toBe(false)
    })

    it('非对象不通过', () => {
      expect(isWorkspaceRequest('string')).toBe(false)
      expect(isWorkspaceRequest(42)).toBe(false)
      expect(isWorkspaceRequest(undefined)).toBe(false)
    })

    it('缺少 type/data 字段不通过', () => {
      expect(isWorkspaceRequest({})).toBe(false)
      expect(isWorkspaceRequest({ type: 'begin_prompt' })).toBe(false)
      expect(isWorkspaceRequest({ data: {} })).toBe(false)
    })
  })

  describe('类型守卫:isToolChunk', () => {
    it('tool_call_start 通过', () => {
      const chunk: ToolChunk = {
        type: 'tool_call_start',
        data: { toolCallId: 'tc1', toolName: 'read_file', args: { path: '/a' } },
      }
      expect(isToolChunk(chunk)).toBe(true)
    })

    it('tool_call_delta 通过', () => {
      const chunk: ToolChunk = {
        type: 'tool_call_delta',
        data: { toolCallId: 'tc1', delta: 'partial' },
      }
      expect(isToolChunk(chunk)).toBe(true)
    })

    it('tool_call_end 通过', () => {
      const chunk: ToolChunk = {
        type: 'tool_call_end',
        data: { toolCallId: 'tc1', output: 'done', success: true },
      }
      expect(isToolChunk(chunk)).toBe(true)
    })

    it('tool_call_error 通过', () => {
      const chunk: ToolChunk = {
        type: 'tool_call_error',
        data: { toolCallId: 'tc1', error: 'boom' },
      }
      expect(isToolChunk(chunk)).toBe(true)
    })

    it('非 tool_call_ 前缀不通过', () => {
      expect(isToolChunk({ type: 'begin_prompt', data: {} })).toBe(false)
      expect(isToolChunk({ type: 'session_created', data: {} })).toBe(false)
    })

    it('null / 非对象不通过', () => {
      expect(isToolChunk(null)).toBe(false)
      expect(isToolChunk({})).toBe(false)
      expect(isToolChunk({ type: 123, data: {} })).toBe(false)
    })
  })

  describe('类型守卫:isWorkspaceEvent', () => {
    it('session_created 事件通过', () => {
      const ev: WorkspaceEvent = {
        type: 'session_created',
        data: { sessionId: 's1', workspaceRoot: '/tmp', createdAt: 1 },
      }
      expect(isWorkspaceEvent(ev)).toBe(true)
    })

    it('error 事件通过', () => {
      const ev: WorkspaceEvent = {
        type: 'error',
        data: { code: 'E_INTERNAL', message: 'oops' },
      }
      expect(isWorkspaceEvent(ev)).toBe(true)
    })

    it('null / 非对象不通过', () => {
      expect(isWorkspaceEvent(null)).toBe(false)
      expect(isWorkspaceEvent({ type: 'x' })).toBe(false)
    })
  })

  describe('adjacent tagging 序列化/反序列化', () => {
    it('WorkspaceRequest JSON 往返通过类型守卫', () => {
      const req: WorkspaceRequest = {
        type: 'begin_prompt',
        data: {
          sessionId: 'sess-abc',
          prompt: 'hello world',
          attachments: [{ kind: 'file', path: '/tmp/a.ts' }],
          mode: 'plan',
        },
      }
      const json = JSON.stringify(req)
      const parsed = JSON.parse(json)
      expect(isWorkspaceRequest(parsed)).toBe(true)
      expect(parsed.type).toBe('begin_prompt')
      expect(parsed.data.sessionId).toBe('sess-abc')
      expect(parsed.data.mode).toBe('plan')
    })

    it('ToolChunk JSON 往返通过 isToolChunk', () => {
      const chunk: ToolChunk = {
        type: 'tool_call_end',
        data: { toolCallId: 'tc-1', output: 'result', success: true },
      }
      const parsed = JSON.parse(JSON.stringify(chunk))
      expect(isToolChunk(parsed)).toBe(true)
      expect(parsed.data.success).toBe(true)
    })

    it('WorkspaceEvent JSON 往返通过 isWorkspaceEvent', () => {
      const ev: WorkspaceEvent = {
        type: 'prompt_completed',
        data: {
          sessionId: 's1',
          promptId: 'p1',
          completedAt: 1234567890,
          usage: { inputTokens: 10, outputTokens: 20 },
        },
      }
      const parsed = JSON.parse(JSON.stringify(ev))
      expect(isWorkspaceEvent(parsed)).toBe(true)
      expect(parsed.data.usage.inputTokens).toBe(10)
    })

    it('嵌套 tool_call 事件(JSON 往返)', () => {
      const ev: WorkspaceEvent = {
        type: 'tool_call',
        data: {
          type: 'tool_call_start',
          data: { toolCallId: 'tc-x', toolName: 'shell', args: { cmd: 'ls' } },
        },
      }
      const parsed = JSON.parse(JSON.stringify(ev))
      expect(isWorkspaceEvent(parsed)).toBe(true)
      expect(isToolChunk(parsed.data)).toBe(true)
    })
  })

  describe('5 种 ConversationItem 类型构造', () => {
    it('user 消息', () => {
      const item: ConversationItem = {
        type: 'user',
        data: {
          content: '问个问题',
          attachments: [{ kind: 'text', content: '附件' }],
          timestamp: Date.now(),
        },
      }
      expect(item.type).toBe('user')
      expect(item.data.content).toBe('问个问题')
    })

    it('assistant 消息', () => {
      const item: ConversationItem = {
        type: 'assistant',
        data: {
          content: '回答',
          modelId: 'gpt-4',
          timestamp: Date.now(),
          usage: { inputTokens: 5, outputTokens: 8, cacheReadTokens: 2 },
        },
      }
      expect(item.type).toBe('assistant')
      expect(item.data.modelId).toBe('gpt-4')
      expect(item.data.usage?.cacheReadTokens).toBe(2)
    })

    it('tool_call 消息', () => {
      const item: ConversationItem = {
        type: 'tool_call',
        data: {
          toolCallId: 'tc-1',
          toolName: 'read_file',
          args: { path: '/a.ts' },
          timestamp: Date.now(),
        },
      }
      expect(item.type).toBe('tool_call')
      expect(item.data.toolName).toBe('read_file')
    })

    it('tool_result 消息', () => {
      const item: ConversationItem = {
        type: 'tool_result',
        data: {
          toolCallId: 'tc-1',
          output: 'file content',
          success: true,
          timestamp: Date.now(),
        },
      }
      expect(item.type).toBe('tool_result')
      expect(item.data.success).toBe(true)
    })

    it('system 消息', () => {
      const item: ConversationItem = {
        type: 'system',
        data: { content: '系统提示', timestamp: Date.now() },
      }
      expect(item.type).toBe('system')
      expect(item.data.content).toBe('系统提示')
    })

    it('5 种类型可组成对话数组并序列化', () => {
      const now = Date.now()
      const items: ConversationItem[] = [
        { type: 'system', data: { content: 'init', timestamp: now } },
        { type: 'user', data: { content: 'q', timestamp: now + 1 } },
        { type: 'assistant', data: { content: 'a', modelId: 'm', timestamp: now + 2 } },
        {
          type: 'tool_call',
          data: { toolCallId: 'tc1', toolName: 't', args: {}, timestamp: now + 3 },
        },
        {
          type: 'tool_result',
          data: { toolCallId: 'tc1', output: 'r', success: true, timestamp: now + 4 },
        },
      ]
      const json = JSON.stringify(items)
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(5)
      expect(parsed.map((i: { type: string }) => i.type)).toEqual([
        'system',
        'user',
        'assistant',
        'tool_call',
        'tool_result',
      ])
    })
  })

  describe('PermissionRequest / PermissionDecision 类型构造', () => {
    it('PermissionRequest 构造与序列化', () => {
      const req: PermissionRequest = {
        type: 'permission_request',
        data: {
          toolCallId: 'tc-1',
          toolName: 'write_file',
          args: { path: '/etc/passwd' },
          reason: '写入敏感路径',
          mode: 'default',
        },
      }
      expect(req.type).toBe('permission_request')
      expect(req.data.mode).toBe('default')
      const parsed = JSON.parse(JSON.stringify(req))
      expect(isWorkspaceRequest(parsed)).toBe(true)
    })

    it('PermissionDecision allow 构造', () => {
      const decision: PermissionDecision = {
        type: 'allow',
        data: { toolCallId: 'tc-1', always: true },
      }
      expect(decision.type).toBe('allow')
      expect(decision.data.always).toBe(true)
    })

    it('PermissionDecision deny 构造', () => {
      const decision: PermissionDecision = {
        type: 'deny',
        data: { toolCallId: 'tc-1', reason: '用户拒绝' },
      }
      expect(decision.type).toBe('deny')
      expect(decision.data.reason).toBe('用户拒绝')
    })

    it('PermissionDecision JSON 往返', () => {
      const decision: PermissionDecision = {
        type: 'deny',
        data: { toolCallId: 'tc-2', reason: 'no' },
      }
      const parsed = JSON.parse(JSON.stringify(decision))
      expect(parsed.type).toBe('deny')
      expect(parsed.data.toolCallId).toBe('tc-2')
    })

    it('所有 PromptMode 值均可赋值', () => {
      const modes: PromptMode[] = ['default', 'plan', 'accept-edits', 'bypass-permissions']
      expect(modes).toHaveLength(4)
      for (const m of modes) {
        const req: PermissionRequest = {
          type: 'permission_request',
          data: {
            toolCallId: 'tc',
            toolName: 't',
            args: {},
            reason: 'r',
            mode: m,
          },
        }
        expect(req.data.mode).toBe(m)
      }
    })
  })

  describe('Wire 类型数据契约(接入证据)', () => {
    it('BeginPromptData 契约', () => {
      const data: BeginPromptData = {
        sessionId: 's1',
        prompt: '帮我写代码',
        attachments: [{ kind: 'image', path: '/a.png', mimeType: 'image/png' }],
        mode: 'accept-edits',
      }
      expect(data.sessionId).toBe('s1')
      expect(data.attachments?.[0]?.mimeType).toBe('image/png')
    })

    it('EndPromptData 契约', () => {
      const data: EndPromptData = { sessionId: 's1' }
      expect(data.sessionId).toBe('s1')
    })

    it('CreateSessionData 契约', () => {
      const data: CreateSessionData = {
        workspaceRoot: '/repo',
        initialPrompt: '开始',
        modelId: 'claude-3',
        mode: 'plan',
      }
      expect(data.workspaceRoot).toBe('/repo')
    })

    it('SessionCreatedData 契约', () => {
      const data: SessionCreatedData = {
        sessionId: 's1',
        workspaceRoot: '/repo',
        createdAt: 1700000000000,
      }
      expect(data.createdAt).toBe(1700000000000)
    })

    it('各 Message 类型字段契约', () => {
      const user: UserMessage = { content: 'u', timestamp: 1 }
      const assistant: AssistantMessage = {
        content: 'a',
        modelId: 'm',
        timestamp: 2,
      }
      const toolCall: ToolCallMessage = {
        toolCallId: 'tc',
        toolName: 't',
        args: {},
        timestamp: 3,
      }
      const toolResult: ToolResultMessage = {
        toolCallId: 'tc',
        output: 'o',
        success: true,
        timestamp: 4,
      }
      const system: SystemMessage = { content: 's', timestamp: 5 }
      expect(user.content).toBe('u')
      expect(assistant.modelId).toBe('m')
      expect(toolCall.toolName).toBe('t')
      expect(toolResult.success).toBe(true)
      expect(system.content).toBe('s')
    })

    it('PermissionRequestData / Allow / Deny 字段契约', () => {
      const reqData: PermissionRequestData = {
        toolCallId: 'tc',
        toolName: 'shell',
        args: { cmd: 'rm' },
        reason: '危险',
        mode: 'default',
      }
      const allow: PermissionAllowData = { toolCallId: 'tc', always: true }
      const deny: PermissionDenyData = { toolCallId: 'tc', reason: 'no' }
      expect(reqData.toolName).toBe('shell')
      expect(allow.always).toBe(true)
      expect(deny.reason).toBe('no')
    })
  })
})
