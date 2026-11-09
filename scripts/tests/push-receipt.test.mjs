// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 推送门凭据夹具。
 *
 * 五个必须判红的反证（用户硬要求）：
 *   ① 凭据伪造（换钥重签）
 *   ② 树不符（treeSha 与要推的 tree 不同）
 *   ③ 缺一门（签名有效但门集合缺项）
 *   ④ 签名坏（签名字节被改）
 *   ⑤ 门脚本被改（门脚本 blob 与凭据钉住的不一致）
 * 另有正例，以及「凭据不通过 ⇒ 钩子必须落到真跑门分支」的 sh 级回落证明。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  EXPECTED_GATES,
  PUSHED_TREE_POLICY,
  RECEIPT_TTL_MS,
  RECEIPT_VERSION,
  RUNNER_CLOSURE,
  RUNNER_VERSION,
  buildGateCacheKey,
  canonicalGate,
  judgeReceipt,
  sha256Hex,
  signReceipt,
  verifyPushReceipt,
} from '../lib/push-receipt.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const KEY = 'k'.repeat(48)
const ATTACKER_KEY = 'x'.repeat(48)

const HEAD = 'a'.repeat(40)
const TREE = 'b'.repeat(40)
const BASE = 'c'.repeat(40)

function blobOf(path) {
  return sha256Hex(`blob:${path}`)
}

function makeBlobs() {
  const blobs = {}
  for (const p of RUNNER_CLOSURE) blobs[p] = blobOf(p)
  for (const g of EXPECTED_GATES) blobs[`scripts/${g.script}`] = blobOf(`scripts/${g.script}`)
  return blobs
}

function makeContext(overrides = {}) {
  return {
    root: ROOT,
    headSha: HEAD,
    treeSha: TREE,
    originMainSha: BASE,
    nodeVersion: process.version,
    blobs: makeBlobs(),
    refs: { ok: true, refs: [{ localRef: 'refs/heads/x', localSha: HEAD, remoteRef: 'refs/heads/x', remoteSha: '0'.repeat(40) }] },
    ...overrides,
  }
}

function makeReceipt(ctx = makeContext(), { key = KEY, now = Date.now(), mutate = null } = {}) {
  const gateSet = EXPECTED_GATES.map((g) => {
    const scriptBlob = ctx.blobs[`scripts/${g.script}`]
    return canonicalGate({
      ...g,
      scriptBlob,
      cacheKey: buildGateCacheKey({
        treeSha: ctx.treeSha,
        id: g.id,
        runnerBlob: ctx.blobs['scripts/guardian-runner.mjs'],
        executorBlob: ctx.blobs['scripts/lib/guardian-executor.mjs'],
        scriptBlob,
        nodeVersion: ctx.nodeVersion,
      }),
      rc: 0,
      durationMs: 12,
    })
  })
  const receipt = {
    version: RECEIPT_VERSION,
    runnerVersion: RUNNER_VERSION,
    nodeVersion: ctx.nodeVersion,
    commitSha: ctx.headSha,
    treeSha: ctx.treeSha,
    remoteBase: ctx.originMainSha,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RECEIPT_TTL_MS).toISOString(),
    worktreeClean: true,
    pushedTreePolicy: PUSHED_TREE_POLICY,
    runnerClosure: RUNNER_CLOSURE.map((p) => ({ path: p, blob: ctx.blobs[p] })),
    gateSetHash: sha256Hex(JSON.stringify(gateSet)),
    gateSet,
  }
  if (mutate) mutate(receipt)
  receipt.signature = {
    alg: 'hmac-sha256',
    keyId: sha256Hex(key).slice(0, 16),
    sig: signReceipt(receipt, key),
  }
  return receipt
}

function judge(receipt, ctx = makeContext(), key = KEY, now = Date.now()) {
  return judgeReceipt({ receipt, context: ctx, key, now })
}

test('正例：合法凭据通过', () => {
  const r = judge(makeReceipt())
  assert.equal(r.ok, true, JSON.stringify(r))
})

test('反证①：凭据伪造（换钥重签）必须判红', () => {
  const receipt = makeReceipt(makeContext(), { key: ATTACKER_KEY })
  const r = judge(receipt, makeContext(), KEY)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'signature-invalid')
})

test('反证②：树不符必须判红', () => {
  const ctx = makeContext({ treeSha: 'd'.repeat(40) })
  const r = judge(makeReceipt(), ctx)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'tree-mismatch')
})

