// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-926 全仓残留账(2026-10-21 立)—— 「已跟踪却被 .gitignore 覆盖」的文件 × 目录性质台账的对账测试。
//
// 炸点(与 `lint-staged-archive-outlet.test.mjs` 同一机制,那一枚只钉 archive 一族,本枚把它扩成全仓账):
// 任何经 `scripts/safe-commit.mjs` 的提交,只要声明集里含「已跟踪 ∧ 被 .gitignore 覆盖 ∧ 被根
// package.json 的 lint-staged glob 命中」的文件,lint-staged 收尾那次 `git add -- <绝对路径>`(不带 -f)
// 就被 git 拒绝 ⇒ `✖ lint-staged failed due to a git error` ⇒ 整批守门在 pre-commit 一步全废。
//
// 本文件不复制任何 glob 语义、不复制任何枚数(§0.1/§0.6):
//   - 命中判定 = import lint-staged 自己的 matchFiles / groupFilesByConfig / validateConfig / searchConfigs;
//   - 被忽略的已跟踪集 = 现跑 `git ls-files -ci --exclude-standard`;
//   - 目录性质清单 = `scripts/data/lint-staged-ignored-tracked.json`(只记机器推不出的判断事实:
//     档位/归属/消费方证据/到期/出路)。本文件对它只做对账,绝不把它的条数或枚数抄成断言值。
//
// 三条承重不变量:
//   ① 每枚 ignored-tracked 文件都必须能在台账里按目录前缀找到归属(T3)⇒ 新增一处未普查的即翻红;
//   ② 每枚「会被命中」的 A 档目录都必须有就近出口件,且**已在索引里跟踪**(T4)+ 被 searchConfigs
//      真的发现(T5)+ glob 一条都不命中本子树(T6)+ 射程不外溢(T7)。T4 是 bootstrap 账:
//      被忽略目录里的出口件只有 `-f` 入库(或走对象空间)才对 lint-staged 存在,archive 那枚的
//      三臂实测已钉死「已跟踪」是承重条件 ⇒ 未落地面 T4 点名给出 `git add -f` 路径,不静默放过;
//   ③ 残留集可计算(T9):现算「仍会被根 glob 命中 ∧ 未被任何出口件中和 ∧ 不在 B/C 档清单里」== 0。
//      这一条才是把「一次性普查」变成「会随新增翻红的账」的那一格。
//
// 出口件写法纪律(照 `.ihui-agent/archive/.lintstagedrc.json` 同形同写法):
//   内容恒为 `{ "*.archive-noop": "node -e 0" }` —— 单条哑任务、pattern 不以 `..` 开头(否则接管全仓)、
//   不用 `_comment`(实测它的值会被登记成一条潜在可执行命令)。JSON 不在水印 EXT_MAP 内,
//   `inject` 实报 skip-type ⇒ 出口件天然不进水印覆盖面,由 T8 的 injectableRel 反向锁住。
//
// 出口件代价(必须看见才叫决定):`groupFilesByConfig` 按**目录前缀整体划走子树**,所以就近出口件
// 会连带把同目录下**没被忽略**的已跟踪源文件一起划出 eslint/prettier 覆盖面。本文件按 OUTLET_LOSS_LIMIT
// 设上限(T7b):出口件只许压在小面积、非源码主战的目录上 —— 这正是 `apps/api`(1892 枚 root-hit)与
// `apps/mobile-rn`(571 枚)只能进 C 档交人裁、而不是硬塞 A 档的原因。
//
// 〔2026-10-25 校正 T7 口径〕旧口径把"命中根 glob"记成"失去覆盖",这是双计:工具自己的忽略面还挡在
// 前面。实测(同一份未格式化 md):放进 `.ihui-agent/tmp/` 时 `prettier --check` 报
// `All matched files use Prettier code style!`(整目录被 `.prettierignore` 忽略,压根没检查),复制到
// 仓库外立刻报 `[warn] Code style issues found` ⇒ archive 那批文件**本来就不在** prettier 覆盖面内,
// 旧口径却把它读成"被出口件弄丢 64 枚 > 限额 50"、恒红。新口径只问工具自己:prettier 面用
// `getFileInfo` 读 `.prettierignore`(不另写一把 glob,§0.6);eslint 面按根 eslint glob 命中即计入
// (实测 eslint **不**忽略点目录:`.ihui-agent/tmp/probe.cjs` 被真 lint 出 `no-unused-vars`)。
// 限额 50 与"给源码目录塞黑洞出口件必红"这一型都不动。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { __test__ as WM } from '../watermark.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LEDGER_REL = 'scripts/data/lint-staged-ignored-tracked.json'
const LEDGER_ABS = path.join(ROOT, 'scripts', 'data', 'lint-staged-ignored-tracked.json')
const ROOT_PKG_REL = 'package.json'
const ROOT_PKG_ABS = path.join(ROOT, ROOT_PKG_REL)
const OUTLET_BASENAME = '.lintstagedrc.json'
const OUTLET_LOSS_LIMIT = 50
const TIERS = new Set(['A', 'B', 'C'])
const NUL = String.fromCharCode(0)

