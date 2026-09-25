// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 118 的门侧对账(§22c:测试**直接 import 源函数**,不留第二份镜像真相)。
 * 判三件事:判据有牙、编号在 runner 里恰好一次且 blocking、文档点名。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Windows 上 import() 不接受反斜杠绝对路径,必须走 file:// URL(否则整文件在收集期失败,
// 表现为"1 test failed / 0 run"—— 那正是本仓记过的"收集期失败静默削掉整批用例"那一型)
const { classify, decide, usesLayerRead, GATE_GLOB } = await import(pathToFileURL(resolve(ROOT, 'scripts/check-gate-face-discipline.mjs')).href)

const g = (a) => execFileSync('git', ['-c', 'safe.directory=*', ...a], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })

test('T1 散写 git 的门必判红(正向证明:名单不是死表)', () => {
  const r = classify('scripts/check-x.mjs', "import { execFileSync } from 'node:child_process'\nexecFileSync('git', ['cat-file', 'blob', h])\n")
  assert.equal(r.kind, 'loose-git')
})

test('T2 经取材层的门必判绿(反向对照,否则本门自己就是恒红源)', () => {
  // 夹具必须**真调用**层的读取入口 —— 收紧之后"只 import 不调用"就是不合格,
  // 这条反向对照若还写成只 import,它会替旧行为背书(测试变成缺陷的掩体)。
  const r = classify(
    'scripts/check-y.mjs',
    "import { catBatch } from './lib/face-reader.mjs'\nconst t = catBatch(ROOT, ['HEAD:a.ts'])\n",
  )
  assert.equal(r.kind, 'face')
})

test('T3 全量档对同一份散写只报数;暂存档判红(方向锁)', () => {
  const v = [{ file: 'scripts/check-z.mjs', kind: 'loose-fs', why: 'x' }]
  assert.equal(decide({ verdicts: v, mode: 'full' }).exit, 0)
  assert.equal(decide({ verdicts: v, mode: 'staged' }).exit, 1)
})

