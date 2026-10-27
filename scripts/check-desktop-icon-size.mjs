#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面图标档对账器(只读尺 + 具名修复出口)。
 *
 * 立因(2026-10-26/27 实测):Windows 11 在显示器拓扑变化后会自行把桌面图标重算成 96 档,
 * 桌面网格随之从 100px 涨到 164px —— 用户看到的就是"图标间距突然变大"。
 * 对照实验同时证伪了一条常见出路:`WindowMetrics\IconSpacing` 在本机压不住桌面网格
 * (同一份 -1125/-1470 下,bag 48 ⇒ 100px,bag 96 ⇒ 164px),所以唯一杠杆是 bag 的 IconSize。
 *
 * 判机器状态 ⇒ 不进提交链(AGENTS §12e:与提交内容无关的红门只会逼人 --no-verify)。
 * 唯一调度器 = git-guardian 巡检轮的 auditDesktopIconSize()。
 *
 * 失效方向:取不到任何一项输入 ⇒ state=undetermined + exit 2,绝不把"没判"写成"判过",
 * 也不把"没量到"写成"没漂移"。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { classify, readPreferenceShape, verdictLine, BAG_KEY, TIER_NAMES } from './lib/desktop-icon-grid.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HELPER = path.join(ROOT, 'scripts', 'lib', 'desktop-icon-grid.ps1')
const PREFERENCE_FILE = path.join(ROOT, 'scripts', 'data', 'desktop-icon-preference.json')

