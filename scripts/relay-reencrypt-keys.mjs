// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// relay-reencrypt-keys.mjs — 中转站凭据重加密修复脚本 (safe / idempotent / dry-run-by-default)
//
// 目的: 把 ai_relay_key_pool / ai_relay_account_pool 中以「旧加密密钥」加密的凭据,
//       用「当前加密密钥」(CREDENTIALS_ENCRYPTION_KEY) 重新加密。
//
// 加密方案 — 逐字节镜像 apps/api/src/utils/crypto.ts (encryptJSON / decryptJSON):
//   - 算法:        aes-256-gcm
//   - 密钥:        CREDENTIALS_ENCRYPTION_KEY(或 OLD_*) 取前 32 字符, Buffer.from(key.slice(0,32))
//   - IV:          randomBytes(12),base64 存于 payload.iv
//   - 落库形态:    JSON.stringify(encryptJSON(plaintext))
//
// 默认 dry-run: 仅打印将要变更的内容与汇总,不写库。加 --apply 才真正写入。
//
// 安全约定:
//   - 绝不翻转 is_enabled(除非显式 --enable-on-success,且仅对「旧密钥解密成功」的行在 --apply 时生效)。
//   - 已用当前密钥加密的行会被跳过(用当前密钥先试解密,成功即视为已最新)。
//   - 单行失败被 try/catch 包裹,不会中断整轮。
//   - 旧密钥解密失败的,不做任何「用明文回填」动作 —— 仅标记为 needs_plaintext_key。
//   - 密钥可从「文件」读取(CREDENTIALS_ENCRYPTION_KEY_FILE / OLD_*_FILE),避免明文落屏。

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describeFlagToken, flagValue } from './lib/flag-value.mjs'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32

function keyFromEnv(keyStr, label) {
  if (!keyStr || typeof keyStr !== 'string') throw new Error(`${label} 未提供或为空`)
  if (keyStr.length < KEY_LENGTH) throw new Error(`${label} 必须至少 ${KEY_LENGTH} 字符(实际 ${keyStr.length})`)
  return Buffer.from(keyStr.slice(0, KEY_LENGTH))
}

function encryptJSON(data, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return { iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: tag.toString('base64') }
}

function decryptJSON(payload, key) {
  const iv = Buffer.from(payload.iv, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  const text = plaintext.toString('utf8')
  try { return JSON.parse(text) } catch { return text }
}

function tryDecrypt(stored, key) {
  if (key == null) return { ok: false, malformed: false, reason: 'OLD key 未提供' }
  if (stored == null) return { ok: false, malformed: true, reason: '列值为空' }
  let payload
  try { payload = JSON.parse(stored) } catch { return { ok: false, malformed: true, reason: '不是合法 JSON 字符串' } }
  if (typeof payload !== 'object' || payload === null ||
      typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string' || typeof payload.tag !== 'string') {
    return { ok: false, malformed: true, reason: '非加密 payload 形态(缺 iv/ciphertext/tag)' }
  }
  try { return { ok: true, plaintext: decryptJSON(payload, key) } }
  catch (e) { return { ok: false, malformed: false, reason: String(e?.message || e) } }
}

// ───────────────────────────────────────────────────────────────────────────
// 依赖解析(postgres.js,即工程实际驱动)
// ───────────────────────────────────────────────────────────────────────────
async function loadPostgres() {
  const attempts = []
  const resolve = async (spec) => {
    try { const mod = await import(spec); return mod.default || mod } catch (e) { attempts.push(`import('${spec}'): ${e.message}`); return null }
  }
  let pg = await resolve('postgres')
  if (!pg) {
    // 兜底:扫描 pnpm 的 .pnpm 软链存储目录(版本不固定,动态定位)
    const pnpmRoot = 'D:/IHUI-AI/node_modules/.pnpm'
    try {
      const { readdirSync } = await import('node:fs')
      const dir = readdirSync(pnpmRoot).find((d) => /^postgres@/.test(d))
      if (dir) pg = await resolve(`file:///D:/IHUI-AI/node_modules/.pnpm/${dir}/node_modules/postgres/src/index.js`)
    } catch (e) { attempts.push(`scan .pnpm: ${e.message}`) }
  }
  if (!pg) {
    console.error('\n❌ 未找到 `postgres` 模块。请确认 node_modules 已安装(pnpm install)。')
    for (const a of attempts) console.error('   - ' + a)
    process.exit(2)
  }
  return pg
}

function loadKeyFromFile(filePath, label) {
  if (!filePath) return null
  let content
  try { content = readFileSync(filePath, 'utf8') } catch (e) { console.error(`❌ 读取密钥文件失败 ${filePath}: ${e.message}`); process.exit(2) }
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (t.startsWith('#') || t === '') continue
    const m = t.match(/^CREDENTIALS_ENCRYPTION_KEY=(.*)$/)
    if (!m) continue
    let v = m[1].trim()
    // 去除 export 前缀(不应有,但兜底)
    v = v.replace(/^export\s+/, '')
    // 去首尾引号
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    // 去除行内注释
    const hash = v.indexOf('#')
    if (hash >= 0) v = v.slice(0, hash).trim()
    if (v.length === 0) continue
    return v
  }
  console.error(`❌ 在 ${filePath} 中未找到 CREDENTIALS_ENCRYPTION_KEY 行。`)
  process.exit(2)
}

