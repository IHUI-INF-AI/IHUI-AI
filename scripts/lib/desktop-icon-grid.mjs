// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面图标网格判据层(零 IO)。
 *
 * 立因:Windows 11 在显示器拓扑变化后会自行把桌面图标档重算成 96,而 `WindowMetrics\IconSpacing`
 * 压不住它 —— 2026-10-27 实测对照:同一份格距值下 bag 48 ⇒ 格距 100px,bag 96 ⇒ 格距 164px。
 * 所以唯一杠杆是 `HKCU\Software\Microsoft\Windows\Shell\Bags\1\Desktop\IconSize`。
 *
 * 本文件不读注册表、不起进程、不判"该不该自愈"的因果,只把输入折成三态结论;
 * 现场量法见 scripts/check-desktop-icon-size.mjs 与 scripts/lib/desktop-icon-grid.ps1。
 */

export const BAG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Bags\\1\\Desktop'
export const TOPOLOGY_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\Configuration'

/** Explorer 桌面视图认的这些档;不在表里的值 = 读数不可解释 ⇒ 未判定,不猜。 */
export const ICON_SIZE_TIERS = Object.freeze([16, 24, 32, 48, 64, 96, 128, 192, 256])

/** 本机 100% 缩放实测锚点(2026-10-27,SysListView32 相邻项 y 差)。仅用于报表,不参与判定。 */
export const MEASURED_PITCH_PX = Object.freeze({ 32: 86, 48: 100, 64: 118, 96: 164, 128: 196 })

export const TIER_NAMES = Object.freeze({ 32: '小图标', 48: '中等图标', 64: '中等偏大', 96: '大图标', 128: '超大图标', 256: '极大图标' })

/** 改档与拓扑写入相隔这么多秒以内 ⇒ 判成"Windows 随换屏重算",不是人手动作。 */
export const TOPOLOGY_COUPLING_WINDOW_SEC = 120

export function isIconTier(size) {
  return Number.isInteger(size) && ICON_SIZE_TIERS.includes(size)
}

export function pitchForTier(size) {
  return Object.prototype.hasOwnProperty.call(MEASURED_PITCH_PX, size) ? MEASURED_PITCH_PX[size] : null
}

/**
 * 判输入是否齐备。任何一项取不到都必须落到 undetermined 并点名缺什么 ——
 * "没判"不得写成"判过",也不得用 0 冒充"没改过"。
 */
export function missingInputs({ liveSize, preferredSize, topologyStamps }) {
  const missing = []
  if (!Number.isInteger(liveSize)) missing.push('liveSize(bag IconSize 整数)')
  else if (!isIconTier(liveSize)) missing.push(`liveSize(${liveSize} 不在 Explorer 档位表内)`)
  if (!Number.isInteger(preferredSize)) missing.push('preferredSize(偏好档)')
  else if (!isIconTier(preferredSize)) missing.push(`preferredSize(${preferredSize} 不在档位表内)`)
  if (!Array.isArray(topologyStamps)) missing.push('topologyStamps( GraphicsDrivers\\Configuration 子键时刻数组)')
  return missing
}

/**
 * 结论三态:ok(当前档=偏好档)/ drift(不一致,附成因)/ undetermined(输入不全)。
 * 成因只有一条判据:最近一次改档时刻是否落在某次拓扑写入的 ±TOPOLOGY_COUPLING_WINDOW_SEC 内。
 */
