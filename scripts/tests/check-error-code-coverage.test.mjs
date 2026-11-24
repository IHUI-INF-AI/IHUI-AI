// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「errorCode 覆盖率对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 钉四件事,顺序有意义:
 *  1. 判据本身咬得住(未收录码必须红 —— 阳性对照,不读脚本自述);
 *  2. **2026-09-24 崩溃回归**:词包工作树滞后 HEAD 时,默认面必须照常判完并 exit 0,
 *     面取不到必须显式 exit 2 —— 既不崩、也不把"没判成"记成绿;
 *  3. 同一轮只读一个面(--staged 判索引,坏内容进了索引就藏不住);
 *  4. 装车:runner 里真的注册了这道门(blocking + 自己的 skipEnv + id 不撞号)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as G } from '../check-error-code-coverage.mjs'

const GIT = resolveGitBin()
const SCRIPT = 'check-error-code-coverage.mjs'

const CATALOG = `export const TURN_ERROR_CLASSES = ['TIMEOUT', 'BAD_PARAMS'] as const
export const ERROR_CODE_CATALOG: Readonly<Record<string, ErrorCatalogEntry>> = Object.freeze({
  TIMEOUT: { titleKey: 'TIMEOUT.title', actionKey: 'TIMEOUT.action', category: 'backendTimeout' },
  BAD_PARAMS: { titleKey: 'BAD_PARAMS.title', actionKey: 'BAD_PARAMS.action', category: 'invalidResponse' },
})
`
const MESSAGES =
  JSON.stringify(
    {
      ai: {
        pane: {
          errorCatalog: {
            TIMEOUT: { title: '请求超时', action: '稍后重试' },
            BAD_PARAMS: { title: '参数不合法', action: '检查参数' },
          },
        },
      },
    },
    null,
    2,
  ) + '\n'
/** 09-25 事故里磁盘副本的形状:合法 JSON,但没有 errorCatalog 子树。 */
const STALE_MESSAGES = JSON.stringify({ ai: { pane: { retry: '重试' } } }, null, 2) + '\n'

/** 同一张表的另一种**排版**:每条写成多行。2026-09-26 实测一枚只加两个码的提交把整表
 *  换成了这一形态(成因**不是** prettier —— 实测两种排版 prettier 都原样保留,是写表那一方
 *  换了排版),于是本门在 HEAD 上报出 106 处"未收录"—— 判据依附在排版上,
 *  就是把自己交给"下一个人怎么敲回车"。 */
const CATALOG_EXPANDED = `export const TURN_ERROR_CLASSES = ['TIMEOUT', 'BAD_PARAMS'] as const
export const ERROR_CODE_CATALOG: Readonly<Record<string, ErrorCatalogEntry>> = Object.freeze({
  TIMEOUT: {
    titleKey: 'TIMEOUT.title',
    actionKey: 'TIMEOUT.action',
    category: 'backendTimeout',
  },
  BAD_PARAMS: {
    titleKey: 'BAD_PARAMS.title',
    actionKey: 'BAD_PARAMS.action',
    category: 'invalidResponse',
  },
})
`

/** R4 的唯一出口夹具:内容与真仓同形态(必须真的导出 coerceKnownOr),否则 R4-OUTLET 会把自己判红。
 *  它不是"为了让门变绿而补的文件" —— 门现在真的依赖这一份,夹具不供它就等于让 e2e 跑在一个
 *  真仓不存在的形态上(那正是"延后与放开一条回退通道"的差别所在)。 */
const OUTLET = `export function coerceKnownOr<T extends string>(value: unknown, known: readonly T[], safe: T): T {
  return typeof value === 'string' && known.includes(value as string) ? (value as T) : safe
}
`

