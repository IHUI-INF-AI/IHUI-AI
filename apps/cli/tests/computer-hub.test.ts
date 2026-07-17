/**
 * P1-5 Computer Hub 三层架构测试。
 *
 * 覆盖场景:
 *   1. InMemoryRegistry:register/find/unregister/list/clear/size/newest-wins
 *   2. CompoundResolver:resolve local/remote/local-shadows-remote/dispatch/ToolNotFoundError
 *   3. adapter:wrapTool 字段映射 / execute 转发 / wrapTools 批量
 *   4. 端到端:local + remote + resolver 联动
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Tool, ToolContext, ToolResult } from '../src/tools/index.js'
import {
  InMemoryRegistry,
  CompoundResolver,
  ToolNotFoundError,
  wrapTool,
  wrapTools,
  type ToolHandle,
  type ToolDescription,
} from '../src/tools/hub/index.js'

/** 辅助:构造一个最小 Tool(默认 execute 返回 success + 序列化 args) */
function makeTool(opts: {
  name: string
  description?: string
  dangerLevel?: 'read' | 'write' | 'dangerous'
  execute?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>
}): Tool {
  return {
    name: opts.name,
    description: opts.description ?? `tool ${opts.name}`,
    parameters: { x: { type: 'string', description: 'x' } },
    required: ['x'],
    dangerLevel: opts.dangerLevel,
    execute:
      opts.execute ??
      (async (args) => ({ success: true, output: `exec ${opts.name}: ${JSON.stringify(args)}` })),
  }
}

/** 辅助:构造一个最小 ToolHandle(不依赖 Tool,用于 registry/resolver 单测) */
function makeHandle(id: string, output?: string): ToolHandle {
  return {
    id,
    describe(): ToolDescription {
      return { id, description: `handle ${id}` }
    },
    async execute(_ctx, args) {
      return { success: true, output: output ?? `exec ${id}: ${JSON.stringify(args)}` }
    },
  }
}

const defaultCtx: ToolContext = { workspacePath: '.' }

// ==================== InMemoryRegistry ====================

describe('InMemoryRegistry', () => {
  let registry: InMemoryRegistry

  beforeEach(() => {
    registry = new InMemoryRegistry()
  })

  it('register + find 基本流程', () => {
    const h = makeHandle('t1')
    registry.register(h)
    expect(registry.find('t1')).toBe(h)
  })

  it('unregister 存在的工具返回 true', () => {
    registry.register(makeHandle('t1'))
    expect(registry.unregister('t1')).toBe(true)
  })

  it('unregister 不存在的工具返回 false', () => {
    expect(registry.unregister('nope')).toBe(false)
  })

  it('unregister 后 find 返回 undefined', () => {
    registry.register(makeHandle('t1'))
    registry.unregister('t1')
    expect(registry.find('t1')).toBeUndefined()
  })

  it('list 返回所有 ToolDescription', () => {
    registry.register(makeHandle('t1'))
    registry.register(makeHandle('t2'))
    const list = registry.list()
    expect(list).toHaveLength(2)
    const ids = list.map((d) => d.id).sort()
    expect(ids).toEqual(['t1', 't2'])
  })

  it('clear 清空所有工具', () => {
    registry.register(makeHandle('t1'))
    registry.register(makeHandle('t2'))
    registry.clear()
    expect(registry.size()).toBe(0)
    expect(registry.list()).toEqual([])
  })

  it('size 正确计数', () => {
    expect(registry.size()).toBe(0)
    registry.register(makeHandle('t1'))
    expect(registry.size()).toBe(1)
    registry.register(makeHandle('t2'))
    expect(registry.size()).toBe(2)
  })

  it('newest-wins:同 id 重复 register,find 返回最新版本', () => {
    const h1 = makeHandle('t1', 'v1')
    const h2 = makeHandle('t1', 'v2')
    registry.register(h1)
    registry.register(h2)
    expect(registry.find('t1')).toBe(h2)
    // size 不应翻倍(覆盖而非追加)
    expect(registry.size()).toBe(1)
  })
})

// ==================== CompoundResolver ====================

