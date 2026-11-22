// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file 守门 208 的「.DevEnv 边界哨兵」窄分流镜像测试(§22c:判据一律 import 源脚本 __test__)
 * @description 2026-11-05 立:`.DevEnv/.git` 是 scripts/lib/scratch-dir.mjs 的 G-158 坏 gitfile
 *   边界哨兵(内容 gitdir 指向**不存在**的 .no-git-boundary)。linked worktree 里跑测试时
 *   `mkScratch` 会把同一枚写进 `<worktree>/.DevEnv`,旧判据把它当嵌套仓 ⇒ 工作树一变多就恒红(§12e)。
 *   分流只认窄形态,以下四种对照必须仍然照旧命中(分流不是白名单):
 *     ① gitfile 目标**真实存在**;② 悬空 worktree gitfile(指向消失的 admin 面);
 *     ③ 读不到 / 无 gitdir 行 ⇒ 不豁免(§0.3);④ 顶层 `.DevEnv` 本来就在 SANCTIONED_LANDINGS 不扫描,
 *        真实形态只出现在更深的工作树容器里。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(HERE, '..', 'check-no-nested-git.mjs')
const { scanForNestedGit, isDevEnvBoundarySentinel } = (await import(pathToFileURL(SCRIPT_PATH).href))
  .__test__

test('⑰ .DevEnv 边界哨兵按窄形态分流;目标存在/悬空/无 gitdir 行一律照旧命中', () => {
  const scratch = mkScratch('g208-sentinel-')
  try {
    const root = join(scratch, 'repo')
    mkdirSync(root, { recursive: true })

    // 真实形态:哨兵出现在 worktree 容器内(顶层 .DevEnv 属 SANCTIONED_LANDINGS,不扫描)
    const wtDevEnv = join(root, '.ihui-agent', 'tmp', 'wt-x', '.DevEnv')
    mkdirSync(wtDevEnv, { recursive: true })
    writeFileSync(join(wtDevEnv, '.git'), `gitdir: ${join(wtDevEnv, '.no-git-boundary')}\n`)

    // 对照 A:目标真实存在 ⇒ 不是哨兵,照旧命中
    mkdirSync(join(root, 'not-sentinel'), { recursive: true })
    writeFileSync(join(root, 'not-sentinel', '.no-git-boundary'), '')
    writeFileSync(
      join(root, 'not-sentinel', '.git'),
      `gitdir: ${join(root, 'not-sentinel', '.no-git-boundary')}\n`
    )

    // 对照 B:悬空 worktree gitfile(目标不是 .no-git-boundary)⇒ 照旧命中
    mkdirSync(join(root, 'wt-gone'), { recursive: true })
    writeFileSync(
      join(root, 'wt-gone', '.git'),
      `gitdir: ${join(root, '.git', 'worktrees', 'gone')}\n`
    )

    const scan = scanForNestedGit(root)
    const relOf = (p) => p.replace(/\\/g, '/')
    assert.ok(
      !scan.hits.some((h) => relOf(h.rel).endsWith('.DevEnv/.git')),
      '边界哨兵被计成嵌套仓 ⇒ 每条工作树都会把全仓提交链堵死'
    )
    assert.equal(scan.boundarySentinels.length, 1, '哨兵必须被逐条记录,不许静默')
    assert.match(relOf(scan.boundarySentinels[0].rel), /\.DevEnv\/\.git$/)
    assert.equal(scan.hits.length, 2, '目标存在的 gitfile 与悬空 worktree gitfile 都必须照旧命中')
    assert.equal(
      isDevEnvBoundarySentinel(join(root, 'wt-gone', '.git')),
      false,
      '无 gitdir: 指向 .no-git-boundary 的形态必须判 false'
    )
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
