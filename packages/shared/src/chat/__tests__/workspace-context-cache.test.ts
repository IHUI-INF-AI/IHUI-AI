// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区上下文缓存的策略锁(票㉑ 补账②,2026-09-28)。
 *
 * 这份策略刚从 `apps/web/src/hooks/use-chat/workspace.ts` 的端内胶水提到共享层,
 * 因为它的返回值就是服务端委托开关 `workspace_context` 本身
 * (`llm.py`: `if req.workspace_context and tool_name in _FS_DEPENDENT_TOOLS`)。
 * 判的四件事,每件都对应一种"两端各自都绿而用户拿到旧快照"的形态:
 *  ① 命中缓存**不得重读正文**(否则缓存没有意义,大目录每轮全扫);
 *  ② 任何可加载文件的增 / 删 / 改都必须触发整体重读(否则模型永远看到首屏快照);
 *  ③ 签名校验自身失败时选择重读,而不是沿用一份不知道过没过期的缓存;
 *  ④ 加载失败**不写缓存**,否则一次失败被钉成永久空上下文。
 * 另有跨端锁:两端都走共享出口,全仓只有一处签名比较实现。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  invalidateWorkspaceContextCache,
  loadWorkspaceContextCached,
  peekWorkspaceContextCache,
} from '../workspace-context-loader'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../..')
if (!readdirSync(ROOT).includes('pnpm-workspace.yaml')) {
  throw new Error(`REPO_ROOT 解析异常:${ROOT} 看起来不是仓库根`)
}

// =============================================================================
// 构造面:一份可控的"虚拟工作区"
// =============================================================================

interface Rec {
  content: string
  lastModified: number
}

interface World {
  /** 路径 → 正文与 mtime(目录用 `/` 分隔,根目录无前置斜杠) */
  files: Map<string, Rec>
  /** 正文读取次数:签名收集只取元数据,所以命中缓存时这个数必须不动 */
  textReads: number
  /** 下一次目录迭代抛错(用来造"签名校验本身失败"与"加载失败"两支) */
  breakNextIterate: boolean
}

const makeWorld = (files: Record<string, { content: string; lastModified: number }>): World => ({
  files: new Map(Object.entries(files)),
  textReads: 0,
  breakNextIterate: false,
})

interface FakeFile {
  size: number
  lastModified: number
  text(): Promise<string>
  slice(start: number, end: number): { text(): Promise<string> }
}
interface FakeFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<FakeFile>
}
interface FakeDirHandle {
  kind: 'directory'
  name: string
  values(): AsyncIterableIterator<FileSystemHandle>
  getFileHandle(name: string): Promise<FakeFileHandle>
}

const childrenOf = (world: World, prefix: string): string[] => {
  const names = new Set<string>()
  for (const key of world.files.keys()) {
    if (!key.startsWith(prefix)) continue
    const seg = key.slice(prefix.length).split('/')[0] as string
    if (seg) names.add(seg)
  }
  return [...names].sort()
}

const makeFileHandle = (name: string, path: string, world: World): FakeFileHandle => ({
  kind: 'file',
  name,
  async getFile(): Promise<FakeFile> {
    const rec = world.files.get(path)
    if (!rec) throw new Error(`文件已不存在: ${path}`)
    return {
      size: rec.content.length,
      lastModified: rec.lastModified,
      async text() {
        world.textReads += 1
        return rec.content
      },
      slice(start: number, end: number) {
        return {
          async text() {
            world.textReads += 1
            return rec.content.slice(start, end)
          },
        }
      },
    }
  },
})

const makeDirHandle = (name: string, prefix: string, world: World): FakeDirHandle => ({
  kind: 'directory',
  name,
  values() {
    if (world.breakNextIterate) {
      world.breakNextIterate = false
      // 抛在异步迭代开始处:loader 与签名收集都经 walkDir,所以只有"下一次调用"能被打断
      return (async function* nope(): AsyncIterableIterator<FileSystemHandle> {
        throw new Error('iterate failed')
      })()
    }
    return (async function* gen() {
      for (const child of childrenOf(world, prefix)) {
        const childPath = prefix + child
        yield (world.files.has(childPath)
          ? makeFileHandle(child, childPath, world)
          : makeDirHandle(child, `${childPath}/`, world)) as unknown as FileSystemHandle
      }
    })()
  },
  async getFileHandle(child: string): Promise<FakeFileHandle> {
    const p = prefix + child
    if (!world.files.has(p)) throw new Error(`NotFound: ${p}`)
    return makeFileHandle(child, p, world)
  },
})

