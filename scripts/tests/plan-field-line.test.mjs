// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/plan-field-line.mjs` 的镜像测试(§22c:一律 import 源脚本,零复算)。
 *
 * 标头是侧车的**投影**,不是第二份真相。所以要钉的是三件事:
 *  ① 形态是契约(分隔符与顺序变了,门与所有已渲染行一起漂);
 *  ② 渲染必须**无损**(2026-10-25 改判,`f9c1514b30`):投影写出的每一行都要能被 parse 读回同一份
 *     语义(幂等)。旧实现按 `MAX` 截断并追加 `…`,而 parse 对 `…` 一律判 malformed —— 两者叠加
 *     = 任何 owner 逼近上限的记录投影进台账后**永久** malformed(门 234 A2 恒红,实测 G-47/G-71),
 *     故 `MAX` 现在只用于诊断文案 clip,不再参与渲染;
 *  ③ 面上**已存在**的 `…` 截断形态(历史遗留或手写)仍如实报"读不回"、不猜被截掉的字符 ——
 *     权威在侧车,但"给人看的那一眼"也不许假装无损。
 * 另两条防误伤:反引号内的标头形态是叙述不算数;stripHeader 只许剥自己那一段。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as H } from '../lib/plan-field-line.mjs'

const R = (over = {}) => ({
  key: 'G-9#x',
  owner: '门 130 持有人',
  waiting: 'env',
  blocking: '容器运行时',
  ...over,
})