/** 跑只读 helper。取不到 JSON ⇒ 返回 null,由上层记未判定。 */
export function readGridFace() {
  try {
    const out = execFileSync('pwsh.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HELPER], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
    const line = String(out || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('{') && s.endsWith('}'))
      .pop()
    if (!line) return null
    const parsed = JSON.parse(line)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function loadPreference() {
  if (!existsSync(PREFERENCE_FILE)) return { ok: false, errors: [`偏好件不存在:${PREFERENCE_FILE}`] }
  let raw = null
  try {
    raw = JSON.parse(readFileSync(PREFERENCE_FILE, 'utf8'))
  } catch (e) {
    return { ok: false, errors: [`偏好件不是合法 JSON:${e.message}`] }
  }
  const shape = readPreferenceShape(raw)
  return shape.ok ? { ok: true, pref: raw } : { ok: false, errors: shape.errors }
}

/**
 * 纯判定:面读数 + 偏好 → 结论。修不修由 cause 决定,不在这里动手。
 * user-gesture-or-unknown ⇒ 一律不动 —— 那是用户自己在右键「查看」里选的档位,按回是打架。
 */
export function judge({ face, preference }) {
  if (!preference.ok) return { state: 'undetermined', reason: `偏好件不可用:${preference.errors.join(' / ')}` }
  if (!face) return { state: 'undetermined', reason: '取不到:helper 未产出 JSON( pwsh 不可用 / 无桌面会话 )' }
  const stamps = Array.isArray(face.topologyStamps) ? face.topologyStamps.map((s) => new Date(s)) : face.topologyStamps
  const v = classify({
    liveSize: Number.isInteger(face.iconSize) ? face.iconSize : null,
    preferredSize: preference.pref.iconSize,
    bagWrittenAt: face.bagWrittenAt ? new Date(face.bagWrittenAt) : null,
    topologyStamps: stamps,
  })
  return { ...v, measuredPitchPx: face.pitchDy, openFolderWindows: face.openFolderWindows, screen: face.cxScreen && face.cyScreen ? `${face.cxScreen}x${face.cyScreen}@${face.dpi}` : null }
}

/** 可自动动手的唯一一格:Windows 随换屏自己重算,且没有别人的浏览现场在被关掉。 */
export function isAutoRepairable(v) {
  return v.state === 'drift' && v.cause === 'topology-rederive' && Number(v.openFolderWindows) === 0
}

/** 写 bag。只按数字写,不猜路径。 */
export function writeIconSize(size) {
  try {
    execFileSync('reg.exe', ['add', BAG_KEY, '/v', 'IconSize', '/t', 'REG_DWORD', '/d', String(size), '/f'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    })
    return true
  } catch {
    return false
  }
}

/**
 * 按 pid 收尾并等外壳回来。禁止 taskkill /IM(会连带杀掉别人的同名进程)。
 * 返回 null = 未能确认外壳回来 ⇒ 上层按未判定处理,不记绿。
 */
export function restartShellByPid(pid) {
  const script = `$ErrorActionPreference='SilentlyContinue'
Stop-Process -Id ${Number(pid)} -Force
for ($i=0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 300
  $p = Get-Process explorer -ErrorAction SilentlyContinue
  if ($p) { Write-Output ("RESTORED pid=" + ($p.Id -join ',')); exit 0 }
}
Start-Process -FilePath 'explorer.exe'
for ($i=0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 300
  $p = Get-Process explorer -ErrorAction SilentlyContinue
  if ($p) { Write-Output ("STARTED pid=" + ($p.Id -join ',')); exit 0 }
}
Write-Output 'NOT_RESTORED'
exit 1`
  try {
    const out = execFileSync('pwsh.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
    const line = String(out || '').trim().split(/\r?\n/).pop() || ''
    if (/NOT_RESTORED/.test(line)) return null
    return line || 'done'
  } catch {
    return null
  }
}

/**
 * 修复:写偏好档 → 重启外壳(仅无人现场时)→ 现读复量。
 * 复量不降即报 fail,不靠"我写了"宣称成功(§14 交付前必须自主验证)。
 */
export function applyRepair({ preference, face, allowRestart = true }) {
  if (!preference.ok) return { applied: false, reason: '偏好件不可用' }
  const size = preference.pref.iconSize
  if (!writeIconSize(size)) return { applied: false, reason: `写入 ${BAG_KEY} IconSize=${size} 失败` }
  let shell = 'not-restarted'
  if (allowRestart) {
    if (!Number.isInteger(face?.explorerPid) || face.explorerPid <= 0) return { applied: false, reason: '取不到 explorerPid,无法按 pid 收尾(不按映像名杀进程)' }
    shell = restartShellByPid(face.explorerPid)
    if (!shell) return { applied: false, reason: '外壳未能确认回来 ⇒ 未判定,不记绿' }
    writeIconSize(size)
  }
  return { applied: true, size, shell }
}

export function summarize(v) {
  const tier = v.liveSize ? TIER_NAMES[v.liveSize] || `${v.liveSize}px` : '未知'
  const want = v.preferredSize ? TIER_NAMES[v.preferredSize] || `${v.preferredSize}px` : '未钉'
  const lines = []
  lines.push(`桌面图标当前档=${v.liveSize ?? '未判定'}(${tier}) 偏好档=${v.preferredSize ?? '未钉'}(${want})`)
  if (v.measuredPitchPx != null) lines.push(`实测纵向格距=${v.measuredPitchPx}px`)
  if (v.screen) lines.push(`桌面=${v.screen}`)
  if (v.cause) lines.push(`成因=${v.cause}(距最近一次拓扑写入 ${v.nearestTopologySec ?? '?'}s)`)
  if (v.reason) lines.push(`未判定原因=${v.reason}`)
  lines.push(verdictLine(v))
  return lines.join('\n')
}

function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const doApply = argv.includes('--apply')
  const noRestart = argv.includes('--no-restart')

  const preference = loadPreference()
  const face = readGridFace()
  const v = judge({ face, preference })

  if (doApply) {
    if (v.state === 'ok') {
      console.log(`桌面图标档已是偏好档 ${v.preferredSize},无需修复`)
      console.log(verdictLine(v))
      process.exit(0)
    }
    if (v.state === 'undetermined') {
      console.error(`❌ 未判定,拒绝修复:${v.reason}`)
      process.exit(2)
    }
    if (!isAutoRepairable(v) && !argv.includes('--force')) {
      console.error(`❌ 拒绝动手:成因=${v.cause}(user-gesture-or-unknown 视为用户自己的选择;确要覆盖加 --force)。开着的资源管理器窗口=${v.openFolderWindows}`)
      process.exit(1)
    }
    const r = applyRepair({ preference, face, allowRestart: !noRestart })
    if (!r.applied) {
      console.error(`❌ 修复失败:${r.reason}`)
      process.exit(2)
    }
    const after = judge({ face: readGridFace(), preference })
    console.log(summarize(after))
    console.log(`✅ 已写回偏好档 ${r.size};外壳=${r.shell}`)
    process.exit(after.state === 'ok' ? 0 : 1)
  }

  console.log(summarize(v))
  if (asJson) console.log(JSON.stringify(v))
  process.exit(v.state === 'ok' ? 0 : v.state === 'drift' ? 1 : 2)
}

const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { ROOT, HELPER, PREFERENCE_FILE, readGridFace, loadPreference, judge, isAutoRepairable, writeIconSize, applyRepair, summarize, verdictOf: classify }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