test('反证③：缺一门（签名有效）必须判红', () => {
  const receipt = makeReceipt(makeContext(), {
    mutate: (r) => {
      r.gateSet = r.gateSet.filter((g) => g.id !== 'T1')
      r.gateSetHash = sha256Hex(JSON.stringify(r.gateSet))
    },
  })
  const r = judge(receipt)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'gate-missing')
  assert.equal(r.detail, 'T1')
})

test('反证④：签名坏必须判红', () => {
  const receipt = makeReceipt()
  const sig = receipt.signature.sig
  receipt.signature.sig = (sig[0] === '0' ? '1' : '0') + sig.slice(1)
  const r = judge(receipt)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'signature-invalid')
})

test('反证⑤：门脚本被改（blob 不符）必须判红', () => {
  const ctx = makeContext()
  ctx.blobs['scripts/check-typecheck.mjs'] = blobOf('tampered')
  const r = judge(makeReceipt(), ctx)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'gate-script-blob-mismatch')
  assert.equal(r.detail, 'T1')
})

test('任一门 rc≠0（签名有效）必须判红', () => {
  const receipt = makeReceipt(makeContext(), {
    mutate: (r) => {
      const g = r.gateSet.find((x) => x.id === 'T1')
      g.rc = 1
      r.gateSetHash = sha256Hex(JSON.stringify(r.gateSet))
    },
  })
  const r = judge(receipt)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'gate-not-passed')
})

test('凭据过期 / 签发时间在未来必须判红', () => {
  const receipt = makeReceipt()
  assert.equal(judge(receipt, makeContext(), KEY, Date.now() + RECEIPT_TTL_MS + 60 * 1000).code, 'ttl-expired')
  assert.equal(judge(makeReceipt(), makeContext(), KEY, Date.now() - 10 * 60 * 1000).code, 'ttl-future')
})

test('远端基线漂移必须判红', () => {
  const ctx = makeContext({ originMainSha: 'e'.repeat(40) })
  assert.equal(judge(makeReceipt(), ctx).code, 'remote-base-mismatch')
})

test('runner/executor 闭包 blob 被改必须判红', () => {
  const ctx = makeContext()
  ctx.blobs['scripts/lib/guardian-executor.mjs'] = blobOf('tampered-executor')
  assert.equal(judge(makeReceipt(), ctx).code, 'runner-blob-mismatch')
})

test('门参数漂移 / 多一门必须判红', () => {
  const drifted = makeReceipt(makeContext(), {
    mutate: (r) => {
      r.gateSet.find((g) => g.id === '47p').args = []
      r.gateSetHash = sha256Hex(JSON.stringify(r.gateSet))
    },
  })
  assert.equal(judge(drifted).code, 'gate-args-drift')

  const extra = makeReceipt(makeContext(), {
    mutate: (r) => {
      r.gateSet.push({ ...r.gateSet[0], id: 'extra' })
      r.gateSetHash = sha256Hex(JSON.stringify(r.gateSet))
    },
  })
  assert.equal(judge(extra).code, 'gate-unknown')
})

test('推送引用不符合（标签/删除/指向非 HEAD）时回落', () => {
  const ctxBad = makeContext({ refs: { ok: false, code: 'refs-not-branch' } })
  assert.equal(judge(makeReceipt(), ctxBad).code, 'refs-not-branch')
})

test('镜像：EXPECTED_GATES 与 guardian-runner pushGateChecks 逐项一致', () => {
  const src = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const start = src.indexOf('const pushGateChecks = [')
  assert.ok(start > 0, '未找到 pushGateChecks 注册表')
  const end = src.indexOf('\n]\n', start)
  const block = src.slice(start, end)
  // 注意：47p 条目在 `{` 与 `id:` 之间夹了注释行，故不能要求 id 紧跟左花括号。
  // 用「行首 4 空格」锚定字段，避免把 onFailHint / stagedTriggers 里的字样当成字段。
  const entryRe =
    /\n {4}id:\s*(?:'([^']+)'|(\d+)),[\s\S]*?\n {4}script:\s*'([^']+)',[\s\S]*?\n {4}args:\s*\[([^\]]*)\],[\s\S]*?\n {4}mode:\s*'([^']+)'/g
  const rows = []
  for (const m of block.matchAll(entryRe)) {
    const args = m[4]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^'|'$/g, ''))
    rows.push({ id: m[1] || m[2], script: m[3], args, mode: m[5] })
  }
  assert.equal(rows.length, 14, `注册表解析到 ${rows.length} 条`)
  const expected = EXPECTED_GATES.filter((g) => g.id !== '173p' && g.id !== 'i18n')
  assert.equal(expected.length, 14)
  for (const [i, exp] of expected.entries()) {
    assert.deepEqual(rows[i], { id: exp.id, script: exp.script, args: exp.args, mode: exp.mode })
  }
})

