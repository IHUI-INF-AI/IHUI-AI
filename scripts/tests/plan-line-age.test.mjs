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
import { parseTaskRows } from '../lib/plan-task-index.mjs'
import {
  flagValue,
  resolveLimit,
  DEFAULT_LIMIT,
  mergeRowLinesToBlocks,
  blameLineTimes,
  headAges,
} from '../lib/plan-line-age.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO = path.resolve(__dirname, '..', '..')
const SCRIPT_PATH = path.join(REPO, 'scripts', 'lib', 'plan-line-age.mjs')

// ─── 判据本体(flagValue):正例与反例成对,免得"名单是张死表" ───
test('flagValue 判据:紧邻 token 不存在 / 空 / 以 - 开头 ⇒ 不算值;合法值仍算值(正反成对)', () => {
  assert.equal(
    flagValue(['--limit', '--json'], '--limit').valid,
    false,
    '相邻旗标不得被当成本旗标的值',
  )
  assert.equal(flagValue(['--limit'], '--limit').valid, false, '其后没有参数不得被当成有值')
  assert.equal(flagValue(['--limit', ''], '--limit').valid, false, '空串不是值')
  assert.equal(
    flagValue(['--limit', '-5'], '--limit').token,
    '-5',
    'token 必须原样带回去(拒绝时要点名)',
  )
  assert.equal(
    flagValue(['--limit', '30'], '--limit').value,
    '30',
    '合法值必须放行(否则校验变成永拒)',
  )
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
  assert.deepEqual(
    resolveLimit(['--limit', '30']),
    { limit: 30, notice: null },
    '合法数字必须被采纳',
  )
  assert.deepEqual(
    resolveLimit(['--limit', '0']),
    { limit: 0, notice: null },
    '0 不是无效值,不得改语义',
  )
  assert.deepEqual(
    resolveLimit(['--json', '--limit', '7']),
    { limit: 7, notice: null },
    '旗标顺序无关',
  )
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
    assert.equal(
      JSON.parse(plain.stdout).top.length,
      parsed.top.length,
      '无效值那份清单必须等于默认档',
    )
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
  assert.match(
    code,
    /export\s*\{\s*flagValue\s*\}/,
    '判据从唯一出口 scripts/lib/flag-value.mjs 转出(§22c 单源),测试仍直接 import 本模块',
  )
  assert.match(code, /export function resolveLimit\(/, '出口必须 export,否则测试只能抄一份判据')
  assert.match(code, /resolveLimit\(\s*argv\s*\)/, 'main 必须真调用出口')
  assert.match(
    code,
    /limitNotice\)\s*console\.error\(/,
    '点名必须走 stderr,否则 --json 的 stdout 被污染',
  )

  // ─── 区间档(2026-11-05 立):只追登记行,与整档逐行等值 ───
  // 三条源码锁一律写成**折行可容**形态:prettier 会把数组元素逐行摊开,拿一行字面量
  // 当尺子的锁会在格式化当天静默失明(本文件同族教训见 §22c 形状锁纪律)。
  assert.match(
    code,
    /'--line-porcelain',\s*\.\.\.rangeArgs,\s*rev,/,
    '区间必须排在 rev 之前(git 的 -L 是选项,放在 rev 后会被当成路径解析)',
  )
  assert.match(
    code,
    /'rev-parse',\s*'HEAD'/,
    'headAges 必须先钉死那一枚提交(分两次现读 HEAD 会把行号错配到不同面)',
  )
  assert.match(
    code,
    /blocks\.length\s*\?\s*blameLineTimes\(\s*root,\s*rev,\s*PLAN_REL,\s*blocks\s*\)\s*:\s*new Map\(\)/,
    '0 枚未勾行 ⇒ 一次 blame 都不派',
  )
})

test('mergeRowLinesToBlocks:相邻并块、跨 gap 断块、去重、排序、坏输入剔除(成对)', () => {
  const M = mergeRowLinesToBlocks
  assert.deepEqual(M([]), [], '空输入不得造出空块')
  assert.deepEqual(M([7]), [[7, 7]], '单行成一块')
  assert.deepEqual(M([3, 4, 5]), [[3, 5]], '连续行并入一块')
  assert.deepEqual(M([1, 13], 12), [[1, 13]], 'gap 恰等于阈值 ⇒ 仍并(边界成对:≤ 并)')
  assert.deepEqual(
    M([1, 14], 12),
    [
      [1, 1],
      [14, 14],
    ],
    '越过阈值 ⇒ 断成两块(边界成对:> 断)',
  )
  assert.deepEqual(
    M([9, 2, 9, 3], 4),
    [
      [2, 3],
      [9, 9],
    ],
    '乱序入、重复入 ⇒ 排序去重后按 gap=4 出两块(默认 gap=12 会把 3↔9 并掉,所以显式给)',
  )
  assert.deepEqual(M([0, -3, NaN, 'x', 4]), [[4, 4]], '非正/非数一律剔除,不静默造出 -L0,4')
  assert.deepEqual(M(null), [], '没给行号 ⇒ 没块(而不是整档)')
})

test('区间档与整档逐行等值(临时真仓,两臂同枚提交;摘掉 blocks 即回归整档成本)', () => {
  const dir = mkScratch('plan-line-age-ranges')
  try {
    const g = (args) => {
      const r = spawnSync('git', ['-C', dir, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
      return r
    }
    g(['init', '-q'])
    g(['config', 'user.email', 't@example.invalid'])
    g(['config', 'user.name', 'fixture'])
    // 20 行正文,未勾选登记行落在第 2、3、18 行(gap 会折成 2 块 ⇒ 真验"多枚 -L 一次调用")
    const rows = ['# 计划', '- [ ] K1 第一枚 (2026-01-02)', '- [ ] K2 第二枚 (2026-01-03)']
    for (let i = 4; i <= 17; i++) rows.push(`正文第 ${i} 行`)
    rows.push('- [ ] K3 第三枚 (2026-01-18)')
    rows.push('正文第 19 行')
    rows.push('正文第 20 行')
    fs.writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), rows.join('\n') + '\n')
    g(['add', 'PROJECT_PLAN.md'])
    g(['commit', '-q', '-m', 'first'])
    // 第二枚提交只动"正文第 20 行"——登记行一行没动:等值断言才有牙(区间若被 gap 抹平会读成同一天)
    fs.appendFileSync(path.join(dir, 'PROJECT_PLAN.md'), '')
    const changed = fs
      .readFileSync(path.join(dir, 'PROJECT_PLAN.md'), 'utf8')
      .replace('正文第 20 行', '正文第 20 行(改过)')
    fs.writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), changed)
    g(['add', 'PROJECT_PLAN.md'])
    g(['commit', '-q', '-m', 'touch-prose'])

    const rev = g(['rev-parse', 'HEAD']).stdout.trim()
    const content = g(['show', `${rev}:PROJECT_PLAN.md`]).stdout
    const openLines = parseTaskRows(content)
      .filter((r) => r.state === 'open')
      .map((r) => r.line)
    assert.deepEqual(openLines, [2, 3, 18], '夹具的未勾选行必须落在这三个行号上,否则本断言组是空转')
    const blocks = mergeRowLinesToBlocks(openLines)
    assert.deepEqual(
      blocks,
      [
        [2, 3],
        [18, 18],
      ],
      '两块:验证一次调用带多枚 -L',
    )

    const full = blameLineTimes(dir, rev)
    const ranged = blameLineTimes(dir, rev, 'PROJECT_PLAN.md', blocks)
    assert.ok(ranged.size < full.size, `区间档应只回被问的行(实测 ${ranged.size} vs ${full.size})`)
    for (const ln of openLines) {
      assert.equal(ranged.get(ln), full.get(ln), `第 ${ln} 行时刻两臂必须逐字等值`)
      assert.ok(Number.isFinite(ranged.get(ln)), `第 ${ln} 行必须量到时刻,不能是 undefined`)
    }
    // 反向锁:第二枚提交改过的那一行(第 20 行)不在区间档里 —— 它就是"少做事"的那一侧
    assert.equal(ranged.has(20), false, '没人问的行不该出现在区间档里')

    const h = headAges(dir)
    assert.equal(h.blameShape.blamed, true)
    assert.equal(h.blameShape.blocks, 2)
    assert.equal(h.ages.length, 3, '年龄表枚数 = 未勾选登记行枚数')
    assert.equal(h.blameShape.rev, rev, '必须钉在调用方那枚提交上,不是漂移中的 HEAD')

    // 0 枚未勾行 ⇒ 一次 blame 都不派(成本落在"少做",不落在"多做")
    fs.writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), '# 计划\n- [x] K9 已结清 (2026-01-01)\n')
    g(['add', 'PROJECT_PLAN.md'])
    g(['commit', '-q', '-m', 'all-closed'])
    const none = headAges(dir)
    assert.equal(none.blameShape.blamed, false, '没有未勾选行时不许派 blame')
    assert.deepEqual(none.ages, [], '年龄表为空,而不是"看起来都很新"')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
