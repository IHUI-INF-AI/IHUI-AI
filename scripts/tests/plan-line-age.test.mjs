// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file plan-line-age.mjs 的镜像测试(带值旗标 --limit 的取值)
 *
 * 判据不在此复制(§22c):flagValue / resolveLimit 直接从源文件 import —— 该模块有 §22d 的
 * isDirectRun 守卫,import 不会触发 main(),也就不会派生 blame。
 *
 * 事故形态:`--limit --json` 旧写法把 `--json` 喂给 Number ⇒ NaN ⇒ slice(0, NaN) ⇒ [] ⇒
 * **寿命清单为空而 exit 0**,问责档把"尺子什么都没看到"读成"没有陈旧行"。
 * 本旗标的处置与 --output / --spec 不同:**允许退回默认 20,但必须大声点名**(且提示走 stderr,
 * 因为 --json 档的 stdout 是要被 JSON.parse 的)。口径照抄枚 380431ffc / 636c28f58 / 8832e73a4。
 *
 * 夹具唯一落点:scripts/lib/scratch-dir.mjs(§26);本测试对真仓只做只读的 blame。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { flagValue, resolveLimit, DEFAULT_LIMIT } from '../lib/plan-line-age.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO = path.resolve(__dirname, '..', '..')
const SCRIPT_PATH = path.join(REPO, 'scripts', 'lib', 'plan-line-age.mjs')

// ─── 判据本体(flagValue):正例与反例成对,免得"名单是张死表" ───
test('flagValue 判据:紧邻 token 不存在 / 空 / 以 - 开头 ⇒ 不算值;合法值仍算值(正反成对)', () => {
  assert.equal(flagValue(['--limit', '--json'], '--limit').valid, false, '相邻旗标不得被当成本旗标的值')
  assert.equal(flagValue(['--limit'], '--limit').valid, false, '其后没有参数不得被当成有值')
  assert.equal(flagValue(['--limit', ''], '--limit').valid, false, '空串不是值')
  assert.equal(flagValue(['--limit', '-5'], '--limit').token, '-5', 'token 必须原样带回去(拒绝时要点名)')
  assert.equal(flagValue(['--limit', '30'], '--limit').value, '30', '合法值必须放行(否则校验变成永拒)')
  assert.equal(flagValue(['--all'], '--limit').present, false, '旗标缺席不得判成"值为空"')
  assert.equal(flagValue([], '--limit').token, null, '空 argv 的三态都得是可诊断的')
})

// ─── resolveLimit:(a) 无效 ⇒ 退回默认 + notice;(b) 合法/缺席 ⇒ 与改前逐字一致 ───
test('(a) resolveLimit 对无效值:退回默认 20 并给出点名文案(三种失败形态各点名)', () => {
  for (const [argv, expected] of [
    [['--limit', '--json'], '"--json"'],
    [['--limit', '--staged'], '"--staged"'],
    [['--limit'], '(其后没有任何参数)'],
    [['--limit', ''], '""'],
    [['--limit', 'abc'], '"abc"'],
  ]) {
    const { limit, notice } = resolveLimit(argv)
    assert.equal(limit, DEFAULT_LIMIT, `${argv.join(' ')} 必须退回默认 ${DEFAULT_LIMIT}`)
    assert.match(notice, /忽略无效的 --limit 值:/, `${argv.join(' ')} 的提示必须点名该旗标`)
    assert.ok(notice.includes(expected), `${argv.join(' ')} 必须原样带出实得的 token:${notice}`)
  }
})

test('(b) resolveLimit 对合法值与缺席:notice 为 null 且数值照旧(0 也是用户明说的意图)', () => {
  assert.deepEqual(resolveLimit([]), { limit: 20, notice: null }, '缺席 = 既有默认行为,不多打一行')
  assert.deepEqual(resolveLimit(['--limit', '30']), { limit: 30, notice: null }, '合法数字必须被采纳')
  assert.deepEqual(resolveLimit(['--limit', '0']), { limit: 0, notice: null }, '0 不是无效值,不得改语义')
  assert.deepEqual(resolveLimit(['--json', '--limit', '7']), { limit: 7, notice: null }, '旗标顺序无关')
})

// ─── (a)+(b) 端到面:真跑一次 CLI,证明无效值退回默认那份清单而不是空清单 ───
test('(a) CLI --limit --json:exit 0 + stderr 点名 + stdout 仍是可 parse 的 JSON 且清单非空', () => {
  const dir = mkScratch('ihui-plan-line-age-')
  try {
    const bad = spawnSync('node', [SCRIPT_PATH, '--limit', '--json'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
    })
    assert.equal(bad.status, 0, `退回默认档不该把退出码改成非零,实际 ${bad.status}`)
    assert.match(bad.stderr, /忽略无效的 --limit 值: "--json"/, '无效值必须大声点名(不得静默)')
    const parsed = JSON.parse(bad.stdout) // stdout 被污染即失败:--json 的消费方要 parse 它
    assert.ok(Array.isArray(parsed.top), 'top 必须是数组')
    assert.ok(parsed.top.length > 0, '清单不得是空的 —— 空而 exit 0 正是本判据要防的那一型')

    // 同一时刻的默认档(不带 --limit)必须拿到同样多的行 ⇒ "退回默认"是真的,不是又一个猜测值
    const plain = spawnSync('node', [SCRIPT_PATH, '--json'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
    })
    assert.equal(plain.stderr.trim(), '', '默认档不得多打一行(默认行为一字未改)')
    assert.equal(JSON.parse(plain.stdout).top.length, parsed.top.length, '无效值那份清单必须等于默认档')
  } finally {
    rmScratch(dir)
  }
})

// ─── (c) 源码形状锁 ───
test('(c) 形状锁:--limit 取值必须走 resolveLimit,裸 Number(argv[indexOf+1]) 不得回来', () => {
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\/[^\n]*/g, '')
  assert.doesNotMatch(
    code,
    /Number\(\s*argv\[\s*argv\.indexOf\(\s*'--limit'\s*\)\s*\+\s*1\s*\]\s*\)/,
    '旧写法 Number(argv[argv.indexOf("--limit") + 1]) 不得回来',
  )
  assert.match(code, /function\s+flagValue\s*\(/, '判据必须是本模块那一份(供测试直接 import)')
  assert.match(code, /export function resolveLimit\(/, '出口必须 export,否则测试只能抄一份判据')
  assert.match(code, /resolveLimit\(\s*argv\s*\)/, 'main 必须真调用出口')
  assert.match(code, /limitNotice\)\s*console\.error\(/, '点名必须走 stderr,否则 --json 的 stdout 被污染')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
