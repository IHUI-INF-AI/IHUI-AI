#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一键跑评测：`pnpm --dir benchmarks/agent-capability eval`
 *
 * 行为：
 *  - 用仓库内的 vitest（不联网拉依赖）执行固定任务集；
 *  - 运行期只允许访问 `http://eval-replay.local/v1`（录制回放），任何真实模型接口都会被拒；
 *  - 默认与 `baseline/baseline.json` 机械比较：退化 → 退出码 1；口径变化 → 2（需刷新基线）；
 *    `--update-baseline` 重新冻结基线（必须随代码一起评审，禁止手改 JSON）。
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
// vitest 在本仓库里由 apps/cli 直接依赖（pnpm 不提升到根 node_modules），因此按候选路径查找
const VITEST_CANDIDATES = [
  path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'),
  path.join(repoRoot, 'apps', 'cli', 'node_modules', 'vitest', 'vitest.mjs'),
  path.join(here, 'node_modules', 'vitest', 'vitest.mjs'),
]
const vitestEntry = VITEST_CANDIDATES.find((candidate) => fs.existsSync(candidate))

if (!vitestEntry) {
  console.error(
    `[eval] 找不到 vitest，已查找：\n  ${VITEST_CANDIDATES.join('\n  ')}\n请先在仓库根执行 pnpm install`,
  )
  process.exit(2)
}

const updateBaseline = process.argv.includes('--update-baseline')
const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true })
const commit = (commitResult.stdout ?? '').trim() || 'unknown'

const currentPath = path.join(here, 'results', 'current.json')
const comparisonPath = path.join(here, 'results', 'comparison.json')
// 先清旧结论：这次跑崩在比较之前时，不能让上一轮的 comparison.json 参与判读
fs.rmSync(comparisonPath, { force: true })

const run = spawnSync(
  process.execPath,
  [vitestEntry, 'run', '--config', path.join(here, 'vitest.config.ts')],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      IHUI_EVAL_COMMIT: commit,
      IHUI_EVAL_UPDATE_BASELINE: updateBaseline ? '1' : '0',
    },
  },
)
const status = run.status ?? 1

// 退出码契约（CI 只认这三个数）：
//   0 = unchanged / improved   —— 无退化
//   1 = regressed              —— vitest 断言失败（用例退步 / 指标变差 / 用例消失）
//   2 = changed                —— 口径变化（夹具、证据指纹、exact 指标或新增用例），
//                                需人工确认后执行 --update-baseline；也可用于「找不到 vitest」
let exitCode = status
if (status === 0 && !updateBaseline && fs.existsSync(comparisonPath)) {
  const comparison = JSON.parse(fs.readFileSync(comparisonPath, 'utf8'))
  if (comparison.status === 'changed') {
    console.error(
      '\n[eval] 口径变化（changed）：本次结果与基线不同，需人工确认后执行 `node run.mjs --update-baseline` 刷新基线',
    )
    exitCode = 2
  }
}

if (fs.existsSync(currentPath)) {
  const snapshot = JSON.parse(fs.readFileSync(currentPath, 'utf8'))
  const cases = snapshot.cases ?? []
  const failed = cases.filter((item) => !item.passed)
  const digest = createHash('sha256').update(fs.readFileSync(currentPath)).digest('hex')
  console.log(
    `\n[eval] 提交 ${commit} · 夹具 ${String(snapshot.fixtureHash).slice(0, 12)} · 用例 ${cases.length}（失败 ${failed.length}）`,
  )
  for (const item of cases) console.log(`  ${item.passed ? 'PASS' : 'FAIL'}  ${item.id}`)
  // 可复现性证据：同一份代码重复运行，这枚 sha256 必须不变
  console.log(`[eval] 快照 sha256 ${digest}`)
  if (updateBaseline && status === 0)
    console.log('[eval] 基线已更新：benchmarks/agent-capability/baseline/baseline.json')
  console.log('[eval] 快照：benchmarks/agent-capability/results/current.json（不入库）')
}

process.exit(exitCode)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