function git(dir, ...args) {
  return execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'init.defaultBranch=main',
      '-c',
      'user.name=gate-fixture',
      '-c',
      'user.email=gate-fixture@invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.autocrlf=false',
      '-C',
      dir,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/**
 * 把一份源码文件连同它的**相对依赖闭包**复制进夹具。
 *
 * 为什么不再手写清单(2026-09-29 实测事故):夹具原先用三条 `copyFileSync` 手工维护
 * "门脚本 + gitdir + face-reader",而 `scripts/lib/gitdir.mjs` 后来新增了
 * `import { countScratchSegments } from './scratch-dir.mjs'` —— 没人回头补第三份清单,
 * 于是临时仓里的门脚本整片 `ERR_MODULE_NOT_FOUND`,镜像 8 例里 6 例红且红的全是 e2e
 * 那几条。手工闭单子的失效形态从来不是"报错提醒你去补",而是"隔壁测试默默变红",
 * 而读报告的人会把它当成仓库缺陷(本次就先被读成"门 94 自己在红")。
 * 现在从源码走:凡 `from './x'` / `export … from './x'` / 动态 `import('./x')` 都跟着复制,
 * 递归 + 去重;解析不到文件的说明符(注释/散文里出现的形态)一律跳过,不造假失败。
 */
const SCRIPTS_DIR = fileURLToPath(new URL('../', import.meta.url))
// 说明符本身必须能匹配到,而**不要求 `from` 与 `import` 同行** —— 门脚本用的是多行 import 块
// (`import {\n  makeFaceReader,\n} from './lib/face-reader.mjs'`),按"行首 import … from"
// 写的正则会整块漏掉它,症状不是报错而是夹具少一份依赖 ⇒ e2e 那片红。
// 散文里的相对说明符(注释/文档)由下面的 existsSync 兜住:解析不到文件就跳过,不造假失败。
const REL_IMPORT_RE = /(?:\bfrom|\bimport)\s*['"](\.[^'"]+)['"]/g
/** 只跟"解析得到一个**文件**"的说明符:目录形态(`./lib`)与散文里的假说明符一并跳过。 */
function isFile(p) {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

function copyWithClosure(dir, rootUrl) {
  const queue = [rootUrl]
  const seen = new Set()
  while (queue.length) {
    const url = queue.shift()
    const from = fileURLToPath(url)
    if (seen.has(from) || !isFile(from)) continue
    seen.add(from)
    const rel = from.slice(SCRIPTS_DIR.length).replace(/\\/g, '/')
    const to = join(dir, 'scripts', ...rel.split('/'))
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
    const text = readFileSync(from, 'utf8')
    for (const m of text.matchAll(REL_IMPORT_RE)) {
      const child = new URL(m[1], url)
      if (isFile(fileURLToPath(child))) queue.push(child)
    }
  }
  return seen.size
}

/** 把真实门脚本 + 它 import 的 lib 复制进临时 git 仓,造一棵最小码面/词表/词包。
 *  `catalogText` 可换形状,用来证明"同一张内容、不同排版 ⇒ 同一份结论"。 */
function fixture(catalogText = CATALOG, outletText = OUTLET) {
  const dir = mkScratch('ihui-ecc-')
  try {
    const w = (rel, text) => {
      const p = join(dir, ...rel.split('/'))
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, text, 'utf8')
    }
    mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
    copyWithClosure(dir, new URL(`../${SCRIPT}`, import.meta.url))
    w('packages/shared/src/chat/error-catalog.ts', catalogText)
    w('packages/i18n/messages/web/zh-CN.json', MESSAGES)
    w('packages/api-client/src/client.ts', "const e = { errorCode: 'TIMEOUT' }\n")
    w('apps/ai-service/app/r.py', 'return {"ok": False, "errorCode": "BAD_PARAMS"}\n')
    w('packages/types/src/enum-coerce.ts', outletText)
    git(dir, 'init', '-q')
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'ecc fixture')
  } catch (e) {
    rmScratch(dir)
    throw e
  }
  return dir
}

function run(dir, args = []) {
  return spawnSync(process.execPath, [join(dir, 'scripts', SCRIPT), ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: dir,
    windowsHide: true,
    timeout: 120000,
    encoding: 'utf8',
  })
}

test('判据单元:扫描器咬住注释位而不吃类型声明;词包缺子树抛 UndeterminedError', () => {
  assert.ok(
    G.extractCodes('a.ts', "* errorCode 'BUDGET_EXHAUSTED'", 'ts').some(
      (h) => h.code === 'BUDGET_EXHAUSTED',
    ),
    '注释位必须咬住(BUDGET_EXHAUSTED 只存在于注释)',
  )
  assert.equal(G.extractCodes('a.ts', 'export interface E { errorCode?: string }', 'ts').length, 0)
  assert.throws(() => G.readCatalogMessages('{"ai":{"pane":{}}}', 'fixture'), G.UndeterminedError)
  assert.throws(() => G.readCatalogMessages('{ oops', 'fixture'), G.UndeterminedError)
})

