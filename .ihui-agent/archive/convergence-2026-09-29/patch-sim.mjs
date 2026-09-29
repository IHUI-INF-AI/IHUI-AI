// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 给刚落地的"折叠判据"补一条它自己缺的护栏:**同号但两个不同议题**不是"就地改写"。
// 这是这条新判据唯一的假阳方向 —— 并发取号撞上同号时,两侧各是一件活着的登记,
// 折掉任何一侧等于替别人删掉一件没做完的事(比 F9 红贵得多)。
// 相似度尺子只许有一份:复用 merge-live-doc 那把字符二元组 Jaccard 与同源阈值。
// 全程按 HEAD 现值构造 blob(磁盘那份含他人在飞实现,不取它的字节)。
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitBinary } from '../../../../scripts/lib/face-reader.mjs'

const GIT = gitBinary()
const root = 'D:/IHUI-AI'
const DIR = 'D:/IHUI-AI/.ihui-agent/tmp/o81-resume/docs2'
const SRC = 'scripts/union-converge.mjs'
const TST = 'scripts/tests/union-converge.test.mjs'
const git = (args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240000,
  })
const count = (s, n) => s.split(n).length - 1
const rep = (s, a, b, label) => {
  const n = count(s, a)
  if (n !== 1) {
    console.log(`❌ ${label}:锚点命中 ${n} 次(应为 1)`)
    process.exit(1)
  }
  return s.replace(a, b)
}

let src = git(['show', `HEAD:${SRC}`])
let tst = git(['show', `HEAD:${TST}`])

// 1) import 那一层的相似度出口
src = rep(
  src,
  "} from './lib/plan-task-index.mjs'",
  "} from './lib/plan-task-index.mjs'\nimport { SIM_THRESHOLD, jaccard, tokenize, stripState } from './lib/live-doc-similarity.mjs'",
  '1) import',
)

// 2) 折叠前必须先确认"是同一件事"
src = rep(
  src,
  '    if (multisetEq(bLines, tLines)) continue\n',
  '    if (multisetEq(bLines, tLines)) continue\n' +
    '    // 同号**两个不同议题**(并发取号撞上的)不是就地改写:两侧各是一件活着的登记,\n' +
    '    // 折掉哪一侧都是替别人删事。判"是不是同一件事"的尺子只许有一份,故复用 merge-live-doc\n' +
    '    // 那把字符二元组 Jaccard 与同源阈值(按词切在 CJK 混排行上会断崖下跌,该层头注已记过)。\n' +
    '    const sim = jaccard(\n' +
    "      tokenize(stripState(bLines.join('\\n'))),\n" +
    "      tokenize(stripState(tLines.join('\\n'))),\n" +
    '    )\n' +
    '    if (sim < SIM_THRESHOLD) continue\n',
  '2) 相似度护栏',
)

// 3) 自检:正例夹具改成"同一议题的两种写法",并补一条"不同议题不得折"的反向对照
src = rep(
  src,
  "    const RW_BASE = '- [ ] G-770 折叠夹具:基底形态。\\n'\n    const RW_NEW = '- [x] G-770 折叠夹具:对侧改写后的形态。\\n'",
  "    const RW_BASE = '- [ ] G-770 折叠夹具:同一议题的甲写法,含落点与判据两段说明。\\n'\n" +
    "    const RW_NEW = '- [x] G-770 折叠夹具:同一议题的乙写法,含落点与判据两段说明。\\n'",
  '3) 正例夹具',
)
src = rep(
  src,
  "    ok(\n      '反向锁:对侧把该主键**整族删掉** ⇒ 删除不随合并传播(本侧那份照留),与上面「本侧删而对侧未动」那条对称',",
  "    ok(\n" +
    "      '反向锁:同一枚号被两侧各登记成**不同议题**(并发取号撞的)⇒ 不许折 —— 折掉任何一侧都是替别人删一件活账," +
    "比 F9 红贵得多;这条就是本判据唯一的假阳方向',\n" +
    "      (() => {\n" +
    "        const A = '- [ ] G-773 构建脚本的包名解析恒为空,versionCode 读错 app 的清单。'\n" +
    "        const B = '- [ ] G-773 派单阻塞登记:排队语义在满载时把已终态任务再次入队。'\n" +
    "        const r = unionLines(`a\\n${A}\\n`, `a\\n${B}\\n`, `a\\n${A}\\n`)\n" +
    '        return r.includes(A.trim()) && r.includes(B.trim())\n' +
    '      })(),\n' +
    '    )\n' +
    "    ok(\n      '反向锁:对侧把该主键**整族删掉** ⇒ 删除不随合并传播(本侧那份照留),与上面「本侧删而对侧未动」那条对称',",
  '3b) 反例(不同议题)',
)

