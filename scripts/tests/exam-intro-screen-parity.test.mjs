// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次④ parity 锁(§22c:判据直用生产实现,不在此复刻)。
 *
 * exam/detail:「web-单端 parity(web + 小程序),不含 RN」
 *   阳性 A:web 适配器具体子路径 import 且真渲染 <ExamIntroScreen>;
 *   阴性 A:删掉 web 渲染块 ⇒ 同一判据必须判红(只 import 不算)。
 *   阳性 B:小程序 import 共享屏 + 页内 JSX ≤2;
 *   阴性 B:删掉小程序 import ⇒ classifyPage 翻 copy。
 * plaza/cover 四 prop 两端显式传且值不同:
 *   阳性 C:statusText/entryIds/footerAction/showApiKeyRow 两端各显式出现,entry 4 vs 3;
 *   阴性 C:删掉小程序 entryIds ⇒ 断言红;阳性 D:RN 消费点仍在。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const { classifyPage } = await import(
  pathToFileURL(join(ROOT, 'scripts/lib/miniapp-shell-form.mjs')).href
)

const WEB_ADAPTER = 'apps/web/app/(main)/exam/[id]/ExamIntro.tsx'
const MINI_EXAM = 'apps/miniapp-taro/src/pages/exam/detail.tsx'
const MINI_COVER = 'apps/miniapp-taro/src/pkg-content/plaza/cover/index.tsx'
const RN_DEVELOPER = 'apps/mobile-rn/src/screens/DeveloperScreen.tsx'
const SHARED_DEVELOPER = 'packages/app/src/features/developer/DeveloperScreen.tsx'

const EXAM_DECLARED = ['packages/app/src/features/exam-intro/ExamIntroScreen.tsx']
const EXAM_IMPORT_LINE = "@ihui/rn-app/features/exam-intro/ExamIntroScreen"

/** web 真消费 = 具体子路径 import 且 JSX 里真的渲染(只 import 不算) */
function webParityHolds(text) {
  return (
    /from\s*['"]@ihui\/rn-app\/features\/exam-intro\/ExamIntroScreen['"]/.test(text) &&
    /<ExamIntroScreen\s/.test(text)
  )
}

function stripWebRender(text) {
  return text.replace(/<ExamIntroScreen[\s\S]*?\/>/, '')
}

function stripMiniExamImport(text) {
  return text
    .split('\n')
    .filter((line) => !line.includes(EXAM_IMPORT_LINE))
    .join('\n')
}

/** 与 scripts/check-miniapp-shell-form 的 AST 口径一致:JsxElement + JsxSelfClosing + Fragment */
function countJsx(text) {
  const sf = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let n = 0
  const visit = (node) => {
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    ) {
      n++
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return n
}

function classifyMini(text) {
  return classifyPage({
    route: 'pages/exam/detail',
    file: MINI_EXAM,
    text,
    declaredSpecs: EXAM_DECLARED,
    registry: null,
  })
}

describe('exam/detail:web + 小程序单端 parity(不含 RN)', () => {
  it('阳性 A:web 适配器 import 且真渲染共享屏', () => {
    const text = read(WEB_ADAPTER)
    assert.equal(webParityHolds(text), true)
    assert.equal(countJsx(text), 1, 'web 适配器只渲染一个 <ExamIntroScreen>')
  })

  it('阴性 A:删掉 web 渲染块必须红(只 import 不算真消费)', () => {
    const mutated = stripWebRender(read(WEB_ADAPTER))
    assert.equal(
      /from\s*['"]@ihui\/rn-app\/features\/exam-intro\/ExamIntroScreen['"]/.test(mutated),
      true,
    )
    assert.equal(webParityHolds(mutated), false)
  })

  it('阳性 B:小程序 import 共享屏且页内 JSX ≤2', () => {
    const text = read(MINI_EXAM)
    assert.equal(text.includes(EXAM_IMPORT_LINE), true)
    assert.ok(countJsx(text) <= 2, `页内 JSX=${countJsx(text)} 必须 ≤2`)
    assert.equal(classifyMini(text).impl, 'shell')
  })

  it('阴性 B:删掉小程序 import ⇒ classifyPage 翻 copy', () => {
    const mutated = stripMiniExamImport(read(MINI_EXAM))
    assert.equal(classifyMini(mutated).impl, 'copy')
    assert.equal(classifyMini(mutated).reasonClass, 'pure-copy')
  })
})

describe('plaza/cover:四 prop 两端显式传且值不同', () => {
  const rnText = read(RN_DEVELOPER)
  const miniText = read(MINI_COVER)

  it('阳性 C:两端四 prop 各自显式出现,entryIds 4 vs 3', () => {
    assert.match(rnText, /statusText=\{devData\?\.subscription \? t\('devSpace\.opened'\) : t\('devSpace\.notOpened'\)\}/)
    assert.match(miniText, /statusText=\{statusText\}/)
    assert.match(rnText, /entryIds=\{\['myAgents', 'agentIncome', 'n8nModel', 'businessCard'\]\}/)
    assert.match(miniText, /entryIds=\{DEV_ENTRY_IDS\}/)
    const miniIds = miniText.match(/const DEV_ENTRY_IDS = \['myAgents', 'agentIncome', 'n8nModel'\]/)
    assert.ok(miniIds, '小程序数据源 3 项')
    assert.match(rnText, /footerAction=\{\{/)
    assert.match(rnText, /label: t\('devSpace\.enterPlaza'\)/)
    assert.match(miniText, /footerAction=\{/)
    assert.match(miniText, /plaza\.cover\.continueOrder/)
    assert.match(rnText, /showApiKeyRow/)
    assert.match(miniText, /showApiKeyRow=\{false\}/)
  })

  it('阴性 C:删掉小程序 entryIds ⇒ 断言红', () => {
    const mutated = miniText.replace(/\n\s*entryIds=\{DEV_ENTRY_IDS\}/, '')
    assert.equal(/entryIds=\{DEV_ENTRY_IDS\}/.test(mutated), false)
  })

  it('阳性 D:RN 消费点仍在且共享屏渲染四 prop', () => {
    assert.match(rnText, /<SharedDeveloperScreen/)
    assert.match(rnText, /statusText=\{/)
    const shared = read(SHARED_DEVELOPER)
    assert.match(shared, /statusText \? <Text style=\{styles\.statusText\}>/)
    assert.match(shared, /visibleEntries\.map/)
    assert.match(shared, /footerAction \? \(/)
    assert.match(shared, /if \(showApiKeyRow\)/)
  })
})

