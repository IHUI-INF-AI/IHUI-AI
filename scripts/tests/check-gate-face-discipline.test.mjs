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
const {
  classify,
  decide,
  usesLayerRead,
  gitContentReads,
  GATE_GLOB,
  prejoinedRepoConsts,
  readsPrejoinedConst,
  scanLiterals,
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

test('T15 朴素遮噪被吞时新判据仍命中(证明牙齿在新判据上,不是旧合取)', () => {
  const src =
    PJ_HEAD +
    BLIND +
    "const TOOL_FILE = join(ROOT, 'packages', 'shared', 'src', 'chat', 'tool-display.ts')\n" +
    PJ_TAIL
  assert.equal(classify('scripts/check-x.mjs', src).kind, 'loose-fs')
  // 反向对照(这条才让 T15 不是复读机):同一份文本走**旧**那遍遮噪,`readFileSync(` 一个不剩,
  // 于是旧判据的整文件合取第二半为空 ⇒ 旧口径只能给 no-content。新判据不是靠旧合取捡漏。
  const naive = blankStrings(maskComments(src))
  assert.ok(/readFileSync\s*\(/.test(src), '原文里确有调用')
  assert.ok(!/readFileSync\s*\(/.test(naive), '朴素遮噪机把它吞了 —— 这正是原判据失明处')
})

test('T16 白名单边界:运行台账 / 只在部署机的忽略副本 / tee 产物 / 逃出仓库根,都不得判红', () => {
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
    const k = classify('scripts/check-neg.mjs', PJ_HEAD + BLIND + body).kind
    assert.notEqual(k, 'loose-fs', `假阳型被判红:${body.slice(0, 46)}`)
  }
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

test('T19 真仓 HEAD 面:新判据抓到的门逐名在册(收紧的覆盖面必须是量出来的)', () => {
  // 名单取"结论行带预拼常量标记"的那一批 —— 这就是本规则在真仓上的**全部**增量。
  // 有人迁移了其中一道 ⇒ 名单该缩;新冒出一道 ⇒ 必须先读明它真判磁盘再登记。
  // (不在这里重抄判据,§22c:名单只用于核覆盖面,不参与任何判定。)
  const expected = [
    'scripts/check-adapter-wiring.mjs',
    'scripts/check-db-schema-drift.mjs',
    'scripts/check-next-env-dist.mjs',
  ].sort()
  const verdicts = analyze(ROOT, 'head').verdicts
  const got = verdicts
    .filter((v) => v.why.includes('预拼仓库常量'))
    .map((v) => v.file)
    .sort()
  assert.deepEqual(got, expected, `本规则新抓到的门与登记名单不符:${got.join(',') || '(无)'}`)
  for (const f of expected) {
    const v = verdicts.find((x) => x.file === f)
    assert.equal(v.kind, 'loose-fs')
    // 逐名验明正身:该文件确实有一处读取调用把**以 ROOT 为基参数**的常量当实参
    const code = maskComments(g(['show', `HEAD:${f}`]))
    const names = prejoinedRepoConsts(code)
    assert.ok(names.size > 0, `${f} 拿不出预拼常量 ⇒ 判红了个空`)
    assert.ok(
      readsPrejoinedConst(scanLiterals(code).blanked, names).length > 0,
      `${f} 的读取现场找不到该常量`,
    )
  }
})

test('T20 第二遍遮噪必须认正则(否则它对立项那一型全盲)', () => {
  const code =
    "const re = /[\"']/g\nconst TOOL_FILE = join(ROOT, 'apps', 'x.ts')\nreadFileSync(TOOL_FILE, 'utf8')\n"
  const { mask, blanked } = scanLiterals(code)
  assert.match(blanked, /readFileSync\(/, '正则里的引号不得把后半份文件吞掉')
  assert.equal(mask[code.indexOf('readFileSync')], 0, '调用本身不得被当成字面量体')
  // 反向对照:朴素那遍确实吞了 —— T15 的 BLIND 夹具因此不是摆设,而是真复现了失明现场
  assert.ok(
    !/readFileSync\s*\(/.test(blankStrings(code)),
    '朴素遮噪机吞掉了 readFileSync —— 原判据失明的原因',
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
  // ① 点开头的根级文件被 FILE_RE 挡在外面,所以 check-api-routes 那条读取目前**只能**靠旧合取兜住。
  //    它哪天不再是 red,本票的排除就真的在漏东西 —— 那时必须回来重估 FILE_RE,而不是把这条注释改掉。
  assert.equal(
    kindOf('scripts/check-api-routes.mjs'),
    'loose-fs',
    '点文件排除的前提(已被旧判据抓到)不再成立',
  )
  // ② 两跳(常量→遍历器→局部变量)不追数据流:HEAD 面实测 2 道门属于这一型,至今仍是 no-content。
  //    它们被迁移或判据升级时该更新这里,但**不得**为了让这条绿就把判据放宽到"任何含 ROOT 的 const"。
  const twoHop = ['scripts/check-tagsview-visual.mjs', 'scripts/check-i18n-namespace-passing.mjs']
  for (const f of twoHop)
    assert.equal(kindOf(f), 'no-content', `${f} 的两跳漏报形态变了,请重估本条与本规则`)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
