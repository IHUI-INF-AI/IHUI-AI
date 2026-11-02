// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:prepare-store-bundle.mjs 的对账判据(import __test__,零复抄)+ 权限摘除插件。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, '..', 'prepare-store-bundle.mjs'), 'utf8')
const { __test__ } = await import(import.meta.resolve('../prepare-store-bundle.mjs'))
const { reconcilePermissions, reconcileSdks, checkListingLimits, extractManifestPermissions, buildPlan, buildListing, VENDOR_LIMITS, SDK_WATCHLIST, ICP_FILING_GATE, STATUS } = __test__

const MANIFEST = `<manifest><uses-permission android:name="android.permission.INTERNET"/><uses-permission android:name="android.permission.CAMERA"/><uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/></manifest>`
const APP_JSON = { plugins: ['expo-secure-store', ['expo-camera', { cameraPermission: '允许使用相机扫描二维码' }]] }
const PRIVACY = '一、我们收集的个人信息……二、权限章节。个推公共库SDK(Gtc) 与 DCloud开发通用工具库 会收集设备标识。'

test('S1 manifest 面取材:取不到一律未判定,枚举到 0 条判死不判绿', () => {
  assert.equal(extractManifestPermissions(null).status, STATUS.UNJUDGED)
  assert.equal(extractManifestPermissions('<manifest/>').status, STATUS.UNJUDGED, '0 条 uses-permission 不能读成"权限对平"')
  const ok = extractManifestPermissions(MANIFEST)
  assert.equal(ok.status, STATUS.FOUND)
  assert.deepEqual(ok.perms, ['android.permission.INTERNET', 'android.permission.CAMERA', 'android.permission.SYSTEM_ALERT_WINDOW'])
})

test('S2 权限分级:normal 免说明、dangerous 必须有文案;未知权限落待人工而非静默通过', () => {
  const r = reconcilePermissions(APP_JSON, PRIVACY, MANIFEST)
  assert.equal(r.status, STATUS.MISSING)
  const flagged = r.gaps.map((g) => g.permission)
  assert.ok(flagged.includes('android.permission.SYSTEM_ALERT_WINDOW'), '悬浮窗无映射必须点名')
  assert.ok(!flagged.includes('android.permission.INTERNET'), 'INTERNET 是 normal,不该当缺口')
  assert.ok(r.waived.includes('android.permission.INTERNET'))
  assert.ok(r.detail.includes('normal 免说明'), '结论行必须把免说明条数说出来,否则读不出分级生效')
  // 反向对照:dangerous 的 CAMERA 在有文案时必须不再报缺口
  assert.ok(!flagged.includes('android.permission.CAMERA'), 'cameraPermission 文案在册 ⇒ CAMERA 不该被报缺')
})

test('S3 SDK 三象限:漏声明最重、过度声明要点名、证不到的面不替对方定罪', () => {
  const noGetui = { privacyText: PRIVACY, manifestText: MANIFEST, gradleText: 'dependencies {}', pkgJsonText: '{}' }
  const r = reconcileSdks(noGetui)
  const by = Object.fromEntries(r.rows.map((x) => [x.sdk, x.verdict]))
  assert.equal(by['个推公共库SDK(Gtc)'], 'declared-not-integrated')
  assert.equal(by['OkHttp框架'], 'unjudged-face-cannot-prove', 'truthFaces 为空 ⇒ 只能未判定,不得判过度声明')
  assert.equal(r.status, STATUS.MISSING)
  // 包内真有个推而政策没写 ⇒ 必须报"漏声明"(比过度声明更严重的方向)
  const withGetui = { privacyText: '我们收集个人信息。权限章节。', manifestText: MANIFEST + '<service android:name="com.getui.sdk.service"/></manifest>', gradleText: 'implementation "com.getui:gtc"', pkgJsonText: '{}' }
  const r2 = reconcileSdks(withGetui)
  assert.deepEqual(r2.serious.map((x) => x.sdk), ['个推公共库SDK(Gtc)'])
  // 名录绝不再从散文里抽碎片(第一版抽出"上述第三方SDK"这类)
  assert.ok(!r.rows.some((x) => /上述|这些|我们将|已要求/.test(x.sdk)))
  assert.ok(!/matchAll/.test(SRC.slice(SRC.indexOf('export function reconcileSdks'), SRC.indexOf('export function checkListingLimits'))), '名录必须走观察表,不留开放正则抽取那条路')
  // 观察表本身的形状锁:truthFaces 为空 = 结构上不可证 ⇒ 只允许 unjudged,不得参与"过度声明"判定
  assert.deepEqual(SDK_WATCHLIST.find((s) => /OkHttp/.test(s.name)).truthFaces, [], 'OkHttp 由 RN 内核带进依赖图,manifest/app 级 gradle/package.json 三面都证不到')
  assert.ok(SDK_WATCHLIST.every((s) => s.name && s.declared instanceof RegExp && Array.isArray(s.truthFaces)), '观察表每项都要有名称、声明特征与可证面')
})

