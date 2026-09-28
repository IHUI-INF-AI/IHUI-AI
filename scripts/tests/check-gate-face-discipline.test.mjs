// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 118 的门侧对账(§22c:测试**直接 import 源函数**,不留第二份镜像真相)。
 * 判三件事:判据有牙、编号在 runner 里恰好一次且 blocking、文档点名。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Windows 上 import() 不接受反斜杠绝对路径,必须走 file:// URL(否则整文件在收集期失败,
// 表现为"1 test failed / 0 run"—— 那正是本仓记过的"收集期失败静默削掉整批用例"那一型)
const {
  classify,
  decide,
  usesLayerRead,
  gitContentReads,
  flagValue,
  resolveRootArg,
  GATE_GLOB,
  prejoinedRepoConsts,
  readsPrejoinedConst,
  scanLiterals,
  scanSpans,
  maskComments,
  blankStrings,
  analyze,
  REPO_CONTENT_DIRS,
  REPO_CONTENT_FILE_RE,
} = await import(pathToFileURL(resolve(ROOT, 'scripts/check-gate-face-discipline.mjs')).href)

const g = (a) =>
  execFileSync('git', ['-c', 'safe.directory=*', ...a], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
  })

test('T1 散写 git 的门必判红(正向证明:名单不是死表)', () => {
  const r = classify(
    'scripts/check-x.mjs',
    "import { execFileSync } from 'node:child_process'\nexecFileSync('git', ['cat-file', 'blob', h])\n",
  )
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
  const ids = [
    ...readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8').matchAll(
      /^    id: '(\d+)',$/gm,
    ),
  ].map((m) => m[1])
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
      execFileSync(process.execPath, [resolve(ROOT, 'scripts/check-gate-face-discipline.mjs')], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 1 << 28,
        windowsHide: true,
      })
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
    classify(
      'scripts/check-alias-unused.mjs',
      "import { catBatch as rb } from './lib/face-reader.mjs'\nconsole.log(1)\n",
    ).kind,
    'no-content',
  )
  // 只用层的非读取导出(selectFace / gitErrText 这类)不构成"读取凭证"
  assert.equal(
    usesLayerRead("import { selectFace } from './lib/face-reader.mjs'\nconst f = selectFace({})\n"),
    false,
  )
})

test('T11 反向回归:classify 不得再把"仅 import"当第一刀放行', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/check-gate-face-discipline.mjs'), 'utf8')
  // 旧形态(if (FACE_IMPORT_RE.test(code)) return { kind: 'face' … })一旦被改回去,本条立刻红。
  // 形状判据必须锚代码形状而不是注释,否则改个措辞就把它洗成恒绿 —— 见 §22c 的复读机教训。
  assert.doesNotMatch(
    src,
    /if\s*\(\s*FACE_IMPORT_RE\.test\(code\)\s*\)\s*return\s*\{\s*kind:\s*'face'/,
  )
  assert.ok(src.includes('usesLayerRead(code)'), '合规判定必须先问"真调用过层的读取入口吗"')
  assert.equal(typeof usesLayerRead, 'function', 'usesLayerRead 必须导出(镜像不得复制一份实现)')
})

// ─── T12/T13 「读内容」与「枚举」必须分开(2026-09-26,主会话)───
// 立因:上一版把 ls-tree / cat-file -e / grep -l 也算进"散写读内容",于是只做存在性与路径清单的
// check-merge-addition-loss(一处 blob 都没读)被判半接线。**假阳比漏报更贵** —— 它会指使人去
// "修"一个没坏的东西,还把判据自己的口径说歪成"数字很多"。这两条把两侧都钉住。
test('T12 存在性/路径清单不算读内容,blob 与借 transport 自读算(成对)', () => {
  assert.equal(
    gitContentReads(
      "const git=(a)=>execFileSync(GIT_BIN,a)\ngit(['cat-file','-e',x])\ngit(['ls-tree','-r','--name-only',t,'-z'])\ngit(['rev-list',r])\n",
    ),
    false,
    '枚举调用被当成读内容 ⇒ 判据会在健康门上产假阳',
  )
  assert.equal(
    gitContentReads("execFileSync(GIT_BIN, ['cat-file','blob',oid])\n"),
    true,
    '真散写 blob 不得被放过',
  )
  assert.equal(
    gitContentReads("gitRaw(['show', spec], root)\n"),
    true,
    '借层的 transport 自己读内容必须能认出',
  )
})

