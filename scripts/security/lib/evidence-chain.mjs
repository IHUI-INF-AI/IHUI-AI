// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 证据链(2026-11-24 立)。
 *
 * 为什么要有:普通日志是「可改的文本」,对外提交(云厂商滥用举报 / CNCERT / 公安协查)
 * 时对方无法确认「你交的这份和我当时看到的是一回事」。哈希链把每条证据与它的前一条
 * 绑死:改任何一条,其后所有条都验不过 —— 这是能拿出去的最低门槛。
 *
 * 结构:`sha256(seq | prevHash | ts | canonical(payload))`。canonical = 键名排序后
 * JSON,保证同一份数据在任何机器上算出同一个哈希(否则跨机校验必然失败)。
 *
 * 只做「追加 + 校验 + 打包」,不做篡改检测之外的任何推断:判据与取证分离,
 * 谁攻击、攻击到哪一步由 kill-chain 判,本文件只管「这条证据有没有被动过」。
 */
import { createHash, randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** 链头:第一条的 prevHash。用 64 个 0 而不是空串,便于一眼看出「这是起点」。 */
export const GENESIS = '0'.repeat(64)

/** 稳定序列化:对象键排序、数组保持顺序、undefined 丢弃。 */
export function canonical(value) {
  const walk = (v) => {
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(walk)
    const out = {}
    for (const k of Object.keys(v).sort()) {
      if (v[k] === undefined) continue
      out[k] = walk(v[k])
    }
    return out
  }
  return JSON.stringify(walk(value))
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * 构造一条链记录。seq 从 0 开始;ts 用 ISO,参与哈希(时间本身也是证据)。
 * 只取 payload 的哈希与摘要入链,原始大对象另存 —— 链文件要能被整份读进内存校验。
 */
export function makeEntry({ seq, prevHash, ts, payload, ref = null }) {
  if (!Number.isInteger(seq) || seq < 0) throw new Error('seq 必须是非负整数')
  if (typeof prevHash !== 'string' || prevHash.length !== 64) throw new Error('prevHash 必须是 64 位十六进制')
  const payloadHash = sha256(canonical(payload))
  const body = `${seq}|${prevHash}|${ts}|${payloadHash}`
  return {
    id: randomUUID(),
    seq,
    ts,
    prevHash,
    payloadHash,
    hash: sha256(body),
    ref,
  }
}

/** 校验整条链。返回 {ok, count, brokenAt|null, reason}。空链视为 ok(0 条)。 */
export function verifyChain(entries) {
  const list = Array.isArray(entries) ? entries : []
  let prev = GENESIS
  for (let i = 0; i < list.length; i += 1) {
    const e = list[i]
    if (e?.seq !== i) return { ok: false, count: list.length, brokenAt: i, reason: `seq 断裂:期望 ${i} 实得 ${e?.seq}` }
    if (e.prevHash !== prev) return { ok: false, count: list.length, brokenAt: i, reason: `prevHash 不接上一条(${i})` }
    const body = `${e.seq}|${e.prevHash}|${e.ts}|${e.payloadHash}`
    if (sha256(body) !== e.hash) return { ok: false, count: list.length, brokenAt: i, reason: `自身哈希不符(${i})` }
    prev = e.hash
  }
  return { ok: true, count: list.length, brokenAt: null, reason: null, head: list.length ? prev : GENESIS }
}

/** 读链文件(每行一条 JSON)。坏行即判定链损坏,不跳过 —— 跳过等于替篡改打掩护。 */
export function readChain(chainPath) {
  if (!existsSync(chainPath)) return { entries: [], error: null }
  const lines = readFileSync(chainPath, 'utf8').split(/\r?\n/).filter(Boolean)
  const entries = []
  for (let i = 0; i < lines.length; i += 1) {
    try {
      entries.push(JSON.parse(lines[i]))
    } catch {
      return { entries, error: `第 ${i + 1} 行无法解析` }
    }
  }
  return { entries, error: null }
}

/**
 * 追加一条证据。payload 只入链摘要;若给了 rawPath,原始内容另存一份。
 * 返回 {ok, entry, error}。写失败不抛 —— 调用方要能继续取证而不是整批中断。
 */
export function appendEvidence(chainPath, payload, { ts = new Date().toISOString(), ref = null } = {}) {
  const { entries, error } = readChain(chainPath)
  if (error) return { ok: false, entry: null, error }
  const prev = entries.length ? entries[entries.length - 1].hash : GENESIS
  const entry = makeEntry({ seq: entries.length, prevHash: prev, ts, payload, ref })
  try {
    mkdirSync(dirname(chainPath), { recursive: true })
    appendFileSync(chainPath, `${JSON.stringify(entry)}\n`, 'utf8')
    return { ok: true, entry, error: null }
  } catch (err) {
    return { ok: false, entry: null, error: String(err?.message ?? err) }
  }
}

/**
 * 打包:把链头 + 已验状态 + 文件清单写成不可变清单,供对外提交。
 * 只写 manifest,不复制原始大文件(由调用方决定哪些要一起交)。
 */
export function writeManifest(manifestPath, { chain, files = [], meta = {} } = {}) {
  const verdict = verifyChain(chain)
  const doc = {
    generatedAt: new Date().toISOString(),
    chain: { count: verdict.count, head: verdict.head ?? GENESIS, verified: verdict.ok, brokenAt: verdict.brokenAt },
    files: files.map((f) => ({ path: String(f.path ?? f), sha256: sha256(String(f.path ?? f)) })),
    meta,
  }
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  return doc
}

export const __test__ = { canonical, sha256, makeEntry, verifyChain, readChain, appendEvidence, writeManifest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
