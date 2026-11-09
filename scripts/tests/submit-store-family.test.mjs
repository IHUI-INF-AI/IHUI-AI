// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:submit-store 一族 + 凭据矩阵的行为锁(全离线,零真实出网,零写盘)
//
// 判据一律 import 各源脚本的 `__test__`(§22c:禁止在测试里复制一份判据)。
// 本文件负责的是**跨脚本不变量** —— 单脚本自己那 13-15 格管不到、而这一族最可能各自漂移的六件事:
//   ① 每家未核实的端点段必须结构上零调用(不产假 URL)
//   ② env 形态的凭据出口永不回显秘密原文(§5d)
//   ③ 退出码折叠语义在七件套里同一条(未判定 2 > 缺件 1 > 全绿 0,§0.3)
//   ④ 矩阵里没有任何一家被报成 ready;manualOnly 收窄后(APKPure 邮件腿已机器直发)其余仍带 why
//   ⑤ 法定前置闸门(备案/软著)在国内店上一律挂 blockedBy
//   ⑥ 端点形态回 probe-store-channel.CHANNELS 单源,上传器不自建第二份 URL(§0.6)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as CORE } from '../lib/store-uploader-core.mjs'
import { __test__ as XI } from '../submit-store-xiaomi.mjs'
import { __test__ as OP } from '../submit-store-oppo.mjs'
import { __test__ as VI } from '../submit-store-vivo.mjs'
import { __test__ as HO } from '../submit-store-honor.mjs'
import { __test__ as YY } from '../submit-store-yyb.mjs'
import { __test__ as AP } from '../submit-store-apkpure.mjs'
import { __test__ as HW } from '../submit-store-huawei.mjs'
import { CHANNELS } from '../probe-store-channel.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const MATRIX = JSON.parse(readFileSync(join(ROOT, 'scripts', 'data', 'app-store-credentials.json'), 'utf8'))
// 备案台账是唯一真源:矩阵里的备案格必须与它同值,不许各自记一份
const ICP_LEDGER = JSON.parse(readFileSync(join(ROOT, 'scripts', 'data', 'app-icp-filing.json'), 'utf8'))
const UPLOADER_SECRET = 'CLIENT-SECRET-DO-NOT-LEAK-0123456789'

const UPLOADERS = {
  xiaomi: { T: XI, envKey: { XIAOMI_DEVUSER_EMAIL: 'd@e.f', XIAOMI_API_PRIVATE_KEY: UPLOADER_SECRET } },
  oppo: { T: OP, envKey: { OPPO_CLIENT_ID: '123456789012345678', OPPO_CLIENT_SECRET: UPLOADER_SECRET } },
  vivo: { T: VI, envKey: { VIVO_ACCESS_KEY: 'AK', VIVO_ACCESS_SECRET: UPLOADER_SECRET } },
  honor: { T: HO, envKey: { HONOR_CLIENT_ID: 'CID', HONOR_CLIENT_SECRET: UPLOADER_SECRET } },
  yyb: { T: YY, envKey: { YYB_USER_ID: 'U1', YYB_ACCESS_SECRET: UPLOADER_SECRET } },
  huawei: { T: HW, envKey: { HUAWEI_CONNECT_CLIENT_ID: 'CID', HUAWEI_CONNECT_CLIENT_SECRET: UPLOADER_SECRET } },
}

test('F1 每家上传器都 export __test__ 且四件套齐(凭据/分类/产物或申报/参数)', () => {
  for (const [id, { T }] of Object.entries(UPLOADERS)) {
    assert.ok(T, `${id}: 无 __test__`)
    assert.equal(typeof T.resolveCredentials, 'function', `${id}: resolveCredentials 未 export`)
    assert.ok(T.parseArgs || T.parseCredentialText, `${id}: 参数或凭据解析未 export`)
    assert.ok(T.STATUS, `${id}: 三态未从单源导出`)
  }
})

test('F2 §5d 秘密不入 stdout:六家 env 凭据出口的 detail 都不得含原文', () => {
  for (const [id, { T, envKey }] of Object.entries(UPLOADERS)) {
    const r = T.resolveCredentials({ env: envKey, read: () => '', root: 'X:/不存在' })
    assert.equal(r.status, CORE.STATUS.FOUND, `${id}: env 齐备应 FOUND,实得 ${r.status}(${r.detail})`)
    assert.ok(!JSON.stringify(r.detail).includes(UPLOADER_SECRET), `${id}: detail 泄露秘密原文`)
    assert.ok(/sha8=|\*\*\*/.test(r.detail), `${id}: detail 未给脱敏形态(fp 或 ***)`)
  }
})

