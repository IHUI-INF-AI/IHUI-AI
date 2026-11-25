// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// TSA 时间见证的**纯判据**(零 IO),执行层在 scripts/security/evidence-tsa.mjs。
//
// 为什么需要第二条腿:邮件锚的 SMTP 凭据就躺在本机 .env 里 —— 本机一失陷,攻击者能用
// 我们自己的凭据发一封假锚信。邮件服务端确实在本机之外,但**它不权威**:它分不清
// "这封是我们发的"还是"失陷者用我们的凭据发的"。RFC 3161 时间戳补的正是这一格:
// 签名私钥在 TSA 手里,本机只提交一个 sha256,换回一个第三方签名的时间凭证。
// 本机做不到伪造 —— 要伪造就必须有 TSA 的私钥。
//
// 载荷设计:只提交「链当前状态」的哈希,**不提交链内容、不提交 prevAnchor**。
// TSA 是外部服务,不该看到我们的链头明细;prevAnchor 是邮件锚链的概念,放进来会
// 让同一条链每次算出的哈希都不一样,TSA 与邮件两条腿就失去可比性。
//
// 一台机器上踩到的坑,写在这里:本机 `openssl ts -verify` 的**退出码恒为 0**,
// 无论验过还是没验过。所以判成败只能读它的输出文本 `Verification: OK / FAILED`。
// 靠 rc 判 = 把"假凭证"当真的收下。

/** sha256 十六进制(64 位)。载荷里只承诺这一个值。 */
export const TSA_PAYLOAD_VERSION = 1

/** TSA 端点:三个都实测可达;按序尝试,全都失败才判未判定。 */
export const TSA_ENDPOINTS = [
  'http://timestamp.digicert.com',
  'http://timestamp.sectigo.com',
  'https://freetsa.org/tsr',
]

export const TSA_STATE = Object.freeze({
  OK: 'ok',
  FAILED: 'failed',
  UNDETERMINED: 'undetermined',
})

/**
 * 提交给 TSA 的载荷(规范化后取 sha256)。字段与邮件锚同源,便于后面对账时
 * 交叉比对「两条腿是否见过同一个状态」;刻意不含 prevAnchor。
 */
export function tsaPayloadOf(entries, ts, genesis) {
  const last = entries?.length ? entries[entries.length - 1] : null
  return {
    v: TSA_PAYLOAD_VERSION,
    ts: String(ts),
    count: entries?.length ?? 0,
    seq: last ? Number(last.seq) : 0,
    chainHead: last ? String(last.hash) : String(genesis ?? ''),
  }
}

/** 载荷文件形态:**必须与算哈希时逐字节一致**,否则验签会 imprint mismatch。 */
export function tsaPayloadBytes(payload) {
  return Buffer.from(`${JSON.stringify(payload)}\n`, 'utf8')
}

/** token 文件名:<ISO 时刻压成安全字符>-<哈希前 12>。 */
export function tsaBaseNameOf(iso, payloadSha256) {
  const stamp = String(iso ?? '').replace(/[^0-9A-Za-z]/g, '')
  const tail = String(payloadSha256 ?? '').slice(0, 12)
  return `${stamp}-${tail}`
}

/**
 * 解析 `openssl ts -reply -in x.tsr -text`。
 * 只取我们真正要用的四项:状态、时间、序列号、imprint。
 */
export function parseTsReplyText(text) {
  const s = String(text ?? '')
  const status = s.match(/^\s*Status:\s*(.+)$/m)?.[1]?.trim() ?? null
  const description = s.match(/^\s*Status description:\s*(.+)$/m)?.[1]?.trim() ?? null
  const time = s.match(/^\s*Time stamp:\s*(.+)$/m)?.[1]?.trim() ?? null
  const serial = s.match(/^\s*Serial number:\s*(.+)$/m)?.[1]?.trim() ?? null
  const hashAlg = s.match(/^\s*Hash Algorithm:\s*(.+)$/m)?.[1]?.trim() ?? null
  // imprint 在 "Message data:" 之后按 "偏移 - hex   ascii" 分块打印。
  // 只取 hex 那一段 —— 尾部 ASCII 区里也全是 a-f 的字母,整行扫会把它们当成 hex,
  // 拼出来的 imprint 就是错的(单测当场抓到过)。
  let imprint = null
  const md = s.match(/^\s*Message data:\s*\n([\s\S]*?)(?:\n\s*Serial number:|\n\s*Nonce:)/m)
  if (md) {
    let hex = ''
    for (const line of md[1].split('\n')) {
      const m = line.match(/^\s*[0-9a-fA-F]{4}\s*-\s*(.+)$/)
      if (!m) continue
      let rest = m[1]
      const asciiGap = rest.indexOf('   ')
      if (asciiGap >= 0) rest = rest.slice(0, asciiGap)
      hex += (rest.match(/[0-9a-fA-F]{2}/g) ?? []).join('')
    }
    if (hex) imprint = hex.toLowerCase()
  }
  const granted = status ? /granted|已授予|成功/i.test(status) : false
  return { status, description, granted, time, serial, hashAlgorithm: hashAlg, imprint }
}

/**
 * 判 `openssl ts -verify` 的成败。**只读输出文本**,不看退出码 —— 本机 rc 恒 0。
 * 两条都不到 ⇒ `undetermined`:既不当通过,也不冒红。
 */
export function judgeVerifyOutput(text) {
  const s = String(text ?? '')
  if (/^\s*Verification:\s*OK\b/im.test(s)) return { state: TSA_STATE.OK, reason: '签名与时间戳均通过' }
  const failedLine = s.match(/^(?:.*:error:.*|.*Verification: FAILED.*)$/m)
  if (/Verification:\s*FAILED/i.test(s) || /message imprint mismatch/i.test(s)) {
    return { state: TSA_STATE.FAILED, reason: failedLine ? failedLine[0].trim().slice(0, 160) : 'Verification: FAILED' }
  }
  return { state: TSA_STATE.UNDETERMINED, reason: '输出里既没有 OK 也没有 FAILED(不能当作通过)' }
}

/**
 * 逐条复验的汇总。**任何一条 failed ⇒ 整体 failed**;
 * 全 ok ⇒ ok;有未判定而其余都 ok ⇒ undetermined(半判不写成判过)。
 */
export function summarizeVerification(rows) {
  const list = rows ?? []
  if (!list.length) return { state: TSA_STATE.UNDETERMINED, reason: '没有可复验的 token', total: 0, ok: 0, failed: 0, undetermined: 0 }
  const ok = list.filter((r) => r.state === TSA_STATE.OK).length
  const failed = list.filter((r) => r.state === TSA_STATE.FAILED).length
  const undetermined = list.filter((r) => r.state !== TSA_STATE.OK && r.state !== TSA_STATE.FAILED).length
  const state = failed ? TSA_STATE.FAILED : undetermined ? TSA_STATE.UNDETERMINED : TSA_STATE.OK
  return { state, total: list.length, ok, failed, undetermined, reason: `${ok} 通过 / ${failed} 不过 / ${undetermined} 未判定` }
}

export const __test__ = {
  tsaPayloadOf,
  tsaPayloadBytes,
  tsaBaseNameOf,
  parseTsReplyText,
  judgeVerifyOutput,
  summarizeVerification,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
