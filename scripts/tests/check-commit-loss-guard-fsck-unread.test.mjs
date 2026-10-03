// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * §22c 镜像测试:守门 30a「fsck 取不到 ⇒ 不得判绿」。
 *
 * ## 这条测试挡的是哪个缺陷(2026-10-03 实测事故)
 *   `listUnreachableHashes` 曾用 `gitText([... 'fsck' ...], {allowFail:true})`,
 *   而 `if (!out) return []` 把"取不到"与"真的是零"折进了同一个值。本仓 fsck 的真实
 *   退出码是 **2**(40 条 `broken link` 所致,与悬空无关),`allowFail` 把 2 折成 `''`,
 *   788 枚 `unreachable commit` 被读成 0 —— 连跑三次 RC=0「✅ 未检测到悬空 commit」。
 *
 * ## 为什么用 stub 而不是真让 git 崩
 *   真造 EBUSY 依赖本机的病窗,窗外的机器上这条测试会退化成"没造出故障"而恒绿 ——
 *   也就是**用假绿换稳定**。故这里替掉的是取材层的 `batchExecFileSync`(fsck 唯一出口),
 *   由夹具精确投放三种形态:① 取不到(无 status) ② 取不到(fatal) ③ 取到了(RC≠0 但 stdout 有清单)。
 *   EBUSY 病窗内外跑出的结论完全一致。
 *
 * ## 三格必须同时在场(缺任何一格,测试都能被一种坏实现骗过)
 *   A 取不到 ⇒ 非 0 且**不得**出现「✅ 未检测到悬空 commit」/「无 commit 丢失风险」
 *   B 真的零悬空(RC=0 + 空 stdout)⇒ 必须判绿,否则就是"写成一有异常就判红"的恒红实现
 *   C RC=2 但 stdout 带完整清单 ⇒ 必须**当正常读数**取用那些 hash,
 *     判红或判绿都随内容走,但绝不可因为 RC≠0 就丢弃清单(那会把本仓永久钉红)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-commit-loss-guard.mjs')

/** 40-hex 的合法 commit hash,夹具里当"fsck 报出来的悬空 commit"用。 */
const H1 = 'a'.repeat(40)
const H2 = 'b'.repeat(40)

/**
 * stub 取材层:`batchExecFileSync` 按 MODE 投放指定形态,其余导出**原样转发**真层。
 *
 * 转发而不是重写,是本夹具能成立的唯一理由:门在 fsck 之外还有 reflog / tag / ls-remote /
 * for-each-ref 等一整排调用(其中 ls-remote 必失败——夹具仓没有 origin,那是合法降级)。
 * 只替一个出口,其余走真层,判据的其余部分就仍受真环境检验。
 */
function stubLayer(mode) {
  return `
import * as real from './face-reader-real.mjs'
export const Undetermined = real.Undetermined
export const catBatch = real.catBatch
export const gitBinary = real.gitBinary
export const gitErrText = real.gitErrText
export const gitRaw = real.gitRaw
export function catBatchCheck(...a) { return real.catBatchCheck(...a) }
export function catBatchOids(...a) { return real.catBatchOids(...a) }
export function batchExecFileSync(file, args, opts) {
  const mode = ${JSON.stringify(mode)}
  const argv = Array.isArray(args) ? args.map(String) : []
  // 只拦 fsck;其余动词(以及 real 层自己内部的派生)一律放行。
  if (argv.includes('fsck')) {
    if (mode === 'unreachable-nostatus') {
      // 派生层没跑成:EBUSY 兜底也失败 / ENOENT / 超时 —— **没有 status**。
      const e = new Error('spawnSync git EBUSY (EBUSY 兜底通道重试仍失败)')
      e.code = 'EBUSY'
      throw e
    }
    if (mode === 'unreachable-fatal') {
      // git 自己拒绝执行(非仓库的形态):RC=128 + 空 stdout + stderr fatal。
      const e = new Error('Command failed: git fsck')
      e.status = 128
      e.stdout = ''
      e.stderr = 'fatal: not a git repository (or any of the parent directories): .git\\n'
      throw e
    }
    if (mode === 'unreachable-rc2-with-data') {
      // 本仓真实形态:RC=2(broken link 所致),而 unreachable 清单**完整可信**。
      const e = new Error('Command failed: git fsck')
      e.status = 2
      e.stdout = [
        'unreachable commit ${H1}',
        'unreachable tree  ${'c'.repeat(40)}',
        'broken link from    tree ${'d'.repeat(40)}',
        '              to    blob ${'e'.repeat(40)}',
        'unreachable commit ${H2}',
        '',
      ].join('\\n')
      e.stderr = ''
      throw e
    }
    // 'rc0-empty':真的跑完并报告零悬空 —— 合法读数,必须判绿。
    return ''
  }
  return real.gitRaw(argv.slice(argv.indexOf('-C') + 2), process.cwd(), opts)
}
`
}

