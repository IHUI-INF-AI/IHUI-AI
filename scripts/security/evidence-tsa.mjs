// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 证据链的**第二条外锚腿**:RFC 3161 时间戳(TSA)。
//
// 第一条腿(evidence-anchor 的锚邮件)有一个结构弱点:邮件凭据在本机 .env 里 ——
// 本机失陷后,攻击者能用我们自己的凭据发一封"看起来完全正常"的假锚信。邮件服务端
// 在本机之外,但它**不权威**,它分不清发信人是我们还是冒名者。
//
// TSA 补的就是这一格:签名私钥在第三方手里,本机只提交一个 sha256,换回一个由
// 第三方签名的时间凭证。要伪造,必须有 TSA 的私钥 —— 不是本机能做到的事。
//
// 不引入任何 npm 依赖:请求/响应/验签全走本机 OpenSSL(3.5.9,`ts` 子命令齐全)。
//
// 三条实测事实(踩过,写在这里):
//   ① `openssl ts -verify` 在这台机器上**退出码恒为 0**,验过和没验过都是 0。
//      判成败只读输出文本 `Verification: OK / FAILED` —— 靠 rc 判等于把假凭证当真的收下。
//   ② 验签必须给 CAfile,否则 `unable to get local issuer certificate`。Git 自带
//      `usr/ssl/certs/ca-bundle.crt`(184KB)可用;路径不写死,按解析序找。
//   ③ `-queryfile` 比 `-data` 强:前者连 nonce 一起校验,能挡住"拿旧凭证冒充新的"。
//      所以每次都要把 `.tsq` 留在盘上,不能只留 `.tsr`。
//
// 用法:
//   node scripts/security/evidence-tsa.mjs                 # 取一次时间戳并落台账
//   node scripts/security/evidence-tsa.mjs --dry-run       # 只演算,不联网不写盘
//   node scripts/security/evidence-tsa.mjs --verify        # 逐条复验已存 token
//   node scripts/security/evidence-tsa.mjs --force         # 无视节律
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { GENESIS, canonical, readChain, sha256 } from './lib/evidence-chain.mjs'
import { TSA_ENDPOINTS, TSA_STATE, judgeVerifyOutput, parseTsReplyText, summarizeVerification, tsaBaseNameOf, tsaPayloadBytes, tsaPayloadOf } from './lib/tsa-token.mjs'

const ROOT = 'D:/IHUI-AI'
const CHAIN_PATH = `${ROOT}/.ihui-agent/state/evidence-chain.jsonl`
const TSA_LEDGER = `${ROOT}/.ihui-agent/state/evidence-tsa.jsonl`
const TOKEN_DIR = `${ROOT}/.ihui-agent/state/tsa-tokens`
const TMP = `${ROOT}/.ihui-agent/tmp/tsa`
const INTERVAL_MIN = Number(process.env.IHUI_TSA_INTERVAL_MIN ?? 60)

const dryRun = process.argv.includes('--dry-run')
const doVerify = process.argv.includes('--verify')
const force = process.argv.includes('--force')

/** 不写死盘符与安装位:env 优先,其次 PATH,最后才是 Git 的已知位置。 */
function resolveOpenssl() {
  const explicit = process.env.IHUI_OPENSSL
  if (explicit && existsSync(explicit)) return explicit
  const fromPath = spawnSync('openssl', ['version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true })
  if (!fromPath.error && fromPath.status === 0) return 'openssl'
  for (const p of ['C:/Program Files/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/mingw64/bin/openssl.exe']) {
    if (existsSync(p)) return p
  }
  return null
}

/** 同上:env → Git 的两处已知 CA 包 → 拿不到就返回 null(验签会走"未判定")。 */
function resolveCaFile() {
  const explicit = process.env.IHUI_TSA_CAFILE
  if (explicit && existsSync(explicit)) return explicit
  for (const p of [
    'C:/Program Files/Git/usr/ssl/certs/ca-bundle.crt',
    'C:/Program Files/Git/mingw64/etc/ssl/certs/ca-bundle.crt',
    'C:/Program Files/Git/usr/ssl/cert.pem',
  ]) {
    if (existsSync(p)) return p
  }
  return null
}

function readLedger() {
  if (!existsSync(TSA_LEDGER)) return []
  const out = []
  for (const line of readFileSync(TSA_LEDGER, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t))
    } catch {
      /* 坏行跳过:一条坏行不该让整个见证链变成瞎的 */
    }
  }
  return out
}