const posix = (p) => p.split(path.win32.sep).join(path.posix.sep)
const ROOT_POSIX = posix(ROOT)

/** 派生 git 必须显式接管 stdio(AGENTS §12g);本文件全程只读,零 git 写操作。 */
function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  })
}

const lib = async (name) =>
  import(pathToFileURL(path.join(ROOT, 'node_modules/lint-staged/lib', name)).href)

const { matchFiles } = await lib('matchFiles.js')
const { groupFilesByConfig } = await lib('groupFilesByConfig.js')
const { validateConfigLogic } = await lib('validateConfig.js')
const { searchConfigs } = await lib('searchConfigs.js')

const silentLogger = { error: () => {}, warn: () => {}, log: () => {} }

function readLedger() {
  assert.ok(existsSync(LEDGER_ABS), `取材不到目录性质台账:${LEDGER_REL} ⇒ 未判定(§0.3)`)
  const raw = JSON.parse(readFileSync(LEDGER_ABS, 'utf8'))
  assert.ok(
    Array.isArray(raw.entries) && raw.entries.length > 0,
    `台账 entries 为空 ⇒ 无输入,不记绿(§0.3)`,
  )
  return raw
}

/** 「已跟踪却被忽略」全量集(现读,不硬编码枚数)。 */
function ignoredTrackedFiles() {
  return git(['ls-files', '-ci', '--exclude-standard', '-z'])
    .split(NUL)
    .filter(Boolean)
    .map((rel) => posix(rel))
}

function rootConfig() {
  const cfg = JSON.parse(readFileSync(ROOT_PKG_ABS, 'utf8'))['lint-staged']
  assert.ok(
    cfg && typeof cfg === 'object',
    '取材不到根 package.json 的 lint-staged 配置 ⇒ 未判定(§0.3)',
  )
  return validateConfigLogic(cfg, ROOT_PKG_ABS, silentLogger)
}

const asCandidates = (rels) =>
  rels.map((rel) => ({ filepath: `${ROOT_POSIX}/${rel}`, status: 'M' }))

/** 单枚文件是否被根配置任一 glob 命中(用 lint-staged 自己的匹配实现,不自己写 glob)。 */
function hitByRoot(rel, patterns) {
  const one = asCandidates([rel])
  return patterns.some((p) => matchFiles(one, p, ROOT_POSIX).length > 0)
}

/** 按目录前缀(最长匹配)把一枚文件归到台账条目;目录名含 `[slug]`/`(main)` 等 glob 元字符,故只按字面路径比。 */
function resolveEntry(rel, entries) {
  let best = null
  for (const e of entries) {
    const d = e.dir
    const inside = rel === d || rel.startsWith(`${d}/`)
    if (!inside) continue
    if (!best || d.length > best.dir.length) best = e
  }
  return best
}

const outletRelFor = (dir) => `${dir}/${OUTLET_BASENAME}`

/** 出口件是否已在盘上(与"是否已入库"是两件事:后者由 T3 单独点名 bootstrap 名单)。 */
const outletOnDisk = (dir) => existsSync(path.join(ROOT, ...outletRelFor(dir).split('/')))

/** lint-staged 自己发现的 config 表(键 = 绝对 posix 路径,已按深者在前排序)。 */
async function discoveredConfigs() {
  const found = await searchConfigs({ cwd: ROOT, topLevelDir: ROOT }, silentLogger)
  const out = {}
  for (const [k, v] of Object.entries(found)) out[posix(k)] = v
  return out
}

const trackedSet = () =>
  new Set(
    git(['ls-files', '-z'])
      .split(NUL)
      .filter(Boolean)
      .map((rel) => posix(rel)),
  )

test('T0 取材非空:ignored-tracked 集 / 根 config / 台账三者都必须现读取得到(取不到不记绿)', () => {
  const files = ignoredTrackedFiles()
  assert.ok(files.length > 0, 'git ls-files -ci 枚举到 0 ⇒ 本测试无输入,不记绿(§0.3)')
  assert.ok(Object.keys(rootConfig()).length > 0, '根 lint-staged 配置为空 ⇒ 未判定')
  assert.ok(readLedger().entries.length > 0, '台账为空 ⇒ 未判定')
})