/**
 * 搭一个"门体 + stub 取材层 + 真层"的夹具仓,把门跑起来并取回 {code,out}。
 * ROOT 由门的 process.cwd() 决定,故 cwd 必须是夹具仓(cwd=gate.mjs 的父目录)。
 *
 * ## 为什么夹具只建一次、各用例只换 stub 文件(而不是每用例 mk/rm 一对)
 *   宿主 shim 的删除守卫 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 按**本轮累计删除数**计,
 *   阈值 50(实测:11 个夹具各 7 文件也会在第 5 个用例上撞线,报 count:51)。
 *   一旦 `rmScratch` 抛错,它会**盖掉本用例真正的断言结果** —— 判据的红被换成一句与判据无关的
 *   清理噪声(本文件第一版就是这么全红���,A1..D1 四条一起挂,读起来像"修法全错")。
 *   故这里只建一次、逐用例覆写 stub、末尾删一次。
 */
let _fixture = null

/**
 * 算出取材层的**仓内传递闭包**(只跟 `from './…'`,node: 内置不跟)。
 * 现算而不是手抄清单:手抄那份在 `seal-c-root-stray.mjs` 后面又长出 `mirror-verify.mjs` 时
 * 会静默少拷一支,而少一支的后果不是"少个功能",是 import 期 ERR_MODULE_NOT_FOUND ——
 * 本文件第一版就把四条用例一起红成与被测判据无关的噪声(实测踩过两次)。
 */
function layerClosure() {
  const roots = [
    'scripts/lib/face-reader.mjs',
    'scripts/lib/gitdir.mjs',
    'scripts/lib/scratch-dir.mjs',
    'scripts/seal-c-root-stray.mjs',
  ]
  const seen = new Set()
  const queue = [...roots]
  while (queue.length) {
    const rel = queue.shift()
    if (seen.has(rel)) continue
    seen.add(rel)
    let src
    try {
      src = readFileSync(join(REPO, rel), 'utf8')
    } catch {
      continue
    }
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      let dep = relative(REPO, resolve(join(REPO, dirname(rel)), m[1])).replace(/\\/g, '/')
      if (!/\.(mjs|js)$/.test(dep)) dep += '.mjs'
      queue.push(dep)
    }
  }
  return [...seen].sort()
}

