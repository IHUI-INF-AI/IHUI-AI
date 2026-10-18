// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-flag-value-discipline.mjs` 的镜像测试(§22c:判据只有一份,测试 import `__test__`,
 * 不在测试里复制第二套形状)。
 * 跑法:node --test scripts/tests/check-flag-value-discipline.test.mjs
 *
 * 钉的是四件事:
 *   ① 两形都被数到(②存形是重点 —— 只查①会漏掉九成站点,2026-10-17 实测 113 处里①只占 11 处);
 *   ② 不误伤:变量不是 indexOf 来的下标不算、遮罩掉的注释/字符串不算;
 *   ③ 半收口的信息位必须跑在**原文**上(遮罩后看不见 import 说明符 ⇒ 会把"已引单源"读成"没引");
 *   ④ 装车锁:main 真调这份判据、`--strict` 分支真存在,且 `--strict` 的退出码与 `--json` 现读的
 *      siteCount **同判**(不能恒 0,也不能存量清零后还硬判红 —— 后者会把这条尺子自己变成恒红门)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as kit } from '../check-flag-value-discipline.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = resolve(HERE, '..', 'check-flag-value-discipline.mjs')
const REPO = resolve(HERE, '..', '..')
const run = (args) => spawnSync(process.execPath, [GATE, ...args], { cwd: REPO, encoding: 'utf8', windowsHide: true })

test('0 import 源门零副作用(__test__ 在、main 未跑)', () => {
  for (const k of ['findRawSites', 'usesLib', 'listTargets', 'measure', 'selfTest']) {
    assert.equal(typeof kit[k], 'function', `__test__ 缺出口 ${k}`)
  }
})

test('1 两形都被数到(②存形是这一族的大头)', () => {
  assert.equal(kit.findRawSites("const r = argv[argv.indexOf('--root') + 1]").length, 1, '①同形')
  assert.equal(
    kit.findRawSites(['const i = args.indexOf("--kind")', 'const k = args[i + 1]'].join('\n')).length,
    1,
    '②存形',
  )
})

test('2 不误伤:下标变量不是 indexOf 来的 ⇒ 不算', () => {
  assert.equal(kit.findRawSites(['for (let i = 0; i < 5; i++) {}', 'const v = arr[i + 1]'].join('\n')).length, 0)
})

test('3 遮罩后的注释与字符串不算站点(本门判代码结构,两面都遮)', async () => {
  // 遮罩实现只有一份(§22c):测试引同一份 lib,不在这里再抄一个"遮罩"。
  const { maskCommentsAndStrings } = await import('../lib/code-mask.mjs')
  const src = [
    '// 旧写法 argv[argv.indexOf("--root") + 1] 会吞值(这是文档里的反例引用)',
    "const note = 'argv[args.indexOf(x) + 1]'",
  ].join('\n')
  assert.equal(kit.findRawSites(maskCommentsAndStrings(src)).length, 0)
})

test('4 usesLib 必须跑在原文上(遮罩后看不见导入说明符)', async () => {
  const { maskCommentsAndStrings } = await import('../lib/code-mask.mjs')
  const raw = "import { requireFlagValue } from './lib/flag-value.mjs'\nconst a = argv[argv.indexOf('--p') + 1]"
  assert.equal(kit.usesLib(raw), true)
  assert.equal(kit.usesLib(maskCommentsAndStrings(raw)), false, '遮罩文本里导入路径被遮 ⇒ 这条信息位绝不能拿遮罩文本判')
})

test('5 枚举面:排除本器自身 / 镜像测试 / 单源 lib', () => {
  const names = [
    'scripts/a.mjs',
    'scripts/tests/a.test.mjs',
    'scripts/lib/flag-value.mjs',
    'scripts/check-flag-value-discipline.mjs',
    'apps/web/x.mjs',
    'scripts/sub/b.mjs',
  ].join('\n')
  assert.deepEqual(kit.listTargets(names), ['scripts/a.mjs', 'scripts/sub/b.mjs'])
})

test('6 measure 汇总口径与"半收口"名单', () => {
  const m = kit.measure([
    { path: 'x.mjs', text: "const a = argv[argv.indexOf('--p') + 1]" },
    {
      path: 'y.mjs',
      text: "import { requireFlagValue } from './lib/flag-value.mjs'\nconst b = argv[argv.indexOf('--q') + 1]",
    },
    { path: 'z.mjs', text: 'const c = 1' },
    { path: 'w.mjs', text: null },
  ])
  assert.equal(m.filesWithSites, 2)
  assert.equal(m.siteCount, 2)
  assert.deepEqual(m.halfClosed, ['y.mjs'], '已引单源却留裸站点 = 半收口,必须单独点名')
})

test('7 装车锁:main 真调这份判据,且 --strict 分支存在', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /const m = measure\(r\.entries\)/, 'main 没调 measure ⇒ 判据是死代码(§0.9)')
  assert.match(src, /findRawSites\(masked\)/, 'measure 没调 findRawSites ⇒ 同上')
  assert.match(src, /if \(strict && m\.siteCount > 0\) return 1/, '--strict 的判红分支不在了')
  assert.match(src, /import \{ requireFlagValue \} from '\.\/lib\/flag-value\.mjs'/, '本器自己的旗标必须走单源出口')
})

test('8 退出码与现读读数同判(不恒 0,也不在清零后硬判红)', () => {
  const j = run(['--json'])
  assert.equal(j.status, 0, `--json 档应只报数,实读 rc=${j.status}\n${j.stderr}`)
  const parsed = JSON.parse(j.stdout)
  assert.ok(Number.isInteger(parsed.siteCount) && parsed.siteCount >= 0, `siteCount 读数不可用:${parsed.siteCount}`)
  const strict = run(['--strict'])
  assert.equal(strict.status, parsed.siteCount > 0 ? 1 : 0, `--strict 与 --json 读数不同判:siteCount=${parsed.siteCount} rc=${strict.status}`)
})

test('9 未判定档:两面旗同给 / --top 坏值 都 rc=2,不记绿也不冒红', () => {
  assert.equal(run(['--staged', '--worktree']).status, 2, '两面旗同给必须判死')
  assert.equal(run(['--top']).status, 2, '--top 不给值必须未判定')
  assert.equal(run(['--top', '--json']).status, 2, '--top 被下一枚旗标顶值必须未判定(本器不得犯本票要消的错)')
  assert.equal(run(['--self-test']).status, 0, '--self-test 必须全过')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