describe('plan-field-line 投影层', () => {
  it('渲染形态逐字固定(分隔符与顺序是契约,不是风格)', () => {
    assert.equal(H.renderHeader(R({})), '〔归:门 130 持有人｜等:容器运行时〕')
  })

  it('waiting=none ⇒ 只印归属,不留空槽', () => {
    assert.equal(H.renderHeader(R({ waiting: 'none', blocking: '' })), '〔归:门 130 持有人〕')
  })

  it('owner 缺失 ⇒ 印占位符,不省略整段(省了就和"没有标头"分不清)', () => {
    assert.equal(H.renderHeader(R({ owner: undefined, waiting: 'none', blocking: '' })), '〔归:—〕')
  })

  it('长 owner 也必须完整渲染且可往返(投影无损;截断会造出永久 malformed 的台账行)', () => {
    // 反向牙:旧断言钉的是"超预算 ⇒ 截断显示",那是 `c362cda2d8` 的口径,已被 `f9c1514b30`
    // (2026-10-25)改判为**不得截断** —— 截断写出的 `…` 会被 parseHeader 一律判 malformed,
    // 于是投影器物每轮都产出门 234 A2 永久红的行。这里钉的是"任何长度都无损"。
    const long = 'x'.repeat(200)
    const h = H.renderHeader(R({ owner: long }))
    assert.ok(!h.includes('…'), '渲染不得用省略号截断(parse 对 … 一律 malformed)')
    assert.ok([...h].length > H.MAX, `标头被诊断档 MAX=${H.MAX} 顶住了,说明又在截断`)
    const p = H.parseHeader('- [ ] ' + h + ' 标题')
    assert.equal(p.malformed, false, '无损投影不该读不回')
    assert.equal(p.rec.owner, long)
    assert.equal(H.renderHeader(p.rec), h, 'render∘parse∘render 逐字相同')

    // 现实形态(ASCII 段混排 + 等段)同样必须无损往返
    const real = '端口注册表门 + ai-service ruff + 受保护检查 lint-typecheck-test 持有人'
    const hr = H.renderHeader(R({ owner: real }))
    const pr = H.parseHeader('- [ ] ' + hr + ' 标题')
    assert.equal(pr.malformed, false)
    assert.equal(pr.rec.owner, real)
    assert.equal(pr.rec.blocking, '容器运行时')
  })

  it('手写/历史遗留的 … 截断标头仍如实报"读不回"(不猜被截掉的字符)', () => {
    const p = H.parseHeader('- [ ] 〔归:甲…〕 标题')
    assert.equal(p.malformed, true)
    assert.equal(p.rec, null)
  })

  it('render∘parse∘render 幂等(投影已无"截断"分支,短 owner 也照旧逐字回得来)', () => {
    const once = H.renderHeader(R({}))
    const p = H.parseHeader('- [ ] ' + once + ' 标题某件活')
    assert.equal(p.malformed, false)
    assert.equal(p.rec.owner, '门 130 持有人')
    assert.equal(p.rec.waiting, 'env')
    assert.equal(H.renderHeader(p.rec), once)
  })

  it('parse(render(x)) 逐字段相等(不是只看 owner 有没有对上)', () => {
    const x = { owner: '门 130 持有人', waiting: 'env', blocking: '容器运行时' }
    const p = H.parseHeader('- [ ] ' + H.renderHeader({ key: 'G-9#x', ...x }) + ' 标题')
    assert.deepEqual(p.rec, { key: null, ...x })
  })

  it('owner 自带 `｜` 也逐字段往返(分隔符只在后一段像槽名时才切)', () => {
    const x = { owner: 'A｜B', waiting: 'none', blocking: '' }
    const p = H.parseHeader('- [ ] ' + H.renderHeader({ key: 'G-9#x', ...x }) + ' 标题')
    assert.equal(p.malformed, false)
    assert.deepEqual(p.rec, { key: null, ...x })
  })

  it('只有归段没有等段 ⇒ 读回 waiting=none(不是"未知",那会把它算成等待)', () => {
    const p = H.parseHeader('- [ ] 〔归:甲〕 标题')
    assert.equal(p.rec.waiting, 'none')
    assert.equal(p.rec.blocking, '')
  })

  it('非登记行与反引号内的标头形态一律不认(叙述不算牌)', () => {
    assert.equal(H.parseHeader('散文里写 〔归:甲〕').rec, null)
    assert.equal(H.parseHeader('- [ ] 上游文档写 `〔归:甲〕` 是举例').rec, null)
  })

  it('未知槽名 ⇒ malformed(以后加字段要显式改这里,不能被静默吞掉)', () => {
    const p = H.parseHeader('- [ ] 〔归:甲｜神秘:乙〕 标题')
    assert.equal(p.malformed, true)
    assert.equal(p.rec, null)
  })

  it('stripHeader 只剥自己那一段,正文与其它括号一字不动', () => {
    assert.equal(
      H.stripHeader('- [ ] 〔归:甲｜等:乙〕 真标题〔注记不动〕'),
      '- [ ] 真标题〔注记不动〕',
    )
    assert.equal(H.stripHeader('- [ ] 普通行'), '- [ ] 普通行')
  })

  it('2026-10-25 同尺:票号/租约在标头前 ⇒ strip 剥得出且 parse 认得出(两把尺各写一份位置约束必漂,实测门 234 A2 误判 L28655)', () => {
    const lease = '- [ ]（进行中@2026-10-25/z） 〔归:机主定级面〕 G-21 题'
    assert.equal(H.stripHeader(lease), '- [ ]（进行中@2026-10-25/z） G-21 题')
    const p = H.parseHeader(lease)
    assert.equal(p.malformed, false)
    assert.equal(p.rec.owner, '机主定级面')
    const ticket = '- [ ]G-11〔归:web 在飞席〕队列拒因'
    assert.equal(H.stripHeader(ticket), '- [ ]G-11队列拒因')
    assert.equal(H.parseHeader(ticket).rec.owner, 'web 在飞席')
  })

  it('locateSidecarHeader 给出精确 span;反引号内与非归段 ⇒ null(strip/parse/门的 headerOf 同一把尺)', () => {
    const line = '- [ ]（进行中@…/z） 〔归:甲｜等:乙〕 正文'
    const span = H.locateSidecarHeader(line)
    assert.equal(line.slice(span.start, span.end), '〔归:甲｜等:乙〕')
    // span 必须指向行内真实的那一段(租约挡在前,标头不在复选框紧邻处)
    assert.ok(span.start > line.indexOf('）'))
    assert.equal(line.slice(0, span.start).includes('〔'), false)
    assert.equal(H.locateSidecarHeader('- [ ] 上游文档写 `〔归:甲〕` 是举例'), null)
    assert.equal(H.locateSidecarHeader('- [ ] 〔旧号〕正文'), null)
    assert.equal(H.locateSidecarHeader('正文 〔归:甲〕'), null)
  })

  it('码段内与非归段先行时 parse 不得认标头(防误伤,与 strip 同判)', () => {
    assert.equal(H.parseHeader('散文里写 〔归:甲〕').rec, null)
    assert.equal(H.parseHeader('- [ ] 上游文档写 `〔归:甲〕` 是举例').rec, null)
  })

  it('roundTripOk 对无标头行返回 true(不是"失败"),对损坏标头返回 false', () => {
    assert.equal(H.roundTripOk('- [ ] 无标头的行'), true)
    assert.equal(H.roundTripOk('- [ ] 〔归:甲｜神秘:乙〕 标题'), false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
