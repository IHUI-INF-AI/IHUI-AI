// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/git-lock-lease-token.test.mjs —— G-397 的验收实验(票面点名缺的那一步)
 *
 * 票面原话:"真要收它,判据应是『注入一次 leaseId 不相等的迟到 finish 请求,
 * 控制文件必须不被改动』,而不是『代码写了 leaseId』。"
 * 我方锁(git-lock)与上游 synchronizer 同构:release 三档 = 身份 / 租约凭据 / unitId 兼容。
 * "leaseId 不相等的迟到 finish" 的忠实模型 = **异进程迟到者**:
 *   meta.pid 非本进程(身份档不适用) + caller token ≠ 锁内 leaseToken(凭据档拒)
 *   + unitId 不等或不带(兼容档拒) ⇒ 三档皆不成立,控制文件逐字节不动。
 * 阳性对照:持有者同进程(memo 凭据)release 必须成功——证明上面拒的是"迟到者"而不是所有释放。
 * 判据全走 __test__ 源实现(§22c);夹具落 mkScratch(§15b),不碰真实锁目录。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gl } from '../git-lock.mjs'

function fixture(t, name) {
  const scratch = mkScratch(`git-lock-lease-token-${name}`)
  t.after(() => rmScratch(scratch))
  return join(scratch, 'ihui-git-write.lock')
}

const snap = (dir) => ({
  dirExists: existsSync(dir),
  metaBytes: existsSync(join(dir, 'meta.json')) ? statSync(join(dir, 'meta.json')).size : -1,
  metaMtimeMs: existsSync(join(dir, 'meta.json')) ? statSync(join(dir, 'meta.json')).mtimeMs : -1,
  content: existsSync(join(dir, 'meta.json')) ? readFileSync(join(dir, 'meta.json'), 'utf8') : null,
})

// 用一次性子进程真写一把带 leaseToken 的锁(忠实"别的进程持有"形态:pid≠本进程)。
function fileUrl(p) {
  return 'file:///' + resolve(p).replace(/\\/g, '/')
}
function acquireInSubprocess(dir, unitId) {
  const code = [
    'const mod = await import(' + JSON.stringify(fileUrl('scripts/git-lock.mjs')) + ')',
    `const r = await mod.__test__.acquire({ unitId: ${JSON.stringify(unitId)}, dir: ${JSON.stringify(dir)}, timeoutMs: 3000 })`,
    'process.stdout.write(JSON.stringify({ ok: r === true }))',
  ].join('\n')
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    cwd: resolve('.'),
    timeout: 60_000,
  })
  const parsed = JSON.parse(out.slice(out.lastIndexOf('{')))
  assert.equal(parsed.ok, true, '子进程 acquire 失败 ⇒ 前提不成立')
  // 跨平台"别的 pid 还活着"——子进程退出后 pid 不可保证存活;meta.pid 不等本进程即令身份档"不适用",
  // 这正是要验的那一档失效方向(不适用 ≠ 放行)。
}

test('G-397 ②③:异进程持有 + leaseId 不相等的迟到 finish ⇒ 拒绝且控制文件逐字节不动', async (t) => {
  const dir = fixture(t, 'late-mismatch')
  acquireInSubprocess(dir, 'holder-397')
  const meta = JSON.parse(snap(dir).content)
  assert.ok(typeof meta.leaseToken === 'string' && meta.leaseToken.length >= 8, `G-397 格必须落盘:meta.leaseToken=${JSON.stringify(meta.leaseToken)}`)
  assert.notEqual(meta.pid, process.pid, '夹具前提:锁 pid 必须是"别的进程"')

  const before = snap(dir)
  // 迟到者 A:换 unitId 且带不相等 token ⇒ 三档皆拒
  const lateA = gl.release({ unitId: 'late-comer-x', dir, token: 'not-my-lease-token-000000' })
  assert.equal(lateA.released, false, `不相等凭据竟然放行: ${JSON.stringify(lateA)}`)
  // 迟到者 B:不传 unitId 与 token ⇒ 仍拒(空串不得走后门)
  const lateB = gl.release({ dir })
  assert.equal(lateB.released, false, `裸 release 竟然放行: ${JSON.stringify(lateB)}`)
  assert.deepEqual(snap(dir), before, '迟到 release 动了控制文件(目录/字节/mtime 任一)')
})

test('G-397 ④ 阳性对照:持有者同进程 acquire⇒release 必须成功(证明上臂拒的是迟到者)', async (t) => {
  const dir = fixture(t, 'owner-release')
  const res = await gl.acquire({ unitId: 'holder-397-self', dir, timeoutMs: 3000 })
  assert.equal(res, true, '本进程 acquire 应成功')
  const m = JSON.parse(snap(dir).content)
  assert.equal(m.pid, process.pid)
  const out = gl.release({ unitId: 'holder-397-self', dir })
  assert.equal(out.released, true, `持有者自释被拒: ${JSON.stringify(out)}`)
  assert.equal(existsSync(dir), false, 'release 成功后锁目录应消失')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
