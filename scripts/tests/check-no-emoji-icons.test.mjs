// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-no-emoji-icons.mjs` 的镜像测试(§22c/§22d)。
 *
 * 判据**一律从源脚本 import**(`__test__`),不在本文件里复写一份 —— 复算的第二把尺子必然漂开。
 * 本文件守四件事:
 *   ① 违规族(icon 字段 / 渲染位 / 裸 emoji 行)与豁免族(注释 / i18n / 评分星 / 面板数据行 …)
 *      同时有牙:每条豁免都配一条"同一位置的另一种写法仍判违规"的反向对照;
 *   ② 判定面纪律(AGENTS §0.4):`analyze()` 在 head / staged / worktree 三档上各判各的 ——
 *      改盘不算改 HEAD、未提交的新文件不进 HEAD 面;
 *   ③ 枚举到 0 ⇒ `Undetermined`(不把"没扫到"读成"没违规");
 *   ④ §22d 形状锁:import 本模块零输出零退出,CLI 直跑才执行 main;
 *   ⑤ 加固维度(G-880 判据③,asset .svg/.css/.json):判据有牙 + 分流互不污染 +
 *      棘轮(HEAD 面只报数,staged 档拦本次新增)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary, Undetermined } from '../lib/face-reader.mjs'
// §22c:判据从源脚本 import,不在测试里复算
import { __test__ as gate } from '../check-no-emoji-icons.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-no-emoji-icons.mjs')
const GIT = gitBinary()

const PANEL = 'apps/miniapp-taro/src/components/InputArea.tsx'
const OTHER = 'apps/web/src/components/demo.tsx'
/** 真实违规样本(取自本门立项时的现场形态) */
const ICON_FIELD = "  icon: '🦄',"
const RENDER_JSX = '<Text className="x">😊</Text>'
const RENDER_TERNARY = "{liked ? '♥' : '♡'}"
const BARE_EMOJI = '              😊'