/** POST 一个 .tsq 到 TSA,返回 .tsr 字节。失败逐端点记原因,不猜。 */
function postQuery(buf, url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https:') ? httpsRequest : httpRequest
    const req = mod(url, {
      method: 'POST',
      headers: { 'content-type': 'application/timestamp-query', 'content-length': buf.length, 'user-agent': 'ihui-evidence-tsa/1' },
      timeout: 20_000,
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        if (res.statusCode !== 200) return resolve({ ok: false, reason: `HTTP ${res.statusCode}`, body })
        if (body.length < 200) return resolve({ ok: false, reason: `响应过短 ${body.length}B(不是合法 TimeStampResp)`, body })
        resolve({ ok: true, body })
      })
    })
    req.on('timeout', () => { req.destroy(new Error('timeout')) })
    req.on('error', (e) => resolve({ ok: false, reason: e?.message ?? String(e) }))
    req.write(buf)
    req.end()
  })
}

function runOpenSSL(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 60_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 })
  return { ok: r.status === 0 && !r.error, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message ?? null }
}

const openssl = resolveOpenssl()
const caFile = resolveCaFile()

// ── 复验模式 ────────────────────────────────────────────────────────────────
if (doVerify) {
  const ledger = readLedger()
  if (!openssl) {
    console.log(JSON.stringify({ state: TSA_STATE.UNDETERMINED, reason: '找不到 openssl(未判定)' }, null, 2))
    process.exit(2)
  }
  const rows = []
  for (const rec of ledger) {
    const tsq = join(TOKEN_DIR, `${rec.base}.tsq`)
    const tsr = join(TOKEN_DIR, `${rec.base}.tsr`)
    if (!existsSync(tsq) || !existsSync(tsr)) {
      rows.push({ at: rec.at, base: rec.base, state: TSA_STATE.UNDETERMINED, reason: '配对的 .tsq/.tsr 不齐(少了就没法校 nonce)' })
      continue
    }
    const args = ['ts', '-verify', '-queryfile', tsq, '-in', tsr]
    if (caFile) args.push('-CAfile', caFile)
    const r = runOpenSSL(openssl, args)
    const verdict = judgeVerifyOutput(`${r.stdout}\n${r.stderr}`)
    rows.push({ at: rec.at, base: rec.base, state: verdict.state, reason: verdict.reason })
  }
  const summary = summarizeVerification(rows)
  const bad = rows.filter((x) => x.state !== TSA_STATE.OK)
  console.log(JSON.stringify({ ...summary, caFileFound: Boolean(caFile), bad: bad.slice(0, 20) }, null, 2))
  process.exit(summary.state === TSA_STATE.OK ? 0 : summary.state === TSA_STATE.FAILED ? 1 : 2)
}

// ── 取证模式 ────────────────────────────────────────────────────────────────
const chainRead = readChain(CHAIN_PATH)
// 链读不出来(坏行/不存在)时**不猜**:拿空链去要时间戳,等于让第三方给一个假状态背书。
if (chainRead.error) {
  console.log(JSON.stringify({ state: TSA_STATE.UNDETERMINED, reason: `证据链读取失败:${chainRead.error}(未判定)` }, null, 2))
  process.exit(2)
}
const chain = chainRead.entries
const ledger = readLedger()
const latest = ledger.length ? ledger[ledger.length - 1] : null

if (!force && latest) {
  const lastMs = new Date(latest.at).getTime()
  const elapsedMin = Number.isFinite(lastMs) ? Math.round((Date.now() - lastMs) / 60_000) : null
  // 留 5 分钟提前量:10 分钟一格 tick,不留就会稳定漏格(60 分钟变 70)。
  const dueAt = Math.max(1, INTERVAL_MIN - 5)
  if (elapsedMin !== null && elapsedMin < dueAt) {
    console.log(JSON.stringify({ state: 'skip', reason: `距上次 ${elapsedMin} 分钟 < ${dueAt}(未到节律)`, lastAt: latest.at }, null, 2))
    process.exit(0)
  }
}