const rootHandle = (world: World): FileSystemDirectoryHandle =>
  makeDirHandle('proj', '', world) as unknown as FileSystemDirectoryHandle

/** 基线工作区:一个优先文件 + 一个目录内源码文件(两条读取路径都覆盖到) */
const baseFiles = () => ({
  'AGENTS.md': { content: '# 规则\n先跑测试再提交', lastModified: 1_000 },
  'src/util.ts': { content: 'export const a = 1', lastModified: 2_000 },
})

type Log = Array<{ level: 'info' | 'warn'; message: string }>
const newLogs = (): Log => []
const loggerFor = (logs: Log) => (level: 'info' | 'warn', message: string) => {
  logs.push({ level, message })
}
const joined = (logs: Log) => logs.map((l) => l.message).join('\n')

beforeEach(() => {
  invalidateWorkspaceContextCache()
})

describe('① 冷加载与命中', () => {
  it('首次加载产出正文并写缓存,命中时不再读任何文件正文', async () => {
    const world = makeWorld(baseFiles())
    const logs = newLogs()

    const first = await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    expect(first).toContain('<workspace_files name="proj">')
    expect(first).toContain('### src/util.ts')
    expect(world.textReads).toBeGreaterThan(0)
    expect(peekWorkspaceContextCache()?.name).toBe('proj')
    expect(joined(logs)).toContain('loaded 2 files')

    const readsAfterCold = world.textReads
    const second = await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    expect(second).toBe(first)
    expect(joined(logs)).toContain('cache hit')
    // 这条才是"缓存"的定义:命中路径一次正文都不读(签名收集只取元数据)
    expect(world.textReads, '命中缓存却重读了正文 ⇒ 缓存没起作用').toBe(readsAfterCold)
  })
})

describe('② 签名变更必须触发整体重读', () => {
  const cases: Array<[string, (world: World) => void]> = [
    [
      '改内容(mtime 前进)',
      (w) => w.files.set('src/util.ts', { content: 'export const a = 2', lastModified: 3_000 }),
    ],
    [
      '新增可加载文件',
      (w) => w.files.set('src/extra.ts', { content: 'export const b = 1', lastModified: 3_000 }),
    ],
    ['删除可加载文件', (w) => void w.files.delete('src/util.ts')],
    [
      '只改 mtime 不改内容',
      (w) => w.files.set('src/util.ts', { content: 'export const a = 1', lastModified: 9_000 }),
    ],
  ]
  for (const [label, mutate] of cases) {
    it(`${label} ⇒ 重载并读到新集合`, async () => {
      const world = makeWorld(baseFiles())
      const logs = newLogs()
      await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
      const coldReads = world.textReads
      mutate(world)

      const text = await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
      expect(joined(logs)).toContain('workspace files changed, reloading full context')
      expect(world.textReads, '签名变了却没重读正文').toBeGreaterThan(coldReads)
      if (label.startsWith('改内容')) expect(text).toContain('export const a = 2')
      if (label.startsWith('新增')) expect(text).toContain('### src/extra.ts')
      if (label.startsWith('删除')) expect(text).not.toContain('### src/util.ts')
      // 重载后必须把新签名写回去,否则下一轮又"变更"一次
      const beforeThird = world.textReads
      await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
      expect(world.textReads).toBe(beforeThird)
    })
  }

  it('非可加载文件(图片)的变动不触发重读', async () => {
    const world = makeWorld({
      ...baseFiles(),
      'src/logo.png': { content: 'PNG', lastModified: 500 },
    })
    const logs = newLogs()
    await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    const cold = world.textReads
    world.files.set('src/logo.png', { content: 'PNG2', lastModified: 600 })
    await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    expect(joined(logs)).toContain('cache hit')
    expect(world.textReads).toBe(cold)
  })
})

describe('③ 签名校验失败 ⇒ 重读而不是沿用旧值', () => {
  it('迭代抛错被吞成"判不出过期",于是必须整体重读', async () => {
    const world = makeWorld(baseFiles())
    const logs = newLogs()
    const cold = await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    expect(cold).toContain('export const a = 1')

    // 缓存建立后改内容:单靠签名校验也会重载,所以这里让签名收集**抛错**来走第三条支
    world.files.set('src/util.ts', { content: 'export const a = 99', lastModified: 7_000 })
    world.breakNextIterate = true
    const after = await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    expect(joined(logs)).toContain('signature check failed, reloading')
    // 关键断言:拿到的是新正文。沿用缓存的写法会在这里读到 a = 1 而账面一声不响
    expect(after).toContain('export const a = 99')
  })
})

