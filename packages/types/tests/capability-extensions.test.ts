// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 声明式扩展 manifest:逐字段校验 + capability-catalog 注册/卸载 + 冲突语义。
 *
 * 覆盖验收要求的四类必须拒绝:未知字段、非法 permission、可执行字段(exec/script)、
 * 非法 activationEvent;并钉住「同 id 重复注册 = 冲突而非覆盖」「卸载无残留」。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  EXTENSION_ACTIVATION_EVENTS,
  EXTENSION_ID_RE,
  findExecutableFields,
  validateExtensionManifest,
  type ExtensionManifest,
  type ExtensionManifestValidationContext,
} from '../src/capability-extensions.js'
import {
  buildManifest,
  getCapability,
  listExtensionManifests,
  registerExtensionManifest,
  scopeOfTool,
  toolScopeMap,
  unregisterExtension,
} from '../src/capability-catalog.js'
import type { ApiKeyPermission } from '../src/api-key.js'

const registeredIds: string[] = []

const catalogCtx: ExtensionManifestValidationContext = {
  isRegisteredScope: (scope) => Boolean(getCapability(scope as ApiKeyPermission)),
}

function validManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'com.example.todo-panel',
    name: 'Todo Panel',
    version: '1.0.0',
    entryCapabilities: ['agents:read'],
    activationEvents: ['onStartup'],
    permissions: ['agents:read'],
    contributes: { tools: [{ name: 'todo_list', capability: 'agents:read' }] },
    ...overrides,
  }
}

function validate(overrides: Record<string, unknown> = {}) {
  return validateExtensionManifest(validManifest(overrides), catalogCtx)
}

function expectIssue(result: ReturnType<typeof validate>, path: string, code: string): void {
  expect(result.ok).toBe(false)
  if (result.ok) return
  const hit = result.errors.find((e) => e.path === path && e.code === code)
  expect(hit, `missing issue ${path}/${code}; got ${JSON.stringify(result.errors)}`).toBeTruthy()
  expect(hit!.message).toContain(path)
}

afterEach(() => {
  for (const id of registeredIds.splice(0)) unregisterExtension(id)
})

describe('manifest schema / validation', () => {
  it('接受合法 manifest 并规范化 contributes', () => {
    const result = validate()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest.contributes.tools).toEqual([
      { name: 'todo_list', capability: 'agents:read' },
    ])
    expect(result.manifest.permissions).toEqual(['agents:read'])
  })

  it('未知顶层字段:逐字段拒绝并点名', () => {
    expectIssue(validate({ postinstall: 'curl evil' }), 'postinstall', 'unknown_field')
  })

  it('未知嵌套字段:contributes.tools[0] 的多余键被点名', () => {
    expectIssue(
      validate({
        contributes: { tools: [{ name: 'todo_list', capability: 'agents:read', icon: 'x' }] },
      }),
      'contributes.tools[0].icon',
      'unknown_field',
    )
  })

  it('非法 permission:必须报错并点名 permissions[0](反向例②)', () => {
    const result = validate({ permissions: ['exec:run'], entryCapabilities: ['exec:run'] })
    expectIssue(result, 'permissions[0]', 'permission_not_registered')
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes('"exec:run"'))).toBe(true)
    }
  })

  it('可执行字段 exec:一律拒绝(反向例①-可执行)', () => {
    const result = validate({ entry: 'index.js', exec: 'node index.js' })
    expectIssue(result, 'exec', 'executable_field_forbidden')
  })

  it('可执行字段 script:嵌套层级同样拒绝', () => {
    const result = validate({
      contributes: { tools: [{ name: 'todo_list', capability: 'agents:read', script: 'run.sh' }] },
    })
    expectIssue(result, 'contributes.tools[0].script', 'executable_field_forbidden')
  })

  it('可执行字段 command(单数)拒绝,但 contributes.commands(复数)合法', () => {
    expectIssue(validate({ command: 'sh' }), 'command', 'executable_field_forbidden')
    const ok = validate({
      contributes: { commands: [{ name: 'todo.open', capability: 'agents:read' }] },
    })
    expect(ok.ok).toBe(true)
  })

  it('非法 activationEvent:点名 activationEvents[0]', () => {
    expectIssue(
      validate({ activationEvents: ['onLaunch'] }),
      'activationEvents[0]',
      'activation_event_unknown',
    )
  })

  it('id 命名规则:无点分 / 大写均拒绝', () => {
    expectIssue(validate({ id: 'todo' }), 'id', 'invalid_id')
    expectIssue(validate({ id: 'Com.Example.Todo' }), 'id', 'invalid_id')
    expect(EXTENSION_ID_RE.test('com.example.todo-panel')).toBe(true)
  })

  it('version 必须语义化', () => {
    expectIssue(validate({ version: 'v1' }), 'version', 'invalid_version')
  })

  it('缺少必填字段:逐字段报 missing_field', () => {
    const raw = validManifest()
    delete raw.name
    const result = validateExtensionManifest(raw, catalogCtx)
    expectIssue(result, 'name', 'missing_field')
  })

  it('entryCapabilities 必须先在 permissions 内声明', () => {
    expectIssue(
      validate({ permissions: ['agents:read'], entryCapabilities: ['models:read'] }),
      'entryCapabilities[0]',
      'entry_capability_not_declared',
    )
  })

  it('permissions 重复声明被点名', () => {
    expectIssue(
      validate({ permissions: ['agents:read', 'agents:read'], entryCapabilities: ['agents:read'] }),
      'permissions[1]',
      'permission_duplicate',
    )
  })

  it('贡献的 capability 必须已在 entryCapabilities 内', () => {
    expectIssue(
      validate({
        permissions: ['agents:read', 'models:read'],
        entryCapabilities: ['agents:read'],
        contributes: { tools: [{ name: 'x', capability: 'models:read' }] },
      }),
      'contributes.tools[0].capability',
      'entry_capability_not_declared',
    )
  })

  it('贡献名不合规 / manifest 内重名均拒绝', () => {
    expectIssue(
      validate({ contributes: { tools: [{ name: '1bad', capability: 'agents:read' }] } }),
      'contributes.tools[0].name',
      'contribution_name_invalid',
    )
    expectIssue(
      validate({
        contributes: {
          tools: [{ name: 'dup', capability: 'agents:read' }],
          views: [{ name: 'dup', capability: 'agents:read' }],
        },
      }),
      'contributes.views[0].name',
      'contribution_duplicate',
    )
  })

  it('modelTiers 非法档位 / min 高于 preferred 均拒绝', () => {
    expectIssue(validate({ modelTiers: { min: 'ultra' } }), 'modelTiers.min', 'model_tier_invalid')
    expectIssue(
      validate({ modelTiers: { min: 'advanced', preferred: 'basic' } }),
      'modelTiers',
      'model_tier_order',
    )
  })

  it('findExecutableFields 深度扫描数组/对象', () => {
    const issues = findExecutableFields({ a: [{ eval: 1 }] })
    expect(issues.map((i) => i.path)).toEqual(['a[0].eval'])
  })

  it('已知 activationEvents 枚举非空且全部可用于 manifest', () => {
    for (const event of EXTENSION_ACTIVATION_EVENTS) {
      const result = validate({ activationEvents: [event] })
      expect(result.ok, event).toBe(true)
    }
  })
})

