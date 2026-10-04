// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file pre-deploy.mjs 的 `--env` 取值回归(台账 G-322 第一处收尾)
 * @description 判的是"**带值旗标吞掉紧邻的下一个旗标**"这一族里最静默的那一格:
 *   改前 HEAD 的写法是
 *     `const PROD_MODE = ARGS.includes('--env') && ARGS[ARGS.indexOf('--env') + 1] === 'production'`
 *   ⇒ `--env --skip-tests`、`--env`(结尾无值)、`--env prod`(手打错)都**静默**落进开发档:
 *     第 8 项那 6 个"生产必填"env 从 FAIL 降级成 WARN、汇总的"生产模式有 N 项警告"段不提示,
 *     10 项跑完照样 `✅ 全部通过` exit 0 —— 票面写的"生产模式 env 检查更严"这一档根本没跑,而账面全绿。
 *   现口径(与本仓 G-314 / 门 127 / i18n-diff / verify-ui 同一条,不另发明):值必须存在、非空且
 *   不以 `-` 开头才算这个旗标的值;无效 ⇒ 在跑任何一项门禁**之前** exit 2 并点名实得 token。
 *
 * 测试策略(两条面各管一件事):
 *   1. **纯函数面** import `__test__.resolveEnvMode` —— 四态取值表与"合法集合"的正向证明。
 *      pre-deploy 的 10 项门禁会跑 pnpm turbo / 测试 / 读 .env,任何 spawn 它的用例都不许跑到
 *      那一步(票面硬约束:"只做参数解析层验证"),所以"合法值仍生效"这一半只能在纯函数 + 顺序锁上证。
 *   2. **CLI 面** spawn 非法值 —— 只走错误分支:断言 RC=2、stderr 点名 token、stdout 一条门禁
 *      结论都没有(证明它在跑任何门禁之前退出 ⇒ 结构上不可能有部署副作用)。
 *   3. **源码形态锁** 旧写法与"裸 assertRepoRoot 式"的吞值表达式不得回来(走遮罩后的代码面,
 *      遮罩只引 scripts/lib/code-mask.mjs 那一份实现)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'pre-deploy.mjs')

/**
 * §22c:判据**从源脚本 import**,绝不在测试里抄一份 resolveEnvMode。
 * 这一行本身就是 §22d `isDirectRun` 的正向证明 —— 没有那道守卫,import 就等于跑一次全量部署自检
 * (它会 execSync pnpm、读 .env、最后 process.exit(0/1)),本文件一枚用例都不会剩下。
 */
const { resolveEnvMode, ENV_MODES } = await import(pathToFileURL(SCRIPT_PATH).href).then((m) => m.__test__)

const STACK_FRAME_RE = /^\s+at\s+\S/m

