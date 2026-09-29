// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 把"折叠判据"这笔改动重放到 **HEAD 现值** 上,产出 blob —— 磁盘那份含别人未入库的实现
// (markersIn/credited/suppMap 那一族 F5 额度逻辑)而 HEAD 已入库的是 noteCredits 那一族,
// 按工作树字节落地 = 替别人把已入库的实现写回旧版(§12 污染型)。所以只走对象空间。
// 每处 patch 断言"锚点唯一命中",任一不成立就拒绝产出 —— 不猜。
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitBinary } from '../../../../scripts/lib/face-reader.mjs'

const GIT = gitBinary()
const root = 'D:/IHUI-AI'
const DIR = 'D:/IHUI-AI/.ihui-agent/tmp/o81-resume/docs2'
const SRC = 'scripts/union-converge.mjs'
const TST = 'scripts/tests/union-converge.test.mjs'
const WT_SRC = `${DIR}/../wt-backup/uc.wt` // 我改过的磁盘版(只作为**我这一笔改动**的取材源)
const WT_TST = `${DIR}/../wt-backup/uc-test.wt`

const git = (args, input) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
    ...(input === undefined ? {} : { input }),
  })

const count = (s, needle) => s.split(needle).length - 1
const cut = (s, from, to, label) => {
  const a = s.indexOf(from)
  if (a < 0) {
    console.log(`❌ ${label}:找不到起点`); process.exit(1)
  }
  const b = s.indexOf(to, a)
  if (b < 0) {
    console.log(`❌ ${label}:找不到终点`); process.exit(1)
  }
  return s.slice(a, b)
}
const once = (s, needle, label) => {
  const n = count(s, needle)
  if (n !== 1) {
    console.log(`❌ ${label}:锚点命中 ${n} 次(应为 1)`); process.exit(1)
  }
}

const wtSrc = readFileSync(WT_SRC, 'utf8')
const wtTst = readFileSync(WT_TST, 'utf8')
let head = git(['show', `HEAD:${SRC}`])
let headT = git(['show', `HEAD:${TST}`])

// ── 1) import:补 keyOfRow(折叠判据按台账主键配对,不写第二份"什么算登记行")
const IMP_OLD = "import { auditPlan, malformedLine, f9GroupLine, DUP_POINTER_RE, MERGE_NOTE_RE } from './lib/plan-task-index.mjs'"
const IMP_NEW = [
  'import {',
  '  auditPlan,',
  '  malformedLine,',
  '  f9GroupLine,',
  '  DUP_POINTER_RE,',
  '  MERGE_NOTE_RE,',
  '  keyOfRow,',
  "} from './lib/plan-task-index.mjs'",
].join('\n')
if (count(head, 'keyOfRow,') === 0) once(head, IMP_OLD, '1) import 单行形态')
head = count(head, IMP_OLD) === 1 ? head.replace(IMP_OLD, IMP_NEW) : head

// ── 2) theirsRewriteCaps 整块(含头注)插到 unionLines 的头注之前
const BLK_FN = cut(wtSrc, '/**\n * 「**对侧**就地改写', '/** 行级 union', '2) 函数块')
once(head, '/** 行级 union', '2) unionLines 头注锚点')
head = head.replace('/** 行级 union', BLK_FN + '/** 行级 union')

// ── 3) 期望表接线
const BLK_WANT = cut(wtSrc, '  /**\n   * 「对侧改写、本侧未动」那一格', '  return want\n}', '3) 期望表接线')
once(head, '  return want\n}', '3) return want 锚点')
head = head.replace('  return want\n}', BLK_WANT + '  return want\n}')

// ── 4) 脊柱裁剪:替换 unionLines 开头那四行
const D_END_OLD = "  for (const [l, n] of counter(oursText)) need.set(l, (need.get(l) || 0) - n)"
const D_START = '  const want = liveDocExpectedCounts(oursText, theirsText, baseText, suppress)'
const OLD_HEAD_BLOCK = cut(head, D_START, D_END_OLD + '\n', '4) HEAD 版四行')
const NEW_BLOCK = cut(wtSrc, D_START, "  for (const [l, n] of counter(spine.join('\\n'))) need.set(l, (need.get(l) || 0) - n)\n", '4) 磁盘版裁剪块')
head = head.replace(OLD_HEAD_BLOCK, NEW_BLOCK)

// ── 5) __test__ 导出
once(head, '  liveDocExpectedCounts,\n', '5) __test__ 锚点')
head = head.replace('  liveDocExpectedCounts,\n', '  liveDocExpectedCounts,\n  theirsRewriteCaps,\n')

// ── 6) 自检 5 条(插在"防复活必须是有基底的三方判据"那条之后)
const ANCHOR6 = `    ok(
      '防复活必须是**有基底的三方判据**:只给两侧文本时旧行为不变(证明收紧靠的是 base 而不是削判据)',
      counter(unionLines('a\\n', 'a\\nb\\n')).get('b') === 1,
    )`