test('F3 未核实端点结构上零调用;已核实的上传/提审段必须在册', () => {
  const unverified = [
    ['honor.uploadPath', HO.ENDPOINTS.uploadPath],
    ['honor.bindFile', HO.ENDPOINTS.bindFile],
    ['honor.submitAudit', HO.ENDPOINTS.submitAudit],
    ['honor.createApp', HO.ENDPOINTS.createApp],
    ['yyb.auditStatus', YY.ENDPOINTS.auditStatus],
    ['apkpure.api', AP.CHANNELS.api],
  ]
  for (const [name, e] of unverified) {
    assert.equal(e.verified, false, `${name}: 声称未核实却带 verified:true`)
    assert.equal(e.path ?? null, null, `${name}: 未核实段不许在册写死 path`)
  }
  const verified = [
    ['huawei.submit', HW.ENDPOINTS.submit],
    ['oppo.detail', OP.ENDPOINTS.detail],
    ['oppo.submit', OP.ENDPOINTS.submit],
    ['yyb.uploadInfo', YY.ENDPOINTS.uploadInfo],
    ['yyb.appUpdate', YY.ENDPOINTS.appUpdate],
  ]
  for (const [name, e] of verified) assert.equal(e.verified, true, `${name}: 官方正文已核到 ⇒ 应进执行链路`)
  assert.equal(AP.CHANNELS.api.url, null, 'apkpure api.url 必须为 null(有值即会被当通路用)')
  assert.equal(VI.METHODS.submitAudit.name, null, 'vivo 提审 method 名未证 ⇒ 必须为 null')
  assert.equal(HO.ENDPOINTS.uploadPath.path, undefined, 'honor 上传路径未证 ⇒ 不得在册写死')
})

test('F4 三态折叠同一条:未判定压过缺件,空集判未判定不判绿(§0.3)', () => {
  const S = CORE.STATUS
  assert.equal(CORE.foldExit([S.MISSING, S.UNJUDGED]), 2)
  assert.equal(CORE.foldExit([S.FOUND, S.MISSING]), 1)
  assert.equal(CORE.foldExit([S.FOUND]), 0)
  assert.equal(CORE.foldExit([]), 2, '枚举到 0 格不得记绿')
})

test('F5 端点 URL 单源 = CHANNELS:上传器里的 token/query 必须逐字回它', () => {
  assert.equal(HO.tokenRequest().url, CHANNELS.honor.tokenUrl, 'honor token URL 自建第二份')
  assert.equal(HO.appIdRequest({ packageName: 'zh.ai.sq' }).url, CHANNELS.honor.probe().url, 'honor get-app-id URL 自建第二份')
  assert.equal(YY.queryDetailCall({ creds: { userId: 'U', accessSecret: 'S' } }).url, CHANNELS.yyb.probe().url, 'yyb query URL 自建第二份')
  assert.equal(XI.queryCall({ creds: { email: 'd@e.f' } }).url, CHANNELS.xiaomi.probe().url, 'xiaomi query URL 自建第二份')
  assert.equal(VI.GATEWAY, new URL(CHANNELS.vivo.probe().url).origin + new URL(CHANNELS.vivo.probe().url).pathname, 'vivo 网关与 CHANNELS 漂移')
})

test('F6 矩阵:ready 店必须前置齐备;huawei/vivo 两家 ready,其余仍被凭据卡住', () => {
  const ready = Object.entries(MATRIX.stores).filter(([, s]) => s.ready === true)
  assert.deepEqual(ready.map(([k]) => k), ['huawei', 'vivo'], `ready 店集合漂移:${ready.map(([k]) => k)}`)
  for (const [id, s] of ready) {
    assert.deepEqual(s.blockedBy ?? [], [], `${id}: ready 不得再带 blocker`)
    assert.equal(s.credentialPresent, true, `${id}: ready 必须凭据齐备`)
    assert.deepEqual(s.fieldsMissing ?? [], [], `${id}: ready 不得缺字段`)
  }
  assert.equal(MATRIX.summary.credentialCompleteCount, 2, 'huawei/vivo 凭据均已落盘 ⇒ 齐备店数=2')
  assert.deepEqual(MATRIX.summary.autoUploadReadyToday, ['huawei', 'vivo'], 'summary 必须与实际 ready 店一致')
})

