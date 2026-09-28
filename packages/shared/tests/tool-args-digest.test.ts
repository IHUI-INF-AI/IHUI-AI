// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86B —— 工具入参两档摘要唯一出口的专测。
 *
 * 三条交付判据都在这里钉住:
 *   成对① 换键序必同摘要 / 改取值必换摘要(「键序不变量」那组)。
 *   成对② 反向锁:把原值塞进任何输出字段 ⇒ 必红(「输出不含原值」那组 —— 取证方式是每个
 *          夹具值里埋一个唯一 nonce,断言它不出现在摘要的任何字节里;并另有一条正向对照
 *          证明这组语料确实产出了多档读数)。
 *   散列正确性:自带纯 JS SHA-256 必须与 `node:crypto` 逐向量等值,且与 CLI 那份
 *          `canonicalizeArgs` 的字节形态等值(「逐向量等值」那组 + 硬编码已知答案)。
 *
 * 关于"兼容预言"那段复制:它复制的是 **apps/cli 的实现**(本模块要向它对齐),不是本模块。
 * 复制被测实现自己才是 §22c 禁止的复读机。它一旦与 CLI 漂开本组即红 —— 那正是"两处算同一
 * 件事必须共用一份实现"这条规矩在 CLI 迁移完成前的临时哨兵(迁移被本票排除:禁改 apps/cli)。
 */
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  digestToolArgShape,
  digestToolArgsStructure,
  summarizeToolArgs,
  TOOL_ARG_SHAPE_BUCKETS,
  TOOL_ARG_SHAPE_KINDS,
  TOOL_ARGS_CANONICAL_MAX_DEPTH,
  TOOL_ARGS_CANONICAL_MAX_NODES,
  TOOL_ARGS_DIGEST_PREFIX,
  type ToolArgShape,
} from '../src/utils/tool-args-digest'

