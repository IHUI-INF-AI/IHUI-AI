// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-shell-form-import-lock.test.mjs —— 门 299「不再以 SyntaxError 结束」的接线锁。
 *
 * 立因(2026-11-05 实测):门体与工作树面的 scripts/lib/miniapp-shell-form.mjs 一度不同源
 * (工作树副本被回写成祖先旧 blob,缺 retirementShortfall 等具名导出),导致
 * `node scripts/check-miniapp-shell-form.mjs` 每次当场 SyntaxError 崩溃,pre-push 批量档把它
 * 算成未判定 ⇒ push 门被这道崩溃的门长期挡死(§12e 恒红门型)。本锁不复刻任何判据(§22c),
 * 只对账"两侧是否同源自洽":
 *   L1 门体对 lib 的具名 import 清单 ↔ lib 实际导出清单,缺一枚即红;
 *   L2 门体冷启动(--self-test)的 stdout+stderr 不得再出现断链指纹/SyntaxError,退出码 ∈{0,1};
 *   L3 镜像测试套件自身可加载(--test-name-pattern 恰选纯函数例 T22,不依赖他席在飞的词包)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(ROOT, 'scripts', 'check-miniapp-shell-form.mjs')
const LIB = join(ROOT, 'scripts', 'lib', 'miniapp-shell-form.mjs')
const LIB_SPEC = './lib/miniapp-shell-form.mjs'

/**
 * 子进程环境必须剔掉 NODE_TEST_CONTEXT(2026-11-05 实测):node --test 会给其子进程注入
 * NODE_TEST_CONTEXT=child-v8,而孙辈 `node --test` 继承它时**静默跳过运行文件并以 0 退出**
 * ("node:test run() is being called recursively … skipping running files")——锁若不剔,
 * L3 会在断链态照样绿(空转锁)。失效方向恒为"真跑一遍",不是"看起来没报错"。
 */
function spawnEnv() {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  return env
}

test('L1 门体具名 import 与 lib 导出清单逐一对账(断链即红)', async () => {
  const src = readFileSync(GATE, 'utf8')
  const m = src.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/lib\/miniapp-shell-form\.mjs'/)
  assert.ok(m, `门体对 ${LIB_SPEC} 的具名 import 子句不见了(取材形态变了?)`)
  const names = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  assert.ok(names.length >= 8, `import 名单只剩 ${names.length} 项,不像完整清单:${names.join(',')}`)
  const lib = await import(pathToFileURL(LIB).href)
  const missing = names.filter((n) => lib[n] === undefined)
  assert.deepEqual(
    missing,
    [],
    `lib 侧缺具名导出:${missing.join(',')} —— 这正是门 299 崩溃的「does not provide an export named」那一格`,
  )
})

test('L2 门体冷启动不再以 SyntaxError 结束:退出码 ∈{0,1} 且无断链指纹', () => {
  const r = spawnSync(process.execPath, [GATE, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    env: spawnEnv(),
  })
  const all = `${r.stdout ?? ''}${r.stderr ?? ''}`
  assert.match(all, /自检 \d+ 例,失败 \d+/, '子进程必须真跑到自检汇总(空转即红)')
  assert.doesNotMatch(all, /does not provide an export named/, '门体加载期再次断链(两侧版本又不同源自洽了?)')
  assert.doesNotMatch(all, /SyntaxError/, '门体不得以 SyntaxError 结束')
  assert.ok(r.status === 0 || r.status === 1, `退出码必须 ∈{0,1},现读 ${String(r.status)}`)
})

test('L3 镜像测试套件可加载(它同样直接 import retirementShortfall)', () => {
  const r = spawnSync(
    process.execPath,
    ['--test', '--test-name-pattern', '^T22$', join(ROOT, 'scripts', 'tests', 'miniapp-shell-form.test.mjs')],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, env: spawnEnv() },
  )
  const all = `${r.stdout ?? ''}${r.stderr ?? ''}`
  assert.doesNotMatch(all, /skipping running files/, '孙辈 runner 继承 NODE_TEST_CONTEXT 静默空转 ⇒ 锁失牙')
  assert.match(all, /ℹ tests 1/, '必须真选中恰好一枚 T22(0 枚 = 空转,§0.3 判死不记绿)')
  assert.doesNotMatch(all, /does not provide an export named/, '镜像测试加载期断链 ⇒ 与 L1 同一格回归')
  assert.equal(r.status, 0, `T22(纯函数真值锁,不读词包)必须绿;现读 rc=${String(r.status)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
