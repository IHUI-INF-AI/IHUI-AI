// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 36 `scripts/check-miniapp-tokens-sync.mjs` + 生成器 `scripts/sync-miniapp-tokens.mjs`
// §22c:判据函数**直接 import 源符号**,不在测试里复制第二份实现(复制的那份最先腐烂)。
//
// 这一族门在本仓翻过两次反向的车,所以每条都是成对的:
//   · 只比"副本已有的键" ⇒ 对「源头有、副本整批缺」一路报绿(旧版实测漏判 106 个 --color-* 档);
//   · 反过来把源头**全部**属性拿来判缺 ⇒ 又红 255 条,其中约 88 条是生成器按政策刻意不搬的档,
//     于是门被整体降权、连真漂移也没人看。
// 所以本文件既钉"缺一条受管档必须红"(T4/T9),也钉"非受管档绝不得红"(T3/T9e),
// 并钉两者用的是**同一个谓词**(T1/T6)—— 判据与生成器不同形就是这次事故的根因。
//
// 2026-09-25 追加第三对面 `@theme`(v4 颜色档注册区):前两维只对副本取值负责,而 v4 只把
// `@theme` 里的 `--color-*` 认作颜色档 ⇒ 出现过":root/.dark 逐位同值、项目色档整族不产出"的形态。
// 这一族新增的取证必须成对:派生态走真 CLI 必须绿(T19,否则本门是恒红门,唯一结局是逼人
// --no-verify 连带废掉全部守门),注册档落后/混入 -rgb 必须红(T20/T9g/T5c,否则新面是全盲门)。
// 写回侧的幂等与注释感知由 `sync-miniapp-tokens.mjs --self-test` 的 TH 组钉(T21 钉装车点)。
//
// ⚠️ 「真仓不得红」一律走 `--worktree`(磁盘面)或纯判据夹具:共享工作树常年并行,
// 拿 HEAD 面断言会把别人**未提交**的 tokens.css 改动冒充成本仓债务(上一版就是这么错的)。
// 但**判定面本身**(默认 HEAD / `--staged` 索引 / `--worktree` 逃生舱)靠真仓断言是证不出来的:
// 三面在真仓上恰好同结论是常态(内容本就一路被生成器同步),在那上面写"读的是哪一面"的断言就是恒绿。
// 所以 T15/T16 在临时 git 仓里造"三面互不相同"的现场,成对判方向。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { collectVars, maskComments } from '../lib/design-token-blocks.mjs'
import { gitBinary, Undetermined } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-miniapp-tokens-sync.mjs'
import { __test__ as gen } from '../sync-miniapp-tokens.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS_DIR = resolve(REPO, 'scripts')
// 生成器 2026-09-25 从端内搬到工具层(原因见该文件头注)。路径在本文件里只出现这一次:
// 上一版它在 6 处各写一遍字面量,搬一次就要改 6 处 —— 漏改的那几处会以"夹具跑不通"的形态
// 被下游读成"判据通过"(§22c 同型),所以钉成一条常量。
const GEN_REL = join('scripts', 'sync-miniapp-tokens.mjs')

const TOKENS = readFileSync(join(REPO, gen.TOKENS_SOURCE_REL), 'utf8')
const APP = readFileSync(join(REPO, gen.APP_CSS_REL), 'utf8')
const BASE = readFileSync(join(REPO, gen.BASE_CSS_REL), 'utf8')
const STYLE_TS = readFileSync(join(REPO, gen.STYLE_TS_REL), 'utf8')

/**
 * 真仓 app.css **纯内存**过一遍生成器 ⇒ 注册区落地后的派生态(零写盘,本票禁改端内文件)。
 * 三条用例(T2a/T8/T19)以它为基准:门的"不恒红"必须由**生成器真会产出的那一份**来证明,
 * 拿手搓夹具证明的只是"夹具恰好与门同形"。
 */
const GENERATED = gen.mergeAppCss(APP, gen.buildAppCssMaps(TOKENS), BASE)

/**
 * 在**指定选择器的第一个块内**按下标改第一条受管声明。
 * 为什么按下标而不是 `css.replace(line)`:同一条 `--color-x: v;` 在 `@theme` 与 `:root` 两区
 * 逐字相同(派生态本就同值),replace 会先命中排在前面的那一区 —— "我改的是 :root 面"这句前提
 * 于是根本没被执行(本票第一版就栽在这:删的是注册区那条,断言却在等 :root 面的缺档)。
 */
function tamperRegionFirstDecl(css, selector, action, onlyNames = null) {
  const blocks = gen.topLevelRanges(css, selector)
  assert.ok(blocks.length >= 1, `夹具需要至少一个 ${selector} 块,实得 ${blocks.length}`)
  const b = blocks[0]
  const body = css.slice(b.bodyStart, b.bodyEnd)
  let offset = 0
  for (const line of body.split('\n')) {
    const m = /^\s*(--color-[\w-]+)\s*:\s*[^;]+;\s*$/.exec(line)
    if (m && (!onlyNames || onlyNames.has(m[1]))) {
      const at = b.bodyStart + offset
      const end = at + line.length
      const next =
        action === 'drop'
          ? css.slice(0, at) + css.slice(end + 1)
          : css.slice(0, at) + `  ${m[1]}: #123456;` + css.slice(end)
      assert.notEqual(next, css, `夹具没改动成功(${selector}/${action})`)
      return { next, name: m[1] }
    }
    offset += line.length + 1
  }
  assert.fail(`${selector} 块里找不到受管声明行(生成器或判据已失效)`)
}

/** 注册区第一条声明被删/被改 ⇒ 只可能红在 @theme 面。 */
function tamperThemeRegion(css, action) {
  return tamperRegionFirstDecl(css, '@theme', action)
}

/** 真仓两面的受管档清单(生成器那侧算出来的),所有断言都以它为基准,不手抄数字。 */
function managedOf(css) {
  return {
    ':root': gen.deriveMiniappManaged(css, 'light'),
    '.dark': gen.deriveMiniappManaged(css, 'dark'),
  }
}

function namesOf(list) {
  return list.map((d) => d.name)
}

/** 把第一个 :root 块里第一条受管声明删掉/改值(档名不写死,夹具因此永远跟真仓同步)。 */
function tamperFirstManaged(css, action) {
  const managed = new Set([
    ...namesOf(managedOf(TOKENS)[':root']),
    ...namesOf(managedOf(TOKENS)['.dark']),
  ])
  return tamperRegionFirstDecl(css, ':root', action, managed)
}

