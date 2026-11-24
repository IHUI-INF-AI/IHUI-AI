// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 真机装机器 —— 装机前强制签名对账(2026-11-04 立,机主令「不允许再出现签名不一致的情况 彻底根治杜绝」)。
 *
 * 要堵的实测事故链(不是假想):
 *   机上 zh.ai.sq 由正式证书(CN=IHUI AI / 62b0ff0e…)签;一旦某枚产物回落成 debug.keystore
 *   (CN=Android Debug / fac61745…),`adb install -r` 当场 INSTALL_FAILED_UPDATE_INCOMPATIBLE,
 *   而 gradle 那边照样 `BUILD SUCCESSFUL`。撞墙之后最省事的"出路"是 `adb uninstall` ——
 *   那会清掉用户数据与登录态,本仓明令禁止。于是"签名不一致"的真实代价是逼人丢登录态。
 *   同日还查明:android/app/build.gradle 里"debug 变体也用正式 keystore"那行是**手改进
 *   Expo prebuild 生成物**的(仓内 grep 无出处、注入器无该段)⇒ 任何人跑一次 prebuild 它就静默消失。
 *   判据不能建立在"生成物里恰好有人手改过"上。
 *
 * 本器把对账前置到装机那一刻:先问机上现装包的真实证书,再问待装包的证书,不等即拒,
 * 并把"不许 uninstall"写进同一条拒绝文案里(失效方向是多要一次显式说明,不是多放一次跳门)。
 *
 * 三态(§0.3):ok / refused / unjudged —— 取不到任何一侧指纹一律 unjudged,不记绿也不冒红。
 *
 * 用法:
 *   node scripts/install-rn-on-device.mjs --apk <path>            # 对账 + 装机 + 回读 + 自动启用无障碍服务
 *   node scripts/install-rn-on-device.mjs --apk <path> --dry-run  # 只对账不装
 *   node scripts/install-rn-on-device.mjs --apk <path> --json     # 机读(含 installer 来源与 a11y 双面取证)
 *   node scripts/install-rn-on-device.mjs --apk <path> --skip-a11y # 只装不改无障碍
 *   node scripts/install-rn-on-device.mjs --self-test             # 纯判据夹具(不碰真机)
 * 退出码:0 ok / 1 refused / 2 unjudged 或用法错
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { apkCert, expectedReleaseCert, DEBUG_CERT_SHA256 } from './mobile-release-artifact-check.mjs'
import { normalizeCertDigest } from './lib/mobile-download-leg.mjs'
import { resolveAdb, resolveAndroidPackage, runAdb, listSerials } from './lib/android-toolchain.mjs'

export const EXIT = { OK: 0, REFUSED: 1, UNJUDGED: 2 }

/**
 * 核心判据(纯函数,可注入全部输入 ⇒ 自检不碰真机)。
 * @returns {{state:'ok'|'refused'|'unjudged', reasons:string[], onDevice:?object, incoming:?object}}
 */