test('e2e 干净夹具:exit 0 且结论行点名判定面(判据真的跑完了,不是跳过)', () => {
  const dir = fixture()
  try {
    const r = run(dir)
    assert.equal(r.status, 0, `stdout=${r.stdout} stderr=${r.stderr}`)
    assert.match(r.stdout, /错误码覆盖率通过/)
    assert.match(r.stdout, /判定面:HEAD blob/)
    assert.match(r.stdout, /产出 2 个 errorCode/)
  } finally {
    rmScratch(dir)
  }
})

test('e2e 阳性对照:未收录码必须红并点名文件行号(判据不响=尺子坏了)', () => {
  const dir = fixture()
  try {
    writeFileSync(
      join(dir, 'apps', 'ai-service', 'app', 'leak.py'),
      'raise ApiError(errorCode="ZZ_NOT_CATALOGED_E2E")\n',
      'utf8',
    )
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'leak a code')
    const r = run(dir)
    assert.equal(r.status, 1, `阳性对照必须红,实际 stdout=${r.stdout}`)
    assert.match(r.stderr, /R1/)
    assert.match(r.stderr, /ZZ_NOT_CATALOGED_E2E/)
    assert.match(r.stderr, /leak\.py/)
  } finally {
    rmScratch(dir)
  }
})

test('e2e 崩溃回归(09-25 事故形态):工作树词包滞后 HEAD —— HEAD 面照常判绿,磁盘面显式无法判定', () => {
  const dir = fixture()
  try {
    writeFileSync(
      join(dir, 'packages', 'i18n', 'messages', 'web', 'zh-CN.json'),
      STALE_MESSAGES,
      'utf8',
    )
    // ① 磁盘滞后 HEAD,未 staged:默认(HEAD)面必须仍 exit 0 —— 旧版在这里抛裸 Error、
    //    以 exit 1 冒充判据失败,逼出绕过钩子。
    const head = run(dir)
    assert.equal(head.status, 0, `HEAD 面不得被滞后工作树咬红:${head.stdout}${head.stderr}`)
    // ② --worktree 按磁盘判:取不到子树 ⇒ 必须 exit 2 并点名原因,既不崩也不记绿。
    const wt = run(dir, ['--worktree'])
    assert.equal(wt.status, 2)
    assert.match(wt.stderr, /无法判定/)
    assert.match(wt.stderr, /ai\.pane\.errorCatalog/)
    // ③ 坏内容进了索引:--staged 必须跟着红(同轮同面,坏的那一面藏不住),HEAD 面不受扰。
    git(dir, 'add', '-A')
    const staged = run(dir, ['--staged'])
    assert.equal(staged.status, 2, `索引里就是缺子树的词包,--staged 不得记绿:${staged.stdout}`)
    assert.match(staged.stderr, /无法判定/)
    assert.equal(run(dir).status, 0, 'HEAD 仍干净,不得被索引里的坏内容牵连')
  } finally {
    rmScratch(dir)
  }
})

test('e2e 两枚面旗同给 → exit 2(同一轮不得混读两个判定面)', () => {
  const dir = fixture()
  try {
    const r = run(dir, ['--staged', '--worktree'])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /不得同轮混读/)
  } finally {
    rmScratch(dir)
  }
})

test('排版无关(2026-09-26 自伤):条目写成多行 ⇒ 结论必须与单行档同判', () => {
  const a = fixture()
  const b = fixture(CATALOG_EXPANDED)
  try {
    const ra = run(a)
    const rb = run(b)
    assert.equal(ra.status, 0, `单行档基准必须绿:${ra.stdout}${ra.stderr}`)
    assert.equal(
      rb.status,
      0,
      `展开档被判红 ⇒ 判据还依附在排版上,而排版由"下一个写这张表的人"决定,不受本门控制:${rb.stdout}${rb.stderr}`,
    )
    const conc = (r) => (r.stdout.match(/错误码覆盖率通过[^\n]*/) || [''])[0].replace(/[^0-9]/g, '')
    assert.ok(conc(rb), '展开档必须给出通过结论行,不是"跳过"')
    assert.equal(conc(ra), conc(rb), '两种排版的计数结论必须一致(不是少读几条)')
  } finally {
    rmScratch(a)
    rmScratch(b)
  }
})

