// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-plan-fields.mjs` 的镜像测试(§22c):判据一律 import 生产出口 `__test__` /
 * 具名导出,本文件**零复算** —— 不在这里重写"什么算 A1/A2/A3/孤儿"。
 *
 * 承重五条:
 *  ① 导入不走 main(模块顶层的 isDirectRun 守卫真的在);
 *  ② 投影 `render → parse → render` 幂等、`parse(render(x))` 逐字段相等(含超 48 字、owner 自带 `｜`);
 *  ③ 字段与散文矛盾**只在散文本人表过态**时为真,`actionable` 兜底值等于"没说";
 *  ④ 孤儿记录(侧车找不到对应行)只报数、不判红(规格 §1);
 *  ⑤ A1/A2/A3 的阳性对照仍能红 —— 差值棘轮有牙。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G, judge, verdict } from '../check-plan-fields.mjs'
import { __test__ as H } from '../lib/plan-field-line.mjs'
import { compositeKeyOf, dispositionOfV2 } from '../lib/plan-task-index.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mk = (raw, line = 1) => ({ line, state: 'open', raw })
const REC = {
  key: compositeKeyOf('- [ ] G-1 甲 细节'),
  owner: '门 130 持有人',
  waiting: 'none',
  updatedAt: '2026-10-22T00:00:00.000Z',
}

describe('check-plan-fields 可导入且导入不走 main', () => {
  it('import 只拿到判据出口,不执行判定/不自检、不打印', () => {
    const r = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', "import('./scripts/check-plan-fields.mjs')"],
      { cwd: ROOT, encoding: 'utf8' },
    )
    assert.equal(r.status, 0, r.stderr)
    assert.equal(r.stdout, '', '导入就必须静默:任何打印都说明 main 被 isDirectRun 放行了')
  })

  it('判据确实以 __test__ 导出(同一引用,不是第二份实现)', () => {
    assert.equal(G.judge, judge)
    assert.equal(G.verdict, verdict)
  })
})

describe('标头投影:render → parse → render 幂等、逐字段相等', () => {
  it('等环境记录的每一字段都能原样读回', () => {
    const x = { owner: '门 130 持有人', waiting: 'env', blocking: '容器运行时' }
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    const p = H.parseHeader('- [ ] ' + header + ' 标题某件活')
    assert.equal(p.malformed, false)
    assert.deepEqual(p.rec, { key: null, ...x })
    assert.equal(H.renderHeader(p.rec), header, 'render∘parse∘render 必须回到同一串')
  })

  it('waiting=none 的记录不带空等段,读回仍是 waiting=none', () => {
    const x = { owner: '甲', waiting: 'none', blocking: '' }
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    assert.equal(header, '〔归:甲〕')
    assert.deepEqual(H.parseHeader('- [ ] ' + header + ' 标题').rec, { key: null, ...x })
  })

  it('owner 自带 `｜` 也逐字段往返(分隔符只在后一段像槽名时才切)', () => {
    const x = { owner: 'A｜B', waiting: 'env', blocking: '容器运行时' }
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    const p = H.parseHeader('- [ ] ' + header + ' 标题')
    assert.equal(p.malformed, false)
    assert.deepEqual(p.rec, { key: null, ...x })
    assert.equal(H.renderHeader(p.rec), header)
  })

  it('未知槽名仍判 malformed(补 `｜` 不得把语法校验放宽掉)', () => {
    assert.equal(H.parseHeader('- [ ] 〔归:甲｜神秘:乙〕 标题').malformed, true)
  })

  it('超 48 字的 owner 完整渲染且可往返(投影无损,不截断加 `…`)', () => {
    const owner = '门'.repeat(60)
    const x = { owner, waiting: 'none', blocking: '' }
    assert.ok(owner.length > H.MAX)
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    assert.ok(!header.includes('…'))
    assert.ok(header.length > H.MAX)
    assert.deepEqual(H.parseHeader('- [ ] ' + header + ' 标题').rec, { key: null, ...x })
  })
})

