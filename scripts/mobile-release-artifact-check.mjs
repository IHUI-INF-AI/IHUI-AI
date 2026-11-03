#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn 产物验收:签名 + 体积基线(2026-11-03 立)。
 *
 * 立因(现读,非推测):
 *   · `apps/mobile-rn/android/app/build.gradle` 在 `IHUI_RELEASE_*` 缺失时**静默回退 debug 签名**,
 *     旧构建脚本只 `Write-Warning`「验签失败」,不中止 ⇒ debug 签名的包照样被发布成正式包。
 *   · 旧脚本无 AAB 产物、无体积基线 ⇒ 「包变大」只能等下一个人装上手机才发现。
 *
 * 判据(release 档):
 *   1. APK: `apksigner verify --print-certs` 必须退出 0;
 *   2. APK 签名证书 SHA-256 必须等于 `~/.gradle/gradle.properties` 指向的正式 keystore 证书
 *      ⇒ **debug 签名或换签名一律判失败**(debug 证书指纹单独点名);
 *   3. AAB: `jarsigner -verify` 退出 0,且 `keytool -printcert -jarfile` 的证书指纹同样等于正式证书;
 *   4. 体积:对 `scripts/data/mobile-release-size-baseline.json` 比较,超 +15% 告警、超 +30% 判红;
 *      基线只在显式 `--update-baseline` 时才写(还必须在签名全部通过之后)。
 *
 * dev 档(`--mode dev`):只验证签名有效性并打印证书,不比对正式 keystore、不判体积 ——
 *   给 CI 的 dev 包用(该产物禁发布到 Release,见 mobile-apk-build.yml 头注)。
 *
 * 纪律:keystore 密码只经 `-storepass:env` 传给 keytool,**不进命令行、不打印**。
 *
 * 用法:
 *   node scripts/mobile-release-artifact-check.mjs --apk <apk> --aab <aab> [--version-code N] [--update-baseline]
 *   node scripts/mobile-release-artifact-check.mjs --mode dev --apk <apk> [--aab <aab>]
 *   node scripts/mobile-release-artifact-check.mjs --apk <apk> --aab <aab> --skip-signature   # 只做体积(应急)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const GATE = 'mobile-release-artifact-check'
export const BASELINE_REL = 'scripts/data/mobile-release-size-baseline.json'
export const WARN_RATIO = 0.15
export const FAIL_RATIO = 0.30
/** Android 模板 debug.keystore 的证书 SHA-256(公开指纹,仅用于点名"这是 debug 签名") */
export const DEBUG_CERT_SHA256 = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'

const norm = (s) => String(s ?? '').replace(/[: ]/g, '').toLowerCase()

function argValue(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}

function runCmd(cmdLine, env = process.env) {
  return spawnSync(cmdLine, { shell: true, encoding: 'utf8', windowsHide: true, env })
}

function findBuildTool(name) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || ''
  const exts = process.platform === 'win32' ? ['.bat', '.exe', ''] : ['']
  if (sdk) {
    const dir = join(sdk, 'build-tools')
    if (existsSync(dir)) {
      const versions = readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      for (const v of versions) {
        for (const ext of exts) {
          const p = join(dir, v, name + ext)
          if (existsSync(p)) return p
        }
      }
    }
  }
  return null
}

function findJdkTool(name) {
  const jh = process.env.JAVA_HOME || ''
  if (jh) {
    for (const ext of process.platform === 'win32' ? ['.exe', ''] : ['']) {
      const p = join(jh, 'bin', name + ext)
      if (existsSync(p)) return p
    }
  }
  return name // 交给 PATH
}

/** 读 ~/.gradle/gradle.properties 的单键值;不打印值。 */
function readGradleProp(key) {
  const file = join(homedir(), '.gradle', 'gradle.properties')
  if (!existsSync(file)) return ''
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('!')) continue
    const i = t.search(/[=:]/)
    if (i < 0) continue
    if (t.slice(0, i).trim() !== key) continue
    return t
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  }
  return ''
}

