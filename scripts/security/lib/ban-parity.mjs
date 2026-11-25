// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 封禁双腿对账的**纯判据**(零 IO、零网络),执行层在 scripts/security/check-ban-parity.mjs。
//
// 为什么需要这把尺子:同一条封禁落在两个地方 —— 本机 Windows 防火墙(真丢包)与
// EdgeOne 的边缘 IP 黑名单(先于回源丢弃)。两边各自有写入路径,却没有东西核对
// "两边都在"。EO 那侧依赖凭据 + 外网,一旦推送失败或凭据轮换,本机完全看不出来:
// 名单上写着 41 个 IP,边缘其实一个没封 —— 而任何人读本机都只会看到"在册 41"。
//
// 本判据不自己算"应当封谁"。口径必须与 sync-edge-blocklist / autoban 完全同源
// (§0.6 单一真相源),所以调用方把 selectEdgeTargets 的结果传进来,这里只比对。
// 自己再算一份"应当",迟早会和真正写规则的那一份漂开。

export const BAN_PARITY_STATE = {
  OK: 'ok',
  DRIFT: 'drift',
  /** 防火墙已判、EO 读不到 —— 不是 ok,也不是 drift,是"只判了一半"。 */
  PARTIAL: 'partial',
  UNDETERMINED: 'undetermined',
}

export const FW_ATK_PREFIX = 'IHUI-DENY-ATK-'