test('判据失明不得伪装成"全线违规":定位不到 catalog 表体 → exit 2 且一条"未收录"都不许出现', () => {
  const dir = fixture('export const SOMETHING_ELSE = Object.freeze({})\n')
  try {
    const r = run(dir)
    const out = `${r.stdout}${r.stderr}`
    assert.equal(r.status, 2, `应为"无法判定"(exit 2),实际 ${r.status}:${out}`)
    assert.match(out, /无法判定/)
    assert.doesNotMatch(
      out,
      /未收录/,
      '表体读不到时把每条错误码判成"未收录",等于把判据故障伪装成 106 处业务违规 ⇒ 逼人跳门',
    )
  } finally {
    rmScratch(dir)
  }
})

/** R4 系列(G-815963 扩出来的那一维)共用的写文件助手。 */
function writeIn(dir, rel, text) {
  const p = join(dir, ...rel.split('/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text, 'utf8')
}
const R4_PROBE =
  'export function readStatus(row: { status: unknown }) {\n  return row.status as ChatMessageStatus\n}\n'

/**
 * R4a **判红行**的结构形态,不是 "R4a" 这个标签串。
 * 2026-10-10 把 R4b 的射程与 R4a 分开印之后,摘要行永久带 "R4a" 字样(它现在要说清两个数各出自
 * 哪棵树)。若继续用 /R4a/ 做子串断言:`assert.match` 会被摘要行满足而变成恒真(注入没咬住也说咬住),
 * `assert.doesNotMatch` 会变成恒红(合规也被判成违规)。⇒ 装载证明一律钉判据产出的那句原文。
 */
const R4A_FINDING = /R4a \S+ 把外部值直转成枚举档/

test('R4a 端到端双向锁:注入 as ChatMessageStatus 到索引 ⇒ --staged 判红并点名,而 HEAD 面不得被牵连', () => {
  const dir = fixture()
  try {
    writeIn(dir, 'packages/shared/src/r4-probe.ts', R4_PROBE)
    git(dir, 'add', '-A') // 只进索引,不进 HEAD ⇒ 锚点 0
    const staged = run(dir, ['--staged'])
    assert.equal(staged.status, 1, `索引里有一处直转必须拦:${staged.stdout}${staged.stderr}`)
    assert.match(staged.stderr, R4A_FINDING)
    assert.match(staged.stderr, /r4-probe\.ts/)
    assert.match(staged.stderr, /ChatMessageStatus/)
    // 反向对照:HEAD 面上还没有这一族站点 ⇒ 全量档不得被别人未提交的索引内容牵连
    const head = run(dir)
    assert.equal(
      head.status,
      0,
      `HEAD 仍干净,不得被索引里的新站点判红:${head.stdout}${head.stderr}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('R4a 反向对照:同一形态只写在注释里 ⇒ --staged 必绿(门不得把解释自己的散文判成违规)', () => {
  const dir = fixture()
  try {
    writeIn(
      dir,
      'packages/shared/src/r4-comment.ts',
      `// 旧写法在这里只是说明:row.status as ChatMessageStatus 会透传未知值\nexport const ok = 1\n`,
    )
    git(dir, 'add', '-A')
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 0, `注释形态不得计入站点:${r.stdout}${r.stderr}`)
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, R4A_FINDING)
  } finally {
    rmScratch(dir)
  }
})

