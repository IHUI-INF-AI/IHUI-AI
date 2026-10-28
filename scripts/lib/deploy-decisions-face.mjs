// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deploy-decisions 台账面解析的唯一出口(2026-10-28 立)。
 *
 * 立因:反馈闭环(L28695 票)串账从未接上真数据 —— 部署环(nssm IHUI-DEPLOYLOOP)跑的是
 * 生产 checkout `<DevEnv>/ihui-prod`,它写的决策台账落在那一侧;而仓内 intake/status/retro/
 * auto-evolve 四处各自把 `join(ROOT,'.ihui-agent','deploy-decisions.jsonl')` 钉死在主仓 ——
 * 主仓那份是影子副本(实测:主仓 2 行 vs 生产 checkout 85 行、22 行金丝雀)。链子读的账里
 * 根本没有 canary-rollback 事件,于是「感知→部署→裁决」永远串不上,还被读成"链没跑过"。
 * 仓内既有先例同口径:`check-credential-health.mjs` 头注「线上此刻的两个 oracle 一律取生产
 * checkout 的根」、`check-ops-patrol.mjs` 解析 `<devEnvRoot>/ihui-prod` 部署环 —— 这是同一
 * 条「线上 oracle 面」纪律的又一次漏接,不再逐处手写第二份判据(§0.6)。
 *
 * 判据(纯函数,exists 可注入 ⇒ §22c 构造面可证):
 *   1. env IHUI_DEPLOY_DECISIONS_FACE 显式覆盖 ⇒ 直取(排障通道,仍要存在,不静默回落);
 *   2. 生产 checkout `<devEnvRoot(repoRoot)>/ihui-prod/.ihui-agent/deploy-decisions.jsonl` 在 ⇒ 用它;
 *   3. 回落主仓 `<repoRoot>/.ihui-agent/deploy-decisions.jsonl`;
 *   4. 两边都不在 ⇒ `{found:false}` —— 调用方必须落「未判定」点名两候选,不得拿不存在的面当空集(§0.3)。
 * 失效方向:误取主仓影子 = 链子静默读空;本器把 face 做成一等读数随结论打印,读错面可见。
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { devEnvRoot } from '../seal-c-root-stray.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// 本文件住在 `scripts/lib/`,仓库根要退两级(`scripts/lib` → `scripts` → `<repo>`)。
// 2026-10-30 实测:此前只退一级 ⇒ REPO 落在 `<repo>/scripts`,回落主仓候选恒为
// `<repo>/scripts/.ihui-agent/deploy-decisions.jsonl`,且 devEnvRoot(REPO) 跟着换根
// (`<repo>/scripts/.DevEnv` 不存在 ⇒ 退化到盘根 DevEnv)—— 两候选同时指错面。
// 同族先例:lib/halt-state.mjs 的 REPO_ROOT = join(HERE,'..','..')。
const REPO = join(HERE, '..', '..')
export const LEDGER_BASENAME = 'deploy-decisions.jsonl'

export function candidatesFor({ repoRoot = REPO, env = process.env } = {}) {
  const override = (env.IHUI_DEPLOY_DECISIONS_FACE || '').trim()
  if (override) return [{ kind: 'env', root: dirname(override), path: override }]
  let prodDir = null
  try {
    prodDir = join(devEnvRoot(repoRoot), 'ihui-prod')
  } catch {
    prodDir = null
  }
  const out = []
  if (prodDir) out.push({ kind: 'prod-checkout', root: prodDir, path: join(prodDir, '.ihui-agent', LEDGER_BASENAME) })
  out.push({ kind: 'repo', root: repoRoot, path: join(repoRoot, '.ihui-agent', LEDGER_BASENAME) })
  return out
}

export function chooseDeployDecisionsFace({ repoRoot = REPO, exists = existsSync, env = process.env } = {}) {
  const cands = candidatesFor({ repoRoot, env })
  for (const c of cands) {
    if (!exists(c.path)) continue
    return { found: true, kind: c.kind, path: c.path, root: c.kind === 'env' ? dirname(c.path) : c.root, candidates: cands }
  }
  return { found: false, kind: null, path: null, root: null, candidates: cands }
}

export function deployDecisionsFace(opts = {}) {
  return chooseDeployDecisionsFace({ ...opts, repoRoot: opts.repoRoot ?? REPO })
}

export const __test__ = {
  ROOT: REPO,
  LEDGER_BASENAME,
  candidatesFor,
  chooseDeployDecisionsFace,
  resolvePath,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const f = deployDecisionsFace()
  if (!f.found) {
    console.log(`DECISIONS-FACE found=false candidates=${f.candidates.map((c) => c.kind).join(',')} ⇒ 未判定(两候选都不在,不得当空集)`)
    process.exit(2)
  }
  console.log(`DECISIONS-FACE found=true kind=${f.kind} path=${f.path}`)
  process.exit(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