// 4b) 镜像端到端正例的夹具必须同步换成"同一议题的两种写法" —— 相似度闸装上后,
//     原来那对短文本(基底形态/对侧改写后的形态)会被判成两件事 ⇒ 正例自己翻红。
tst = rep(
  tst,
  "    const OLD = '- [ ] G-770 折叠夹具:基底形态。'",
  "    const OLD = '- [ ] G-770 折叠夹具:同一议题的甲写法,含落点与判据两段说明。'",
  '4b) 镜像 OLD',
)
tst = rep(
  tst,
  "    const NEW = '- [x] ✅(2026-09-29) G-770 折叠夹具:对侧改写后的形态。'",
  "    const NEW = '- [x] ✅(2026-09-29) G-770 折叠夹具:同一议题的乙写法,含落点与判据两段说明。'",
  '4b) 镜像 NEW',
)

// 5) 镜像:源码级装车锁,护栏被摘掉必读红
const used = [...tst.matchAll(/test\('(R-[A-Z])/g)].map((m) => m[1])
const free = 'R-U'
if (used.includes(free)) {
  console.log(`❌ ${free} 已被占用`)
  process.exit(1)
}
tst = `${tst.replace(/\n+$/, '')}\n${[
  `test('${free} 装车锁(源码级):折叠判据必须先过"是不是同一件事"的相似度闸 —— 摘掉它,同号两个不同议题会被静默删掉一侧', () => {`,
  "  const src = maskComments(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../union-converge.mjs'), 'utf8'))",
  '  assert.match(src, /if \\(sim < SIM_THRESHOLD\\) continue/, \'相似度闸不得被摘掉\')',
  "  assert.match(src, /from '\\.\\/lib\\/live-doc-similarity\\.mjs'/, '阈值与 Jaccard 必须复用那一份实现,不得在门里再写第二把尺子')",
  '})',
].join('\n')}\n`

const ps = join(DIR, 'sim.src.mjs')
const pt = join(DIR, 'sim.tst.mjs')
writeFileSync(ps, src, 'utf8')
writeFileSync(pt, tst, 'utf8')
for (const p of [pt]) {
  const r = spawnSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'inject', p], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  if (r.status !== 0) {
    console.log(`❌ 注入失败:${r.stdout || r.stderr}`)
    process.exit(1)
  }
}
for (const [label, p] of [['src', ps], ['tst', pt]]) {
  const v = spawnSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'verify', p], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  if (v.status !== 0) {
    console.log(`❌ ${label} 水印 verify rc=${v.status}`)
    process.exit(1)
  }
  const c = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8', windowsHide: true, timeout: 60000 })
  if (c.status !== 0) {
    console.log(`❌ ${label} 语法不通过:${c.stderr}`)
    process.exit(1)
  }
}
const bs = git(['hash-object', '-w', ps]).trim()
const bt = git(['hash-object', '-w', pt]).trim()
writeFileSync(
  join(DIR, 'blobs-sim.json'),
  JSON.stringify({ files: [{ path: SRC, blob: bs }, { path: TST, blob: bt }] }, null, 2),
  'utf8',
)
console.log(`✅ blob:${bs.slice(0, 10)} / ${bt.slice(0, 10)}`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