/** 正式 keystore 证书 SHA-256(hex)。凭据缺失/读取失败返回 error 文本(绝不回显密码)。 */
export function expectedReleaseCert() {
  const storeFile = readGradleProp('IHUI_RELEASE_STORE_FILE')
  const storePass = readGradleProp('IHUI_RELEASE_STORE_PASSWORD')
  if (!storeFile || !storePass) {
    return { error: '正式签名凭据缺失:~/.gradle/gradle.properties 缺 IHUI_RELEASE_STORE_FILE 或 IHUI_RELEASE_STORE_PASSWORD' }
  }
  const ks = isAbsolute(storeFile) ? storeFile : resolve(join(ROOT, 'apps/mobile-rn/android/app'), storeFile)
  if (!existsSync(ks)) return { error: `正式 keystore 不存在:${ks}` }
  const keytool = findJdkTool('keytool')
  const alias = readGradleProp('IHUI_RELEASE_KEY_ALIAS')
  const cmd = `"${keytool}" -list -v -keystore "${ks}" -storepass:env IHUI_RELEASE_STORE_PASSWORD${alias ? ` -alias "${alias}"` : ''}`
  const r = runCmd(cmd, { ...process.env, IHUI_RELEASE_STORE_PASSWORD: storePass })
  if (r.status !== 0) {
    return { error: `keytool 读不出正式 keystore 证书(exit ${r.status}):${(r.stderr || '').trim().slice(0, 300)}` }
  }
  const m = /SHA256:\s*((?:[0-9A-F]{2}:){31}[0-9A-F]{2})/i.exec(r.stdout || '')
  if (!m) return { error: 'keytool 输出里没有 SHA256 指纹(形态变了?拒绝猜)' }
  return { digest: norm(m[1]), keystore: ks }
}

/** APK 签名信息。 */
export function apkCert(apk) {
  const tool = findBuildTool('apksigner')
  if (!tool) return { error: 'ANDROID_HOME/build-tools 下找不到 apksigner(无法验签)' }
  const r = runCmd(`"${tool}" verify --print-certs "${apk}"`)
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  if (r.status !== 0) return { error: `apksigner verify 失败(exit ${r.status})` }
  const digest = /Signer #1 certificate SHA-256 digest:\s*([0-9a-f]+)/i.exec(out)?.[1] ?? null
  const dn = /Signer #1 certificate DN:\s*(.+)/.exec(out)?.[1]?.trim() ?? null
  if (!digest) return { error: 'apksigner 输出里没有 Signer #1 SHA-256(形态变了?拒绝猜)' }
  return { digest: norm(digest), dn }
}

/** AAB 的 jar 签名 + 证书信息。 */
export function aabCert(aab) {
  const jarsigner = findJdkTool('jarsigner')
  const v = runCmd(`"${jarsigner}" -verify "${aab}"`)
  if (v.status !== 0) return { error: `jarsigner -verify 失败(exit ${v.status}):AAB 未签名或签名损坏` }
  const keytool = findJdkTool('keytool')
  const c = runCmd(`"${keytool}" -printcert -jarfile "${aab}"`)
  if (c.status !== 0) return { error: `keytool -printcert -jarfile 失败(exit ${c.status})` }
  const m = /SHA256:\s*((?:[0-9A-F]{2}:){31}[0-9A-F]{2})/i.exec(c.stdout || '')
  if (!m) return { error: 'AAB 签名证书里没有 SHA256 指纹(形态变了?拒绝猜)' }
  return { digest: norm(m[1]) }
}

/**
 * 纯判据:产物证书 vs 正式证书。debug 证书单独点名(它正是当前发布链的隐患)。
 * @returns {{ok: bool, problems: string[]}}
 */
export function judgeCert({ actual, expected, debug = DEBUG_CERT_SHA256 }) {
  if (!actual) return { ok: false, problems: ['取不到产物签名证书'] }
  if (norm(actual) === norm(debug)) {
    return { ok: false, problems: ['产物用 Android debug 证书签名(debug.keystore)—— 禁止作为正式包发布'] }
  }
  if (!expected) return { ok: false, problems: ['取不到正式签名证书基线,无法判定签名一致性'] }
  if (norm(actual) !== norm(expected)) {
    return { ok: false, problems: [`签名证书不一致:产物 ${norm(actual)} ≠ 正式 keystore ${norm(expected)}`] }
  }
  return { ok: true, problems: [] }
}

