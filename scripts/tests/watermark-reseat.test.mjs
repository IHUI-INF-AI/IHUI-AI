// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:尾部隐写行的"归位"能力 + 可见横幅缺失的判定 + 归档切片不得带走水印行。
 *
 * 立测因由是 2026-09-29 的一次实测:HEAD 面一份 34,580 行的归档件**通篇没有可见横幅**,
 * 而正文里躺着 4 行从计划文档搬来的孤儿隐写标记。`watermark.mjs verify` 对它报绿 ——
 * 于是"把版权横幅整块删掉"这个动作在门禁上等价于"没问题",而 L3(独立隐写行)的设计理由
 * 恰恰是"删除可见横幅仍可检出"。判据只查载荷在不在,等于把 L3 的存在意义反着用。
 *
 * 被测对象:
 *  - `scripts/lib/watermark-lines.mjs` —— 水印结构行的唯一识别实现;
 *  - `scripts/watermark.mjs inject --reseat-tail` —— 追加型产物的 L3 归位;
 *  - `scripts/watermark.mjs verify` 的新态「有隐写载荷但无可见横幅」;
 *  - 两条**形状锁**:横幅判据不得有第二份实现;归档器必须真过两道闸并带旗调注入。
 *
 * 跑法:`node --test scripts/tests/watermark-reseat.test.mjs`
 */

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { mkScratch } from '../lib/scratch-dir.mjs'
import { decideBanner } from '../object-space-land.mjs'
import {
  hasExactCanonicalBanner,
  hasVisibleCopyright,
  isInvisibleMarkLine,
  stripWatermarkStructure,
} from '../lib/watermark-lines.mjs'

const REPO = join(import.meta.dirname, '..', '..')
const WM = join(REPO, 'scripts', 'watermark.mjs')
const ARCHIVER = join(REPO, 'scripts', 'archive-completed-tasks.mjs')
const LIB = join(REPO, 'scripts', 'lib', 'watermark-lines.mjs')
const src = (f) => readFileSync(f, 'utf8')

// 夹具里的"隐写行"一律从**真实注入产物**取(见 realTailLine),源码里不落任何零宽字符:
// 写进源码 = 本测试文件自己多出几份载荷,而"说明用的文字带着执行用的字符"是本仓记过的陷阱形态。
const ZW_ANY = new RegExp('[' + String.fromCodePoint(0x2060, 0x200b, 0x200c, 0x200d) + ']')
// 一条形态完整、可解码的隐写载荷(从真注入产物取,见 realTailLine 之外这里需要一个常量级样本)
const ZW_MARK = String.fromCodePoint(0x2060, 0x200b, 0x200b, 0x2060)

