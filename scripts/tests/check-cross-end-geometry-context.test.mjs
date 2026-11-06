// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 128 几何提取 D3 型(2026-11-06)的镜像测试。§22c:判据一律 import 生产出口,本文件零复算。
 *
 * 这一族修的是"**读数被归错维 / 非几何常量被收成档**":
 *   ① `const MAX_SIZE = 10 * 1024 * 1024`(10MB 上传上限)因键名含 size 被收进 widthHeight;
 *   ② `separator: { height: 12 }`(列表分隔线 = 条目间距)因键名含 height 被收进 widthHeight。
 * 每型都必须成对交反向对照:`maxWidth: 320` / `card: { height: 80 }` 这类**合法盒档一格都不许少**
 * —— 否则就不是纠错而是放宽判据(AGENTS §12e:修红不得顺手削判据)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

import { dimOfKey, isUnitScaleProduct, enclosingObjectKeyOf } from '../check-cross-end-ui-parity.mjs'

// ① 字节量乘积:数字之后紧邻 `* 1024` / `* 1000` ⇒ 判"这格不是长度"
test('U1 字节乘积命中:数字后紧跟 * 1024 / * 1000 ⇒ isUnitScaleProduct 为真', () => {
  const code = 'const MAX_SIZE = 10 * 1024 * 1024\n'
  const at = code.indexOf('10') + 2 // 数字字面量**之后**的位置
  assert.equal(isUnitScaleProduct(code, at), true)
  const ms = 'interval: 30 * 1000,\n'
  assert.equal(isUnitScaleProduct(ms, ms.indexOf('30') + 2), true)
})

test('U1r 反向对照:合法盒档不许被认成字节量(否则就是削判据)', () => {
  const code = 'const MAX_SIZE = 10 * 1024 * 1024\n'
  assert.equal(isUnitScaleProduct(code, code.indexOf('10')), false, '位置给在数字**上**不许命中(口径=紧邻其后)')
  assert.equal(isUnitScaleProduct('maxWidth: 320,\n', 'maxWidth: 320,'.indexOf('320') + 3), false)
  assert.equal(isUnitScaleProduct('width: 1024,\n', 'width: 1024,'.indexOf('1024') + 4), false, '1024 作为尺寸本身仍是合法读数')
  assert.equal(isUnitScaleProduct('', 5), false)
})

test('U2 键名含 byte ⇒ 非几何;limit/size 这类合法名不许一起砍掉', () => {
  assert.equal(dimOfKey('previewMaxBytes'), null)
  assert.equal(dimOfKey('maxBytes'), null)
  assert.equal(dimOfKey('maxWidth'), 'widthHeight', 'max-width 是合法长度档(门内既有口径)')
  assert.equal(dimOfKey('iconSize'), 'widthHeight')
})

// ② 分隔线上下文改道:只换维,不丢读数
test('U3 separator 上下文里的 height/width 改道 spacing(条目间距语义)', () => {
  assert.equal(dimOfKey('height', 'separator'), 'spacing')
  assert.equal(dimOfKey('height', 'itemSeparator'), 'spacing')
  assert.equal(dimOfKey('height', 'listSeparator'), 'spacing')
})

test('U3r 反向对照:同一键名在不同上下文必须回原维 —— 不许按键名一刀切', () => {
  assert.equal(dimOfKey('height', 'card'), 'widthHeight')
  assert.equal(dimOfKey('height', null), 'widthHeight', '没有上下文 ⇒ 按无上下文判,不猜')
  assert.equal(dimOfKey('height', undefined), 'widthHeight')
})

test('U4 外层对象键名解析:取该位置所在对象字面量的键,引号键与顶层都按实处理', () => {
  const styles = 'const s = StyleSheet.create({\n  separator: { height: 12 },\n  card: { height: 80 },\n})\n'
  const sepAt = styles.indexOf('12')
  const cardAt = styles.indexOf('80')
  assert.equal(enclosingObjectKeyOf(styles, sepAt), 'separator')
  assert.equal(enclosingObjectKeyOf(styles, cardAt), 'card')
  assert.equal(enclosingObjectKeyOf('const x = 5\n', 9), null, '模块顶层没有对象字面量 ⇒ null,不编一个键名出来')
})

test('U5 接线形状锁:新规则必须挂在取数热路径上(判据在、没人调 = 没有,§0.9)', () => {
  const src = readFileSync(resolve(HERE, '../check-cross-end-ui-parity.mjs'), 'utf8').replace(/\s+/g, ' ')
  const at = src.indexOf('export function readGeometry(')
  assert.ok(at >= 0, 'readGeometry 不在了')
  const body = src.slice(at, at + 2600)
  // 三处调用缺一不可:字节乘积剔除、外层键取用、把上下文喂给 dimOfKey
  for (const anchor of ['isUnitScaleProduct(code,', 'enclosingObjectKeyOf(code,'])
    assert.ok(body.includes(anchor), `readGeometry 里缺 ${anchor} ⇒ 新判据是死码`)
  assert.ok(/dimOfKey\([^)]*enclosingObjectKeyOf/.test(body), 'dimOfKey 没收到外层键 ⇒ separator 改道不会生效')
  // 反向锁:不许把"命中即整维清空"当成修法(改道是换维,不是丢读数)
  assert.ok(!/dims\.widthHeight = \[\]/.test(body), '清空整维 = 削判据')
})

test('U5r 端到端(真仓两个实例文件,走门自己的 --json):10 与 12 不再冒充宽高', async () => {
  // readGeometry 的 tiers 参数由门内部装配(specTiers/GEO_TIERS),单测里不复制那份装配 ——
  // 所以这一格改跑**门本体一次**(约 1 分钟),用它自己的输出口径验真效应(§22c 零复算)。
  const out = execFileSync(
    process.execPath,
    [resolve(HERE, '../check-cross-end-ui-parity.mjs'), '--json'],
    {
      cwd: resolve(HERE, '..', '..'),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 8 * 60 * 1000,
    },
  )
  const j = JSON.parse(out.slice(out.indexOf('{')))
  const detail = j?.webRn?.detail ?? []
  const pick = (name) => detail.find((f) => f.name === name)
  const pdfMerge = pick('tools/pdf/merge') || pick('tools/pdf/split')
  if (pdfMerge) {
    const wh = pdfMerge.dims?.widthHeight
    if (wh && wh.status === 'diff')
      assert.ok(!(wh.rnOnly ?? []).includes(10), `RN 侧 widthHeight 仍含着字节上限 10:${JSON.stringify(wh)}`)
  }
  const act = pick('settings/activity')
  if (act) {
    const wh = act.dims?.widthHeight
    if (wh && wh.status === 'diff')
      assert.ok(!(wh.rnOnly ?? []).includes(12), '列表分隔线 12 不许再算成宽高(该值改道去间距维)')
  }
  // 阳性对照:五维仍然有读数(不是整轴被判空 = 判据被削平)
  assert.ok(detail.length > 0, 'webRn.detail 为空 ⇒ 这一轴整条瞎了,不是修好了')
  const judgedDims = detail.reduce((s, f) => s + (f.judgedDims || 0), 0)
  assert.ok(judgedDims > 100, `可判维总数只剩 ${judgedDims},不足以说明还在量东西`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