test('F7 法定前置闸门:备案/软著在册才可摘 blocker;ready 店不得挂已 found 的闸', () => {
  const gated = Object.entries(MATRIX.stores).filter(([, s]) => s.needsIcpFiling)
  assert.ok(gated.length >= 6, `国内闸门店数异常:${gated.length}`)
  const icpFound = MATRIX.legalPrereqs.appIcpFiling.statusNow === 'found'
  const crFound = MATRIX.legalPrereqs.softwareCopyright.statusNow === 'found'
  for (const [id, s] of gated) {
    if (!icpFound) assert.ok(s.blockedBy.includes('appIcpFiling'), `${id}: 备案未在册却未挂 blockedBy ⇒ 会被读成能上架`)
    if (s.needsCopyright && !crFound) assert.ok(s.blockedBy.includes('softwareCopyright'), `${id}: 软著未在册却未挂 blockedBy`)
    if (s.ready) {
      assert.ok(icpFound && (!s.needsCopyright || crFound), `${id}: ready 但法定前置未全 found ⇒ 账面 ready 法律上发不了`)
      assert.ok(!s.blockedBy.includes('appIcpFiling') && !s.blockedBy.includes('softwareCopyright'), `${id}: ready 不得挂已 found 的闸`)
    }
  }
  assert.equal(MATRIX.legalPrereqs.appIcpFiling.statusNow, 'found', '备案台账已在册(2026-11-07 核验)⇒ 矩阵不得再报 unjudged')
  assert.equal(MATRIX.legalPrereqs.appIcpFiling.appFilingNumber, ICP_LEDGER.appFilingNumber, '矩阵与备案台账必须同值')
  assert.equal(MATRIX.legalPrereqs.appIcpFiling.authority, ICP_LEDGER.authority)
  assert.equal(MATRIX.legalPrereqs.appIcpFiling.appNameAlignment?.appNameNow, ICP_LEDGER.appName, '对外程序名必须与备案台账 App 名逐字一致')
  assert.ok(!MATRIX.legalPrereqs.appIcpFiling.appNameAlignment?.undecided, '名称不一致这项已裁决,不得再留未裁决格')
  assert.equal(MATRIX.legalPrereqs.softwareCopyright.statusNow, 'found', '软著登记证书已在册(2025SR1904590)')
  assert.equal(MATRIX.legalPrereqs.softwareCopyright.certificateNumber, '2025SR1904590')
  assert.ok(MATRIX.legalPrereqs.softwareCopyright.evidenceFiles?.length > 0, 'found 必须有证据件')
  assert.equal(MATRIX.legalPrereqs.softwareCopyright.shortName, ICP_LEDGER.appName, '软著简称必须与备案 App 名逐字一致')
  assert.equal(MATRIX.legalPrereqs.appIcpFiling.websiteFilingIsNotAppFiling.satisfiesAppFiling, false, '网站备案不得冒充当 App 备案')
})

test('F8 manualOnly 收窄:APKPure 邮件腿有回执判据,不再标 manualOnly;其余 why 仍齐', () => {
  assert.equal(MATRIX.stores.apkpure.manualOnly, false, 'APKPure 邮件通道已机器直发')
  assert.equal(MATRIX.stores.apkpure.apiMode, 'mail-verified')
  assert.ok(MATRIX.stores.apkpure.mailChannel?.receiptRule.includes('回执'), '邮件腿必须写清回执判据')
  assert.ok(MATRIX.stores.apkpure.manualOnlyWhy.length > 30, '网页后台仍人工,须保留说明')
  assert.ok(MATRIX.stores.harmony.manualOnly && MATRIX.stores.harmony.honestStatement.length > 30)
  assert.ok(MATRIX.stores.yyb.firstPublishHardConstraint.includes('不支持新应用发布'))
  for (const id of MATRIX.summary.manualOnly.firstPublishManualStores) {
    assert.ok(MATRIX.stores[id].firstPublishWhy || MATRIX.stores[id].firstPublishHardConstraint, `${id}: firstPublishManual 缺说明`)
  }
})

test('F9 凭据"有"不等于"能用":华为已换成服务账号且 usable:true;旧 HMS 形态仍判 hms-legacy', () => {
  const h = MATRIX.stores.huawei
  assert.equal(h.credentialPresent, true)
  assert.equal(h.credentialUsableForPublishing, true, '服务账号 JWT 已实测 ret.code=0 ⇒ 可用')
  assert.equal(h.credentialDigest.kind, 'service-account')
  assert.equal(h.agcAppId, undefined, 'APPID 只存网盘 APPID 总表,不得入仓')
  assert.match(h.appIdRegistry, /BaiduSyncdisk.*应用商店APPID总表/, '台账只能存指向网盘的引用')
  assert.equal(HW.parseCredentialText(`应用ID:100000\n密钥:${UPLOADER_SECRET}`).kind, 'hms-legacy', '旧 HMS 文本件形态不得被读成可用凭据')
  assert.equal(HW.parseCredentialText(`client_id:9\nclient_secret:${UPLOADER_SECRET}`).kind, 'connect-api')
  assert.equal(HW.parseServiceAccountJson(JSON.stringify({ key_id: 'k', private_key: 'PEM', sub_account: '1' })).kind, 'service-account')
})

