// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-button-text-wrap.mjs(§22c 模式)。
 *
 * 这枚门是四个里唯一"能力外部化"的:生产判据 `buildDetectFn` 返回的函数体在浏览器里跑,
 * 而 `probeServer`/`loadPlaywright` 依赖本机能力。两条通道因此分开走:
 *
 *  1. **生产判据直接调**:`buildDetectFn(selectors, threshold)` 是纯闭包,把 `document` /
 *     `getComputedStyle` 两个全局临时注入即可在本进程里跑真判据(几何是构造的,
 *     文本与 class 逐字取自真仓 HEAD);
 *  2. **真浏览器端到面**:`loadPlaywright()` + `chromium.launch()` + `page.goto(本地静态服务)`,
 *     用真实排版引擎复核同一个闭包 —— 跑不起来的能力一律走**条件跳过**(node:test 的
 *     `skip` 通道,账面记为 skipped 而不是 pass),不在这里 console.warn 后 return。
 *
 * 判据本体(`REPO_ROOT` / `TMP_DIR` / `loadPlaywright` / `buildDetectFn` / `probeServer`)
 * 全部从 `../check-button-text-wrap.mjs` 的 `__test__` 出口取,本文件不声明第二份阈值/选择器清单。
 *
 * 已知空档(如实登记):门体的默认目标 URL(dev server 地址)与 ratio 默认阈值都住在门体的
 * CLI 解析段里,**没有**进 `__test__` 出口。所以这里不写"照着默认值去连本机 8801"那一臂
 * —— 那等于在测试里重抄一份门体常量;改为把 URL/阈值当**显式入参**喂生产入口,
 * 并在 B4 用"目标不可达"那一格(端到 CLI 的真实分支)证明"没跑成"不会被记成"跑过了"。
 *
 * node:test 在本仓运行时(Node 24.19)没有模块级 `it.skipIf` —— 见本文件末尾的读数打印,
 * 等价通道是 `test(name, { skip: <加载期同步算出的布尔或理由> }, fn)`,账面同样落 skipped 计数。
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { it } from 'node:test'

import { __test__ as gate } from '../check-button-text-wrap.mjs'
import { catBatch } from '../lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')
const GATE_REL = 'check-button-text-wrap.mjs'

const MESSAGES_REL = 'packages/i18n/messages/web/zh-CN.json'
const SECTIONS_REL = 'apps/web/src/components/ai/progress-sections/terminal-section.tsx'

const SPECS = [`HEAD:${MESSAGES_REL}`, `HEAD:${SECTIONS_REL}`]
const READ = catBatch(REPO_ROOT, SPECS, { timeout: 120_000 })
const MESSAGES_TEXT = READ.get(SPECS[0])
const SECTIONS_TEXT = READ.get(SPECS[1])
if (typeof MESSAGES_TEXT !== 'string' || typeof SECTIONS_TEXT !== 'string')
  throw new Error(`HEAD 面取不到取证正文(${MESSAGES_REL} / ${SECTIONS_REL})⇒ 取证失败,不记绿`)

/** 真仓 HEAD 的按钮可见文案(逐字取自 web 文案表的 ai.pane.terminal.copyOutput)。 */
const LABEL = JSON.parse(MESSAGES_TEXT)?.ai?.pane?.terminal?.copyOutput
if (typeof LABEL !== 'string' || LABEL.length === 0)
  throw new Error(`${MESSAGES_REL} 的 HEAD 面里取不到 ai.pane.terminal.copyOutput ⇒ 取证样本已漂移`)
/** 真仓 HEAD 里那一处按钮的 class 原文(整行摘出,不手抄)。 */
const CLASS_LINE = SECTIONS_TEXT.split('\n').find((l) => l.includes('className="rounded-sm px-1 text-xs'))
if (typeof CLASS_LINE !== 'string') throw new Error(`${SECTIONS_REL} 的 HEAD 面里找不到那处按钮的 class 行 ⇒ 取证样本已漂移`)
const CLASS_ATTR = /className="([^"]+)"/.exec(CLASS_LINE)?.[1] ?? ''
if (!CLASS_ATTR) throw new Error('摘不出 HEAD 的 class 值 ⇒ 取证样本已漂移')

/** 加载期同步算出的能力探测:Playwright 包体在不在(不在则真浏览器那一臂记 skip,不记通过)。 */
const PW_DIR = join(gate.REPO_ROOT, 'apps', 'web', 'node_modules', '@playwright', 'test')
const PLAYWRIGHT_PRESENT = existsSync(PW_DIR)
const HAS_SKIP_IF_API = typeof it.skipIf === 'function'