describe('④ 失败不写缓存', () => {
  it('冷加载即失败 ⇒ 返回 undefined 且不留缓存,下一轮仍能成功加载', async () => {
    const world = makeWorld(baseFiles())
    const logs = newLogs()
    world.breakNextIterate = true

    const failed = await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    expect(failed).toBeUndefined()
    expect(joined(logs)).toContain('load failed')
    // 这一条防的是"把一次失败钉成永久空上下文":缓存必须是空的
    expect(peekWorkspaceContextCache()).toBeNull()

    const ok = await loadWorkspaceContextCached(rootHandle(world), { onLog: loggerFor(logs) })
    expect(ok).toContain('<workspace_files')
    expect(peekWorkspaceContextCache()?.name).toBe('proj')
  })
})

describe('⑤ invalidate 的按名语义', () => {
  it('名字不匹配时不得动别人的缓存;匹配或不传名才清', async () => {
    const world = makeWorld(baseFiles())
    await loadWorkspaceContextCached(rootHandle(world))
    expect(peekWorkspaceContextCache()).not.toBeNull()

    invalidateWorkspaceContextCache('other-dir')
    expect(peekWorkspaceContextCache(), '换工作区过程中误清 ⇒ 下一轮莫名其妙重扫').not.toBeNull()

    invalidateWorkspaceContextCache('proj')
    expect(peekWorkspaceContextCache()).toBeNull()

    await loadWorkspaceContextCached(rootHandle(world))
    invalidateWorkspaceContextCache()
    expect(peekWorkspaceContextCache()).toBeNull()
  })
})

// =============================================================================
// 跨端单一源锁(源码面)
// =============================================================================

const SKIP_DIR = new Set([
  'node_modules',
  '.next',
  '.output',
  'dist',
  'build',
  '.turbo',
  'coverage',
])
function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (!SKIP_DIR.has(name)) yield* walk(p)
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      yield p
    }
  }
}

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

describe('⑥ 两端都走共享出口,签名比较只有一份', () => {
  it('web 胶水层委托共享缓存(不再自持一份)', () => {
    const src = readFileSync(join(ROOT, 'apps/web/src/hooks/use-chat/workspace.ts'), 'utf8')
    expect(src).toContain('loadWorkspaceContextCached(handle, {')
    expect(src).toContain('invalidateWorkspaceContextCache(name)')
    expect(src).toContain('return peekWorkspaceContextCache()')
    // 反向锁:端内不得再留一份缓存态(搬家最容易留下的就是"两边各存一份")
    expect(src).not.toMatch(/^\s*(let|const)\s+\w*[Cc]ache\w*\s*(=|:)/m)
    expect(src).not.toContain('workspaceSignaturesEqual')
  })

  it('扩展切目录与清目录都收回缓存', () => {
    const src = readFileSync(join(ROOT, 'apps/extension/lib/workspace-store.ts'), 'utf8')
    // 两处:切换前收旧身份 + clearActiveWorkspace
    expect([...src.matchAll(/invalidateWorkspaceContextCache\(/g)].length).toBeGreaterThanOrEqual(2)
  })

  it('function workspaceSignaturesEqual 全仓恰好一次,且在共享层', () => {
    const hits: string[] = []
    for (const rel of [
      'apps/web/src',
      'apps/extension',
      'apps/miniapp-taro/src',
      'apps/mobile-rn/src',
      'packages/shared/src',
      'packages/app/src',
    ]) {
      const abs = join(ROOT, rel)
      if (!isDir(abs)) continue
      for (const f of walk(abs)) {
        const fpath = f.replace(/\\/g, '/')
        if (fpath.includes('/__tests__/') || fpath.includes('/tests/')) continue
        if (/\bfunction workspaceSignaturesEqual\b/.test(readFileSync(f, 'utf8'))) hits.push(fpath)
      }
    }
    // 0 命中不记绿:扫描面看不见实现,与"确实只有一份"在账面上长得一样
    expect(hits.length, `签名比较应恰好 1 处,实到 ${hits.length}`).toBe(1)
    expect(hits[0]).toContain('workspace-context-loader.ts')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
