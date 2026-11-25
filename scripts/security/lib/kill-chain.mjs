// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 杀伤链研判(2026-11-24 立)。
 *
 * 回答的问题只有一个:「他已经打到第几步了?」——这比「有人在打我」有用一个量级。
 * 判据对齐 MITRE ATT&CK 的企业战术序列,但只保留本项目真能观测到的六段:
 *
 *   recon(侦察) → initial-access(初始访问) → execution(执行) →
 *   persistence(驻留) → c2(命令控制) → exfil(外传)
 *
 * 判读的关键不是「命中了什么规则」,而是**边界有没有被越过**:
 *   · 火绒 waf 事件带 blocked 字段。blocked=false 的漏洞利用 = 请求真的进了应用,
 *     阶段必须至少记 execution(是否执行成功要看主机侧,不能替它下结论);
 *   · 全 blocked=true ⇒ 停在 initial-access,说明边界有效;
 *   · 主机侧发现(webshell 落地 / 异常外连)才是 persistence 与 c2 的**唯一**证据源 ——
 *     入口日志永远看不到这两步,不能靠猜。
 *
 * 纯函数、零 IO:可被 node:test 逐条钉住;改判据只改这一处。
 */

export const STAGES = Object.freeze(['recon', 'initial-access', 'execution', 'persistence', 'c2', 'exfil'])

/** 阶段序号;未知返回 -1。 */
export function stageIndex(stage) {
  const i = STAGES.indexOf(String(stage ?? ''))
  return i
}

/** 事件 → 阶段。认不出返回 null(不硬塞,宁可少判)。 */
export function classifyEvent(ev) {
  const kind = String(ev?.kind ?? '')
  const detail = String(ev?.detail ?? ev?.detection ?? '')
  // 主机侧三类:入口日志永远看不到,只能由 host-triage 产出
  if (kind === 'host-webshell') return 'persistence'
  if (kind === 'host-c2') return 'c2'
  if (kind === 'host-exfil') return 'exfil'
  if (kind === 'host-persistence') return 'persistence'
  // 火绒确认的 CVE 利用:已到边界,是否越过看 blocked
  if (kind === 'waf') return 'initial-access'
  if (kind === 'waf-block' || kind === 'waf-observe') {
    // 规则族决定「这是踩点还是真打」:扫描器 UA / 敏感路径 / 后台探测 = recon
    if (/scanner-ua|path-sensitive|path-admin-scan|method-trace|url-too-long|wp-admin|phpmyadmin/i.test(detail)) return 'recon'
    return 'initial-access'
  }
  if (kind === 'rate-limit' || kind === 'edge-guard') return 'recon'
  return null
}

/** 载荷意图:从规则族与 detection 推断「他要什么」。 */
export function judgeIntent(events) {
  const text = (Array.isArray(events) ? events : [])
    .map((e) => `${e?.detection ?? ''} ${e?.detail ?? ''} ${e?.rules ?? ''} ${e?.path ?? ''}`)
    .join(' ')
  if (/webshell|host-webshell/i.test(text)) return { intent: '驻留控制', confidence: 'high' }
  if (/host-c2/i.test(text)) return { intent: 'C2 回连', confidence: 'high' }
  if (/cmd-injection|ssti|java-deser|Exploit\/CVE/i.test(text)) return { intent: '拿命令执行权(挖矿/僵尸网络/后门/跳板)', confidence: 'high' }
  if (/sqli-meta|information_schema|load_file/i.test(text)) return { intent: '窃取数据库内容', confidence: 'medium' }
  if (/sqli-|xss-|xxe-|path-traversal|ssrf-|crlf-/i.test(text)) return { intent: '注入类入侵尝试', confidence: 'medium' }
  if (/scanner-ua|path-sensitive|path-admin-scan|method-trace/i.test(text)) return { intent: '资产测绘与踩点', confidence: 'medium' }
  return { intent: '未判定(证据不足以定性)', confidence: 'low' }
}

/**
 * 单实体(IP)研判。
 * 返回 { stage, entryPassed, blockedAll, confidence, hits, stages, rationale }。
 */
export function assessEntity(events) {
  const list = Array.isArray(events) ? events : []
  const stages = Object.fromEntries(STAGES.map((s) => [s, 0]))
  let furthest = -1
  let entryPassed = false
  let sawBlockedInitial = false
  const rationale = []

  for (const ev of list) {
    const stage = classifyEvent(ev)
    if (!stage) continue
    stages[stage] += 1
    const idx = stageIndex(stage)
    if (idx > furthest) furthest = idx

    if (stage === 'initial-access') {
      // blocked 只有在明确 false 时才算「进去了」;undefined 不能当 true(未判定不冒绿)
      if (ev?.blocked === false) {
        entryPassed = true
        rationale.push(`未被拦下的 ${ev?.detection ?? ev?.detail ?? '利用尝试'} 已到达应用层`)
      } else if (ev?.blocked === true) {
        sawBlockedInitial = true
      }
    }
    if (stage === 'persistence' || stage === 'c2' || stage === 'exfil') {
      entryPassed = true
      rationale.push(`主机侧发现 ${stage}: ${ev?.detail ?? ev?.path ?? ''}`)
    }
  }

  // 边界被越过 ⇒ 阶段至少 execution;但执行是否成功仍以主机侧为准,不替它升级
  if (entryPassed && furthest < stageIndex('execution')) furthest = stageIndex('execution')

  const stage = furthest >= 0 ? STAGES[furthest] : 'recon'
  const confidence = entryPassed ? 'high' : stages[stage] >= 2 || sawBlockedInitial ? 'medium' : 'low'
  if (sawBlockedInitial && !entryPassed) rationale.push('所有初始访问尝试均被拦截,停在边界')

  return {
    stage,
    entryPassed,
    blockedAll: sawBlockedInitial && !entryPassed,
    confidence,
    hits: list.length,
    stages,
    rationale,
  }
}

/** 多实体汇总:按「最远阶段 → 命中数」排序,给出分布。 */
export function summarize(entities) {
  const list = (Array.isArray(entities) ? entities : [])
    .map((e) => ({ ...e, stageIdx: stageIndex(e.stage) }))
    .sort((a, b) => b.stageIdx - a.stageIdx || b.hits - a.hits)
  const distribution = Object.fromEntries(STAGES.map((s) => [s, list.filter((e) => e.stage === s).length]))
  return {
    total: list.length,
    distribution,
    deepest: list[0] ?? null,
    breached: list.filter((e) => e.entryPassed).length,
  }
}

export const __test__ = { STAGES, stageIndex, classifyEvent, judgeIntent, assessEntity, summarize }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
