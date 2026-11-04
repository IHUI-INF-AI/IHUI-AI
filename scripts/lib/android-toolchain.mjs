// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Android 工具链与包名单源定位(2026-11-04 立)。
 *
 * 为什么要单独成模块:装机前签名对账需要 adb,而仓内 adb 路径解析此前已有四份互不一致的实现
 *   · scripts/dev-stack.mjs            硬编码仓内 .android-toolchain,不看 env
 *   · scripts/start-mobile-rn-android.ps1  ANDROID_HOME 缺失时回落到硬编码用户盘符
 *   · scripts/build-mobile-rn-release.ps1  只认 PATH,拿不到就静默回落 versionCode=1
 *   · scripts/mobile-release-artifact-check.mjs 的 findBuildTool(未 export)
 * 第五份手写副本只会让漂移继续(AGENTS §0.6)。本模块是**新增代码**唯一许可的 adb/包名出口;
 * 既有四处属存量,不在本票射程(它们各有已验证的失败形态,改动须另立票)。
 *
 * 候选序一律「取存在者,并报告出处」——照 scripts/lib/key-dir.mjs 的 resolveKeyDirDetailed 形态,
 * 不写死盘符(AGENTS 开篇:盘符是当次实测的机器事实)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 找 adb:env 覆盖 → ANDROID_HOME → ANDROID_SDK_ROOT → 仓内 toolchain → PATH 裸名。 */
export function resolveAdb({ env = process.env, root = REPO_ROOT } = {}) {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb'
  const candidates = []
  if (env.IHUI_ADB_BIN) candidates.push({ path: env.IHUI_ADB_BIN, source: 'IHUI_ADB_BIN' })
  for (const k of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) {
    if (env[k]) candidates.push({ path: join(env[k], 'platform-tools', exe), source: k })
  }
  candidates.push({
    path: join(root, '.android-toolchain', 'android-sdk', 'platform-tools', exe),
    source: '仓内 .android-toolchain',
  })
  candidates.push({ path: 'adb', source: 'PATH' })
  // 裸名交给 spawn 解析,这里无法判存在性 ⇒ 单列,由调用方在派生失败时归因。
  for (const c of candidates.slice(0, candidates.length - 1)) {
    if (existsSync(c.path)) return { ok: true, ...c }
  }
  const last = candidates[candidates.length - 1]
  return { ok: true, fallback: true, ...last }
}

/**
 * Android 包名:app.json 的 android.package 优先,回落 build.gradle 的 applicationId。
 * 两条都取不到 ⇒ error。空包名绝不放行:AGENTS 记过的实测事故 —— 空包名进 `dumpsys package`
 * 会 dump 全部应用,于是把无关 app 的 versionCode 当成本 app 的。
 */
export function resolveAndroidPackage({ root = REPO_ROOT } = {}) {
  const appJson = join(root, 'apps', 'mobile-rn', 'app.json')
  if (existsSync(appJson)) {
    try {
      const pkg = JSON.parse(readFileSync(appJson, 'utf8'))?.android?.package
      if (pkg && String(pkg).trim()) return { ok: true, pkg: String(pkg).trim(), source: 'app.json' }
    } catch {
      /* 落到下一条 */
    }
  }
  const gradle = join(root, 'apps', 'mobile-rn', 'android', 'app', 'build.gradle')
  if (existsSync(gradle)) {
    const m = /applicationId\s+'([^']+)'/.exec(readFileSync(gradle, 'utf8'))
    if (m) return { ok: true, pkg: m[1], source: 'build.gradle applicationId' }
  }
  return { ok: false, error: `解析不到 Android 包名:${appJson} 与 ${gradle} 都没给出 ⇒ 拒绝继续(空包名会 dump 全部应用)` }
}

/**
 * 派生 adb。§12g + 守门 199:必须显式接管 stdio 且 windowsHide;
 * 丢 stdout 又去读 ⇒ 结论恒 null,那条反向门判红。
 */
export function runAdb(adbPath, args, { spawn = spawnSync, input } = {}) {
  const stdio = input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  const r = spawn(adbPath, args, { encoding: 'utf8', windowsHide: true, timeout: 60_000, stdio })
  if (r?.error) return { ok: false, error: `adb ${args.join(' ')} 派生失败:${r.error.code ?? r.error.message}` }
  const stdout = String(r.stdout ?? '')
  const stderr = String(r.stderr ?? '')
  if (r.status !== 0) {
    return { ok: false, exit: r.status, error: `${stderr.trim() || stdout.trim()}`.slice(0, 400) }
  }
  return { ok: true, stdout, stderr }
}

/** 已授权设备序列号。多设备必须逐台问(不带 -s 在 >1 台时直接报 more than one device)。 */
export function listSerials(stdout) {
  const out = []
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const m = /^(\S+)\s+device$/.exec(line.trim())
    if (m && m[1] !== 'List') out.push(m[1])
  }
  return out
}

export const __test__ = { resolveAdb, resolveAndroidPackage, runAdb, listSerials, REPO_ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