export function judgeInstall({
  deviceDigest,
  deviceDn,
  incomingDigest,
  incomingDn,
  releaseBaseline,
  allowDebugSigning = false,
}) {
  const reasons = []
  if (!deviceDigest) reasons.push('取不到机上现装包证书 ⇒ 无法判定一致性(未判定,不代你放行)')
  if (!incomingDigest) reasons.push('取不到待装 APK 证书 ⇒ 无法判定一致性(未判定)')
  if (reasons.length) return { state: 'unjudged', reasons, onDevice: deviceDigest ? { digest: deviceDigest } : null, incoming: incomingDigest ? { digest: incomingDigest } : null }

  const same = normalizeCertDigest(deviceDigest) === normalizeCertDigest(incomingDigest)
  const isDebug = normalizeCertDigest(incomingDigest) === normalizeCertDigest(DEBUG_CERT_SHA256)

  if (isDebug && !allowDebugSigning) {
    return {
      state: 'refused',
      reasons: [
        `待装包是 Android debug 证书(${DEBUG_CERT_SHA256.slice(0, 12)}…)签名。` +
          (releaseBaseline
            ? ' 本机正式凭据在位 ⇒ 这枚包是"签错了人",正解是重出正式签名包,不是装机绕过。'
            : ' 本机读不到正式基线 ⇒ 请先补 IHUI_RELEASE_* 凭据再出包。') +
          ' 确需 debug 自装场景请显式加 --allow-debug-signing。',
      ],
      onDevice: { digest: deviceDigest, dn: deviceDn },
      incoming: { digest: incomingDigest, dn: incomingDn },
    }
  }
  if (!same) {
    return {
      state: 'refused',
      reasons: [
        `签名不一致:机上 ${normalizeCertDigest(deviceDigest).slice(0, 16)}…(${deviceDn ?? '?'}) ≠ 待装 ${normalizeCertDigest(incomingDigest).slice(0, 16)}…(${incomingDn ?? '?'})`,
        ' 覆盖安装会被系统拒(INSTALL_FAILED_UPDATE_INCOMPATIBLE)。' +
          '**禁止用 adb uninstall 解决** —— 那会清掉用户数据与登录态(本仓明令禁止)。' +
          ' 正解:用与机上同签名的那一档重出(正式凭据在位即走 signing-unify 的 debug 变体或 release 变体)。',
      ],
      onDevice: { digest: deviceDigest, dn: deviceDn },
      incoming: { digest: incomingDigest, dn: incomingDn },
    }
  }
  if (isDebug) {
    return {
      state: 'ok',
      reasons: [`留痕:debug↔debug 自装场景由 --allow-debug-signing 显式授权(不得用于发布/上架)。`],
      onDevice: { digest: deviceDigest, dn: deviceDn },
      incoming: { digest: incomingDigest, dn: incomingDn },
    }
  }
  if (releaseBaseline && normalizeCertDigest(incomingDigest) !== normalizeCertDigest(releaseBaseline)) {
    return {
      state: 'refused',
      reasons: [`待装包与机上同签名,但都不等于本机正式 keystore 基线 ${normalizeCertDigest(releaseBaseline).slice(0, 16)}… ⇒ 存在第三把签名,请查 keystore 是否被换过。`],
      onDevice: { digest: deviceDigest, dn: deviceDn },
      incoming: { digest: incomingDigest, dn: incomingDn },
    }
  }
  return {
    state: 'ok',
    reasons: [`签名一致:${normalizeCertDigest(incomingDigest).slice(0, 16)}…(${incomingDn ?? '?'})`],
    onDevice: { digest: deviceDigest, dn: deviceDn },
    incoming: { digest: incomingDigest, dn: incomingDn },
  }
}

/** 读机上现装包的证书:pm path → pull base.apk → 交给全仓唯一的 apkCert 实现。 */
export function readDeviceCert({ adb, serial, pkg, scratch, pull = runAdb, certifier = apkCert }) {
  const p = pull(adb, ['-s', serial, 'shell', 'pm', 'path', pkg])
  if (!p.ok) return { error: `pm path ${pkg} 失败:${p.error}` }
  const line = String(p.stdout).split(/\r?\n/).find((l) => l.trim().startsWith('package:') && l.includes('base.apk'))
  if (!line) return { error: `pm path 输出里没有 base.apk(该包可能是 split apk 或未安装):${String(p.stdout).slice(0, 160)}` }
  const remote = line.trim().slice('package:'.length)
  const local = join(scratch, `${serial}-base.apk`)
  const g = pull(adb, ['-s', serial, 'pull', remote, local])
  if (!g.ok) return { error: `pull ${remote} 失败:${g.error}` }
  if (!existsSync(local)) return { error: `pull 报成功但本地无文件:${local}` }
  const c = certifier(local)
  if (c?.error) return { error: `读机上证书失败:${c.error}` }
  return { digest: c.digest, dn: c.dn }
}

/** 无障碍服务的类名(由 apps/mobile-rn/plugins/withAutoInstaller.cjs 注入,单源在那里)。 */
export const A11Y_SERVICE_CLASS = 'A11yAutoInstallService'

