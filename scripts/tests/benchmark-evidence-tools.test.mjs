// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:钉住两件常驻取证工具(scripts/benchmark-asar-read.mjs /
// scripts/benchmark-diff-matrix.mjs)的不变量。
//
// 为什么需要它:这两件工具此前躺在 docs/benchmark-evidence/2026-09/ 里**没有任何自检**,
// 解析判据坏了不会有人喊(本仓反复登记的"造好没装车 / 有代码无尺子"那一型)。
// 本文件按 §22c 直接 import 源模块的 __test__,不复制任何一份解析规则 —— 而"镜像测试只复读
// 实现就是复读机",所以另配三把**独立**尺子:
//   ① 原始字节定位:在夹具文件里 indexOf(植入内容) 与解析器自报的数据区起点对账,并强制
//      "off-by-8 那一格必须落在另一个位置"(否则构造夹具本身在替解析器背书);
//   ② 端到端 spawn:走真实 CLI 的 stdout 与非零退出码,而不是只调函数;
//   ③ 真语料:拿 docs/benchmark-evidence/2026-09 的三份竞品清单喂判据(§22c"输入必须逐字
//      取自真实文件",不得全部用自造夹具)。
// §22d:两件工具底部把 CLI 入口与模块导出分开(isDirectRun),import 本文件不得触发 main()。
//
// 每条断言的"什么时候会红"写在它自己的断言消息里 —— 只有正例、永远不可能红的断言本文件不收。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as asar } from '../benchmark-asar-read.mjs'
import { __test__ as matrixTool } from '../benchmark-diff-matrix.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const ASAR_TOOL = path.join(ROOT, 'scripts', 'benchmark-asar-read.mjs')
const MATRIX_TOOL = path.join(ROOT, 'scripts', 'benchmark-diff-matrix.mjs')
const ASAR_TOOL_SRC = fs.readFileSync(ASAR_TOOL, 'utf8')
const MATRIX_TOOL_SRC = fs.readFileSync(MATRIX_TOOL, 'utf8')
const SELF_SRC = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')

const run = (args, opts = {}) =>
  execFileSync(process.execPath, args, {
    encoding: 'utf8',
    windowsHide: true,
    cwd: ROOT,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  })

// 跑 CLI 并兜住非零退出码,把 status/stdout/stderr 一次交回(反向对照要用 status)。
const runSettled = (args, opts = {}) => {
  try {
    return { status: 0, stdout: run(args, opts), stderr: '' }
  } catch (e) {
    return {
      status: typeof e.status === 'number' ? e.status : -1,
      stdout: String(e.stdout || ''),
      stderr: String(e.stderr || ''),
    }
  }
}

const PLANTED_JSON = '{"name":"mirror-app","version":"1.2.3","marker":"MIRROR-MARKER-7"}'
const PLANTED_TEXT = 'const mirror = "MIRROR-MARKER-7"; // 可读文本条目\n'
const PLANTED_LOUD = Buffer.concat([
  Buffer.from('const noisy = "MIRROR-MARKER-7";\n', 'utf8'),
  Buffer.alloc(80, 1), // 80 个 0x01 —— 控制字符闸必须把它挡在 --grep 命中之外
])
const PLANTED_UNPACKED = 'chrome: "#a3c4d6"\n'

function buildFixture(dir) {
  const asarPath = path.join(dir, 'mirror.asar')
  const built = asar.buildAsarFixture(asarPath, [
    { path: '/package.json', content: PLANTED_JSON },
    { path: '/out/renderer/mirror.js', content: PLANTED_TEXT },
    { path: '/out/noisy.js', content: PLANTED_LOUD },
    { path: '/empty.md', content: '' },
    { path: '/loose/chrome.yaml', content: PLANTED_UNPACKED, unpacked: true },
  ])
  fs.mkdirSync(path.join(dir, 'mirror.unpacked', 'loose'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'mirror.unpacked', 'loose', 'chrome.yaml'), PLANTED_UNPACKED)
  return { asarPath, built }
}

