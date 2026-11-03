// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— G-815959 的常驻反向锁 `scripts/check-generator-resource-release.mjs`。
 *
 * 纪律:判据一律经门导出的 `__test__` 裁定,**禁止在本文件复制实现**(§22c 红线)。
 * 例数一律以 `node --test` 末行现读为准,本文不钉数字。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as gate from '../check-generator-resource-release.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GATE_PATH = path.join(ROOT, 'scripts', 'check-generator-resource-release.mjs')
const gateSrc = readFileSync(GATE_PATH, 'utf8')
const X = gate.__test__

function gitShowHead(rel) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, 'show', `HEAD:${rel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
  })
}

const REGISTRY_SURFACES = [
  'scripts/guardian-runner.mjs',
  'scripts/lib/pre-commit-hook.js',
  'package.json',
  '.husky/pre-commit',
  '.husky/pre-push',
]

/** T1/T2 方向锁:注册现状与头注声称必须同形 —— 未注册时自称已接即红,注册后必须成套 */
test('T1 未注册时头注必须自称"尚未接进提交链"(方向锁)', () => {
  const registered = REGISTRY_SURFACES.some((p) => {
    try {
      return gitShowHead(p).includes('check-generator-resource-release')
    } catch {
      return false
    }
  })
  if (!registered) {
    assert.match(gateSrc, /尚未接进提交链/, '头注未自称未接线 ⇒ 守门 89 的 R2 型撒谎')
    assert.ok(!/已接进提交链|blocking,/.test(gateSrc.split('@author')[0] ?? gateSrc), '头注不得同时声称已接与未接')
  } else {
    const runner = gitShowHead('scripts/guardian-runner.mjs')
    assert.match(runner, /mode:\s*'blocking'/, '注册后必须是 blocking(或按台账定级为 warn 并同步头注)')
    assert.match(runner, /HUSKY_SKIP_GENERATOR_RESOURCE_RELEASE/, '注册后必须声明应急跳过变量')
  }
})

/** T3 遮罩只许一份:JS 面必须引 lib,不得在门里再抄一份 JS 遮罩 */
test('T3 遮罩实现只有一份(JS 面必须引 lib/code-mask)', () => {
  assert.match(gateSrc, /from '\.\/lib\/code-mask\.mjs'/, 'JS 遮罩必须引 lib 那一份')
  assert.ok(
    !/function\s+maskCommentsAndStrings\s*\(/.test(gateSrc),
    '门内不得再写一份 JS 注释/字符串遮罩实现',
  )
  // Python 面必须确实存在且被使用(不是死代码):行注释被压白 ⇒ 注释里的 yield 不可见
  assert.equal(typeof X.maskPythonNoise, 'function')
  const maskedLine = X.maskPythonNoise('def f():\n    # yield\n    return 1\n')
  assert.ok(!maskedLine.includes('yield'), '注释里的 yield 必须被压掉,否则门把自己夹具当违规')
  assert.equal(maskedLine.split('\n')[1].length, 11, '遮罩必须等长(行号与列宽不变)')
})

/** T4 取材面形状锁:必须引 face-reader 并真的用 catBatch 读正文;不得自派生 git 读内容 */
test('T4 取材面纪律:引层且用 catBatch,禁止 git show / execSync 自取正文', () => {
  assert.match(gateSrc, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(gateSrc, /catBatch\(/, '正文必须由层的读取入口取(半接线 = 守门 118 判红)')
  assert.ok(!/execSync\s*\(/.test(gateSrc), '不得用无 stdio 纪律的 execSync')
  assert.ok(!/'show',\s*`HEAD:/.test(gateSrc), '不得自己拼 git show 读被审内容')
})