const ts = new Date().toISOString()
const payload = tsaPayloadOf(chain, ts, GENESIS)
const payloadSha256 = sha256(canonical(payload))
const base = tsaBaseNameOf(ts, payloadSha256)

if (dryRun) {
  console.log(JSON.stringify({ state: 'dry-run', payload, payloadSha256, base, opensslFound: Boolean(openssl), caFileFound: Boolean(caFile) }, null, 2))
  process.exit(0)
}

if (!openssl) {
  console.log(JSON.stringify({ state: TSA_STATE.UNDETERMINED, reason: '找不到 openssl,无法生成时间戳请求(未判定)' }, null, 2))
  process.exit(2)
}

mkdirSync(TMP, { recursive: true })
mkdirSync(TOKEN_DIR, { recursive: true })
const payloadPath = join(TMP, 'payload.json')
const tsqPath = join(TMP, 'q.tsq')
writeFileSync(payloadPath, tsaPayloadBytes(payload))
const q = runOpenSSL(openssl, ['ts', '-query', '-data', payloadPath, '-sha256', '-cert', '-out', tsqPath])
if (!q.ok || !existsSync(tsqPath)) {
  console.log(JSON.stringify({ state: TSA_STATE.UNDETERMINED, stage: 'query', error: q.error ?? q.stderr.trim().split(/\r?\n/).slice(-2).join(' | ') }, null, 2))
  process.exit(2)
}

const tsqBuf = readFileSync(tsqPath)
let chosen = null
const attempts = []
for (const url of TSA_ENDPOINTS) {
  const r = await postQuery(tsqBuf, url)
  attempts.push({ url, ok: r.ok, reason: r.reason ?? null })
  if (r.ok) {
    chosen = { url, body: r.body }
    break
  }
}
if (!chosen) {
  console.log(JSON.stringify({ state: TSA_STATE.UNDETERMINED, stage: 'post', attempts, reason: '全部端点不可达(未判定,不写台账)' }, null, 2))
  process.exit(2)
}

const tsrPath = join(TMP, 'r.tsr')
writeFileSync(tsrPath, chosen.body)
const reply = runOpenSSL(openssl, ['ts', '-reply', '-in', tsrPath, '-text'])
const info = parseTsReplyText(reply.stdout)
if (!info.granted) {
  console.log(JSON.stringify({ state: TSA_STATE.FAILED, stage: 'reply', status: info.status, description: info.description, attempts }, null, 2))
  process.exit(1)
}

// 落 token:**先验后存**。验不过的凭证存下来只会变成将来的假证据。
const verifyArgs = ['ts', '-verify', '-queryfile', tsqPath, '-in', tsrPath]
if (caFile) verifyArgs.push('-CAfile', caFile)
const v = runOpenSSL(openssl, verifyArgs)
const verdict = judgeVerifyOutput(`${v.stdout}\n${v.stderr}`)

const finalTsq = join(TOKEN_DIR, `${base}.tsq`)
const finalTsr = join(TOKEN_DIR, `${base}.tsr`)
writeFileSync(finalTsq, tsqBuf)
writeFileSync(finalTsr, chosen.body)

const rec = {
  at: ts,
  base,
  count: payload.count,
  seq: payload.seq,
  chainHead: payload.chainHead,
  payloadSha256,
  tsaUrl: chosen.url,
  tsaTime: info.time,
  tsaSerial: info.serial,
  replyStatus: info.status,
  verified: verdict.state === TSA_STATE.OK,
  verifyReason: verdict.reason,
  caFileFound: Boolean(caFile),
  attempts,
}
appendFileSync(TSA_LEDGER, `${JSON.stringify(rec)}\n`, 'utf8')

const icon = verdict.state === TSA_STATE.OK ? '✅' : verdict.state === TSA_STATE.FAILED ? '❌' : '❔'
console.log(`${icon} [evidence-tsa] count=${rec.count} head=${String(rec.chainHead).slice(0, 12)}… tsaTime=${rec.tsaTime} · ${verdict.reason}`)
console.log(`   token: ${finalTsr}`)
process.exit(verdict.state === TSA_STATE.OK ? 0 : verdict.state === TSA_STATE.FAILED ? 1 : 2)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
