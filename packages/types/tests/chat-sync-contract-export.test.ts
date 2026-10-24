// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71(V2 #23)「chat 多端/多标签实时同步」的**出口**回归锁(2026-10-24 补装切片)。
 *
 * 立因:判据内核 `src/chat-sync-contract.ts` 连同 10 例幂等回归 2026-10-08 就入库了,
 * 但出口一直没挂 —— 包主入口没做 re-export、`package.json` 的 `exports` 也没有子路径条目,
 * 于是别的包**物理上无法按名 import**,"契约先行"当场退化成"包内自用"。
 * 本锁判三格,缺一即红:
 *   A 主入口 barrel 把内核导出的每个符号**原样**透出,且与内核模块是同一个引用
 *     (不是第二份实现 —— §0.6 单一真相源:出口挂歪成复制品,比没挂更难发现);
 *   B `exports` 表登记了 `./chat-sync-contract`,且指向的文件名对得上 src 里真存在的那枚模块
 *     (防悬空条目:表里写了个 dist 里永远不会产出的名字);
 *   C 按包名 `@ihui/types/chat-sync-contract` 与 `@ihui/types` 两条路径解析后取到同一批符号。
 *
 * C 的取材面有个本包特有的坑,必须写清楚:`@ihui/types` 是**编译消费**(`exports` 全指
 * `./dist/*.js`,与 `@ihui/shared` 那种 `exports` 直出 `./src/*.ts` 的源码消费不同),
 * 而 turbo 里本包 `test` 任务只 `dependsOn: ["^build"]`(上游各包的构建),**不含自身 build**。
 * ⇒ dist 缺失或落后于 src 时,C 拿不到输入:按 §0.3 落「未判定」并点名该跑什么构建,
 *   既不拿假绿糊过去,也不把"这次没重新构建"这种与出口无关的因由顶成红(§12e 恒红门)。
 *   A、B 两面读的是 `src/` 与 `package.json` 本体,不受构建节拍影响,是常驻硬锁。
 *
 * §22c:本文件不复制任何判据常量或实现 —— 一律 import 真实出口,判据只住在内核里。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as kernel from '../src/chat-sync-contract.js'
import * as barrel from '../src/index.js'

const PKG_ROOT = resolve2PkgRoot()

/** package.json 的 exports 面(只声明本锁用到的条件键,不复制判据)。 */
interface ExportsEntry {
  types?: unknown
  import?: unknown
}
interface PackageManifest {
  name?: unknown
  main?: unknown
  exports?: Record<string, unknown>
}

/** 内核当前导出的**运行时**符号(barrel 少透任何一个 ⇒ A 立刻红)。 */
const kernelRuntimeKeys = Object.keys(kernel).filter((key) => {
  const value = (kernel as Record<string, unknown>)[key]
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null) ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
})

const SUBPATH_KEY = './chat-sync-contract'
const SUBPATH_BASENAME = 'chat-sync-contract'