test('T13 仓库锚点必须落在路径函数实参里(把 ROOT 当默认实参不算)', () => {
  // 旧写法带 |`\bROOT\s*,` 一支,把 `function f(cwd = ROOT)` 读成"以仓库根拼路径"。
  // 该夹具按现口径落 unknown(读文件但认不出锚点)—— 这是**已知空档**,不是"没问题":
  // 判据分不清"读被审内容"与"读运行态台账",就不该假装分得清并据此判红。
  assert.equal(
    classify(
      'scripts/check-t13.mjs',
      "const ROOT = resolve(__dirname, '..')\nexport function audit(limit = 400, cwd = ROOT, p = markerPath(cwd)) { return p }\nreadFileSync(p, 'utf8')\n",
    ).kind,
    'unknown',
  )
  assert.equal(
    classify('scripts/check-t13b.mjs', "readFileSync(join(ROOT, REL), 'utf8')\n").kind,
    'loose-fs',
  )
})

// ─── T14–T20 预拼常量(2026-09-26)─────────────────────────────────────────
// 立因:另一路会话报"门 118 把顶层拼路径读成 no-content",主会话现读后**归因要分两层**:
// 旧 looseFs 判据本来就是**整文件合取**(任一处 readFileSync( + 任一处 join(ROOT ⇒ 判红),
// 所以"调用现场旁边没有锚点"这一句并不成立 —— 真正让那道门闭嘴的是**朴素遮噪机不认正则字面量**:
// `const re = /["']/g` 里那个单引号被当成字符串开头,后半份文件被吞进一个永不闭合的串,
// `readFileSync(` 这个 token 在遮噪后的文本里一个不剩(HEAD 面实测 24 道门中招)。
// ⇒ T15–T17 的夹具都带 BLIND 行:不带的话旧判据就把红判了,新判据一条也没被问到,
//   测试全绿而实际是复读机(§22c)。T14 用票面原样代码锁终态。
const PJ_HEAD =
  "import { readFileSync } from 'node:fs'\nimport { dirname, join, resolve } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nconst ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')\n"
const BLIND = 'const qre = /["\']/g\n'
const PJ_TAIL = "const display = readFileSync(TOOL_FILE, 'utf8')\n"

test('T14 票面原样形态 ⇒ loose-fs(这一型的终态)', () => {
  const src =
    PJ_HEAD +
    "const TOOL_FILE = join(ROOT, 'packages', 'shared', 'src', 'chat', 'tool-display.ts')\n" +
    PJ_TAIL
  assert.equal(classify('scripts/check-x.mjs', src).kind, 'loose-fs')
})

