// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** `scripts/lib/scratch-module-closure.mjs` 的镜像测试。
 *  这个模块存在的理由是"手抄依赖清单必然晚一拍",所以它自己的测试必须能证明
 *  ① 闭包是真推导出来的(新增一跳不用改调用方)、② 三种 import 形态都认、
 *  ③ 拷不全时它**抛**而不是静默产出一个跑不起来的夹具(静默正是它要防的那一型)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

import { relativeImportClosure, copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/** 造一个假 scripts/ 树,把三种 import 形态各放一处 */
function makeFixtureScripts() {
  const dir = mkdtempSync(join(tmpdir(), 'closure-fix-'))
  const w = (rel, text) => {
    const p = join(dir, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, text, 'utf8')
  }
  w(
    'entry.mjs',
    [
      "import { a } from './lib/one.mjs'", // 具名 + from
      "import './side-effect.mjs'", // 副作用形态(漏认它 = 下一跳没拷)
      "export * from './lib/reexported.mjs'", // re-export 形态
      "import { deeply } from './lib/deep.mjs'",
      "import { readFile } from 'node:fs'", // 裸包名:不该进闭包
      'export const go = () => a + readFile + deeply + sideEffect',
    ].join('\n'),
  )
  w('lib/one.mjs', "export const a = 1\n")
  w('side-effect.mjs', 'export const sideEffect = 2\n')
  w('lib/reexported.mjs', 'export const r = 3\n')
  w('lib/deep.mjs', "import { r } from './reexported.mjs'\nexport const deeply = r\n")
  return dir
}

let passes = 0
let failures = 0
const check = (name, fn) => {
  try {
    fn()
    passes++
    console.log(`✅ ${name}`)
  } catch (e) {
    failures++
    console.log(`❌ ${name}\n   ${e?.message ?? e}`)
  }
}

const fix = makeFixtureScripts()
try {
  check('闭包 = 入口 + 三跳 + 递归到的那一跳,且不含裸包名', () => {
    const got = [...relativeImportClosure(fix, 'entry.mjs')].sort()
    assert.deepEqual(got, [
      'entry.mjs',
      'lib/deep.mjs',
      'lib/one.mjs',
      'lib/reexported.mjs',
      'side-effect.mjs',
    ])
  })

  check('环形 import 不会把推导器转死(收敛)', () => {
    writeFileSync(join(fix, 'lib/one.mjs'), "import { x } from '../entry.mjs'\n", 'utf8')
    const got = [...relativeImportClosure(fix, 'entry.mjs')]
    assert.ok(got.includes('entry.mjs') && got.includes('lib/one.mjs'))
  })

  check('复制后每一跳都真在位,且 expect 缺项必须抛(不得静默给个跑不起来的夹具)', () => {
    const dst = mkdtempSync(join(tmpdir(), 'closure-dst-'))
    try {
      const copied = copyScriptWithClosure(fix, 'entry.mjs', dst, [
        'lib/face-reader.mjs' /* 故意要一个闭包里没有的 */,
      ])
      throw new Error(`应当抛,却返回了 ${copied.length} 项`)
    } catch (e) {
      assert.match(String(e?.message), /face-reader|ERR_MODULE_NOT_FOUND/, `抛错原因不对:${e?.message}`)
    } finally {
      rmSync(dst, { recursive: true, force: true })
    }
  })

  check('正向对照:expect 只列闭包内该有的项时必须通过', () => {
    const dst = mkdtempSync(join(tmpdir(), 'closure-dst2-'))
    try {
      const copied = copyScriptWithClosure(fix, 'entry.mjs', dst, ['lib/one.mjs', 'side-effect.mjs'])
      assert.equal(copied.length, 5)
      assert.ok(existsSync(join(dst, 'lib', 'deep.mjs')), '递归到的第二跳也必须拷')
    } finally {
      rmSync(dst, { recursive: true, force: true })
    }
  })

  // 装车证明:本仓真门 `check-rn-global-css-sync.mjs` 的闭包里必须有共用层 ——
  // 没有这一条,工具就只是"被写过一次",而它的**存在理由**(迁移后夹具不用手改)无人看守。
  check('装车证明:真门的闭包推导结果含 lib/face-reader.mjs,且被测门真的 import 了本工具', () => {
    const scriptsDir = join(here, '..')
    const closure = [...relativeImportClosure(scriptsDir, 'check-rn-global-css-sync.mjs')]
    assert.ok(closure.includes('lib/face-reader.mjs'), `闭包未含共用层:${closure.join(', ')}`)
    const testSrc = readFileSync(join(here, 'check-rn-global-css-sync.test.mjs'), 'utf8')
    assert.match(testSrc, /scratch-module-closure/, '夹具仍在手抄复制面 ⇒ 本工具没被装上')
  })
} finally {
  rmSync(fix, { recursive: true, force: true })
}

test('scratch-module-closure 自检汇总', () => {
  assert.equal(failures, 0, `${failures} 例失败(${passes} 例通过)`)
})
console.log(`\nscratch-module-closure 自检:${passes + failures} 例,失败 ${failures}`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
