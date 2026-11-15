// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端内能力应用:逐字段校验器。
 *
 * 钉住的是「声明式」这条底线:可执行字段、未知块、未声明数据源、越界路径、
 * 非白名单落点一律拒绝,而不是静默忽略;拒绝必须点名字段(path)与原因(code)。
 */
import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_APP_ID_RE,
  CAPABILITY_APP_LIMITS,
  collectDeclaredCalls,
  findCapabilityAppExecutableFields,
  parseCapabilityAppCallArgs,
  parseCapabilityAppRecord,
  validateCapabilityApp,
} from '../src/capability-app.js'

function validApp(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'my-dashboard',
    title: '我的看板',
    slot: 'page',
    version: '1.0.0',
    source: 'ai',
    spec: {
      blocks: [
        { kind: 'heading', text: '概览', level: 1 },
        { kind: 'stat', items: [{ label: '今日', value: '12' }] },
      ],
    },
    ...overrides,
  }
}

describe('validateCapabilityApp', () => {
  it('接受最小合法应用并返回字节数', () => {
    const result = validateCapabilityApp(validApp())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).toBe('my-dashboard')
    expect(result.value.slot).toBe('page')
    expect(result.value.spec.blocks).toHaveLength(2)
    expect(result.bytes).toBeGreaterThan(0)
  })

  it('拒绝可执行字段(任何层级),并点名 path', () => {
    const result = validateCapabilityApp(
      validApp({
        spec: {
          blocks: [{ kind: 'text', text: 'hi', script: 'alert(1)' }],
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((item) => item.code === 'executable_field_forbidden')).toBe(true)
    expect(result.errors.some((item) => item.path === 'spec.blocks[0].script')).toBe(true)
  })

  it('拒绝未知顶层字段与未知 action 类型', () => {
    const unknownKey = validateCapabilityApp(validApp({ injected: true }))
    expect(unknownKey.ok).toBe(false)
    if (!unknownKey.ok) {
      expect(unknownKey.errors.some((item) => item.code === 'unknown_field')).toBe(true)
    }

    const badAction = validateCapabilityApp(
      validApp({
        spec: {
          blocks: [
            {
              kind: 'button',
              label: 'go',
              action: { type: 'exec', command: 'rm -rf /' },
            },
          ],
        },
      }),
    )
    expect(badAction.ok).toBe(false)
    if (!badAction.ok) {
      expect(badAction.errors.some((item) => item.code === 'invalid_action')).toBe(true)
      expect(badAction.errors.some((item) => item.code === 'executable_field_forbidden')).toBe(true)
    }
  })

  it('拒绝非白名单落点、非法 id、非法版本', () => {
    const badSlot = validateCapabilityApp(validApp({ slot: 'floating-anywhere' }))
    expect(badSlot.ok).toBe(false)
    if (!badSlot.ok) expect(badSlot.errors.some((item) => item.code === 'invalid_slot')).toBe(true)

    const badId = validateCapabilityApp(validApp({ id: 'My Dashboard!' }))
    expect(badId.ok).toBe(false)
    if (!badId.ok) expect(badId.errors.some((item) => item.code === 'invalid_id')).toBe(true)

    const badVersion = validateCapabilityApp(validApp({ version: 'v1' }))
    expect(badVersion.ok).toBe(false)
    if (!badVersion.ok) {
      expect(badVersion.errors.some((item) => item.code === 'invalid_version')).toBe(true)
    }
  })

  it('拒绝未知块 kind 与块内未知字段', () => {
    const badKind = validateCapabilityApp(
      validApp({ spec: { blocks: [{ kind: 'iframe', src: 'https://evil.example' }] } }),
    )
    expect(badKind.ok).toBe(false)
    if (!badKind.ok) {
      expect(badKind.errors.some((item) => item.code === 'invalid_block_kind')).toBe(true)
    }

    const unknownBlockKey = validateCapabilityApp(
      validApp({ spec: { blocks: [{ kind: 'text', text: 'hi', onClick: 'x' }] } }),
    )
    expect(unknownBlockKey.ok).toBe(false)
    if (!unknownBlockKey.ok) {
      expect(unknownBlockKey.errors.some((item) => item.code === 'unknown_field')).toBe(true)
    }
  })

  it('数据绑定只允许同源 /api/ 且引用必须已声明', () => {
    const okApp = validateCapabilityApp(
      validApp({
        spec: {
          data: { metrics: { path: '/api/models' } },
          blocks: [{ kind: 'table', from: 'metrics', columns: [{ key: 'name', label: '名称' }] }],
        },
      }),
    )
    expect(okApp.ok).toBe(true)

    const external = validateCapabilityApp(
      validApp({ spec: { data: { metrics: { path: 'https://evil.example/x' } }, blocks: [] } }),
    )
    expect(external.ok).toBe(false)
    if (!external.ok)
      expect(external.errors.some((item) => item.code === 'invalid_path')).toBe(true)

    const traversal = validateCapabilityApp(
      validApp({ spec: { data: { metrics: { path: '/api/../internal' } }, blocks: [] } }),
    )
    expect(traversal.ok).toBe(false)
    if (!traversal.ok)
      expect(traversal.errors.some((item) => item.code === 'invalid_path')).toBe(true)

    const undeclared = validateCapabilityApp(
      validApp({
        spec: { blocks: [{ kind: 'list', from: 'nope' }] },
      }),
    )
    expect(undeclared.ok).toBe(false)
    if (!undeclared.ok) {
      expect(undeclared.errors.some((item) => item.code === 'unknown_data_source')).toBe(true)
    }
  })

  it('id 必须与路径参数一致(防改体改 id)', () => {
    const result = validateCapabilityApp(validApp(), { expectedId: 'other-id' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((item) => item.code === 'invalid_id')).toBe(true)
  })

  it('嵌套超过上限即拒绝', () => {
    let blocks: unknown[] = [{ kind: 'text', text: 'leaf' }]
    for (let depth = 0; depth <= CAPABILITY_APP_LIMITS.maxDepth + 1; depth += 1) {
      blocks = [{ kind: 'tabs', tabs: [{ label: `t${depth}`, blocks }] }]
    }
    const result = validateCapabilityApp(validApp({ spec: { blocks } }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((item) => item.code === 'too_deep')).toBe(true)
  })

  it('findCapabilityAppExecutableFields 深度扫描任意层级', () => {
    const found = findCapabilityAppExecutableFields({
      spec: { blocks: [{ kind: 'columns', columns: [{ blocks: [{ kind: 'text', eval: '1' }] }] }] },
    })
    expect(found).toHaveLength(1)
    expect(found[0]?.code).toBe('executable_field_forbidden')
  })

  it('parseCapabilityAppRecord 只认合法记录,不做宽松兜底', () => {
    const now = new Date().toISOString()
    const valid = validateCapabilityApp(validApp())
    expect(valid.ok).toBe(true)
    if (!valid.ok) return

    const record = { ...valid.value, createdAt: now, updatedAt: now }
    const parsed = parseCapabilityAppRecord(JSON.stringify(record))
    expect(parsed?.id).toBe('my-dashboard')
    expect(parsed?.createdAt).toBe(now)

    expect(parseCapabilityAppRecord('not json')).toBeNull()
    expect(
      parseCapabilityAppRecord(JSON.stringify({ ...record, spec: { blocks: [{ kind: 'nope' }] } })),
    ).toBeNull()
  })

  it('id 规则防止路径注入', () => {
    expect(CAPABILITY_APP_ID_RE.test('my-app-1')).toBe(true)
    expect(CAPABILITY_APP_ID_RE.test('../etc/passwd')).toBe(false)
    expect(CAPABILITY_APP_ID_RE.test('A')).toBe(false)
  })
})

// ===========================================================================
// 只读能力桥(App Action Bridge)
// ===========================================================================

describe('能力调用桥', () => {
  it('接受白名单 tool 动作并保留参数与 into', () => {
    const result = validateCapabilityApp(
      validApp({
        spec: {
          blocks: [
            {
              kind: 'form',
              fields: [{ kind: 'input', name: 'kw', label: '关键词' }],
              submitLabel: '查询',
              action: {
                type: 'tool',
                call: 'conversations.recent',
                args: { limit: '20', search: '{{kw}}' },
                into: 'result',
              },
            },
            { kind: 'list', from: 'result', labelKey: 'title' },
          ],
        },
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const form = result.value.spec.blocks[0]
    expect(form?.kind === 'form' && form.action.type === 'tool' ? form.action.call : null).toBe(
      'conversations.recent',
    )
    expect(form?.kind === 'form' && form.action.type === 'tool' ? form.action.into : null).toBe(
      'result',
    )
  })

  it('拒绝白名单外的能力名(不等到运行时)', () => {
    const result = validateCapabilityApp(
      validApp({
        spec: {
          blocks: [{ kind: 'button', label: 'go', action: { type: 'tool', call: 'fs.readFile' } }],
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((item) => item.code === 'unknown_call')).toBe(true)
      expect(result.errors.some((item) => item.path.includes('.call'))).toBe(true)
    }
  })

  it('拒绝未声明参数键(多传 userId 也不能穿过)', () => {
    const result = validateCapabilityApp(
      validApp({
        spec: {
          blocks: [
            {
              kind: 'button',
              label: 'go',
              action: { type: 'tool', call: 'usage.daily', args: { userId: 'someone' } },
            },
          ],
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((item) => item.code === 'invalid_call_args')).toBe(true)
      expect(result.errors.some((item) => item.path === 'spec.blocks[0].action.args.userId')).toBe(
        true,
      )
    }
  })

  it('拒绝越界数值与非法布尔', () => {
    const outOfRange = validateCapabilityApp(
      validApp({
        spec: {
          blocks: [
            {
              kind: 'button',
              label: 'go',
              action: { type: 'tool', call: 'usage.daily', args: { days: '999' } },
            },
          ],
        },
      }),
    )
    expect(outOfRange.ok).toBe(false)

    const badBool = validateCapabilityApp(
      validApp({
        spec: {
          blocks: [
            {
              kind: 'button',
              label: 'go',
              action: { type: 'tool', call: 'notifications.recent', args: { unreadOnly: 'yes' } },
            },
          ],
        },
      }),
    )
    expect(badBool.ok).toBe(false)
  })

  it('数据源 call 与 path 互斥,且 call 才是唯一必填', () => {
    const both = validateCapabilityApp(
      validApp({
        spec: {
          data: { recent: { path: '/api/models', call: 'conversations.recent' } },
          blocks: [],
        },
      }),
    )
    expect(both.ok).toBe(false)
    if (!both.ok)
      expect(both.errors.some((item) => item.code === 'conflicting_data_source')).toBe(true)

    const neither = validateCapabilityApp(validApp({ spec: { data: { recent: {} }, blocks: [] } }))
    expect(neither.ok).toBe(false)
    if (!neither.ok) expect(neither.errors.some((item) => item.code === 'missing_field')).toBe(true)

    const callOnly = validateCapabilityApp(
      validApp({
        spec: {
          data: { recent: { call: 'conversations.recent', args: { limit: '5' } } },
          blocks: [{ kind: 'list', from: 'recent', labelKey: 'title' }],
        },
      }),
    )
    expect(callOnly.ok).toBe(true)
  })

  it('parseCapabilityAppCallArgs 是两侧共用的唯一强转实现', () => {
    const ok = parseCapabilityAppCallArgs('usage.daily', { days: 7 })
    expect(ok.ok && ok.value.days).toBe('7')

    const unknownKey = parseCapabilityAppCallArgs('usage.daily', { days: '7', userId: 'x' })
    expect(unknownKey.ok).toBe(false)

    const notNumber = parseCapabilityAppCallArgs('usage.daily', { days: 'abc' })
    expect(notNumber.ok).toBe(false)

    const empty = parseCapabilityAppCallArgs('notifications.recent', undefined)
    expect(empty.ok).toBe(true)
  })

  it('collectDeclaredCalls 只收白名单内的名字', () => {
    const declared = collectDeclaredCalls({
      data: { a: { call: 'usage.daily' } },
      blocks: [
        { kind: 'button', label: 'x', action: { type: 'tool', call: 'notifications.recent' } },
        { kind: 'button', label: 'y', action: { type: 'tool', call: 'fs.readFile' } },
        { kind: 'text', text: 'noop' },
      ],
    })
    expect(declared.has('usage.daily')).toBe(true)
    expect(declared.has('notifications.recent')).toBe(true)
    expect(declared.size).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
