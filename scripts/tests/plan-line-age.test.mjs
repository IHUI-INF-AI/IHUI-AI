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
import { flagValue, resolveLimit, DEFAULT_LIMIT, mergeLineRanges, blameLineTimes, BLAME_RANGE_ARG_CAP } from '../lib/plan-line-age.mjs'

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
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const bad = spawnSync('node', [SCRIPT_PATH, '--limit', '--json'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
    })
    assert.equal(bad.status, 0, `退回默认档不该把退出码改成非零,实际 ${bad.status}`)
    assert.match(bad.stderr, /忽略无效的 --limit 值: "--json"/, '无效值必须大声点名(不得静默)')
    const parsed = JSON.parse(bad.stdout) // stdout 被污染即失败:--json 的消费方要 parse 它
    assert.ok(Array.isArray(parsed.top), 'top 必须是数组')
    assert.ok(parsed.top.length > 0, '清单不得是空的 —— 空而 exit 0 正是本判据要防的那一型')

    // 同一时刻的默认档(不带 --limit)必须拿到同样多的行 ⇒ "退回默认"是真的,不是又一个猜测值
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const plain = spawnSync('node', [SCRIPT_PATH, '--json'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
    })
    assert.equal(plain.stderr.trim(), '', '默认档不得多打一行(默认行为一字未改)')
    assert.equal(JSON.parse(plain.stdout).top.length, parsed.top.length, '无效值那份清单必须等于默认档')
  } finally {
    rmScratch(dir)
  }
})