test('T1 台账形状锁:tier 合法、dir 唯一且规范、A/B/C 各自必备字段齐备(§0.6 单一真相源)', () => {
  const { entries, schema } = readLedger()
  assert.equal(schema, 1, `台账 schema 期望 1,现读 ${schema} ⇒ 判据与本文件的读法要对账`)
  const seen = new Set()
  for (const e of entries) {
    assert.ok(TIERS.has(e.tier), `${e.dir}: tier "${e.tier}" 不在 A/B/C 内`)
    assert.ok(!seen.has(e.dir), `${e.dir}: 台账目录重复登记(一个键只能有一条当前状态)`)
    seen.add(e.dir)
    assert.ok(
      !e.dir.startsWith('/') && !posix(e.dir).endsWith('/'),
      `${e.dir}: dir 必须是不带首/尾斜杠的相对路径`,
    )
    assert.ok(e.owner && e.why && e.until, `${e.dir}: owner/why/until 三要素缺一即无主豁免(§0.7)`)
    assert.match(e.until, /^20\d{2}-\d{2}-\d{2}$/, `${e.dir}: until 必须是 YYYY-MM-DD`)
    if (e.tier === 'B' || e.tier === 'C') {
      assert.ok(
        e.route && e.route.length > 20,
        `${e.dir}: ${e.tier} 档必须写明出路(route),否则交主控席=没说清`,
      )
    }
  }
})

test('T2 归属完整性:每枚 ignored-tracked 文件都能按目录前缀在台账里找到归属(新增未普查即翻红)', () => {
  const entries = readLedger().entries
  const orphans = ignoredTrackedFiles().filter((rel) => !resolveEntry(rel, entries))
  assert.deepEqual(
    orphans,
    [],
    `${orphans.length} 枚「已跟踪却被忽略」的文件在台账里没有归属(${orphans.slice(0, 8).join(', ')})` +
      '⇒ 谁把它们带进 safe-commit 声明集,那枚提交的整批守门就会在 lint-staged 一步全废。' +
      `出路:现算它们是否被根 glob 命中,再按 A/B/C 定档登记进 ${LEDGER_REL}。`,
  )
})

test('T3 A 档出口件必须已在索引里跟踪(未入库 = 对被忽略目录里的 lint-staged 等于不存在)', () => {
  const entries = readLedger().entries
  const patterns = Object.keys(rootConfig())
  const tracked = trackedSet()
  const need = []
  for (const e of entries.filter((x) => x.tier === 'A')) {
    const covered = ignoredTrackedFiles().filter((rel) => resolveEntry(rel, entries)?.dir === e.dir)
    const boom = covered.filter((rel) => hitByRoot(rel, patterns))
    if (boom.length > 0) need.push({ dir: e.dir, boom: boom.length })
  }
  const missing = []
  const plainAddable = []
  for (const n of need) {
    const rel = outletRelFor(n.dir)
    if (tracked.has(rel)) continue
    const ignoredByGit = git(['check-ignore', '-v', '--no-index', '--', rel]).trim().length > 0
    ;(ignoredByGit ? missing : plainAddable).push(rel)
  }
  assert.deepEqual(
    [...missing, ...plainAddable],
    [],
    `${missing.length + plainAddable.length} 枚 A 档出口件尚未入库(其中 ${missing.length} 枚所在目录被忽略、必须 git add -f 或走对象空间 bootstrap;` +
      `${plainAddable.length} 枚所在目录未被忽略、普通 git add 即可):${[...missing, ...plainAddable].join(', ')}` +
      '⇒ 未入库前它们对 lint-staged 的 git 枚举不可见或被跳过,爆炸面照旧。bootstrap 归主控席。',
  )
})

test('T4 功能态:A 档出口件必须被 lint-staged 自己的 searchConfigs 真的发现(入库了但写法/路径不认也点名)', async () => {
  const entries = readLedger().entries
  const patterns = Object.keys(rootConfig())
  const found = await discoveredConfigs()
  const need = []
  for (const e of entries.filter((x) => x.tier === 'A')) {
    const covered = ignoredTrackedFiles().filter((rel) => resolveEntry(rel, entries)?.dir === e.dir)
    if (covered.filter((rel) => hitByRoot(rel, patterns)).length === 0) continue
    need.push(outletRelFor(e.dir))
  }
  const undiscovered = need.filter((rel) => !Object.keys(found).some((k) => k.endsWith(`/${rel}`)))
  assert.deepEqual(
    undiscovered,
    [],
    `已声明的出口件里有 ${undiscovered.length} 枚没被 searchConfigs 发现(${undiscovered.join(', ')})` +
      '⇒ 光在盘上/在索引里不够,还得是它那条 git 枚举(--cached ∪ --others --exclude-standard)认得的形式',
  )
})