fixtureFallbackProof()

/**
 * 回落证明：从 .husky/pre-push 逐字抽取凭据块，在 sh 里用桩 wscript 跑两次——
 * rc=0 ⇒ 块内 exit 0（哨兵不打印）；rc≠0 ⇒ 落到块后的真跑门分支（哨兵打印）。
 * 这证明「凭据判红 ⇒ 一定会执行到门命令」，而不是直接通过。
 */
function fixtureFallbackProof() {
  test('钩子回落：凭据不通过时一定落到真跑门分支', () => {
    const hook = readFileSync(join(ROOT, '.husky/pre-push'), 'utf8')
    const begin = hook.indexOf('# >>> push-receipt-gate (begin)')
    const end = hook.indexOf('# <<< push-receipt-gate (end)')
    assert.ok(begin > 0 && end > begin, '未找到凭据块标记')
    const block = hook.slice(begin, end)

    // 真跑门命令经 hook-run-hidden.vbs 包装，以 runner 脚本名为锚即可。
    const gateLine = 'scripts/guardian-runner.mjs --push-gate'
    const gateAt = hook.indexOf(gateLine)
    assert.ok(gateAt > end, '真跑门命令必须位于凭据块之后（回落路径原样保留）')
    assert.ok(
      block.includes('if [ "$_receipt_rc" -eq 0 ]') && block.includes('exit 0'),
      '凭据块必须以 rc==0 为唯一放行条件',
    )

    const sh = findSh()
    if (!sh) {
      // 环境无 POSIX sh 时不能伪造通过：显式跳过并留下依据。
      assert.ok(true, 'no sh')
      return
    }

    const dir = mkdtempSync(join(tmpdir(), 'push-receipt-fallback-'))
    try {
      const script = [
        'wscript() { return "$FAKE_RC"; }',
        block,
        'printf "FALLBACK_REACHED\\n"',
      ].join('\n')
      const file = join(dir, 'probe.sh')
      writeFileSync(file, script, 'utf8')
      chmodSync(file, 0o755)

      const okRun = spawnSync(sh, [file], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, FAKE_RC: '0', PUSH_REFS: 'refs/heads/x deadbeef refs/heads/x 0000' },
      })
      assert.equal(okRun.status, 0)
      assert.ok(!String(okRun.stdout).includes('FALLBACK_REACHED'), '凭据通过时不得走回落')

      const badRun = spawnSync(sh, [file], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, FAKE_RC: '1', PUSH_REFS: 'refs/heads/x deadbeef refs/heads/x 0000' },
      })
      assert.equal(badRun.status, 0)
      assert.ok(String(badRun.stdout).includes('FALLBACK_REACHED'), '凭据不通过时必须落到真跑门分支')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

function findSh() {
  for (const candidate of ['sh', 'bash']) {
    const r = spawnSync(candidate, ['-c', 'exit 0'], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true })
    if (r.status === 0) return candidate
  }
  const r = spawnSync('git', ['--exec-path'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
  if (r.status === 0) {
    const base = join(String(r.stdout).trim(), '..', '..', '..', 'usr', 'bin', process.platform === 'win32' ? 'sh.exe' : 'sh')
    const probe = spawnSync(base, ['-c', 'exit 0'], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true })
    if (probe.status === 0) return base
  }
  return null
}

test('verifyPushReceipt 在无凭据时必须返回失败（fail-closed 入口）', () => {
  const envKey = process.env.IHUI_PUSH_RECEIPT_KEY
  delete process.env.IHUI_PUSH_RECEIPT_KEY
  try {
    const r = verifyPushReceipt(ROOT, { wait: false })
    assert.equal(r.ok, false)
    assert.ok(
      ['key-unavailable', 'refs-empty', 'refs-parse', 'context-gather-failed', 'receipt-missing'].includes(r.code),
      `unexpected code ${r.code}`,
    )
  } finally {
    if (envKey !== undefined) process.env.IHUI_PUSH_RECEIPT_KEY = envKey
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