/**
 * Android 13+「受限设置」的判据(2026-11-23 实机定位)。
 *
 * 症状:设置 → 无障碍 里本应用服务灰显、副标题 `Controlled by Restricted Setting`,开关点不动。
 * 根因不在 App:系统按**安装来源**判定 —— 经 com.google.android.packageinstaller(浏览器/文件管理器
 * 点 APK)安装的包被视为"未知来源",其无障碍服务默认锁死;`adb install`(installer=null)与
 * Play 商店来源不受此限。实测:同一枚 APK 用 adb 覆盖安装后,同一台机器上该服务立刻变为可点/On。
 *
 * @returns {{state:'unrestricted'|'restricted-risk'|'unjudged', installer:?string, reason:string}}
 */
export function judgeInstallerSource(dumpsysStdout) {
  const m = /installerPackageName=(\S+)/.exec(String(dumpsysStdout ?? ''))
  if (!m) {
    return { state: 'unjudged', installer: null, reason: 'dumpsys 里没有 installerPackageName 字段 ⇒ 来源未判定' }
  }
  const installer = m[1].trim()
  if (installer === 'null' || installer === '') {
    return { state: 'unrestricted', installer: null, reason: 'installer=null(adb/shell 装机) ⇒ 不触发 Android 13+ 受限设置' }
  }
  if (installer === 'com.android.vending') {
    return { state: 'unrestricted', installer, reason: 'installer=Play 商店 ⇒ 不受限' }
  }
  return {
    state: 'restricted-risk',
    installer,
    reason: `installer=${installer} ⇒ 系统按「未知来源」处理,无障碍开关会被锁成 Controlled by Restricted Setting;正解是用 adb 覆盖安装(installer 变 null)`,
  }
}

/**
 * 无障碍服务是否真的启用(双面取证:secure 设置里的组件串 + AMS 的 Enabled services)。
 * 只信"用户点过我已开启"不算数 —— 那正是本次事故里"看着开了、实际灰着"的来源。
 */
export function judgeA11y({ settingsStdout = '', dumpStdout = '', pkg }) {
  const component = `${pkg}/${pkg}.${A11Y_SERVICE_CLASS}`
  if (!String(settingsStdout).trim() && !String(dumpStdout).trim()) {
    return { state: 'unjudged', component, reason: '取不到 enabled_accessibility_services 与 dumpsys 输出 ⇒ 未判定' }
  }
  const inSettings = String(settingsStdout).includes(component)
  const inDump = String(dumpStdout).includes(component)
  if (inSettings && inDump) return { state: 'ok', component, reason: 'secure 设置与 AMS 双面都在位' }
  if (inSettings || inDump) {
    return {
      state: 'partial',
      component,
      reason: `只有单面命中(settings=${inSettings} ams=${inDump}) ⇒ 服务未必真绑定,未判定`,
    }
  }
  return { state: 'not-enabled', component, reason: '两面都不含该服务 ⇒ 未启用' }
}

/**
 * 同步等待(脚本是同步执行模型,不引 async 改造)。仅用于 adb 写后/写前的沉降窗口。
 */