/** T5 真仓阳性对照:看不见 HEAD 面存量不算通过(判据失效的表现永远是安静) */
test('T5 对 HEAD 面必须量得出候选(阳性对照)', () => {
  const paths = X === undefined ? [] : []
  assert.ok(Array.isArray(paths))
  const faceMod = gate // 生产入口同样导出
  const listed = faceMod.listCandidatesFor ? faceMod.listCandidatesFor('head', ROOT) : []
  assert.ok(listed.length > 100, `HEAD 面枚举到 ${listed.length} 个候选文件 ⇒ 判死,不得记绿`)
  const files = faceMod.readFace('head', ROOT, listed)
  let unread = 0
  for (const [, v] of files) if (v === null) unread += 1
  assert.ok(files.size - unread > 100, '正文几乎全取不到 ⇒ 未判定,不得当结论')
  const res = faceMod.auditFace(files)
  assert.ok(res.candidates > 0, 'HEAD 面一个候选都没量到 ⇒ 尺子对本型失明,不得出合格证')
  assert.ok(res.rows.every((r) => ['passed', 'violation', 'undetermined'].includes(r.verdict)))
})

/** T6 CLI 两面旗同给 ⇒ exit 2(不冒红也不记绿) */
test('T6 --staged 与 --worktree 同给必须 exit 2', () => {
  let rc = 0
  try {
    execFileSync(process.execPath, [GATE_PATH, '--staged', '--worktree'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    })
  } catch (e) {
    rc = e.status
  }
  assert.equal(rc, 2, `两面旗同给的退出码应为 2,实得 ${rc}`)
})

/** T7 定级三态:默认档不因存量判红 / --strict 才问责 / 空枚举判死 */
test('T7 定级只由现读 violation 决定,禁止造恒红门', () => {
  const counts = { passed: 1, violation: 3, undetermined: 4 }
  assert.equal(X.decide({ counts, strict: false, enumerated: true }), 0)
  assert.equal(X.decide({ counts, strict: true, enumerated: true }), 1)
  assert.equal(X.decide({ counts: { passed: 0, violation: 0, undetermined: 9 }, strict: true, enumerated: true }), 0)
  assert.equal(X.decide({ counts, strict: true, enumerated: false }), 2)
})

/** T8 成对用例(ticket 验收口径的门级版本):同一站点,有关停证据 ⇒ passed;无关停证据 ⇒ violation */
test('T8 关停证据成对:有 aclose 判 passed,无关停判 violation', () => {
  const src = 'async def g():\n    await pool.acquire()\n    yield 1\n'
  const fn = X.scanPythonFile('b.py', src).find((f) => f.name === 'g')
  assert.ok(fn.generator && fn.holdsResource)
  const withClose = X.judgeFunction(fn, [{ file: 'z.py', line: 9, text: 'it = g()\n    try:\n        await it.aclose()\n    finally:\n        pass' }])
  assert.equal(withClose.verdict, 'passed')
  const withoutClose = X.judgeFunction(fn, [{ file: 'z.py', line: 9, text: 'async for x in g():\n    if x:\n        break' }])
  assert.equal(withoutClose.verdict, 'violation')
  const commentOnly = X.judgeFunction(fn, [{ file: 'z.py', line: 9, text: '# 记得调用 it.aclose() 吧\nasync for x in g():\n    break' }])
  assert.equal(commentOnly.verdict, 'violation', '注释里的关停不得被读成已装车')
})

/** T9 形状锁:§22d 的 isDirectRun 守卫必须在位,且 __test__ export 排在守卫之后 */
test('T9 §22d 守卫在位且 export 顺序合规', () => {
  const guardAt = gateSrc.indexOf('const isDirectRun')
  const exportAt = gateSrc.indexOf('export const __test__')
  assert.ok(guardAt > 0, '缺 isDirectRun 守卫 ⇒ import 时会触发 main()')
  assert.ok(exportAt > guardAt, '__test__ 的 export 必须在 if (isDirectRun) 之后(§22d)')
  assert.match(gateSrc, /pathToFileURL\(process\.argv\[1\]\)\.href/, '必须经 pathToFileURL 归一(Windows 反斜杠)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