function runScript(args) {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return { rc: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}

// ─── 1. 合法集合的正向证明:名单里每一个值都必须真能被认出来(门 120 那一型)───
test('ENV_MODES 的每一个值都能被认作合法档位(名单不是死表)', () => {
  assert.deepEqual([...ENV_MODES].sort(), ['production', 'staging'], '合法档位必须与"模式:"汇总行那两档同名同义')
  const seen = new Set()
  for (const v of ENV_MODES) {
    const r = resolveEnvMode(['--env', v])
    assert.equal(r.present, true, `${v} 应被识别为"给了 --env"`)
    assert.equal(r.valid, true, `${v} 在合法集合里却被判无效 ⇒ 名单与判据不同形`)
    assert.equal(r.invalid, false)
    assert.deepEqual(r.errorLines, [])
    seen.add(r.prodMode)
  }
  // production ⇒ 严格档、staging ⇒ 开发档:两档的 prodMode 必须**不相等**,否则其中一档是空支票
  assert.equal(seen.size, 2, '两档必须真的产出两种结果,否则"合法集合"只是装饰')
  assert.equal(resolveEnvMode(['--env', 'production']).prodMode, true)
  assert.equal(resolveEnvMode(['--env', 'staging']).prodMode, false)
})

// ─── 2. 缺省档:不给 --env 时与改前逐字同形(开发档、零提示、不判死)───────────
test('缺省档(不带 --env)⇒ prodMode=false 且不产出任何额外文案', () => {
  for (const list of [[], ['--skip-tests'], ['--staged']]) {
    const r = resolveEnvMode(list)
    assert.deepEqual(
      r,
      { present: false, valid: false, prodMode: false, value: null, token: null, invalid: false, errorLines: [] },
      `不带 --env 时行为必须一字不动(实得:${JSON.stringify(r)},入参:${JSON.stringify(list)})`,
    )
  }
})

// ─── 3. 反例三形态:值被顶成别的旗标 / 结尾无值 / 空串 / 未知值 ─────────────────
test('四种无效值一律 invalid=true 并点名实得 token', () => {
  const swallow = resolveEnvMode(['--env', '--skip-tests'])
  assert.equal(swallow.invalid, true)
  assert.equal(swallow.token, '--skip-tests', '必须把实得 token 原样交出来,不得只说"值不对"')
  assert.equal(swallow.prodMode, false, '无效值不得顺手把档位设成任何一档')
  assert.match(swallow.errorLines.join('\n'), /"--skip-tests"/)

  const tail = resolveEnvMode(['--env'])
  assert.equal(tail.invalid, true)
  assert.equal(tail.token, null)
  assert.match(tail.errorLines.join('\n'), /\(其后没有任何参数\)/, '结尾无值要说成"没给值",不能报 undefined')

  const empty = resolveEnvMode(['--env', ''])
  assert.equal(empty.invalid, true, '空串不是合法档位(否则 --env "" 静默落开发档)')

  const typo = resolveEnvMode(['--env', 'prodction'])
  assert.equal(typo.invalid, true, '手打错的档位名不得被静默当成开发档')
  assert.match(typo.errorLines.join('\n'), /"prodction"/)

  for (const r of [swallow, tail, empty, typo]) assert.ok(r.errorLines.length > 0, '每条都得给出可复制的出路')
})

// ─── 4. CLI 反例:非法值 ⇒ exit 2 且**在跑任何一项门禁之前**退出 ────────────────
test('CLI --env --skip-tests ⇒ RC=2、点名 token、stdout 不含任何门禁结论', () => {
  const r = runScript(['--env', '--skip-tests'])
  assert.equal(r.rc, 2, `应 exit 2,实得 ${r.rc}\nstdout:\n${r.out}\nstderr:\n${r.err}`)
  assert.match(r.err, /--env 没有收到有效的档位名/)
  assert.match(r.err, /"--skip-tests"/)
  assert.ok(!STACK_FRAME_RE.test(r.err), `不得打裸栈:\n${r.err}`)
  // 关键:它必须停在解析层。banner / [OK] / [FAIL] / 汇总任何一条出现,都说明"先跑了再判"。
  assert.doesNotMatch(r.out, /Pre-deploy 自检/, '标题都没该打 ⇒ 校验没排在门禁之前')
  assert.doesNotMatch(r.out, /\[OK\]|\[FAIL\]|\[WARN\]|汇总/, `不得产出任何门禁结论:\n${r.out}`)
})

test('CLI --env 结尾无值 ⇒ RC=2 且点名"其后没有任何参数"', () => {
  const r = runScript(['--env'])
  assert.equal(r.rc, 2, `实得 ${r.rc}\nstderr:\n${r.err}`)
  assert.match(r.err, /\(其后没有任何参数\)/)
  assert.doesNotMatch(r.out, /Pre-deploy 自检/)
})

// ─── 5. 顺序锁:校验必须排在第一项门禁之前(否则"合法档没跑"仍能产出半截报告)──
test('装车锁:main() 第一件事是 ENV_MODE.invalid 判定,PROD_MODE 由该判据单一来源喂入', () => {
  const code = maskCommentsAndStrings(readFileSync(SCRIPT_PATH, 'utf8'))
  assert.match(code, /const ENV_MODE = resolveEnvMode\(ARGS\)/, '模块级必须先算出 ENV_MODE')
  assert.match(code, /const PROD_MODE = ENV_MODE\.prodMode/, 'PROD_MODE 不得再有第二个取值来源')
  const guardAt = code.indexOf('if (ENV_MODE.invalid)')
  assert.ok(guardAt > 0, 'main() 里没有 invalid 判定 ⇒ resolveEnvMode 是死代码,提交链上一路绿灯')
  // 顺序要按**调用点**比,不是按函数名首次出现比:`function checkTypecheck()` 的定义在文件前面,
  // 拿它当"第一项门禁"会得到一条永远为假的顺序断言(那比没有断言更糟)。
  const mainAt = code.indexOf('async function main(')
  assert.ok(mainAt > 0, 'main() 必须是 async(§22d 模板靠 .catch 收尾,同步 main 抛错逃成裸栈)')
  const firstCall = code.indexOf('checkTypecheck()', mainAt)
  assert.ok(firstCall > guardAt, 'invalid 判定必须排在**第一项门禁之前**')
  const exitAt = code.indexOf('process.exit(2)', guardAt)
  assert.ok(exitAt > guardAt && exitAt < firstCall, 'invalid 分支必须在第一项门禁之前就 exit 2')
  // 旧的吞值表达式不得回来。遮罩面把字符串抹成空格 ⇒ 只可能匹配到真代码,注释里怎么写都不影响;
  // 而 `ARGS.indexOf(` 只出现在旧的那一条取值式里(新的 flagValue 用的是 `list.indexOf(flag)`)。
  assert.ok(!/ARGS\.indexOf\(/.test(code), "旧的 ARGS.indexOf('--env') + 1 取值形态又回来了")
  // §22d:被 import 时不得触发 CLI(本文件顶部那次 import 就是它的正向证明)
  assert.match(
    code,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
  )
  assert.match(code, /if \(isDirectRun\) \{/)
})

// ─── 6. 反例的失效方向:不得把合法用法一起打死 ────────────────────────────────
test('反向对照:--skip-tests 单独使用(不带 --env)不得被判成无效值', () => {
  // 这一条防的是"为了让 --env --skip-tests 报错,顺手把 --skip-tests 也当非法 token"。
  const r = resolveEnvMode(['--skip-tests'])
  assert.equal(r.present, false, '没给 --env 时,--skip-tests 与本判据无关')
  assert.equal(r.invalid, false)
})