// ─── (a2) 紧邻旗标被顶值那一支:--staged 早退档也不得绕过点名(G-322 收口复核 2026-10-13) ───
// 事故形态:`--limit --staged`(runner 尾部常追加 --staged)原先命中 main() 的 staged 早退分支,
// resolveLimit 根本没跑 ⇒ 无效值静默按默认走、stderr 一个字没有。反例断言点名,放行臂断言
// 合法值在同档不多打一行(不误伤)。
test('(a2) CLI --limit --staged:早退档仍点名无效值;--limit 5 --staged 合法值不多打一行(反例+放行成对)', () => {
  const dir = mkScratch('ihui-plan-line-age-staged-')
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const bad = spawnSync('node', [SCRIPT_PATH, '--limit', '--staged'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
    })
    assert.equal(bad.status, 0, `退回默认档不该改退出码,实际 ${bad.status}`)
    assert.match(
      bad.stderr,
      /忽略无效的 --limit 值: "--staged"/,
      `紧邻被顶值的那一支必须点名实得 token,不得静默:${bad.stderr}`,
    )
    assert.match(bad.stdout, /索引面没有历史可追溯/, 'staged 档既有语义一字未动(只补点名)')

    const ok = spawnSync('node', [SCRIPT_PATH, '--limit', '5', '--staged'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
    })
    assert.equal(ok.status, 0, `放行臂不该被误伤,实际 ${ok.status}`)
    assert.equal(ok.stderr.trim(), '', `合法值在同档不得多打一行:${ok.stderr}`)
    assert.match(ok.stdout, /索引面没有历史可追溯/, '放行臂 staged 语义同样不变')
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
  assert.match(code, /export\s*\{\s*flagValue\s*\}/, '判据从唯一出口 scripts/lib/flag-value.mjs 转出(§22c 单源),测试仍直接 import 本模块')
  assert.match(code, /export function resolveLimit\(/, '出口必须 export,否则测试只能抄一份判据')
  assert.match(code, /resolveLimit\(\s*argv\s*\)/, 'main 必须真调用出口')
  assert.match(code, /limitNotice\)\s*console\.error\(/, '点名必须走 stderr,否则 --json 的 stdout 被污染')
})

// ─── (d) 只 blame 未勾选行(2026-11-07):全文件 blame 已跑不进 180s 取票预算 ───
// 事故形态:PROJECT_PLAN.md 长到 29034 行 / 8.2MB 后,全文件 blame 实测 >240s(压缩对象库前后各测一次),
// 而 `plan-tasks.mjs` 每次 HEAD 面取数都要付这一笔 ⇒ A3 射程腿恒 unjudged(取票口 180s 被杀),
// 派发腿的 120s spawnSync 也恒超时 ⇒ 自 2026-10-30 起零派发。收窄到 open 行区间后实测 3.9s。
test('(d) mergeLineRanges 判据:乱序/重复/非法值都要收拾干净,连续段并成一段(变异 +1→+2 必红)', () => {
  assert.deepEqual(mergeLineRanges([9, 3, 4, 5, 7, 9, 10]), [[3, 5], [7, 7], [9, 10]], '乱序去重后按连续段合并')
  assert.deepEqual(mergeLineRanges([]), [], '空输入不得凭空造一个 0,0 区间')
  assert.deepEqual(mergeLineRanges([0, -3, 2, 2.5, 'x']), [[2, 2]], '非正整数一律丢弃(行号 0 不是合法行)')
  assert.deepEqual(mergeLineRanges([1, 2, 4, 5, 6]), [[1, 2], [4, 6]], '两个连续段不得并成一段')
  // 变异自证:把 "相邻 = prev+1" 放宽成 prev+2,上面两条必然塌成一段 ⇒ 判据有牙
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /if \(n === prev \+ 1\) \{/, '相邻判据必须是 n === prev + 1')
})

test('(d2) 行为双向:按区间 blame 与全量 blame 对同一批行给同一结论;空清单不派子进程', () => {
  const dir = mkScratch('ihui-plan-line-age-range-')
  const git = (args, env = {}) =>
    spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  try {
    git(['init', '-q', '.'])
    fs.writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), '# 计划\n- [ ] A\n- [ ] B\n- [ ] C\n')
    git(['add', '-A'])
    // 伪作者日期:blame 的 author-time 精度是秒,两笔同秒提交会让"第 2 行被刷新"这条前置恒假,
    // 于是比较本身恒真 —— 夹具不像被审对象时,判据坏了和夹具写错了在账面上长得一样(§22c)。
    git(['commit', '-q', '-m', 'first'], { GIT_AUTHOR_DATE: '2026-01-05T12:00:00+00:00', GIT_COMMITTER_DATE: '2026-01-05T12:00:00+00:00' })
    fs.writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), '# 计划\n- [ ] A\n- [ ] B 改\n- [ ] C\n')
    git(['add', '-A'])
    git(['commit', '-q', '-m', 'second'], { GIT_AUTHOR_DATE: '2026-09-20T12:00:00+00:00', GIT_COMMITTER_DATE: '2026-09-20T12:00:00+00:00' })
    const full = blameLineTimes(dir, 'HEAD', 'PROJECT_PLAN.md')
    const narrow = blameLineTimes(dir, 'HEAD', 'PROJECT_PLAN.md', [1, 3])
    assert.equal(narrow.size, 2, `只该量到点名的两行,实际 ${JSON.stringify([...narrow])}`)
    for (const ln of [1, 3]) assert.equal(narrow.get(ln), full.get(ln), `第 ${ln} 行两种取法必须同值`)
    // 行号口径:第 1 行是标题 `# 计划`,被第二次提交改写的是第 3 行(`- [ ] B 改`)
    assert.notEqual(full.get(3), full.get(1), '夹具必须让第 3 行真的被第二次提交刷新,否则上一条恒真')
    assert.equal(blameLineTimes(dir, 'HEAD', 'PROJECT_PLAN.md', []).size, 0, '空清单 ⇒ 空表,不派子进程')
    assert.ok(BLAME_RANGE_ARG_CAP >= 100, '区间上限不得退到个位数(真仓现读 11 个区间)')
  } finally {
    rmScratch(dir)
  }
})

test('(d3) headAges 必须把 open 行传给 blame(否则收窄整段失效,退化成全文件 >240s)', () => {
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8')
  const body = src.slice(src.indexOf('export function headAges'), src.indexOf('function main()'))
  assert.match(body, /parseTaskRows\(content\)/, 'headAges 必须先解析 open 行')
  assert.match(body, /blameLineTimes\(root, 'HEAD', PLAN_REL, openLines\)/, '必须把 openLines 传下去(变异掉这个实参 = 静默退回全量)')
  assert.match(body, /state === 'open'/, '只量未勾选行:已完成行会被归档搬走,判它年龄无意义')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