// ---------- T1 §22c/§22d 形状锁:导出成套 + 入口与导出分离 ----------

test('T1 两件工具都导出成套 __test__,且 import 它们没有触发 main()(§22d)', () => {
  for (const key of [
    'readAsarHeader',
    'flatten',
    'readEntry',
    'openAsar',
    'grepTargets',
    'buildAsarFixture',
    'runSelfTest',
  ]) {
    assert.ok(key in asar, `benchmark-asar-read 的 __test__ 缺少键 ${key}`)
  }
  for (const key of [
    'loadInventory',
    'catOf',
    'collectSides',
    'buildRows',
    'buildMatrix',
    'zeroOursCats',
    'rivalOnlyCats',
    'runSelfTest',
  ]) {
    assert.ok(key in matrixTool, `benchmark-diff-matrix 的 __test__ 缺少键 ${key}`)
  }
  // 位置锁(§22d):__test__ 的 export 必须在 isDirectRun 守卫**之后**。顺序倒了意味着有人把
  // main() 挪回顶层 —— 测试一 import 就会 process.exit,把 node --test 的进程直接打死。
  for (const [name, srcText] of [
    ['benchmark-asar-read', ASAR_TOOL_SRC],
    ['benchmark-diff-matrix', MATRIX_TOOL_SRC],
  ]) {
    const guard = srcText.indexOf('isDirectRun')
    const exp = srcText.indexOf('export const __test__')
    assert.ok(guard > 0, `${name} 源码里找不到 isDirectRun 守卫`)
    assert.ok(exp > guard, `${name} 的 __test__ export 必须在 isDirectRun 守卫之后(§22d)`)
    assert.ok(
      srcText.includes('pathToFileURL'),
      `${name} 必须经 pathToFileURL 归一后再比对(Windows 反斜杠路径直拼 file:// 永不匹配)`,
    )
  }
})

// ---------- T2 反向锁:镜像测试不得自己抄一份解析规则 ----------

test('T2 本测试文件不得自带解析规则片段(规则只许住在生产模块里)', () => {
  // 三个片段分成两段写:值拼得出来,但本文件的源码里不会出现连续字面量,
  // 于是"自己抄了一份判据还顺手把它写进反向锁"这一型能被抓住(锁不会自杀)。
  const PICKLE_RULE = 'readUInt' + '32LE' // asar 头解析
  const HEADING_RULE = '#' + '{1,4}' // markdown 小节
  const BULLET_RULE = '[-' + '*]\\s' // markdown 条目
  for (const rule of [PICKLE_RULE, HEADING_RULE, BULLET_RULE]) {
    assert.ok(
      !SELF_SRC.includes(rule),
      `镜像测试不得自带解析规则片段 ${rule} —— 判据只能在 scripts/benchmark-*.mjs 里(§22c 两份真相必漂移)`,
    )
  }
  // 正向对照:这三条判据确实**住在**生产模块里。摘走了 ⇒ 本文件测的东西不再存在,当场红。
  assert.ok(ASAR_TOOL_SRC.includes(PICKLE_RULE), 'asar 头解析判据不在生产模块里了')
  assert.ok(MATRIX_TOOL_SRC.includes(HEADING_RULE), '小节解析判据不在生产模块里了')
  assert.ok(MATRIX_TOOL_SRC.includes(BULLET_RULE), '条目解析判据不在生产模块里了')
})

// ---------- T3 asar:头解析 + 独立字节尺子 ----------