function parseArgs(argv) {
  const args = new Set(argv)
  // --pool 取值走 G-322 单源:给了旗标但值无效(吞掉紧邻 --apply 当池名、结尾无值)必须点名
  // 非零退出,不得静默回落 'key'(旧写法 `argv[i+1] || 'key'` 正是本票要消的静默降级形态)。
  const poolF = flagValue(argv, '--pool')
  let pool = 'key'
  if (poolF.present && !poolF.valid) {
    console.error(`❌ 用法错:--pool 需要一个池名(key|account),紧邻的 token 实得:${describeFlagToken(poolF)}(不得静默退回默认)`)
    process.exit(2)
  }
  // 等号形与空格形都认:单独给 `--pool=account` 旧写法完全不识别(静默按 key 池跑 = 错池),
  // 等号后为空旧写法与"没给"同形 ⇒ 两型都判死/收编,不猜意图。
  const eq = argv.find((a) => a.startsWith('--pool='))
  if (eq !== undefined) {
    const v = eq.slice('--pool='.length)
    if (v === '') {
      console.error('❌ 用法错:--pool= 需要一个池名(key|account) —— 等号后为空(不得静默退回默认)')
      process.exit(2)
    }
    pool = v
  } else if (poolF.valid) {
    pool = poolF.value
  }
  if (pool !== 'key' && pool !== 'account') { console.error(`❌ 未知 --pool 值: ${pool}`); process.exit(2) }
  return { pool, apply: args.has('--apply'), enableOnSuccess: args.has('--enable-on-success') }
}