/** 规则名里点号被替换成了连字符,反解时必须按**位置**还原,不能靠猜。 */
export function ipFromFwRuleName(name, prefix = FW_ATK_PREFIX) {
  const s = String(name ?? '')
  if (!s.startsWith(prefix)) return null
  const tail = s.slice(prefix.length)
  // 4 段十进制 + 3 个连字符;IPv6 不在此列(现网封禁全是 IPv4)。
  const parts = tail.split('-')
  if (parts.length !== 4) return null
  if (!parts.every((p) => /^\d{1,3}$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.some((n) => n > 255)) return null
  return nums.join('.')
}

/**
 * 解析 `netsh advfirewall firewall show rule name=all` 的文本输出。
 * 本机实测是英文表头;这里同时认中文表头 —— 换一台机器不该让尺子变成瞎的。
 * 只认 IHUI-DENY-ATK-*:别人的规则一条都不进判据。
 */
export function parseNetshAtkRules(text, prefix = FW_ATK_PREFIX) {
  const lines = String(text ?? '').split(/\r?\n/)
  const nameRe = /^(?:Rule Name|规则名称)\s*[:：]\s*(.+)$/i
  const enabledRe = /^(?:Enabled|已启用)\s*[:：]\s*(.+)$/i
  const actionRe = /^(?:Action|操作)\s*[:：]\s*(.+)$/i
  const rules = []
  let cur = null
  const flush = () => {
    if (!cur) return
    const ip = ipFromFwRuleName(cur.name, prefix)
    if (ip) rules.push({ ip, name: cur.name, enabled: cur.enabled ?? null, action: cur.action ?? null })
    cur = null
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const mName = line.match(nameRe)
    if (mName) {
      flush()
      cur = { name: mName[1].trim() }
      continue
    }
    if (!cur) continue
    const mEn = line.match(enabledRe)
    if (mEn) {
      cur.enabled = /^(yes|是|true|1)$/i.test(mEn[1].trim())
      continue
    }
    const mAct = line.match(actionRe)
    if (mAct) cur.action = mAct[1].trim()
  }
  flush()
  return rules
}

/** 一条规则承载多个 IP(MatchContent 逗号多值);判据只看"这些 IP 在不在被封集合里"。 */
export function ipsOfEdgeRules(rules) {
  const out = new Set()
  for (const r of rules ?? []) {
    for (const ip of String(r?.MatchContent ?? '').split(',')) {
      const t = ip.trim()
      if (t) out.add(t)
    }
  }
  return out
}

/**
 * 三面比对。
 *   want    = 应当被封的(来自 selectEdgeTargets,口径同源)
 *   cooling = 在册但还在冷却期的(selectEdgeTargets 的 tooFresh 那一档)
 *   fw      = 本机防火墙实际
 *   edge    = 边缘实际(读不到时传 null,并且 edgeReadable=false)
 *
 * 犯规分两类,语义不同:漏封(missing)是防线缺口,残留(extra)是"名单已放过他但还封着"。
 * 残留同样要报 —— 一个早该解封的 IP 还在被封,是误伤,而且没人会主动去查。
 *
 * cooling 为什么必须单独给:冷却期只挡"什么时候推边缘",不挡"该不该封"。它在防火墙里
 * 有规则、在边缘里还没有,这是设计如此。若把它算成 extraOnFw,每封一个新 IP 都会报一次
 * 假 drift,并寄一封假告警 —— 报警一多就没人看了,真 drift 反而被淹掉。
 */
export function judgeBanParity({ want = [], cooling = [], fw = [], edge = null, edgeReadable = false } = {}) {
  const wantSet = new Set((want ?? []).map((x) => String(x?.ip ?? x).trim()).filter(Boolean))
  const coolSet = new Set((cooling ?? []).map((x) => String(x?.ip ?? x).trim()).filter(Boolean))
  // 防火墙这一面要求"在册的全都封住",冷却中的也算在册。
  const fwExpect = new Set([...wantSet, ...coolSet])
  // `Enabled: No` 的规则**不算封住** —— 它在册、看得见、但一个包也不丢。报"漏封"才对。
  const fwSet = new Set(
    (fw ?? [])
      .filter((x) => x?.enabled !== false)
      .map((x) => String(x?.ip ?? x).trim())
      .filter(Boolean),
  )
  const fwDisabled = (fw ?? [])
    .filter((x) => x?.enabled === false)
    .map((x) => String(x?.ip ?? x).trim())
    .filter(Boolean)
    .sort()

  const missingOnFw = [...fwExpect].filter((ip) => !fwSet.has(ip)).sort()
  const extraOnFw = [...fwSet].filter((ip) => !fwExpect.has(ip)).sort()

  let missingOnEdge = null
  let extraOnEdge = null
  if (edgeReadable) {
    const edgeSet = edge instanceof Set ? edge : new Set([...(edge ?? [])].map((x) => String(x).trim()))
    // 边缘这一面只要求 wantSet:冷却中的 IP 允许还没推上去。
    missingOnEdge = [...wantSet].filter((ip) => !edgeSet.has(ip)).sort()
    extraOnEdge = [...edgeSet].filter((ip) => !fwExpect.has(ip)).sort()
  }

  const fwAligned = missingOnFw.length === 0 && extraOnFw.length === 0
  const edgeAligned = edgeReadable && missingOnEdge.length === 0 && extraOnEdge.length === 0

  let state
  if (!fwAligned) state = BAN_PARITY_STATE.DRIFT
  else if (!edgeReadable) state = BAN_PARITY_STATE.PARTIAL
  else if (!edgeAligned) state = BAN_PARITY_STATE.DRIFT
  else state = BAN_PARITY_STATE.OK

  const faces = {
    fw: { judged: true, aligned: fwAligned, count: fwSet.size },
    edge: { judged: edgeReadable, aligned: edgeReadable ? edgeAligned : null, count: edgeReadable ? (edge instanceof Set ? edge.size : new Set([...(edge ?? []).map(String)]).size) : null },
  }

  return {
    state,
    wantCount: wantSet.size,
    /** 冷却中(防火墙已封、边缘按设计尚未推)的数量 —— 读数时要能把它与真差异分开。 */
    coolingCount: coolSet.size,
    missingOnFw,
    extraOnFw,
    fwDisabled,
    missingOnEdge,
    extraOnEdge,
    faces,
    /** 只判了一半时说清楚哪一面没判 —— 不许把 partial 读成 ok(§0.3)。 */
    unjudged: edgeReadable ? [] : ['edge'],
  }
}

export function describeParity(v) {
  if (!v) return '未判定'
  if (v.state === BAN_PARITY_STATE.OK) return `${v.wantCount} 个 IP 两面逐条一致`
  if (v.state === BAN_PARITY_STATE.PARTIAL) return `防火墙已对齐(${v.wantCount} 个),边缘未判定(${v.unjudged.join('/')})`
  if (v.state === BAN_PARITY_STATE.UNDETERMINED) return '未判定'
  const bits = []
  if (v.missingOnFw.length) bits.push(`防火墙漏封 ${v.missingOnFw.length}`)
  if (v.extraOnFw.length) bits.push(`防火墙残留 ${v.extraOnFw.length}`)
  if (v.missingOnEdge?.length) bits.push(`边缘漏封 ${v.missingOnEdge.length}`)
  if (v.extraOnEdge?.length) bits.push(`边缘残留 ${v.extraOnEdge.length}`)
  return bits.join(' · ') || '差异待查'
}

export const __test__ = { ipFromFwRuleName, parseNetshAtkRules, ipsOfEdgeRules, judgeBanParity, describeParity }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
