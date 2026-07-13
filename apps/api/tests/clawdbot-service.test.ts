import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const gatewayMock = {
  configure: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: false,
  getStats: vi.fn(() => ({ activeChannels: 0 })),
  on: vi.fn(),
  receiveMessage: vi.fn(),
  routeCompletion: vi.fn(),
}
const channelManagerMock = {
  register: vi.fn(),
  on: vi.fn(),
  get: vi.fn(),
  list: vi.fn(() => []),
  listEnabled: vi.fn(() => []),
}
const toolExecutorMock = {
  register: vi.fn(),
  execute: vi.fn(),
  getAllTools: vi.fn(() => []),
  getStats: vi.fn(() => ({ total: 0 })),
}
const taskExecutorMock = {
  create: vi.fn(),
  execute: vi.fn(),
  on: vi.fn(),
  getStatus: vi.fn(() => ({ totalTasks: 0, runningTasks: 0, completedTasks: 0, failedTasks: 0 })),
}
const evolutionEngineMock = {
  enableAutoEvolution: vi.fn(),
  on: vi.fn(),
  getStatus: vi.fn(() => ({ skillsCount: 0, gapsCount: 0, autoEvolve: false })),
  recordBehavior: vi.fn(),
}
const messageProcessorMock = {
  process: vi.fn(),
  on: vi.fn(),
  getStatus: vi.fn(() => ({ activeContexts: 0, queuedMessages: 0 })),
}
const memoryServiceMock = { store: vi.fn() }
const modelManagerMock = { complete: vi.fn() }
const systemServiceMock = {}
const skillManagerMock = { install: vi.fn(), getStats: vi.fn(() => ({ total: 0 })) }
const canvasServiceMock = {}
const integrationManagerMock = {}
const mcpClientMock = {}
const nodeExecutorMock = {}
const pairingServiceMock = {}
const voiceServiceMock = {}
const browserAutomationMock = {}

vi.mock('../src/services/clawdbot/gateway.js', () => ({ getClawdbotGateway: () => gatewayMock }))
vi.mock('../src/services/clawdbot/channels.js', () => ({
  getChannelManager: () => channelManagerMock,
}))
vi.mock('../src/services/clawdbot/tools.js', () => ({ getToolExecutor: () => toolExecutorMock }))
vi.mock('../src/services/clawdbot/task-executor.js', () => ({
  getTaskExecutor: () => taskExecutorMock,
}))
vi.mock('../src/services/clawdbot/self-evolution.js', () => ({
  getSelfEvolutionEngine: () => evolutionEngineMock,
}))
vi.mock('../src/services/clawdbot/message-processor.js', () => ({
  getMessageProcessor: () => messageProcessorMock,
}))
vi.mock('../src/services/clawdbot/memory.js', () => ({ getMemoryService: () => memoryServiceMock }))
vi.mock('../src/services/clawdbot/models.js', () => ({ getModelManager: () => modelManagerMock }))
vi.mock('../src/services/clawdbot/system.js', () => ({ getSystemService: () => systemServiceMock }))
vi.mock('../src/services/clawdbot/skills.js', () => ({ getSkillManager: () => skillManagerMock }))
vi.mock('../src/services/clawdbot/canvas.js', () => ({ getCanvasService: () => canvasServiceMock }))
vi.mock('../src/services/clawdbot/integrations.js', () => ({
  getIntegrationManager: () => integrationManagerMock,
}))
vi.mock('../src/services/clawdbot/mcp.js', () => ({ getMcpClient: () => mcpClientMock }))
vi.mock('../src/services/clawdbot/nodes.js', () => ({ getNodeExecutor: () => nodeExecutorMock }))
vi.mock('../src/services/clawdbot/pairing.js', () => ({
  getPairingService: () => pairingServiceMock,
}))
vi.mock('../src/services/clawdbot/voice.js', () => ({ getVoiceService: () => voiceServiceMock }))
vi.mock('../src/services/clawdbot/browser.js', () => ({
  getBrowserAutomation: () => browserAutomationMock,
}))

import { ClawdbotService, getClawdbotService } from '../src/services/clawdbot/clawdbot-service.js'

