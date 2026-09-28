// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区执行器 / 上下文加载器的单一源锁(票㉑ 第二枚,2026-09-28)。
 *
 * 这两个模块刚从 `apps/web/src/lib/` 逐字搬进共享层(web 侧原路径降为 re-export 包装),
 * 搬家的理由写在各自头注里:服务端委托分支是 `if req.workspace_context and tool_name in
 * _FS_DEPENDENT_TOOLS`,所以"谁能执行"由端决定,而"执行成语义"必须只有一份。
 *
 * 本测试判三件事,缺一件就等于搬家没搬完:
 *  ① web 原路径只剩 `export * from '@ihui/shared/chat/…'`,且不再声明任何东西
 *     (包装里再长出一条声明 = 第二份实现的第一步);
 *  ② 全仓源码面 `function executeWorkspaceTool` 恰好出现一次,且落在共享层
 *     (0 次不判绿 —— 那通常是判据看不见新文件,而不是世界干净);
 *  ③ 共享层那份是**真实现**:对一个不存在的工具名必须回"不支持"而不是 undefined
 *     (搬成空壳的话 ① ② 都能照样绿)。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { executeWorkspaceTool } from '../workspace-tool-executor'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../..')
if (!readdirSync(ROOT).includes('pnpm-workspace.yaml')) {
  throw new Error(`REPO_ROOT 解析异常:${ROOT} 看起来不是仓库根`)
}

/** 行首判据一律在原文上找 —— 整篇 flatten 后 `^` 只匹配串首,任何文件都判不过(搬家自测第一版就这么坏过)。 */
const wrapperOf = (rel: string, sub: string) => {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  expect(src, `${rel} 应只剩一行 re-export`).toMatch(
    new RegExp(`^export \\* from '@ihui/shared/chat/${sub}'$`, 'm'),
  )
  const body = src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
  expect(body, `${rel} 包装里不应再声明东西`).not.toMatch(
    /export (async )?function|export interface|export type|const [A-Z_]+=/,
  )
}

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
      yield p.replace(/\\/g, '/')
    }
  }
}

describe('① web 原路径只剩包装', () => {
  it('workspace-tool-executor.ts', () => {
    wrapperOf('apps/web/src/lib/workspace-tool-executor.ts', 'workspace-tool-executor')
  })
  it('workspace-context-loader.ts', () => {
    wrapperOf('apps/web/src/lib/workspace-context-loader.ts', 'workspace-context-loader')
  })
})

describe('② 全仓只有一处实现声明', () => {
  const roots = [
    'apps/web/src',
    'apps/extension',
    'apps/miniapp-taro/src',
    'apps/mobile-rn/src',
    'packages/shared/src',
    'packages/app/src',
  ]
  it('function executeWorkspaceTool 恰好一次,且在共享层', () => {
    const hits: string[] = []
    for (const rel of roots) {
      const abs = join(ROOT, rel)
      if (!existsSync(abs)) continue // 该根在本档不存在(例如从裁剪过的检出跑),不参与计数
      for (const f of walk(abs)) {
        if (f.includes('/__tests__/') || f.includes('/tests/')) continue
        if (/\bfunction executeWorkspaceTool\b/.test(readFileSync(f, 'utf8'))) hits.push(f)
      }
    }
    // 0 命中不记绿:那说明扫描面没覆盖到实现(判据失明),与"确实只有一份"在账面上长得一样
    expect(hits.length, `实现声明应恰好 1 处,实到 ${hits.length}:${hits.join(', ')}`).toBe(1)
    expect(hits[0].replace(ROOT.replace(/\\/g, '/'), '')).toContain(
      'packages/shared/src/chat/workspace-tool-executor.ts',
    )
  })
})

describe('③ 共享层那份是真实现', () => {
  it('未知工具名回"不支持"而不是静默通过', async () => {
    // 只需要走到 switch 的 default 分支,因此一个空句柄就够(不碰任何 FS API)
    const fake = {} as FileSystemDirectoryHandle
    const r = await executeWorkspaceTool('no_such_tool', {}, fake)
    expect(r.error).toContain('不支持')
    expect(r.result).toBeNull()
  })

  it('read_file 缺 path 参数时报参数缺失(不是抛栈)', async () => {
    const r = await executeWorkspaceTool('read_file', {}, {} as FileSystemDirectoryHandle)
    expect(r.error).toContain('path 参数缺失')
  })
})

/**
 * ④ 跨端同一语义:两个请求目录句柄的端都必须请求 `readwrite`。
 *
 * 判据是"源码里那一次调用穿了什么档",不是运行时探测 —— 因为这条链的失败形态是安静的:
 * 读档句柄进了执行器,`write_file` 报错回传给模型,而用户已经看到一条流中 diff。
 * 两端各写各的档位正是 O81 要避免的那种分叉(一端能用、一端不能用)。
 */
describe('④ 两端 pick 都请求 readwrite(委托执行面需要写权)', () => {
  const sites: ReadonlyArray<[string, string]> = [
    [
      'apps/web/src/components/workspace/local-folder-picker.tsx',
      "showDirectoryPicker({ mode: 'readwrite' })",
    ],
    ['apps/extension/lib/workspace-store.ts', "mode: 'readwrite'"],
  ]
  for (const [rel, needle] of sites) {
    it(`${rel} 请求 readwrite`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      expect(src.replace(/\s+/g, ' '), rel).toContain(needle.replace(/\s+/g, ' '))
      // 反向锁:不得再退回只读档(那会把写类工具变成"发得出去、执行必失败")
      expect(src).not.toMatch(/showDirectoryPicker\(\{\s*mode:\s*'read'\s*\}\)/)
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