describe('CompoundResolver', () => {
  let local: InMemoryRegistry
  let remote: InMemoryRegistry
  let resolver: CompoundResolver

  beforeEach(() => {
    local = new InMemoryRegistry()
    remote = new InMemoryRegistry()
    resolver = new CompoundResolver(local, remote)
  })

  it('resolve 命中 local', () => {
    local.register(makeHandle('t1', 'local-out'))
    const r = resolver.resolve('t1')
    expect(r).toBeDefined()
    expect(r!.kind).toBe('local')
    expect(r!.source).toBe('local')
    expect(r!.handle.id).toBe('t1')
  })

  it('resolve 命中 remote', () => {
    remote.register(makeHandle('t1', 'remote-out'))
    const r = resolver.resolve('t1')
    expect(r).toBeDefined()
    expect(r!.kind).toBe('remote')
    expect(r!.source).toBe('remote')
  })

  it('local-shadows-remote:同 id 时 local 胜', () => {
    local.register(makeHandle('shared', 'local-out'))
    remote.register(makeHandle('shared', 'remote-out'))
    const r = resolver.resolve('shared')
    expect(r).toBeDefined()
    expect(r!.kind).toBe('local')
    expect(r!.handle.id).toBe('shared')
  })

  it('resolve 不存在的工具返回 undefined', () => {
    expect(resolver.resolve('nope')).toBeUndefined()
  })

  it('dispatch local 成功执行', async () => {
    local.register(makeHandle('t1', 'local-out'))
    const result = await resolver.dispatch('t1', { x: '1' }, defaultCtx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('local-out')
  })

  it('dispatch remote 成功执行', async () => {
    remote.register(makeHandle('t1', 'remote-out'))
    const result = await resolver.dispatch('t1', { x: '1' }, defaultCtx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('remote-out')
  })

  it('dispatch 不存在的工具抛 ToolNotFoundError', async () => {
    await expect(resolver.dispatch('nope', {}, defaultCtx)).rejects.toBeInstanceOf(
      ToolNotFoundError,
    )
  })

  it('无 remote 时 resolve 只查 local', () => {
    const r = new CompoundResolver(local)
    local.register(makeHandle('t1', 'local-out'))
    expect(r.resolve('t1')?.kind).toBe('local')
    // 不在 local 的工具应返回 undefined(不报错)
    expect(r.resolve('nope')).toBeUndefined()
  })
})

// ==================== adapter ====================

describe('adapter: wrapTool / wrapTools', () => {
  it('wrapTool 字段映射正确(name → id, description, parameters, required, dangerLevel)', () => {
    const tool = makeTool({
      name: 'read_file',
      description: '读取文件',
      dangerLevel: 'read',
    })
    const handle = wrapTool(tool)
    expect(handle.id).toBe('read_file')
    const desc = handle.describe()
    expect(desc.id).toBe('read_file')
    expect(desc.description).toBe('读取文件')
    expect(desc.parameters).toEqual(tool.parameters)
    expect(desc.required).toEqual(['x'])
    expect(desc.dangerLevel).toBe('read')
  })

  it('wrapTool execute 正确转发 args 与 ctx', async () => {
    let receivedArgs: Record<string, unknown> | undefined
    let receivedCtx: ToolContext | undefined
    const tool = makeTool({
      name: 't',
      execute: async (args, ctx) => {
        receivedArgs = args
        receivedCtx = ctx
        return { success: true, output: 'ok' }
      },
    })
    const handle = wrapTool(tool)
    const ctx: ToolContext = { workspacePath: '/tmp' }
    const result = await handle.execute(ctx, { x: '1' })
    expect(result.success).toBe(true)
    expect(receivedArgs).toEqual({ x: '1' })
    expect(receivedCtx).toBe(ctx)
  })

  it('wrapTools 批量包装数量正确', () => {
    const tools = [
      makeTool({ name: 'a' }),
      makeTool({ name: 'b' }),
      makeTool({ name: 'c' }),
    ]
    const handles = wrapTools(tools)
    expect(handles).toHaveLength(3)
    expect(handles.map((h) => h.id).sort()).toEqual(['a', 'b', 'c'])
  })
})

// ==================== 端到端:local + remote + resolver ====================

describe('端到端:local + remote + resolver 联动', () => {
  it('wrapTool 工具到 local/remote,resolve 同名返回 local,dispatch 调用执行返回 ToolResult', async () => {
    const local = new InMemoryRegistry()
    const remote = new InMemoryRegistry()
    const resolver = new CompoundResolver(local, remote)

    // local:write_file + shared(本地版本)
    local.register(
      wrapTool(
        makeTool({
          name: 'write_file',
          description: '写文件',
          dangerLevel: 'write',
          execute: async () => ({ success: true, output: 'wrote' }),
        }),
      ),
    )
    local.register(
      wrapTool(
        makeTool({
          name: 'shared',
          description: 'local shared',
          execute: async () => ({ success: true, output: 'local-shared' }),
        }),
      ),
    )

    // remote:fetch_url + shared(远程版本,与 local 同名)
    remote.register(
      wrapTool(
        makeTool({
          name: 'fetch_url',
          description: '抓 URL',
          dangerLevel: 'read',
          execute: async () => ({ success: true, output: 'fetched' }),
        }),
      ),
    )
    remote.register(
      wrapTool(
        makeTool({
          name: 'shared',
          description: 'remote shared',
          execute: async () => ({ success: true, output: 'remote-shared' }),
        }),
      ),
    )

    // resolve 同名工具返回 local
    const sharedResolved = resolver.resolve('shared')
    expect(sharedResolved).toBeDefined()
    expect(sharedResolved!.kind).toBe('local')
    const sharedResult = await sharedResolved!.handle.execute(defaultCtx, {})
    expect(sharedResult.output).toBe('local-shared')

    // resolve 只在 remote 的工具返回 remote
    const fetchResolved = resolver.resolve('fetch_url')
    expect(fetchResolved).toBeDefined()
    expect(fetchResolved!.kind).toBe('remote')

    // dispatch 调用 local 工具执行返回 ToolResult
    const writeResult = await resolver.dispatch('write_file', { x: '1' }, defaultCtx)
    expect(writeResult.success).toBe(true)
    expect(writeResult.output).toBe('wrote')

    // dispatch 调用 remote 工具执行返回 ToolResult
    const fetchResult = await resolver.dispatch('fetch_url', {}, defaultCtx)
    expect(fetchResult.success).toBe(true)
    expect(fetchResult.output).toBe('fetched')
  })
})