test('T15 正则字面量之后的预拼常量仍被抓到(遮噪只剩一台机器后的终态)', () => {
  const src =
    PJ_HEAD +
    BLIND +
    "const TOOL_FILE = join(ROOT, 'packages', 'shared', 'src', 'chat', 'tool-display.ts')\n" +
    PJ_TAIL
  assert.equal(classify('scripts/check-x.mjs', src).kind, 'loose-fs')
  // ⚠️ 本条原来的反向对照写的是"朴素遮噪机把 readFileSync 吞了 ⇒ 证明红是新判据给的"。
  // 那句话**就是本票要修的缺陷本身**(2026-09-26):遮噪收成一台认正则的机器之后,这一格不再被吞。
  // 保留"吞了"当断言 = 把 bug 写成规格(§22c 的复读机形态)。现在反向锁**换了对象**:
  // 锁的是"不得再退回那台盲掉的机器" —— 谁重新分叉出第二台朴素遮噪机,这一条立刻红。
  const shared = blankStrings(maskComments(src))
  assert.ok(/readFileSync\s*\(/.test(src), '原文里确有调用')
  assert.ok(
    /readFileSync\s*\(/.test(shared),
    '共享遮噪机必须仍然看得见该调用 —— 它认正则字面量;看不见即说明有人把 blankStrings 分叉回朴素那台',
  )
  // 而且遮噪**没有因此失效**:正则**体内**写的东西必须仍然不可见 —— 否则上面那条绿只是
  // "遮噪被整体关掉"的假象。两条一起读才成立:体内不可见 + 体外的同一个标识符仍然可见。
  assert.ok(
    !/SENTINEL/.test(blankStrings(maskComments('const qre = /SENTINEL["\']/g\n'))),
    '正则字面量的体必须被清空(遮噪仍在起作用)',
  )
  assert.ok(
    /SENTINEL/.test(blankStrings(maskComments('const qre = 1\nconst SENTINEL = 2\n'))),
    '阳性对照:正则之外的那个标识符必须仍看得见(否则上一条绿是"整片都被清掉")',
  )
  // 新判据自身的牙齿(与合取无关,单元层证明)
  const code = maskComments(src)
  const names = prejoinedRepoConsts(code)
  assert.deepEqual([...names], ['TOOL_FILE'], '预拼常量必须被登记')
  assert.ok(
    readsPrejoinedConst(scanLiterals(code).blanked, names).length > 0,
    '读取实参必须能配回该常量',
  )
})

test('T16 白名单边界:运行台账 / 只在部署机的忽略副本 / tee 产物 / 逃出仓库根 —— 预拼规则一律不 qualify', () => {
  // 期望的形状变了,理由要说清:**classify 的终档现在由那条整文件合取给出**(它本来就不看白名单、
  // 不做就近配对),遮噪修复只是停止替它遮羞,不是新引入的假阳 —— 用修复前的分类器跑不带 BLIND
  // 的同一份夹具,结论同样是 loose-fs。所以"白名单挡住了红"这句话从来不曾是真的;
  // 本条现在锁的是**预拼规则自己**的边界(那才是白名单该守的地方)。
  const neg = [
    "const LEDGER = join(ROOT, '.workbuddy', 'push-state.json')\nreadFileSync(LEDGER, 'utf8')\n",
    "const RUNNING = join(ROOT, 'deploy', 'prod-bundle', 'monitor.ps1')\nreadFileSync(RUNNING, 'utf8')\n",
    "const RESULT_FILE = join(ROOT, '__gate_result.txt')\nreadFileSync(RESULT_FILE, 'utf8')\n",
    "const PARENT = dirname(ROOT)\nreadFileSync(join(PARENT, 'x.json'), 'utf8')\n",
    // 路径来自 argv / 临时夹具根:提交者结构上满足不了,判红就是恒红门(§12e)
    "const TARGET = process.argv[2]\nreadFileSync(TARGET, 'utf8')\n",
    "const SCRATCH_DIR = mkScratch('t')\nreadFileSync(SCRATCH_DIR, 'utf8')\n",
  ]
  for (const body of neg) {
    const code = maskComments(PJ_HEAD + BLIND + body)
    const names = prejoinedRepoConsts(code)
    assert.equal(
      readsPrejoinedConst(scanLiterals(code).blanked, names).length,
      0,
      `预拼规则不该在这些形态上命中:${body.slice(0, 46)}`,
    )
  }
  // 阳性对照(名单不是死表):白名单内的那一格必须真能命中,否则上面那一排 0 只是判据没跑
  const good = maskComments(
    PJ_HEAD +
      BLIND +
      "const PLAN_FILE = join(ROOT, 'PROJECT_PLAN.md')\nreadFileSync(PLAN_FILE, 'utf8')\n",
  )
  const goodNames = prejoinedRepoConsts(good)
  assert.ok(
    readsPrejoinedConst(scanLiterals(good).blanked, goodNames).length > 0,
    '白名单内的形态必须命中 —— 否则 T16 的六个 0 是空转',
  )
})

test('T17 判序锁:层 > 半接线 > 新判据(新判据不得插队)', () => {
  const body = "const TOOL_FILE = join(ROOT, 'packages', 'a.ts')\n" + PJ_TAIL
  assert.equal(
    classify(
      'scripts/a.mjs',
      "import { catBatch } from './lib/face-reader.mjs'\n" +
        PJ_HEAD +
        BLIND +
        "catBatch(ROOT, ['HEAD:a.ts'])\n" +
        body,
    ).kind,
    'face',
  )
  assert.equal(
    classify(
      'scripts/b.mjs',
      "import { selectFace } from './lib/face-reader.mjs'\n" + PJ_HEAD + BLIND + body,
    ).kind,
    'half-wired',
  )
  assert.equal(classify('scripts/c.mjs', PJ_HEAD + BLIND + body).kind, 'loose-fs')
})

test('T18 名单正向证明:白名单每个首段都真能命中(名单不是死表)', () => {
  for (const d of REPO_CONTENT_DIRS) {
    const src =
      PJ_HEAD +
      BLIND +
      `const ONE_PATH = join(ROOT, '${d}', 'a.ts')\nconst v = readFileSync(ONE_PATH, 'utf8')\n`
    assert.equal(
      classify('scripts/p15.mjs', src).kind,
      'loose-fs',
      `首段 ${d}/ 命中不了 ⇒ 白名单里这一条是死表`,
    )
  }
})

test('T19 真仓 HEAD 面:预拼常量的覆盖面逐名在册(收紧的覆盖面必须是量出来的)', () => {
  // 名单取"该文件的预拼常量确实被读取实参命中"的那一批 —— 这是本规则在真仓上的全部增量。
  // ⚠️ 2026-09-26 遮噪修复之后,这批门的 `why` 不再是"预拼常量"而是**整文件合取** ——
  // 因为合取本来就不做就近配对,遮噪不再吞掉 token 之后它先接住了同一格。所以本条**不再按 why
  // 标签取名单**(那会把一条规则的覆盖面记成另一条的),改为逐名到盘上验明正身:
  // 该文件确实有一处读取调用,把**以 ROOT 为基参数**的常量当实参。
  const expected = [
    'scripts/check-adapter-wiring.mjs',
    'scripts/check-db-schema-drift.mjs',
    'scripts/check-next-env-dist.mjs',
  ].sort()
  const verdicts = analyze(ROOT, 'head').verdicts
  for (const f of expected) {
    const v = verdicts.find((x) => x.file === f)
    assert.equal(v.kind, 'loose-fs', `${f} 不在判红集里了 —— 名单该缩,或判据漂了`)
    const code = maskComments(g(['show', `HEAD:${f}`]))
    const names = prejoinedRepoConsts(code)
    assert.ok(names.size > 0, `${f} 拿不出预拼常量 ⇒ 名单该删这一行`)
    assert.ok(
      readsPrejoinedConst(scanLiterals(code).blanked, names).length > 0,
      `${f} 的读取现场找不到该常量`,
    )
  }
  // 反向锁:名单不得静默变成空表(全仓一条预拼常量都找不到 = 判据漂了而账面还在"通过")
  const anyQualifying = expected.filter(
    (f) => prejoinedRepoConsts(maskComments(g(['show', `HEAD:${f}`]))).size > 0,
  ).length
  assert.ok(anyQualifying > 0, '真仓 HEAD 面上预拼常量判据一条都不命中 ⇒ 判据可能已失效')
})

test('T20 遮噪机必须认正则字面量(否则它对立项那一型全盲)', () => {
  const code =
    "const re = /[\"']/g\nconst TOOL_FILE = join(ROOT, 'apps', 'x.ts')\nreadFileSync(TOOL_FILE, 'utf8')\n"
  const { mask, blanked } = scanLiterals(code)
  assert.match(blanked, /readFileSync\(/, '正则里的引号不得把后半份文件吞掉')
  assert.equal(mask[code.indexOf('readFileSync')], 0, '调用本身不得被当成字面量体')
  // ⚠️ 这里原来是一条"朴素那遍确实吞了"的反向对照 —— 它钉的是**缺陷行为**(24 道门被判
  // no-content 的原因),不是判据该有的性质。缺陷修好之后它还要求红,等于要求代码是坏的。
  // 反向对照换了方向:现在锁的是"**只有一台机器**" —— blankStrings 必须是 scanLiterals 的投影,
  // 两条实现一条规则是本仓记的最多的漂移成因(§22c / 守门 103 的"取源只能有一份实现")。
  assert.equal(
    blankStrings(code),
    scanLiterals(code).blanked,
    'blankStrings 必须是同一台分词器的投影(分叉成第二台 ⇒ 一半判定重新变盲)',
  )
  assert.match(
    readFileSync(resolve(ROOT, 'scripts/lib/code-mask.mjs'), 'utf8'),
    /export function blankStrings\(text\) \{\n\s*return scanLiterals\(text\)\.blanked\n\}/,
    'blankStrings 的函数体必须是那一行投影(不得再自带一遍状态机)',
  )
  // 正则体内的假调用仍必须不可见 —— 否则上面那条绿只是"遮噪被整体关掉"的假象
  assert.ok(
    !/readFileSync\s*\(/.test(scanLiterals('const re = /readFileSync\\(join\\(ROOT/g\n').blanked),
    '正则体内的 readFileSync 必须仍被清空',
  )
})

test('T23 立项那一型的最小复现:唯一读取藏在正则行之后 ⇒ loose-fs(修前 = no-content)', () => {
  // 阳性对子(票面要求):这一格在遮噪修复前判 no-content,修复后必须判 loose-fs。
  const hidden =
    "import { readFileSync } from 'node:fs'\nconst re = /[\"']/g\nreadFileSync(join(ROOT, 'apps/web/src/x.ts'), 'utf8')\n"
  assert.equal(classify('scripts/check-t23.mjs', hidden).kind, 'loose-fs')
  // 阴性对子(票面要求):**真除法不得开正则状态**。`width / height` 之后同一行还有字符串,
  // 若那个 `/` 被当正则起始,扫描器会一路清到行尾 ⇒ 'apps/web' 从 strings 里消失
  // ⇒ 首段白名单再也看不见它(判据静默变宽,而不是报错)。
  const div =
    "const ratio = width / height\nconst note = 'apps/web'\nreadFileSync(join(ROOT, note), 'utf8')\n"
  const { strings, blanked } = scanLiterals(div)
  assert.ok(
    strings.some((s) => s.closed && s.body === 'apps/web'),
    '除法之后的字符串必须仍在册 —— 那个 / 被误认成正则起始就是判据变宽',
  )
  assert.match(blanked, /readFileSync\(/)
  // 除法链一个正则 span 都不许产出(连续两个 / 也不许)
  assert.equal(
    scanSpans('const q = a / b / c\nconst r = d / e\n').filter((s) => s.kind === 'regex').length,
    0,
    '真除法被当成正则 ⇒ 遮噪面被扩大,判据会开始看不见真 token',
  )
})

test('T24 遮噪只剩一台机器:分词器住在 lib/code-mask.mjs,本门不得自带第二台', () => {
  const gateSrc = readFileSync(resolve(ROOT, 'scripts/check-gate-face-discipline.mjs'), 'utf8')
  const libSrc = readFileSync(resolve(ROOT, 'scripts/lib/code-mask.mjs'), 'utf8')
  // ① 本门必须**引**那一份实现,并且自己一台都不写。这一条替代了旧的"maskComments 必须走
  //    同一个 scanSpans"—— 2026-09-28 把 118 私有的那份更聪明的遮噪器上收进 lib 之后,
  //    "同一台机器"这件事的**落点**变了,但它要防的东西一点没变:两台分词器一条规则,
  //    必然出现"这半边判定看得见、那半边看不见"(§22c / 守门 103 的"取源只能有一份实现")。
  assert.match(gateSrc, /from '\.\/lib\/code-mask\.mjs'/, '本门没引唯一遮罩层')
  for (const def of [
    'scanSpans',
    'readStringSpan',
    'readRegexSpan',
    'scanLiterals',
    'blankByMask',
    'maskComments',
    'blankStrings',
    'regexCanStart',
  ]) {
    assert.ok(
      !new RegExp(`function ${def}\\s*\\(`).test(gateSrc),
      `本门里还留着 \`function ${def}(\` 的定义 —— 上收到 lib 之后不得再分叉第二台`,
    )
  }
  // ② lib 那一面:每台扫描器只许有一处实现,maskComments 必须走 scanSpans(而不是自己追引号)
  assert.equal((libSrc.match(/function readStringSpan\(/g) || []).length, 1, '字符串扫描只能有一份')
  assert.equal((libSrc.match(/function scanSpans\(/g) || []).length, 1, '分词器只能有一台')
  assert.match(
    libSrc,
    /export function maskComments\(src\) \{[\s\S]{0,600}?for \(const s of scanSpans\(src\)\)/,
    'maskComments 不得自带一遍引号状态机(它服务的判据是"字符串要保留",但**注释区间**必须由同一台分词器给出)',
  )
  // ③ 两个导出的**档**各钉一头:旧导出必须仍关着正则档(它是 131/135/148/150 的现读数基线,
  //    打开等于替别人的门换读数),新导出必须开着(156 按括号配平取实参,正则里的 `(` 不遮
  //    就会把真调用读成"配不平" —— 现读 4 处未判定里 3 处正是这一型)。
  assert.match(libSrc, /blankSpans\(src, \['line', 'block', 'string'\], \{ regex: false \}\)/)
  assert.match(libSrc, /blankSpans\(src, \['line', 'block', 'string', 'regex'\]\)/)
  // ④ 反向锁:朴素那台独立状态机不得回到 lib(它只允许作为"关掉正则档的同一次分词"存在)
  assert.ok(
    !/while \(i < src\.length\) \{/.test(libSrc),
    'lib 里不得再出现第二台独立 while 状态机(那台就是 24 道门被判 no-content 的原因)',
  )
})

test('T21 锚点判据未被放宽(票面硬约束)+ 基参数收窄在位', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/check-gate-face-discipline.mjs'), 'utf8')
  assert.ok(
    src.includes(
      'const REPO_ANCHOR_RE = /(?:join|resolve|normalize|dirname|isAbsolute)\\s*\\([^)]{0,40}\\bROOT\\b/',
    ),
    'REPO_ANCHOR_RE 必须逐字未动 —— 放宽它是主会话量过再收回的决定(假阳比漏报更贵)',
  )
  // 收窄方向也要能被机器发现:ROOT 必须是基参数,否则 dirname(ROOT) 会逃到仓库外
  assert.match(src, /const ROOT_BASE_RE = \//)
  assert.ok(
    REPO_CONTENT_FILE_RE.source.length > 0 && REPO_CONTENT_DIRS.length > 0,
    '首段白名单必须在位',
  )
})

test('T22 白名单两处"已知漏报"的前提必须仍然成立(前提一变这条就红)', () => {
  const verdicts = analyze(ROOT, 'head').verdicts
  const kindOf = (f) => verdicts.find((v) => v.file === f)?.kind
  // ① 点开头的根级文件被 FILE_RE 挡在外面。**不得**把这条钉成"某个真实文件当前是 loose-fs" ——
  //    原先钉的就是 `check-api-routes.mjs`,而它已于 2026-09-26(`1e7ed628e9b`,守门 8 扩三端)
  //    迁进取材层变成 `face`,于是一道**变好了**的改动把这把尺子钉红(把仓库瞬时状态当恒定前提的
  //    典型形状)。改判构造面:排除的代价由"造一个 dot 读取出来看它终态"证明,与仓里恰好有没有
  //    样本无关。
  //
  //    为什么不是"扫人群":本枚改这条时实测扫过一遍 HEAD —— 唯一新增命中是
  //    `check-uncommitted-age.mjs` 的 `existsSync(join(ROOT, '.git'))`,那是**存在性探测**不是
  //    内容读取,它被判 `no-content` 是正确的。所以"任何 dot 读取都不得落到 no-content"这条
  //    人群不变量会产假阳 ⇒ 放弃该形态(假阳比漏报更贵:它指使人去修没坏的东西)。
  const PJ_HEAD =
    "import { readFileSync } from 'node:fs'\nimport { dirname, join, resolve } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nconst ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')\n"
  const qualOf = (dotName) =>
    prejoinedRepoConsts(
      maskComments(`${PJ_HEAD}const X = join(ROOT, '${dotName}')\nreadFileSync(X, 'utf8')\n`),
    ).size
  const constructed = classify(
    'scripts/check-t22.mjs',
    `${PJ_HEAD}const IGNORE_FILE = join(ROOT, '.x-ignore.json')\nreadFileSync(IGNORE_FILE, 'utf8')\n`,
  )
  assert.equal(
    constructed.kind,
    'loose-fs',
    '构造的 dot 内容读取必须仍被合取接住 —— 接不住才说明排除真在漏东西',
  )
  // qual 用门自己导出的 `prejoinedRepoConsts` 现算(不在测试里重抄判据,§22c)。
  // 关键是**成对**:非点形态必须 qual 1,否则"dot 得 0"可能只是 helper 没跑(§22c 的复读机教训)。
  assert.equal(qualOf('.x-ignore.json'), 0, '点开头根级文件必须**不**进首段白名单(被钉住的那一格排除)')
  assert.equal(qualOf('x-not-dot.json'), 1, '同形只差一个点前缀 ⇒ 必须 qualify(否则上一条 0 是恒真)')
  assert.ok(
    !REPO_CONTENT_FILE_RE.test('.x-ignore.json') && REPO_CONTENT_FILE_RE.test('PROJECT_PLAN.md'),
    'FILE_RE 的方向必须仍是"挡点前缀、认非点前缀"',
  )
  // ② 两跳(常量→遍历器→局部变量)**预拼规则**不追数据流。HEAD 面这两道门(check-tagsview-visual /
  //    check-i18n-namespace-passing)原先整道门被判 no-content,那格**是遮噪机的失明给的,不是这条规则**;
  //    遮噪修好后它们由整文件合取落到 loose-fs,所以这里断言的是"预拼规则仍然不追两跳" + 终档已是红。
  //    **不得**为了让这条绿就把判据放宽到"任何含 ROOT 的 const"(§12 记过:那等于没有白名单)。
  const twoHop = ['scripts/check-tagsview-visual.mjs', 'scripts/check-i18n-namespace-passing.mjs']
  for (const f of twoHop) {
    assert.equal(
      kindOf(f),
      'loose-fs',
      `${f} 的档位变了:两跳形态被重新估过,请同步本条与自检 P21 的期望`,
    )
    const code = maskComments(g(['show', `HEAD:${f}`]))
    const names = prejoinedRepoConsts(code)
    assert.ok(names.size > 0, `${f} 现在连一个仓库常量都拿不出 ⇒ 本条前提需重估`)
    assert.equal(
      readsPrejoinedConst(scanLiterals(code).blanked, names).length,
      0,
      `${f} 的读取实参真能找到该常量 ⇒ 两跳已不再是漏报,本条与自检 P21 都要改`,
    )
  }
})

// ─── T25–T30 `--root` 的取值与「判不出」的**形态**(2026-09-28,G-322 第三处收尾)───────
// 立因是实测,不是读码推测。改前三条(HEAD 版跑出来的原文,逐条留档):
//   `--root --staged`  ⇒ 抛 face-reader 的 `Undetermined: git rev-parse 失败: … ENOENT`
//                        **裸栈 + RC=1** —— `--staged` 档同时被吞掉;
//   `--root scripts`   ⇒ 抛 assertRepoRoot 的 Undetermined **裸栈 + RC=1**(旧 try 只包 analyze);
//   `--root`(结尾无值)⇒ 经 `|| '.'` **静默**当成没给值,RC=0 且照常出结论。
// 本仓对「判不出」的口径是 **exit 2 + 点名原因**(同文件 analyze 的 catch 就是这条),所以这里
// 收成的**只有形态**:分类判据 / 棘轮 / 遮噪层一律未动 —— 那一半由 T28 的「合法 --root 与不带
// --root 的结论逐字同形」钉住,T29 钉「新代码真被 main 调用」(函数在而无人调 = 提交链上一路绿灯)。
const GATE_PATH = resolve(ROOT, 'scripts/check-gate-face-discipline.mjs')
function runGate(args) {
  const r = spawnSync(process.execPath, [GATE_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 28,
  })
  return { rc: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}
// 裸栈指纹:V8 的栈帧行(`    at …`)。判"不冒红也不记绿"的形态时,这条必须不存在。
const STACK_FRAME_RE = /^\s+at\s+\S/m

test('T25 --root --staged ⇒ exit 2 + 点名实得 token,且不跑判据、不打裸栈', () => {
  const r = runGate(['--root', '--staged'])
  assert.equal(r.rc, 2, `应 exit 2(判不出),实得 ${r.rc}\nstderr:\n${r.err}`)
  assert.match(r.err, /无法判定/, '必须按"判不出"口径说话,不冒红也不记绿')
  assert.match(r.err, /"--staged"/, `必须点名实得 token,实得:\n${r.err}`)
  assert.ok(!STACK_FRAME_RE.test(r.err), `不得再打裸栈:\n${r.err}`)
  // 关键:它在**任何分类之前**就停了 —— stdout 一个结论都不许有,否则账面读起来像"跑过了"。
  assert.equal(r.out.trim(), '', `不该产出任何分类结论:\n${r.out}`)
})

test('T26 --root <非仓库根> ⇒ exit 2 + 转述 assertRepoRoot 原话,不打裸栈', () => {
  const r = runGate(['--root', 'scripts'])
  assert.equal(r.rc, 2, `应 exit 2,实得 ${r.rc}\nstderr:\n${r.err}`)
  assert.match(r.err, /不是仓库根/, '必须把基准错位的原话转述出来')
  assert.ok(!STACK_FRAME_RE.test(r.err), `Undetermined 不该再逃出 main:\n${r.err}`)
  assert.equal(r.out.trim(), '', `判不出时不得产出结论:\n${r.out}`)
})

test('T27 --root 结尾无值 ⇒ exit 2 点名"其后没有任何参数"(旧版是静默回落 .)', () => {
  const r = runGate(['--root'])
  assert.equal(r.rc, 2, `不得静默当没给值(旧版这里 RC=0 且照常出结论),实得 ${r.rc}`)
  assert.match(r.err, /\(其后没有任何参数\)/, `必须如实说"没给值",实得:\n${r.err}`)
  assert.ok(!STACK_FRAME_RE.test(r.err), `不得打裸栈:\n${r.err}`)
})

test('T28 正向对照:合法 --root 与不带 --root 的结论逐字同形(证明只改了形态)', () => {
  const bare = runGate([])
  const dot = runGate(['--root', '.'])
  const abs = runGate(['--root', ROOT])
  assert.equal(bare.rc, 0, `不带 --root 必须照旧 exit 0\n${bare.err}`)
  assert.equal(dot.rc, 0, `--root . 必须照旧 exit 0\n${dot.err}`)
  assert.equal(abs.rc, 0, `--root <仓库根绝对路径> 必须照旧 exit 0\n${abs.err}`)
  // 逐字同形:分类读数一字不改是这张票的硬约束(改前/改后的同一份读数也已在交付报告里贴出)。
  assert.equal(dot.out, bare.out, '--root . 的结论与不带旗标不同形 ⇒ 判据被动过')
  assert.equal(abs.out, bare.out, '--root <仓库根> 的结论与不带旗标不同形 ⇒ 判据被动过')
})

test('T29 装车锁:resolveRootArg 必须真被 main 调用,旧的两处写法不得回来', () => {
  const src = readFileSync(GATE_PATH, 'utf8')
  assert.ok(
    /const \{ root, errorLines \} = resolveRootArg\(argv\)/.test(src),
    'main() 没调用 resolveRootArg ⇒ 新校验是死代码,提交链上一路绿灯(守门 70/76/81 同型)',
  )
  assert.ok(
    /function main\(argv\) \{\s*\n\s*const \{ root, errorLines \} = resolveRootArg\(argv\)/.test(src),
    'resolveRootArg 必须是 main 的第一件事(在它之前不许有裸 assertRepoRoot / 裸取 root)',
  )
  // 旧的吞值写法与"裸调用"写法都不得回来
  assert.ok(
    !/argv\.includes\('--root'\)\s*\?\s*resolve\(argv\[argv\.indexOf\('--root'\) \+ 1\]/.test(src),
    '旧的 `argv[argv.indexOf(--root) + 1] || .` 取值形态又回来了',
  )
  const mainBody = src.slice(src.indexOf('function main(argv)'), src.indexOf('\nfunction ', src.indexOf('function main(argv)') + 1))
  assert.ok(
    !/^\s*assertRepoRoot\(root, '本门'\)$/m.test(mainBody),
    'main() 里不得再**裸**调 assertRepoRoot(抛出的 Undetermined 会逃成裸栈 + RC=1)',
  )
})

test('T30 纯函数面:flagValue 四态 + resolveRootArg 三态(§22c:import 判据,不抄第二份)', () => {
  // flagValue 的四格 —— 缺旗标 / 合法值 / 紧邻是另一个旗标 / 结尾无值
  assert.deepEqual(flagValue(['--staged'], '--root'), {
    present: false,
    valid: false,
    value: null,
    token: null,
  })
  assert.equal(flagValue(['--root', 'some/dir'], '--root').valid, true)
  assert.deepEqual(flagValue(['--root', '--staged'], '--root'), {
    present: true,
    valid: false,
    value: null,
    token: '--staged',
  })
  assert.equal(flagValue(['--root'], '--root').token, null)
  // 空串也算无效(不能把 `--root ""` 读成"根是空串")
  assert.equal(flagValue(['--root', ''], '--root').valid, false)

  const bad = resolveRootArg(['--root', '--staged'])
  assert.equal(bad.root, null)
  assert.ok(bad.errorLines.length > 0 && /"--staged"/.test(bad.errorLines.join('\n')))

  const noValue = resolveRootArg(['--root'])
  assert.equal(noValue.root, null, '`--root` 结尾不得回落成仓库根')

  const ok = resolveRootArg([])
  assert.equal(ok.root, ROOT, '不给 --root 时按脚本自身位置推导仓库根(与改前同形)')
  assert.deepEqual(ok.errorLines, [])
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