test('R4a 棘轮的两个方向:站点进了 HEAD ⇒ 只报数不判红;在此之上再加一处 ⇒ 判红(否则就是恒红门)', () => {
  const dir = fixture()
  try {
    writeIn(dir, 'packages/shared/src/r4-probe.ts', R4_PROBE)
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'land a legacy cast site') // 锚点 = 1
    const full = run(dir)
    assert.equal(full.status, 0, `HEAD 自身存量不得每天重判一遍:${full.stdout}${full.stderr}`)
    assert.match(full.stdout, /R4 枚举兜底/)
    assert.match(full.stdout, /存量只报数/)
    const stagedSame = run(dir, ['--staged'])
    assert.equal(stagedSame.status, 0, '索引 == HEAD(锚点相等)时不得判红')
    // 在既有站点之上再加一处 ⇒ 这一次是"把这一族加回来",必须红
    writeIn(dir, 'packages/shared/src/r4-probe.ts', R4_PROBE + R4_PROBE)
    git(dir, 'add', '-A')
    const stagedMore = run(dir, ['--staged'])
    assert.equal(stagedMore.status, 1, `站点数超过该文件 HEAD 自身存量必须红:${stagedMore.stdout}`)
    assert.match(stagedMore.stderr, R4A_FINDING)
  } finally {
    rmScratch(dir)
  }
})

/**
 * R4b 的射程端到端锁(G-815963 续,2026-10-10)。
 * 为什么必须有这一条而不是只留门内那条构造面用例:构造面证明的是 `collectCoerceFiles` 会取宽清单,
 * 而**"宽清单真的一路喂到判据、并且只在宽面上喂"**只有在临时 git 仓里端到端才量得到 ——
 * 本仓反复吃过"函数在、自检过、调用点没接"(守门 70/76/81/150)这一型。
 * 两臂各钉一件事:A 臂 = services 里的坏安全档必须被咬(旧窄面在这里恒绿);
 * B 臂 = 同一份内容放在两棵窄树与 services 之外必须不被咬(证明红来自"射程"而不是"整仓扫")。
 */
const R4B_BAD =
  "export function readState(row: { status: unknown }) {\n" +
  "  return coerceKnownOr(row.status, ['active', 'closed'], 'unknown-state')\n}\n"
const R4B_FINDING = /R4b \S+ 的安全档 'unknown-state' 不在它自己的全集/

test('R4b 端到端:services 里的坏安全档必被咬,而射程外同名文件不咬(射程=判据,不是顺手多扫)', () => {
  const inside = fixture()
  const outside = fixture()
  try {
    writeIn(inside, 'apps/api/src/services/r4b-probe.ts', R4B_BAD)
    git(inside, 'add', '-A')
    const red = run(inside, ['--staged'])
    assert.equal(red.status, 1, `services 必须进 R4b 射程:${red.stdout}${red.stderr}`)
    assert.match(red.stderr, R4B_FINDING)
    assert.match(red.stderr, /r4b-probe\.ts/)

    writeIn(outside, 'apps/web/src/r4b-probe.ts', R4B_BAD)
    git(outside, 'add', '-A')
    const green = run(outside, ['--staged'])
    assert.equal(
      green.status,
      0,
      `射程外不得被 R4b 判红(否则本门变成整仓扫,而 R4a 的窄口径也就没了):${green.stdout}${green.stderr}`,
    )
    assert.doesNotMatch(`${green.stdout}${green.stderr}`, R4B_FINDING)
  } finally {
    rmScratch(inside)
    rmScratch(outside)
  }
})

test('R4-OUTLET 摘线方向锁:唯一出口不再导出 coerceKnownOr ⇒ 判红并参与退出码(只打印不算拦)', () => {
  const dir = fixture(CATALOG, 'export function somethingElse(a: unknown) { return a }\n')
  try {
    const r = run(dir)
    assert.equal(r.status, 1, `出口没了必须拦,实际 ${r.status}:${r.stdout}${r.stderr}`)
    assert.match(r.stderr, /R4-OUTLET/)
    assert.match(r.stderr, /enum-coerce/)
  } finally {
    rmScratch(dir)
  }
})

