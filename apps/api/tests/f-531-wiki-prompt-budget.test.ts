// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-531 回归锁(2026-11-13)。
 *
 * 病灶:repo-wiki 的提示词预算只算正文(budgetRepoFiles),文件清单(路径列表)
 * 另起 MAX_TREE_LINES=500 拼接,而文件数上限仅 400 ⇒ 该截断等于不生效。
 * 400 条 ≤500 字符的路径可再叠 ~200KB,注释所称 ~120KB 实际被撑到 ~320KB。
 *
 * 本文件锁:
 *   ① 超大文件清单 + 正文:最终 prompt 字节数 ≤ REPO_WIKI_MAX_PROMPT_BYTES;
 *   ② 清单被截断并标注省略数(正文/关键文件优先保留);
 *   ③ 上限可注入:更小的 maxBytes 同样不被突破。
 *
 * 只调用纯函数(预算/组装),不连真实仓、不发网络请求。
 */
import { describe, it, expect } from 'vitest'
import {
  REPO_WIKI_MAX_PROMPT_BYTES,
  budgetRepoFiles,
  buildOverviewUserContent,
  type RepoWikiFile,
} from '../src/services/repo-wiki-service.js'

const bytes = (text: string): number => Buffer.byteLength(text, 'utf8')

/** 构造 400 个长路径文件(路径 500 字符,贴近路由 schema 上限) */
function hugeRepo(): RepoWikiFile[] {
  return Array.from({ length: 400 }, (_, i) => {
    const moduleName = i % 2 === 0 ? 'apps' : 'packages'
    const dir = `${moduleName}/pkg-${String(Math.floor(i / 2)).padStart(3, '0')}`
    const path = `${dir}/${'nested/'.repeat(40)}file-${i}.ts`.slice(0, 500)
    return { path, content: `export const v${i} = ${i}\n`.repeat(8) }
  })
}

/** 取出 prompt 中「文件清单」段的各行(含截断提示行) */
function listedPaths(prompt: string): string[] {
  const section = prompt.split('## 文件清单(目录结构)\n')[1]?.split('\n\n## 各模块抽样文件内容')[0]
  return section ? section.split('\n').filter((line) => line.length > 0) : []
}

describe('F-531 repo-wiki prompt 预算(清单计入总量)', () => {
  it('① 400 个长路径文件:最终 prompt 字节数不超过导出上限', () => {
    const files = hugeRepo()
    const budget = budgetRepoFiles(files)
    const prompt = buildOverviewUserContent('huge-repo', files, budget)
    expect(bytes(prompt)).toBeLessThanOrEqual(REPO_WIKI_MAX_PROMPT_BYTES)
    // 旧实现:正文 ~2KB + 清单 ~200KB ≈ 200KB,必然超过 120KB 上限
    expect(bytes(prompt)).toBeGreaterThan(64 * 1024)
  })

  it('② 清单被截断并标注省略数,正文/关键文件优先保留', () => {
    const files = hugeRepo()
    const budget = budgetRepoFiles(files)
    const prompt = buildOverviewUserContent('huge-repo', files, budget)
    expect(prompt).toContain('## 各模块抽样文件内容')
    expect(prompt).toContain('#### ')
    expect(prompt).toMatch(/文件清单已截断，省略 \d+ 个文件/)
    expect(listedPaths(prompt).length).toBeLessThan(files.length)
  })

  it('③ 上限可注入:更小的 maxBytes 同样不被突破', () => {
    const files = hugeRepo().slice(0, 20)
    const budget = budgetRepoFiles(files)
    const limit = 4 * 1024
    const prompt = buildOverviewUserContent('tiny-budget', files, budget, limit)
    expect(bytes(prompt)).toBeLessThanOrEqual(limit)
    expect(prompt).toContain('## 各模块抽样文件内容')
  })
})
