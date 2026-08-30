/**
 * 计划-执行-清单闭环测试 — 结构化计划 + PlanBuildCoordinator + todo-write + PlanMachine 审批门。
 *
 * 覆盖:
 *   - StructuredPlanStore 持久化到 .ihui/plan-<sessionId>.json(save/load/损坏降级/updateStepStatus)
 *   - PlanBuildCoordinator.setPlan(结构化计划)自动生成 todo 清单(.ihui/todos.json)
 *   - todoId 双向关联(计划步骤 ↔ todo 项)
 *   - 执行期 stepStarted/stepCompleted 同步勾选计划步骤与 todo
 *   - planSessionId 跨实例恢复(状态文件持久化)
 *   - PlanMachine 审批门与闭环流程串联
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { PlanBuildCoordinator } from '../src/modes/plan-build.js'
import { StructuredPlanStore, planFilePath } from '../src/plan/structured.js'
import { readTodoList } from '../src/tools/todo-write.js'
import { PlanMachine } from '../src/plan/index.js'

describe('StructuredPlanStore(.ihui/plan-<sessionId>.json)', () => {
  let tmp: string
  let store: StructuredPlanStore

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-plan-'))
    store = new StructuredPlanStore(tmp)
  })

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('save + load 往返一致,持久化到 .ihui/plan-<sessionId>.json', () => {
    store.save({
      sessionId: 's1',
      steps: [
        { id: 'st1', title: '创建文件', file: 'src/a.ts', action: 'create', todoId: 't1', status: 'pending' },
        { id: 'st2', title: '运行测试', action: 'run', status: 'pending' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(fs.existsSync(path.join(tmp, '.ihui', 'plan-s1.json'))).toBe(true)

    const loaded = store.load('s1')
    expect(loaded?.sessionId).toBe('s1')
    expect(loaded?.steps).toHaveLength(2)
    expect(loaded?.steps[0]).toMatchObject({ id: 'st1', title: '创建文件', file: 'src/a.ts', action: 'create', todoId: 't1', status: 'pending' })
    expect(loaded?.steps[1]?.todoId).toBeUndefined()
  })

  it('load 不存在的计划返回 null', () => {
    expect(store.load('nonexistent')).toBeNull()
  })

  it('损坏文件降级为 null', () => {
    const p = planFilePath(tmp, 'bad')
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, '{ invalid json', 'utf-8')
    expect(store.load('bad')).toBeNull()
  })

  it('非法 steps 结构(action/status 非法)降级为 null', () => {
    const p = planFilePath(tmp, 'invalid')
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify({ sessionId: 'invalid', steps: [{ id: 'x', title: 'y', action: 'hack', status: 'pending' }] }), 'utf-8')
    expect(store.load('invalid')).toBeNull()
  })

  it('updateStepStatus 更新状态并持久化,未知步骤返回 null', () => {
    store.save({
      sessionId: 's1',
      steps: [{ id: 'st1', title: '步骤一', action: 'edit', status: 'pending' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(store.updateStepStatus('s1', 'st1', 'in_progress')?.status).toBe('in_progress')
    expect(store.load('s1')?.steps[0]?.status).toBe('in_progress')
    expect(store.updateStepStatus('s1', 'nope', 'completed')).toBeNull()
  })
})

describe('PlanBuildCoordinator 计划-执行-清单闭环', () => {
  let tmp: string
  let coord: PlanBuildCoordinator

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-planloop-'))
    coord = new PlanBuildCoordinator(tmp)
  })

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  const todoCtx = (workspace: string) => ({ workspacePath: workspace })

  it('setPlan(结构化计划):持久化计划文件 + 自动生成 todo 清单 + todoId 回填', () => {
    coord.setPlan({
      sessionId: 'sess-1',
      steps: [
        { id: 's1', title: '新增结构化类型', file: 'src/plan/structured.ts', action: 'create' },
        { id: 's2', title: '补充单元测试', action: 'create' },
      ],
    })

    // 1. 计划持久化到 .ihui/plan-sess-1.json,todoId 自动补全
    expect(fs.existsSync(planFilePath(tmp, 'sess-1'))).toBe(true)
    const plan = coord.getStructuredPlan()
    expect(plan?.sessionId).toBe('sess-1')
    expect(plan?.steps[0]?.todoId).toBe('todo-sess-1-s1')
    expect(plan?.steps[0]?.status).toBe('pending')

    // 2. todo 清单自动生成到 .ihui/todos.json
    const todos = readTodoList(todoCtx(tmp))
    expect(todos).toHaveLength(2)
    expect(todos[0]).toMatchObject({ id: 'todo-sess-1-s1', status: 'pending', priority: 'medium' })
    expect(todos[0]?.content).toContain('新增结构化类型')
    expect(todos[0]?.content).toContain('src/plan/structured.ts')
    expect(todos[1]?.id).toBe('todo-sess-1-s2')

    // 3. plan 文本摘要保持旧字段语义
    expect(coord.currentPlan).toContain('新增结构化类型')
    expect(coord.currentPlan).toContain('src/plan/structured.ts')
  })

  it('setPlan(结构化计划):保留计划外的旧 todo(merge 语义)', async () => {
    const { todo_write } = await import('../src/tools/todo-write.js')
    await todo_write.execute(
      { todos: [{ id: 'manual-1', content: '手工待办', status: 'pending', priority: 'high' }] },
      todoCtx(tmp),
    )

    coord.setPlan({
      sessionId: 'sess-2',
      steps: [{ id: 's1', title: '步骤一', action: 'edit' }],
    })

    const todos = readTodoList(todoCtx(tmp))
    expect(todos.map((t) => t.id).sort()).toEqual(['manual-1', 'todo-sess-2-s1'])
  })

  it('setPlan(纯文本):保持旧语义,planSessionId 置空', () => {
    coord.setPlan('1. 调研\n2. 实现')
    expect(coord.currentPlan).toBe('1. 调研\n2. 实现')
    expect(coord.getStructuredPlan()).toBeNull()
  })

  it('stepStarted/stepCompleted:计划步骤与 todo 同步勾选', () => {
    coord.setPlan({
      sessionId: 'sess-3',
      steps: [
        { id: 's1', title: '步骤一', action: 'edit' },
        { id: 's2', title: '步骤二', action: 'verify' },
      ],
    })

    // 步骤一开始 → 计划 + todo 均为 in_progress
    coord.stepStarted('s1')
    expect(coord.getStructuredPlan()?.steps[0]?.status).toBe('in_progress')
    expect(readTodoList(todoCtx(tmp)).find((t) => t.id === 'todo-sess-3-s1')?.status).toBe('in_progress')

    // 步骤一完成 → 计划 + todo 均为 completed,summary 透传
    coord.stepCompleted('s1', '重构完成')
    expect(coord.getStructuredPlan()?.steps[0]?.status).toBe('completed')
    const todo = readTodoList(todoCtx(tmp)).find((t) => t.id === 'todo-sess-3-s1')
    expect(todo?.status).toBe('completed')
    expect(todo?.summary).toBe('重构完成')

    // 其余步骤不受影响
    expect(coord.getStructuredPlan()?.steps[1]?.status).toBe('pending')
  })

  it('stepStarted/stepCompleted:未设置结构化计划或未知步骤时静默跳过', () => {
    expect(() => coord.stepStarted('s1')).not.toThrow()
    coord.setPlan({ sessionId: 'sess-4', steps: [{ id: 's1', title: '步骤一', action: 'edit' }] })
    expect(() => coord.stepCompleted('unknown')).not.toThrow()
    expect(coord.getStructuredPlan()?.steps[0]?.status).toBe('pending')
  })

  it('planSessionId 持久化:新实例可恢复结构化计划', () => {
    coord.setPlan({ sessionId: 'sess-5', steps: [{ id: 's1', title: '步骤一', action: 'run' }] })
    coord.enterPlanning()

    // 模拟跨 session 重启:同一工作区新实例
    const restored = new PlanBuildCoordinator(tmp)
    expect(restored.currentMode).toBe('plan')
    expect(restored.getStructuredPlan()?.sessionId).toBe('sess-5')

    // 恢复后仍可继续勾选
    restored.stepCompleted('s1')
    expect(restored.getStructuredPlan()?.steps[0]?.status).toBe('completed')
  })

  it('clearPlan:清除计划关联,不影响已生成的 todo', () => {
    coord.setPlan({ sessionId: 'sess-6', steps: [{ id: 's1', title: '步骤一', action: 'edit' }] })
    coord.clearPlan()
    expect(coord.currentPlan).toBeNull()
    expect(coord.getStructuredPlan()).toBeNull()
    // todos.json 保留(由 todo-write 语义管理,不联动清除)
    expect(readTodoList(todoCtx(tmp)).find((t) => t.id === 'todo-sess-6-s1')).toBeDefined()
  })

  it('闭环串联:审批门 → 结构化计划 → 执行勾选 → 完成', () => {
    // 1. Plan Mode:gathering 状态写入被阻断
    const machine = new PlanMachine('gathering')
    expect(machine.isWriteBlocked()).toBe(true)

    // 2. 计划产出:结构化计划 + todo 清单自动生成
    coord.setPlan({
      sessionId: 'sess-7',
      steps: [
        { id: 's1', title: '实现功能', action: 'create' },
        { id: 's2', title: '验证结果', action: 'verify' },
      ],
    })

    // 3. 审批门:未经批准拒绝转移
    expect(() => machine.transition('gather_complete')).toThrow(/Approval required/)
    expect(machine.getCurrentState()).toBe('gathering')

    // 4. 用户批准 → executing(写入解禁)
    expect(machine.transition('gather_complete', { approved: true })).toBe('executing')
    expect(machine.isWriteBlocked()).toBe(false)

    // 5. 执行期逐步勾选,计划与 todo 同步
    coord.stepStarted('s1')
    coord.stepCompleted('s1', '功能实现完成')
    coord.stepStarted('s2')
    coord.stepCompleted('s2', '全部测试通过')

    // 6. 计划全绿 → execute_complete 收尾
    const plan = coord.getStructuredPlan()
    expect(plan?.steps.every((s) => s.status === 'completed')).toBe(true)
    const todos = readTodoList(todoCtx(tmp))
    expect(todos.filter((t) => t.id.startsWith('todo-sess-7')).every((t) => t.status === 'completed')).toBe(true)
    expect(machine.transition('execute_complete')).toBe('done')
  })
})
