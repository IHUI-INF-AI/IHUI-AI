#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-format-support-parity.test.mjs — 镜像测试(§22c:判据 import 源脚本 __test__,本文件零复制)
 * 数据夹具是本文件的职责;判据(正则/桶/裁决)一律用生产实现。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as P } from '../check-format-support-parity.mjs'

const REG = `const EXT_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  zip: ['application/zip'],
  txt: ['text/plain'],
}`

test('R 面登记解析走生产实现,十面登记表形状锁(1 基准 + 6 文档面 + 3 媒体面)', () => {
  const r = P.parseRegistryMap(REG)
  assert.deepEqual(r.exts.sort(), ['pdf', 'txt', 'zip'])
  assert.equal(r.mimeToExt.get('application/pdf'), 'pdf')
  assert.equal(P.FACES[0].role, 'registry')
  const impl = P.FACES.filter((f) => f.role !== 'registry')
  assert.equal(impl.length, 9, '实现面应 9(6 文档 + 3 媒体)')
  assert.equal(impl.filter((f) => f.family === 'doc').length, 6)
  assert.equal(impl.filter((f) => f.family === 'media').length, 3)
  for (const f of P.FACES) assert.ok(f.key && f.file && f.family, `面缺字段:${f.key}`)
  assert.equal(new Set(P.FACES.map((f) => f.key)).size, P.FACES.length, '面 key 不得重复')
})

test('档族由 R 面首个 MIME 的 major 现推(不在脚本另立第二张族表,§0.6)', () => {
  assert.equal(P.familyOfExt('image'), 'media')
  assert.equal(P.familyOfExt('video'), 'media')
  assert.equal(P.familyOfExt('audio'), 'media')
  assert.equal(P.familyOfExt('application'), 'doc')
  assert.equal(P.familyOfExt('text'), 'doc')
  assert.equal(P.familyOfExt(''), 'unknown', 'major 取不到不猜')
  const r = P.parseRegistryMap(`const EXT_MIME_MAP: Record<string, string[]> = {
  png: ['image/png'],
  pdf: ['application/pdf'],
}`)
  assert.equal(r.majorByExt.get('png'), 'image')
  assert.equal(r.majorByExt.get('pdf'), 'application')
})

test('媒体族三面解析器各判各形(V=Python 字典 / B=点前缀数组 / W=无点数组)', () => {
  assert.deepEqual(
    P.parsePyExtensions(
      `_EXT_TO_MIME: dict[str, str] = {\n    ".png": "image/png",\n    ".bmp": "image/bmp",\n}`,
      '_EXT_TO_MIME',
    ).exts,
    ['png', 'bmp'],
  )
  assert.deepEqual(
    P.parseExtStringArray(`const AUDIO_ALLOWED_EXTS = ['.wav', '.mp3']`, 'AUDIO_ALLOWED_EXTS').exts,
    ['wav', 'mp3'],
  )
  assert.deepEqual(
    P.parseExtStringArray(
      `const GALLERY_VIDEO_EXTENSIONS: readonly string[] = ['mp4', 'webm', 'mov']`,
      'GALLERY_VIDEO_EXTENSIONS',
    ).exts,
    ['mp4', 'webm', 'mov'],
  )
  const gone = P.parseExtStringArray(`const 别的 = 1`, 'AUDIO_ALLOWED_EXTS')
  assert.deepEqual(gone.exts, [])
  assert.equal(gone.unparseable?.length, 1, '解析不出必须点名,不得静默 0')
})

test('②按族判:同族面接住进①,零命中档留②且逐档写明原因', () => {
  const reg = P.parseRegistryMap(`const EXT_MIME_MAP: Record<string, string[]> = {
  png: ['image/png'],
  pdf: ['application/pdf'],
  zip: ['application/zip'],
}`)
  const fam = new Map(reg.exts.map((e) => [e, P.familyOfExt(reg.majorByExt.get(e) ?? '')]))
  const b = P.buildBuckets(
    reg.exts,
    [
      { key: 'M', family: 'doc', present: true, exts: new Set(['pdf']) },
      { key: 'V', family: 'media', present: true, exts: new Set(['png']) },
    ],
    fam,
  )
  assert.deepEqual(b.aligned, ['pdf', 'png'])
  assert.deepEqual(b.hollow, ['zip'])
  assert.match(b.hollowReasons.zip, /族=doc.*零命中/)
  assert.equal(P.verdict(b, 3, { staleWaivers: [] }).state, 'drift', '留②不得记绿')
})

