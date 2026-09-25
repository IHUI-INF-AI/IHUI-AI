// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-tool-activity-coverage.mjs 的镜像测试(§22c:直接 import 源脚本的 __test__,
 * 不在测试里复制第二份判据)。跑法:
 *   node --test scripts/tests/check-tool-activity-coverage.test.mjs
 *
 * 本文件 2026-09-26 随该门的**取材面收口**一起建:该门此前只有内嵌 `--self-test`,没有入库的镜像测试,
 * 于是"判据改了、测试还对着旧行为"这一型无人可发现 —— 而收口这件事恰恰最需要一把能证明
 * "默认不再是磁盘"的尺子(结论行会被人改,函数不会)。
 *
 * 夹具一律落 `scripts/lib/scratch-dir.mjs`(工作树同盘 DevEnv/Temp),不落 C 盘活 TEMP、不落仓库树内。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-tool-activity-coverage.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = join(HERE, '..')
const REPO_ROOT = join(SCRIPTS_DIR, '..')
const OK_SELECT = '{state, select, running {正在做} completed {已做} other {做}}'
const OK_GENERIC =
  '{state, select, running {正在执行：{name}} completed {已完成：{name}} other {执行：{name}}}'

function git(cwd, ...args) {
  return execFileSync(
    gitBinary(),
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-c',
      'core.autocrlf=false',
      '-c',
      'user.name=gate-fixture',
      '-c',
      'user.email=gate-fixture@invalid',
      '-C',
      cwd,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/** 一份自洽的最小语料:1 个功能名 + 惯用档五语言齐 + 通用档在位 + floor=1 */
function corpusTexts() {
  const texts = new Map()
  texts.set(
    gate.TOOL_DISPLAY_REL,
    "const TOOL_DISPLAY_KEYS = {\n  read_file: 'toolReadFile',\n}\nexport { TOOL_DISPLAY_KEYS }\n",
  )
  texts.set(gate.FLOOR_REL, JSON.stringify({ floor: 1 }, null, 2) + '\n')
  for (const lang of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
    texts.set(
      `${gate.SHARED_DIR_REL}/${lang}.json`,
      JSON.stringify({
        taskStatus: {
          toolReadFile: `读取文件-${lang}`,
          toolReadFileActivity: OK_SELECT,
          toolGenericActivity: OK_GENERIC,
        },
      }),
    )
  }
  return texts
}

/**
 * 临时 git 仓(脚本 + 相对 import 闭包一起拷,否则 ERR_MODULE_NOT_FOUND;门按自身位置推 ROOT)。
 * `breakIndex` 复现真实故障形态:**索引里是被并行会话暂存的坏语料,磁盘已被改回好的,HEAD 是好的**。
 */
function createRepoEnv({ breakIndex = false } = {}) {
  const dir = mkScratch('tool-activity-coverage')
  copyScriptWithClosure(SCRIPTS_DIR, 'check-tool-activity-coverage.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
  ])
  const texts = corpusTexts()
  writeCorpus(dir, texts)
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'good baseline')
  if (breakIndex) {
    const broken = new Map(texts)
    broken.set(
      `${gate.SHARED_DIR_REL}/ja.json`,
      JSON.stringify({ taskStatus: { toolGenericActivity: OK_GENERIC } }),
    )
    writeCorpus(dir, broken)
    git(dir, 'add', '-A') // 索引 = 坏
    writeCorpus(dir, texts) // 磁盘回到好
  }
  return dir
}

function writeCorpus(dir, texts) {
  for (const [rel, text] of texts) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
}

