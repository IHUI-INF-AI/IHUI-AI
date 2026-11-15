// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端会话回灌腿的三态语义契约 —— 唯一真相源(2026-11-15 立)。
 *
 * 立因:11-01~11-14「号池保活腿失效」误报 30 封。生产者(sync-*-client-session.mjs)按 §0.3
 * 用「❌ ...(未判定)」自由文本表达 unjudged(exit 2),消费者(check-qoder-session-sync-task.mjs)
 * 却只认 /❌|"ok":false|"failed":[1-9]/ ⇒ 把「客户端没开」读成连续故障。历次处置全落在
 * 冷却窗口 / 族门(alert-family-gate 自述「不改各尺子的判据」),判据层零改动,窗口一回收误报即回。
 *
 * 本契约把「什么算环境未就绪」收成一份:
 *   · 生产者经 unjudgedLogLine() 写结构化标记,消费者优先读标记 —— 上游改文案不再让下游失配;
 *   · 旧日志无标记时才回退正则(CLIENT_NOT_READY_RE),存量 493 行仍可正确重放;
 *   · 硬失败(tsx 缺失 / SIGTERM 超时 / "ok":false / failed>0)永不被吞,仍走连续失败判红。
 *
 * 三态不变量:client-not-ready ⇒ 只能得到 unjudged,绝不能得到 breach(镜像测试钉死)。
 */

export const VERDICT = Object.freeze({ OK: 'ok', UNJUDGED: 'unjudged', BREACH: 'breach' })

/** 生产者写进日志行的结构化判定标记;消费者按它取语义,不猜文案。 */
export const VERDICT_MARKER_RE = /\[IHUI-VERDICT=(unjudged|undetermined);scope=(client-not-ready|undetermined)\]/g

/** 明确的环境缺席 —— 只有这几类允许判「环境未就绪」;其余未判定一律保守保留。 */
export const CLIENT_NOT_READY_RE =
  /未发现运行中的[^\n;:]*主进程|未找到[^\n;:]*数据目录|\[ZCODE_DIR_MISSING\]/

/** 生产者唯一出口:行文本与结构标记同源,上游不再自己拼「未判定」句式。 */
export function unjudgedLogLine(reason, scope) {
  const text = String(reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 400)
  const resolved = scope ?? scopeOfUnjudgedReason(text)
  return `❌ 回灌未判定: ${text} [IHUI-VERDICT=unjudged;scope=${resolved}]`
}

/** 上游按原因文本分派 scope,与消费者共用同一份正则(§0.6 不复制第二份规则)。 */
export function scopeOfUnjudgedReason(reason) {
  return CLIENT_NOT_READY_RE.test(String(reason ?? '')) ? 'client-not-ready' : 'undetermined'
}

/** 段内是否存在「非未判定」的硬失败行或结构化失败汇总(防止降噪把真故障一起吞掉)。 */
export function hasHardFailureLine(segment) {
  const text = String(segment ?? '')
  const hardLine = text
    .split(/\r?\n/)
    .some((l) => /❌/.test(l) && !/未判定|IHUI-VERDICT=unjudged/.test(l))
  return hardLine || /"ok":false|"failed":[1-9]/.test(text)
}

/** 段内是否出现明确的失败标记(捕获失败/写库失败/未判定行)。 */
export function hasFailureMark(segment) {
  return /❌|"ok":false|"failed":[1-9]/.test(String(segment ?? ''))
}

/**
 * 段级分类(纯函数)。优先级:硬失败 > 结构化标记 > 旧日志正则回退 > 失败标记 > 干净。
 * 任一标记声明 undetermined 即不把整段当环境未就绪(保守,宁可少降噪不可吞真故障)。
 */
export function classifyLogSegment(segment) {
  const text = String(segment ?? '')
  if (hasHardFailureLine(text)) return { kind: 'hard-failure', source: 'hard-line' }
  const markers = [...text.matchAll(VERDICT_MARKER_RE)]
  if (markers.length > 0) {
    const allNotReady = markers.every(
      (m) => m[1] === 'unjudged' && m[2] === 'client-not-ready',
    )
    return { kind: allNotReady ? 'client-not-ready' : 'undetermined', source: 'marker' }
  }
  // 旧日志(2026-11-15 之前)没有结构标记:仍按原文本口径兼容,以免历史段被重新判红。
  // 收紧:段内**每一条** ❌ 行都必须命中环境缺席;混进 tsx 缺失 / SIGTERM 等真故障就不降噪,
  // 否则「客户端没开」会把同一段的真故障一起吞掉(宁可少降噪,不可吞真故障)。
  if (/未判定/.test(text) && CLIENT_NOT_READY_RE.test(text)) {
    const failLines = text.split(/\r?\n/).filter((l) => /❌/.test(l))
    if (failLines.length > 0 && failLines.every((l) => CLIENT_NOT_READY_RE.test(l))) {
      return { kind: 'client-not-ready', source: 'legacy-text' }
    }
  }
  if (hasFailureMark(text)) return { kind: 'undetermined', source: 'failure-mark' }
  return { kind: 'clean', source: 'none' }
}

/** 本轮是否为「客户端未就绪型未判定」(§0.3:取不到输入不冒红)。 */
export function isClientNotReady(segment) {
  return classifyLogSegment(segment).kind === 'client-not-ready'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