/** 派生 git 一律显式 stdio + windowsHide(§12g 派生进程纪律) */
function git(cwd, args) {
  return spawnSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function writeRepoFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

/** 建一个带一次提交的临时仓(HEAD 面才有东西可判) */
function createRepo(files) {
  const dir = mkScratch('ihui-emoji-git-')
  const r = git(dir, ['init', '-q'])
  assert.equal(r.status, 0, `git init 失败: ${r.stderr}`)
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  for (const [rel, content] of Object.entries(files)) writeRepoFile(dir, rel, content)
  git(dir, ['add', '-A'])
  const c = git(dir, ['commit', '-q', '-m', 'baseline'])
  assert.equal(c.status, 0, `baseline commit 失败: ${c.stdout}${c.stderr}`)
  return dir
}

// ─── ① 违规族 ───

test('E01 违规族:icon 字段 / JSX 渲染位 / 三元图标 / 裸 emoji 行 四型都判得出来', () => {
  assert.equal(gate.judgeLine(ICON_FIELD, 1, OTHER)?.label, 'icon field emoji')
  assert.equal(gate.judgeLine(RENDER_JSX, 1, OTHER)?.label, 'render emoji icon')
  assert.equal(gate.judgeLine(RENDER_TERNARY, 1, OTHER)?.label, 'render emoji icon')
  assert.equal(gate.judgeLine(BARE_EMOJI, 861, OTHER)?.label, 'bare emoji JSX child')
  // 面板文件里的按钮位/icon 字段照判(旧版整文件豁免吃掉的就是这两型)
  assert.equal(gate.judgeLine(RENDER_JSX, 1, PANEL)?.label, 'render emoji icon')
  assert.equal(gate.judgeLine(ICON_FIELD, 1, PANEL)?.label, 'icon field emoji')
  assert.equal(gate.judgeLine(BARE_EMOJI, 861, PANEL)?.label, 'bare emoji JSX child')
  // 表达式行(`{…}` 起手)过去被"注释豁免"整族吃掉 —— 这条是那 26 处隐身的现场形态
  assert.equal(
    gate.judgeLine('{selected && <Text className="text-xs text-primary">✓</Text>}', 353, OTHER)?.label,
    'render emoji icon',
  )
})

// ─── ② 豁免族(逐条配反向对照) ───

test('E02 豁免族:注释 / i18n / 评分星 / 表格标记 / 键帽 / docs 正文 全部仍豁免', () => {
  assert.equal(gate.isExempt('// 这里曾有 😊', OTHER), true)
  assert.equal(gate.isExempt("tt('live.start', '📺 我要开播')", OTHER), true)
  assert.equal(gate.isExempt("  return '★'.repeat(n)", OTHER), true)
  assert.equal(gate.isExempt("<td>{c.nullable ? '✓' : '—'}</td>", OTHER), true)
  assert.equal(gate.isExempt('⌫', OTHER), true)
  assert.equal(gate.isExempt("  icon: '📄',", 'apps/web/app/(main)/docs/page.tsx'), true)
  // 反向对照:同一批字符出现在渲染位 ⇒ 必须判违规(证明豁免没有外溢成"含这些字符就放行")。
  // 样本取门体豁免 6 注释点名的"仍判违规"形态(`<Text>★ {rating}</Text>`);
  // 带 `.repeat(` 的整行按现行判据属行级豁免面(本票禁改判据,反向样本不得依赖它)。
  assert.equal(gate.judgeLine('<Text>★ {rating}</Text>', 1, OTHER)?.label, 'render emoji icon')
  assert.equal(gate.judgeLine('const x = a ? 1 : 2', 1, OTHER), null)
})

test('E03 面板数据行收窄:数组元素/整行字面量豁免,同一形态在非面板文件不豁免', () => {
  assert.equal(gate.isExempt("      '😀',", PANEL), true)
  assert.equal(gate.isExempt("const EMOJI_LIST = ['😀','😁','😊']", PANEL), true)
  // 数据形状豁免不许外溢(否则"任何 emoji 数组都算数据"就是新盲区)
  assert.equal(gate.isExempt("      '😀',", OTHER), false)
  // 带引号的裸数据形态不能被违规 3 命中
  assert.notEqual(gate.judgeLine("  '😊',", 1, OTHER)?.label, 'bare emoji JSX child')
})

// ─── ③ 单源与派生字符类 ───

test('E04 字符类单源:派生字符类与 EMOJI_RE 逐码位同结论,且未处于"判据失明"态', () => {
  assert.equal(gate.CHAR_CLASS_BROKEN, false, '跳过了字符类提取 —— 面板判据会静默失明')
  const derived = new RegExp(`[${gate.EMOJI_CHAR_CLASS}]`, 'u')
  const probes = ['😀', '😊', '★', '✓', '⭐', '⌫', 'A', '©', '®', '中', ' ', '‍']
  for (const c of probes) {
    assert.equal(derived.test(c), gate.EMOJI_RE.test(c), `码位 ${JSON.stringify(c)} 两尺结论不一致`)
  }
})

// ─── ④ --staged 语义:只判本次新增行 ───

test('E05 judgeText:allowedLines 为 null 判全篇,给了集合就只判集合内的行', () => {
  const text = [ICON_FIELD, 'const ok = 1', ICON_FIELD].join('\n')
  assert.equal(gate.judgeText(OTHER, text).length, 2, '全篇档应命中两处')
  const only1 = gate.judgeText(OTHER, text, new Set([1]))
  assert.deepEqual(only1.map((f) => f.line), [1], 'allowedLines 未生效 ⇒ 提交档会把存量算成本次新增')
  assert.equal(gate.judgeText(OTHER, text, new Set([2])).length, 0)
})

// ─── ⑤ 候选剪枝 ───

test('E06 isScanCandidate:只收 UI 端 .ts/.tsx/.js/.jsx,构建产物/依赖/测试副本身份一律不收', () => {
  assert.equal(gate.isScanCandidate('apps/web/src/a.tsx'), true)
  assert.equal(gate.isScanCandidate('packages/ui-react/src/a.js'), true)
  assert.equal(gate.isScanCandidate('apps/web/src/a.md'), false)
  assert.equal(gate.isScanCandidate('apps/api/src/a.ts'), false, '后端不在射程(UI 端才判图标)')
  // .next* 族:minified chunk 里的 emoji 曾被误判(2026-09-15 事故),剪枝必须留着
  assert.equal(gate.isScanCandidate('apps/web/.next/server/chunk.js'), false)
  assert.equal(gate.isScanCandidate('apps/web/.next-staging/chunk.js'), false)
  assert.equal(gate.isScanCandidate('apps/web/node_modules/x/a.js'), false)
})

// ─── ⑥ 判定面纪律(§0.4) ───

test('E07 analyze:三档各判各面 —— 改盘不算改 HEAD,新文件只进索引档', () => {
  const BAD = "export const NAV = [{ label: 'x', icon: '🦄' }]\n"
  const dir = createRepo({ 'apps/web/src/nav.tsx': BAD })
  try {
    const head1 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head1.scanned, 1, JSON.stringify(head1))
    assert.equal(head1.totalViolations, 1, 'HEAD 面漏判基线违规')

    // 只改盘(不 add、不 commit):HEAD 面读数必须不动,worktree 面必须看到修好后的那一份
    writeRepoFile(dir, 'apps/web/src/nav.tsx', 'export const NAV = []\n')
    const head2 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head2.totalViolations, 1, '盘上改对把 HEAD 面读数改动了 ⇒ 两面混取')
    const wt = gate.analyze({ root: dir, face: 'worktree' })
    assert.equal(wt.totalViolations, 0, 'worktree 档没读到盘上那一份')

    // 新增一个只在索引里的违规文件:staged 档必须看得见,HEAD 档必须看不见
    writeRepoFile(dir, 'apps/web/src/new.tsx', BAD)
    assert.equal(git(dir, ['add', 'apps/web/src/new.tsx']).status, 0)
    const staged = gate.analyze({ root: dir, face: 'staged' })
    assert.equal(staged.scanned, 1, `staged 档只该判本次新增行(${JSON.stringify(staged)})`)
    assert.equal(staged.totalViolations, 1, 'staged 档漏判新增文件')
    const head3 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head3.scanned, 1, 'HEAD 档把未提交的新文件收进来了')
    assert.equal(head3.totalViolations, 1)
  } finally {
    rmScratch(dir)
  }
})

