import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  useMCP,
  loadMCPServers,
  getServerCapabilities,
  invokeMCPTool,
  invokeMCPToolsBatch,
  useMCPTool,
  findAvailableTool,
  findAllToolsByName,
} from '../useMCP'

// Mock element-plus
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock 日志工具
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock MCP API
vi.mock('@/api/tools/mcp', () => ({
  getMCPServersList: vi.fn(),
  getMCPServerCapabilities: vi.fn(),
  callMCPTool: vi.fn(),
}))

// Mock i18n
vi.mock('@/locales', () => ({
  default: {
    global: {
      t: (key: string, params?: Record<string, unknown>) => {
        // 简单实现：返回 key + 参数
        if (params) {
          return `${key}:${JSON.stringify(params)}`
        }
        return key
      },
    },
  },
}))

describe('useMCP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useMCP composable 结构', () => {
    it('应该返回所有状态、计算属性和方法', () => {
      const mcp = useMCP()
      // 状态
      expect(mcp.availableServers).toBeDefined()
      expect(mcp.serversLoading).toBeDefined()
      expect(mcp.callHistory).toBeDefined()
      expect(mcp.serverCapabilitiesCache).toBeDefined()
      // 计算属性
      expect(mcp.activeServers).toBeDefined()
      expect(mcp.allTools).toBeDefined()
      expect(mcp.allResources).toBeDefined()
      expect(mcp.allPrompts).toBeDefined()
      // 方法
      expect(typeof mcp.loadMCPServers).toBe('function')
      expect(typeof mcp.getServerCapabilities).toBe('function')
      expect(typeof mcp.invokeMCPTool).toBe('function')
      expect(typeof mcp.invokeMCPToolsBatch).toBe('function')
      expect(typeof mcp.useMCPTool).toBe('function')
      expect(typeof mcp.findAvailableTool).toBe('function')
      expect(typeof mcp.findAllToolsByName).toBe('function')
    })
  })

  describe('loadMCPServers - 加载服务器列表', () => {
    it('应该成功加载活跃的服务器列表', async () => {
      const { getMCPServersList } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          list: [
            { id: 'a1', name: 'Active1', status: 'active' },
            { id: 'i1', name: 'Inactive1', status: 'inactive' },
            { id: 'a2', name: 'Active2', status: 'active' },
          ],
        },
      })
      await loadMCPServers()
      const mcp = useMCP()
      expect(mcp.serversLoading.value).toBe(false)
      expect(mcp.availableServers.value.length).toBe(2)
    })

    it('应该处理非200响应', async () => {
      const { getMCPServersList } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 500,
        success: false,
        data: {},
      })
      await loadMCPServers()
      // 非200响应时不应该填充availableServers
    })

    it('应该处理未登录错误（不记录错误日志）', async () => {
      const { logger } = await import('@/utils/logger')
      const { getMCPServersList } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('未登录'))
      await loadMCPServers()
      expect(logger.debug).toHaveBeenCalled()
      expect(logger.error).not.toHaveBeenCalled()
    })

    it('应该处理"请先登录"错误', async () => {
      const { logger } = await import('@/utils/logger')
      const { getMCPServersList } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('请先登录'))
      await loadMCPServers()
      expect(logger.debug).toHaveBeenCalled()
    })

    it('应该处理"not logged in"英文错误', async () => {
      const { logger } = await import('@/utils/logger')
      const { getMCPServersList } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not logged in'))
      await loadMCPServers()
      expect(logger.debug).toHaveBeenCalled()
    })

    it('应该处理带response对象的错误（记录错误日志）', async () => {
      const { logger } = await import('@/utils/logger')
      const { getMCPServersList } = await import('@/api/tools/mcp')
      const error = new Error('Server error') as Error & { response?: { status?: number } }
      error.response = { status: 500 }
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockRejectedValue(error)
      await loadMCPServers()
      expect(logger.error).toHaveBeenCalled()
    })

    it('应该处理普通错误（非未登录）', async () => {
      const { logger } = await import('@/utils/logger')
      const { getMCPServersList } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network down'))
      await loadMCPServers()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('getServerCapabilities - 获取服务器能力', () => {
    it('应该调用API并返回能力', async () => {
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          tools: [{ name: 't1' }],
          resources: [],
          prompts: [],
        },
      })
      const caps = await getServerCapabilities('serverA')
      expect(caps.tools.length).toBe(1)
    })

    it('应该使用缓存（第二次调用直接返回）', async () => {
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          tools: [{ name: 'cachedTool' }],
          resources: [],
          prompts: [],
        },
      })
      const first = await getServerCapabilities('cachedServer')
      const second = await getServerCapabilities('cachedServer')
      // 第二次应该走缓存，API只调用1次
      expect(getMCPServerCapabilities).toHaveBeenCalledTimes(1)
      expect(second).toEqual(first)
    })

    it('应该返回空数组当API失败', async () => {
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'))
      const caps = await getServerCapabilities('failedServer')
      expect(caps.tools).toEqual([])
      expect(caps.resources).toEqual([])
      expect(caps.prompts).toEqual([])
    })

    it('应该返回空数组当响应不是成功', async () => {
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: false,
        data: null,
      })
      const caps = await getServerCapabilities('invalidServer')
      expect(caps.tools).toEqual([])
    })
  })

  describe('invokeMCPTool - 调用MCP工具', () => {
    it('应该成功调用工具', async () => {
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: { result: 'ok' },
      })
      const result = await invokeMCPTool('server1', 'testTool', { arg: 'val' }, { silent: true })
      expect(result.success).toBe(true)
      expect(result.serverId).toBe('server1')
      expect(result.toolName).toBe('testTool')
    })

    it('应该支持静默模式（不显示info和success消息）', async () => {
      const { ElMessage } = await import('element-plus')
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      await invokeMCPTool('server1', 'testTool', {}, { silent: true })
      expect(ElMessage.info).not.toHaveBeenCalled()
      expect(ElMessage.success).not.toHaveBeenCalled()
    })

    it('应该通过服务器名称找到服务器ID', async () => {
      const { callMCPTool } = await import('@/api/tools/mcp')
      const { getMCPServersList } = await import('@/api/tools/mcp')
      // 先加载服务器
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          list: [
            { id: 'real-id-123', name: 'MyNamedServer', status: 'active' },
          ],
        },
      })
      await loadMCPServers()
      // 通过名称调用
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      const result = await invokeMCPTool('MyNamedServer', 't1', {}, { silent: true })
      expect(result.serverId).toBe('real-id-123')
    })

    it('应该通过hex格式的ID直接使用', async () => {
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      const hexId = '507f1f77bcf86cd799439011'
      const result = await invokeMCPTool(hexId, 't1', {}, { silent: true })
      expect(result.serverId).toBe(hexId)
    })

    it('应该处理工具调用失败（显示错误）', async () => {
      const { ElMessage } = await import('element-plus')
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 500,
        success: false,
        message: 'Tool error',
      })
      const result = await invokeMCPTool('server1', 'testTool', {}, { silent: true, showError: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Tool error')
      expect(ElMessage.error).toHaveBeenCalled()
    })

    it('应该处理异常（showError=true）', async () => {
      const { ElMessage } = await import('element-plus')
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network boom'))
      const result = await invokeMCPTool('server1', 'testTool', {}, { silent: true, showError: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Network boom')
      expect(ElMessage.error).toHaveBeenCalled()
    })

    it('应该处理非Error异常（String(error)）', async () => {
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockRejectedValue('string-error')
      const result = await invokeMCPTool('server1', 'testTool', {}, { silent: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('string-error')
    })

    it('应该限制历史记录最多100条', async () => {
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      // 调用105次
      for (let i = 0; i < 105; i++) {
        await invokeMCPTool('server1', 'testTool', {}, { silent: true })
      }
      const mcp = useMCP()
      expect(mcp.callHistory.value.length).toBe(100)
    })

    it('应该显示调用info消息（非静默时）', async () => {
      const { ElMessage } = await import('element-plus')
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      await invokeMCPTool('server1', 'testTool', {}, { silent: false, showError: false })
      expect(ElMessage.info).toHaveBeenCalled()
      expect(ElMessage.success).toHaveBeenCalled()
    })

    it('应该显示成功消息', async () => {
      const { ElMessage } = await import('element-plus')
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      await invokeMCPTool('server1', 'testTool', {}, { silent: false })
      expect(ElMessage.success).toHaveBeenCalled()
    })
  })

  describe('invokeMCPToolsBatch - 批量调用工具', () => {
    it('应该批量调用工具并返回结果', async () => {
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      const results = await invokeMCPToolsBatch([
        { serverIdOrName: 's1', toolName: 't1' },
        { serverIdOrName: 's2', toolName: 't2' },
        { serverIdOrName: 's3', toolName: 't3' },
      ])
      expect(results.length).toBe(3)
    })

    it('应该统计成功数量', async () => {
      const { ElMessage } = await import('element-plus')
      const { callMCPTool } = await import('@/api/tools/mcp')
      let count = 0
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockImplementation(() => {
        count++
        // 第一次成功，第二次失败
        if (count === 1) {
          return Promise.resolve({ code: 200, success: true, data: {} })
        }
        return Promise.resolve({ code: 500, success: false, message: 'fail' })
      })
      await invokeMCPToolsBatch([
        { serverIdOrName: 's1', toolName: 't1' },
        { serverIdOrName: 's2', toolName: 't2' },
      ])
      expect(ElMessage.info).toHaveBeenCalled()
    })
  })

  describe('findAvailableTool - 查找可用工具', () => {
    it('应该返回null当没有指定服务器且无匹配时', () => {
      const result = findAvailableTool('noSuchToolAnywhere')
      expect(result).toBeNull()
    })

    it('应该按serverId过滤查找', async () => {
      const { getMCPServersList } = await import('@/api/tools/mcp')
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          list: [
            { id: 'srv-A', name: 'ServerA', status: 'active' },
            { id: 'srv-B', name: 'ServerB', status: 'active' },
          ],
        },
      })
      await loadMCPServers()
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          tools: [{ name: 'uniqueTool' }],
          resources: [],
          prompts: [],
        },
      })
      await getServerCapabilities('srv-A')
      const result = findAvailableTool('uniqueTool', 'srv-A')
      expect(result).not.toBeNull()
      expect(result?.server.id).toBe('srv-A')
      expect(result?.tool.name).toBe('uniqueTool')
    })

    it('应该返回null当指定服务器不匹配时', async () => {
      const result = findAvailableTool('unknownTool', 'nonexistentServer')
      expect(result).toBeNull()
    })
  })

  describe('findAllToolsByName - 查找所有同名工具', () => {
    it('应该返回空数组当没有服务器时', async () => {
      const mcp = useMCP()
      mcp.availableServers.value = []
      const results = await findAllToolsByName('anyTool')
      expect(results).toEqual([])
    })

    it('应该返回匹配的工具列表', async () => {
      const { getMCPServersList } = await import('@/api/tools/mcp')
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          list: [
            { id: 'sX', name: 'SrvX', status: 'active' },
            { id: 'sY', name: 'SrvY', status: 'active' },
          ],
        },
      })
      await loadMCPServers()
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
        if (id === 'sX') {
          return Promise.resolve({
            code: 200,
            success: true,
            data: { tools: [{ name: 'sharedTool' }], resources: [], prompts: [] },
          })
        }
        return Promise.resolve({
          code: 200,
          success: true,
          data: { tools: [{ name: 'otherTool' }], resources: [], prompts: [] },
        })
      })
      const results = await findAllToolsByName('sharedTool')
      expect(results.length).toBe(1)
      expect(results[0].server.id).toBe('sX')
    })
  })

  describe('useMCPTool - 智能调用工具', () => {
    it('应该使用首选服务器调用工具', async () => {
      const { getMCPServersList } = await import('@/api/tools/mcp')
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          list: [
            { id: 'prefSrv', name: 'PrefServer', status: 'active' },
          ],
        },
      })
      await loadMCPServers()
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: { tools: [{ name: 'prefTool' }], resources: [], prompts: [] },
      })
      // 先加载能力到缓存
      await getServerCapabilities('prefSrv')
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: { out: 'yes' },
      })
      const result = await useMCPTool('prefTool', { x: 1 }, 'prefSrv')
      expect(result).not.toBeNull()
      expect(result?.success).toBe(true)
    })

    it('应该返回null并提示警告当工具未找到', async () => {
      const { ElMessage } = await import('element-plus')
      const { getMCPServersList } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: { list: [{ id: 'emptySrv', name: 'EmptySrv', status: 'active' }] },
      })
      await loadMCPServers()
      const result = await useMCPTool('nonexistentToolX')
      expect(result).toBeNull()
      expect(ElMessage.warning).toHaveBeenCalled()
    })

    it('应该在所有服务器中查找工具（无首选）', async () => {
      const { getMCPServersList } = await import('@/api/tools/mcp')
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      const { callMCPTool } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          list: [{ id: 'fallSrv', name: 'FallSrv', status: 'active' }],
        },
      })
      await loadMCPServers()
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: { tools: [{ name: 'fallbackTool' }], resources: [], prompts: [] },
      })
      ;(callMCPTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: {},
      })
      const result = await useMCPTool('fallbackTool')
      expect(result).not.toBeNull()
      expect(result?.success).toBe(true)
    })
  })

  describe('useMCP - 计算属性', () => {
    it('activeServers应该只返回active状态的服务器', () => {
      const mcp = useMCP()
      mcp.availableServers.value = [
        { id: 'a1', name: 'A1', status: 'active' },
        { id: 'i1', name: 'I1', status: 'inactive' },
        { id: 'a2', name: 'A2', status: 'active' },
      ] as any
      expect(mcp.activeServers.value.length).toBe(2)
    })

    it('allTools应该返回所有服务器的能力工具（使用server.capabilities）', () => {
      const mcp = useMCP()
      mcp.availableServers.value = [
        {
          id: 's1',
          name: 'S1',
          status: 'active',
          capabilities: {
            tools: [{ name: 'capTool1' }, { name: 'capTool2' }],
            resources: [],
            prompts: [],
          },
        },
        {
          id: 's2',
          name: 'S2',
          status: 'active',
          capabilities: { tools: [{ name: 'capTool3' }], resources: [], prompts: [] },
        },
      ] as any
      expect(mcp.allTools.value.length).toBe(3)
    })

    it('allTools应该使用缓存（serverCapabilitiesCache）', async () => {
      const { getMCPServersList } = await import('@/api/tools/mcp')
      const { getMCPServerCapabilities } = await import('@/api/tools/mcp')
      ;(getMCPServersList as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: { list: [{ id: 'cacheSrv', name: 'CacheSrv', status: 'active' }] },
      })
      await loadMCPServers()
      ;(getMCPServerCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: 200,
        success: true,
        data: { tools: [{ name: 'cacheTool' }], resources: [], prompts: [] },
      })
      await getServerCapabilities('cacheSrv')
      const mcp = useMCP()
      expect(mcp.allTools.value.length).toBe(1)
      expect(mcp.allTools.value[0].tool.name).toBe('cacheTool')
    })

    it('allResources应该返回所有服务器的资源', () => {
      const mcp = useMCP()
      mcp.availableServers.value = [
        {
          id: 'rs1',
          name: 'RS1',
          status: 'active',
          capabilities: {
            tools: [],
            resources: [{ uri: 'r1', name: 'R1' }, { uri: 'r2', name: 'R2' }],
            prompts: [],
          },
        },
      ] as any
      expect(mcp.allResources.value.length).toBe(2)
    })

    it('allPrompts应该返回所有服务器的提示词', () => {
      const mcp = useMCP()
      mcp.availableServers.value = [
        {
          id: 'ps1',
          name: 'PS1',
          status: 'active',
          capabilities: {
            tools: [],
            resources: [],
            prompts: [{ name: 'p1' }, { name: 'p2' }, { name: 'p3' }],
          },
        },
      ] as any
      expect(mcp.allPrompts.value.length).toBe(3)
    })
  })
})