test('T5 出口件写法纪律:恒为单条哑任务、glob 对本子树已跟踪文件一条都不命中、且不以 .. 接管全仓', () => {
  const entries = readLedger().entries
  const tracked = trackedSet()
  for (const e of entries.filter((x) => x.tier === 'A')) {
    const rel = outletRelFor(e.dir)
    if (!outletOnDisk(e.dir)) continue
    assert.ok(existsSync(path.join(ROOT, ...rel.split('/'))), `出口件不在盘上:${rel}`)
    const raw = JSON.parse(readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8'))
    const keys = Object.keys(raw)
    assert.equal(keys.length, 1, `${rel}: 只留一条哑任务;多一条就多一次"值被当命令"的机会`)
    assert.equal(typeof raw[keys[0]], 'string', `${rel}: 值必须是字符串命令`)
    assert.equal(
      keys[0],
      '*.archive-noop',
      `${rel}: pattern 必须与 archive 那枚同形同写法(同族出口不许各写一份)`,
    )
    const validated = validateConfigLogic(raw, path.join(ROOT, ...rel.split('/')), silentLogger)
    assert.deepEqual(
      Object.keys(validated),
      keys,
      `${rel}: validateConfig 改写了 pattern ⇒ 命中集与判据不是同一份`,
    )
    const sub = [...tracked].filter((f) => f.startsWith(`${e.dir}/`))
    assert.ok(sub.length > 0, `${rel}: 子树里枚举不到已跟踪文件 ⇒ 无输入,不记绿(§0.3)`)
    for (const pattern of keys) {
      const hits = matchFiles(asCandidates(sub), pattern, ROOT_POSIX)
      assert.equal(
        hits.length,
        0,
        `${rel}: glob "${pattern}" 命中子树内 ${hits.length} 枚已跟踪文件 ⇒ 又开始跑任务、又会 re-stage 失败`,
      )
    }
    assert.equal(
      WM.injectableRel(rel),
      false,
      `${rel}: 水印层认为它可注入 ⇒ 与 inject 实报 skip-type 两头对不上,要先改一处`,
    )
  }
})

test('T6 出口件射程不外溢:出口桶恰等于其子树候选集,仓内其余文件仍归根配置', async () => {
  const entries = readLedger().entries
  const configs = await discoveredConfigs()
  const rootKey = `${ROOT_POSIX}/${ROOT_PKG_REL}`
  const bystander = `${ROOT_POSIX}/${'AGENTS.md'}`
  for (const e of entries.filter((x) => x.tier === 'A')) {
    const outletKey = `${ROOT_POSIX}/${outletRelFor(e.dir)}`
    if (!configs[outletKey]) continue
    const tracked = [...trackedSet()]
    const sub = tracked.filter((f) => f.startsWith(`${e.dir}/`))
    const files = [...asCandidates(sub), { filepath: bystander, status: 'M' }]
    const grouped = await groupFilesByConfig({ configs, files })
    const bucket = (grouped[outletKey]?.files ?? []).map((f) => f.filepath)
    assert.deepEqual(
      bucket.sort(),
      sub.map((r) => `${ROOT_POSIX}/${r}`).sort(),
      `${outletRelFor(e.dir)}: 出口桶 ≠ 子树全集(少一枚 = 那枚回到根配置继续炸;多一枚 = 射程外溢)`,
    )
    assert.ok(
      !bucket.includes(bystander),
      `${outletRelFor(e.dir)}: 把子树外的文件也划走了 = 整仓守门静默失效`,
    )
    assert.deepEqual(
      (grouped[rootKey]?.files ?? []).map((f) => f.filepath),
      [bystander],
      `${outletRelFor(e.dir)}: 根配置桶应当只剩子树外的对照文件`,
    )
  }
})

const { default: prettier } = await import('prettier')
const PRETTIER_IGNORE = path.join(ROOT, '.prettierignore')

/** prettier 自己会不会处理这枚文件(忽略面与语言支持都问 prettier 本体,不复制判据 —— §0.6)。 */
async function prettierWouldProcess(rel) {
  const info = await prettier.getFileInfo(path.join(ROOT, ...rel.split('/')), {
    ignorePath: [PRETTIER_IGNORE],
    resolveConfig: false,
  })
  return !info.ignored && info.inferredParser !== null
}

/** 根配置的两面:命令里写了 prettier / eslint 的键(不按扩展名硬编码,根配置换了这里跟着换)。 */
function taskFaces() {
  const cfg = rootConfig()
  return {
    prettier: Object.keys(cfg).filter((p) => String(cfg[p]).includes('prettier')),
    eslint: Object.keys(cfg).filter((p) => String(cfg[p]).includes('eslint')),
  }
}

const hitsAny = (rel, patterns) =>
  patterns.some((p) => matchFiles(asCandidates([rel]), p, ROOT_POSIX).length > 0)

test('T7 出口件代价按工具真实覆盖面记账:被划走且工具本来就处理的枚数不得超过限额', async () => {
  const faces = taskFaces()
  assert.ok(
    faces.prettier.length > 0 && faces.eslint.length > 0,
    '根配置里认不出 eslint / prettier 两面 ⇒ 未判定(§0.3),下面的度量会退化成 0 损失',
  )
  // 探针先自证"问 prettier"这条路是活的:面外的普通源码必须被判为"会处理",否则新口径永远报 0。
  assert.equal(
    await prettierWouldProcess('scripts/check-tracked-ignored.mjs'),
    true,
    '正探针失败:.prettierignore 把普通源码也忽略了?那新口径的 0 损失不可信',
  )
  for (const e of readLedger().entries.filter((x) => x.tier === 'A' && outletOnDisk(x.dir))) {
    const rel = outletRelFor(e.dir)
    const sub = [...trackedSet()].filter((f) => f.startsWith(`${e.dir}/`))
    assert.ok(sub.length > 0, `${rel}: 子树里枚举不到已跟踪文件 ⇒ 无输入,不记绿(§0.3)`)
    const diverted = sub.filter((f) => hitsAny(f, [...faces.prettier, ...faces.eslint]))
    assert.ok(
      diverted.length > 0,
      `${rel}: 一枚都没被根配置命中 ⇒ 出口件已无对象,这条代价判据空转,应连出口件一起撤`,
    )
    const loss = []
    for (const f of diverted) {
      // eslint 面:根 glob 命中即算损失(eslint 不忽略点目录,实测);prettier 面:还得 prettier 自己不忽略。
      if (hitsAny(f, faces.eslint) || (await prettierWouldProcess(f))) loss.push(f)
    }
    // 被出口件划走、但工具本来就不处理的(如 `.prettierignore` 整目录忽略的 archive)成本为 0,不记损失:
    // 这条等式一旦被撤掉忽略面打破,loss 立刻涨回全量并顶破限额,所以它不是豁免,是度量。
    console.info(`[G-926 覆盖面] ${rel} 划走 ${diverted.length} 枚,工具真会处理 ${loss.length} 枚`)
    assert.ok(
      loss.length <= OUTLET_LOSS_LIMIT,
      `${rel} 会把同目录下 ${loss.length} 枚**本来就会被 lint/format** 的已跟踪文件划出覆盖面,` +
        `已超限额 ${OUTLET_LOSS_LIMIT}(${loss.slice(0, 5).join(', ')}…)。` +
        '就近出口件的代价是整棵子树的覆盖面,不是"补个配置文件"就完事 —— 覆盖面归零比炸一次更糟。' +
        '出路:把出口件挪到只包住炸点的叶子目录,或按 archive 那族的做法改 .gitignore 例外(需人裁)。',
    )
  }
})

test('T8 盘上没有出口件的 A 档必须真的零风险(现算不被根 glob 命中;glob 一旦纳入该扩展名即翻红)', () => {
  const entries = readLedger().entries
  const patterns = Object.keys(rootConfig())
  for (const e of entries.filter((x) => x.tier === 'A' && !outletOnDisk(x.dir))) {
    const covered = ignoredTrackedFiles().filter((rel) => resolveEntry(rel, entries)?.dir === e.dir)
    const boom = covered.filter((rel) => hitByRoot(rel, patterns))
    assert.deepEqual(
      boom,
      [],
      `${e.dir} 登记为 A 档但没配出口件,而根 glob 现已能命中其中 ${boom.length} 枚(${boom.slice(0, 5).join(', ')})` +
        '⇒ 前提变了:要么补出口件,要么按 T7 的代价上限重新定档。',
    )
  }
})

test('T9 残留账(承重不变量③):会炸 ∧ 未被出口件中和 ∧ 不在 B/C 清单 = 0', async () => {
  const entries = readLedger().entries
  const patterns = Object.keys(rootConfig())
  const configs = await discoveredConfigs()
  const rootKey = `${ROOT_POSIX}/${ROOT_PKG_REL}`
  const boomAll = ignoredTrackedFiles().filter((rel) => hitByRoot(rel, patterns))
  assert.ok(
    boomAll.length > 0,
    '现读没有任何 ignored-tracked 文件被根 glob 命中 ⇒ 前提已消失,应连台账一起撤,而不是留着空转',
  )
  const grouped = await groupFilesByConfig({
    configs,
    files: [...asCandidates(boomAll), ...asCandidates(['AGENTS.md'])],
  })
  const stillRootBucket = (grouped[rootKey]?.files ?? [])
    .map((f) => posix(path.relative(ROOT, f.filepath)))
    .filter((rel) => boomAll.includes(rel))
  const unaccounted = stillRootBucket.filter((rel) => {
    const e = resolveEntry(rel, entries)
    return !(e && (e.tier === 'B' || e.tier === 'C'))
  })
  const handoff = stillRootBucket.filter((rel) => {
    const e = resolveEntry(rel, entries)
    return e && (e.tier === 'B' || e.tier === 'C')
  })
  const handoffByDir = new Map()
  for (const rel of handoff) {
    const d = resolveEntry(rel, entries).dir
    handoffByDir.set(d, (handoffByDir.get(d) ?? 0) + 1)
  }
  const pendingBootstrap = unaccounted.filter((rel) => {
    const e = resolveEntry(rel, entries)
    return e && e.tier === 'A' && outletOnDisk(e.dir)
  })
  const neverPlanned = unaccounted.filter((rel) => !pendingBootstrap.includes(rel))
  const pendingDirs = [...new Set(pendingBootstrap.map((rel) => resolveEntry(rel, entries).dir))]
  console.info(
    `[G-926 残留账] ignored-tracked=${ignoredTrackedFiles().length} ` +
      `会被根 glob 命中=${boomAll.length} 已被出口件中和=${boomAll.length - stillRootBucket.length} ` +
      `仍会炸而交主控席(B/C)=${handoff.length} ` +
      `[${[...handoffByDir.entries()].map(([d, n]) => `${d}=${n}`).join(' | ')}] ` +
      `A档出口件待bootstrap=${pendingBootstrap.length}[${pendingDirs.join(', ')}] ` +
      `完全未入账=${neverPlanned.length} 残留=0:${unaccounted.length === 0}`,
  )
  assert.deepEqual(
    unaccounted,
    [],
    `${unaccounted.length} 枚文件仍会被根 lint-staged glob 命中、既没有被生效的出口件中和、也不在 B/C 档清单里。` +
      `其中 ${pendingBootstrap.length} 枚属"A 档出口件已建好但未入库"(所在目录被 .gitignore 覆盖 ⇒ 对 lint-staged 的 git 枚举等于不存在,` +
      `入库名单与 \`git add -f\` 出路见 T3:${pendingDirs.join(', ')});` +
      `${neverPlanned.length} 枚属"台账里根本没有 A 档出口安排"(${neverPlanned.slice(0, 8).join(', ')})。` +
      '⇒ 谁把它们带进 safe-commit 声明集,那枚提交的整批守门就在 lint-staged 一步全废。',
  )
})

test('T10 清单腐烂:台账每条都必须仍覆盖至少一枚 ignored-tracked 文件(失去命中=清单腐烂)', () => {
  const entries = readLedger().entries
  const files = ignoredTrackedFiles()
  const stale = entries
    .map((e) => ({
      dir: e.dir,
      n: files.filter((rel) => resolveEntry(rel, entries)?.dir === e.dir).length,
    }))
    .filter((x) => x.n === 0)
  assert.deepEqual(
    stale,
    [],
    `台账里 ${stale.length} 条已不再命中任何 ignored-tracked 文件(${stale.map((x) => x.dir).join(', ')})` +
      '⇒ §0.7:已登记的豁免/归属若被审面不再命中就是清单腐烂,必须删条目或说明理由',
  )
})

test('T11 到期:台账每条的 until 都不得早于今天(过期即回队列,不许静默续期)', () => {
  const today = new Date().toISOString().slice(0, 10)
  const expired = readLedger().entries.filter((e) => e.until < today)
  assert.deepEqual(
    expired,
    [],
    `${expired.length} 条已到期需重裁:${expired.map((e) => `${e.dir}(until ${e.until})`).join(', ')}`,
  )
})

/**
 * config 表的迭代顺序 = "深者在前"(lint-staged@17 `lib/searchConfigs.js:19` 的
 * `compareConfigPaths = (a,b) => numberOfLevels(b) - numberOfLevels(a) || a.localeCompare(b)`,
 * 该函数未导出,故这里镜像同一算式)。这个顺序是**承重的**:groupFilesByConfig 按迭代顺序
 * 逐个把文件从剩余集里摘走,浅的在前就会让根 package.json 先把全部文件吃掉、就近出口件一件都接不到
 * —— 本文件初版就是这么写错的,所以 T12 自带"真实发现表必须已满足该顺序"的防漂移对照。
 */
const levelsOf = (p) => posix(path.dirname(p)).split('/').length
const compareConfigPaths = (a, b) => levelsOf(b) - levelsOf(a) || a.localeCompare(b)
const deepestFirst = (cfgs) => {
  const out = {}
  for (const k of Object.keys(cfgs).toSorted(compareConfigPaths)) out[k] = cfgs[k]
  return out
}

test('T12 bootstrap 预演(纯函数,不碰 git):把未入库的 A 档出口件当作已发现喂进分组逻辑,必须逐枚中和掉', async () => {
  const entries = readLedger().entries
  const patterns = Object.keys(rootConfig())
  const boomAll = ignoredTrackedFiles().filter((rel) => hitByRoot(rel, patterns))
  const configs = await discoveredConfigs()
  const rootKey = `${ROOT_POSIX}/${ROOT_PKG_REL}`
  const files = [...asCandidates(boomAll), ...asCandidates(['AGENTS.md'])]

  // 防漂移:真实发现表必须已满足"深者在前",否则下面的镜像排序就是在造第二份口径。
  const realKeys = Object.keys(configs)
  assert.deepEqual(
    realKeys,
    [...realKeys].toSorted(compareConfigPaths),
    `searchConfigs 的返回顺序不再是"深者在前"(${realKeys.join(', ')})⇒ lint-staged 改了分组前提,` +
      '本文件的出口件判据(groupFilesByConfig 按迭代顺序摘文件)要重新对账,不能继续按旧假设判',
  )

  const residualOf = (cfgs) => {
    const bucket = groupFilesByConfig({ configs: deepestFirst(cfgs), files })
    return bucket.then((g) =>
      (g[rootKey]?.files ?? [])
        .map((f) => posix(path.relative(ROOT, f.filepath)))
        .filter((rel) => boomAll.includes(rel)),
    )
  }
  const before = await residualOf(configs)

  const pending = entries
    .filter((x) => x.tier === 'A' && outletOnDisk(x.dir))
    .map((x) => outletRelFor(x.dir))
    .filter((rel) => !realKeys.some((k) => k.endsWith(`/${rel}`)))
  if (pending.length === 0) {
    console.info(
      `[G-926 预演] 待 bootstrap 出口件=0 枚 ⇒ 预演退化为恒等式(真实中和账由 T9 现读 ${before.length} 枚残留判定)`,
    )
    return
  }
  const simulated = { ...configs }
  for (const rel of pending) {
    const abs = `${ROOT_POSIX}/${rel}`
    simulated[abs] = validateConfigLogic(
      JSON.parse(readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8')),
      abs,
      silentLogger,
    )
  }
  const after = await residualOf(simulated)
  const neutralized = before.filter((rel) => !after.includes(rel))
  const bystanderKept = (
    (await groupFilesByConfig({ configs: deepestFirst(simulated), files }))[rootKey]?.files ?? []
  )
    .map((f) => posix(path.relative(ROOT, f.filepath)))
    .includes('AGENTS.md')
  console.info(
    `[G-926 预演] 待 bootstrap 出口件=${pending.length} 枚;` +
      `根配置任务集 ${before.length} → ${after.length}(预演中和 ${neutralized.length} 枚);` +
      `AGENTS.md 仍归根配置=${bystanderKept}`,
  )

  // 每枚待入库的出口件都必须真的接住自己子树里的那一批(不是靠邻居的配置蹭过去的)。
  for (const rel of pending) {
    const dir = rel.slice(0, -`/${OUTLET_BASENAME}`.length)
    const got = neutralized.filter((f) => f.startsWith(`${dir}/`))
    assert.ok(
      got.length > 0,
      `${rel} 预演后一枚都没接住 ⇒ 写法/路径没生效(检查目录名里的 [slug]、(main) 等元字符),` +
        '入库也救不了这一族 —— 该改出口件而不是加豁免',
    )
  }
  assert.equal(
    neutralized.length,
    before.length - after.length,
    '预演对不上账:中和集与残留集不是同一个补集 ⇒ 分桶读法有 bug,不是 bootstrap 问题',
  )
  assert.ok(
    bystanderKept,
    '预演把子树之外的对照文件也划走了 ⇒ 出口件射程外溢,等于给无关文件关掉守门',
  )
  const residualDirs = new Set(after.map((rel) => resolveEntry(rel, entries)?.dir ?? '<无归属>'))
  assert.ok(
    !residualDirs.has('<无归属>'),
    '预演后仍有无归属的会炸文件(与 T2 同判,这里再钉一次:新增未普查即翻红)',
  )
  for (const d of residualDirs) {
    const e = entries.find((x) => x.dir === d)
    assert.ok(
      e.tier === 'B' || e.tier === 'C',
      `预演后 ${d} 仍会炸却不在 B/C 档 ⇒ A 档出口件没真接住它(检查 pattern 与目录名里的元字符)`,
    )
  }
})

/**
 * T13 的三臂夹具。为什么必须落在 scratch(T13 头注):lint-staged 会真改工作树并 `git add`,
 * 在真仓里 stage 归档件等于替主控席做提交前的索引写操作(本票禁止)。
 */
const { default: lintStaged } = await import(
  pathToFileURL(path.join(ROOT, 'node_modules/lint-staged/lib/index.js')).href
)

function gitAt(dir, args) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
}

/** 复刻 `.ihui-agent/tmp` 形状:被忽略子树 + 一棵已跟踪的台账 md + 根配置的 `*.md` 任务。 */
function makeOutletFixture({ outlet }) {
  const dir = mkScratch('ls-outlet-e2e-')
  const write = (rel, text) => {
    const abs = path.join(dir, ...rel.split('/'))
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, text)
  }
  gitAt(dir, ['init', '-q'])
  write('.gitignore', '.agent/*\n')
  write('package.json', JSON.stringify({ 'lint-staged': { '*.md': 'node mutate.mjs' } }, null, 2))
  write(
    'mutate.mjs',
    "import { appendFileSync } from 'node:fs'\nfor (const f of process.argv.slice(2)) appendFileSync(f, '\\nmutated\\n')\n",
  )
  write('root.md', '# root\n')
  write('.agent/tmp/ledger.md', '# ledger\n')
  if (outlet !== 'absent') {
    write(
      '.agent/tmp/.lintstagedrc.json',
      JSON.stringify({ '*.archive-noop': 'node -e 0' }, null, 2),
    )
  }
  gitAt(dir, ['add', '--', '.gitignore', 'package.json', 'mutate.mjs', 'root.md'])
  gitAt(dir, ['add', '-f', '--', '.agent/tmp/ledger.md'])
  if (outlet === 'tracked') gitAt(dir, ['add', '-f', '--', '.agent/tmp/.lintstagedrc.json'])
  return dir
}

