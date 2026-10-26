// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cross-end-subpackage-capacity.mjs —— 小程序**单分包 2 MiB**容量的唯一判据(纯函数,零 IO)。
 *
 * 为什么要有它(2026-10-26 实测):跨端造页闭环每轮往 pkg-user 落 1-2 枚壳承载页,而
 * `check-artifact-budget` 只判**主包** —— 主包 78 页只涨了 46 KB,分包却从 1.53 MB 涨到
 * 3.77 MB(超微信单个分包 2 MiB 硬上限 1.8 倍,总量 8.09→13.38 MB)。也就是说:
 * 这条自动链**结构上看不见自己正在把交付物做成传不上去的形态**,失效方向是安静(§12f)。
 *
 * 判据只有一份,消费方两处:
 *   ① `land-cross-end-shell-pages.mjs` 落页前过闸(到量即 blocked,不再静默超灌);
 *   ② 测试直接 import 本文件,不复制公式(§0.6 单一真相源)。
 *
 * 数据面 = `scripts/data/cross-end-subpackage-capacity.json`(测量快照,带 sha;
 * 取不到/形态坏 ⇒ 调用方整轮 blocked —— 失效方向是"多要一次定向说明",不是"多放一次跳门",§0.10)。
 */

export const CAPACITY_REL = 'scripts/data/cross-end-subpackage-capacity.json'

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** 读形态校验:任何一项取不到就整表判坏(不逐项回落默认值 —— 默认值会让坏表读成"容量很足")。 */
export function parseCapacity(text) {
  let j
  try {
    j = JSON.parse(text)
  } catch (e) {
    return { ok: false, why: `容量表 JSON 解析不过:${String(e?.message ?? e).slice(0, 120)}` }
  }
  if (!j || typeof j !== 'object') return { ok: false, why: '容量表不是对象' }
  if (j.schema !== 1) return { ok: false, why: `容量表 schema=${String(j.schema)}(本判据只认 1)` }
  const limitBytes = num(j.limitBytes)
  const safetyRatio = num(j.safetyRatio)
  const bytesPerShellPage = num(j.bytesPerShellPage)
  if (limitBytes === null || limitBytes <= 0) return { ok: false, why: '容量表 limitBytes 取不到或非正数' }
  if (safetyRatio === null || safetyRatio <= 0 || safetyRatio > 1)
    return { ok: false, why: '容量表 safetyRatio 必须落在 (0,1]' }
  if (bytesPerShellPage === null || bytesPerShellPage <= 0)
    return { ok: false, why: '容量表 bytesPerShellPage 取不到或非正数' }
  if (!j.roots || typeof j.roots !== 'object' || Array.isArray(j.roots) || Object.keys(j.roots).length === 0)
    return { ok: false, why: '容量表 roots 为空' }
  const roots = {}
  for (const [root, v] of Object.entries(j.roots)) {
    const bytes = num(v?.bytes)
    const at = num(v?.mirrorEntriesAtMeasure)
    const reserve = v?.chunkReserveBytes === undefined ? 0 : num(v.chunkReserveBytes)
    if (bytes === null || bytes < 0 || at === null || at < 0 || reserve === null || reserve < 0) {
      return { ok: false, why: `容量表 roots['${root}'] 字段取不到(bytes/mirrorEntriesAtMeasure/chunkReserveBytes)` }
    }
    roots[root] = { bytes, mirrorEntriesAtMeasure: at, chunkReserveBytes: reserve }
  }
  return {
    ok: true,
    model: {
      schema: 1,
      measuredAtSha: String(j.measuredAtSha ?? ''),
      measuredAt: String(j.measuredAt ?? ''),
      limitBytes,
      safetyRatio,
      bytesPerShellPage,
      roots,
    },
  }
}

/**
 * 单 root 容量上限(镜像条数口径)。**与在册条数同量纲**,所以判据不必逐轮重估字节:
 *   允许新增页数 = floor((limit×safety − 实测字节 − 首包共享闭包预留) / 每页边际字节)
 *   上限 = 测量时的在册镜像条数 + 允许新增页数
 * 取不到该 root ⇒ null(调用方判"无测量 ⇒ 不放行",不猜)。
 */
export function capacityOf(model, root) {
  const r = model?.roots?.[root]
  if (!r) return null
  const usable = model.limitBytes * model.safetyRatio - r.bytes - r.chunkReserveBytes
  const extra = Math.max(0, Math.floor(usable / model.bytesPerShellPage))
  return {
    root,
    maxMirrorEntries: r.mirrorEntriesAtMeasure + extra,
    measuredBytes: r.bytes,
    limitBytes: model.limitBytes,
    safetyRatio: model.safetyRatio,
    bytesPerShellPage: model.bytesPerShellPage,
    headroomBytes: Math.round(model.limitBytes * model.safetyRatio - r.bytes),
    extraPages: extra,
  }
}

/** 最长前缀匹配统计各 root 的在册镜像条数(嵌套 root 如 pages/setting 不能被 pages 抢走)。 */
export function mirrorEntriesByRoot(registryText, roots) {
  let j
  try {
    j = JSON.parse(registryText)
  } catch (e) {
    return { ok: false, why: `registry JSON 解析不过:${String(e?.message ?? e).slice(0, 120)}` }
  }
  const entries = Array.isArray(j) ? j : Array.isArray(j?.entries) ? j.entries : null
  if (!entries) return { ok: false, why: 'registry 里取不到 entries 数组' }
  const sorted = [...roots].sort((a, b) => b.length - a.length)
  const counts = Object.fromEntries(roots.map((r) => [r, 0]))
  for (const e of entries) {
    const m = String(e?.miniapp ?? '')
    const hit = sorted.find((r) => m === r || m.startsWith(`${r}/`))
    if (hit) counts[hit] += 1
  }
  return { ok: true, counts }
}

/**
 * 过闸:按计划顺序逐枚判,凑满本轮 cap 且不越各 root 容量的才放行。
 * 返回 held 逐条点名(哪一屏、哪个 root、为什么),供结论行与日志如实打印。
 */
export function admitByCapacity(planned, { model, registryText, cap }) {
  if (!model) return { ok: false, admitted: [], held: [], why: '容量模型未判定 ⇒ 整轮不放行(不猜)' }
  const roots = Object.keys(model.roots)
  const cnt = mirrorEntriesByRoot(registryText, roots)
  if (!cnt.ok) return { ok: false, admitted: [], held: [], why: `${cnt.why} ⇒ 整轮不放行(不猜)` }
  const used = { ...cnt.counts }
  const admitted = []
  const held = []
  const limit = Number.isFinite(cap) && cap > 0 ? cap : planned.length
  for (const p of planned) {
    if (admitted.length >= limit) break
    const root = p.subRoot
    const c = capacityOf(model, root)
    if (!c) {
      held.push({ route: p.route, root, why: `root '${root}' 无容量测量 ⇒ 不放行(先按新产物更新容量表)` })
      continue
    }
    if ((used[root] ?? 0) >= c.maxMirrorEntries) {
      held.push({
        route: p.route,
        root,
        why: `${root} 已到容量上限 ${c.maxMirrorEntries} 条镜像(实测 ${c.measuredBytes} B,余量 ${c.headroomBytes} B,${c.bytesPerShellPage} B/页)`,
      })
      continue
    }
    used[root] = (used[root] ?? 0) + 1
    admitted.push(p)
  }
  return { ok: true, admitted, held, used }
}

export const __test__ = { parseCapacity, capacityOf, mirrorEntriesByRoot, admitByCapacity, CAPACITY_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