test('F10 各家签算:缺密钥一律不签并判未判定(不冒充"对方拒绝")', () => {
  assert.equal(VI.signTop({ params: { a: 1 }, secret: '' }).status, CORE.STATUS.UNJUDGED)
  assert.equal(YY.signYyb({ params: { a: 1 }, secret: '' }).status, CORE.STATUS.UNJUDGED)
  assert.equal(XI.signRequestData({ requestData: '{}', privateKey: '不是密钥' }).status, CORE.STATUS.UNJUDGED)
  assert.equal(OP.ENDPOINTS.token.verified, true, 'oppo token 段本轮已核实,不得退回盲区')
})

test('F11 非结构化回包一律未判定:六家分类器都不得把 HTML 读成拒绝', () => {
  for (const [id, fn] of [
    ['xiaomi', XI.classifyXiaomi],
    ['oppo', OP.classifyOppo],
    ['vivo', VI.classifyVivo],
    ['honor', HO.classifyHonor],
    ['yyb', YY.classifyYyb],
  ]) {
    const r = fn(200, '<html>请先登录</html>')
    assert.equal(r.status, CORE.STATUS.UNJUDGED, `${id}: 把登录页 HTML 读成了 ${r.status}`)
  }
})

test('F12 材料包取材走 prepare-store-bundle 落点,不各自拼路径', () => {
  assert.equal(CORE.BUNDLE_DIR_REL, join('.ihui-agent', 'tmp', 'store-bundle'))
  const r = CORE.loadBundle({ vendor: 'nope-xyz', exists: () => false })
  assert.equal(r.status, CORE.STATUS.MISSING)
  assert.ok(r.detail.includes('prepare-store-bundle'), '缺材料包必须给出唯一产出入口')
})

test('F13 apk/aab 取舍:点名 apk 而面只有 aab ⇒ 判缺件,不悄悄回落 aab', () => {
  const r = CORE.pickArtifact([{ kind: 'aab', path: 'a', bytes: 1 }], 'apk')
  assert.equal(r.status, CORE.STATUS.MISSING)
  assert.ok(r.detail.includes('assembleRelease'))
})

test('F14 APKPure 无上传腿:本器不存在任何 upload/submit 可调用出口', () => {
  assert.equal(AP.CHANNELS.api.automatable, false)
  assert.equal(Object.prototype.hasOwnProperty.call(AP, 'phaseUpload'), false, 'APKPure 不得有 phaseUpload 出口')
  assert.equal(Object.prototype.hasOwnProperty.call(AP, 'submit'), false)
})

test('F15 应用宝首包政策写进结构:未声明已上线 ⇒ 拒绝跑上传段并给后台通路', async () => {
  assert.equal(YY.POLICY.firstPublishSupportedByApi, false)
  const no = await YY.phaseUpload({ assumeFirstPublished: false })
  assert.equal(no.status, CORE.STATUS.MISSING)
  assert.ok(no.detail.includes('app.open.qq.com'))
  assert.equal(no.calls.length, 0)
})

test('F16 vivo 法定前置闸:备案/软著/安评三格齐 found 才绿,且备案格覆盖六家国内店', () => {
  const legal = CORE.resolveStoreLegalPrereqs({ store: 'vivo' })
  assert.equal(legal.status, CORE.STATUS.FOUND, `vivo 法定前置应全绿,实得 ${legal.status}(${legal.detail})`)
  assert.deepEqual(legal.cells.map((c) => c.key), ['appIcpFiling', 'softwareCopyright', 'securityAssessment'], 'vivo 三格必须逐格在册')
  const icp = MATRIX.legalPrereqs.appIcpFiling.requiredByStores ?? []
  for (const id of ['huawei', 'xiaomi', 'oppo', 'vivo', 'honor', 'yyb']) assert.ok(icp.includes(id), `备案法定前置必须覆盖 ${id}`)
  const rows = CORE.gateStates({ creds: { status: CORE.STATUS.FOUND, detail: '' }, artifact: { status: CORE.STATUS.FOUND, detail: '' }, bundle: { status: CORE.STATUS.FOUND, detail: '' }, channel: { status: CORE.STATUS.FOUND, detail: '' }, legal }).rows
  assert.equal(rows.length, 5, 'gateStates 传 legal ⇒ 第五格;不传 ⇒ 仍是四格')
  assert.equal(rows[4].k, '法定前置')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