/** 临时把两个浏览器全局换成假实现,在"装着"的那一段时间里跑 fn(退出即还原)。 */
function withFakeDom({ computed, selectors }, fn) {
  const prevDoc = globalThis.document
  const prevCs = globalThis.getComputedStyle
  globalThis.document = {
    querySelectorAll: (sel) => selectors[sel] ?? [],
  }
  globalThis.getComputedStyle = computed
  try {
    return fn()
  } finally {
    if (prevDoc === undefined) delete globalThis.document
    else globalThis.document = prevDoc
    if (prevCs === undefined) delete globalThis.getComputedStyle
    else globalThis.getComputedStyle = prevCs
  }
}

function fakeSpan(text, height, width = 72) {
  return {
    tagName: 'SPAN',
    children: [],
    textContent: text,
    outerHTML: `<span>${text}</span>`,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, bottom: height, right: width }),
  }
}

function fakeButton(spans, { width = 72, height = 24 } = {}) {
  return {
    tagName: 'BUTTON',
    children: spans,
    outerHTML: `<button type="button" class="${CLASS_ATTR}"><span>${LABEL}</span></button>`,
    querySelectorAll: () => spans,
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, bottom: height, right: width }),
  }
}

/** 把"按钮集合 + 计算样式"交给生产闭包跑一遍,返回它的结论。 */
function runDetect({ spans, width = 72, height = 24, fontSize = '12px', lineHeight = 'normal', selectors = ['button'], threshold = 1.4 }) {
  const btn = fakeButton(spans, { width, height })
  const bySel = {}
  for (const sel of selectors) bySel[sel] = sel === 'button' ? [btn] : []
  return withFakeDom(
    { computed: () => ({ fontSize, lineHeight }), selectors: bySel },
    () => gate.buildDetectFn(selectors, threshold)({ selectors, threshold }),
  )
}

it('B1 出口常量指向本仓,且取证落点锚在仓内(不得漂到系统 TEMP)', () => {
  assert.ok(existsSync(join(gate.REPO_ROOT, 'scripts', GATE_REL)), `REPO_ROOT 里应当有 scripts/${GATE_REL}`)
  assert.ok(
    gate.TMP_DIR.startsWith(gate.REPO_ROOT + sep) || gate.TMP_DIR.startsWith(gate.REPO_ROOT + '/'),
    `截图取证落点必须锚在 REPO_ROOT 下,实得:${gate.TMP_DIR}`,
  )
  assert.notEqual(gate.TMP_DIR, gate.REPO_ROOT, '取证目录不得就是仓根(那会把截图摊在仓根)')
  assert.ok(
    !gate.TMP_DIR.startsWith(resolve(tmpdir())) && !gate.TMP_DIR.startsWith(tmpdir()),
    `取证落点不得跟着进程 TEMP 走(§15b:TEMP 可能仍钉在别的盘),实得:${gate.TMP_DIR}`,
  )
})

it('B2 生产闭包在假 DOM 上的正反成对:两行高判换行、单行高放过', () => {
  const wrapped = runDetect({ spans: [fakeSpan(LABEL, 33.6)] })
  assert.equal(wrapped.length, 1, `两行文字必须判命中,实得 ${JSON.stringify(wrapped)}`)
  assert.equal(wrapped[0].label, LABEL, '命中报告里的文案必须是 HEAD 那一字')
  assert.ok(wrapped[0].ratio > 1.4, `ratio 必须真的越过阈值,实得 ${wrapped[0].ratio}`)
  const single = runDetect({ spans: [fakeSpan(LABEL, 14.4)] })
  assert.equal(single.length, 0, `单行高必须放过,实得 ${JSON.stringify(single)}`)
  assert.notEqual(wrapped.length, single.length, '两臂同形 ⇒ 判据没在读高度')
})

it('B3 阈值是承重的:同一份几何,阈值调高即翻面(不是"永远命中"的常数)', () => {
  const strict = runDetect({ spans: [fakeSpan(LABEL, 33.6)], threshold: 1.4 })
  const loose = runDetect({ spans: [fakeSpan(LABEL, 33.6)], threshold: 2.4 })
  assert.equal(strict.length, 1, '阈值 1.4 必须命中')
  assert.equal(loose.length, 0, `同一几何在阈值 2.4 下必须放过(ratio=${strict[0].ratio}),否则阈值参数是装饰`)
})

