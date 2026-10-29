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
  // 总量上限可缺(旧表);给了就必须是正数 —— 缺了只关总量这一维,不静默当成"没有总量限制"
  const totalLimitBytes = j.totalLimitBytes === undefined || j.totalLimitBytes === null ? null : num(j.totalLimitBytes)
  if (totalLimitBytes !== null && totalLimitBytes <= 0) return { ok: false, why: '容量表 totalLimitBytes 给了但不是正数' }
  // 总量水位单独可调:产物门 AB4 的告警水位是 90%,造页器必须**停在那条线之前**,
  // 否则自动链每轮都在往一台 CI 已经会喊红的交付物里加东西。
  const totalSafetyRatio = j.totalSafetyRatio === undefined || j.totalSafetyRatio === null ? null : num(j.totalSafetyRatio)
  if (totalSafetyRatio !== null && (totalSafetyRatio <= 0 || totalSafetyRatio > 1))
    return { ok: false, why: '容量表 totalSafetyRatio 必须落在 (0,1]' }
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
      totalLimitBytes,
      totalSafetyRatio,
      safetyRatio,
      bytesPerShellPage,
      roots,
      // 溢出链:语义分包装不下时按顺序改道到这里(必须都在 roots 里有测量,否则那条候选会被判"无测量")
      overflowRoots: Array.isArray(j.overflowRoots) ? j.overflowRoots.filter((r) => typeof r === 'string' && roots[r]) : [],
      // 每屏估算字节(测量表;缺项退回 bytesPerShellPage)。键 = 共享屏 spec 全路径。
      pageEstimates:
        j.pageEstimates && typeof j.pageEstimates === 'object' && !Array.isArray(j.pageEstimates) ? j.pageEstimates : {},
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
 * 过闸 + **按容量改道**(2026-10-26 立):逐枚判它还能落在哪个分包,落不下就改道到溢出分包。
 *
 * 为什么必须能改道(而不是只会 blocked):pkg-user 只剩几百 KB,而 82 枚待产里大多数按语义都归它;
 * 只挡不改道 ⇒ 闭环停在那儿等人工开分包。改道的判据只有这一处:按**每屏估算字节**(测量表缺失时
 * 退回每页边际均值)把屏装进第一个装得下的分包,顺序 = ①语义分包 ②溢出链(model.overflowRoots)。
 *
 * 返回 planned 里的改动要能被调用方直接落到接缝上(只改 4 个路由字段,页正文与路由无关):
 *   subRoot / page / route / pageRel / registryEntry.miniapp
 * 落不下(所有候选都装不下,或候选 root 没有容量测量)⇒ 进 held 并逐条点名,绝不猜。
 */
export function routePlanned(planned, { model, registryText, cap, estimates = {} }) {
  if (!model) return { ok: false, admitted: [], held: [], moves: [], why: '容量模型未判定 ⇒ 整轮不放行(不猜)' }
  const roots = Object.keys(model.roots)
  const cnt = mirrorEntriesByRoot(registryText, roots)
  if (!cnt.ok) return { ok: false, admitted: [], held: [], moves: [], why: `${cnt.why} ⇒ 整轮不放行(不猜)` }
  const target = model.limitBytes * model.safetyRatio
  // 总量维(2026-10-26 加):微信对**整档小程序**还有 20 MiB 总上限。实测落完 219 屏后合计已达
  // 18,016,705 B(86% of 20 MiB)——只判逐包会把"最后一枚装得下这包、但整档传不上去"这一型漏掉。
  const totalTarget =
    model.totalLimitBytes && model.totalSafetyRatio !== null && model.totalSafetyRatio !== undefined
      ? model.totalLimitBytes * model.totalSafetyRatio
      : model.totalLimitBytes
        ? model.totalLimitBytes * model.safetyRatio
        : null
  // 现读用量 = 测量字节 + 测量之后新落页的边际字节(按均值估,方向偏保守:估小了会让用量偏低)
  const used = {}
  for (const root of roots) {
    const r = model.roots[root]
    const delta = Math.max(0, (cnt.counts[root] ?? 0) - r.mirrorEntriesAtMeasure)
    used[root] = r.bytes + r.chunkReserveBytes + delta * model.bytesPerShellPage
  }
  let totalUsage = Object.values(used).reduce((a, b) => a + b, 0)
  const overflow = Array.isArray(model.overflowRoots) ? model.overflowRoots : []
  const admitted = []
  const held = []
  const moves = []
  const limit = Number.isFinite(cap) && cap > 0 ? cap : planned.length
  // 真实总量:各包**实测**字节(不含还没用上的新包预留),落进一个还没带共享块的新包时才把预留计进去。
  let realTotal = roots.reduce((a, r) => a + model.roots[r].bytes + Math.max(0, (cnt.counts[r] ?? 0) - model.roots[r].mirrorEntriesAtMeasure) * model.bytesPerShellPage, 0)
  const intoRoot = {}
  for (const p of planned) {
    if (admitted.length >= limit) break
    const estimate = Number.isFinite(estimates[p.spec]) ? estimates[p.spec] : model.bytesPerShellPage
    const chain = [p.subRoot, ...overflow.filter((r) => r !== p.subRoot)]
    let picked = null
    const why = []
    for (const root of chain) {
      if (!roots.includes(root)) {
        why.push(`${root} 无容量测量`)
        continue
      }
      if (used[root] + estimate > target) {
        why.push(`${root} 余量不足(已用 ${Math.round(used[root])} B / 目标 ${Math.round(target)} B,本屏约 ${estimate} B)`)
        continue
      }
      const fresh = (cnt.counts[root] ?? 0) + (intoRoot[root] ?? 0) === 0
      const reserveNow = fresh && model.roots[root].chunkReserveBytes > 0 ? model.roots[root].chunkReserveBytes : 0
      if (totalTarget !== null && realTotal + estimate + reserveNow > totalTarget) {
        held.push({ route: p.route, root, why: `小程序**总量**将超微信 20 MiB 上限(现读 ${Math.round(realTotal)} B + 本屏 ${estimate} B${reserveNow ? ` + 新包共享块预留 ${reserveNow} B` : ''} > 目标 ${Math.round(totalTarget)} B)—— 出路不是换包,是收屏` })
        picked = false
        break
      }
      picked = root
      break
    }
    if (!picked) {
      if (!held.some((h) => h.route === p.route)) held.push({ route: p.route, root: p.subRoot, why: why.join(';') })
      continue
    }
    used[picked] += estimate
    intoRoot[picked] = (intoRoot[picked] ?? 0) + 1
    realTotal += estimate + ((cnt.counts[picked] ?? 0) + intoRoot[picked] === 1 && model.roots[picked].chunkReserveBytes > 0 ? model.roots[picked].chunkReserveBytes : 0)
    if (picked !== p.subRoot) {
      const route = `${picked}/${p.page}`
      moves.push({ spec: p.spec, from: p.subRoot, to: picked, estimate })
      p.subRoot = picked
      p.route = route
      p.pageRel = `apps/miniapp-taro/src/${route}.tsx`
      if (p.registryEntry) p.registryEntry = { ...p.registryEntry, miniapp: route }
    }
    admitted.push(p)
  }
  return { ok: true, admitted, held, moves, used, totalUsage: Math.round(realTotal) }
}

export const __test__ = { parseCapacity, capacityOf, mirrorEntriesByRoot, routePlanned, CAPACITY_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