async function runLintStaged(dir) {
  const lines = []
  const collect = (...args) => lines.push(args.join(' '))
  // 不能开 quiet:configureLogger 在 quiet 下把 log/warn 换成 noop,
  // 而 "Failed to stage changes from tasks!" 走的正是 logger.log ⇒ 开了就再也断言不到。
  // logger 是 index.js 的**第二个参数**(不是 options 字段),放错位置就落回 console,
  // 断言面读到空串 —— 这是本用例初版实际踩到的坑。
  const ok = await lintStaged(
    {
      cwd: dir,
      quiet: false,
      stash: false,
      revert: false,
      allowEmpty: true,
      concurrent: false,
    },
    { error: collect, warn: collect, log: collect },
  )
  return { ok, text: lines.join('\n') }
}

const indexBlob = (dir, rel) => gitAt(dir, ['show', `:${rel}`])

async function runOutletArm(outlet) {
  const dir = makeOutletFixture({ outlet })
  try {
    const result = await runLintStaged(dir)
    return {
      ...result,
      ledger: indexBlob(dir, '.agent/tmp/ledger.md'),
      root: indexBlob(dir, 'root.md'),
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

/**
 * T13 三臂端到端:出口机制只在"就近 config 已入库"时生效。
 * 取材面刻意不用真仓 —— 本票禁止任何 git 写操作;夹具在 scratch 里 git init,
 * 复刻 `.ihui-agent/tmp` 的"已跟踪 ∧ 被忽略 ∧ 命中根 glob"形状。
 */
test('T13 三臂端到端(scratch 夹具):出口件入库 ⇒ 子树整目录跳过且根任务照常;缺出口/未入库 ⇒ 仍复现 Failed to stage', async () => {
  const noOutlet = await runOutletArm('absent')
  assert.equal(noOutlet.ok, false, '无出口件竟然成功 ⇒ 夹具没复现炸点,本测试无牙')
  assert.match(
    noOutlet.text,
    /Failed to stage changes from tasks!/,
    '无出口件未报出 lint-staged 的 staging 失败',
  )

  const trackedOutlet = await runOutletArm('tracked')
  assert.equal(trackedOutlet.ok, true, '出口件已入库却仍失败 ⇒ 就近空转机制失效')
  assert.doesNotMatch(
    trackedOutlet.text,
    /Failed to stage changes from tasks!/,
    '出口件已入库仍报 staging 失败',
  )
  assert.equal(
    trackedOutlet.ledger,
    '# ledger\n',
    '被忽略子树的文件仍被任务改写/重新 add ⇒ 出口桶没接住它',
  )
  assert.match(trackedOutlet.root, /mutated/, '根配置的 *.md 任务没有照常执行 ⇒ 出口射程外溢')

  const untrackedOutlet = await runOutletArm('untracked')
  assert.equal(
    untrackedOutlet.ok,
    false,
    '出口件只在盘上未入库却成功 ⇒ "已跟踪"不再是承重条件,判据要重写',
  )
  assert.match(
    untrackedOutlet.text,
    /Failed to stage changes from tasks!/,
    '未入库的出口件没有复现失败 ⇒ 反证臂没有牙',
  )
})

/** 核心取材/判定小工具,供别处 import(§22d 双形态:被 import 时不触发任何 CLI 动作)。 */
export const __test__ = {
  readLedger,
  ignoredTrackedFiles,
  rootConfig,
  hitByRoot,
  resolveEntry,
  outletRelFor,
  outletOnDisk,
  compareConfigPaths,
  deepestFirst,
  discoveredConfigs,
  trackedSet,
  LEDGER_REL,
  OUTLET_BASENAME,
  OUTLET_LOSS_LIMIT,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// 被 `node --test` 拉起时 NODE_TEST_CONTEXT 已在,不当作 CLI 直跑 ⇒ 不往测试输出里插一行噪声。
if (isDirectRun && !process.env.NODE_TEST_CONTEXT) {
  console.info(
    '本文件是 node:test 用例,请用 `node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs` 跑(§22d 双形态守卫)。',
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
