// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 98 回归:名单里的行内 `//` 注释不得吞掉它后面紧跟的转出条目。
 *
 * 事故形态(2026-10-31 实测,生产误报):
 *   apps/miniapp-taro/src/api/index.ts:131
 *     `  ExamQuestion, // 共享类型(从 api-client 下沉, 直接 re-export)`
 *   注释正文里的英文逗号让 listNames 的 split(',') 把"注释尾巴 + 第 132 行 `Banner,`"
 *   粘成一个条目,再被标识符正则整条过滤 ⇒ `Banner` 从 names 里消失 ⇒ D1 假红
 *   「目标文件未导出 Banner;该符号在 HEAD 上根本不存在」(HEAD 上它就在这块 transfer 里)。
 *
 * §22c:判据只从源模块取,测试不复制 listNames / 正则 / 名单清洗的任何一份实现。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as GATE_KIT } from '../check-dangling-local-imports.mjs'

const { parseExports } = GATE_KIT
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// 与事故同形:行内注释正文里带英文逗号,且下一条目紧接在下一行。
const FIXTURE = [
  'export type {',
  '  LlmModel,',
  '  ExamQuestion, // 共享类型(从 api-client 下沉, 直接 re-export)',
  '  Banner,',
  '  Teacher,',
  "} from './types'",
].join('\n')

test('① 正面:行内注释带逗号时,注释行自身与下一行条目都必须认出', () => {
  const { names, opaque } = parseExports(FIXTURE)
  assert.equal(opaque, false, '这是具名转出块,不是 export *')
  assert.ok(names.has('ExamQuestion'), '注释所在行自身的条目不得丢')
  assert.ok(names.has('Banner'), '注释下一行的条目必须被认出(本次事故的误报源)')
  assert.ok(names.has('Teacher'), '更靠后的条目同样不得受影响')
  assert.ok(names.has('LlmModel'), '块首条目同样不得受影响')
})

test('② 反例:把 Banner 那一行删掉后必须不认(防修成恒真)', () => {
  const without = FIXTURE.replace('\n  Banner,', '')
  assert.equal(without.includes('Banner'), false, '反例夹具里不得再出现该符号')
  const { names } = parseExports(without)
  assert.equal(names.has('Banner'), false, '不存在的符号绝不能被认成导出')
  assert.ok(names.has('Teacher') && names.has('LlmModel'), '反例夹具本身仍须被正常解析')
})

test('③ 定点:apps/miniapp-taro/src/api/index.ts 的 Banner 转出必须被认出', () => {
  const text = readFileSync(join(ROOT, 'apps/miniapp-taro/src/api/index.ts'), 'utf8')
  const { names, opaque } = parseExports(text)
  assert.equal(opaque, false, '该文件没有 export *,具名导出必须逐条可枚')
  assert.ok(names.has('Banner'), 'HEAD 上以 export type { … Banner … } from 逐字转出')
})

test('④ 不是放宽:注释正文里出现的符号不得被当成导出', () => {
  const src = ["export type {", '  Real, // Ghost, Phantom', '  Tail,', "} from './t'"].join('\n')
  const { names } = parseExports(src)
  assert.ok(names.has('Real') && names.has('Tail'), '真实条目必须仍在')
  assert.equal(names.has('Ghost'), false, '剥注释后注释里的符号必须一并消失')
  assert.equal(names.has('Phantom'), false, '同上')
})

test('⑤ 整行注释夹在名单中间同样不得吞条目', () => {
  const src = ['export {', '  A,', '  // 分组说明, 含逗号', '  B,', "} from './m'"].join('\n')
  const { names } = parseExports(src)
  assert.ok(names.has('A') && names.has('B'), '整行注释前后两条都必须认出')
  assert.equal(names.has('分组说明'), false, '注释正文不得成为导出名')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