it('B4 三种"不该判"的形状都必须放过:隐藏按钮 / 空文本 span / 无字号', () => {
  const hidden = runDetect({ spans: [fakeSpan(LABEL, 33.6)], width: 0, height: 0 })
  assert.equal(hidden.length, 0, `宽高为 0 的隐藏按钮不得算命中:${JSON.stringify(hidden)}`)
  const blank = runDetect({ spans: [fakeSpan('   ', 33.6)] })
  assert.equal(blank.length, 0, '空白文本的 span 不得算命中')
  const noFont = runDetect({ spans: [fakeSpan(LABEL, 33.6)], fontSize: 'not-a-number' })
  assert.equal(noFont.length, 0, `字号取不到有效值时必须跳过,实得:${JSON.stringify(noFont)}`)
  const normalLh = runDetect({ spans: [fakeSpan(LABEL, 33.6)], lineHeight: 'normal' })
  const pxLh = runDetect({ spans: [fakeSpan(LABEL, 33.6)], lineHeight: '14.4px' })
  assert.deepEqual(
    normalLh.map((x) => x.ratio),
    pxLh.map((x) => x.ratio),
    'lineHeight: normal 的兜底(×1.2)必须与显式 14.4px 同一结论,否则两种写法一个红一个绿',
  )
})

it('B5 选择器既认按钮本身也认父容器;认不到的选择器不得凭空报命中', () => {
  const btn = fakeButton([fakeSpan(LABEL, 33.6)])
  const container = { tagName: 'DIV', querySelectorAll: () => [btn] }
  const asContainer = withFakeDom(
    {
      computed: () => ({ fontSize: '12px', lineHeight: 'normal' }),
      selectors: { '[data-testid="agent-progress-pane"]': [container], button: [] },
    },
    () =>
      gate.buildDetectFn(['[data-testid="agent-progress-pane"]'], 1.4)({
        selectors: ['[data-testid="agent-progress-pane"]'],
        threshold: 1.4,
      }),
  )
  assert.equal(asContainer.length, 1, `父容器选择器必须往里找到 button,实得 ${JSON.stringify(asContainer)}`)
  const asNothing = withFakeDom(
    { computed: () => ({ fontSize: '12px', lineHeight: 'normal' }), selectors: { button: [] } },
    () => gate.buildDetectFn(['button'], 1.4)({ selectors: ['button'], threshold: 1.4 }),
  )
  assert.equal(asNothing.length, 0, '页面里没有按钮时不得凭空报命中')
})

it('B6 probeServer:在听的端口判可达、关掉的端口判不可达并带原因、坏 URL 不得抛', async () => {
  const srv = createServer((_req, res) => res.end('x')).listen(0, '127.0.0.1')
  await new Promise((r) => srv.once('listening', r))
  const port = srv.address().port
  const up = await gate.probeServer(`http://127.0.0.1:${port}`)
  assert.equal(up.ok, true, `在听的端口必须判可达,实得 ${JSON.stringify(up)}`)
  assert.equal(up.port, port)
  assert.equal(up.host, '127.0.0.1')
  srv.close()
  const down = await gate.probeServer(`http://127.0.0.1:${port}`)
  assert.equal(down.ok, false, `关掉之后的同一端口必须判不可达,实得 ${JSON.stringify(down)}`)
  assert.ok(String(down.message).includes(String(port)), `不可达原因必须说清是哪个端口:${down.message}`)
  const bad = await gate.probeServer('not-a-url')
  assert.equal(bad.ok, false)
  assert.ok(String(bad.message).length > 0, '坏 URL 也必须给出原因,不得静默 false')
})