const inject = (absPath, extra = []) =>
  execFileSync(process.execPath, [WM, 'inject', ...extra, absPath], {
    encoding: 'utf8',
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 跑 verify 并取回退出码(不能过管道,否则拿到的是管道末端的码) */
function verifyRun(absPath) {
  try {
    const out = execFileSync(process.execPath, [WM, 'verify', absPath], {
      encoding: 'utf8',
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, out }
  } catch (e) {
    return { status: e.status, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

const lastLine = (text) =>
  text
    .replace(/\r?\n+$/, '')
    .split(/\r?\n/)
    .pop() || ''
/** 人眼读得到的那一份:剥掉所有含零宽字符的行,并丢掉空行 */
const visible = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => !ZW_ANY.test(l) && l.trim() !== '')
    .join('\n')

/** 造一个正常注入的文件,返回它的真实末行(即生产者的 L3 形态) */
function realTailLine(dir, name = 'seed.md') {
  const f = join(dir, name)
  writeFileSync(f, '# 标题\n\n正文一段\n', 'utf8')
  inject(f)
  return lastLine(readFileSync(f, 'utf8'))
}

test('T1 形状锁:横幅判据只有一份实现,watermark.mjs 不得再本地声明', () => {
  const w = src(WM)
  assert.match(w, /from '\.\/lib\/watermark-lines\.mjs'/, '必须 import 那份唯一实现')
  assert.ok(!/const BANNER_TEXT_RE\s*=/.test(w), 'watermark.mjs 里不得再出现第二份横幅正则')
  assert.ok(!/function isBannerLine\(/.test(w), '不得再出现第二份 isBannerLine')
  assert.match(src(LIB), /export const BANNER_TEXT_RE/, '实现本体必须在 lib 里且被导出')
})

test('T2 形状锁:归档器必须真过两道闸,并以归位旗调注入', () => {
  const a = src(ARCHIVER)
  assert.match(a, /from '\.\/lib\/watermark-lines\.mjs'/, '归档器必须共用那份识别实现')
  assert.match(
    a,
    /stripWatermarkStructure\(/,
    '切片必须剔走水印结构行 —— 孤儿隐写标记进归档件的唯一通道就是切片',
  )
  assert.match(
    a,
    /'--reseat-tail',\s*filePath/,
    'injectWatermarkOrDie 必须带归位旗(归档件是追加型产物,不带旗标记就会被下一次搬运埋进正文)',
  )
})

test('T3 端到端三态:注入⇒末行是隐写行;追加⇒不带旗不动它、带旗请回末行且可见内容不变', (t) => {
  const dir = mkScratch('wm-reseat-')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const f = join(dir, 'probe.md')
  writeFileSync(f, '# 标题\n\n正文一段\n', 'utf8')

  inject(f)
  assert.ok(isInvisibleMarkLine(lastLine(readFileSync(f, 'utf8'))), '注入后末行必须是尾部隐写行')

  // 模拟追加型生成器:往尾部再拼正文 —— 归档器每次搬运就是这个动作
  appendFileSync(f, '\n## 第二批条目\n\n又一页内容\n', 'utf8')
  const appended = readFileSync(f, 'utf8')
  inject(f)
  assert.equal(
    readFileSync(f, 'utf8'),
    appended,
    '不带旗时载荷已完整 ⇒ 必须幂等跳过(不得替别人改写刚追加的内容)',
  )
  assert.ok(
    !isInvisibleMarkLine(lastLine(appended)),
    '前置条件不成立:本轮必须真造出"标记被顶到中部"的形态,否则这条用例什么都没测',
  )

  const visBefore = visible(appended)
  inject(f, ['--reseat-tail'])
  const after = readFileSync(f, 'utf8')
  assert.ok(isInvisibleMarkLine(lastLine(after)), '带旗后末行必须又是尾部隐写行')
  assert.equal(visible(after), visBefore, '归位只移动那一行隐写标记,不得改动任何可见内容')

  inject(f, ['--reseat-tail'])
  assert.equal(
    readFileSync(f, 'utf8'),
    after,
    '第二次带旗注入必须零改动(幂等),否则每轮都在重写全文',
  )
})

test('T4 verify 新态:真实隐写行 + 整块横幅缺失 ⇒ 判红并点名(阳性对照:正常注入必绿)', (t) => {
  // 夹具必须落在**仓库内**的临时面(§15:统一 .ihui-agent/tmp/,已 gitignore)。
  // verify 的路径口径是"相对仓库根",落在仓库外会被 relative() 折成带 .. 的串而 existsSync 失败,
  // 于是它把该文件计成"跳过",报"覆盖 0/1 ⇒ 纳入口径的文件均已带水印" —— 一台看不见被审对象的
  // 尺子把"没判"写成"判过了"(实测第一次跑就是这一格:红的是用例落点,不是判据)。
  const dir = join(REPO, '.ihui-agent', 'tmp', 'cap-reseat', `case-${process.pid}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const tail = realTailLine(dir)
  assert.ok(isInvisibleMarkLine(tail), '前置:取到的必须是真实隐写行')

  const bad = join(dir, 'only-invisible.md')
  // 逐字复刻实测形态:正文 + 一行隐写标记,而通篇没有可见横幅
  writeFileSync(bad, `# 标题\n\n正文\n\n${tail}\n`, 'utf8')
  const r = verifyRun(bad)
  assert.equal(r.status, 1, `有隐写而无可见横幅必须 exit 1,实得 ${r.status}:${r.out}`)
  assert.match(r.out, /可见横幅缺失或已损坏/, '报告必须点名是哪一态,不得只给一个退出码')
  assert.match(
    r.out,
    /仅隐写[（(][^）)]*[)）]\s*1 个/,
    '汇总行必须把它单列成一维(混进"完好"就是本案的原始缺陷)',
  )

  const good = join(dir, 'normal.md')
  writeFileSync(good, '# 标题\n\n正文\n', 'utf8')
  inject(good)
  const g = verifyRun(good)
  assert.equal(g.status, 0, `正常注入的文件必须绿(阳性对照),实得 ${g.status}:${g.out}`)
  assert.match(g.out, /覆盖 1\/1/, '前置:对照文件必须真被计入分母,否则这条绿什么都没证明')
})

test('T5 lib 单元:三型横幅 + 隐写行都认,普通行与常量定义一条不认', (t) => {
  const dir = mkScratch('wm-lib-')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const tail = realTailLine(dir, 'seed2.md')
  const mark = tail.replace(/^<!--\s*/, '').replace(/\s*-->$/, '')

  assert.ok(isInvisibleMarkLine(tail), '真实末行形态必须被认出')
  assert.ok(isInvisibleMarkLine(`// ${mark}`), '斜杠注释包裹同样算(生成器换语言时形态会变)')
  assert.ok(isInvisibleMarkLine(mark), '裸隐写行')
  assert.ok(isInvisibleMarkLine(`/* ${mark} */`), '块注释包裹')
  assert.ok(isInvisibleMarkLine(`# ${mark}`), '井号注释包裹')
  // 反向对照:源码里出现同名常量/说明文字,不得被当成水印行(否则清洗会自噬源码)
  assert.ok(!isInvisibleMarkLine('/* 说明块 */'), '普通块注释不算')
  assert.ok(!isInvisibleMarkLine('<!-- 普通注释 -->'), '普通 HTML 注释不算')
  assert.ok(!isInvisibleMarkLine('- 一条普通 bullet'), '正文 bullet 不算')
  const s = stripWatermarkStructure(['正文甲', tail, '正文乙'].join('\n'))
  assert.deepEqual([s.removed, s.text], [1, '正文甲\n正文乙'], '剔除计数必须如实,正文一行不少')
})

test('T6 真仓阳性对照:HEAD 面上那种"无横幅而带隐写"的形态必须被本判据点名', (t) => {
  const rel = '.ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md'
  const r = spawnSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) {
    t.skip(`${rel} 已不在 HEAD ⇒ 该存量已清偿,这一格改由 T4 的构造面负责(不冒充判定)`)
    return
  }
  const text = r.stdout
  const zwLines = text.split(/\r?\n/).filter((l) => ZW_ANY.test(l))
  assert.ok(zwLines.length > 0, 'HEAD 面那份文件必须仍带隐写行,否则用例失效')
  assert.ok(
    stripWatermarkStructure(zwLines.join('\n')).removed >= 1,
    '搬进正文的孤儿隐写行必须被识别为水印结构行(它就是从计划文档搬来的)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T7 可见横幅判据必须容忍标点漂移(逐字比会把 5 份署名完好的文件报成无署名)', () => {
  const okJs = [
    '# x',
    '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
    '// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。',
  ].join('\n')
  // 实测形态:apps/ai-service/** 的 Python 横幅收尾是 ASCII 句点,而 JS 侧是ideo graphic 句点。
  const okPy = [
    '# x',
    '# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
    '# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).',
  ].join('\n')
  const none = ['# x', `// ${ZW_MARK}`, ''].join('\n')
  assert.ok(hasVisibleCopyright(okJs), 'JS 形态必须算有署名')
  assert.ok(
    hasVisibleCopyright(okPy),
    'Python 形态(句点不同)也必须算有署名 —— 逐字比会在这里产假阳',
  )
  assert.ok(!hasVisibleCopyright(none), '只剩载荷行不算署名(这正是本态要抓的形态)')
  assert.ok(
    hasExactCanonicalBanner(okJs) && !hasExactCanonicalBanner(okPy),
    '逐字档必须只认 JS 文案,它的作用是区分"本来就对"与"这次修对的"',
  )
})

test('T8 落地器水幕判据:五态成对,修复必须放行而抹除仍然判红', () => {
  const BASE_OK = [
    '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
    '// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。',
    '正文',
  ].join('\n')
  assert.equal(
    decideBanner({ baseText: BASE_OK, newText: BASE_OK }).verdict,
    'kept',
    '未触碰 ⇒ kept',
  )
  assert.equal(
    decideBanner({ baseText: BASE_OK, newText: '正文' }).verdict,
    'broken',
    '基线有署名而构造内容没有 ⇒ 必须拒落',
  )
  assert.equal(
    decideBanner({ baseText: `// ${ZW_MARK}\n正文`, newText: BASE_OK }).verdict,
    'repaired',
    '基线只剩载荷行而构造内容补回署名 ⇒ 这是修复,拦它就是拦住本票自己要做的动作',
  )
  assert.equal(
    decideBanner({ baseText: '# 新文件\n正文', newText: '# 新文件\n正文' }).verdict,
    'note',
    '两边本来就没有署名 ⇒ 不逼它长出,也不静默算过',
  )
  assert.equal(
    decideBanner({
      baseText: BASE_OK,
      newText: [
        '// © 2027 IHUI AI (智汇AI) · 别人',
        '// Provenance-watermarked. 改了字',
        '正文',
      ].join('\n'),
    }).verdict,
    'broken',
    '两边都有署名而横幅文字被换 ⇒ 改写横幅文字这一格不让步',
  )
})

test('T9 形状锁:横幅文案不许被任何消费者抄第二份(它们各自的横幅不算)', () => {
  const LINES = '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top'
  // 每个受水印保护的文件**自己**的横幅里就有这一行,所以"出现过"不等于"抄了一份"。
  // 真正的判据是:只许出现在文件自己的水印块里(前 4 行),且总共只出现一次。
  for (const f of [WM, ARCHIVER, join(REPO, 'scripts', 'object-space-land.mjs')]) {
    const s = src(f)
    const at = s.indexOf(LINES)
    if (at < 0) continue // 未注入(测试夹具/新文件)也合规 —— 它本来就不该自己写文案
    assert.ok(at === s.lastIndexOf(LINES), '不得出现第二份:' + f)
    assert.ok(
      s.slice(0, at).split(String.fromCharCode(10)).length <= 4,
      '只许落在文件自己的水印块内(前 4 行):' + f,
    )
    assert.match(s, /watermark-lines.mjs/, '三个消费者都必须走那份 lib:' + f)
  }
  assert.ok(src(LIB).includes(LINES), '文案本体必须在 lib 里(否则"唯一实现"是句空话)')
})