describe('registry integration (capability-catalog)', () => {
  it('注册后工具并入同一张 toolScopeMap / scopeOfTool,并出现在 buildManifest', () => {
    const result = registerExtensionManifest(validManifest())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    registeredIds.push(result.manifest.id)

    expect(scopeOfTool('todo_list')).toBe('agents:read')
    expect(toolScopeMap()['todo_list']).toBe('agents:read')
    expect(listExtensionManifests().map((m) => m.id)).toEqual(['com.example.todo-panel'])
    const manifest = buildManifest('9.9.9', '2026-11-04T00:00:00.000Z')
    expect(manifest.extensions).toHaveLength(1)
    expect(manifest.extensions![0]!.id).toBe('com.example.todo-panel')
  })

  it('同 id 重复注册必须冲突而非覆盖(反向例③)', () => {
    const first = registerExtensionManifest(validManifest())
    expect(first.ok).toBe(true)
    if (!first.ok) return
    registeredIds.push(first.manifest.id)

    const second = registerExtensionManifest(
      validManifest({
        name: 'Hijacked',
        contributes: { tools: [{ name: 'todo_list_v2', capability: 'agents:read' }] },
      }),
    )
    expect(second.ok).toBe(false)
    if (second.ok) return
    const conflict = second.errors.find((e) => e.code === 'extension_id_conflict')
    expect(conflict?.path).toBe('id')
    expect(conflict?.message).toContain('com.example.todo-panel')

    // 覆盖未发生:注册表仍是第一份声明。
    expect(listExtensionManifests().map((m) => m.name)).toEqual(['Todo Panel'])
    expect(scopeOfTool('todo_list_v2')).toBeUndefined()
  })

  it('贡献名与既有 capability-catalog 工具冲突:拒绝注册', () => {
    const existingTool = Object.keys(toolScopeMap())[0]!
    const result = registerExtensionManifest(
      validManifest({
        contributes: { tools: [{ name: existingTool, capability: 'agents:read' }] },
      }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.code === 'contribution_conflict')).toBe(true)
  })

  it('卸载回收注册项与贡献名,不留残留', () => {
    const baseline = Object.keys(toolScopeMap()).sort()
    const result = registerExtensionManifest(validManifest())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const removed = unregisterExtension(result.manifest.id)
    expect(removed).toEqual({ ok: true, removedTools: 1 })
    expect(Object.keys(toolScopeMap()).sort()).toEqual(baseline)
    expect(scopeOfTool('todo_list')).toBeUndefined()
    expect(listExtensionManifests()).toEqual([])
    expect('extensions' in buildManifest('9.9.9', '2026-11-04T00:00:00.000Z')).toBe(false)
    expect(unregisterExtension(result.manifest.id)).toEqual({
      ok: false,
      removedTools: 0,
      reason: 'extension_not_found',
    })
  })

  it('校验失败的 manifest 不会被注册(错误透传)', () => {
    const result = registerExtensionManifest(validManifest({ permissions: ['exec:run'] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.path)).toContain('permissions[0]')
    expect(listExtensionManifests()).toEqual([])
  })

  it('按激活事件查询扩展(catalog 查询面)', () => {
    const result = registerExtensionManifest(validManifest({ activationEvents: ['onToolCall'] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    registeredIds.push(result.manifest.id)
    const manifests: ExtensionManifest[] = listExtensionManifests()
    expect(manifests[0]!.activationEvents).toEqual(['onToolCall'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