/** 来自 apps/cli/src/stream-tool-ledger.ts 的 canonicalizeArgs(逐字对齐的兼容预言)。 */
function cliCanonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value))
    return `[${(value as unknown[]).map((v) => cliCanonicalize(v)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${cliCanonicalize(record[k])}`).join(',')}}`
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** 每个夹具值都埋一个独特 nonce,反向锁靠它判定"输出里有没有原值"。 */
const NONCES = [
  'zzNonceAlpha',
  'zzNonceBeta',
  'InvoiceBoard',
  'paymentsSecretDir',
  'kk9f2qz7',
  'zzNonceGamma',
  'zzNonceDelta',
  'zzNonceEpsil',
]

/** 覆盖 JSON 可表达全形态的语料(用于逐向量对账)。 */
const CORPUS: unknown[] = [
  {},
  [],
  null,
  0,
  42,
  -3.5,
  true,
  'plain-zzNonceAlpha',
  { a: 1, b: 'zzNonceBeta' },
  { b: 'zzNonceBeta', a: 1 },
  { nested: { z: [1, 2, { deep: 'InvoiceBoard' }], a: null } },
  ['x', { k: 'paymentsSecretDir' }, [1, [2, [3]]]],
  { 'k-0': 'leading-zero', 'k-1': 'kk9f2qz7' },
  { emoji: '🙂', cjk: '中文测试', latin: 'naïve' },
  { long: 'a'.repeat(300) },
  { undef: undefined, keep: 1 },
  { path: 'apps/web/src/components/zzNonceGamma.tsx' },
  { arr: Array.from({ length: 40 }, (_, i) => ({ i })) },
]

describe('逐向量等值 —— 与 node:crypto 及归一形态对账', () => {
  it('每个语料值的摘要 == sha256(CLI 那份 canonicalizeArgs 的字节)', () => {
    for (const value of CORPUS) {
      expect(digestToolArgsStructure(value)).toBe(
        TOOL_ARGS_DIGEST_PREFIX + sha256(cliCanonicalize(value)),
      )
    }
  })

  it('已知答案向量(硬编码 hex:两侧实现一起改错时,本条仍不认账)', () => {
    expect(digestToolArgsStructure({ a: 1 })).toBe(
      `${TOOL_ARGS_DIGEST_PREFIX}015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862`,
    )
    expect(digestToolArgsStructure(['x', 'y'])).toBe(
      `${TOOL_ARGS_DIGEST_PREFIX}01f650e85c95620160b40ed22626dca932e9f700ffe599be060da184dd4d7822`,
    )
    expect(digestToolArgsStructure({ emoji: '🙂', naïve: 1, 中文: '测试值' })).toBe(
      `${TOOL_ARGS_DIGEST_PREFIX}c70f062e74737fd2cf57fd3d9e403b2e4ef7f0151d1a4c211834016a816cea54`,
    )
    expect(digestToolArgsStructure({ z: 1, a: { d: 4, b: [1, { q: 2, p: 3 }] } })).toBe(
      `${TOOL_ARGS_DIGEST_PREFIX}a6694803753fa611c7b3a006b78c749f3d47aa53e5279361417eb47b414af07a`,
    )
  })

  it('摘要形态:固定前缀 + 64 位小写 hex(跨端等值要求长度也稳定)', () => {
    const digest = digestToolArgsStructure({ anything: 1 })
    expect(digest.startsWith(TOOL_ARGS_DIGEST_PREFIX)).toBe(true)
    expect(digest.slice(TOOL_ARGS_DIGEST_PREFIX.length)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('成对① 键序不变量', () => {
  const one = { a: 1, b: { x: 1, y: 2 }, c: [{ k: 'v', m: [1, 2] }] }

  it('同一对象换键序(含数组内嵌对象、含 3 层深)⇒ 摘要必须相同', () => {
    const shuffled = { c: [{ m: [1, 2], k: 'v' }], b: { y: 2, x: 1 }, a: 1 }
    expect(digestToolArgsStructure(shuffled)).toBe(digestToolArgsStructure(one))
  })

  it('数组内对象的键序也必须被归一(否则同一次调用换个序列化顺序就判成两次)', () => {
    expect(digestToolArgsStructure({ l: [{ p: 1, q: 2 }] })).toBe(
      digestToolArgsStructure({ l: [{ q: 2, p: 1 }] }),
    )
  })

  it('改一个取值 ⇒ 摘要必须不同(含"多一个 undefined 键"这种语义无差别改动)', () => {
    expect(digestToolArgsStructure({ a: 1, b: 2 })).not.toBe(
      digestToolArgsStructure({ a: 1, b: 3 }),
    )
    expect(digestToolArgsStructure({ a: 1 })).not.toBe(
      digestToolArgsStructure({ a: 1, b: undefined }),
    )
    expect(digestToolArgsStructure({ a: 1 })).not.toBe(digestToolArgsStructure({ a: '1' }))
    expect(digestToolArgsStructure([1, 2])).not.toBe(digestToolArgsStructure([2, 1]))
  })

  it('bigint 与同值 number 不得归一成同一摘要(语义上不是同一件事)', () => {
    expect(digestToolArgsStructure({ n: 10n })).not.toBe(digestToolArgsStructure({ n: 10 }))
  })

  it('如实登记 CLI 归一的既有后果:NaN/Infinity 落 null 字节,与真 null 同摘要', () => {
    expect(digestToolArgsStructure({ a: Number.NaN })).toBe(digestToolArgsStructure({ a: null }))
    expect(digestToolArgsStructure({ a: Number.NaN })).toBe(
      digestToolArgsStructure({ a: undefined }),
    )
  })

  it('两次相同输入的摘要逐字相同(纯函数,无内部状态)', () => {
    expect(digestToolArgsStructure(one)).toBe(digestToolArgsStructure(one))
  })
})

describe('成对② 反向锁 —— 输出不含任何原值', () => {
  /** 把待检对象整个序列化后逐 nonce 检查:原值哪怕一个片段都不许出现。 */
  function assertNoOriginalValue(subject: unknown, label: string): void {
    const text = JSON.stringify(subject)
    for (const nonce of NONCES) {
      expect(text, `${label} 的输出里出现了原值片段 ${nonce}`).not.toContain(nonce)
    }
    // 目录名/文件名同样不许出现:它们是"bucket 派生自文本"的另一种形态(不带 nonce 也漏)
    for (const fragment of ['paymentsSecretDir', 'InvoiceBoard.tsx', 'src/components']) {
      expect(text, `${label} 的输出里出现了路径/内容片段 ${fragment}`).not.toContain(fragment)
    }
  }

  it('summarizeToolArgs 的 digest / shape / lossy 三面都不含原值', () => {
    const args = {
      path: 'apps/web/src/components/zzNonceGamma.tsx',
      query: 'SELECT * FROM zzNonceAlpha',
      apiKey: 'sk-live_kk9f2qz7_abcdefghij',
      dir: 'src/paymentsSecretDir/invoice/InvoiceBoard.tsx',
      text: 'zzNonceBeta 是一段中文原文 测试',
      list: ['zzNonceDelta', 'zzNonceEpsil'],
    }
    const summary = summarizeToolArgs(args)
    assertNoOriginalValue(summary, 'summarizeToolArgs')
    expect(Object.keys(summary.shape).sort()).toEqual([
      'apiKey',
      'dir',
      'list',
      'path',
      'query',
      'text',
    ])
  })

  it('逐条参数同样不含原值', () => {
    const values: Array<[string, unknown]> = [
      ['path', 'apps/api/src/routes/zzNonceAlpha.ts'],
      ['filePath', 'InvoiceBoard'],
      ['url', 'https://api.zzNonceBeta.example.com/v1/x'],
      ['apiKey', 'kk9f2qz7kk9f2qz7kk9f2qz7'],
      ['prompt', 'zzNonceGamma 请读 src/paymentsSecretDir 下的文件'],
      ['payload', { inner: 'zzNonceDelta' }],
    ]
    for (const [key, value] of values) {
      assertNoOriginalValue(digestToolArgShape(key, value), `digestToolArgShape(${key})`)
    }
  })

  it('shape / bucket 只能是封闭枚举里的字面量(判据不许有第二份来源)', () => {
    const kinds = new Set<string>(TOOL_ARG_SHAPE_KINDS)
    const buckets = new Set<string>(TOOL_ARG_SHAPE_BUCKETS)
    const seen = new Set<string>()
    for (const value of CORPUS) {
      for (const [key, shape] of Object.entries(summarizeToolArgs(value).shape)) {
        expect(kinds.has(shape.shape), `未知 shape:${shape.shape}`).toBe(true)
        expect(buckets.has(shape.bucket), `未知 bucket:${shape.bucket}`).toBe(true)
        expect(Number.isInteger(shape.len), `${key}.len 必须是整数`).toBe(true)
        expect(shape.len).toBeGreaterThanOrEqual(0)
        seen.add(`${shape.shape}/${shape.bucket}`)
      }
    }
    // 阳性对照:这组语料确实产出了多档;一条都没产出的话上面那些断言等于没跑
    expect(seen.size).toBeGreaterThan(6)
  })
})

describe('档2 归类表 —— 每一档取哪一型由这张表钉死', () => {
  const cases: Array<[string, unknown, ToolArgShape]> = [
    [
      'path',
      'apps/x/src/y.ts',
      { shape: 'path', bucket: 'repo-source-relative', len: 'apps/x/src/y.ts'.length },
    ],
    [
      'path',
      'packages/p/src/y.ts',
      {
        shape: 'path',
        bucket: 'repo-package-relative',
        len: 'packages/p/src/y.ts'.length,
      },
    ],
    ['path', 'src/a/b.ts', { shape: 'path', bucket: 'relative-other', len: 'src/a/b.ts'.length }],
    ['path', '../a.ts', { shape: 'path', bucket: 'parent-relative', len: '../a.ts'.length }],
    ['path', '/etc/hosts', { shape: 'path', bucket: 'posix-absolute', len: '/etc/hosts'.length }],
    [
      'path',
      'C:\\a\\b.ts',
      { shape: 'path', bucket: 'windows-absolute', len: 'C:\\a\\b.ts'.length },
    ],
    ['path', '\\\\srv\\sh', { shape: 'path', bucket: 'unc-path', len: '\\\\srv\\sh'.length }],
    ['path', '~/n.txt', { shape: 'path', bucket: 'home-relative', len: '~/n.txt'.length }],
    // 裸名:只有键名本身提示路径才走 path,否则是文本(见下面 'name' 那条对照)
    ['file', 'index.ts', { shape: 'path', bucket: 'bare-name', len: 'index.ts'.length }],
    // camelCase 键名必须先归一再判提示 —— 不归一时 filePath 一条都不接(camel→snake 那步的理由)
    ['filePath', 'ReportDoc', { shape: 'path', bucket: 'bare-name', len: 'ReportDoc'.length }],
    ['name', 'index.ts', { shape: 'text', bucket: 'dotted-key', len: 'index.ts'.length }],
    [
      'url',
      'https://a.example.com/x',
      {
        shape: 'url',
        bucket: 'secure-web',
        // len 刻意不含 scheme:那是两档之间唯一的差别,不该再占一次信息
        len: 'a.example.com/x'.length,
      },
    ],
    [
      'url',
      'http://a.example.com/x',
      { shape: 'url', bucket: 'plain-web', len: 'a.example.com/x'.length },
    ],
    ['url', 'file:///tmp/x', { shape: 'url', bucket: 'other-scheme', len: '/tmp/x'.length }],
    ['mode', 'auto', { shape: 'text', bucket: 'enum-like-token', len: 4 }],
    ['limit', '42', { shape: 'text', bucket: 'numeric-string', len: 2 }],
    ['key', 'common.back', { shape: 'text', bucket: 'dotted-key', len: 11 }],
    [
      'question',
      'what should I do?',
      { shape: 'text', bucket: 'multi-word', len: 'what should I do?'.length },
    ],
    [
      'code',
      'sk_live_9f2qz7KkLm3nOp8q',
      {
        shape: 'text',
        bucket: 'opaque-token',
        len: 'sk_live_9f2qz7KkLm3nOp8q'.length,
      },
    ],
    ['n', 7, { shape: 'number', bucket: 'integer', len: 1 }],
    ['ratio', 0.25, { shape: 'number', bucket: 'fraction', len: 4 }],
    ['nan', Number.NaN, { shape: 'number', bucket: 'non-finite', len: 0 }],
    ['flag', true, { shape: 'boolean', bucket: 'flag', len: 0 }],
    ['big', 10n, { shape: 'bigint', bucket: 'bigint-integer', len: 2 }],
    ['none', null, { shape: 'null', bucket: 'none', len: 0 }],
    ['void', undefined, { shape: 'null', bucket: 'none', len: 0 }],
    ['ids', [1, 2, 3], { shape: 'array', bucket: 'scalar-array', len: 3 }],
    ['items', [{ a: 1 }], { shape: 'array', bucket: 'object-array', len: 1 }],
    ['mixed', [1, { a: 1 }], { shape: 'array', bucket: 'mixed-array', len: 2 }],
    ['emptyList', [], { shape: 'array', bucket: 'empty-collection', len: 0 }],
    ['opts', { a: 1 }, { shape: 'object', bucket: 'flat-object', len: 1 }],
    ['opts2', { a: { b: 1 } }, { shape: 'object', bucket: 'nested-object', len: 1 }],
    ['opts3', {}, { shape: 'object', bucket: 'empty-collection', len: 0 }],
    ['cb', () => 1, { shape: 'opaque', bucket: 'opaque-value', len: 0 }],
  ]

  for (const [key, value, expected] of cases) {
    const shown = typeof value === 'string' ? JSON.stringify(value) : String(value)
    it(`${key} = ${shown.slice(0, 30)} ⇒ ${expected.bucket}`, () => {
      expect(digestToolArgShape(key, value)).toEqual(expected)
    })
  }

  it('长文本走 long-prose;带 and/or 的散文不得被误判成相对路径', () => {
    expect(digestToolArgShape('prompt', 'x '.repeat(90).trim()).bucket).toBe('long-prose')
    expect(digestToolArgShape('prompt', 'the cat and/or the dog '.repeat(10)).bucket).toBe(
      'long-prose',
    )
  })

  it('全小写长 slug 不得被判成不透明凭据(缺随机性证据)', () => {
    expect(digestToolArgShape('name', 'some_quite_long_branch_name').bucket).toBe('enum-like-token')
  })
})

describe('凭据类键 —— 长度也粗化,且成对可判', () => {
  it('同一凭据键下长度相近的两个值 ⇒ 形态记录逐字相同', () => {
    const short = 'a'.repeat(23)
    const long = 'b'.repeat(24)
    expect(digestToolArgShape('apiKey', long)).toEqual(digestToolArgShape('apiKey', short))
    expect(digestToolArgShape('apiKey', short).bucket).toBe('secret-under-key')
    expect(digestToolArgShape('apiKey', short).len % 16).toBe(0)
  })

  it('换到非凭据键上,同样的两个值必须还能区分开(粗化不得全局生效)', () => {
    expect(digestToolArgShape('text', 'a'.repeat(23))).not.toEqual(
      digestToolArgShape('text', 'b'.repeat(24)),
    )
  })
})

describe('加固分支 —— 不抛、可判、并如实报 lossy', () => {
  it('普通对象 lossy = false(阳性对照:这个标志有真值,不是恒 true 的装饰)', () => {
    expect(summarizeToolArgs({ a: 1 }).lossy).toBe(false)
  })

  it('循环引用不抛 ⇒ lossy = true,且同形两次同摘要', () => {
    const a: Record<string, unknown> = { n: 1 }
    a.self = a
    const b: Record<string, unknown> = { n: 1 }
    b.self = b
    const summary = summarizeToolArgs(a)
    expect(summary.lossy).toBe(true)
    expect(summary.digest).toBe(digestToolArgsStructure(b))
  })

  it('超出深度上限 ⇒ lossy = true,不抛', () => {
    let deep: unknown = { leaf: 'x' }
    for (let i = 0; i < TOOL_ARGS_CANONICAL_MAX_DEPTH + 3; i++) deep = { nest: deep }
    expect(summarizeToolArgs(deep).lossy).toBe(true)
  })

  it('超出节点预算 ⇒ lossy = true,且预算外的尾巴确实不再被摘要提交(lossy 的存在理由)', () => {
    const big = Array.from({ length: TOOL_ARGS_CANONICAL_MAX_NODES + 50 }, (_, i) => i)
    expect(summarizeToolArgs(big).lossy).toBe(true)
    const tailChanged = [...big]
    tailChanged[tailChanged.length - 1] = 999999
    expect(digestToolArgsStructure(tailChanged)).toBe(digestToolArgsStructure(big))
  })

  it('字节视图只按长度入摘要 ⇒ lossy = true(长度相同/不同两种结论都点名)', () => {
    const buf = Buffer.alloc(8, 0x41)
    const otherContent = Buffer.alloc(8, 0x42)
    expect(summarizeToolArgs({ b: buf }).lossy).toBe(true)
    expect(digestToolArgsStructure({ b: buf })).toBe(digestToolArgsStructure({ b: otherContent }))
    expect(digestToolArgsStructure({ b: buf })).not.toBe(
      digestToolArgsStructure({ b: Buffer.alloc(9, 0x41) }),
    )
  })

  it('函数 / symbol 不抛,标成 opaque-value 且 lossy = true,描述符不落输出', () => {
    const summary = summarizeToolArgs({ cb: () => 1, sym: Symbol('zzNonceAlpha') })
    expect(summary.lossy).toBe(true)
    expect(JSON.stringify(summary)).not.toContain('zzNonceAlpha')
    expect(summary.shape.cb).toEqual({ shape: 'opaque', bucket: 'opaque-value', len: 0 })
  })

  it('Date 的时间值进摘要(可等值对账);档2 目前只报 object/empty-collection —— 射程边界如实钉住', () => {
    expect(digestToolArgsStructure({ at: new Date(0) })).not.toBe(
      digestToolArgsStructure({ at: new Date(1) }),
    )
    expect(digestToolArgShape('at', new Date(0))).toEqual({
      shape: 'object',
      bucket: 'empty-collection',
      len: 0,
    })
  })
})

describe('summarizeToolArgs 的组合语义', () => {
  it('非对象入参:shape 是空表,digest 仍按整值算', () => {
    for (const value of ['just-a-string', 7, null, [1, 2]]) {
      const summary = summarizeToolArgs(value)
      expect(summary.shape).toEqual({})
      expect(summary.digest).toBe(digestToolArgsStructure(value))
    }
  })

  it('shape 的键有序,且同一调用的两次读数逐字相同', () => {
    const args = { z: 1, a: 2 }
    expect(Object.keys(summarizeToolArgs(args).shape)).toEqual(['a', 'z'])
    expect(summarizeToolArgs(args)).toEqual(summarizeToolArgs({ a: 2, z: 1 }))
  })
})
