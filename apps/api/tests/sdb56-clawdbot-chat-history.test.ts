// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  routeCompletion: vi.fn(),
}
const channelManagerMock = { register: vi.fn(), on: vi.fn(), list: vi.fn(() => []) }
const toolExecutorMock = { getAllTools: vi.fn(() => []), getStats: vi.fn(() => ({ total: 0 })) }
const taskExecutorMock = {
  on: vi.fn(),
  getStatus: vi.fn(() => ({ totalTasks: 0, runningTasks: 0, completedTasks: 0, failedTasks: 0 })),
}
const evolutionEngineMock = {
  on: vi.fn(),
  getStatus: vi.fn(() => ({ skillsCount: 0, gapsCount: 0, autoEvolve: false })),
}
const messageProcessorMock = {
  process: vi.fn(),
  getStatus: vi.fn(() => ({ activeContexts: 0, queuedMessages: 0 })),
}
const memoryServiceMock = { store: vi.fn() }

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
vi.mock('../src/services/clawdbot/models.js', () => ({ getModelManager: () => ({}) }))
vi.mock('../src/services/clawdbot/system.js', () => ({ getSystemService: () => ({}) }))
vi.mock('../src/services/clawdbot/skills.js', () => ({ getSkillManager: () => ({}) }))
vi.mock('../src/services/clawdbot/canvas.js', () => ({ getCanvasService: () => ({}) }))
vi.mock('../src/services/clawdbot/integrations.js', () => ({ getIntegrationManager: () => ({}) }))
vi.mock('../src/services/clawdbot/mcp.js', () => ({ getMcpClient: () => ({}) }))
vi.mock('../src/services/clawdbot/nodes.js', () => ({ getNodeExecutor: () => ({}) }))
vi.mock('../src/services/clawdbot/pairing.js', () => ({ getPairingService: () => ({}) }))
vi.mock('../src/services/clawdbot/voice.js', () => ({ getVoiceService: () => ({}) }))
vi.mock('../src/services/clawdbot/browser.js', () => ({ getBrowserAutomation: () => ({}) }))

import { ClawdbotService } from '../src/services/clawdbot/clawdbot-service.js'

interface DirectMessageFixture {
  id: string
  channelId: string
  channelType: 'web'
  userId: string
  content: string
  timestamp: number
}

/** messageProcessor.process 会把入参原样放进 original(与生产实现一致),这里照此造夹具 */
function processedOf(message: DirectMessageFixture) {
  return {
    original: message,
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
      id: `${message.userId}:direct`,
      userId: message.userId,
      channelId: 'direct',
      history: [],
      metadata: {},
      createdAt: 0,
    },
    processedAt: 0,
  }
}

function completionOf(content: string) {
  return {
    modelId: 'm1',
    content,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: 'stop',
  }
}

describe('SDB-56 clawdbot 直聊对话历史', () => {
  let svc: ClawdbotService

  beforeEach(() => {
    vi.clearAllMocks()
    messageProcessorMock.process.mockImplementation(async (message: DirectMessageFixture) =>
      processedOf(message),
    )
    svc = new ClawdbotService()
  })

  it('两轮对话后历史含 2 条 user + 2 条 assistant,且 user 轮写在本轮 assistant 之前', async () => {
    gatewayMock.routeCompletion
      .mockResolvedValueOnce(completionOf('reply1'))
      .mockResolvedValueOnce(completionOf('reply2'))

    await svc.chat('u1', 'first')
    await svc.chat('u1', 'second')

    const history = svc.getConversation('u1')
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(history.map((m) => m.content)).toEqual(['first', 'reply1', 'second', 'reply2'])
    expect(history.filter((m) => m.role === 'user')).toHaveLength(2)
    expect(history.filter((m) => m.role === 'assistant')).toHaveLength(2)
  })

  it('第二轮 completion 请求能看到上一轮的用户提问', async () => {
    gatewayMock.routeCompletion
      .mockResolvedValueOnce(completionOf('reply1'))
      .mockResolvedValueOnce(completionOf('reply2'))

    await svc.chat('u1', 'first')
    await svc.chat('u1', 'second')

    const messages = gatewayMock.routeCompletion.mock.calls.at(-1)![0].messages as Array<{
      role: string
      content: string
    }>
    expect(messages).toContainEqual({ role: 'user', content: 'first' })
    expect(messages).toContainEqual({ role: 'assistant', content: 'reply1' })
  })

  it('历史超过 100 条时按 100 条上限裁剪(丢弃最旧的轮次)', async () => {
    let replyIndex = 0
    gatewayMock.routeCompletion.mockImplementation(async () => completionOf(`reply-${replyIndex++}`))

    for (let i = 0; i < 60; i++) {
      await svc.chat('u1', `q${i}`)
    }

    const history = svc.getConversation('u1')
    expect(history).toHaveLength(100)
    // 60 轮 = 120 条,保留最后 50 轮(q10 … q59)
    expect(history[0]).toMatchObject({ role: 'user', content: 'q10' })
    expect(history.at(-1)).toMatchObject({ role: 'assistant', content: 'reply-59' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
