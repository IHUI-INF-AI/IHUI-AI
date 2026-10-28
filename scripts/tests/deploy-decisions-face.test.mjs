// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deploy-decisions-face 的仓库根推导锁(2026-10-30 立)。
 *
 * 咬住的 bug:`scripts/lib/` 里的模块此前用 `join(HERE,'..')` 推导 REPO ⇒ 落到 `<repo>/scripts`,
 * 「回落主仓」候选恒为 `<repo>/scripts/.ihui-agent/deploy-decisions.jsonl`(根本不存在),
 * 生产候选也跟着 `devEnvRoot(<repo>/scripts)` 换根 —— 两候选同时指错面,消费者永远读到「未判定」。
 * 本测试不从模块里取 ROOT 再自洽比较(那样两边一起错也绿),而是用**本文件自身位置**反推仓库根:
 * `scripts/tests/x.test.mjs` 退两级 = 仓库根,与模块推导互为独立正面。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as face, LEDGER_BASENAME, candidatesFor, chooseDeployDecisionsFace } from '../lib/deploy-decisions-face.mjs'
import { devEnvRoot } from '../seal-c-root-stray.mjs'

// 独立正源:测试文件在 `<repo>/scripts/tests/` ⇒ 退两级就是仓库根,不硬编码盘符/绝对路径。
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPO_LEDGER = join(REPO_ROOT, '.ihui-agent', LEDGER_BASENAME)

/** 生产 checkout 根的期望值;若本机落在 scratch 夹具里 devEnvRoot 会拒绝推导(照实报,不猜)。 */
function expectedProdRoot() {
  try {
    return join(devEnvRoot(REPO_ROOT), 'ihui-prod')
  } catch {
    return null
  }
}

const repoCandidate = (cands) => cands.find((c) => c.kind === 'repo')

describe('deploy-decisions-face 仓库根推导', () => {
  it('ROOT = 仓库根(不是 <repo>/scripts)', () => {
    assert.equal(resolve(face.ROOT), REPO_ROOT)
    assert.notEqual(resolve(face.ROOT), resolve(join(REPO_ROOT, 'scripts')), '少退一级时 ROOT 恰好是 <repo>/scripts')
  })

  it('默认候选的「主仓」条父目录 = 仓库根下的 .ihui-agent', () => {
    const c = repoCandidate(candidatesFor({ env: {} }))
    assert.ok(c, '默认候选里必须有 kind=repo 这一条')
    assert.equal(resolve(dirname(c.path)), resolve(join(REPO_ROOT, '.ihui-agent')))
    assert.equal(resolve(c.path), resolve(REPO_LEDGER))
    assert.equal(resolve(c.root), REPO_ROOT, '该候选的 root 必须是仓库根本身')
    assert.equal(basename(c.path), LEDGER_BASENAME)
    assert.equal(resolve(c.path).startsWith(resolve(join(REPO_ROOT, 'scripts')) + sep), false, '主仓候选不得落在 <repo>/scripts 下')
  })

  it('生产候选 = devEnvRoot(仓库根)/ihui-prod(入参不是 <repo>/scripts)', () => {
    const prod = expectedProdRoot()
    const cands = candidatesFor({ env: {} })
    const got = cands.find((c) => c.kind === 'prod-checkout')
    if (prod === null) {
      assert.equal(got, undefined, 'devEnvRoot 拒绝推导时不得伪造生产候选')
      return
    }
    assert.ok(got, 'devEnvRoot 可推导时必须给出生产候选')
    assert.equal(resolve(got.root), resolve(prod))
  })

  it('候选结构不变式 + 顺序不变(生产优先,主仓殿后)', () => {
    const cands = candidatesFor({ env: {} })
    for (const c of cands) {
      assert.equal(resolve(dirname(c.path)), resolve(join(c.root, '.ihui-agent')), `候选 ${c.kind} 的路径必须落在其 root/.ihui-agent 下`)
      assert.equal(basename(c.path), LEDGER_BASENAME)
    }
    const kinds = cands.map((c) => c.kind)
    assert.deepEqual(kinds, expectedProdRoot() === null ? ['repo'] : ['prod-checkout', 'repo'])
  })

  it('选面纯函数:只有主仓账本在 ⇒ kind=repo 且 root=仓库根', () => {
    const f = chooseDeployDecisionsFace({ exists: (p) => resolve(p) === resolve(REPO_LEDGER), env: {} })
    assert.equal(f.found, true)
    assert.equal(f.kind, 'repo')
    assert.equal(resolve(f.path), resolve(REPO_LEDGER))
    assert.equal(resolve(f.root), REPO_ROOT)
  })

  it('选面纯函数:两本都在 ⇒ 仍选生产(候选顺序未被改动)', () => {
    const prod = expectedProdRoot()
    if (prod === null) return
    const prodLedger = join(prod, '.ihui-agent', LEDGER_BASENAME)
    const f = chooseDeployDecisionsFace({ exists: (p) => [resolve(prodLedger), resolve(REPO_LEDGER)].includes(resolve(p)), env: {} })
    assert.equal(f.kind, 'prod-checkout')
    assert.equal(resolve(f.path), resolve(prodLedger))
  })

  it('三态语义:两本都不在 ⇒ found=false 且点名两候选(调用方落未判定,不得当空集)', () => {
    const f = chooseDeployDecisionsFace({ exists: () => false, env: {} })
    assert.equal(f.found, false)
    assert.equal(f.path, null)
    assert.equal(f.root, null)
    assert.ok(f.candidates.length >= 1)
    assert.equal(resolve(repoCandidate(f.candidates).path), resolve(REPO_LEDGER))
  })

  it('env 覆盖仍优先且单候选(排障通道未被本次修复动到)', () => {
    const override = join(REPO_ROOT, '.ihui-agent', 'tmp', 'canary.jsonl')
    const cands = candidatesFor({ env: { IHUI_DEPLOY_DECISIONS_FACE: override } })
    assert.equal(cands.length, 1)
    assert.equal(cands[0].kind, 'env')
    assert.equal(resolve(cands[0].path), resolve(override))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