it('B7 端到 CLI:目标不可达那一次必须"跳过"而不是"扫描通过",参数非法必须判死', () => {
  const gateAbs = join(SCRIPTS_DIR, GATE_REL)
  const run = (args) => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [gateAbs, ...args], { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 32 << 20, stdio: ['ignore', 'pipe', 'pipe'] }) }
    } catch (e) {
      return { code: typeof e?.status === 'number' ? e.status : -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
    }
  }
  const closed = run(['--url', 'http://127.0.0.1:1', '--strict'])
  assert.equal(closed.code, 0, `dev server 不可达时不得判红(它没跑成,不是跑过了),实得 ${closed.code}:${closed.out}`)
  assert.ok(
    closed.out.includes('skipped') || closed.out.includes('跳过'),
    `不可达那一支必须明说"跳过",实得:${closed.out}`,
  )
  assert.ok(!closed.out.includes('通过'), `不得把"没跑到"写成"通过":${closed.out}`)
  const json = run(['--url', 'http://127.0.0.1:1', '--json'])
  const parsed = JSON.parse(json.out)
  assert.equal(parsed.status, 'skipped', `--json 档同一支必须报 status=skipped,实得 ${json.out}`)
  assert.equal(parsed.url, 'http://127.0.0.1:1')
  const badArgs = run(['--threshold', '0.5'])
  assert.equal(badArgs.code, 2, `阈值 < 1 属参数错误(exit 2),实得 ${badArgs.code}:${badArgs.out}`)
  const help = run(['--help'])
  assert.equal(help.code, 0)
  assert.ok(help.out.includes('--selectors'), `--help 必须打印参数面,实得:${help.out.slice(0, 120)}`)
})

it('B8 生产出口 loadPlaywright 的能力如实可分(装了给 chromium,没装就如实失败)', async (t) => {
  if (!PLAYWRIGHT_PRESENT) {
    t.skip(`本机没有 Playwright 包体(${PW_DIR})⇒ 能力缺,记 skipped 而不是通过`)
    return
  }
  const mod = await gate.loadPlaywright()
  assert.ok(mod && mod.chromium, 'loadPlaywright() 在装了 @playwright/test 的机器上必须交出 chromium')
})

it('B9 真浏览器端到面:本地静态页 + HEAD 的文案与 class,裁得窄必换行、给了 nowrap 必放过', async (t) => {
  if (!PLAYWRIGHT_PRESENT) {
    t.skip(`本机没有 Playwright 包体(${PW_DIR})⇒ 真浏览器这一臂未跑,记 skipped`)
    return
  }
  let chromium
  try {
    chromium = (await gate.loadPlaywright()).chromium
  } catch (e) {
    t.skip(`loadPlaywright 失败:${String(e?.message ?? e).split('\n')[0]}`)
    return
  }
  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch (e) {
    t.skip(`chromium 启动失败(浏览器内核未下载?):${String(e?.message ?? e).split('\n')[0]}`)
    return
  }
  const html = (extraStyle) =>
    [
      '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">',
      `<button type="button" class="${CLASS_ATTR}" style="width:48px;height:24px;font-size:12px;${extraStyle}">`,
      `<span>${LABEL}</span></button></body></html>`,
    ].join('')
  const srv = createServer((req, res) => {
    const nowrap = String(req.url).includes('nowrap')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html(nowrap ? 'white-space:nowrap' : ''))
  }).listen(0, '127.0.0.1')
  await new Promise((r) => srv.once('listening', r))
  const port = srv.address().port
  const base = `http://127.0.0.1:${port}`
  try {
    const probe = await gate.probeServer(base)
    assert.equal(probe.ok, true, `本地静态页必须在听,实得 ${JSON.stringify(probe)}`)
    const page = await browser.newPage()
    const results = {}
    for (const [name, url] of [['wrapped', `${base}/`], ['nowrap', `${base}/nowrap`]]) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      const out = await page.evaluate(gate.buildDetectFn(['button'], 1.4), { selectors: ['button'], threshold: 1.4 })
      results[name] = out
    }
    assert.equal(results.wrapped.length, 1, `真实排版下窄按钮必须判换行,实得 ${JSON.stringify(results.wrapped)}`)
    assert.equal(results.wrapped[0].label, LABEL, '真实排版下报告的文案必须是 HEAD 那一字')
    assert.ok(results.wrapped[0].ratio > 1.4, `真实 ratio 必须越过阈值,实得 ${results.wrapped[0].ratio}`)
    assert.equal(results.nowrap.length, 0, `给了 nowrap 的那一份必须放过,实得 ${JSON.stringify(results.nowrap)}`)
  } finally {
    await browser.close().catch(() => {})
    srv.close()
  }
})

it('B10 运行时能力读数打印(账面可复核:skipIf API 在不在、Playwright 在不在)', () => {
  console.log(
    `    · 现读:Node ${process.version} / it.skipIf 可用 = ${HAS_SKIP_IF_API} / Playwright 包体在位 = ${PLAYWRIGHT_PRESENT}(${PW_DIR})`,
  )
  assert.equal(typeof it, 'function', '测试运行器必须在位')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