describe('票71 出口 A:主入口 barrel 原样透出内核符号', () => {
  it('内核导出的运行时符号在 @ihui/types 主入口全部可见', () => {
    // 枚举到 0 个候选判死不记绿(§0.3):内核若被掏空,这条必须响。
    expect(kernelRuntimeKeys.length).toBeGreaterThan(0)
    const barrelRecord = barrel as Record<string, unknown>
    const missing = kernelRuntimeKeys.filter((key) => barrelRecord[key] === undefined)
    expect(missing).toEqual([])
  })

  it('每个符号与内核模块是**同一个引用**(出口没挂成第二份实现)', () => {
    const barrelRecord = barrel as Record<string, unknown>
    const kernelRecord = kernel as Record<string, unknown>
    const diverging = kernelRuntimeKeys.filter((key) => barrelRecord[key] !== kernelRecord[key])
    expect(diverging).toEqual([])
  })

  it('判据函数经主入口直呼可用(冒烟:双通道重投裁成 duplicate)', () => {
    const apply = barrel.applyChatSyncEvent as typeof kernel.applyChatSyncEvent
    const idKey = barrel.chatSyncIdempotencyKey as typeof kernel.chatSyncIdempotencyKey
    const event = {
      type: 'message:created' as const,
      protocolVersion: kernel.CHAT_SYNC_PROTOCOL_VERSION,
      channel: 'sse' as const,
      room: { kind: 'conversation' as const, conversationId: 'conv-export' },
      messageId: 'm-export-1',
      role: 'assistant' as const,
      content: 'hi',
    }
    const first = apply(kernel.EMPTY_CHAT_SYNC_STATE, event)
    expect(first.result.applied).toBe(true)
    // 同一条 created 换 ws 通道重投:必须判 duplicate 且返回**同一个 state 引用**。
    const replay = apply(first.state, { ...event, channel: 'ws' })
    expect(replay.result).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(replay.state).toBe(first.state)
    expect(idKey(event)).toBe(idKey({ ...event, channel: 'ws' }))
  })
})

describe('票71 出口 B:exports 表登记了子路径且不是悬空条目', () => {
  const manifest = JSON.parse(
    readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'),
  ) as PackageManifest
  const entry = manifest.exports?.[SUBPATH_KEY] as ExportsEntry | string | undefined

  it(`exports 含 ${SUBPATH_KEY} 条件条目`, () => {
    expect(entry).toBeDefined()
    expect(typeof entry === 'object' && entry !== null).toBe(true)
  })

  it('types / import 两个条件都指向本包既有的 dist 目录(形状对齐主入口条目,不自创风格)', () => {
    const root = manifest.exports?.['.'] as ExportsEntry | undefined
    expect(typeof root?.types).toBe('string')
    expect(typeof root?.import).toBe('string')
    const cond = entry as ExportsEntry
    // 目录前缀由 '.' 条目现值推出,而非在本测试里硬写一份 dist 约定。
    // manifest 里的值是 **POSIX 形态**的包内路径,必须按 POSIX 算:实测 win32 的
    // join('./dist', x) 会把开头的 './' 吞掉并换成反斜杠 ⇒ 拿它去比 manifest 字符串
    // 只会造出与出口无关的假红(§12e 同型)。
    const rootDir = posix.dirname(root!.import as string)
    expect(posix.dirname(cond.types as string)).toBe(rootDir)
    expect(posix.dirname(cond.import as string)).toBe(rootDir)
    expect(cond.types).toBe(`${rootDir}/${SUBPATH_BASENAME}.d.ts`)
    expect(cond.import).toBe(`${rootDir}/${SUBPATH_BASENAME}.js`)
  })

  it('子路径名对得上 src 里真存在的那枚模块(防表里写个构建永远产不出的名字)', () => {
    expect(existsSync(join(PKG_ROOT, 'src', `${SUBPATH_BASENAME}.ts`))).toBe(true)
  })

  it('加条目没把主入口挤歪:.\u0020→ dist/index(.js/.d.ts)仍在位', () => {
    const root = manifest.exports?.['.'] as ExportsEntry | undefined
    expect(root?.import).toBe(manifest.main)
    expect(typeof root?.types).toBe('string')
  })
})

/**
 * C:按包名解析。dist 不可用/过期时显式「未判定」(见文件头 C 的取材面说明)。
 */
type ByNameLoad =
  | {
      readonly judged: true
      readonly sub: Record<string, unknown>
      readonly root: Record<string, unknown>
    }
  | { readonly judged: false; readonly reason: string }

async function loadByPackageName(): Promise<ByNameLoad> {
  const subpathSpec = '@ihui/types/chat-sync-contract'
  const rootSpec = '@ihui/types'
  try {
    const [sub, root] = await Promise.all([
      import(subpathSpec) as Promise<Record<string, unknown>>,
      import(rootSpec) as Promise<Record<string, unknown>>,
    ])
    return { judged: true, sub, root }
  } catch (error) {
    return {
      judged: false,
      reason: error instanceof Error ? error.message.split('\n')[0] : String(error),
    }
  }
}