test('T4 本门编号在 runner 里恰好一次,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const mine = [...src.matchAll(/^    id: '(118)',$/gm)]
  assert.equal(mine.length, 1, 'id 118 必须出现恰好一次(重复会串 skipEnv 与失败归属)')
  const at = src.indexOf("    id: '118',")
  const blk = src.slice(at, at + 900)
  assert.match(blk, /script: 'check-gate-face-discipline\.mjs'/)
  assert.match(blk, /mode: 'blocking'/)
  assert.match(blk, /skipEnv: 'HUSKY_SKIP_GATE_FACE_DISCIPLINE'/)
  // 两种合法写法都要认:标量 'scripts/' 与数组 ['scripts/'](runner 现值是数组)。
  // 只认标量 = 断言比 runner 严,别人把写法改成数组就把本门自己的镜像测试钉红,而接线其实完好。
  assert.match(blk, /stagedTriggers:\s*(?:'scripts\/'|\[[^\]]*'scripts\/)/)
})

test('T5 全 runner 任何 id 不得出现两次(撞号由机器发现,不靠人记得去查)', () => {
  const ids = [...readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8').matchAll(/^    id: '(\d+)',$/gm)].map((m) => m[1])
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual(dup, [], `重复号:${dup.join(',')}`)
})

test('T6 AGENTS.md 点名本门(判据存在而通篇不提 = 没有)', () => {
  assert.match(readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8'), /check-gate-face-discipline\.mjs/)
})

test('T7 扫描面只认门脚本,不误咬端内代码', () => {
  assert.equal(GATE_GLOB.test('scripts/check-a.mjs'), true)
  assert.equal(GATE_GLOB.test('scripts/tests/check-a.test.mjs'), false)
  assert.equal(GATE_GLOB.test('apps/cli/src/tools/index.ts'), false)
})

test('T8 真仓 HEAD 面本门必须 exit 0(全量档只报数;红了就说明存量被当成债)', () => {
  const r = (() => {
    try {
      execFileSync(process.execPath, [resolve(ROOT, 'scripts/check-gate-face-discipline.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })
      return 0
    } catch (e) {
      return e.status ?? -1
    }
  })()
  assert.equal(r, 0)
  assert.ok(g(['--version']).length > 0)
})
// ─── T9/T10/T11 收紧"import 层 ≠ 走层"的三条锁(2026-09-26,主会话)───
// 立因:旧 classify 第一刀是 FACE_IMPORT_RE 命中即判 face ⇒ "引了这层"被当成"走了这层"。
// 实证是主会话自己踩的:门 36 与门 124 都 import 了 face-reader(只用 gitRaw),却都**默认按磁盘判**;
// 把它们改成 catBatch 判 HEAD 之后,门 118 的分类读数一字未变 —— 一道自称守取材面纪律的门,
// 对"半接线"这一族完全失明。收紧没有这三条锁,下次被人一句"顺手改回 import 即合规"就能悄悄关掉。
test('T9 半接线必判红:引了层却自己 git show / 按磁盘读内容', () => {
  const HALF_GIT =
    "import { gitBinary, gitErrText, selectFace } from './lib/face-reader.mjs'\n" +
    "execFileSync(gitBinary(), ['show', 'HEAD:a.ts'])\n"
  const HALF_FS =
    "import { selectFace } from './lib/face-reader.mjs'\nimport { readFileSync } from 'node:fs'\nreadFileSync(join(ROOT, 'a.ts'), 'utf8')\n"
  assert.equal(classify('scripts/check-half1.mjs', HALF_GIT).kind, 'half-wired')
  assert.equal(classify('scripts/check-half2.mjs', HALF_FS).kind, 'half-wired')
  const d = decide({
    verdicts: [
      { file: 'scripts/check-half1.mjs', kind: 'half-wired', why: 'x' },
      { file: 'scripts/check-half2.mjs', kind: 'half-wired', why: 'x' },
    ],
    mode: 'staged',
  })
  assert.equal(d.exit, 1, 'half-wired 必须进判红集 —— 只报数的新档等于没做这次收紧')
  assert.equal(d.counts.halfWired, 2, '必须单列计数,不能只混进 loose 总数')
})

test('T10 别名与命名空间导入的读取入口必须被认作 face(收紧不得产假阳)', () => {
  const ALIAS =
    "import {\n  catBatch as readBlobs,\n} from '../lib/face-reader.mjs'\nconst t = readBlobs(ROOT, ['HEAD:a.ts'])\n"
  const NS =
    "import * as face from './lib/face-reader.mjs'\nconst t = face.catBatch(ROOT, ['HEAD:a.ts'])\n"
  assert.equal(classify('scripts/check-alias.mjs', ALIAS).kind, 'face')
  assert.equal(classify('scripts/check-ns.mjs', NS).kind, 'face')
  // 反向:别名导入了却没调用 ⇒ 不算走了层(引了名字 ≠ 用了它)
  assert.equal(
    classify('scripts/check-alias-unused.mjs', "import { catBatch as rb } from './lib/face-reader.mjs'\nconsole.log(1)\n").kind,
    'no-content',
  )
  // 只用层的非读取导出(selectFace / gitErrText 这类)不构成"读取凭证"
  assert.equal(usesLayerRead("import { selectFace } from './lib/face-reader.mjs'\nconst f = selectFace({})\n"), false)
})

test('T11 反向回归:classify 不得再把"仅 import"当第一刀放行', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/check-gate-face-discipline.mjs'), 'utf8')
  // 旧形态(if (FACE_IMPORT_RE.test(code)) return { kind: 'face' … })一旦被改回去,本条立刻红。
  // 形状判据必须锚代码形状而不是注释,否则改个措辞就把它洗成恒绿 —— 见 §22c 的复读机教训。
  assert.doesNotMatch(src, /if\s*\(\s*FACE_IMPORT_RE\.test\(code\)\s*\)\s*return\s*\{\s*kind:\s*'face'/)
  assert.ok(src.includes('usesLayerRead(code)'), '合规判定必须先问"真调用过层的读取入口吗"')
  assert.equal(typeof usesLayerRead, 'function', 'usesLayerRead 必须导出(镜像不得复制一份实现)')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
