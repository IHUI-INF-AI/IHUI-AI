// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'
// §22c:判据单元一律从门体经 __test__ 取,禁止在本文件再抄一份豁免表/正则(两份真相必漂移)。
// 能这样 import 的前提是门体补上了 §22d 入口守卫(G-1058651)—— 改前 import 会在
// import 期真的跑一遍全仓扫描(实测 13 行输出)并以 process.exit 带走本测试进程。
import { __test__ as gate } from '../check-verify-tmp-files.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-verify-tmp-files.mjs')

// 创建临时扫描目录(模拟项目根)
function createTempRoot() {
  return mkScratch('ihui-verify-')
}

// 运行脚本并去除 ANSI 颜色码
function runScript(cwd, args = []) {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  r.out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

function writeFile(root, relPath, content = '') {
  const full = join(root, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRoot()
  try {
    const r = runScript(dir, ['--help'])
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: 无参数运行(空 apps/)→ exit 0 + 无 verify-*.*', () => {
  const dir = createTempRoot()
  try {
    // 创建空 apps/web 让脚本扫描到
    mkdirSync(join(dir, 'apps', 'web'), { recursive: true })
    const r = runScript(dir)
    assert.equal(r.status, 0, `空 apps 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. 违规检测:apps/*/verify-*.* ───────────────────────

test('违规: apps/web/verify-foo.mjs → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/verify-foo.mjs', 'console.log("tmp")\n')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0, `默认 warn-only 应 exit 0\nstdout: ${rDefault.out}`)
    assert.match(rDefault.out, /WARN/)
    assert.match(rDefault.out, /verify-foo\.mjs/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1, `--strict 应 exit 1\nstdout: ${rStrict.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('违规: apps/api/verify-bar.mjs → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/verify-bar.mjs', 'console.log("tmp")\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /verify-bar\.mjs/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1)
  } finally {
    rmScratch(dir)
  }
})

test('违规: apps/web/src/lib/verify-helper.mjs(子目录)→ 检测到', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/src/lib/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /verify-helper\.mjs/)
    assert.match(r.out, /WARN/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. 豁免场景 → 通过 ─────────────────────────────────

test('豁免: apps/web/tests/verify-helper.mjs(测试目录豁免,§23 配套)→ 通过', () => {
  // 源脚本 TEST_DIR_NAMES = ['__tests__', 'tests', 'test', 'spec']
  // tests/ 目录下的 verify-* 是合法测试文件,跳过
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/tests/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `测试目录豁免应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: apps/web/__tests__/verify-helper.mjs(__tests__ 目录豁免)→ 通过', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/__tests__/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: scripts/verify-*.mjs(不在扫描范围,SCAN_ROOTS=["apps"])→ 通过', () => {
  // 注:源脚本 SCAN_ROOTS 只有 ['apps'],不扫描 scripts/
  // §25 白名单豁免的真正实现是"不在扫描范围",而非显式白名单判断
  const dir = createTempRoot()
  try {
    writeFile(dir, 'scripts/verify-auth-shell.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `scripts/ 不在扫描范围应 exit 0\nstdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: *.test.mjs / *.spec.ts(不匹配 verify-* 模式)→ 通过', () => {
  // VERIFY_FILE_RE = /^verify-.+\.(mjs|cjs|js|ts|tsx|jsx)$/i
  // verify-foo.test.mjs 不匹配(因为 .test.mjs 后缀不符合 verify-*.ext 模式)
  // 实际上 verify-foo.test.mjs 会匹配!因为正则是 verify-.+\.mjs,而 .test.mjs 里 .mjs 在末尾
  // 让我用 foo.test.mjs(非 verify 开头)来测试
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/foo.test.mjs', 'export const x = 1\n')
    writeFile(dir, 'apps/web/bar.spec.ts', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `非 verify 开头应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: apps/web/utils.mjs(非 verify 开头)→ 通过', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/utils.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 4. 批量扫描 ─────────────────────────────────────────

test('批量: apps/ 含 3 个 verify-* 文件(2 违规 + 1 在测试目录豁免)→ 报告 2 违规', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/verify-tmp1.mjs', 'console.log(1)\n')
    writeFile(dir, 'apps/api/verify-tmp2.mjs', 'console.log(2)\n')
    // tests/ 下的 verify 不算违规(豁免)
    writeFile(dir, 'apps/web/tests/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `默认 warn-only 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /verify-tmp1\.mjs/)
    assert.match(r.out, /verify-tmp2\.mjs/)
    // 扫描总数应为 2(不算 tests/ 下的)
    assert.match(r.out, /扫描总数: 2/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1, `--strict 2 个警告应 exit 1`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. §22d 双形态入口守卫(G-1058651)─────────────────────
// 立因:改前门体顶层是裸 `main().catch(...)`,任何 import 都会在 import 期真的跑一遍
// 全仓 apps/ 扫描(实测 13 行输出)并以 process.exit 带走宿主进程 ⇒ 本测试当时只能
// 走进程面,判据拿不到,于是只能照注释抄常量(§22c 两份真相)。守卫装上后,下面两组
// 用例才有存在的前提 —— 它们钉的是"门体可导入",不是"门体会打印"。

const REPO = join(__dirname, '..', '..')

test('§22d:被 import 时零副作用(rc 0 + 零输出),CLI 直跑仍真的执行 main()', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/verify-sideeffect.mjs', 'export const x = 1\n')
    const imp = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(SCRIPT_PATH).href)})`],
      {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    assert.equal(imp.status, 0, `import 门体不得带走宿主进程,实得 exit ${imp.status}`)
    assert.equal(imp.stdout, '', `import 门体必须零输出,实得:\n${imp.stdout}`)
    assert.equal(imp.stderr, '', `import 门体不得写 stderr,实得:\n${imp.stderr}`)

    // 同一门体 CLI 直跑必须真的执行 main()(守卫不能把 CLI 也一起关掉)
    const cli = runScript(dir)
    assert.equal(cli.status, 0, `CLI 直跑应 exit 0(warn-only)\nstdout: ${cli.out}`)
    assert.match(cli.out, /临时文件归档守门/, 'CLI 直跑未执行 main() ⇒ 守卫把主流程也掐了')
    assert.match(cli.out, /verify-sideeffect\.mjs/)
  } finally {
    rmScratch(dir)
  }
})

test('§22d 装车:guardian-runner 的相对路径调用形态仍命中守卫(rel argv[1] 经 pathToFileURL 解析)', () => {
  // guardian-runner:5203 用 spawnSync(process.execPath, [`scripts/${check.script}`], {cwd: 仓库根})
  // ⇒ process.argv[1] 是**相对**路径。守卫必须仍能识别为直跑,否则 §25 门从 CI/钩子里静默消失。
  const r = spawnSync(process.execPath, ['scripts/check-verify-tmp-files.mjs'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  assert.equal(r.status, 0, `缺省档 warn-only 应 exit 0,实得 ${r.status}\n${out}${r.stderr}`)
  assert.match(out, /临时文件归档守门/, '相对路径直跑没执行 main() ⇒ 门已在接线点上静默失效')
})

// ─── 6. §22c 判据单元:全部经 __test__ 从门体取,零自抄 ───────
// 本节刻意不重复上面进程面的期望值,而是证明**同一个判据对象**被两面共用:
// 门体的纯扫描器 findVerifyFiles 与 CLI 打印的清单必须逐字一致(不一致即说明测试在自抄)。

test('__test__ 出口齐备:判据单元全部来自门体(缺任一项 = 测试侧只能再抄一份)', () => {
  assert.equal(typeof gate.findVerifyFiles, 'function')
  assert.ok(gate.VERIFY_FILE_RE instanceof RegExp)
  for (const k of ['EXCLUDE_DIRS', 'ALLOWED_DOT_DIRS', 'TEST_DIR_NAMES']) {
    assert.ok(gate[k] instanceof Set, `${k} 应为 Set,实得 ${gate[k]}`)
  }
  assert.deepEqual(gate.SCAN_ROOTS, ['apps'], '扫描面只有 apps/ —— scripts/verify-*.mjs 靠"不在扫描面"豁免')
  // 注释里长期声称的豁免项,现由门体的表证明,不再是本文件的字面量镜像
  assert.ok(gate.TEST_DIR_NAMES.has('tests'))
  assert.ok(gate.TEST_DIR_NAMES.has('__tests__'))
  assert.ok(gate.EXCLUDE_DIRS.has('node_modules'))
  assert.ok(gate.EXCLUDE_DIRS.has('scripts'), 'apps/*/scripts/ 合法运维脚本(2026-07-27 假阳性修复)')
})

test('门体判据 findVerifyFiles:命中面与豁免面(与进程面逐字对齐,不构成第二份真相)', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/verify-tmp1.mjs', 'export const x = 1\n')
    writeFile(dir, 'apps/api/src/verify-deep.ts', 'export const y = 1\n')
    writeFile(dir, 'apps/web/tests/verify-helper.mjs', 'export const z = 1\n')
    writeFile(dir, 'apps/web/__tests__/verify-helper2.mjs', 'export const z = 1\n')
    writeFile(dir, 'apps/web/node_modules/verify-pkg.mjs', 'export const z = 1\n')
    writeFile(dir, 'apps/web/scripts/verify-ops.mjs', 'export const z = 1\n')
    writeFile(dir, 'apps/web/check-tmp.mjs', 'export const z = 1\n')

    const APPS = join(dir, 'apps')
    const hit = gate
      .findVerifyFiles(APPS)
      .map((p) => p.slice(APPS.length + 1).replace(/\\/g, '/'))
      .sort()
    // 期望值是本用例构造的现场,不是判据的第二份实现
    assert.deepEqual(hit, ['api/src/verify-deep.ts', 'web/verify-tmp1.mjs'])

    const r = runScript(dir)
    assert.equal(r.status, 0, `warn-only 应 exit 0\n${r.out}`)
    assert.match(r.out, /扫描总数: 2/, '进程面计数必须与门体判据一致')
    assert.doesNotMatch(r.out, /verify-helper/, 'tests/ 豁免不得进清单')
    assert.doesNotMatch(r.out, /verify-pkg|verify-ops/, 'node_modules/ 与 apps/*/scripts/ 不得进清单')
  } finally {
    rmScratch(dir)
  }
})

test('门体判据 VERIFY_FILE_RE:扩展名与前缀口径由门体单点持有(本文件不再抄正则)', () => {
  assert.ok(gate.VERIFY_FILE_RE.test('verify-a.mjs'))
  assert.ok(gate.VERIFY_FILE_RE.test('verify-a.ts'))
  assert.ok(gate.VERIFY_FILE_RE.test('verify-a.test.mjs'), 'verify-foo.test.mjs 也会命中(前缀+尾缀各自匹配)')
  assert.ok(!gate.VERIFY_FILE_RE.test('check-verify-a.mjs'), '必须锚定 verify- 前缀')
  assert.ok(!gate.VERIFY_FILE_RE.test('verify-a.py'), 'py 不在受检扩展名内')
  assert.ok(!gate.VERIFY_FILE_RE.test('utils.mjs'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