test('T3 数据区起点由独立尺子复核(不是解析器自报自话)', () => {
  const dir = mkScratch('bench-asar-t3')
  try {
    const { asarPath, built } = buildFixture(dir)
    const opened = asar.openAsar(asarPath)
    const raw = fs.readFileSync(asarPath)
    try {
      const entry = opened.all.find((f) => f.path === '/out/renderer/mirror.js')
      assert.ok(entry, 'flatten 没把植入条目列进清单')
      const located = raw.indexOf(Buffer.from(PLANTED_TEXT, 'utf8'))
      assert.ok(located > 0, '夹具里没有植入内容(构建器坏了)')
      // 正例:解析器自报的 DATA_START + offset 必须与"字节实际所在"逐位相等。
      assert.equal(located, opened.DATA_START + entry.offset)
      // 反例的牙:经典 off-by-8(把 header 块大小当数据区起点)必须落在**另一个**位置,
      // 否则这条断言对那一型错误完全不敏感。DATA_START 被写成 headerSize 时这两条各红一次。
      assert.notEqual(located, opened.headerSize + entry.offset)
      assert.equal(opened.DATA_START, 8 + opened.headerSize)
      assert.equal(opened.DATA_START, built.dataStart)
      // 物理量对账:文件总字节 = 数据区起点 + 数据区长。长度由**本文件自己植入的三份内容**
      // 算出(unpacked 那份不占数据区),不引用解析器报出的 size 数字 —— 否则这条就成了自证。
      const dataLen =
        Buffer.byteLength(PLANTED_JSON) + Buffer.byteLength(PLANTED_TEXT) + PLANTED_LOUD.length
      assert.equal(raw.length, opened.DATA_START + dataLen)
      // unpacked 条目必须从同名 .unpacked 目录取字节(不看 offset)。
      const loose = opened.all.find((f) => f.path === '/loose/chrome.yaml')
      assert.equal(loose.unpacked, true)
      assert.equal(
        asar.readEntry(opened.fd, asarPath, opened.DATA_START, loose).toString('utf8'),
        PLANTED_UNPACKED,
      )
    } finally {
      fs.closeSync(opened.fd)
    }
  } finally {
    rmScratch(dir)
  }
})

test('T4 夹具必须真触发尾部 NUL 补齐,否则剥离判据无判据', () => {
  const dir = mkScratch('bench-asar-t4')
  try {
    const { built } = buildFixture(dir)
    // 红法:植入内容长度被改成恰好 4 字节对齐(这格就没被喂到),或构建器不再补 NUL。
    assert.ok(built.padding > 0, `本次 padding=${built.padding},夹具没触发 NUL 补齐这一格`)
    assert.equal(built.headerSize % 4, 0, `header 块未按 4 字节对齐:${built.headerSize}`)
    // 补齐过而解析仍成功 ⇒ 说明 replace 尾串 NUL 那一步真在起作用(摘掉它 JSON.parse 必抛)。
    const opened = asar.openAsar(path.join(dir, 'mirror.asar'))
    try {
      assert.equal(typeof opened.tree.files, 'object')
    } finally {
      fs.closeSync(opened.fd)
    }
  } finally {
    rmScratch(dir)
  }
})

test('T4b flatten 的 size 判据三态(搬家把 != null 写成两判,等价性由这一格证明)', () => {
  const dir = mkScratch('bench-asar-t4b')
  try {
    const asarPath = path.join(dir, 'odd.asar')
    asar.buildAsarFixture(asarPath, [
      { path: '/f/ZERO.bin', leaf: { size: 0, offset: 0 } },
      { path: '/f/FALSE.bin', leaf: { size: false, offset: 0 } },
      { path: '/f/EMPTY.bin', leaf: { size: '', offset: 0 } },
      { path: '/f/NULL.bin', leaf: { size: null, offset: 0 } },
      { path: '/f/ABSENT.bin', leaf: { offset: 7 } },
    ])
    const opened = asar.openAsar(asarPath)
    try {
      // 红法①:有人"顺手简化"成 if (v.size) ⇒ 0 / false / '' 三种值全被吞,这里读到空数组。
      // 红法②:改成只判 undefined ⇒ NULL.bin 混进清单。两种都当场红。
      assert.deepEqual(opened.all.map((f) => f.path).sort(), [
        '/f/EMPTY.bin',
        '/f/FALSE.bin',
        '/f/ZERO.bin',
      ])
      assert.equal(opened.all.find((f) => f.path === '/f/ZERO.bin').size, 0)
    } finally {
      fs.closeSync(opened.fd)
    }
  } finally {
    rmScratch(dir)
  }
})