once(head, ANCHOR6, '6) 自检锚点')
const BLK_ST = cut(
  wtSrc,
  "    // 「对侧改写、本侧未动」那一族的四条成对用例",
  '    // 多重行的口径',
  '6) 自检块',
)
head = head.replace(ANCHOR6, ANCHOR6 + '\n' + BLK_ST.replace(/\n$/, ''))

// ── 7) 镜像测试三条:编号必须避开 HEAD 已占用的 R-A…R-Q
const used = [...headT.matchAll(/test\('(R-[A-Z])/g)].map((m) => m[1])
const free = ['R-R', 'R-S', 'R-T'].filter((x) => !used.includes(x))
if (free.length !== 3) {
  console.log(`❌ 镜像编号被占:${used.join(',')}`); process.exit(1)
}
const START7 = "/* ── R-Q / R-R / R-S:「对侧就地改写"
if (wtTst.indexOf(START7) < 0) {
  console.log('❌ 7) 磁盘测试件里找不到我加的那一段')
  process.exit(1)
}
// 取到磁盘件末尾(我那三条就是最后三段),顺手剥掉可能跟着尾部带进来的隐写标记行 —— 下面 inject 会重注
const blk = wtTst
  .slice(wtTst.indexOf(START7))
  .split('\n')
  .filter((l) => !l.startsWith('// [IHUI-AI-PROVENANCE]'))
  .join('\n')
  .replace(/\s+$/, '')
  .replace(/R-Q \/ R-R \/ R-S/, `${free[0]} / ${free[1]} / ${free[2]}`)
  .replace(/R-Q 折叠判据/, `${free[0]} 折叠判据`)
  .replace(/R-R 反向锁/, `${free[1]} 反向锁`)
  .replace(/R-S 装车锁/, `${free[2]} 装车锁`)
for (const n of free) once(blk, `test('${n} `, `7) 用例 ${n} 应恰好定义一次`)
// 追加到文件末尾(HEAD 版最后一行是 `})`)
headT = `${headT.replace(/\n+$/, '')}\n${blk}\n`

// ── 产出前的自证:折叠判据必须在 blob 里,而别人的 noteCredits 一族必须**一字未动**
for (const needle of ['theirsRewriteCaps', 'const over = n - (want.get(l) || 0)', 'keyOfRow,']) {
  if (!head.includes(needle)) {
    console.log(`❌ 产出 blob 缺 ${needle}`); process.exit(1)
  }
}
const headSrc0 = git(['show', `HEAD:${SRC}`])
for (const k of ['noteCredits', 'byPlaceholder', 'byOwnShrink']) {
  if (count(head, k) !== count(headSrc0, k)) {
    console.log(`❌ 产出 blob 动了别人的 ${k} 逻辑(${count(headSrc0, k)} → ${count(head, k)})`); process.exit(1)
  }
}
const headT0 = git(['show', `HEAD:${TST}`])
for (const k of ['R-Q 显式 --theirs', 'resolveTargets']) {
  if (!headT.includes(k)) {
    console.log(`❌ 产出测试件丢了 HEAD 的 "${k}"`)
    process.exit(1)
  }
}

// ── 落盘成 blob(经临时件,不碰工作树)
const mkTmp = (name, text) => {
  const p = join(DIR, name)
  writeFileSync(p, text, 'utf8')
  return p
}
const ps = mkTmp('fold.src.mjs', head)
const pt = mkTmp('fold.tst.mjs', headT)
execFileSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'inject', pt], {
  encoding: 'utf8',
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 120000,
})
for (const [label, p] of [['src', ps], ['tst', pt]]) {
  // 判"水印完好"只认**退出码**,不 grep 汇总字样 —— 实测那行写的是「残迹(载荷丢失) 0 个」这类形态,
  // 拿「完好」二字去匹配会把完好文件读成损坏(我第一版就栽在这里,而红的是我的尺子)。
  const r = spawnSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'verify', p], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  if (r.status !== 0) {
    console.log(`❌ ${label} 水印 verify 退出码 ${r.status}:\n${r.stdout}\n${r.stderr}`); process.exit(1)
  }
}
execFileSync(process.execPath, ['--check', ps], { encoding: 'utf8', windowsHide: true, timeout: 60000 })
execFileSync(process.execPath, ['--check', pt], { encoding: 'utf8', windowsHide: true, timeout: 60000 })
const bs = git(['hash-object', '-w', ps]).trim()
const bt = git(['hash-object', '-w', pt]).trim()
writeFileSync(
  join(DIR, 'blobs-fold.json'),
  JSON.stringify(
    {
      files: [
        { path: SRC, blob: bs },
        { path: TST, blob: bt },
      ],
    },
    null,
    2,
  ),
  'utf8',
)
console.log(`✅ blob:${bs.slice(0, 10)} / ${bt.slice(0, 10)};行数 ${head.split('\n').length} / ${headT.split('\n').length}(HEAD 原 ${headSrc0.split('\n').length} / ${headT0.split('\n').length})`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