function sleepSync(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * 在 adb 通道上启用本应用的无障碍服务并回读。仅由装机脚本调用(设备已授权、作用面只有本包服务)。
 *
 * ⚠️ 2026-11-23 实测的关键时序:`adb install` 完成后,PackageManager 会**异步**再清一次该包的
 * 无障碍授权。写后立刻回读能读到 ok,十几秒后却变回 not-enabled(系统设置页也随之变灰)。
 * 因此这里必须:①写前先等沉降;②写完再等一个沉降窗口才做最终判定;③首次判定未过就重写一次。
 * 否则脚本会报一个"看起来成功、实际没生效"的假 ok。
 */
export function enableAutoInstallA11y({ adb, serial, pkg, runner = runAdb, settleMs = 3000 }) {
  const component = `${pkg}/${pkg}.${A11Y_SERVICE_CLASS}`
  const write = () => {
    const put = runner(adb, ['-s', serial, 'shell', 'settings', 'put', 'secure', 'enabled_accessibility_services', component])
    if (!put.ok) return `写 enabled_accessibility_services 失败:${put.error}`
    const on = runner(adb, ['-s', serial, 'shell', 'settings', 'put', 'secure', 'accessibility_enabled', '1'])
    if (!on.ok) return `写 accessibility_enabled 失败:${on.error}`
    return null
  }
  const read = () => {
    const got = runner(adb, ['-s', serial, 'shell', 'settings', 'get', 'secure', 'enabled_accessibility_services'])
    const dump = runner(adb, ['-s', serial, 'shell', 'dumpsys', 'accessibility'])
    return judgeA11y({
      settingsStdout: got.ok ? got.stdout : '',
      dumpStdout: dump.ok ? dump.stdout : '',
      pkg,
    })
  }
  sleepSync(settleMs)
  const firstErr = write()
  if (firstErr) return { state: 'unjudged', component, reason: firstErr }
  sleepSync(settleMs)
  let judged = read()
  if (judged.state !== 'ok') {
    const retryErr = write()
    if (retryErr) return { state: 'unjudged', component, reason: retryErr }
    sleepSync(settleMs)
    judged = read()
  }
  return { ...judged, wrote: true }
}

function selfTest() {
  const rows = []
  const t = (name, cond, got = '') => rows.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ` :: ${got}`}`)
  const DEV = '62b0ff0e950125230683aacfb5d0b110d93d30a229ca5df1950a572255b82514'
  const DBG = normalizeCertDigest(DEBUG_CERT_SHA256)

  const a = judgeInstall({ deviceDigest: DEV, incomingDigest: DEV, releaseBaseline: DEV })
  t('S1 同签名且等于正式基线 ⇒ ok', a.state === 'ok', a.state)

  const b = judgeInstall({ deviceDigest: DEV, incomingDigest: 'e3'.repeat(32), releaseBaseline: DEV })
  t('S2 机上与待装不等 ⇒ refused', b.state === 'refused', b.state)
  t('S3 拒绝文案点名"禁止 uninstall"', /禁止用 adb uninstall/.test(b.reasons.join(' ')), b.reasons.join(' '))

  const c = judgeInstall({ deviceDigest: DEV, incomingDigest: DBG, releaseBaseline: DEV })
  t('S4 待装是 debug 证书 ⇒ refused(即便机上不是 debug)', c.state === 'refused', c.state)
  t('S5 debug 臂文案指向"重出"而不是"卸载"', /重出正式签名包/.test(c.reasons.join(' ')), c.reasons.join(' '))

  const d = judgeInstall({ deviceDigest: DBG, incomingDigest: DBG, releaseBaseline: null, allowDebugSigning: true })
  t('S6 显式授权的 debug↔debug 自装 ⇒ ok 且留痕', d.state === 'ok' && /显式授权/.test(d.reasons.join(' ')), d.state + d.reasons.join(' '))

  const e = judgeInstall({ deviceDigest: '', incomingDigest: DEV, releaseBaseline: DEV })
  t('S7 取不到机上指纹 ⇒ unjudged(绝不冒绿)', e.state === 'unjudged', e.state)
  const f = judgeInstall({ deviceDigest: DEV, incomingDigest: '', releaseBaseline: DEV })
  t('S8 取不到待装指纹 ⇒ unjudged', f.state === 'unjudged', f.state)

  const g = judgeInstall({ deviceDigest: 'aa'.repeat(32), incomingDigest: 'aa'.repeat(32), releaseBaseline: DEV })
  t('S9 同签名但都不等于本机正式基线 ⇒ refused(第三把签名)', g.state === 'refused', g.state)

  // 反向对照:归一化差异不得影响判等(大写/冒号)
  const h = judgeInstall({ deviceDigest: '62:B0:FF:0E:95:01:25:23:06:83:AA:CF:B5:D0:B1:10:D9:3D:30:A2:29:CA:5D:F1:95:0A:57:22:55:B8:25:14', incomingDigest: DEV, releaseBaseline: DEV })
  t('S10 指纹带冒号/大写仍判等(阳性对照)', h.state === 'ok', h.state)

  const s = listSerials('List of devices attached\nabc123 device\nxyz offline\n\n')
  t('S11 设备清单只取已授权 device', s.length === 1 && s[0] === 'abc123', JSON.stringify(s))

  const bad = listSerials('List of devices attached\n\n')
  t('S12 零设备读出空集(不得当成"有一台")', bad.length === 0, JSON.stringify(bad))

  const pkg = resolveAndroidPackage({})
  t('S13 包名解析出非空值且带出处', pkg.ok && !!pkg.pkg && !!pkg.source, JSON.stringify(pkg))

  // Android 13+「受限设置」判据(2026-11-23 实机):来源决定开关能否点,不决定包本身。
  const i1 = judgeInstallerSource('    installerPackageName=null\n')
  t('S14 installer=null ⇒ 不受限', i1.state === 'unrestricted', i1.state)
  const i2 = judgeInstallerSource('    installerPackageName=com.google.android.packageinstaller\n')
  t('S15 packageinstaller 来源 ⇒ restricted-risk', i2.state === 'restricted-risk', i2.state)
  const i3 = judgeInstallerSource('    installerPackageName=com.android.vending\n')
  t('S16 Play 商店来源 ⇒ 不受限', i3.state === 'unrestricted', i3.state)
  const i4 = judgeInstallerSource('    versionCode=1\n')
  t('S17 无 installerPackageName 字段 ⇒ unjudged(不冒绿)', i4.state === 'unjudged', i4.state)

  // 无障碍双面取证:只认 secure 设置 + AMS 都命中。
  const a1 = judgeA11y({
    settingsStdout: 'zh.ai.sq/zh.ai.sq.A11yAutoInstallService\n',
    dumpStdout: 'Enabled services:{{zh.ai.sq/zh.ai.sq.A11yAutoInstallService}}',
    pkg: 'zh.ai.sq',
  })
  t('S18 双面命中 ⇒ ok', a1.state === 'ok', a1.state)
  const a2 = judgeA11y({
    settingsStdout: 'zh.ai.sq/zh.ai.sq.A11yAutoInstallService\n',
    dumpStdout: 'Enabled services:{}',
    pkg: 'zh.ai.sq',
  })
  t('S19 只有 settings 命中 ⇒ partial(不冒绿)', a2.state === 'partial', a2.state)
  const a3 = judgeA11y({ settingsStdout: 'null\n', dumpStdout: 'Enabled services:{}', pkg: 'zh.ai.sq' })
  t('S20 两面都不含 ⇒ not-enabled', a3.state === 'not-enabled', a3.state)
  const a4 = judgeA11y({ settingsStdout: '', dumpStdout: '', pkg: 'zh.ai.sq' })
  t('S21 两面都取不到 ⇒ unjudged', a4.state === 'unjudged', a4.state)

  console.log(rows.join('\n'))
  const failed = rows.filter((r) => r.startsWith('FAIL')).length
  console.log(`SELF-TEST ${rows.length - failed}/${rows.length} passed`)
  return failed ? 1 : 0
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  const argValue = (flag) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const apk = argValue('--apk')
  if (!apk) {
    console.error('用法: --apk <path> [--serial <s>] [--dry-run] [--json] [--allow-debug-signing] [--skip-a11y] [--self-test]')
    return EXIT.UNJUDGED
  }
  if (!existsSync(apk)) {
    console.error(`待装 APK 不存在:${resolve(apk)} ⇒ 未判定`)
    return EXIT.UNJUDGED
  }
  const pkg = resolveAndroidPackage({})
  if (!pkg.ok) {
    console.error(`${pkg.error} ⇒ 未判定`)
    return EXIT.UNJUDGED
  }
  const adbInfo = resolveAdb({})
  const adb = adbInfo.path
  const devices = runAdb(adb, ['devices'])
  if (!devices.ok) {
    console.error(`adb devices 失败:${devices.error} ⇒ 未判定`)
    return EXIT.UNJUDGED
  }
  let serials = listSerials(devices.stdout)
  const want = argValue('--serial')
  if (want) serials = serials.filter((s) => s === want)
  if (!serials.length) {
    console.error(want ? `设备 ${want} 不在已授权清单里 ⇒ 未判定` : '没有已授权设备在线 ⇒ 未判定')
    return EXIT.UNJUDGED
  }
  const incoming = apkCert(apk)
  if (incoming?.error) {
    console.error(`待装 APK 证书读不出:${incoming.error} ⇒ 未判定`)
    return EXIT.UNJUDGED
  }
  const rel = expectedReleaseCert()
  const baseline = rel?.digest ?? null

  const scratch = mkdtempSync(join(tmpdir(), 'ihui-rn-cert-'))
  const results = []
  let worst = EXIT.OK
  try {
    for (const serial of serials) {
      const dev = readDeviceCert({ adb, serial, pkg: pkg.pkg, scratch })
      const v = judgeInstall({
        deviceDigest: dev.digest,
        deviceDn: dev.dn,
        incomingDigest: incoming.digest,
        incomingDn: incoming.dn,
        releaseBaseline: baseline,
        allowDebugSigning: argv.includes('--allow-debug-signing'),
      })
      const rec = { serial, pkg: pkg.pkg, state: v.state, reasons: v.reasons, onDevice: v.onDevice, incoming: { digest: v.incoming?.digest, dn: v.incoming?.dn } }
      results.push(rec)
      if (v.state === 'unjudged') worst = Math.max(worst, EXIT.UNJUDGED)
      else if (v.state === 'refused') worst = Math.max(worst, EXIT.REFUSED)

      if (v.state === 'ok' && !argv.includes('--dry-run')) {
        const ins = runAdb(adb, ['-s', serial, 'install', '-r', resolve(apk)])
        if (!ins.ok) {
          rec.install = { ok: false, error: ins.error }
          worst = Math.max(worst, EXIT.REFUSED)
        } else {
          const back = runAdb(adb, ['-s', serial, 'shell', 'dumpsys', 'package', pkg.pkg])
          const vc = /versionCode=(\d+)/.exec(back.stdout ?? '')?.[1] ?? null
          rec.install = { ok: true, versionCodeReadback: vc }
          // 来源回读:installer=null 才证明这枚包装机后不会触发 Android 13+ 的「受限设置」。
          rec.installer = judgeInstallerSource(back.stdout ?? '')
          // 无障碍服务默认一并开启(--skip-a11y 可关):这是"装完就能自动更新"的最后一步;
          // 服务只点安装器确认键且只在界面出现本应用名时动作(边界见 withAutoInstaller.cjs)。
          if (!argv.includes('--skip-a11y')) {
            rec.a11y = enableAutoInstallA11y({ adb, serial, pkg: pkg.pkg })
          }
          if (!vc) {
            rec.install.error = '装机报成功但回读不到 versionCode ⇒ 落地未证实'
            worst = Math.max(worst, EXIT.UNJUDGED)
          }
        }
      }
    }
  } finally {
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 3 })
    } catch {
      /* 清理失败不改判据结论 */
    }
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ apk: resolve(apk), pkg: pkg.pkg, baseline, adbSource: adbInfo.source, results }, null, 2))
  } else {
    for (const r of results) {
      console.log(`[${r.state.toUpperCase()}] ${r.serial} ${r.pkg}`)
      for (const line of r.reasons) console.log(`   · ${line}`)
      if (r.install) console.log(`   · install=${r.install.ok ? 'ok' : 'FAILED'} versionCode=${r.install.versionCodeReadback ?? '-'}${r.install.error ? ` err=${r.install.error}` : ''}`)
      if (r.installer) console.log(`   · installer=${r.installer.state}${r.installer.installer ? ` (${r.installer.installer})` : ''} — ${r.installer.reason}`)
      if (r.a11y) console.log(`   · a11y=${r.a11y.state} ${r.a11y.component ?? ''} — ${r.a11y.reason ?? ''}`)
    }
    console.log(`INSTALL-RESULT state=${results.every((r) => r.state === 'ok') ? 'ok' : results.some((r) => r.state === 'refused') ? 'refused' : 'unjudged'} exit=${worst} 设备数=${results.length}`)
  }
  return worst
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(EXIT.UNJUDGED)
  }
}

export const __test__ = { judgeInstall, readDeviceCert, EXIT, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
