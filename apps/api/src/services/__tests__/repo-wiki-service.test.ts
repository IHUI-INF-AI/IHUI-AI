// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * repo-wiki-service 单元测试
 *
 * 覆盖预算分组纯函数 budgetRepoFiles 的核心场景:
 * 1. 按路径首段分组出顶层模块
 * 2. 每模块最多保留 8 个文件(且保留内容最长的)
 * 3. 单文件截断 8KB
 * 4. 全请求总量 120KB 预算截断(超预算模块整体跳过)
 * 5. 根目录文件归入 '(root)' 模块
 * 6. 结果按模块采样体积降序
 * 7. 空输入
 *
 * 另覆盖 generateRepoWiki 主流程(LLM 调用函数注入 mock,不真网):
 * 8. 正常生成(overview + 模块文档)
 * 9. 逐模块失败不阻断 overview(失败模块记入 skippedModules)
 * 10. 预算分组为空时 throw
 */

import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// mock 落库依赖(repoWikiDocs 导出由主控集成后可用;测试不真连 DB)
vi.mock('@ihui/database', () => ({
  repoWikiDocs: { id: 'id', kind: 'kind', title: 'title', modulePath: 'modulePath' },
}))
vi.mock('../../db/index.js', () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: async () => [],
      }),
    }),
  },
}))
vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: async () =>
    new Response(JSON.stringify({ content: '', stub: true }), { status: 200 }),
}))
vi.mock('../clawdbot/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}))

const { budgetRepoFiles, generateRepoWiki, extractImportEdges, renderDependencyGraph } =
  await import('../repo-wiki-service.js')

function file(path: string, sizeChars: number): { path: string; content: string } {
  return { path, content: 'x'.repeat(sizeChars) }
}

describe('budgetRepoFiles — 预算分组', () => {
  it('按路径首段分组出顶层模块', () => {
    const result = budgetRepoFiles([
      file('apps/api/src/server.ts', 100),
      file('apps/api/src/routes/a.ts', 100),
      file('apps/web/app/page.tsx', 100),
      file('packages/database/src/index.ts', 100),
    ])
    const names = result.modules.map((m) => m.name).sort()
    expect(names).toEqual(['apps', 'packages'])
    expect(result.skippedModules).toEqual([])
    expect(result.fileCount).toBe(4)
  })

  it('每模块最多保留 8 个文件', () => {
    const files = Array.from({ length: 11 }, (_, i) => file(`src/f${i}.ts`, 10))
    const result = budgetRepoFiles(files)
    expect(result.modules).toHaveLength(1)
    expect(result.modules[0]?.files).toHaveLength(8)
    expect(result.fileCount).toBe(8)
  })

  it('每模块保留内容最长的 8 个文件', () => {
    // 9 个文件,最短的是 f0(10 字符),应被淘汰;f8(90 字符)保留
    const files = [file('src/f0.ts', 10)].concat(
      Array.from({ length: 8 }, (_, i) => file(`src/f${i + 1}.ts`, (i + 2) * 10)),
    )
    const result = budgetRepoFiles(files)
    expect(result.modules[0]?.files).toHaveLength(8)
    const paths = result.modules[0]?.files.map((f) => f.path) ?? []
    expect(paths).not.toContain('src/f0.ts')
    expect(paths).toContain('src/f8.ts')
  })

  it('单文件内容截断 8KB', () => {
    const big = file('src/big.ts', 10 * 1024)
    const result = budgetRepoFiles([big])
    expect(result.modules[0]?.files[0]?.content).toHaveLength(8 * 1024)
  })

  it('总量超 120KB 预算:超预算模块整体跳过,预算内模块不受影响', () => {
    // 模块 a:8 文件 × 8KB = 64KB(预算内);模块 b:同样 64KB,装入后 128KB 超预算 → b 跳过
    const files = [
      ...Array.from({ length: 8 }, (_, i) => file(`a/f${i}.ts`, 8 * 1024)),
      ...Array.from({ length: 8 }, (_, i) => file(`b/f${i}.ts`, 8 * 1024)),
    ]
    const result = budgetRepoFiles(files)
    expect(result.modules.map((m) => m.name)).toEqual(['a'])
    expect(result.skippedModules).toEqual(['b'])
    // 预算内总量不超过 ~120KB
    const keptTotal = result.modules.reduce((sum, m) => sum + m.totalChars, 0)
    expect(keptTotal).toBeLessThanOrEqual(120 * 1024)
  })

  it('根目录文件(无路径分隔符)归入 (root) 模块', () => {
    const result = budgetRepoFiles([
      file('package.json', 50),
      file('README.md', 50),
      file('src/index.ts', 50),
    ])
    const names = result.modules.map((m) => m.name).sort()
    expect(names).toEqual(['(root)', 'src'])
  })

  it('结果按模块采样体积降序排列', () => {
    const result = budgetRepoFiles([
      file('small/a.ts', 10),
      file('big/a.ts', 5000),
      file('mid/a.ts', 1000),
    ])
    const sizes = result.modules.map((m) => m.totalChars)
    expect(sizes).toEqual([...sizes].sort((x, y) => y - x))
  })

  it('空输入返回空结果', () => {
    const result = budgetRepoFiles([])
    expect(result.modules).toEqual([])
    expect(result.skippedModules).toEqual([])
    expect(result.fileCount).toBe(0)
  })
})

describe('generateRepoWiki — 主流程(LLM mock 注入)', () => {
  const okCaller = async () => ({ content: '# 文档\n\n正文', model: 'test-model' })

  it('正常生成:overview 成功,不抛错', async () => {
    const result = await generateRepoWiki(
      { userId: 'u1', repoName: 'demo', files: [file('src/index.ts', 100)] },
      { callLlm: okCaller },
    )
    expect(result.docs).toEqual([])
    expect(result.skippedModules).toEqual([])
  })

  it('逐模块失败不阻断 overview,失败模块记入 skippedModules', async () => {
    let callCount = 0
    const failingModuleCaller = async () => {
      callCount++
      if (callCount > 1) throw new Error('module llm down') // 第 1 次 = overview 成功,后续模块失败
      return { content: '# 总览', model: 'test-model' }
    }
    const result = await generateRepoWiki(
      { userId: null, repoName: 'demo', files: [file('src/a.ts', 100), file('lib/b.ts', 100)] },
      { callLlm: failingModuleCaller },
    )
    expect(result.skippedModules).toContain('src')
    expect(result.skippedModules).toContain('lib')
  })

  it('预算分组为空(无文件)时 throw', async () => {
    await expect(
      generateRepoWiki({ userId: null, repoName: 'demo', files: [] }, { callLlm: okCaller }),
    ).rejects.toThrow()
  })
})

describe('extractImportEdges — 模块依赖图静态解析', () => {
  it('TS 相对导入跨模块成边(含 .. 归一化与补扩展名)', () => {
    const edges = extractImportEdges([
      { path: 'apps/api/src/a.ts', content: "import { util } from '../../../web/util'\n" },
      { path: 'web/util.ts', content: 'export const util = 1\n' },
    ])
    expect(edges).toEqual([{ from: 'apps', to: 'web', count: 1 }])
  })

  it('JS require 相对导入成边(可命中 /index.*)', () => {
    const edges = extractImportEdges([
      { path: 'apps/api/server.js', content: "const u = require('./utils')\n" },
      { path: 'apps/api/utils/index.js', content: 'module.exports = {}\n' },
    ])
    // 同属 apps 模块 → 自环被丢弃
    expect(edges).toEqual([])
    const cross = extractImportEdges([
      { path: 'apps/api/server.js', content: "const u = require('../../shared/utils')\n" },
      { path: 'shared/utils/index.js', content: 'module.exports = {}\n' },
    ])
    expect(cross).toEqual([{ from: 'apps', to: 'shared', count: 1 }])
  })

  it('Python from x import y / import x 成边', () => {
    const edges = extractImportEdges([
      { path: 'services/a.py', content: 'from utils.b import thing\nimport utils.helpers\n' },
      { path: 'utils/b.py', content: 'x = 1\n' },
      { path: 'utils/helpers.py', content: 'y = 2\n' },
    ])
    expect(edges).toEqual([{ from: 'services', to: 'utils', count: 2 }])
  })

  it('第三方包(react / @ihui/xxx)被跳过', () => {
    const edges = extractImportEdges([
      {
        path: 'apps/web/app/page.tsx',
        content: "import React from 'react'\nimport { db } from '@ihui/database'\n",
      },
    ])
    expect(edges).toEqual([])
  })

  it('自环(from===to)被丢弃', () => {
    const edges = extractImportEdges([
      { path: 'src/a.ts', content: "import { b } from './b'\n" },
      { path: 'src/b.ts', content: 'export const b = 1\n' },
    ])
    expect(edges).toEqual([])
  })

  it('聚合与排序确定性(count 降序 → from 升序 → to 升序)', () => {
    const files = [
      {
        path: 'a/one.ts',
        content: "import { t } from '../b/two'\nimport { h } from '../c/three'\n",
      },
      { path: 'a/two.ts', content: "import { o } from '../b/other'\n" },
      { path: 'b/one.ts', content: "import { o } from '../c/other'\n" },
      { path: 'b/two.ts', content: "import { t } from '../c/three'\n" },
      { path: 'b/other.ts', content: '' },
      { path: 'c/three.ts', content: '' },
      { path: 'c/other.ts', content: '' },
    ]
    const expected = [
      { from: 'a', to: 'b', count: 2 },
      { from: 'b', to: 'c', count: 2 },
      { from: 'a', to: 'c', count: 1 },
    ]
    const first = extractImportEdges(files)
    const second = extractImportEdges(files)
    expect(first).toEqual(expected)
    expect(second).toEqual(first)
  })

  it('空数组返回 []', () => {
    expect(extractImportEdges([])).toEqual([])
  })
})

describe('renderDependencyGraph — 依赖图渲染', () => {
  it('空数组返回空字符串', () => {
    expect(renderDependencyGraph([])).toBe('')
  })

  it('非空时含标题/说明/mermaid 代码块/表头', () => {
    const out = renderDependencyGraph([{ from: 'apps', to: 'packages', count: 3 }])
    expect(out).toContain('## 模块依赖图')
    expect(out).toContain('```mermaid')
    expect(out).toContain('graph LR')
    expect(out).toContain('| 模块 | 依赖 | 引用数 |')
    expect(out).toContain('apps["apps"] --> packages["packages"]')
    expect(out).toContain('| apps | packages | 3 |')
  })

  it('模块名含特殊字符时 mermaid 节点加双引号包裹', () => {
    const out = renderDependencyGraph([{ from: '(root)', to: 'apps', count: 1 }])
    expect(out).toContain('"(root)"["(root)"]')
    expect(out).toContain('apps["apps"]')
  })

  it('超过 60 条时只渲染前 60 条并追加说明', () => {
    const edges = Array.from({ length: 61 }, (_, i) => ({
      from: `m${String(i).padStart(3, '0')}`,
      to: 'target',
      count: 1,
    }))
    const out = renderDependencyGraph(edges)
    expect(out).toContain('（仅显示引用数最高的 60 条）')
    const tableRows = out.split('\n').filter((l) => l.startsWith('| m'))
    expect(tableRows).toHaveLength(60)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