test('R4b 未判定不得伪装成通过,也不得冒红:coerceKnownOr 少给第三参 ⇒ exit 0 且逐条点名', () => {
  const dir = fixture()
  try {
    writeIn(
      dir,
      'packages/shared/src/r4-coerce.ts',
      'import { coerceKnownOr } from "@ihui/types"\nexport const v = coerceKnownOr(row.status, DEMO_STATUSES)\n',
    )
    git(dir, 'add', '-A')
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 0, `判不出的形态不得冒红:${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /R4b 未判定/)
    assert.match(r.stdout, /r4-coerce\.ts/)
    // 补上第三参 ⇒ 同一条点名消失(证明那一条红/绿只差在那一参上,判据有牙)
    writeIn(
      dir,
      'packages/shared/src/r4-coerce.ts',
      `import { coerceKnownOr } from "@ihui/types"\nexport const v = coerceKnownOr(row.status, DEMO_STATUSES, 'cancelled')\n`,
    )
    git(dir, 'add', '-A')
    const fixed = run(dir, ['--staged'])
    assert.equal(fixed.status, 0)
    assert.doesNotMatch(fixed.stdout, /R4b 未判定/)
  } finally {
    rmScratch(dir)
  }
})

test('R4 问责档 --strict:有未判定 ⇒ exit 2 拒绝合格证,而缺省档同一面是 exit 0(只报不拦)', () => {
  const dir = fixture()
  try {
    writeIn(
      dir,
      'packages/shared/src/r4-strict.ts',
      "import { coerceKnownOr } from '@ihui/types'\nexport const v = coerceKnownOr(row.status, row.known)\n",
    )
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'a coerce site nobody can resolve')
    const normal = run(dir)
    assert.equal(normal.status, 0, `缺省档不得因未判定拦人:${normal.stdout}${normal.stderr}`)
    assert.match(normal.stdout, /R4b 未判定/)
    const strict = run(dir, ['--strict'])
    assert.equal(strict.status, 2, `--strict 必须拒绝出具合格证,实际 ${strict.status}`)
    assert.match(`${strict.stdout}${strict.stderr}`, /拒绝出具合格证/)
  } finally {
    rmScratch(dir)
  }
})

test('R4 取材面自证:枚举清单与内容同取自被审面,且夹具里非空(判据没在扫空气)', () => {
  const dir = fixture()
  try {
    const reader = G.makeFaceReader('head', dir)
    const files = G.collectEnumFiles(reader)
    assert.ok(files.length > 0, 'R4 枚举面在夹具上必须非空 —— 空面会被读成"没有违规"')
    assert.ok(
      files.some((f) => f.relPath === 'packages/shared/src/chat/error-catalog.ts'),
      'packages/shared/src 必须在 R4 射程内(与票面指定的两棵树之一)',
    )
    // 夹具本身零直转站点:门对"as const"这类合法断言不误伤
    const sites = files.flatMap((f) => G.extractEnumCastSites(f.relPath, f.src))
    assert.equal(sites.length, 0, `夹具里不该有直转站点:${JSON.stringify(sites)}`)
  } finally {
    rmScratch(dir)
  }
})

test('装车证明:runner 真注册了这道门,恰好一次、blocking、有自己的 skipEnv 且 id 不撞号', () => {
  const runner = readFileSync(new URL('../guardian-runner.mjs', import.meta.url), 'utf8')
  const at = [...runner.matchAll(new RegExp(`script: '${SCRIPT}'`, 'g'))]
  assert.equal(at.length, 1, `runner 里必须恰好一处调用 ${SCRIPT},实际 ${at.length}`)
  const before = runner.slice(0, at[0].index)
  const ids = [...before.matchAll(/id: '(\d+[a-z]?)',/g)]
  assert.ok(ids.length > 0, 'script 之前必须能找到 id')
  const id = ids[ids.length - 1][1]
  const all = [...runner.matchAll(/id: '(\d+[a-z]?)',/g)].map((m) => m[1])
  assert.equal(
    all.filter((x) => x === id).length,
    1,
    `id ${id} 在 runner 里重复,会串 skipEnv 与失败归属(撞号事故先例:75/76、91)`,
  )
  const entry = runner.slice(runner.lastIndexOf(`id: '${id}'`, at[0].index), at[0].index + 900)
  assert.match(entry, /mode: 'blocking'/, '必须 blocking —— warn 级挡不住码面悄悄漏')
  assert.match(entry, /skipEnv: 'HUSKY_SKIP_ERROR_CODE_COVERAGE'/, '必须有应急通道')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