const byName = await loadByPackageName()

// root 能解析却读不到内核符号 ⇒ dist 落后于刚改过的 src(本包 test 不依赖自身 build)。
// 这是"取不到输入",不是"出口没挂",所以按未判定处理并点名出路,不冒红也不记绿。
const distStale =
  byName.judged && (byName.root as Record<string, unknown>)[kernelRuntimeKeys[0]!] === undefined

const byNameUndetermined = !byName.judged || distStale

if (!byName.judged) {
  console.warn(
    `[票71-C 未判定] 按包名解析不可用(dist 是编译消费面,本包 test 任务不含自身 build):${byName.reason}\n` +
      '  出路:pnpm --filter @ihui/types build 后复跑本测试。A/B 两面已常驻判过。',
  )
}
if (byName.judged && distStale) {
  console.warn(
    '[票71-C 未判定] dist 面读不到内核符号 = dist 落后于 src/index.ts(与出口是否挂对无关)。' +
      ' 出路:pnpm --filter @ihui/types build 后复跑本测试。',
  )
}

describe('票71 出口 C:按包名两条路径取到同一批符号', () => {
  // 实测边界(2026-10-24 本切片踩到的):两条按包名路径都经 exports 解析到 **dist**,
  // 而 A 面走的是 `src/*.ts` —— src 与 dist 是同一份源码的**两个模块实例**,引用天然不等。
  // 拿引用去比 src↔dist,判的是构建节拍而不是出口有没有挂对(必然假红,§12e 同型)。
  // 所以本组把两件事分开:
  //   · 引用等值只在「包名 ↔ 包名」两路之间判 —— 这才是消费方真的会撞上的那一格
  //     (主入口与子路径若各拿一份,幂等缓存就会互不相认);
  //   · src ↔ dist 改判**行为等值**(同输入必须同输出)。
  it.skipIf(byNameUndetermined)(
    '@ihui/types/chat-sync-contract 可直取,且运行时符号一个不缺',
    () => {
      if (!byName.judged) return
      const missing = kernelRuntimeKeys.filter((key) => byName.sub[key] === undefined)
      expect(missing).toEqual([])
      expect(typeof byName.sub.applyChatSyncEvent).toBe('function')
    },
  )

  it.skipIf(byNameUndetermined)(
    '@ihui/types 主入口与子路径取到**同一引用**(判据不会裂成两份)',
    () => {
      if (!byName.judged) return
      for (const key of kernelRuntimeKeys) {
        expect(byName.root[key], `主入口 ${key} 与子路径不是同一引用`).toBe(byName.sub[key])
      }
    },
  )

  it.skipIf(byNameUndetermined)('按包名取到的判据与 src 内核行为等值(同输入同输出)', () => {
    if (!byName.judged) return
    const idKeyByName = byName.sub.chatSyncIdempotencyKey as typeof kernel.chatSyncIdempotencyKey
    const event: kernel.ChatSyncEvent = {
      type: 'message:patched',
      protocolVersion: kernel.CHAT_SYNC_PROTOCOL_VERSION,
      channel: 'sse',
      room: { kind: 'conversation', conversationId: 'conv-export' },
      messageId: 'm-behavior',
      rev: 3,
      kind: 'snapshot',
      content: 'same-input',
    }
    expect(idKeyByName(event)).toBe(kernel.chatSyncIdempotencyKey(event))
    expect(idKeyByName({ ...event, channel: 'ws' })).toBe(kernel.chatSyncIdempotencyKey(event))
  })
})

/** ROOT 由脚本自身位置推导,不用 process.cwd()(共享工作树 cwd 不可靠,AGENTS §15)。 */
function resolve2PkgRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // tests/ 的父目录就是包根。
  return dirname(here)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
