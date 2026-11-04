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
 *   node scripts/install-rn-on-device.mjs --apk <path>            # 对账 + 装机 + 回读
 *   node scripts/install-rn-on-device.mjs --apk <path> --dry-run  # 只对账不装
 *   node scripts/install-rn-on-device.mjs --apk <path> --json     # 机读
 *   node scripts/install-rn-on-device.mjs --self-test             # 纯判据夹具(不碰真机)
 * 退出码:0 ok / 1 refused / 2 unjudged 或用法错
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

function selfTest() {
  const rows = []
  const t = (name, cond, got = '') => rows.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ` :: ${got}`}`)
  const DEV = '62b0ff0e950125230683aacfb5d0b110d93d30a229ca5df1950a572255b82514'
  const DBG = normalizeCertDigest(DEBUG_CERT_SHA256)
  const REL = { digest: DEV, keystore: 'x' }

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
    console.error('用法: --apk <path> [--serial <s>] [--dry-run] [--json] [--allow-debug-signing] [--self-test]')
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