/** 在演练仓里跑一次 CLI(闭包必须整条拷过去,只拷一个文件必然 ERR_MODULE_NOT_FOUND)。 */
function runGateCli(dir, args = []) {
  const r = spawnSync(
    process.execPath,
    [join(dir, 'scripts', 'check-miniapp-tokens-sync.mjs'), ...args],
    { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

/** 演练仓里跑一次 git(绝对路径来自取材层,不赌 PATH;autocrlf 关掉 —— 否则索引 blob 与盘上字节不等,夹具会假红)。 */
function gitAt(dir, args) {
  return execFileSync(
    gitBinary(),
    [
      '-c', 'safe.directory=*',
      '-c', 'core.quotepath=false',
      '-c', 'core.autocrlf=false',
      '-c', 'user.name=gate-fixture',
      '-c', 'user.email=gate-fixture@invalid',
      '-C', dir,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
  )
}

const APP_REL = 'apps/miniapp-taro/src/app.css'

/**
 * 建演练仓。**默认建成一个真 git 仓并提交夹具内容** —— 守门 36 的默认判定面是 HEAD blob,
 * 不建提交的话每条夹具用例都会以"取不到"红,而那与判据无关(是夹具失效)。
 * `git:false` = 完全不建仓(证明"取不到 ⇒ 无法判定"而不是回落到磁盘冒绿);
 * `commit:false` = 有仓但没有 HEAD(同一份磁盘内容,判死与判绿只差在这个面上)。
 */
function buildGateFixture({ appCss, tokensCss, git = true, commit = true }) {
  const dir = mkScratch('miniapp-tokens-sync')
  copyScriptWithClosure(SCRIPTS_DIR, 'check-miniapp-tokens-sync.mjs', join(dir, 'scripts'), [
    'lib/design-token-blocks.mjs',
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'sync-miniapp-tokens.mjs',
  ])
  const appDir = join(dir, 'apps', 'miniapp-taro', 'src')
  mkdirSync(appDir, { recursive: true })
  if (appCss !== null) writeFileSync(join(appDir, 'app.css'), appCss)
  const tokDir = join(dir, 'packages', 'design-tokens', 'src', 'styles')
  mkdirSync(tokDir, { recursive: true })
  writeFileSync(join(tokDir, 'tokens.css'), tokensCss)
  if (!git) return dir
  gitAt(dir, ['init', '-q', '-b', 'main'])
  if (!commit) return dir
  gitAt(dir, ['add', '-A'])
  gitAt(dir, ['commit', '-q', '-m', 'fixture'])
  return dir
}

/**
 * 造「HEAD / 索引 / 工作树 三份内容互不相同」的现场。
 * 判定面这类行为**只能用构造面证明**:真仓此刻三面同值,拿它取证等于什么都没测。
 * 顺序刻意是「提交 head → 暂存 index → 再改盘上 worktree」,于是 index 与 worktree 也不等。
 */
function buildFaceFixture({ tokensCss, appCssHead, appCssIndex, appCssWorktree }) {
  const dir = buildGateFixture({ tokensCss, appCss: appCssHead })
  const index = appCssIndex ?? appCssHead
  const worktree = appCssWorktree ?? index
  const appAbs = join(dir, APP_REL)
  writeFileSync(appAbs, index, 'utf8')
  gitAt(dir, ['add', '--', APP_REL])
  writeFileSync(appAbs, worktree, 'utf8')
  return dir
}


/** 把生成器连同它的输入拷进演练仓(它的 REPO_ROOT 由自身位置推导,必须整棵树)。 */
function buildGeneratorScratch({ appCss, styleTs = STYLE_TS, extraDeps = true }) {
  const dir = mkScratch('miniapp-tokens-gen')
  const genDst = join(dir, GEN_REL)
  mkdirSync(dirname(genDst), { recursive: true })
  copyFileSync(join(REPO, GEN_REL), genDst)
  if (extraDeps) {
    // 取源实现与生成器同在工具层(`scripts/lib/design-token-blocks.mjs`),生成器按相对路径引它;
    // 演练仓里不拷这一份就会 ERR_MODULE_NOT_FOUND —— 而"夹具跑不通"绝不能被读成"判据通过"。
    const libDst = join(dir, 'scripts', 'lib', 'design-token-blocks.mjs')
    mkdirSync(dirname(libDst), { recursive: true })
    copyFileSync(join(SCRIPTS_DIR, 'lib', 'design-token-blocks.mjs'), libDst)
  }
  for (const [rel, text] of [
    [gen.TOKENS_SOURCE_REL, TOKENS],
    [gen.BASE_CSS_REL, readFileSync(join(REPO, gen.BASE_CSS_REL), 'utf8')],
    [gen.APP_CSS_REL, appCss],
    [gen.STYLE_TS_REL, styleTs],
  ]) {
    const dst = join(dir, rel)
    mkdirSync(dirname(dst), { recursive: true })
    writeFileSync(dst, text)
  }
  return dir
}

function runGeneratorCli(dir, args = []) {
  const r = spawnSync(
    process.execPath,
    [join(dir, GEN_REL), ...args],
    { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

// ─── T1 同一个谓词:门判缺的集合 == 生成器负责写的集合(不是"副本已有的键") ───
test('T1 门判定的受管集恰为生成器导出的那几族(副本全空 ⇒ missing 恰等于受管清单)', () => {
  const want = managedOf(TOKENS)
  const wantTheme = gen.deriveThemeRegistryDecls(TOKENS)
  const empty = gate.compare({ tokensCss: TOKENS, appCss: '/* 一个受管档都没有 */' })
  assert.equal(
    empty.missing.length,
    want[':root'].length + want['.dark'].length + wantTheme.length,
    '缺档数必须等于三对面受管档总数'
  )
  assert.deepEqual(
    empty.missing.filter((m) => m.block === ':root').map((m) => m.name),
    namesOf(want[':root']),
    ':root 面缺档清单与 deriveMiniappManaged 不同形'
  )
  assert.deepEqual(
    empty.missing.filter((m) => m.block === '.dark').map((m) => m.name),
    namesOf(want['.dark']),
    '.dark 面缺档清单与 deriveMiniappManaged 不同形'
  )
  assert.deepEqual(
    empty.missing.filter((m) => m.block === '@theme').map((m) => m.name),
    namesOf(wantTheme),
    '@theme 面缺档清单与 deriveThemeRegistryDecls 不同形(注册区整族缺失必须被看见 —— 前两维全绿而到端 CSS 为零就是本面立项的起因)'
  )
  assert.ok(want[':root'].length > 150, `受管档总数异常偏小(${want[':root'].length})`)
  // 注册集 = light 受管集 **剔掉 -rgb**:两侧同表的两面条结论(数量不写死,按当次实测算)
  const rgbInLight = want[':root'].filter((d) => gen.isAlphaRgbTriple(d.name))
  assert.ok(rgbInLight.length > 0, 'tokens.css 里若一把 -rgb 都没有,A6/A4 那组判据就成了空转')
  assert.equal(
    want[':root'].length - wantTheme.length,
    rgbInLight.length,
    '注册集与 light 受管集的差集必须恰等于 -rgb 那批(不得多剔也不得少剔)'
  )
})

// ─── T2 反恒红:派生态必须绿,而真仓现状的红**只允许**来自尚未落地的注册面 ───
test('T2a 真仓派生态(GENERATED)三对面必须全绿 —— 否则本门是恒红门,唯一结局是逼人 --no-verify', () => {
  const r = gate.compare({ tokensCss: TOKENS, appCss: GENERATED })
  assert.deepEqual(r.missing, [], `缺档:${JSON.stringify(r.missing.slice(0, 5))}`)
  assert.deepEqual(r.mismatches, [], `值漂移:${JSON.stringify(r.mismatches.slice(0, 5))}`)
  assert.deepEqual(r.rgbInTheme, [], `脏档:${JSON.stringify(r.rgbInTheme)}`)
  // 阳性对照:派生态里真的有注册区且恰好一块 —— 否则上面三条是空转
  assert.ok(GENERATED.includes(gen.THEME_REGION_MARK), '生成器没产出注册区 ⇒ 本条断言失去意义')
  assert.equal(gen.topLevelRanges(GENERATED, '@theme').length, 1)
})

test('T2b 真仓现状:红只可能来自尚未落地的 @theme 面(:root/.dark 两维不得因本票变红)', () => {
  const r = gate.compare({ tokensCss: TOKENS, appCss: APP })
  assert.deepEqual(r.mismatches, [], `值漂移:${JSON.stringify(r.mismatches.slice(0, 5))}`)
  assert.deepEqual(r.rgbInTheme, [], `脏档:${JSON.stringify(r.rgbInTheme)}`)
  for (const m of r.missing)
    assert.equal(
      m.block,
      '@theme',
      `非注册面出现了缺档,那不是本票引入的:${JSON.stringify(m)} —— 先查是谁手删了受管行`
    )
  // 这条同时兼容两种现状(注册区未落地 ⇒ 报满;已落地 ⇒ 报 0),所以它不会随落地而腐烂。
})

test('T2c 注册区整族缺失 ⇒ 缺档数恰等于注册集(门不得因为"副本没有这个区"而记绿)', () => {
  const b = gen.topLevelRanges(GENERATED, '@theme')[0]
  const markAt = GENERATED.lastIndexOf(gen.THEME_REGION_MARK, b.open)
  assert.ok(markAt >= 0, '标记注释在块之前 —— 取不到就说明首次落地的块与标记脱开了')
  const noRegion = GENERATED.slice(0, markAt) + GENERATED.slice(b.end + 1)
  assert.notEqual(noRegion, GENERATED, '夹具没删掉注册区')
  const want = gen.deriveThemeRegistryDecls(TOKENS).length
  const r = gate.compare({ tokensCss: TOKENS, appCss: noRegion })
  assert.equal(r.missing.length, want, JSON.stringify(r.missing.slice(0, 3)))
  assert.ok(r.missing.every((m) => m.block === '@theme'))
  assert.equal(gen.topLevelRanges(noRegion, '@theme').length, 0, '夹具里注册区应当真的不存在')
})

// ─── T3 判据错的那一侧:非受管档绝不得算缺(255 红点里的 88 条即此) ───
test('T3 生成器按政策不搬的档不得判缺(web 独有 / 跨行渐变 / Tailwind v4 非色档)', () => {
  const skipped = [
    '--color-sidebar',
    '--color-sidebar-foreground',
    '--color-shell-panel',
    '--color-gradient-card-left',
    '--font-sans',
    '--animate-ripple',
    '--breakpoint-sm',
    '--text-vcenter-offset',
    '--z-max',
    '--global-box-shadow',
    '--shadow-premium',
  ]
  // 阳性对照:这些档必须**真的在源头里**,否则本条断言是空转(否定结论必须有正例喂同一判据)
  const sourceNames = new Set([
    ...namesOf(managedOf(TOKENS)[':root']),
    ...collectVars(TOKENS, ['@theme', ':root', '.dark']).keys(),
  ])
  const inSource = skipped.filter((n) => sourceNames.has(n))
  assert.ok(inSource.length >= 8, `夹具失效:跳过的档在 tokens.css 里只找到 ${inSource.length} 个`)

  const empty = gate.compare({ tokensCss: TOKENS, appCss: '/* 空 */' })
  const missingNames = new Set(empty.missing.map((m) => m.name))
  for (const n of inSource) assert.ok(!missingNames.has(n), `${n} 不属受管族,不得判缺`)
})

// ─── T4 阳性对照(门有牙):删一条受管档必判缺,旧 subset 判据在这里报绿 ───
// 基准一律取 GENERATED:`:root`/`.dark`/`@theme` 三对面在派态下都是齐的,
// 于是"缺 1 条"这个计数只可能来自本次篡改的那一条(拿 APP 做基准会混进 168 条注册缺档,
// 断言就退化成"缺档很多"而不是"缺的那条正是我删的")。
test('T4 从派生态副本删掉一条 :root 受管档 ⇒ 必判缺且点名', () => {
  const { next, name } = tamperFirstManaged(GENERATED, 'drop')
  const r = gate.compare({ tokensCss: TOKENS, appCss: next })
  assert.equal(r.missing.length, 1, JSON.stringify(r.missing))
  assert.equal(r.missing[0].name, name)
  assert.equal(r.missing[0].block, ':root')
})

test('T4b 从派生态副本删掉一条 @theme 注册档 ⇒ 必判缺且点名 @theme 面', () => {
  const { next, name } = tamperThemeRegion(GENERATED, 'drop')
  const r = gate.compare({ tokensCss: TOKENS, appCss: next })
  assert.equal(r.missing.length, 1, JSON.stringify(r.missing))
  assert.equal(r.missing[0].name, name)
  assert.equal(r.missing[0].block, '@theme')
})

// ─── T5 值不等必红,且两侧读数都报出来 ───
test('T5 受管档值不等 ⇒ 必判漂移并报出副本值与源头值', () => {
  const { next, name } = tamperFirstManaged(GENERATED, 'drift')
  const r = gate.compare({ tokensCss: TOKENS, appCss: next })
  assert.equal(r.mismatches.length, 1, JSON.stringify(r.mismatches))
  assert.equal(r.mismatches[0].name, name)
  assert.equal(r.mismatches[0].app, '#123456')
})

test('T5b 注册档值不等 ⇒ 必判漂移、点名 @theme 面与档名(任务书要求的 (e) 阳性对照)', () => {
  const { next, name } = tamperThemeRegion(GENERATED, 'drift')
  const r = gate.compare({ tokensCss: TOKENS, appCss: next })
  assert.equal(r.mismatches.length, 1, JSON.stringify(r.mismatches))
  assert.equal(r.mismatches[0].block, '@theme')
  assert.equal(r.mismatches[0].name, name)
  assert.equal(r.mismatches[0].app, '#123456')
})

// ─── T5c 反向:@theme 里塞进 -rgb ⇒ 判脏档,而不得顺手把该档算成"注册区缺它" ───
test('T5c 注册区混入 alpha 三元组 ⇒ 判脏档且 missing/mismatches 不受污染', () => {
  const b = gen.topLevelRanges(GENERATED, '@theme')[0]
  const rgbName = gen.deriveMiniappManaged(TOKENS, 'light').find((d) => gen.isAlphaRgbTriple(d.name)).name
  const dirty = `${GENERATED.slice(0, b.bodyStart)}\n  ${rgbName}: 1, 2, 3;${GENERATED.slice(b.bodyStart)}`
  const r = gate.compare({ tokensCss: TOKENS, appCss: dirty })
  assert.deepEqual(r.rgbInTheme, [rgbName], JSON.stringify(r.rgbInTheme))
  assert.equal(r.missing.length, 0, JSON.stringify(r.missing.slice(0, 3)))
  assert.equal(r.mismatches.length, 0, JSON.stringify(r.mismatches.slice(0, 3)))
})

// ─── T6 装车证明:谓词只有一份,门是 import 来的而不是抄来的 ───
test('T6 门与生成器共用同一张表与同一谓词(第二份实现必须判红)', () => {
  const gateSrc = readFileSync(join(SCRIPTS_DIR, 'check-miniapp-tokens-sync.mjs'), 'utf8')
  const genSrc = readFileSync(join(REPO, GEN_REL), 'utf8')
  assert.match(
    gateSrc,
    /from '\.\/sync-miniapp-tokens\.mjs'/,
    '门必须从生成器 import 受管集出口(生成器 2026-09-25 已搬到工具层,同模块内 import)'
  )
  assert.match(gateSrc, /deriveMiniappManaged/, '门必须走 deriveMiniappManaged,不得自己挑选择器')
  // 反向哨兵:门里不得再出现第二张表 / 第二份前缀字面量
  assert.equal(/MINIAPP_SKIP_PREFIXES\s*=/.test(gateSrc), false, '门里不得重新定义跳过表')
  assert.equal(/'--color-(sidebar|shell-panel|gradient)/.test(gateSrc), false, '门里不得出现第二份前缀清单')
  // 生成器侧:表恰好定义一次,且 filterTokens 真的走它
  assert.equal(
    (genSrc.match(/export const MINIAPP_SKIP_PREFIXES\s*=\s*\[/g) || []).length,
    1,
    '跳过表必须恰好一份'
  )
  assert.match(genSrc, /function filterTokens[\s\S]{0,220}isSkippedForMiniapp/, 'filterTokens 必须走同一张表')
  assert.match(genSrc, /function extractStandaloneRootBlock[\s\S]{0,900}isManagedForMiniapp/, '业务色收集必须走同一个谓词')
  // 反向哨兵(2026-09-25 搬家后新增):门与生成器都不得再把相对路径伸进 `apps/` ——
  // 那是守门 103 的 D1(repo-tooling 依赖端应用)+ D3(穿透实现细节)两条判据拦住的东西,
  // 而端应用声明 `exported:false`,连"补一条 requires"都不是出路(会把 T1 判红)。
  assert.equal(/from '\.\.\/apps\//.test(gateSrc), false, '门不得 import 端内文件')
  assert.equal(/from '\.\.[^']*\/apps\//.test(genSrc), false, '生成器不得按相对路径向上摸别的模块')
})

// ─── T14 搬家锁:旧路径与"第二份取源"都不许回来 ───
// 本票的实际风险不是"改错",而是**并发改动把旧形态写回**:旧端内脚本一旦被整文件回退,
// 门 36 会去 import 一个不存在的路径(直接崩,尚可发现);更阴的是有人"照规矩"把实现再抄一份
// 进 `packages/design-tokens`(那会让 app.css 与 global.css 两侧各拿一份取源,正是本票要消灭的)。
// 两条都只有存在性判据拦得住,所以钉在这里。
test('T14 端内旧脚本已删且取源仍只有一份(搬家不得被回退成两份)', () => {
  /**
   * 判"仓库里有没有两份生成器",必须问 **git 的面**(索引 ∪ HEAD),不能问磁盘:
   * 共享工作树里别人未跟踪的临时件会让 `existsSync` 在**任何一次并发写文件**时把这条钉红,
   * 而那条红不代表仓里真的有两份真相(AGENTS:与改动无关的红只会逼人 `--no-verify`)。
   * 盘上有、面上没有 ⇒ 如实喊出来(它是"有人在重新造旧路径"的先行指标),但不判失败。
   */
  const inGit = (rel) => {
    try {
      execFileSync('git', ['-c', 'safe.directory=*', 'ls-files', '--error-unmatch', '--', rel], {
        cwd: REPO,
        stdio: 'ignore',
        windowsHide: true,
        timeout: 60000,
      })
      return true
    } catch {
      try {
        execFileSync('git', ['-c', 'safe.directory=*', 'cat-file', '-e', `HEAD:${rel}`], {
          cwd: REPO,
          stdio: 'ignore',
          windowsHide: true,
          timeout: 60000,
        })
        return true
      } catch {
        return false
      }
    }
  }
  for (const rel of [
    join('apps', 'miniapp-taro', 'scripts', 'sync-design-tokens.mjs'),
    join('packages', 'design-tokens', 'src', 'token-blocks.js'),
  ]) {
    assert.equal(
      inGit(rel),
      false,
      `${rel} 又回到仓库面(索引或 HEAD)⇒ 现在有两份生成器/两份取源,` +
        '必须先判哪一份是被提交链调用的那一份再删(§4「取源只能有一份实现」)',
    )
    if (existsSync(join(REPO, rel)))
      console.log(
        `  ℹ️ ${rel} 只躺在工作树(未跟踪)—— 不是仓里的第二份真相,` +
          '但它是"有人在重新抄一份旧路径"的先行指标,请该文件持有者自行收口',
      )
  }
  // 取源实现必须确实住在工具层,而不是被抄进端内 / 包内的第三处
  const impl = readFileSync(join(SCRIPTS_DIR, 'lib', 'design-token-blocks.mjs'), 'utf8')
  assert.match(impl, /export function collectVars/, '取源实现必须住在 scripts/lib/design-token-blocks.mjs')
  assert.equal(/from ['"]\.\.\/\.\.\/packages/.test(impl), false, '工具层那份不得退化成向下 re-export 的兼容层')
})

// ─── T7 谓词形状与 RN 同一种概念(--color- 前缀 ∧ 非跳过表) ───
test('T7 isManagedForMiniapp 的形状:色档进、非色档与跳过档不进', () => {
  assert.equal(gen.isManagedForMiniapp('--color-primary'), true)
  assert.equal(gen.isManagedForMiniapp('--color-cta'), true)
  for (const n of ['--color-sidebar', '--color-shell-panel', '--color-gradient-card-left'])
    assert.equal(gen.isManagedForMiniapp(n), false, `${n} 在跳过表里,不得受管`)
  for (const n of ['--font-sans', '--radius-lg', '--z-max'])
    assert.equal(gen.isManagedForMiniapp(n), false, `${n} 非色档,不属本门`)
})

// ─── T8 端到端:生成器写回面与门判定面在真仓上同形 ───
// 结论只断言 **app.css 这一面**,并把它与 style.ts 分开归因:
// 本票不许动端内文件,style.ts 若因别人的在途改动而红,不该算在本票头上,
// 但也**不许**因为"输出里没提 app.css"就默默当成通过 —— 那必须是 main() 真的跑完了。
test('T8 派生态(GENERATED)过一遍生成器 --check ⇒ 不得报 app.css 漂移(两侧同形 + 幂等)', () => {
  const dir = buildGeneratorScratch({ appCss: GENERATED })
  try {
    const r = runGeneratorCli(dir, ['--check'])
    assert.doesNotMatch(r.out, /app\.css 与 tokens\.css 不同步/, `生成器认为派态还要改写 ⇒ 首次落地不幂等:\n${r.out}`)
    assert.match(
      r.out,
      /同步,无漂移|style\.ts 与 tokens\.css 不同步/,
      `--check 没跑出任何一侧的结论(多半是 main() 提前崩了,那句"没提 app.css"是空的):\n${r.out}`
    )
  } finally {
    rmScratch(dir)
  }
})

test('T8b 反向对照:未落地的真仓 app.css 过 --check 必须**报** app.css 漂移(注册区确实该写)', () => {
  const landed = APP.includes(gen.THEME_REGION_MARK)
  const dir = buildGeneratorScratch({ appCss: APP })
  try {
    const r = runGeneratorCli(dir, ['--check'])
    if (landed) {
      // 另一端会话已经把区落进 app.css ⇒ 这一支只验证"现状自洽",不得反过来当"门没牙"
      assert.doesNotMatch(r.out, /app\.css 与 tokens\.css 不同步/, r.out)
    } else {
      assert.match(
        r.out,
        /app\.css 与 tokens\.css 不同步/,
        `注册区不在位而生成器却不认为该改写 ⇒ 它根本没把档注册上:\n${r.out}`
      )
    }
  } finally {
    rmScratch(dir)
  }
})

// ─── T9 CLI 层退出码(夹具仓,不碰真仓) ───
// 每个夹具都写**齐三对面**(:root / .dark / @theme),否则"缺档"这一维会同时被注册区污染,
// 断言里的 1 条就不知道是哪一面给的。
test('T9a 同步夹具 ⇒ exit 0 且报出受管档总数与逐位同值条数', () => {
  const dir = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n  --color-sidebar: #000;\n}\n',
    appCss: ':root {\n  --color-primary: #fff;\n}\n@theme {\n  --color-primary: #fff;\n}\n',
  })
  try {
    const r = runGateCli(dir)
    assert.equal(r.code, 0, r.out)
    // light 1 + dark 0 + 注册 1 = 2:两个数都得在(只有总数读不出"是不是空扫")
    assert.match(r.out, /2 个受管档/, r.out)
    assert.match(r.out, /逐位同值 2\/2/, r.out)
    assert.match(r.out, /无缺档/, r.out)
  } finally {
    rmScratch(dir)
  }
})

test('T9b 非受管档缺失 ⇒ 仍 exit 0(这一条就是 88 条误红的判据错)', () => {
  const dir = buildGateFixture({
    tokensCss:
      '@theme {\n  --color-primary: #fff;\n  --color-sidebar: #000;\n  --font-sans: Inter;\n}\n:root {\n  --color-gradient-x: linear-gradient(\n    112deg,\n    red 0%\n  );\n}\n',
    appCss: ':root {\n  --color-primary: #fff;\n}\n@theme {\n  --color-primary: #fff;\n}\n',
  })
  try {
    const r = runGateCli(dir)
    assert.equal(r.code, 0, `不该红的夹具红了:\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T9c 受管档缺失 ⇒ exit 1 且点名缺档', () => {
  const dir = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n',
    appCss: ':root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n@theme {\n  --color-primary: #fff;\n}\n',
  })
  try {
    const r = runGateCli(dir)
    assert.equal(r.code, 1, r.out)
    assert.match(r.out, /1 处缺档/, r.out)
    // 缺的是**注册面**上那一条(:root 面两条都在)⇒ 本条同时证明 CLI 会逐条点名 @theme
    assert.match(r.out, /@theme --color-bg/, r.out)
  } finally {
    rmScratch(dir)
  }
})

test('T9d 值漂移 ⇒ exit 1 且两侧值都印出来', () => {
  const dir = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCss: ':root {\n  --color-primary: #000;\n}\n@theme {\n  --color-primary: #fff;\n}\n',
  })
  try {
    const r = runGateCli(dir)
    assert.equal(r.code, 1, r.out)
    assert.match(r.out, /值漂移/, r.out)
    assert.match(r.out, /#000/, r.out)
    assert.match(r.out, /#fff/, r.out)
  } finally {
    rmScratch(dir)
  }
})

test('T9g 注册区混进 -rgb ⇒ exit 1 且以「脏档」点名(反向判据不能只在纯函数层有牙)', () => {
  const dir = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n:root {\n  --color-primary-rgb: 255, 255, 255;\n}\n',
    appCss:
      ':root {\n  --color-primary: #fff;\n  --color-primary-rgb: 255, 255, 255;\n}\n@theme {\n  --color-primary: #fff;\n  --color-primary-rgb: 255, 255, 255;\n}\n',
  })
  try {
    const r = runGateCli(dir)
    assert.equal(r.code, 1, `@theme 里躺着 alpha 三元组却判绿 ⇒ 脏档判据没接到 CLI:\n${r.out}`)
    assert.match(r.out, /脏档/, r.out)
    assert.match(r.out, /--color-primary-rgb/, r.out)
    assert.match(r.out, /0 处缺档/, r.out)
  } finally {
    rmScratch(dir)
  }
})

test('T9e 取不到输入 / 受管集为空 / 两个面旗同给 ⇒ exit 2「无法判定」,绝不记绿', () => {
  const SYNCED = {
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCss: ':root {\n  --color-primary: #fff;\n}\n@theme {\n  --color-primary: #fff;\n}\n',
  }
  const dirs = {
    // 副本整份不在(HEAD 里就没有这个路径)
    noCopy: buildGateFixture({ tokensCss: SYNCED.tokensCss, appCss: null }),
    // 受管集为空:不是"没有可判的档 ⇒ 通过",而是判据没吃到输入
    noManaged: buildGateFixture({
      tokensCss: '@theme {\n  --spacing-1: 4px;\n}\n',
      appCss: ':root {\n  --spacing-1: 4px;\n}\n',
    }),
    // 非 git 目录 + 盘上内容**完全正确** ⇒ 默认档也不得回落磁盘冒绿(这正是收口前的行为)
    noGit: buildGateFixture({ ...SYNCED, git: false }),
    // 有仓无提交 ⇒ HEAD 面取不到
    noHead: buildGateFixture({ ...SYNCED, commit: false }),
  }
  try {
    const cases = [
      ['副本缺失(默认档)', runGateCli(dirs.noCopy, [])],
      ['受管集为空', runGateCli(dirs.noManaged, [])],
      ['--staged 但无 git', runGateCli(dirs.noGit, ['--staged'])],
      ['默认档但无 git(盘上是好的)', runGateCli(dirs.noGit, [])],
      ['默认档但有仓无提交', runGateCli(dirs.noHead, [])],
      ['--worktree 但盘上没副本', runGateCli(dirs.noCopy, ['--worktree'])],
      ['两个面旗同给', runGateCli(dirs.noManaged, ['--staged', '--worktree'])],
    ]
    for (const [name, r] of cases) {
      assert.equal(r.code, 2, `${name} ⇒ 期望 exit 2,实得 ${r.code}:${r.out}`)
      assert.match(r.out, /无法判定/, `${name} 必须喊"无法判定"而不是静默绿:${r.out}`)
    }
    // 反向对照:同一份内容建成有提交的仓就必须 exit 0 —— 否则上面七条红是"夹具跑不通",不是判据有牙
    const ok = buildGateFixture(SYNCED)
    try {
      const clean = runGateCli(ok, [])
      assert.equal(clean.code, 0, clean.out)
      assert.match(clean.out, /取材面:HEAD blob/, clean.out)
    } finally {
      rmScratch(ok)
    }
  } finally {
    for (const d of Object.values(dirs)) rmScratch(d)
  }
})

test('T9f --quiet 同步时不出声,不一致时仍喊', () => {
  const quiet = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCss: ':root {\n  --color-primary: #fff;\n}\n@theme {\n  --color-primary: #fff;\n}\n',
  })
  const loud = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCss: ':root {\n  --color-primary: #000;\n}\n@theme {\n  --color-primary: #fff;\n}\n',
  })
  try {
    const a = spawnSync(
      process.execPath,
      [join(quiet, 'scripts', 'check-miniapp-tokens-sync.mjs'), '--quiet'],
      { cwd: quiet, encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    assert.equal(a.status, 0, `${a.stdout}${a.stderr}`)
    assert.equal(a.stdout, '', `--quiet 不该出通过消息:${a.stdout}`)
    const b = runGateCli(loud, ['--quiet'])
    assert.equal(b.code, 1, b.out)
    assert.match(b.out, /值漂移/, b.out)
  } finally {
    rmScratch(quiet)
    rmScratch(loud)
  }
})

// ─── T10 真仓 CLI 三面:默认(HEAD)/ --worktree / --staged ───
// 注册区**是否已落地**取决于另一会话有没有跑过生成器(本票禁止动端内文件),所以这里
// 不假设红或绿,只钉两条硬事实:① 结论行必须落在末行且写明取材面;② 若红,红只允许来自
// @theme 这一面 —— :root/.dark 两维一旦出现漂移,那是真债,不该被本票的用例吞掉。
test('T10 真仓 CLI:三面各 exit 0/1(不得 2),末行写明取材面,红只来自注册面', () => {
  const EXPECT = {
    '': /取材面:HEAD blob/,
    '--worktree': /取材面:工作树/,
    '--staged': /取材面:索引 blob/,
  }
  for (const flag of [[], ['--worktree'], ['--staged']]) {
    const r = spawnSync(
      process.execPath,
      [join(SCRIPTS_DIR, 'check-miniapp-tokens-sync.mjs'), ...flag],
      { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.ok(
      r.status === 0 || r.status === 1,
      `${flag.join(' ') || '(默认)'} ⇒ exit ${r.status}(2 = 无法判定,真仓三面都不该判不了):\n${out}`
    )
    // 判的是**末行**而不是整段输出:结论行没有面,下一个人就无从知道这句话关于哪个面
    const last = out.trim().split(/\r?\n/).pop()
    assert.match(last, EXPECT[flag.join(' ')], `末行未明写取材面:${last}`)
    if (r.status === 1) {
      for (const line of out.split(/\r?\n/).filter((l) => /^ {2}\S+ --\S+?:/.test(l)))
        assert.match(line, /^ {2}@theme /, `红出现在非注册面,那不是本票该管的:\n${line}`)
    }
  }
})

// ─── T15 判定面收口的正向证明:索引 ≠ 磁盘时,--staged 必须读索引 ───
// 为什么必须在临时 git 仓里造:真仓三面在稳态下同结论(副本由生成器一路同步),
// 拿它取证等于什么都没测 —— 只有构造出"某一面单独漂了"才能区分三个面。
test('T15 索引内容与磁盘内容不同时 ⇒ --staged 判索引(盘上随后改对不算修好)', () => {
  // head 与 worktree 都是同步的,只有**索引**里躺着一次漂移(别人 git add 了又在工作树里改回去)
  // 三份都带齐 @theme 注册区 ⇒ 本例的红只可能来自 :root 的那次漂移(注册面不参与)
  const THEME = '@theme {\n  --color-primary: #fff;\n}\n'
  const dir = buildFaceFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCssHead: `:root {\n  --color-primary: #fff;\n}\n${THEME}`,
    appCssIndex: `:root {\n  --color-primary: #000;\n}\n${THEME}`,
    appCssWorktree: `:root {\n  --color-primary: #fff;\n}\n${THEME}`,
  })
  try {
    assert.equal(
      readFileSync(join(dir, APP_REL), 'utf8'),
      `:root {\n  --color-primary: #fff;\n}\n${THEME}`,
      '夹具失效:工作树没回到同步态,那"读索引≠读磁盘"就没被区分开'
    )
    const staged = runGateCli(dir, ['--staged'])
    assert.equal(staged.code, 1, `索引里是漂移,--staged 却判绿 ⇒ 它读的不是索引:\n${staged.out}`)
    assert.match(staged.out, /值漂移/, staged.out)
    assert.match(staged.out, /取材面:索引 blob/, staged.out)
    // 同一夹具的三个面各自给出自己的结论 —— 只有一面红,才是"按面取材"而不是"按最宽的一面取材"
    const head = runGateCli(dir, [])
    assert.equal(head.code, 0, `HEAD 是同步的,默认档必须绿:\n${head.out}`)
    const wt = runGateCli(dir, ['--worktree'])
    assert.equal(wt.code, 0, `工作树是同步的,逃生舱必须绿:\n${wt.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T16 反向对照:同一类夹具下**默认档必须读 HEAD,而不是索引** ───
// 少了这一条,T15 只证明了"staged 面变了",没证明"默认面不是索引" —— 两半都钉住才叫换锚。
test('T16 HEAD 里是漂移而索引/磁盘已修好 ⇒ 默认档仍判红(不得被索引或盘上的后手洗绿)', () => {
  const THEME = '@theme {\n  --color-primary: #fff;\n}\n'
  const dir = buildFaceFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCssHead: `:root {\n  --color-primary: #000;\n}\n${THEME}`,
    appCssIndex: `:root {\n  --color-primary: #fff;\n}\n${THEME}`,
    appCssWorktree: `:root {\n  --color-primary: #fff;\n}\n${THEME}`,
  })
  try {
    const head = runGateCli(dir, [])
    assert.equal(head.code, 1, `HEAD 里就是漂移,默认档却绿 ⇒ 它读的不是 HEAD:\n${head.out}`)
    assert.match(head.out, /值漂移/, head.out)
    assert.match(head.out, /取材面:HEAD blob/, head.out)
    const staged = runGateCli(dir, ['--staged'])
    assert.equal(staged.code, 0, `索引已修好,--staged 该绿(否则提交链会拦一次已经改对的提交):\n${staged.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T17 换锚的反向锁:磁盘读不得再回到门本体,取材必须经 face-reader ───
// 行为由 T15/T16/T9e 证明;这一条钉的是**形状**,防的是并行会话把旧写法整文件回退回来
// (本仓实测:判据被旧基线写回时,行为用例往往仍绿 —— 因为夹具恰好也读磁盘)。
test('T17 门本体不得再出现磁盘取材,且必须经统一取材层选面', () => {
  const src = readFileSync(join(SCRIPTS_DIR, 'check-miniapp-tokens-sync.mjs'), 'utf8')
  assert.equal(/readFileSync\s*\(/.test(src), false, '门本体又出现了 readFileSync ⇒ 默认按磁盘判')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '选面与取材必须走 scripts/lib/face-reader.mjs')
  assert.match(src, /def:\s*'head'/, "默认面必须显式写 'head'(旧值是磁盘,漏写就是回到旧口径)")
  assert.match(src, /--worktree/, '逃生舱档必须在(它同时是 T9e/T15 的取证入口)')
  // 出口必须真的在(镜像测试 import 它们;悄悄删掉会让上面所有断言变成空调用)
  assert.equal(typeof gate.compare, 'function')
  assert.equal(typeof gate.faceFromArgv, 'function')
  assert.equal(typeof gate.readFaceInputs, 'function')
  // 纯函数四态:构造面即可证明,不派生 git、不碰真仓
  assert.equal(gate.faceFromArgv([]).face, 'head')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  assert.ok(gate.faceFromArgv(['--staged', '--worktree']).error, '两个面旗同给必须返回 error')
})

// ─── T18 取材出口本身有牙:readFaceInputs 按 face 取,取不到抛错而不是返回 null ───
// 为什么单独一条:T15/T16 走 CLI,红了看不出是判据还是取材;这一条直接喂纯出口,三面各给各的值。
test('T18 readFaceInputs:三面各取各自内容;取不到 ⇒ 抛错而不是返回 null', () => {
  const dir = buildFaceFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCssHead: ':root {\n  --color-primary: #111;\n}\n',
    appCssIndex: ':root {\n  --color-primary: #222;\n}\n',
    appCssWorktree: ':root {\n  --color-primary: #333;\n}\n',
  })
  try {
    assert.match(gate.readFaceInputs(dir, 'head')[APP_REL], /#111/)
    assert.match(gate.readFaceInputs(dir, 'staged')[APP_REL], /#222/)
    assert.match(gate.readFaceInputs(dir, 'worktree')[APP_REL], /#333/)
    // 键集合稳定:main() 按这两个常量取值,换了键就是"取不到 ⇒ exit 2"的隐形来源
    assert.deepEqual(
      Object.keys(gate.readFaceInputs(dir, 'head')).sort(),
      [gen.APP_CSS_REL, gen.TOKENS_SOURCE_REL].sort()
    )
  } finally {
    rmScratch(dir)
  }
  // 取不到必须**抛 `Undetermined`**(调用方折成 exit 2);返回 null 会被下游读成"这份输入是空的"。
  // 断异常类型而不是文案子串:文案会改,类型是门与取材层之间唯一的契约。
  const noGit = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCss: ':root {\n  --color-primary: #fff;\n}\n',
    git: false,
  })
  try {
    assert.throws(() => gate.readFaceInputs(noGit, 'head'), Undetermined)
    assert.throws(() => gate.readFaceInputs(noGit, 'staged'), Undetermined)
    // 反向对照:同一份夹具的 worktree 面**必须能读到** —— 否则上面两条红是"夹具坏了",
    // 而不是"git 面取不到"。逃生舱不依赖 git,这正是它作为人工排查出口的意义。
    assert.match(gate.readFaceInputs(noGit, 'worktree')[APP_REL], /#fff/)
  } finally {
    rmScratch(noGit)
  }
  // 盘上/HEAD 里根本没有副本 ⇒ 三面一律抛(不得返回 null 让下游算成"空文件、无档可判")
  const noCopy = buildGateFixture({
    tokensCss: '@theme {\n  --color-primary: #fff;\n}\n',
    appCss: null,
  })
  try {
    assert.throws(() => gate.readFaceInputs(noCopy, 'head'), Undetermined)
    assert.throws(() => gate.readFaceInputs(noCopy, 'staged'), Undetermined)
    assert.throws(() => gate.readFaceInputs(noCopy, 'worktree'), Undetermined)
  } finally {
    rmScratch(noCopy)
  }
})

// ─── T11 §22d:被 import 时不得有写盘副作用(门一 import 就"顺手同步"过一次副本 = 事故) ───
test('T11 import 生成器不触发 main():漂移夹具必须原样留着、且能打印导入标记', () => {
  const dir = buildGeneratorScratch({ appCss: tamperFirstManaged(APP, 'drift').next })
  try {
    const before = readFileSync(join(dir, gen.APP_CSS_REL), 'utf8')
    const genUrl = new URL(
      `file:///${join(dir, GEN_REL).replace(/\\/g, '/')}`
    ).href
    const r = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(genUrl)}); process.stdout.write('IMPORTED-NO-SIDE-EFFECT')`],
      { encoding: 'utf8', cwd: dir, windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /IMPORTED-NO-SIDE-EFFECT/, r.stdout)
    assert.equal(readFileSync(join(dir, gen.APP_CSS_REL), 'utf8'), before, 'import 生成了写盘副作用(缺 isDirectRun 守卫)')
  } finally {
    rmScratch(dir)
  }
})

// ─── T12 两道同族门的取向必须一致(小程序与 RN 共用同一张"派生态"规则) ───
test('T12 生成器与 RN 生成器各自导出同形状的谓词出口(不各发明一套概念)', () => {
  const rnSrc = readFileSync(join(SCRIPTS_DIR, 'sync-rn-global-css.mjs'), 'utf8')
  assert.match(rnSrc, /export const RN_SKIP_PREFIXES/, 'RN 侧那张表是本门的形状依据')
  assert.match(rnSrc, /export function isManagedForRn/)
  assert.equal(typeof gen.isManagedForMiniapp, 'function')
  assert.ok(Array.isArray(gen.MINIAPP_SKIP_PREFIXES) && gen.MINIAPP_SKIP_PREFIXES.length > 0)
  // 表里每条都必须是"匹配不上任何受管档"的前缀(写成无效前缀=悄悄放宽判据)
  for (const p of gen.MINIAPP_SKIP_PREFIXES)
    assert.equal(gen.isManagedForMiniapp(`${p}probe`), false, `跳过条目 ${p} 不生效`)
})

// ─── T13 错位锁:本路径曾装着守门脚本本体(而不是测试) ───
// 实测现场:2026-09-25 HEAD 上这里是 382 行的镜像测试,磁盘上是 221 行的门本体(带 `main()` 与
// `export const __test__`)—— 那个形态下 `node --test` 会把门本体当测试跑(它自己 process.exit),
// 报告上看着"通过",而测试判据一条都没执行。判据在错的缝里等于没有(AGENTS §22c 同源)。
test('T13 本文件必须是测试本体,不是守门脚本的整文件副本', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const gateSrc = readFileSync(join(SCRIPTS_DIR, 'check-miniapp-tokens-sync.mjs'), 'utf8')
  assert.match(self, /^import \{ test \} from 'node:test'$/m, '缺 node:test 导入 ⇒ 这里不是测试')
  assert.equal(
    self.startsWith('#!/usr/bin/env node'),
    false,
    '以 shebang 开头 ⇒ 本路径被写成了 CLI 守门脚本;门应只住在 scripts/check-miniapp-tokens-sync.mjs'
  )
  assert.notEqual(self, gateSrc, '本文件与守门脚本逐字相同 ⇒ 门被误写进测试路径(整文件错位)')
})

// ─── T19 新判据的"正例":真仓派生态建成临时 git 仓跑 CLI ⇒ 必须 exit 0 ───
// 为什么不能只靠 T2a 的纯函数断言:纯函数绿而 CLI 红 = 判据与取材/结论行脱节(本仓多次
// 记过"门自己那把尺子在故障现场报绿")。这一条是**真数据 + 真 CLI + HEAD 面**的装车证明,
// 它同时是本门"不会恒红逼人 --no-verify"的证据 —— 缺了它,注册面就是一台未被证伪的恒红门。
test('T19 真仓派生态走 CLI(HEAD 面)⇒ exit 0,并报到齐三对面的档数', () => {
  const dir = buildGateFixture({ tokensCss: TOKENS, appCss: GENERATED })
  try {
    const r = runGateCli(dir, [])
    assert.equal(r.code, 0, `派生态被判红 ⇒ 本门会在每个人每次提交上逼出 --no-verify:\n${r.out.slice(0, 900)}`)
    const managed =
      gen.deriveMiniappManaged(TOKENS, 'light').length +
      gen.deriveMiniappManaged(TOKENS, 'dark').length +
      gen.deriveThemeRegistryDecls(TOKENS).length
    assert.match(r.out, new RegExp(`${managed} 个受管档`), r.out)
    assert.match(r.out, new RegExp(`逐位同值 ${managed}/${managed}`), r.out)
  } finally {
    rmScratch(dir)
  }
})

// ─── T20 新判据的"反例":注册区故意落后一档 ⇒ CLI 必须 exit 1 且点名 ───
// 与 T19 成对:只证派生态绿,门可以是"永远看不见 @theme"的空门。
test('T20 派生态再删掉一条注册档 ⇒ CLI exit 1、缺档计数为 1 且点名 @theme', () => {
  const { next, name } = tamperThemeRegion(GENERATED, 'drop')
  const dir = buildGateFixture({ tokensCss: TOKENS, appCss: next })
  try {
    const r = runGateCli(dir, [])
    assert.equal(r.code, 1, `删掉注册档却判绿 ⇒ @theme 面对 CLI 全盲:\n${r.out}`)
    assert.match(r.out, /1 处缺档/, r.out)
    assert.match(r.out, new RegExp(`@theme ${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`), r.out)
    // 结论行必须在末行:红的时候读不到"关于哪个面",报告就退回旧形态
    assert.match(r.out.trim().split(/\r?\n/).pop(), /取材面:HEAD blob/, r.out)
  } finally {
    rmScratch(dir)
  }
})

// ─── T21 形状锁:新判据必须真的挂在写回链与判定链上(函数在而没人调 = 提交链一路绿灯) ───
// 守门 70/76/81/102 同型教训:判据函数存在、自检也过,但主流程没调它,于是全链恒绿。
test('T21 注册区的写回侧与判定侧各自的装车点必须在位', () => {
  const genSrc = readFileSync(join(REPO, GEN_REL), 'utf8')
  const gateSrc = readFileSync(join(SCRIPTS_DIR, 'check-miniapp-tokens-sync.mjs'), 'utf8')

  // 写回侧:mergeAppCss 必须真的调 ensureThemeRegion(否则首块永远插不进去)
  const bodyOfMerge = genSrc.slice(
    genSrc.indexOf('export function mergeAppCss('),
    genSrc.indexOf('/**', genSrc.indexOf('export function mergeAppCss('))
  )
  assert.match(bodyOfMerge, /ensureThemeRegion\(/, 'mergeAppCss 没调 ensureThemeRegion ⇒ @theme 区永不落地')
  assert.match(bodyOfMerge, /planAppCssRegions\(withTheme/, '区间必须在插入之后重算(沿用旧下标就是越界改写)')
  // 判定侧(区):planAppCssRegions 必须按**标记**定位注册区,而不是"第几个块数"
  assert.match(genSrc, /markerRange\(css, THEME_REGION_MARK/, '注册区必须走标记定位(与另外 5 区同一套路)')
  assert.match(genSrc, /topLevelRanges\(css, '@theme'\)/, '注册区块体必须走注释感知的 topLevelRanges(否则散文里的 @theme 会被当块)')
  // 判定侧(门):必须 import 生成器的两个出口,不得自己再筛一遍。
  // "不得再筛一遍"只能在**代码面**上判(剥注释 + 剥字符串):门里的散文与报错文案
  // 本来就要写出 `-rgb` 这个词,按全文判会把"解释这条禁令本身"当成违规。
  const codeOnly = (src) =>
    maskComments(src)
      .replace(/\/\/[^\n]*/g, '')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '``')
  const gateCode = codeOnly(gateSrc)
  assert.match(gateSrc, /deriveThemeRegistryDecls/, '门必须走 deriveThemeRegistryDecls,不得自己挑选择器/剔 -rgb')
  assert.match(gateSrc, /isAlphaRgbTriple/, '门的 -rgb 判据必须复用生成器那一份谓词')
  assert.match(gateCode, /isAlphaRgbTriple\(/, '门必须真的**调用**该谓词(import 了不调 = 没有)')
  assert.equal(gateCode.includes('-rgb'), false, "门里不得出现第二份 '-rgb' 字面量/正则(第二份真相)")
  // 标记只有一份,且派生态里恰好一块
  assert.equal(genSrc.includes("export const THEME_REGION_MARK = '/* ===== v4 色档注册(自动同步自'"), true)
  assert.equal(gen.topLevelRanges(GENERATED, '@theme').length, 1, '派生态里注册块必须恰好一个')
  // buildAppCssMaps 的 theme 集 == deriveMiniappManaged(light) 剔 -rgb(两侧同表的直接对账)
  const maps = gen.buildAppCssMaps(TOKENS)
  const expect = gen.deriveMiniappManaged(TOKENS, 'light').filter((d) => !gen.isAlphaRgbTriple(d.name))
  assert.deepEqual([...maps.theme.keys()], expect.map((d) => d.name))
  assert.deepEqual([...maps.theme.values()], expect.map((d) => d.value))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