// ---------- T5 asar:CLI 端到端(含控制字符闸的正反两向) ----------

test('T5 --list / --get / --grep 端到端:量得到东西,且控制字符型条目被挡住', () => {
  const dir = mkScratch('bench-asar-t5')
  try {
    const { asarPath } = buildFixture(dir)
    const listed = run([ASAR_TOOL, asarPath, '--list'])
    assert.match(listed, /# 命中 5 \/ 总 5/, `清单读数不对:\n${listed}`)
    // 路径正则那一档也必须真筛(整条 filter 被摘掉时这里红)。
    const filtered = run([ASAR_TOOL, asarPath, '--list', '^/out/'])
    assert.match(filtered, /# 命中 2 \/ 总 5/, filtered)

    const got = run([ASAR_TOOL, asarPath, '--get', '/package.json'])
    assert.equal(JSON.parse(got).name, 'mirror-app')

    const grepped = run([ASAR_TOOL, asarPath, '--grep', 'MIRROR-MARKER-7'])
    assert.match(
      grepped,
      /\/out\/renderer\/mirror\.js/,
      '文本型条目没被捞到(判据对该形态失明):\n' + grepped,
    )
    assert.ok(
      !grepped.includes('/out/noisy.js'),
      '控制字符型条目本应被挡,却被捞出来了:\n' + grepped,
    )
    // noisy.js 含同一个 marker 且扩展名在文本表里 ⇒ 挡下它的只有控制字符闸;那道 compare 被
    // 放宽或摘掉 ⇒ 命中数变 3、这一条当场红(反向对照)。
    assert.match(grepped, /# 扫了 4 个文本型条目,命中 2 个文件/, grepped)

    // 只列文件名的那一档:命中行还在,但逐条摘要行必须消失。
    const filesOnly = run([ASAR_TOOL, asarPath, '--grep', 'MIRROR-MARKER-7'], {
      env: { ...process.env, ASAR_FILES_ONLY: '1' },
    })
    assert.match(filesOnly, /\/out\/renderer\/mirror\.js/, filesOnly)
    assert.ok(!/^\s{3}\S/m.test(filesOnly), `ASAR_FILES_ONLY=1 仍打出生成摘要:\n${filesOnly}`)

    const missing = runSettled([ASAR_TOOL, asarPath, '--get', '/nope.js'])
    assert.equal(missing.status, 1, '清单里没有该路径必须非零退出')
    assert.match(missing.stderr, /不在清单里/, missing.stderr)

    const unknown = runSettled([ASAR_TOOL, asarPath, '--nope'])
    assert.equal(unknown.status, 2, '未知模式必须 exit 2')
  } finally {
    rmScratch(dir)
  }
})

test('T6 asar 工具自检端到端可跑,末行必须报"失败 0"', () => {
  const out = run([ASAR_TOOL, '--self-test'])
  assert.match(out, /# 自检 \d+ 条,通过 \d+,失败 0/, `自检末行不是"失败 0":\n${out}`)
})

// ---------- T7 diff-matrix:真形态清单的归一与判序 ----------

const OURS_MD = [
  '# 2 思考与推理',
  '- 思考摘要折叠展示',
  '# 5 文件与diff',
  '- 变更卡支持保留/撤销两个动作',
  '# 7 子代理与后台',
  '- 子代理状态词汇六档',
  '这是一段说明文字,不是条目',
  '> 引用行也不是条目',
  '',
].join('\n')

// 竞品侧刻意与 OURS_MD 在 cat 5 上**重叠**:两端都有条目的一类必须不被列成差距 ——
// 若 rivalOnlyCats 的"我方零条目"那一半条件被摘掉,该断言当场红(否则反证没有牙)。
const RIVAL_MD = [
  '# 16 记忆规则技能',
  '- 记忆面板与规则条目',
  '* 技能市场入口',
  '# 5 文件与diff',
  '- 变更条目支持 accept/reject',
  '# 12 错误降级重试',
  '##### 五级标题不该成为小节',
  '- 连接中断后自动 fallback 重试',
  '',
].join('\n')

function buildMatrixFixture(dir, { withOurs = true } = {}) {
  if (withOurs) {
    fs.mkdirSync(path.join(dir, 'ours'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'ours', 'chat-stream-inventory.md'), OURS_MD)
  }
  fs.mkdirSync(path.join(dir, 'qoder'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'qoder', 'chat-stream-inventory.md'), RIVAL_MD)
  return dir
}

test('T7 归一判据:条目/小节/多类归属都量得到,prose 与深标题不被误收', () => {
  const dir = mkScratch('bench-matrix-t7')
  try {
    buildMatrixFixture(dir)
    const ours = matrixTool.loadInventory(dir, matrixTool.FILES.ours)
    const rival = matrixTool.loadInventory(dir, matrixTool.FILES.qoder)
    assert.equal(ours.items.length, 3, `我方侧条目数不对:${JSON.stringify(ours.items)}`)
    assert.equal(rival.items.length, 4, `竞品侧条目数不对:${JSON.stringify(rival.items)}`)
    assert.ok(ours.lines > 0 && rival.lines > 0, '行数没量到')
    assert.ok(
      !ours.items.some((i) => i.text.includes('说明文字') || i.text.includes('引用行')),
      'prose/引用行被当成条目了',
    )
    // 深标题判序:##### 不得改小节。判据被写成 #{1,} 时这条红。
    assert.equal(rival.items[3].section, '12 错误降级重试')
    // 一条可归多类:CATS 用 filter 不是 find(写成 find 时第二条命中丢失 ⇒ 红)。
    const cats = matrixTool.catOf(rival.items[3])
    assert.ok(cats.includes('12 错误降级重试'), `应命中 12:${cats}`)
    assert.ok(cats.includes('11 队列转向中断'), `应同时命中 11(中断):${cats}`)
    // * 号与 - 号同算。
    assert.equal(rival.items[1].text, '技能市场入口')
  } finally {
    rmScratch(dir)
  }
})

test('T8 两条零条目判据双向都有牙(判序写反当场红)', () => {
  const dir = mkScratch('bench-matrix-t8')
  try {
    buildMatrixFixture(dir)
    const m = matrixTool.buildMatrix(dir)
    assert.equal(m.oursIn, true)
    assert.equal(m.status.codex, '文件不在位(未交付或仍在写)', '缺失侧必须明写"文件不在位"')
    assert.equal(
      matrixTool.MISSING_NOTE,
      '文件不在位(未交付或仍在写)',
      '文案与 README 引用的字面量漂了',
    )
    assert.match(m.status.ours, /^3 条 \/ \d+ 行$/, `我方读数不对:${m.status.ours}`)
    const zeros = matrixTool.zeroOursCats(m.rows)
    const rivalOnly = matrixTool.rivalOnlyCats(m.rows, m.present)
    const rivalNames = rivalOnly.map((r) => r.catName)
    // 正例:竞品有而我方零 ⇒ 必须点名。
    assert.ok(rivalNames.includes('16 记忆规则技能'), `16 类应被列为竞品独有:${rivalNames}`)
    const c16 = rivalOnly.find((r) => r.catName === '16 记忆规则技能')
    assert.equal(c16.rivals.map(([k]) => k).join(','), 'qoder')
    assert.equal(c16.cell.qoder.length, 2)
    assert.ok(zeros.includes('16 记忆规则技能'), '我方零条目维没点名 16 类')
    // 反例(牙):cat 5 两端都有条目 ⇒ 不得被列成"竞品有而我方零"。
    assert.ok(rivalOnly.length > 0, '竞品独有名恒空 ⇒ 判据对该形态失明')
    assert.ok(!rivalNames.includes('5 文件与diff'), `5 类两端都有条目,不该被列为差距:${rivalNames}`)
    assert.ok(!rivalNames.includes('2 思考与推理'), `2 类我方有条目:${rivalNames}`)
    assert.ok(
      rivalOnly.every((r) => r.cell.ours.length === 0),
      '竞品独有名里混进了我方有条目的类 ⇒ "我方零条目"那一半判序失效',
    )
    assert.ok(
      !zeros.includes('5 文件与diff') && !zeros.includes('2 思考与推理'),
      '我方有条目的类被列进零条目名',
    )
    assert.ok(zeros.length > 0, '零条目名恒空 ⇒ 强信号那一维无人看守')
  } finally {
    rmScratch(dir)
  }
})

test('T9 我方清单缺失 ⇒ 判"无法生成",不产出矩阵(不得把没判写成判过了)', () => {
  const dir = mkScratch('bench-matrix-t9')
  try {
    buildMatrixFixture(dir, { withOurs: false })
    const m = matrixTool.buildMatrix(dir)
    assert.equal(m.oursIn, false)
    assert.equal(m.rows.length, 0, '我方缺失时不得生成 rows')
    assert.equal(m.status.ours, matrixTool.MISSING_NOTE)
    assert.equal(matrixTool.zeroOursCats(m.rows).length, 0)
    const out = run([MATRIX_TOOL, dir])
    assert.match(out, /无法生成对账矩阵/, out)
    assert.ok(!out.includes('# 分桶计数'), '判不出却印了矩阵表头 ⇒ 把"没判"写成了"判过了"')
  } finally {
    rmScratch(dir)
  }
})

test('T10 diff-matrix 端到端 + 自身自检末行', () => {
  const dir = mkScratch('bench-matrix-t10')
  try {
    buildMatrixFixture(dir)
    const out = run([MATRIX_TOOL, dir])
    assert.match(out, /# 分桶计数/, out)
    assert.match(out, /## 16 记忆规则技能 —— 竞品侧命中: qoder\(2\)/, out)
    assert.ok(!out.includes('## 5 文件与diff'), '我方已覆盖的类被列成差距了:\n' + out)
    assert.match(out, /本器只做归一与并排,不下/, '收尾的口径声明不得被顺手删掉')
    assert.match(run([MATRIX_TOOL, '--self-test']), /# 自检 \d+ 条,通过 \d+,失败 0/)
  } finally {
    rmScratch(dir)
  }
})

// ---------- T11 真语料(§22c:输入必须逐字取自真实文件,不得全部自造夹具) ----------

test('T11 拿证据目录里的三份真实竞品清单喂判据:读数必须为正', () => {
  const base = matrixTool.EVIDENCE_DIR
  assert.ok(fs.existsSync(base), `证据目录不在位:${base}`)
  const sides = ['qoder', 'codex', 'trae']
  const m = matrixTool.buildMatrix(base)
  for (const k of sides) {
    assert.ok(Array.isArray(m.sides[k]), `${k} 侧没读到清单(真语料喂不进来)`)
    assert.ok(m.sides[k].length > 0, `${k} 侧条目数为 0 ⇒ 尺子对该形态失明`)
  }
  const out = run([MATRIX_TOOL])
  for (const k of sides) {
    assert.match(out, new RegExp(`${k}\\s+\\d+ 条 / \\d+ 行`), `真语料读数缺 ${k}:\n${out}`)
  }
  // 我方侧此刻仍未交付:必须喊"判不出",且**不得**印矩阵表头(两条结论必须同向)。
  const oursMissing = !fs.existsSync(path.join(base, 'ours', 'chat-stream-inventory.md'))
  assert.equal(out.includes('# 分桶计数'), !oursMissing, '缺失侧与矩阵产出必须同结论')
  if (oursMissing) assert.match(out, /无法生成对账矩阵/, out)
})

// ---------- T12 搬家完成性 + 文档指向 ----------

const OLD_RELS = [
  'docs/benchmark-evidence/2026-09/asar-read.mjs',
  'docs/benchmark-evidence/2026-09/diff-matrix.mjs',
]

/** 只读取 HEAD 的那一份;该路径不在 HEAD 里(删除已落地)时返回 null。 */
function headBlob(rel) {
  try {
    return execFileSync(
      gitBinary(),
      ['-c', 'safe.directory=*', '--no-optional-locks', 'show', `HEAD:${rel}`],
      { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 8 << 20,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch {
    return null
  }
}

test('T12 旧路径不得留第二份真相,README 指向新路径并留着取法事实', () => {
  // 为什么不是简单断言"旧文件必须不在盘上":实测 scripts/heal-worktree-tracked.mjs(挂 git-guardian
  // 每 2 分钟一轮)会把"工作区缺失 + 索引==HEAD"的跟踪文件**原样复原** —— 删除在被 `git rm` 落地之前
  // 会被自愈顶回来。所以这一格判的是内容,不是存在性:
  //   · 旧路径已不在 HEAD 却仍在盘上 ⇒ 有人又写回一份 ⇒ 红;
  //   · 旧路径在 HEAD 与盘上都有但内容已分叉 ⇒ 两份真相漂移 ⇒ 红;
  //   · 盘上那份逐字等于 HEAD ⇒ 只是"待落地删除"的现场,打印提示不判红(落地后自然消失)。
  for (const rel of OLD_RELS) {
    const abs = path.join(ROOT, ...rel.split('/'))
    const inHead = headBlob(rel)
    const onDisk = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
    if (inHead === null) {
      assert.ok(onDisk === null, `旧实现被写回已在 HEAD 里删掉的路径(第二份实现):${rel}`)
      continue
    }
    if (onDisk !== null) {
      assert.equal(
        onDisk,
        inHead,
        `旧路径内容与 HEAD 那份已分叉 —— 两份真相就是本票要消除的东西:${rel}`,
      )
      console.log(`  ℹ️ ${rel} 仍在盘上:删除尚未被 git rm 落地(存续自愈会复原缺失的跟踪文件)`)
    }
  }
  const readme = fs.readFileSync(
    path.join(ROOT, 'docs', 'benchmark-evidence', '2026-09', 'README.md'),
    'utf8',
  )
  assert.ok(readme.includes('scripts/benchmark-asar-read.mjs'), 'README 未指向新的 asar 工具路径')
  assert.ok(readme.includes('scripts/benchmark-diff-matrix.mjs'), 'README 未指向新的矩阵工具路径')
  assert.ok(!readme.includes('2026-09/asar-read.mjs'), 'README 仍在指向已搬走的旧路径')
  assert.ok(!readme.includes('2026-09/diff-matrix.mjs'), 'README 仍在指向已搬走的旧路径')
  // 这目录存在的理由:版本与被取证对象必须留在 README,不能因搬家被删。
  for (const fact of ['codex-cli 0.137.0', 'qoder-cn v0.4.3', '2a57dccf422a0165507cc4b8f9598452']) {
    assert.ok(readme.includes(fact), `README 丢了取证事实:${fact}`)
  }
})

// ---------- T13 "刻意不接提交链"的三向锁 ----------

test('T13 两件工具刻意不在提交链:注册表零命中,头注也不得声称已接线', () => {
  const registry = [
    path.join(ROOT, 'scripts', 'guardian-runner.mjs'),
    path.join(ROOT, 'scripts', 'lib', 'pre-commit-hook.js'),
    path.join(ROOT, 'package.json'),
    path.join(ROOT, '.husky', 'pre-commit'),
    path.join(ROOT, '.husky', 'pre-push'),
  ]
  for (const f of registry) {
    if (!fs.existsSync(f)) continue
    const text = fs.readFileSync(f, 'utf8')
    for (const name of ['benchmark-asar-read', 'benchmark-diff-matrix']) {
      assert.ok(
        !text.includes(name),
        `${path.basename(f)} 里出现了 ${name} —— 这两件工具判的是仓库外包体与取证文档,接进提交链` +
          '就是一台与提交内容无关的恒红门(AGENTS §12e);要接必须先按该节论证并改本锁',
      )
    }
  }
  // 头注不得声称"已接 pre-commit / CI 必跑 / 第 N 项" —— 守门 89 的 R1/R2 判的正是这句谎话。
  for (const [name, text] of [
    ['benchmark-asar-read', ASAR_TOOL_SRC],
    ['benchmark-diff-matrix', MATRIX_TOOL_SRC],
  ]) {
    assert.ok(
      !/(已接|接入|挂在)\s*(pre-commit|pre-push|CI|提交链)/.test(text),
      `${name} 头注声称已接提交链,但它确实没接(与本门上一条锁同一条禁令)`,
    )
    assert.ok(!/第 ?\d+ ?项/.test(text), `${name} 头注不得自称"第 N 项"`)
  }
})

// T14 机器产物头不得再是生成器自身源码(2026-10-03 夜间实测:旧 selfWatermark() 用
//   self.indexOf('-->') 自切,而第一个 `-->` 就写在那一行里 ⇒ 产物 .md 前面贴了 342 行脚本源码,
//   守门 95(水印横幅必须被"本文件类型的注释"包裹)因此在 HEAD 面恒红,而矩阵本体读起来仍是正常的。)
test('T14 逐类目产物:头部是 .md 合法注释横幅,且不得含生成器自身源码', () => {
  const product = matrixTool.PER_CLASS_DEFAULT_OUT
  assert.ok(fs.existsSync(product), `产物不在位:${product} —— 缺件不得读成"这一维没问题"`)
  const txt = fs.readFileSync(product, 'utf8')
  for (const marker of ['#!/usr/bin/env node', 'export function renderPerClassMarkdown', "import fs from 'node:fs'"]) {
    assert.ok(!txt.includes(marker), `产物含生成器源码片段 ${marker} —— selfWatermark 那一型回来了`)
  }
  assert.equal(txt.split('\n')[0].trim(), '<!--', '产物首行必须是 HTML 注释 opener(.md 的唯一合法横幅形态)')
  // 反向锁:生成器不得再自带一份"读自己源码"的取头逻辑(横幅只许由 watermark 工具产)
  assert.ok(
    !/readFileSync\(fileURLToPath\(import\.meta\.url\)/.test(MATRIX_TOOL_SRC),
    'benchmark-diff-matrix.mjs 又出现"读自身源码当产物头"的写法 —— 横幅唯一出口是 scripts/watermark.mjs inject',
  )

  // 构造面(不依赖仓库瞬时状态):纯函数渲染结果必须以标题起头,不含脚本源码片段
  const m = {
    rows: [
      {
        c: '1',
        oursNames: ['g1'],
        oursCell: ['1'],
        oursTotal: 1,
        framesN: 0,
        rivalCell: { qoder: 1, trae: 0, codex: 0 },
        verdict: '两侧都有',
      },
    ],
    oursGrand: 1,
    rivalGrand: { qoder: 1, trae: 0, codex: 0 },
    framesAll: 0,
    extraSections: [],
    unmatchedFrames: [],
    metaLines: [],
  }
  const rendered = matrixTool.renderPerClassMarkdown(m, { when: 'test', head: 'test' })
  assert.ok(rendered.startsWith('# 逐类目对账矩阵'), '渲染阶段不得自带横幅(横幅只由 inject 写)')
  assert.ok(!rendered.includes('#!/usr/bin/env node'), '构造面渲染结果混入了脚本源码')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
