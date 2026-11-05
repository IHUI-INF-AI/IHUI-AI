// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次⑤ parity 锁(§22c:判据直用生产实现,不在此复刻)。
 *
 * pkg-learn/teacher/detail → 共享屏 LecturerDetailScreen:
 *   阳性 A:RN wrapper import 且真渲染 <LecturerDetailScreen>(至少一端真消费);
 *   阴性 A:删掉 RN 渲染块 ⇒ 同一判据必须判红(只 import 不算真消费);
 *   阳性 B:小程序 import 共享屏 + 页内 JSX ≤2 + classifyPage 判 shell;
 *   阴性 B:删掉小程序 import ⇒ classifyPage 翻 copy(pure-copy);
 *   阳性 C:取数面(数据源/传参/渲染)两端同字段,页内不重画卡片。
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

const MINI = 'apps/miniapp-taro/src/pkg-learn/teacher/detail.tsx'
const RN = 'apps/mobile-rn/src/screens/TeacherDetailScreen.tsx'
const SHARED = 'packages/app/src/features/lecturer-detail/LecturerDetailScreen.tsx'
const SHARED_IMPORT = '@ihui/rn-app/features/lecturer-detail/LecturerDetailScreen'
const DECLARED = ['packages/app/src/features/lecturer-detail/LecturerDetailScreen.tsx']

/** 与 scripts/check-miniapp-shell-form 的 AST 口径一致:JsxElement + JsxSelfClosing + Fragment */
function countJsx(text) {
  const sf = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let n = 0
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      n++
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return n
}

function rnParityHolds(text) {
  return text.includes('LecturerDetailScreen') && /<LecturerDetailScreen\s/.test(text)
}

function stripRnRender(text) {
  return text.replace(/<LecturerDetailScreen[\s\S]*?\/>/, '')
}

function stripMiniImport(text) {
  return text
    .split('\n')
    .filter((line) => !line.includes(SHARED_IMPORT))
    .join('\n')
}

function classifyMini(text) {
  return classifyPage({
    route: 'pkg-learn/teacher/detail',
    file: MINI,
    text,
    declaredSpecs: DECLARED,
    registry: null,
  })
}

describe('pkg-learn/teacher/detail:RN 单端真消费 + 小程序换壳', () => {
  it('阳性 A:RN wrapper import 且真渲染共享屏', () => {
    const text = read(RN)
    assert.equal(rnParityHolds(text), true)
    assert.match(text, /\/teacher\/\$\{id\}/, 'RN 取数点 /teacher/:id 仍在')
  })

  it('阴性 A:删掉 RN 渲染块必须红(只 import 不算真消费)', () => {
    const mutated = stripRnRender(read(RN))
    assert.equal(mutated.includes('LecturerDetailScreen'), true)
    assert.equal(rnParityHolds(mutated), false)
  })

  it('阳性 B:小程序 import 共享屏且页内 JSX ≤2', () => {
    const text = read(MINI)
    assert.equal(text.includes(SHARED_IMPORT), true)
    const jsx = countJsx(text)
    assert.ok(jsx <= 2, `页内 JSX=${jsx} 必须 ≤2`)
    assert.equal(classifyMini(text).impl, 'shell')
  })

  it('阴性 B:删掉小程序 import ⇒ classifyPage 翻 copy', () => {
    const mutated = stripMiniImport(read(MINI))
    assert.equal(mutated.includes(SHARED_IMPORT), false)
    assert.equal(classifyMini(mutated).impl, 'copy')
    assert.equal(classifyMini(mutated).reasonClass, 'pure-copy')
  })

  it('阳性 C:取数面/传参面/渲染面三行两端同字段', () => {
    const mini = read(MINI)
    // 取数点:小程序 /teacher/:id + /teacher/:id/courses
    assert.match(mini, /getTeacherDetail\(id\)/)
    assert.match(mini, /\/teacher\/\$\{id\}\/courses/)
    // 传参点:页内列名映射到共享屏 info/courses(字段名来自 @ihui/types)
    assert.match(mini, /nickname: teacher\.name/)
    assert.match(mini, /courseCount,/)
    assert.match(mini, /info=\{info\}/)
    assert.match(mini, /courses=\{mappedCourses\}/)
    // 渲染点:共享屏自己画头部/数据/课程/按钮
    const shared = read(SHARED)
    assert.match(shared, /info\?\.nickname/)
    assert.match(shared, /onViewCourses \?/)
    assert.match(shared, /courses\.map/)
  })
})
