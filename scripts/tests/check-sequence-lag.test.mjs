// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 序列落后对账门的镜像测试(§22c:判据从源文件 export 出来直接用,禁止在测试里再抄一份)。
 *
 * 为什么要有形状锁:本门落地首跑就是靠"覆盖面自证"抓到自己漏扫(108/228),
 * 而漏扫的表现是**报"无落后"**——只测判据函数永远发现不了枚举面被收窄。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-sequence-lag.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, '..', 'check-sequence-lag.mjs'), 'utf8')
const PKG = readFileSync(join(HERE, '..', '..', 'package.json'), 'utf8')

test('S1 落后判定:next <= max 即红(实例数字取自 2026-09-27 真实事故)', () => {
  const d = gate.decide({ sequence: 's', maxId: 23, lastValue: 5, isCalled: true })
  assert.equal(d.kind, 'lagging')
  assert.equal(d.target, '23')
})

test('S2 正常判定:已领先不得判红', () => {
  assert.equal(gate.decide({ sequence: 's', maxId: 23, lastValue: 23, isCalled: true }).kind, 'ok')
})

test('S3 is_called=false 的边界:new 序列遇已有行仍算落后', () => {
  // 真实现场:zhs_knowledge_doc last=1 is_called=false 而表内已有 7 行
  assert.equal(gate.decide({ sequence: 's', maxId: 1, lastValue: 1, isCalled: false }).kind, 'lagging')
})

test('S4 空表不判、不得当"已核对"的绿灯', () => {
  const d = gate.decide({ sequence: 's', maxId: 0, lastValue: 7, isCalled: true })
  assert.equal(d.kind, 'empty')
})

test('S5 取不到序列=未判定,不记通过', () => {
  assert.equal(gate.decide({ sequence: null, maxId: 9, lastValue: 1, isCalled: false }).kind, 'undetermined')
})

test('S6 反向锁:领先的一档绝不产出 setval 目标(禁止回拨)', () => {
  const d = gate.decide({ sequence: 's', maxId: 5, lastValue: 99, isCalled: true })
  assert.equal(d.kind, 'ok')
  assert.ok(!('target' in d), '领先却给出修复目标 = 会把序列往回拨,等于自己制造撞键')
})

test('S7 覆盖面自证必须在输出里(枚举面被悄悄收窄时不得报"无落后")', () => {
  assert.match(SRC, /权威候选/, '报告里必须把"扫了几张 vs 候选几张"并排打出来')
  assert.match(SRC, /覆盖面不闭合/, '两者不等时必须大声,而不是静默给绿灯')
  assert.match(SRC, /if \(coverageBad && args\.strict\) return 2/, '--strict 下覆盖面不闭合必须判死')
})

test('S8 不得使用 sql.raw(require 出来的实例上没有,会当场 TypeError)', () => {
  assert.ok(!/sql\.raw\(/.test(SRC.replace(/不参数化[\s\S]{0,40}?sql\.raw/g, '')), '本门依赖 sql.raw 会在运行时炸')
})

test('S9 枚举必须把"有序列"下推到 SQL,不得在 JS 里先去重再查序列', () => {
  // 落地首跑的漏面写法:SQL 不过滤序列 + JS 按表去重 ⇒ "第一个 int 列无序列"的表整张被跳过
  const enumBlock = SRC.slice(SRC.indexOf('const rows = await sql`'), SRC.indexOf('const expectedTables'))
  assert.match(enumBlock, /pg_get_serial_sequence\([\s\S]*?\) is not null/, '枚举面必须自带序列过滤')
  assert.ok(enumBlock.indexOf('is not null') < enumBlock.indexOf('order by'), '序列过滤要在枚举阶段生效')
})

test('S10 手动问责入口在位(本门刻意不进提交链:一次全库扫描约 40s)', () => {
  const pkg = JSON.parse(PKG)
  assert.ok(pkg.scripts['check:sequence-lag'], '缺 pnpm check:sequence-lag')
  assert.ok(pkg.scripts['check:sequence-lag:fix'], '缺修复入口')
  assert.ok(
    !pkg.scripts['check:sequence-lag'].includes('--fix'),
    '默认档必须只读 —— 带 --fix 的问责入口会在巡检时改库',
  )
})

test('S11 无 DSN / 无驱动时必须"无法判定"并优先于判红,且不得记为通过', () => {
  assert.match(SRC, /取不到 DATABASE_URL[\s\S]{0,60}不记为通过/)
  assert.match(SRC, /return 2/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
