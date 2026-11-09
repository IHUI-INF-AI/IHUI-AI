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
const { reconcilePermissions, reconcileSdks, checkListingLimits, extractManifestPermissions, buildPlan, buildListing, loadInputs, VENDOR_LIMITS, SDK_WATCHLIST, ICP_FILING_GATE, SOFTWARE_COPYRIGHT_GATE, resolveSoftwareCopyright, loadIdentity, checkIdentityConsistency, readAndroidAppLabel, STATUS } = __test__

const MANIFEST = `<manifest><uses-permission android:name="android.permission.INTERNET"/><uses-permission android:name="android.permission.CAMERA"/><uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/></manifest>`
const APP_JSON = { plugins: ['expo-secure-store', ['expo-camera', { cameraPermission: '允许使用相机扫描二维码' }]] }
const PRIVACY = '一、我们收集的个人信息……二、权限章节。个推公共库SDK(Gtc) 与 DCloud开发通用工具库 会收集设备标识。'

test('S1 manifest 面取材:取不到一律未判定,枚举到 0 条判死不判绿', () => {
  assert.equal(extractManifestPermissions(null).status, STATUS.UNJUDGED)
  assert.equal(extractManifestPermissions('<manifest/>').status, STATUS.UNJUDGED, '0 条 uses-permission 不能读成"权限对平"')
  const ok = extractManifestPermissions(MANIFEST)
  assert.equal(ok.status, STATUS.FOUND)
  assert.deepEqual(ok.perms, ['android.permission.INTERNET', 'android.permission.CAMERA', 'android.permission.SYSTEM_ALERT_WINDOW'])
  // tools:node="remove" 条目不是"包内权限":只按 android:name 抓会把已摘除读成仍在(2026-11-08 实测 SYSTEM_ALERT_WINDOW 假红)
  const withRemove = '<manifest><uses-permission android:name="android.permission.INTERNET"/><uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/></manifest>'
  const r = extractManifestPermissions(withRemove)
  assert.deepEqual(r.perms, ['android.permission.INTERNET'])
  assert.ok(!r.perms.includes('android.permission.SYSTEM_ALERT_WINDOW'), 'remove 标记 = 已被摘除,不得计入包内权限')
  assert.match(r.detail, /摘除标记 1 条/)
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

test('S2b 应用内安装权限:用途键在 app.config.js(非 app.json)也要取证;缺键才报缺口', () => {
  const manifest = '<manifest><uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/></manifest>'
  const without = reconcilePermissions(APP_JSON, PRIVACY, manifest)
  assert.ok(
    without.gaps.some((g) => g.permission === 'android.permission.REQUEST_INSTALL_PACKAGES'),
    '配置里没有用途键 ⇒ 必须点名,不能因为权限"合理"就静默放过',
  )
  const withCfg = reconcilePermissions(APP_JSON, PRIVACY, manifest, "installPackagesPermission: '应用内更新:下载新版本 APK 后拉起系统安装器'")
  assert.equal(withCfg.status, STATUS.FOUND)
  assert.deepEqual(withCfg.gaps, [])
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

test('S3b 在册隐私政策不得声明包内查无的 SDK(过度声明收口,读真档不读夹具)', () => {
  // 取材走器物自己的读盘口 loadInputs、判定走同一份 reconcileSdks —— 本例零复抄判据(§0.6/§22c)。
  const real = loadInputs()
  const by = Object.fromEntries(reconcileSdks(real).rows.map((x) => [x.sdk, x]))
  // 个推 / DCloud 是历史 Uniapp 底稿的遗留:本 RN 包 package.json + pnpm-lock、src(除本文案自身)、
  // 仓内唯一原生工程 apps/mobile-cap 的 build.gradle 与 AndroidManifest 四面零命中。
  // 政策再写它们即"过度声明"——商店与工信部按"政策与实际收集行为一致"双向判。
  assert.equal(by['个推公共库SDK(Gtc)'].declared, false, '政策正文再次声明个推 ⇒ 本例必须翻红')
  assert.equal(by['DCloud开发通用工具库'].declared, false, '政策正文再次声明 DCloud ⇒ 本例必须翻红')
  // 反向牙:把声明加回同一份文本,同一套判据必须读出 declared=true(证明上两行不是恒真断言)
  const polluted = { ...real, privacyText: `${real.privacyText}\n1. 个推公共库SDK(Gtc) 自动收集 IMEI。` }
  const pollutedBy = Object.fromEntries(reconcileSdks(polluted).rows.map((x) => [x.sdk, x.declared]))
  assert.equal(pollutedBy['个推公共库SDK(Gtc)'], true, '反向牙失效:加回声明却判不出 declared ⇒ 本例失去牙')
  // OkHttp 不在摘除面:它由 RN 内核带进依赖图,那三面结构上看不见它 ⇒ 只许 unjudged,不得读成过度声明
  assert.equal(by['OkHttp框架'].declared, true, 'OkHttp 声明应保持(摘除只针对包内查无的两家)')
  assert.equal(by['OkHttp框架'].verdict, 'unjudged-face-cannot-prove')
  // 摘两条不等于摘整章:商店按"完整文本"判,SDK 章节必须仍有在册条目
  assert.ok(/OkHttp/.test(real.privacyText), '第三方 SDK 章节不得被整体清空')
})

test('S4 厂商 apiMode:不存在假通路;博客说法不得当官方通路;百度系已停服不列', () => {
  assert.equal(VENDOR_LIMITS.apkpure.apiMode, 'manual-only', '官方只有登录型开发者控制台(无提交 API);邮件是联系通道,不是官方提交入口')
  assert.equal(VENDOR_LIMITS.samsung.apiMode, 'verified')
  assert.equal(VENDOR_LIMITS.samsung.firstPublishManual, true, '官方明写 API 不支持注册新应用,首上架走网页')
  assert.equal(VENDOR_LIMITS.meizu.apiMode, 'manual-only')
  assert.ok(!Object.keys(VENDOR_LIMITS).some((k) => /baidu|91/.test(k)), '百度 91 助手 2025-09-27 停服,不该再占渠道位')
  const listing = buildListing(APP_JSON, { company: '吉林省爱智汇人工智能科技有限公司', effectDate: '2025-06-20' })
  // 联系邮箱与提交授权声明是 APKPure 邮件腿的必填项,均由 meta/包名派生而非另写文案
  assert.equal(listing.contact, null, '未给 email ⇒ 不编造联系地址')
  const withEmail = buildListing(APP_JSON, { company: '吉林省爱智汇人工智能科技有限公司', effectDate: '2025-06-20', email: 'IHUI-AI@aizhs.top' })
  assert.deepEqual(withEmail.contact, { email: 'IHUI-AI@aizhs.top' })
  assert.match(withEmail.authorization, /授权 APKPure/, '提交授权声明必须随 listing 落包')
  assert.equal(withEmail.packageName, APP_JSON.android?.package ?? '未在册')
  assert.equal(withEmail.versionName, String(APP_JSON.version ?? '未在册'), '无产物元数据时才回落 app.json')
  // 反向牙:构建期 IHUI_MOBILE_VERSION 覆盖 displayVersion ⇒ 有元数据时必须优先取包内版本,
  // 否则邮件自报的 Version 与 APK 实际 versionName 不一致(2026-11-08 实测 0.0.19 vs app.json 0.0.12)
  const withArtifact = buildListing(APP_JSON, { company: 'x', effectDate: 'y', versionName: '0.0.19', versionCode: 26110713 })
  assert.equal(withArtifact.versionName, '0.0.19')
  assert.equal(withArtifact.versionCode, 26110713)
  const plan = buildPlan({
    vendors: ['apkpure', 'huawei'],
    listing,
    reconcile: { status: STATUS.FOUND, detail: 'ok', permissions: [], gaps: [] },
    sdks: { status: STATUS.FOUND, rows: [], serious: [], stale: [] },
    artifacts: { status: STATUS.FOUND, detail: 'ok', value: [] },
    privacyMeta: { company: 'x', effectDate: 'y' },
  })
  const apkpure = plan.find((p) => p.vendor === 'apkpure')
  assert.ok(!apkpure.blockers.some((b) => /未找到官方开发者入口/.test(b)), '已核实的通道不得再写"不接入"')
  assert.ok(apkpure.blockers.some((b) => /官方只有网页后台/.test(b)), 'APKPure 官方只有登录型控制台,必须如实点出无自动上传通路')
  const huawei = plan.find((p) => p.vendor === 'huawei')
  assert.ok(huawei.blockers.includes(ICP_FILING_GATE), '国内店必须把 App 备案(信管〔2023〕105 号第九条)挂成 blocker')
  assert.ok(huawei.blockers.includes(SOFTWARE_COPYRIGHT_GATE), '国内店必须把软著挂成 blocker(vivo/应用宝接口层面硬依赖)')
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

test('S8 软著闸门:missing-evidence 判 blocked 并点名;境外店不计;无编号的 found 不判绿', () => {
  const ledgerOf = (statusNow, extra = {}) => JSON.stringify({ legalPrereqs: { softwareCopyright: { statusNow, ...extra } } })
  assert.equal(resolveSoftwareCopyright({ readLedger: () => null, env: {} }).status, STATUS.UNJUDGED, '取不到登记处不得判绿')
  assert.equal(resolveSoftwareCopyright({ readLedger: () => '{bad json', env: {} }).status, STATUS.UNJUDGED)
  const missing = resolveSoftwareCopyright({ readLedger: () => ledgerOf('missing-evidence'), env: {} })
  assert.equal(missing.status, STATUS.MISSING)
  assert.match(missing.detail, /不在册/)
  assert.equal(
    resolveSoftwareCopyright({ readLedger: () => ledgerOf('found'), env: {} }).status,
    STATUS.UNJUDGED,
    '写着 found 却没有证书编号 ⇒ 未判定(不许用一个布尔冒充在册)',
  )
  const found = resolveSoftwareCopyright({ readLedger: () => ledgerOf('found', { certificateNumber: '2026SR0000000' }), env: {} })
  assert.equal(found.status, STATUS.FOUND)
  assert.equal(resolveSoftwareCopyright({ env: { IHUI_SOFTWARE_COPYRIGHT: '2026SR1234567' } }).status, STATUS.FOUND, 'env 覆盖须与台账同判据')

  const plan = buildPlan({
    vendors: ['apkpure', 'huawei'],
    listing: buildListing(APP_JSON, { company: 'x', effectDate: 'y' }),
    reconcile: { status: STATUS.FOUND, detail: 'ok', permissions: [], gaps: [] },
    sdks: { status: STATUS.FOUND, rows: [], serious: [], stale: [] },
    artifacts: { status: STATUS.FOUND, detail: 'ok', value: [] },
    privacyMeta: { company: 'x', effectDate: 'y' },
    filing: { status: STATUS.FOUND, detail: 'ok', filing: 'X' },
    copyright: missing,
  })
  const huawei = plan.find((p) => p.vendor === 'huawei')
  assert.equal(huawei.status, 'blocked', '软著缺 + 需软著 ⇒ 必须落到 blocked,不许借 SDK 未判定掩成 unjudged')
  assert.ok(huawei.blockers.includes(SOFTWARE_COPYRIGHT_GATE))
  const apkpure = plan.find((p) => p.vendor === 'apkpure')
  assert.ok(!apkpure.blockers.some((b) => /软著/.test(b)), 'APKPure 不收软著 ⇒ 不得被这道闸门波及')
  assert.notEqual(apkpure.status, 'blocked', 'APKPure 不得因软著闸门落到 blocked')
})

test('S9 身份真源:显示名/包名只认 app-identity.json,配置/资源/备案台账逐字对账,旧名不得再作产品名', () => {
  const identity = loadIdentity()
  assert.equal(identity.displayName, 'AI丨智汇社')
  assert.equal(identity.applicationId, 'zh.ai.sq', '包名是备案与 Play 的身份,不随显示名漂移')
  const appJson = JSON.parse(readFileSync(join(HERE, '..', '..', 'apps', 'mobile-rn', 'app.json'), 'utf8')).expo
  const ledger = JSON.parse(readFileSync(join(HERE, '..', 'data', 'app-icp-filing.json'), 'utf8'))
  assert.deepEqual(
    checkIdentityConsistency({ identity, appJson, androidLabel: readAndroidAppLabel(), ledger }),
    [],
    '四个派生面(app.json / strings.xml / 备案台账名称与包名)必须与真源逐字一致',
  )
  const drift = checkIdentityConsistency({ identity, appJson: { ...appJson, name: 'IHUI AI' }, androidLabel: 'IHUI AI', ledger })
  assert.ok(drift.some((g) => /app\.json#expo\.name/.test(g)), '配置面漂移必须被抓到')
  assert.ok(drift.some((g) => /app_name/.test(g)), '资源面漂移必须被抓到')
  assert.equal(buildListing({}, { identity }).title, 'AI丨智汇社', 'listing 名称只从真源派生')
  assert.equal(buildListing({}, { identity }).packageName, 'zh.ai.sq')
  assert.equal(buildListing({}, {}).title, '未在册', '取不到真源时不许回落到旧名')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