describe('字段与散文矛盾:只有散文自己表了态才算 conflict', () => {
  const mkFields = (key, rec) => ({ map: new Map(rec ? [[key, rec]] : []), undetermined: false })

  it('散文回落 actionable(= 没说)+ 侧车补上等待 ⇒ 不是矛盾(正常迁移不得被喊成冲突)', () => {
    const line = '- [ ] G-9 跨端头像尺寸唯一表 —— 细节'
    const key = compositeKeyOf(line)
    const d = dispositionOfV2({
      line,
      fields: mkFields(key, { key, owner: '', waiting: 'human', blocking: '产品拍板' }),
    })
    assert.equal(d.bucket, 'waiting-human')
    assert.equal(d.source, 'fields')
    assert.equal(d.conflict, false)
  })

  it('散文自己判了"归他人"、侧车说"可做" ⇒ conflict=true,且以侧车为准', () => {
    const line = '- [ ] G-9 跨端头像尺寸唯一表 —— 归属:门 130 持有人'
    const key = compositeKeyOf(line)
    const d = dispositionOfV2({
      line,
      fields: mkFields(key, { key, owner: '', waiting: 'none' }),
    })
    assert.equal(d.bucket, 'actionable')
    assert.equal(d.conflict, true)
  })
})

describe('守门判定:差值维有牙、孤儿只报数', () => {
  it('A1 阳性对照:新行无租约无侧车 ⇒ 红并点名', () => {
    const v = judge([mk('- [ ] G-2 乙 细节')], { baseRowTexts: new Set(), map: new Map() })
    assert.equal(v.a1, 1)
    assert.equal(verdict(v, 'staged').code, 1)
  })

  it('A2 必须逐字相等:正文里包含同一串,不得把行内错标头蒙过去', () => {
    const want = H.renderHeader(REC)
    const title = '- [ ] 〔归:另一个人〕 G-1 甲 细节'
    const line = `${title} —— 备注里写了 ${want}`
    const key = compositeKeyOf(line)
    const v = judge([mk(line)], { map: new Map([[key, { ...REC, key }]]) })
    assert.equal(v.a2, 1)
    assert.equal(verdict(v, 'staged').code, 1)
  })

  it('A3 阳性对照:同键两条投影读数互斥且基准面没有 ⇒ 红', () => {
    const other = { ...REC, owner: '另一个人', updatedAt: '2026-10-23T00:00:00.000Z' }
    const v = judge([], { allRecords: [REC, other], baseSideSignatures: new Set() })
    assert.equal(v.a3, 1)
    assert.equal(verdict(v, 'staged').code, 1)
  })

  it('孤儿记录:侧车有、台账找不到对应行 ⇒ 只报 orphan,exit 0', () => {
    const orphan = { ...REC, key: 'G-999#台账里已经没有这一行' }
    const v = judge([mk('- [ ] G-1 甲 细节')], { map: new Map(), allRecords: [orphan] })
    assert.equal(v.orphan, 1)
    const r = verdict(v, 'head')
    assert.match(r.line, /orphan=1/)
    assert.equal(r.code, 0, '孤儿是已知形态,不得判红(规格 §1)')
  })

  it('记录有对应行 ⇒ 不算孤儿', () => {
    const v = judge([mk('- [ ] G-1 甲 细节')], {
      map: new Map([[REC.key, REC]]),
      allRecords: [REC],
    })
    assert.equal(v.orphan, 0)
  })

  it('全量档没有基准面 ⇒ A1/A3 报 NA,存量只 warn', () => {
    const v = judge([mk('- [ ] G-2 乙 细节')], { map: new Map() })
    const r = verdict(v, 'head')
    assert.equal(v.hasBase, false)
    assert.match(r.line, /a1=NA/)
    assert.equal(r.state, 'warn')
    assert.equal(r.code, 0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