export function classify({ liveSize, preferredSize, bagWrittenAt, topologyStamps, now } = {}) {
  const missing = missingInputs({ liveSize, preferredSize, topologyStamps })
  if (missing.length > 0) {
    return { state: 'undetermined', reason: `取不到:${missing.join(' / ')}`, liveSize, preferredSize }
  }
  if (!(bagWrittenAt instanceof Date) || Number.isNaN(bagWrittenAt.getTime())) {
    return { state: 'undetermined', reason: '取不到:bagWrittenAt(改档时刻)', liveSize, preferredSize }
  }
  const base = { liveSize, preferredSize, pitchPx: pitchForTier(liveSize), bagWrittenAt: bagWrittenAt.toISOString() }
  if (liveSize === preferredSize) {
    return { state: 'ok', ...base, cause: null, nearestTopologySec: null }
  }
  const coupling = nearestTopologyGap(bagWrittenAt, topologyStamps)
  if (coupling.missing) {
    return { state: 'drift', ...base, cause: 'cause-undetermined', nearestTopologySec: null }
  }
  const coupled = coupling.gapSec !== null && Math.abs(coupling.gapSec) <= TOPOLOGY_COUPLING_WINDOW_SEC
  return {
    state: 'drift',
    ...base,
    cause: coupled ? 'topology-rederive' : 'user-gesture-or-unknown',
    nearestTopologySec: coupling.gapSec,
  }
}

/** 与最近一次拓扑写入相隔多少秒(带符号:正=拓扑写在后)。全部时刻无效 ⇒ {missing:true}。 */
export function nearestTopologyGap(at, stamps) {
  const times = (stamps || [])
    .map((s) => (s instanceof Date ? s : new Date(s)))
    .filter((d) => !Number.isNaN(d.getTime()))
  if (times.length === 0) return { missing: true, gapSec: null }
  const origin = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(origin.getTime())) return { missing: true, gapSec: null }
  let best = null
  for (const t of times) {
    const gap = (t.getTime() - origin.getTime()) / 1000
    if (best === null || Math.abs(gap) < Math.abs(best)) best = gap
  }
  return { missing: false, gapSec: best }
}

/**
 * 偏好档登记件的形状:必须带来源与到期日 —— 豁免/钉值都会到期,不留到期日就是静默腐烂。
 */
export function readPreferenceShape(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['偏好件不是对象'] }
  const errors = []
  if (!isIconTier(raw.iconSize)) errors.push(`iconSize=${raw.iconSize} 不在档位表内`)
  if (typeof raw.reason !== 'string' || raw.reason.trim().length < 10) {
    errors.push(`reason 缺失或短于 10 字(${raw.reason ?? 'null'})`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw.reviewBy ?? ''))) errors.push(`reviewBy 形态不是 YYYY-MM-DD(${raw.reviewBy ?? 'null'})`)
  if (!(raw.reviewBy instanceof Date ? raw.reviewBy : new Date(`${raw.reviewBy}T23:59:59`)) || Number.isNaN(new Date(`${raw.reviewBy}T23:59:59`).getTime())) {
    errors.push('reviewBy 解析不出时刻')
  } else if (new Date(`${raw.reviewBy}T23:59:59`).getTime() < Date.now()) {
    errors.push(`reviewBy=${raw.reviewBy} 已到期,需人重钉`)
  }
  return { ok: errors.length === 0, errors }
}

/** 派发层唯一认这一行,不靠中文文案猜。 */
export function verdictLine(v) {
  const parts = [`state=${v.state}`, `live=${v.liveSize ?? 'null'}`, `preferred=${v.preferredSize ?? 'null'}`]
  if (v.cause) parts.push(`cause=${v.cause}`)
  if (v.pitchPx) parts.push(`pitch=${v.pitchPx}`)
  if (typeof v.nearestTopologySec === 'number') parts.push(`topo_gap=${Math.round(v.nearestTopologySec)}`)
  if (v.state === 'undetermined') parts.push(`reason=${(v.reason || '未说明').replace(/\s+/g, '_')}`)
  return `DESKTOP-ICON-STATE ${parts.join(' ')}`
}

export const __test__ = {
  BAG_KEY,
  TOPOLOGY_KEY,
  ICON_SIZE_TIERS,
  MEASURED_PITCH_PX,
  TOPOLOGY_COUPLING_WINDOW_SEC,
  TIER_NAMES,
  isIconTier,
  pitchForTier,
  missingInputs,
  classify,
  nearestTopologyGap,
  readPreferenceShape,
  verdictLine,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