test('S4 厂商 apiMode 三档:博客说法不得当官方通路;百度系已停服不列', () => {
  assert.equal(VENDOR_LIMITS.apkpure.apiMode, 'unverified')
  assert.equal(VENDOR_LIMITS.samsung.apiMode, 'verified')
  assert.equal(VENDOR_LIMITS.samsung.firstPublishManual, true, '官方明写 API 不支持注册新应用,首上架走网页')
  assert.equal(VENDOR_LIMITS.meizu.apiMode, 'manual-only')
  assert.ok(!Object.keys(VENDOR_LIMITS).some((k) => /baidu|91/.test(k)), '百度 91 助手 2025-09-27 停服,不该再占渠道位')
  const listing = buildListing(APP_JSON, { company: '吉林省爱智汇人工智能科技有限公司', effectDate: '2025-06-20' })
  const plan = buildPlan({
    vendors: ['apkpure', 'huawei'],
    listing,
    reconcile: { status: STATUS.FOUND, detail: 'ok', permissions: [], gaps: [] },
    sdks: { status: STATUS.FOUND, rows: [], serious: [], stale: [] },
    artifacts: { status: STATUS.FOUND, detail: 'ok', value: [] },
    privacyMeta: { company: 'x', effectDate: 'y' },
  })
  const apkpure = plan.find((p) => p.vendor === 'apkpure')
  assert.ok(apkpure.blockers.some((b) => /未找到官方开发者入口/.test(b)), '无官方出处必须写成"不接入",不能留空当可发')
  const huawei = plan.find((p) => p.vendor === 'huawei')
  assert.ok(huawei.blockers.includes(ICP_FILING_GATE), '国内店必须把 App 备案(信管〔2023〕105 号第九条)挂成 blocker')
  assert.ok(ICP_FILING_GATE.includes('105'), '备案门槛要带文号,便于复核出处')
})

test('S5 文案长度只报数不截断:超限判 missing 而不是偷偷改短对外文案', () => {
  const limits = VENDOR_LIMITS.huawei
  const over = checkListingLimits(limits, { brief: '短'.repeat(81), full: 'f'.repeat(10) })
  assert.equal(over.status, STATUS.MISSING)
  assert.ok(over.rows.find((r) => r.field === 'brief').over)
  const noCap = checkListingLimits(VENDOR_LIMITS.apkpure, { brief: '任意长' })
  assert.equal(noCap.status, STATUS.UNJUDGED, '核不到上限的厂商只报数,不判红也不判绿')
})

test('S6 摘除插件:删除现有条目并留 tools:node=remove,且同一条不重复追加', () => {
  const require_ = createRequire(import.meta.url)
  const plug = require_(join(HERE, '..', '..', 'apps', 'mobile-rn', 'plugins', 'withPermissionPruning.cjs'))
  const { prune, DEFAULT_PRUNED } = plug.__test__
  assert.equal(typeof plug, 'function', '插件本体必须仍是 config plugin 工厂函数')
  const manifest = { 'uses-permission': [{ $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW' } }, { $: { 'android:name': 'android.permission.INTERNET' } }] }
  const r = prune(manifest, [...DEFAULT_PRUNED])
  assert.equal(r.removed, 1, '条目属性住在 $ 下(e.$["android:name"]),写成 e["android:name"] 会一条都删不掉(2026-11-03 实测)')
  const names = manifest['uses-permission'].map((e) => e.$['android:name'])
  assert.ok(names.includes('android.permission.INTERNET'), '不能误伤别的权限')
  const marked = manifest['uses-permission'].filter((e) => e.$['tools:node'] === 'remove')
  assert.equal(marked.length, 1, '必须留且只留一条 tools:node=remove,防依赖库再把同名权限带回来')
  assert.equal(marked[0].$['android:name'], 'android.permission.SYSTEM_ALERT_WINDOW')
  // 幂等:第二次跑既不该报"摘除 1 条",也不该再追加第二条 remove 指令
  const again = prune(manifest, [...DEFAULT_PRUNED])
  assert.equal(again.removed, 0)
  assert.equal(manifest['uses-permission'].filter((e) => e.$['tools:node'] === 'remove').length, 1)
})

test('S7 插件已挂进 app.config 的 plugins(装了不挂=没有,§0.9)', () => {
  const cfg = readFileSync(join(HERE, '..', '..', 'apps', 'mobile-rn', 'app.config.js'), 'utf8')
  assert.ok(cfg.includes('./plugins/withPermissionPruning.cjs'), '插件文件在而 config 未引用 ⇒ 该能力等于不存在')
  assert.ok(cfg.indexOf('withPermissionPruning') < cfg.indexOf('expo-font'), '摘除须早于最终 config 输出,放在 plugins 数组内即可')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