test('E08 analyze:被审面枚举到 0 个候选 ⇒ Undetermined(不记绿)', () => {
  const dir = createRepo({ 'README.md': '# 空仓\n' })
  try {
    assert.throws(() => gate.analyze({ root: dir, face: 'head' }), Undetermined)
    assert.throws(() => gate.analyze({ root: dir, face: 'head' }), /枚举到 0/)
  } finally {
    rmScratch(dir)
  }
})

// ─── ⑦ §22d 形状锁 ───

test('E09 形状锁:import 本模块零输出零退出(§22d),且守卫/导出/取材面都在位', async () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(src, /if \(isDirectRun\) \{/)
  assert.match(src, /export async function main\(/)
  assert.match(src, /export const __test__ = \{/)
  // 顶层零 exit:process.exit 只许出现在缩进的守卫兜底里
  assert.equal(/^process\.exit\(/m.test(src), false, '模块顶层出现裸 process.exit ⇒ 测试 import 会打死宿主')
  // 取材必须走共用层(自己 walk 磁盘 / 自己拼 git 的那一套已经删掉)
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /from '\.\/lib\/face-scan\.mjs'/)
  assert.equal(/\breadFileSync\(/.test(src), false, '门内又出现 readFileSync ⇒ 取材面退回磁盘')
  assert.equal(/\bgetStagedAddedLines\b|\bcollectFiles\b/.test(src), false, '旧的磁盘 walk / 自拼 diff 又回来了')

  const fileUrl = pathToFileURL(SCRIPT_PATH).href
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(fileUrl)})`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 0, `import 未零退出: ${r.stderr}`)
  assert.equal(r.stdout, '', `import 产生了 stdout(顶层有副作用): ${r.stdout}`)
  assert.equal(r.stderr, '', `import 产生了 stderr: ${r.stderr}`)
})

test('E10 CLI 直跑:守卫放行后 main 真的执行了(输出扫描读数)', () => {
  const r = spawnSync(process.execPath, [SCRIPT_PATH], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  // 允许 0/1(仓库现状由内容决定);这里只证明"直跑确实进了主流程"
  assert.ok([0, 1].includes(r.status), `意外退出码 ${r.status}: ${r.stderr}`)
  assert.match(r.stdout, /扫描文件: \d+ 个/)
  assert.match(r.stdout, /违规数:\s+\d+ 处 \(BLOCKING\)/)
})

// ─── ⑧ 加固维度(G-880 判据③,asset:.svg/.css/.json)───

test('E11 asset 候选:UI 根下 .css/.svg/.json 收,后端/图片扩展名不收', () => {
  assert.equal(gate.isScanCandidate('apps/web/src/a.css'), true)
  assert.equal(gate.isScanCandidate('packages/ui-react/icon.svg'), true)
  assert.equal(gate.isScanCandidate('apps/web/src/cfg.json'), true)
  assert.equal(gate.isScanCandidate('apps/api/src/a.css'), false, '后端不在射程')
  assert.equal(gate.isScanCandidate('apps/web/src/a.png'), false, '位图没有"行"可判')
})

test('E12 asset 判据有牙:三型各自命中,同位反向对照不命中', () => {
  assert.equal(gate.judgeAssetLine('a.css', '  content: "🦄";', 3)?.label, 'css content emoji icon')
  assert.equal(gate.judgeAssetLine('a.css', ' * ⚠️ 说明 😊', 77), null, 'css 注释续行(实测 6 处存量全在这一族)必须豁免')
  assert.equal(gate.judgeAssetLine('a.json', '  "icon": "🦄",', 12)?.label, 'json icon field emoji')
  assert.equal(gate.judgeAssetLine('a.json', '  "label": "🎉 活动",', 13), null, 'json 文案字段不是图标位')
  assert.equal(gate.judgeAssetLine('a.svg', '<text>😊</text>', 4)?.label, 'svg emoji glyph')
  assert.equal(gate.judgeAssetLine('a.svg', '<!-- 😊 占位说明 -->', 2), null, 'svg 注释行豁免')
})

test('E13 分流互不污染(有牙锁:摘掉任一维,命中集立刻变化)', () => {
  // 代码形态 `icon: '🦄'` 出现在 css 文件 ⇒ asset 维不吃(若分流被摘,这里立刻多命中)
  assert.deepEqual(gate.judgeText('apps/web/src/a.css', "icon: '🦄'"), [])
  // css 形态 `content: "🦄"` 出现在 tsx 文件 ⇒ 代码维不吃(反向同证)
  assert.deepEqual(gate.judgeText(OTHER, '  content: "🦄";'), [])
  // asset 命中经 judgeText 收得到 ⇒ 证明 asset 维接进了主循环,不是只住在导出口
  assert.equal(gate.judgeText('apps/web/src/a.css', 'a{content:"🦄"}').length, 1)
  // 代码命中经 judgeText 照旧收得到 ⇒ 加固没有把旧维挤掉
  assert.equal(gate.judgeText(OTHER, "  icon: '🦄',").length, 1)
})

test('E14 analyze 棘轮+面纪律:asset 命中 HEAD 面只报数,盘上偷改不动 HEAD 读数,staged 档新增行进阻断集', () => {
  const CSS1 = 'button::before{content:"🦄"}\n'
  const dir = createRepo({ 'apps/web/src/a.css': CSS1, 'apps/web/src/ok.tsx': 'export const X = 1\n' })
  try {
    const head = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head.totalViolations, 0, 'asset 加固维在全量面不得进阻断集(§0.5 棘轮:有存量的新判据不升 blocking)')
    assert.equal(head.assetStock, 1, 'asset 存量没报数 = 静默少扫')

    // 工作树偷改(不 add):追加一行 asset emoji ⇒ HEAD 面读数必须纹丝不动(证明没读盘)
    writeRepoFile(dir, 'apps/web/src/a.css', CSS1 + 'span::after{content:"😊"}\n')
    const head2 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head2.assetStock, 1, '盘上偷改动到了 HEAD 面 ⇒ 混面取材')
    const wt = gate.analyze({ root: dir, face: 'worktree' })
    assert.equal(wt.assetStock, 2, 'worktree 档应看见盘上的新值')

    // git add 后 staged 档:本次新增那一行进阻断集,存量行不重复计
    assert.equal(git(dir, ['add', 'apps/web/src/a.css']).status, 0)
    const staged = gate.analyze({ root: dir, face: 'staged' })
    assert.equal(staged.totalViolations, 1, 'staged 档必须拦本次提交带进来的 asset 新增')
    assert.equal(staged.assetStock, 0, 'staged 档按新增行过滤后,存量行不该再进任何命中集')
  } finally {
    rmScratch(dir)
  }
})

test('E15 --self-test 与镜像同尺:判据共用一份实现,自检必须全绿', () => {
  assert.equal(gate.runSelfTest(), 0, '源脚本 --self-test 有失败用例')
})

test('E16 面纪律反向:HEAD 干净而盘上新增违规 ⇒ head 档仍判绿(不读工作树),worktree 档才红', () => {
  const BAD = "export const NAV = [{ label: 'x', icon: '🦄' }]\n"
  const dir = createRepo({ 'apps/web/src/nav.tsx': 'export const NAV = []\n' })
  try {
    const head1 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head1.scanned, 1, JSON.stringify(head1))
    assert.equal(head1.totalViolations, 0, 'HEAD 面干净的基线都不绿 ⇒ 判据本身失准')

    // 只在盘上加违规(不 add、不 commit):HEAD 档必须照旧报 0,只有 worktree 档才看见
    writeRepoFile(dir, 'apps/web/src/nav.tsx', BAD)
    const head2 = gate.analyze({ root: dir, face: 'head' })
    assert.equal(head2.scanned, 1, 'HEAD 档被盘上脏改动拖走了取材面')
    assert.equal(head2.totalViolations, 0, '未提交的脏改动进了 HEAD 面 ⇒ 门对已入库代码给出假红')
    assert.equal(gate.analyze({ root: dir, face: 'worktree' }).totalViolations, 1, 'worktree 档没看见盘上的违规')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