const COLUMNS_BY_POOL = { key: ['api_key_enc'], account: ['token_enc', 'refresh_token_enc', 'cookies_enc', 'secrets_enc'] }

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length) }
function fp(k) { return k ? k.slice(0, 8) + '…(len ' + k.length + ')' : '(none)' }

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ihui:fa6ZJRVkG1_vdTDCAGX0fUMZ8y0cDAbi@localhost:8810/ihui_dev'

  const currentKeyEnv = process.env.CREDENTIALS_ENCRYPTION_KEY || loadKeyFromFile(process.env.CREDENTIALS_ENCRYPTION_KEY_FILE, 'current')
  const oldKeyEnv = process.env.OLD_CREDENTIALS_ENCRYPTION_KEY || loadKeyFromFile(process.env.OLD_CREDENTIALS_ENCRYPTION_KEY_FILE, 'old')

  if (!currentKeyEnv) { console.error('❌ 必须提供 CREDENTIALS_ENCRYPTION_KEY 或其 _FILE。'); process.exit(2) }
  let currentKey
  try { currentKey = keyFromEnv(currentKeyEnv, 'CREDENTIALS_ENCRYPTION_KEY') } catch (e) { console.error('❌ ' + e.message); process.exit(2) }
  let oldKey = null
  if (oldKeyEnv) { try { oldKey = keyFromEnv(oldKeyEnv, 'OLD_CREDENTIALS_ENCRYPTION_KEY') } catch (e) { console.error('❌ ' + e.message); process.exit(2) } }
  else console.warn('⚠️  未提供 OLD 密钥:任何「非当前密钥加密」的行将被标记为 needs_plaintext_key。')

  if (opts.enableOnSuccess && !opts.apply) console.warn('⚠️  --enable-on-success 仅在 --apply 时生效(dry-run 忽略)。')

  const postgres = await loadPostgres()
  const table = opts.pool === 'key' ? 'ai_relay_key_pool' : 'ai_relay_account_pool'
  const encCols = COLUMNS_BY_POOL[opts.pool]

  console.log('\n=== relay-reencrypt-keys ===')
  console.log(`mode         : ${opts.apply ? 'APPLY (真实写入)' : 'DRY-RUN (仅预览)'}`)
  console.log(`table        : ${table}`)
  console.log(`current key  : ${fp(process.env.CREDENTIALS_ENCRYPTION_KEY || (process.env.CREDENTIALS_ENCRYPTION_KEY_FILE ? '(from file)' : '(none)'))}`)
  console.log(`old key      : ${fp(process.env.OLD_CREDENTIALS_ENCRYPTION_KEY || (process.env.OLD_CREDENTIALS_ENCRYPTION_KEY_FILE ? '(from file)' : '(none)'))}`)

  const sql = postgres(DATABASE_URL, { max: 1 })
  try {
    const rows = await sql`SELECT id, provider_code, ${sql(encCols.join(','))} FROM ${sql(table)} ORDER BY provider_code, id`
    console.log(`rows found   : ${rows.length}\n`)

    let scanned = 0, rowsAlreadyCurrent = 0, colsReencrypted = 0, colsNeedsPlaintext = 0, colsMalformed = 0
    const pendingWrites = []

    console.log(pad('id', 38) + ' | ' + pad('provider_code', 16) + ' | dec_old | upd | reason')
    console.log('-'.repeat(104))

    for (const row of rows) {
      scanned++
      const id = row.id, provider = row.provider_code ?? ''
      const colStatus = {}
      let anyReencrypt = false, anyAlreadyCurrent = false, anyNeeds = false, anyMalformed = false
      for (const col of encCols) {
        const stored = row[col]
        if (stored == null) { colStatus[col] = { kind: 'empty' }; continue }
        if (tryDecrypt(stored, currentKey).ok) { colStatus[col] = { kind: 'already-current' }; anyAlreadyCurrent = true; continue }
        const old = tryDecrypt(stored, oldKey)
        if (old.ok) { colStatus[col] = { kind: 'reencrypt', plaintext: old.plaintext }; anyReencrypt = true }
        else if (old.malformed) { colStatus[col] = { kind: 'malformed', reason: old.reason }; anyMalformed = true }
        else { colStatus[col] = { kind: 'needs_plaintext', reason: old.reason }; anyNeeds = true }
      }
      let decryptOldOk = 'no', wouldUpdate = 'no', reason = ''
      const reencryptCols = [], badCols = []
      for (const col of encCols) {
        const s = colStatus[col]
        if (!s || s.kind === 'empty') continue
        if (s.kind === 'reencrypt') { decryptOldOk = 'yes'; wouldUpdate = 'yes'; reencryptCols.push(col) }
        else if (s.kind === 'already-current') { /* skip */ }
        else if (s.kind === 'malformed') badCols.push(`${col}=malformed(${s.reason})`)
        else if (s.kind === 'needs_plaintext') badCols.push(`${col}=needs_plaintext(${s.reason})`)
      }
      if (wouldUpdate === 'yes') {
        reason = `reencrypt: ${reencryptCols.join(', ')}`
        if (badCols.length) reason += `; 其余: ${badCols.join('; ')}`
        if (opts.apply) {
          const sets = {}
          for (const col of reencryptCols) { sets[col] = JSON.stringify(encryptJSON(colStatus[col].plaintext, currentKey)); colsReencrypted++ }
          pendingWrites.push({ id, sets, enable: opts.enableOnSuccess })
        } else { for (const col of reencryptCols) colsReencrypted++ }
      } else if (anyAlreadyCurrent && badCols.length === 0) { reason = 'already-current (skip)'; rowsAlreadyCurrent++ }
      else { reason = badCols.join('; ') || 'nothing to do'; for (const col of encCols) { const s = colStatus[col]; if (s?.kind === 'needs_plaintext') colsNeedsPlaintext++; if (s?.kind === 'malformed') colsMalformed++ } }
      console.log(pad(String(id), 38) + ' | ' + pad(String(provider), 16) + ' | ' + pad(decryptOldOk, 7) + ' | ' + pad(wouldUpdate, 3) + ' | ' + reason)
    }
    console.log('-'.repeat(104))

    if (opts.apply && pendingWrites.length > 0) {
      console.log(`\n→ 写入 ${pendingWrites.length} 行 ...`)
      for (const w of pendingWrites) {
        const setCols = Object.keys(w.sets)
        const setStr = setCols.map((c, i) => `${c} = $${i + 1}`).join(', ')
        let q = `UPDATE ${table} SET ${setStr}`
        const params = setCols.map((c) => w.sets[c])
        if (w.enable) q += `, is_enabled = true`
        q += `, updated_at = now() WHERE id = $${params.length + 1}`
        await sql.unsafe(q, [...params, w.id])
      }
      console.log(`✅ 已写入 ${pendingWrites.length} 行。`)
    } else if (opts.apply) console.log('\n→ 没有需要写入的行。')

    console.log('\n=== 汇总 ===')
    console.log(`scanned                 : ${scanned}`)
    console.log(`re-encrypted            : ${colsReencrypted}${opts.apply ? '' : ' (dry-run 预估)'}`)
    console.log(`skipped-already-current : ${rowsAlreadyCurrent}`)
    console.log(`undecryptable-old-key   : ${colsNeedsPlaintext}  (needs_plaintext_key)`)
    console.log(`malformed               : ${colsMalformed}`)
    console.log(`mode                    : ${opts.apply ? 'APPLY' : 'DRY-RUN (加 --apply 才真正写入)'}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((e) => { console.error('❌ 运行失败:', e?.message || e); process.exit(1) })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
