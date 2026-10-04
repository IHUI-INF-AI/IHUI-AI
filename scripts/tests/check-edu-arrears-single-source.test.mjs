// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 `check-edu-arrears-single-source.mjs` 的 §22c 镜像测试。
 *
 * 与 `--self-test` 的分工:self-test 用构造面证**判据逻辑**(什么形态必须红/什么必须绿);
 * 本文件证**装车与取材面**(门真在仓里、判据读的是被审面而不是磁盘、
 * 以及"这门能不能命中本仓实际产出的形态")。两把尺子缺一把,另一把就可能在失明状态下报绿。
 *
 * 阳性对照刻意**钉出处 ref(重构前那一版)而不是 HEAD**:账清完那天,
 * "HEAD 上还能量到存量"这句话当场失效,而判据失效的表现永远是安静。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const GATE = 'scripts/check-edu-arrears-single-source.mjs'
/** 学费账目重构落地的那枚提交;它的父版本=重构前形态,是阳性对照的出处 */
const LANDING_REF = '7972c8f00c'
const OLD_ROUTE = `${LANDING_REF}^:apps/api/src/routes/edu-ai-management.ts`

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

test('T1 门体在位且能被 import(没有 isDirectRun 守卫时 import 会连带跑 CLI)', () => {
  const src = execFileSync('git', ['show', `HEAD:${GATE}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(src, /isDirectRun/, '门体必须带 §22d 入口守卫:否则取证者 import 判据时拿到的是门的输出,不是自己的断言')
  assert.match(src, /pathToFileURL/)
})

test('T2 真仓阳性对照:重构前那份路由喂同一判据必须命中', async () => {
  const mod = await import(pathToFileURL(path.join(ROOT, GATE)).href)
  let old
  try {
    old = execFileSync('git', ['show', OLD_ROUTE], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    // 取不到出处对象 ⇒ 这一维没有判过。不得静默通过,也不得把它当成"门没牙"
    assert.fail(`阳性对照出处取不到(${String(e.message).slice(0, 80)}):该结论属未判定,不能记为通过`)
  }
  const before = mod.scanSource(old)
  assert.ok(before.violations.length >= 1, '重构前必有色重写算式的站点被点名,否则本门对本仓实际形态全盲')
  assert.ok(
    before.violations.some((v) => v.kind === 'AR1'),
    '至少要命中一条 AR1(欠费算式在出口之外重写)',
  )
})

test('T3 自检必须跑完且全绿(端到端,不 import 判据)', () => {
  const r = runNode([GATE, '--self-test'])
  const tail = String(r.stdout ?? '').trim().split('\n').slice(-1)[0]
  assert.equal(r.status, 0, `--self-test 应 exit 0,实得 ${r.status};末行:${tail}`)
  assert.match(tail, /自检 \d+\/\d+ 通过/)
  const m = /自检 (\d+)\/(\d+) 通过/.exec(tail)
  assert.ok(m, '末行必须给出可 parse 的通过数')
  assert.equal(m[1], m[2], '不允许"部分通过"被当成绿')
})

test('T4 两面旗同给必须 exit 2(不得混面取数)', () => {
  const r = runNode([GATE, '--staged', '--worktree'])
  assert.equal(r.status, 2, `应判死 exit 2,实得 ${r.status}`)
  assert.match(String(r.stdout ?? '') + String(r.stderr ?? ''), /无法判定/)
})

test('T5 空枚举必须判死,不得读成"没有违规"', () => {
  // 传一个不在射程的文件(测试面)当 --files ⇒ 候选集为 0,这正是"门瞎了"最容易被误读成绿的形态
  const r = runNode([GATE, '--files', 'apps/api/tests/edu-ledger.test.ts'])
  assert.equal(r.status, 2, `射程内 0 个文件必须 exit 2,实得 ${r.status}`)
  assert.match(String(r.stdout ?? ''), /枚举到 0 个/)
})

test('T6 全量档不得因存量判红(棘轮锚点是该文件 HEAD 自身存量)', () => {
  const r = runNode([GATE])
  assert.equal(
    r.status,
    0,
    `真仓 HEAD 面上本门必须 exit 0 —— 若这里红,说明存量未清偿就接了提交链(恒红门,§12e)。末行:${String(
      r.stdout,
    )
      .trim()
      .split('\n')
      .slice(-1)[0]}`,
  )
})

test('T7 判据面必须走 face-reader 的层读取,且不留第二份遮罩实现', () => {
  const src = execFileSync('git', ['show', `HEAD:${GATE}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '取材必须走那一份层')
  assert.match(src, /catBatch\(/, '内容必须经层的读取入口,否则守门 118 会判本门半接线')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '遮罩必须引唯一实现')
  assert.doesNotMatch(src, /function maskComments\b/, '不得在门里再抄一份遮罩')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