function fixture() {
  if (_fixture) return _fixture
  const scratch = mkScratch('clg-fsck-')
  for (const rel of layerClosure()) {
    const dest = join(scratch, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(join(REPO, rel), dest)
  }
  // 真层改名落盘:stub 以 './face-reader-real.mjs' 引它,门本体仍引 './lib/face-reader.mjs'(=stub)。
  copyFileSync(join(scratch, 'scripts', 'lib', 'face-reader.mjs'), join(scratch, 'scripts', 'lib', 'face-reader-real.mjs'))
  copyFileSync(SCRIPT, join(scratch, 'scripts', 'gate.mjs'))
  _fixture = scratch
  return scratch
}

function runGateWithStub(mode, args = ['--blocking', '--filter-stash'], timeout = 180000) {
  const scratch = fixture()
  writeFileSync(join(scratch, 'scripts', 'lib', 'face-reader.mjs'), stubLayer(mode), 'utf8')
  const r = spawnSync(process.execPath, [join(scratch, 'scripts', 'gate.mjs'), ...args], {
    cwd: scratch,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

// 末尾一次性回收。刻意**不**放在某条用例的 finally 里:夹具是四条用例共享的,
// 首个跑完的用例就删掉它会让后面的用例拿到空目录。清理失败只在 stderr 喊一声,
// 不改写退出码(与 lib/scratch-dir.mjs 的 exit 钩子同一处置)。
process.on('exit', () => {
  if (!_fixture) return
  try {
    rmScratch(_fixture)
  } catch (e) {
    console.error(`⚠ 夹具清理未执行 ${_fixture}:${(e && e.message) || e}`)
  }
})

/** 「判绿」的两句文案。两句都命中才算绿——只判一句会被改措辞骗过。 */
function looksGreen(out) {
  return /未检测到悬空 commit/.test(out) || /无 commit 丢失风险/.test(out)
}

test('A1 取不到(派生层未取得退出码,EBUSY 形态)⇒ 必须 exit 2 且不得判绿', () => {
  const { code, out } = runGateWithStub('unreachable-nostatus')
  assert.notEqual(code, 0, `fsck 取不到时绝不能 exit 0(那正是本票要治的假绿);实得 ${code}\n${out}`)
  assert.equal(code, 2, `取不到必须是 exit 2「无法判定」,不得与 1「判红」混同;实得 ${code}\n${out}`)
  assert.ok(!looksGreen(out), `取不到时不得出现任何"未检测到悬空 commit/无丢失风险"字样\n${out}`)
  assert.match(out, /无法判定|取不到/, '失效必须响:必须把"没判成"喊出来,不得静默非零')
})

test('A2 取不到(git fatal,非仓库形态 RC=128)⇒ 同样 exit 2 且不得判绿', () => {
  // 与 A1 分开:这一格 status 是**有值的**(128)。若实现只判 `status === undefined`,
  // 这一格会掉进"取到了"分支 —— 那正是"RC 非 0 一律当失败"的反面(把真读数也丢掉)。
  const { code, out } = runGateWithStub('unreachable-fatal')
  assert.equal(code, 2, `git fatal ⇒ 不可判定;实得 ${code}\n${out}`)
  assert.ok(!looksGreen(out), `git fatal 时不得判绿\n${out}`)
})

test('B1 真的零悬空(RC=0 + 空 stdout)⇒ 必须判绿(exit 0)', () => {
  // 反向锁:没有这一格,A1/A2 可以被"永远 exit 2"的实现骗过 —— 那种实现同样满足上面两条,
  // 却把整门变成恒红,最后人人 --no-verify,连带真正防丢的判据一起作废(§12e 同型)。
  const { code, out } = runGateWithStub('rc0-empty')
  assert.equal(code, 0, `fsck 真的报零悬空必须放行;实得 ${code}\n${out}`)
  assert.match(out, /未检测到悬空 commit/, '零悬空是合法读数,必须判绿')
})

test('C1 RC≠0 但 stdout 带完整清单 ⇒ 清单必须被取用,不得因退出码丢弃', () => {
  // 本仓真实形态(broken link ⇒ RC=2,而 unreachable 清单完整)。
  // 判据:fsck 报出来的 hash 必须出现在 stdout 里。实现若"RC 非 0 即丢弃清单",
  // 这里会看到「未检测到悬空 commit」—— 也就退回本票修掉的那个假绿。
  const { code, out } = runGateWithStub('unreachable-rc2-with-data')
  assert.ok(
    out.includes(H1.slice(0, 12)) || out.includes(H2.slice(0, 12)),
    `RC=2 时 stdout 里的 unreachable 清单是可信读数,必须被取用(期望见到 ${H1.slice(0, 12)} / ${H2.slice(0, 12)} 之一)\n${out}`,
  )
  assert.ok(!looksGreen(out), '清单非空却报"未检测到悬空 commit" = 假绿\n' + out)
  assert.notEqual(code, 2, `RC=2 且清单完整属正常读数,不该折成"无法判定";实得 ${code}\n${out}`)
})

test('D1 判据面锁:fsck 不得再走 allowFail(那三行就是假绿的成因)', () => {
  // 代码面读法:读源码文本断言"fsck 那一处不再有 allowFail",且 allowFail 仍留给别的降级用途。
  const src = readFileSync(SCRIPT, 'utf8')
  const fsckBlock = src.slice(src.indexOf('function listUnreachableHashes'), src.indexOf('function detectUnreachable'))
  assert.ok(fsckBlock.length > 0, '必须仍存在 listUnreachableHashes')
  assert.doesNotMatch(
    fsckBlock,
    /allowFail/,
    'listUnreachableHashes 内不得再出现 allowFail:它会把"取不到"与"真的是零"折成同一个值',
  )
  assert.match(
    fsckBlock,
    /throw new Undetermined/,
    '取不到必须抛 Undetermined(交由调用方 fail-closed),不得静默返回空数组',
  )
  // 反向锁:allowFail 不是被全局删掉(它对 reflog/tag 这类"取不到就降级"的调用点仍合法),
  // 是在这一个判据上被收回了。
  assert.match(src, /allowFail/, 'allowFail 应仍服务于其它降级型调用点')
})