function runScript(tempDir, args = []) {
  return spawnSync(
    process.execPath,
    [join(tempDir, 'scripts', 'check-tool-activity-coverage.mjs'), ...args],
    {
      cwd: tempDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

// ─── F1(纯函数,构造面):faceFromArgv 四态 —— "默认档判 HEAD 而非磁盘"的反向锁 ───
test('F1 faceFromArgv 默认必须是 head,四态齐全(把默认面改回磁盘的那一刻本条必红)', () => {
  assert.equal(gate.faceFromArgv([]).face, 'head', '默认档回到磁盘 = 本门又在判滞后工作树')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(String(both.error), /互斥/)
  assert.ok(gate.FACE_TXT.head && gate.FACE_TXT.staged && gate.FACE_TXT.worktree)
})

// ─── F2(构造面):三面各读各的;floor 基线必须与语料同面 ───
test('F2 readFaceInputs 三面互异:索引坏 / 磁盘好 / HEAD 好 ⇒ 三把结论各自成立', () => {
  const dir = createRepoEnv({ breakIndex: true })
  try {
    const rel = `${gate.SHARED_DIR_REL}/ja.json`
    const staged = gate.readFaceInputs(dir, 'staged')
    const wt = gate.readFaceInputs(dir, 'worktree')
    const head = gate.readFaceInputs(dir, 'head')
    assert.notEqual(
      staged.get(rel),
      wt.get(rel),
      '夹具本身必须让索引与磁盘互异,否则下面的差异可以是巧合',
    )
    assert.equal(
      gate.runChecks(staged).violations.some((v) => v.locale === 'ja'),
      true,
      '--staged 必须看见索引里那份坏语料(盘上随后改对不算修好)',
    )
    assert.equal(
      gate.runChecks(wt).violations.filter((v) => v.locale === 'ja').length,
      0,
      '逃生舱面读磁盘,必须是另一份结论',
    )
    assert.equal(
      gate.runChecks(head).violations.length,
      0,
      'HEAD 面必须绿 —— 并行会话的在途改动不得被记成本仓债务',
    )
    // floor 与语料同面:摘掉索引里的 floor ⇒ 无法判定,而不是"退回磁盘那份"
    git(dir, 'rm', '--cached', '-q', '-f', '--', gate.FLOOR_REL)
    assert.throws(
      () => gate.readFaceInputs(dir, 'staged'),
      (e) => /无法判定/.test(e.message) && e.constructor.name === 'Undetermined',
      '取不到输入时回落另一个面 = 把"没判"写成"判过了"',
    )
    assert.ok(gate.readFaceInputs(dir, 'head').get(gate.FLOOR_REL), '判死必须精确绑定缺失的那一面')
  } finally {
    rmScratch(dir)
  }
})

// ─── F3(CLI 成对):默认绿 / --staged 红且末行写面 / 两面旗同给 exit 2 ───
test('F3 CLI 三面各判各的:索引漂而磁盘好 ⇒ 默认绿、--staged 红、--worktree 绿;两面旗同给 ⇒ exit 2', () => {
  const dir = createRepoEnv({ breakIndex: true })
  try {
    const head = runScript(dir)
    assert.equal(head.status, 0, `默认档判 HEAD(好的那一份)\n${head.stdout}${head.stderr}`)
    assert.match(head.stdout, /取材面:HEAD blob/, '绿灯结论行必须写明判的是 HEAD')
    assert.match(head.stdout, /惯用档 1\/1\(基线 1/, '结论行必须带计数(扫到 0 却报绿要被看得见)')

    const staged = runScript(dir, ['--staged'])
    assert.equal(
      staged.status,
      1,
      `索引里是坏语料,--staged 必须红\n${staged.stdout}${staged.stderr}`,
    )
    assert.match(staged.stderr, /\[ja\]/, '必须点名索引里缺值的那门语言')
    assert.match(staged.stderr, /Found \d+ 处\(取材面:索引 blob/, '红灯末行也必须写明面')

    const wt = runScript(dir, ['--worktree'])
    assert.equal(wt.status, 0, `磁盘是好的,逃生舱档必须绿\n${wt.stdout}${wt.stderr}`)
    assert.match(wt.stdout, /取材面:工作树/, '逃生舱档也要说清自己判的是磁盘')

    const both = runScript(dir, ['--staged', '--worktree'])
    assert.equal(both.status, 2, '两面旗同给必须判死')
    assert.match(both.stderr, /互斥/)
  } finally {
    rmScratch(dir)
  }
})

// 自检也按当次判定面跑(原来它无条件读磁盘 ⇒ 并行会话的半编辑语料会把"本门自己坏了"当成结论)。
// 夹具仓只有 1 个功能名,而 self-test 内建"真仓功能名 >50"的取材有效性断言,所以这条只能在真仓跑。
test('F3b --self-test 在真仓默认面(HEAD)必须全过', () => {
  const r = spawnSync(
    process.execPath,
    [join(SCRIPTS_DIR, 'check-tool-activity-coverage.mjs'), '--self-test'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`)
  assert.match(
    r.stdout,
    /现存语料 0 命中\(有命中说明判据误伤或语料真缺,须先修再入库;取材面:HEAD blob/,
  )
})

// ─── F4 形状锁:磁盘直读与散写 git 都不得回来 ───
test('F4 形状锁:门本体不得再按磁盘读仓库内容,取材必须走共用层', () => {
  const src = readFileSync(join(SCRIPTS_DIR, 'check-tool-activity-coverage.mjs'), 'utf8')
  assert.doesNotMatch(
    src,
    /readFileSync\(\s*resolve\(\s*ROOT/,
    '磁盘直读又回来了(resolve(ROOT,…) 那一型)',
  )
  assert.doesNotMatch(
    src,
    /readFileSync\(\s*join\(\s*ROOT/,
    '磁盘直读又回来了(join(ROOT,…) 那一型)',
  )
  assert.doesNotMatch(
    src,
    /readFileSync\(\s*TOOL_DISPLAY/,
    '旧的常量拼路径直读必须整段消失(它就是本门的病灶)',
  )
  assert.doesNotMatch(src, /existsSync\(/, '旧 existsSync→{} 的静默分支不得留在门本体里')
  assert.doesNotMatch(
    src,
    /from 'node:fs'/,
    '门本体不得自带磁盘读取 —— 磁盘面只走层的 readWorktreeFile',
  )
  assert.match(
    src,
    /from '\.\/lib\/face-reader\.mjs'/,
    '取材必须走共用层(绝对路径 git/超时/截断都由层兜)',
  )
  assert.match(src, /catBatch\(/, '内容必须经层的批量读取(一次派生,同面同轮)')
})

// ─── F5 装车证明:真仓 HEAD 面判 0 违规(取材面收口前它按磁盘判,当日即红)───
// 刻意**不**加"磁盘面必须与 HEAD 面异形"的断言:那是一个只在"别人正好在改语料"时成立的性质,
// 语料一收敛它就会红 —— 把瞬时的世界状态写成常驻判据,正是本票要消灭的那一类假缺陷。
// "两面各读各的、异形可被构造出来"这件事由 F2/F3 在临时 git 仓里证明(构造面,不赌世界状态)。
test('F5 装车证明:真仓 HEAD 面判 0 违规且不是空扫', () => {
  const head = gate.runChecks(gate.readFaceInputs(REPO_ROOT, 'head'))
  assert.equal(
    head.violations.length,
    0,
    `HEAD 语料必须 0 命中:\n${JSON.stringify(head.violations.slice(0, 5))}`,
  )
  assert.ok(head.total > 50, `功能名抽取不得为空扫(实得 ${head.total})`)
  assert.ok(head.covered >= head.floor, `floor 倒退不得存在(实得 ${head.covered} < ${head.floor})`)
  assert.deepEqual(
    head.missingLocales,
    [],
    '五个语言包必须都在 HEAD 面上(缺一整个面就是"少扫一整批")',
  )
})

// ─── F6 判据纯度(取材无关的那三条判据必须照旧有牙)───
test('F6 键形 / 通用档 / 两态三条判据在构造输入上各判各的', () => {
  const mk = (over = {}) =>
    Object.fromEntries(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'].map((l) => [l, over[l] ?? {}]))
  assert.equal(
    gate.validateActivityValues(['toolA'], mk({})).length,
    0,
    '未配置惯用档不算形错(走 floor 计数)',
  )
  assert.equal(
    gate.validateActivityValues(['toolA'], mk({ ja: { toolAActivity: OK_SELECT } })).length,
    1,
    '五语言不齐必须点名缺的那四语',
  )
  const generic = (v) =>
    mk(
      Object.fromEntries(
        ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'].map((l) => [l, { toolGenericActivity: v }]),
      ),
    )
  assert.equal(gate.validateGenericValue(generic(OK_GENERIC)).length, 0)
  assert.equal(
    gate.validateGenericValue(
      generic('{state, select, running {正在执行} completed {已完成} other {执行}}'),
    ).length,
    15,
    // 三支分支各有 5 语言漏 {name} ⇒ 3 × 5 = 15(工具身份会丢)。按"每语言一条"预期会把判据
    // 的粒度写错,而错的粒度下次收紧时就是假绿 —— 期望值必须来自判据实际计数,不是叙述。
    '通用档不嵌 {name} ⇒ 三个分支 × 五语言各计一次',
  )
  assert.equal(
    gate.validateTwoState(
      ['toolA'],
      mk(
        Object.fromEntries(
          ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'].map((l) => [
            l,
            {
              toolA: 'A',
              toolAActivity: '{state, select, running {做} completed {做} other {做}}',
            },
          ]),
        ),
      ),
    ).length,
    5,
    '两态串相同 ⇒ 界面分不出在做/做完,必须逐语言判红',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
