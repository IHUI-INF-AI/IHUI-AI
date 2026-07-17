/**
 * todo_write 工具单元测试 — 任务清单管理。
 *
 * 覆盖:基本添加 / status 校验 / priority 校验 / 排序 / 持久化 / merge 模式。
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { todo_write, readTodoList } from '../src/tools/todo-write.js'
import type { ToolContext } from '../src/tools/index.js'

function makeCtx(tmp: string): ToolContext {
  return { workspacePath: tmp }
}

describe('todo_write 工具', () => {
  let tmp: string
  let ctx: ToolContext

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-todo-'))
    ctx = makeCtx(tmp)
  })

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('空 todos 数组返回提示', async () => {
    const result = await todo_write.execute({ todos: [] }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('(无 todo)')
  })

  it('添加单个 todo,持久化到 .ihui/todos.json', async () => {
    const result = await todo_write.execute(
      { todos: [{ id: 't1', content: '测试任务', status: 'pending', priority: 'high' }] },
      ctx,
    )
    expect(result.success).toBe(true)
    expect(result.output).toContain('已保存 1 个 todo')
    expect(result.output).toContain('[t1] 测试任务')

    const saved = readTodoList(ctx)
    expect(saved).toHaveLength(1)
    expect(saved[0]?.id).toBe('t1')
    expect(saved[0]?.status).toBe('pending')
  })

  it('status 非法返回错误', async () => {
    const result = await todo_write.execute(
      { todos: [{ id: 't1', content: 'x', status: 'invalid', priority: 'high' }] },
      ctx,
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('status')
  })

  it('priority 非法返回错误', async () => {
    const result = await todo_write.execute(
      { todos: [{ id: 't1', content: 'x', status: 'pending', priority: 'urgent' }] },
      ctx,
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('priority')
  })

  it('id 缺失返回错误', async () => {
    const result = await todo_write.execute(
      { todos: [{ id: '', content: 'x', status: 'pending', priority: 'high' }] },
      ctx,
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('id')
  })

  it('todos 非数组返回错误', async () => {
    const result = await todo_write.execute({ todos: 'not array' as unknown as never[] }, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toContain('数组')
  })

  it('排序:in_progress > pending > completed;同 status 按 priority 降序', async () => {
    const result = await todo_write.execute(
      {
        todos: [
          { id: 'a', content: 'A', status: 'completed', priority: 'low' },
          { id: 'b', content: 'B', status: 'pending', priority: 'high' },
          { id: 'c', content: 'C', status: 'in_progress', priority: 'low' },
          { id: 'd', content: 'D', status: 'in_progress', priority: 'high' },
          { id: 'e', content: 'E', status: 'pending', priority: 'low' },
        ],
      },
      ctx,
    )
    expect(result.success).toBe(true)
    const saved = readTodoList(ctx)
    expect(saved.map((t) => t.id)).toEqual(['d', 'c', 'b', 'e', 'a'])
  })

  it('merge 模式:新列表中未出现的 id 保留', async () => {
    // 第一次写入 t1/t2
    await todo_write.execute(
      {
        todos: [
          { id: 't1', content: 'A', status: 'pending', priority: 'high' },
          { id: 't2', content: 'B', status: 'pending', priority: 'high' },
        ],
      },
      ctx,
    )
    // 第二次 merge:true 只写 t3,t1/t2 保留
    const result = await todo_write.execute(
      {
        todos: [{ id: 't3', content: 'C', status: 'in_progress', priority: 'medium' }],
        merge: true,
      },
      ctx,
    )
    expect(result.success).toBe(true)
    const saved = readTodoList(ctx)
    expect(saved.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3'])
  })

  it('merge 模式:新列表中出现的 id 替换', async () => {
    await todo_write.execute(
      { todos: [{ id: 't1', content: 'A', status: 'pending', priority: 'high' }] },
      ctx,
    )
    await todo_write.execute(
      {
        todos: [{ id: 't1', content: 'A 已更新', status: 'completed', priority: 'low' }],
        merge: true,
      },
      ctx,
    )
    const saved = readTodoList(ctx)
    expect(saved).toHaveLength(1)
    expect(saved[0]?.content).toBe('A 已更新')
    expect(saved[0]?.status).toBe('completed')
  })

  it('持久化文件损坏时降级为空数组', async () => {
    const p = path.join(tmp, '.ihui', 'todos.json')
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, '{ invalid json', 'utf-8')
    const saved = readTodoList(ctx)
    expect(saved).toEqual([])
  })

  it('summary 字段在渲染中显示', async () => {
    const result = await todo_write.execute(
      {
        todos: [
          {
            id: 't1',
            content: '登录功能',
            status: 'completed',
            priority: 'high',
            summary: 'JWT 鉴权完成',
          },
        ],
      },
      ctx,
    )
    expect(result.success).toBe(true)
    expect(result.output).toContain('JWT 鉴权完成')
  })
})