describe('clawdbot ClawdbotService 主服务', () => {
  let svc: ClawdbotService

  beforeEach(() => {
    vi.clearAllMocks()
    gatewayMock.isConnected = false
    svc = new ClawdbotService()
  })

  describe('initialize 初始化', () => {
    it('无 config 时仅 gateway.connect', async () => {
      await svc.initialize()
      expect(gatewayMock.connect).toHaveBeenCalledTimes(1)
      expect(svc.getStatus().initialized).toBe(true)
    })

    it('带 gateway 配置时调用 gateway.configure', async () => {
      await svc.initialize({ gateway: { wsUrl: 'ws://x' } })
      expect(gatewayMock.configure).toHaveBeenCalledWith({ wsUrl: 'ws://x' })
    })

    it('带 channels 配置时逐个注册渠道', async () => {
      const channels = [
        { id: 'c1', type: 'web' as const, name: 'C1', enabled: true, config: {} },
        { id: 'c2', type: 'api' as const, name: 'C2', enabled: true, config: {} },
      ]
      await svc.initialize({ channels })
      expect(channelManagerMock.register).toHaveBeenCalledTimes(2)
    })

    it('autoEvolve=true 时启用自我进化', async () => {
      await svc.initialize({ autoEvolve: true })
      expect(evolutionEngineMock.enableAutoEvolution).toHaveBeenCalledTimes(1)
    })

    it('触发 initialized 事件', async () => {
      const handler = vi.fn()
      svc.on('initialized', handler)
      await svc.initialize()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('shutdown 关闭', () => {
    it('调用 gateway.disconnect 并标记未初始化', async () => {
      await svc.initialize()
      await svc.shutdown()
      expect(gatewayMock.disconnect).toHaveBeenCalledTimes(1)
      expect(svc.getStatus().initialized).toBe(false)
    })

    it('触发 shutdown 事件', async () => {
      const handler = vi.fn()
      svc.on('shutdown', handler)
      await svc.shutdown()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleChannelMessage 处理渠道消息', () => {
    it('调用 messageProcessor.process', async () => {
      messageProcessorMock.process.mockResolvedValueOnce({
        original: {
          id: 'm1',
          channelId: 'c1',
          channelType: 'web',
          userId: 'u1',
          content: 'hi',
          timestamp: 0,
        },
        intent: {
          primary: 'chat',
          confidence: 0.5,
          sentiment: 'neutral',
          requiresTool: false,
          requiresHuman: false,
          language: 'zh',
        },
        entities: [],
        context: {
          id: 'u1:c1',
          userId: 'u1',
          channelId: 'c1',
          history: [],
          metadata: {},
          createdAt: 0,
        },
        processedAt: 0,
      })
      const r = await svc.handleChannelMessage({
        id: 'm1',
        channelId: 'c1',
        channelType: 'web',
        userId: 'u1',
        content: 'hi',
        timestamp: 0,
      })
      expect(messageProcessorMock.process).toHaveBeenCalledTimes(1)
      expect(evolutionEngineMock.recordBehavior).toHaveBeenCalledWith(
        'chat',
        true,
        expect.anything(),
      )
      expect(memoryServiceMock.store).toHaveBeenCalledTimes(1)
      expect(r.intent.primary).toBe('chat')
    })

    it('触发 message:processed 事件', async () => {
      const handler = vi.fn()
      svc.on('message:processed', handler)
      messageProcessorMock.process.mockResolvedValueOnce({
        original: {
          id: 'm1',
          channelId: 'c1',
          channelType: 'web',
          userId: 'u1',
          content: 'hi',
          timestamp: 0,
        },
        intent: {
          primary: 'chat',
          confidence: 0.5,
          sentiment: 'neutral',
          requiresTool: false,
          requiresHuman: false,
          language: 'zh',
        },
        entities: [],
        context: {
          id: 'u1:c1',
          userId: 'u1',
          channelId: 'c1',
          history: [],
          metadata: {},
          createdAt: 0,
        },
        processedAt: 0,
      })
      await svc.handleChannelMessage({
        id: 'm1',
        channelId: 'c1',
        channelType: 'web',
        userId: 'u1',
        content: 'hi',
        timestamp: 0,
      })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('conversation history 超过 100 条时 shift 最旧', async () => {
      for (let i = 0; i < 105; i++) {
        messageProcessorMock.process.mockResolvedValueOnce({
          original: {
            id: `m${i}`,
            channelId: 'c1',
            channelType: 'web',
            userId: 'u1',
            content: 'hi',
            timestamp: i,
          },
          intent: {
            primary: 'chat',
            confidence: 0.5,
            sentiment: 'neutral',
            requiresTool: false,
            requiresHuman: false,
            language: 'zh',
          },
          entities: [],
          context: {
            id: 'u1:c1',
            userId: 'u1',
            channelId: 'c1',
            history: [],
            metadata: {},
            createdAt: 0,
          },
          processedAt: 0,
        })
        await svc.handleChannelMessage({
          id: `m${i}`,
          channelId: 'c1',
          channelType: 'web',
          userId: 'u1',
          content: 'hi',
          timestamp: i,
        })
      }
      const conv = svc.getConversation('u1')
      expect(conv).toHaveLength(100)
    })
  })

  describe('chat 聊天', () => {
    it('返回 assistant 响应并加入 conversation', async () => {
      messageProcessorMock.process.mockResolvedValueOnce({
        original: {
          id: 'm1',
          channelId: 'direct',
          channelType: 'web',
          userId: 'u1',
          content: 'hi',
          timestamp: 0,
        },
        intent: {
          primary: 'chat',
          confidence: 0.5,
          sentiment: 'neutral',
          requiresTool: false,
          requiresHuman: false,
          language: 'zh',
        },
        entities: [],
        context: {
          id: 'u1:direct',
          userId: 'u1',
          channelId: 'direct',
          history: [],
          metadata: {},
          createdAt: 0,
        },
        processedAt: 0,
      })
      gatewayMock.routeCompletion.mockResolvedValueOnce({
        modelId: 'm1',
        content: 'hello back',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })
      const r = await svc.chat('u1', 'hi')
      expect(r.role).toBe('assistant')
      expect(r.content).toBe('hello back')
      expect(svc.getConversation('u1')).toHaveLength(1)
    })

    it('触发 chat:response 事件', async () => {
      const handler = vi.fn()
      svc.on('chat:response', handler)
      messageProcessorMock.process.mockResolvedValueOnce({
        original: {
          id: 'm1',
          channelId: 'direct',
          channelType: 'web',
          userId: 'u1',
          content: 'hi',
          timestamp: 0,
        },
        intent: {
          primary: 'chat',
          confidence: 0.5,
          sentiment: 'neutral',
          requiresTool: false,
          requiresHuman: false,
          language: 'zh',
        },
        entities: [],
        context: {
          id: 'u1:direct',
          userId: 'u1',
          channelId: 'direct',
          history: [],
          metadata: {},
          createdAt: 0,
        },
        processedAt: 0,
      })
      gatewayMock.routeCompletion.mockResolvedValueOnce({
        modelId: 'm1',
        content: 'x',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })
      await svc.chat('u1', 'hi')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('chat assistant 响应会注入到下次 completion 请求', async () => {
      messageProcessorMock.process.mockResolvedValue({
        original: {
          id: 'm1',
          channelId: 'direct',
          channelType: 'web',
          userId: 'u1',
          content: 'hi',
          timestamp: 0,
        },
        intent: {
          primary: 'chat',
          confidence: 0.5,
          sentiment: 'neutral',
          requiresTool: false,
          requiresHuman: false,
          language: 'zh',
        },
        entities: [],
        context: {
          id: 'u1:direct',
          userId: 'u1',
          channelId: 'direct',
          history: [],
          metadata: {},
          createdAt: 0,
        },
        processedAt: 0,
      })
      gatewayMock.routeCompletion
        .mockResolvedValueOnce({
          modelId: 'm1',
          content: 'reply1',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          modelId: 'm1',
          content: 'reply2',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
        })
      await svc.chat('u1', 'first')
      await svc.chat('u1', 'second')
      const lastCall = gatewayMock.routeCompletion.mock.calls.at(-1)![0]
      const messages = lastCall.messages as Array<{ role: string; content: string }>
      // chat 方法仅 push assistant response 到 conversations
      expect(messages.some((m) => m.role === 'assistant' && m.content === 'reply1')).toBe(true)
    })
  })

  describe('executeTask 执行任务', () => {
    it('调用 taskExecutor.create + execute', async () => {
      taskExecutorMock.create.mockReturnValueOnce({ id: 't1' })
      taskExecutorMock.execute.mockResolvedValueOnce({
        success: true,
        outputs: {},
        stepResults: [],
      })
      const r = await svc.executeTask('T1', 'desc', [
        { id: 's1', name: 'S1', type: 'tool', toolName: 'tool1' },
      ])
      expect(taskExecutorMock.create).toHaveBeenCalledTimes(1)
      expect(taskExecutorMock.execute).toHaveBeenCalledWith('t1')
      expect(r.success).toBe(true)
    })
  })

  describe('getConversation', () => {
    it('不存在用户返回空数组', () => {
      expect(svc.getConversation('not_exist')).toEqual([])
    })
  })

  describe('getStatus', () => {
    it('返回完整状态对象', () => {
      const s = svc.getStatus()
      expect(s).toHaveProperty('initialized')
      expect(s).toHaveProperty('gateway')
      expect(s).toHaveProperty('tools')
      expect(s).toHaveProperty('tasks')
      expect(s).toHaveProperty('evolution')
      expect(s).toHaveProperty('messages')
    })
  })

  describe('子服务访问器', () => {
    it('getGateway 返回 gateway 实例', () => {
      expect(svc.getGateway()).toBe(gatewayMock)
    })
    it('getChannelManager 返回 channelManager 实例', () => {
      expect(svc.getChannelManager()).toBe(channelManagerMock)
    })
    it('getToolExecutor 返回 toolExecutor 实例', () => {
      expect(svc.getToolExecutor()).toBe(toolExecutorMock)
    })
    it('getTaskExecutor 返回 taskExecutor 实例', () => {
      expect(svc.getTaskExecutor()).toBe(taskExecutorMock)
    })
    it('getEvolutionEngine 返回 evolutionEngine 实例', () => {
      expect(svc.getEvolutionEngine()).toBe(evolutionEngineMock)
    })
    it('getMessageProcessor 返回 messageProcessor 实例', () => {
      expect(svc.getMessageProcessor()).toBe(messageProcessorMock)
    })
    it('getMemoryService 返回 memoryService 实例', () => {
      expect(svc.getMemoryService()).toBe(memoryServiceMock)
    })
    it('getModelManager 返回 modelManager 实例', () => {
      expect(svc.getModelManager()).toBe(modelManagerMock)
    })
    it('getSystemService 返回 systemService 实例', () => {
      expect(svc.getSystemService()).toBe(systemServiceMock)
    })
    it('getSkillManager 返回 skillManager 实例', () => {
      expect(svc.getSkillManager()).toBe(skillManagerMock)
    })
    it('getCanvasService 返回 canvasService 实例', () => {
      expect(svc.getCanvasService()).toBe(canvasServiceMock)
    })
    it('getIntegrationManager 返回 integrationManager 实例', () => {
      expect(svc.getIntegrationManager()).toBe(integrationManagerMock)
    })
    it('getMcpClient 返回 mcpClient 实例', () => {
      expect(svc.getMcpClient()).toBe(mcpClientMock)
    })
    it('getNodeExecutor 返回 nodeExecutor 实例', () => {
      expect(svc.getNodeExecutor()).toBe(nodeExecutorMock)
    })
    it('getPairingService 返回 pairingService 实例', () => {
      expect(svc.getPairingService()).toBe(pairingServiceMock)
    })
    it('getVoiceService 返回 voiceService 实例', () => {
      expect(svc.getVoiceService()).toBe(voiceServiceMock)
    })
    it('getBrowserAutomation 返回 browserAutomation 实例', () => {
      expect(svc.getBrowserAutomation()).toBe(browserAutomationMock)
    })
  })

  describe('单例', () => {
    it('getClawdbotService 返回同一实例', () => {
      expect(getClawdbotService()).toBe(getClawdbotService())
    })
  })
})