/**
 * 纯判据:体积 vs 基线。超 +30% 红,超 +15% 告警(严格大于阈值)。
 * @returns {{level: 'ok'|'warn'|'fail'|'no-baseline', delta: number|null}}
 */
export function judgeSize({ bytes, baseBytes, warn = WARN_RATIO, fail = FAIL_RATIO }) {
  if (!Number.isFinite(baseBytes) || baseBytes <= 0) return { level: 'no-baseline', delta: null }
  const delta = bytes / baseBytes - 1
  // 阈值边界用整数交叉相乘判:130/100 的浮点差是 0.30000000000000004,
  // 直接 delta > 0.3 会把"恰好 +30%"误判成红(阈值语义是"超",不是"达到")。
  const failPct = Math.round(fail * 100)
  const warnPct = Math.round(warn * 100)
  if (bytes * 100 > baseBytes * (100 + failPct)) return { level: 'fail', delta }
  if (bytes * 100 > baseBytes * (100 + warnPct)) return { level: 'warn', delta }
  return { level: 'ok', delta }
}

function readBaseline(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function fmtMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.info('用法:node scripts/mobile-release-artifact-check.mjs --apk <apk> [--aab <aab>] [--mode release|dev] [--version-code N] [--update-baseline] [--skip-signature]')
    return 0
  }
  const apk = argValue(argv, '--apk')
  const aab = argValue(argv, '--aab')
  const mode = argValue(argv, '--mode') || 'release'
  const versionCode = argValue(argv, '--version-code')
  const update = argv.includes('--update-baseline')
  const skipSig = argv.includes('--skip-signature')
  if (mode !== 'release' && mode !== 'dev') {
    console.error(`[${GATE}] ❌ --mode 只能是 release 或 dev(实得 ${mode})`)
    return 1
  }
  if (!apk || !existsSync(apk)) {
    console.error(`[${GATE}] ❌ APK 不存在:${apk || '(未给 --apk)'}`)
    return 1
  }
  if (mode === 'release' && !aab) {
    console.error(`[${GATE}] ❌ release 档必须同时给 --aab(本次产物集不完整)`)
    return 1
  }
  if (aab && !existsSync(aab)) {
    console.error(`[${GATE}] ❌ AAB 不存在:${aab}`)
    return 1
  }

  const problems = []
  const warnings = []
  const apkInfo = skipSig ? null : apkCert(apk)
  const aabInfo = !skipSig && aab ? aabCert(aab) : null
  // 正式证书只读一次:两件产物必须对同一份 keystore,读两次等于给"两次之间变量被换"留缝。
  const releaseExp = !skipSig && mode === 'release' ? expectedReleaseCert() : null

  if (skipSig) {
    warnings.push('已用 --skip-signature 跳过验签(应急档,不作为常态)')
  } else if (apkInfo.error) {
    problems.push(`APK:${apkInfo.error}`)
  } else if (mode === 'release') {
    if (releaseExp.error) problems.push(`APK:${releaseExp.error}`)
    else {
      const v = judgeCert({ actual: apkInfo.digest, expected: releaseExp.digest })
      if (!v.ok) problems.push(...v.problems.map((p) => `APK:${p}`))
      else console.info(`  APK 签名证书:${apkInfo.dn || '-'} / SHA-256 ${releaseExp.digest} ✓`)
    }
  } else {
    console.warn(`  ⚠️ dev 档只验签名有效性(不比对正式 keystore):${apkInfo.dn || '-'} / SHA-256 ${apkInfo.digest}`)
  }

  if (!skipSig && aab) {
    if (aabInfo.error) problems.push(`AAB:${aabInfo.error}`)
    else if (mode === 'release') {
      if (releaseExp.error) problems.push(`AAB:${releaseExp.error}`)
      else {
        const v = judgeCert({ actual: aabInfo.digest, expected: releaseExp.digest })
        if (!v.ok) problems.push(...v.problems.map((p) => `AAB:${p}`))
        else console.info(`  AAB 签名证书:SHA-256 ${releaseExp.digest} ✓`)
      }
    } else {
      console.warn(`  ⚠️ dev 档只验 AAB 签名有效性:SHA-256 ${aabInfo.digest}`)
    }
  }

  // 体积基线:签名全过之后才允许写(签名不过的产物不该成为基线)
  const baselineFile = join(ROOT, BASELINE_REL)
  const baseline = readBaseline(baselineFile) ?? { entries: {} }
  const artifacts = [['apk', apk], ...(aab ? [['aab', aab]] : [])]
  const sizes = {}
  for (const [kind, path] of artifacts) {
    const bytes = statSync(path).size
    sizes[kind] = bytes
    const baseBytes = baseline.entries?.[kind]?.bytes
    if (mode === 'dev') {
      console.info(`  ${kind.toUpperCase()} 体积:${fmtMB(bytes)}(${bytes} 字节,dev 档不判基线)`)
      continue
    }
    const v = judgeSize({ bytes, baseBytes })
    if (v.level === 'no-baseline') {
      if (update) {
        console.info(`  ${kind.toUpperCase()} 体积:${fmtMB(bytes)} —— 基线首次登记`)
      } else {
        warnings.push(`${kind.toUpperCase()}:基线未登记(首次记录需显式 --update-baseline)`)
        console.info(`  ${kind.toUpperCase()} 体积:${fmtMB(bytes)} —— 基线未登记`)
      }
    } else if (v.level === 'fail') {
      problems.push(
        `${kind.toUpperCase()} 体积 ${fmtMB(bytes)} 超基线(${fmtMB(baseBytes)})+${(FAIL_RATIO * 100).toFixed(0)}% 阈值(实增 ${(v.delta * 100).toFixed(1)}%)`,
      )
    } else if (v.level === 'warn') {
      warnings.push(
        `${kind.toUpperCase()} 体积 ${fmtMB(bytes)} 超基线(${fmtMB(baseBytes)})+${(WARN_RATIO * 100).toFixed(0)}% 阈值(实增 ${(v.delta * 100).toFixed(1)}%)`,
      )
    } else {
      console.info(`  ${kind.toUpperCase()} 体积:${fmtMB(bytes)}(基线 ${fmtMB(baseBytes)},Δ ${(v.delta * 100).toFixed(1)}%)✓`)
    }
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`  ❌ ${p}`)
    console.error(`[${GATE}] ❌ 产物不合格(${problems.length} 项)—— 不发布、不登记基线`)
    return 1
  }

  if (update && mode === 'release') {
    const entries = { ...(baseline.entries || {}) }
    for (const [kind, bytes] of Object.entries(sizes)) {
      entries[kind] = { bytes, ...(versionCode ? { versionCode: Number(versionCode) } : {}) }
    }
    const next = {
      updatedAt: new Date().toISOString(),
      policy: { warnRatio: WARN_RATIO, failRatio: FAIL_RATIO },
      entries,
    }
    writeFileSync(baselineFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    console.info(`  基线已更新:${BASELINE_REL}`)
  } else if (update && mode === 'dev') {
    warnings.push('dev 档忽略 --update-baseline(dev 包不得污染正式体积基线)')
    console.warn(`  ⚠️ ${warnings[warnings.length - 1]}`)
  } else if (mode === 'release' && problems.length === 0) {
    console.info(`  基线未改写(需要改写请显式 --update-baseline):${BASELINE_REL}`)
  }

  for (const w of warnings) console.warn(`  ⚠️ ${w}`)
  console.info(`[${GATE}] ✅ 产物验收通过(${mode} 档,${artifacts.map(([k, p]) => `${k}=${p}`).join(', ')})`)
  return 0
}

// §22d
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = { judgeCert, judgeSize, apkCert, aabCert, expectedReleaseCert, GATE, BASELINE_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