test('②按族判反向牙:异族命中不算接住(防尺子被异族面洗绿)', () => {
  const reg = P.parseRegistryMap(
    `const EXT_MIME_MAP: Record<string, string[]> = {\n  webm: ['video/webm'],\n}`,
  )
  const b = P.buildBuckets(
    reg.exts,
    [{ key: 'M', family: 'doc', present: true, exts: new Set(['webm']) }],
    new Map([['webm', 'media']]),
  )
  assert.deepEqual(b.aligned, [], '异族命中被算进了①')
  assert.match(b.hollowReasons.webm, /只被异族面 M\(doc\)/, '②留档原因没点名异族面')
})

test('未传 familyOf ⇒ 并族判定(老语义向后兼容,本文件既有老夹具不破)', () => {
  const b = P.buildBuckets(
    ['png'],
    [
      { key: 'A', present: true, exts: new Set(['png']) },
      { key: 'V', family: 'media', present: true, exts: new Set(['bmp']) },
    ],
  )
  assert.deepEqual(b.aligned, ['png'])
  assert.deepEqual(b.hollow, [])
})

test('③具名豁免:owner/reason(≥10字)/expires 三键齐备+未到期+本次仍命中才生效', () => {
  const ok = {
    ext: 'html',
    owner: 'apps/api 上传白名单',
    reason: '后端按 XSS 故意不收 html,属安全设计而非漂移',
    expires: '2099-01-01',
  }
  const w = P.applyWaivers(['html', 'md'], [ok], '2026-11-04')
  assert.deepEqual(w.unregistered, ['md'])
  assert.deepEqual(
    w.waived.map((x) => x.ext),
    ['html'],
  )
  assert.deepEqual(w.staleWaivers, [])
  assert.deepEqual(P.applyWaivers(['html'], [{ ...ok, reason: '太短' }], '2026-11-04').waived, [])
  assert.deepEqual(
    P.applyWaivers(['html'], [{ ...ok, expires: '2020-01-01' }], '2026-11-04').waived,
    [],
    '豁免到期仍生效 ⇒ 违背「会到期」',
  )
  assert.deepEqual(P.applyWaivers(['html'], [{ ...ok, owner: '' }], '2026-11-04').waived, [])
  assert.deepEqual(
    P.applyWaivers(['html'], null, '2026-11-04').unregistered,
    ['html'],
    '台账取不到不得多放一次跳门',
  )
  const rotten = P.applyWaivers(['md'], [ok], '2026-11-04')
  assert.deepEqual(rotten.staleWaivers, ['html'], '登了却不再命中应报清单腐烂')
  const v = P.verdict(
    { facesBroken: [], hollow: [], hollowReasons: {}, unregistered: [] },
    5,
    rotten,
  )
  assert.equal(v.state, 'drift', '清单腐烂判 drift 不判绿')
  assert.equal(v.exit, P.EXIT.drift)
})

test('空头必须被 buildBuckets 判进②桶(反向锁的根)', () => {
  const reg = P.parseRegistryMap(REG)
  const b = P.buildBuckets(reg.exts, [{ key: 'A', present: true, exts: new Set(['pdf', 'txt']) }])
  assert.deepEqual(b.hollow, ['zip'])
  assert.equal(b.facesBroken.length, 0)
  const v = P.verdict(b, reg.exts.length)
  assert.equal(v.state, 'drift')
  assert.equal(v.exit, P.EXIT.drift)
})

test('面取不到/枚举 0 候选 ⇒ unjudged 顶红,绝不并桶成 drift 或 ok', () => {
  const vb = P.buildBuckets(['pdf'], [{ key: 'M', present: false, exts: [], reason: '读不到' }])
  const v1 = P.verdict(vb, 1)
  assert.equal(v1.state, 'unjudged')
  assert.equal(v1.exit, P.EXIT.unjudged)
  const ve = P.buildBuckets(['pdf'], [{ key: 'M', present: true, exts: new Set() }])
  assert.equal(P.verdict(ve, 1).state, 'unjudged')
})

test('纯排版差异不改判:换序/注释/缩进后的 R 面扩展名集逐字节等值', () => {
  const a = P.parseRegistryMap(REG)
  const b = P.parseRegistryMap(`const EXT_MIME_MAP: Record<string, string[]> = {
  // 注释、换序、别种引号
  txt: ["text/plain"],
  zip: ['application/zip'],
  pdf: ['application/pdf'],
}`)
  assert.deepEqual([...a.exts].sort(), [...b.exts].sort())
})

test('面旗纪律:--staged 被点名拒绝(本尺不进提交链),默认 head', () => {
  assert.ok(P.resolveFace(['--staged']).error.includes('提交链'))
  assert.ok(P.resolveFace(['--staged', '--worktree']).error)
  assert.equal(P.resolveFace([]).face, 'head')
  assert.equal(P.resolveFace(['--worktree']).face, 'worktree')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
