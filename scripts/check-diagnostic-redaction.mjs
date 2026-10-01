#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-diagnostic-redaction — 子代理 stderr/stdout 诊断尾巴脱敏守门(G-998115 并入 T1,b76-08)。
 *
 * 判据(对标上游 zcodeAgentProcessManager.ts:248-294,1051-1069):
 *   1. 诊断文本在**入 tail 时**就脱敏(三组形状:赋值式 / Bearer·Basic 式 / 裸 sk- 式);
 *   2. **先脱敏再限长** —— 脱敏占位符可能比原文长,限长必须在脱敏之后;
 *   3. 跨进程 IPC 前再脱敏再限长(出口与入口各一道,不得只做一处)。
 *
 * 用法:
 *   node scripts/check-diagnostic-redaction.mjs --self-test   # 脱敏器行为自测 + 源形态检查
 *   node scripts/check-diagnostic-redaction.mjs               # 门本体(源形态检查)
 *
 * 本脚本不接提交链(§12f:接链由守门持有人统一做)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ───────────────────────── 参照脱敏器(与生产同判据) ─────────────────────────

export function redactDiagnosticText(text) {
  let out = String(text ?? '')
  // 顺序即判据:Bearer/Basic 必须先于赋值式(否则 'Bearer' 被当值吃掉,真凭据裸奔)
  out = out.replace(/\b(bearer|basic)\s+(\S+)/gi, (_m, scheme) => `${scheme} [REDACTED]`)
  out = out.replace(
    /\b(api[-_]?key|authorization|cookie|credential|password|secret|token)\b["']?(\s*[=:]\s*)(\S+)/gi,
    (_m, key, sep) => `${key}${sep}[REDACTED]`,
  )
  out = out.replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
  return out
}

/** 先脱敏再限长(顺序即判据):cap 后每行 ≤ cap,占位符完整。 */
export function redactThenBound(text, cap) {
  const redacted = redactDiagnosticText(text)
  return redacted.length > cap ? `${redacted.slice(0, cap)}…[truncated:true]` : redacted
}

// ───────────────────────── 自测 ─────────────────────────

export function selfTest() {
  const failures = []
  const check = (cond, msg) => {
    if (!cond) failures.push(msg)
  }

  // 形状 1:赋值式(api_key/authorization/cookie/credential/password/secret/token)
  check(
    redactDiagnosticText('api_key = sk-live-abcdef123456').includes('api_key = [REDACTED]'),
    '赋值式 api_key 未脱敏',
  )
  check(
    redactDiagnosticText('password: hunter2secret').includes('password: [REDACTED]'),
    '赋值式 password 未脱敏',
  )
  check(
    (() => {
      const out = redactDiagnosticText('{"token": "abc123def456"}')
      return out.includes('[REDACTED]') && !out.includes('abc123def456')
    })(),
    '赋值式 token(键名引号形)未脱敏',
  )
  // 形状 2:Bearer / Basic
  check(
    redactDiagnosticText('Authorization: Bearer abcd1234efgh5678ijkl').includes('[REDACTED]'),
    'Bearer 凭据未脱敏',
  )
  check(
    !/Bearer\s+abcd1234/i.test(redactDiagnosticText('Bearer abcd1234efgh5678ijkl')),
    'Bearer 原值仍可读',
  )
  check(redactDiagnosticText('Basic dXNlcjpwYXNzd29yZA==').includes('[REDACTED]'), 'Basic 凭据未脱敏')
  // 形状 3:裸 sk-
  check(!/sk-[A-Za-z0-9_-]{8,}/.test(redactDiagnosticText('key: sk-proj-9m8n7b6v5c4x')), '裸 sk- 键未脱敏')
  // 误伤面:普通词不脱敏
  check(redactDiagnosticText('the token economy is large').includes('token economy'), '普通词被误伤')

  // 顺序判据:先脱敏再限长 —— 凭据在限长边界附近也必须整个消失,
  // 且 [REDACTED] 占位符完整(限长在脱敏后 ⇒ 占位符不会被腰斩)。
  {
    const filler = 'x'.repeat(900)
    const raw = `${filler} Authorization: Bearer abcd1234efgh5678ijkl ${filler}`
    const bounded = redactThenBound(raw, 1000)
    check(!/Bearer\s+abcd1234/i.test(bounded), '先限长后脱敏会把凭据留在 tail 外侧 — 顺序错了')
    check(!bounded.includes('abcd1234efgh'), '限长后的 tail 里不得残留凭据明文')
  }
  {
    // 占位符完整性:凭据恰在 cap 边界,先脱敏 ⇒ [REDACTED] 不会被腰斩
    const raw = `secret=${'y'.repeat(1200)}`
    const bounded = redactThenBound(raw, 1000)
    check(bounded.includes('[REDACTED]'), '占位符必须在(先脱敏后限长才可能完整保留)')
    check(!bounded.includes('yyyy]'), '限长不得把原文尾巴当凭据值保留')
  }
  {
    // truncated 位如实
    const bounded = redactThenBound('z'.repeat(1500), 1000)
    check(bounded.endsWith('…[truncated:true]'), '超限必须有 truncated 标记')
  }
  return failures
}

// ───────────────────────── 门本体:生产面源形态检查 ─────────────────────────

function sourceChecks() {
  const failures = []
  const must = (rel, patterns) => {
    let src
    try {
      src = readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      failures.push(`${rel}: 读取失败(文件缺失?)`)
      return
    }
    for (const [pat, why] of patterns) {
      if (!pat.test(src)) failures.push(`${rel}: 缺少 ${pat} —— ${why}`)
    }
  }
  // 生产面:出口(归因 error 日志)与入口(result.error 尾巴)各自走脱敏出口
  must('apps/cli/src/subagents/worker-pool.ts', [
    [/export function redactDiagnosticText/, '脱敏唯一出口必须在生产模块(不得只活在守门里)'],
    [/export function boundedRedactedTail/, '入 tail 采集口必须在生产模块且先脱敏再限长'],
    [/redactDiagnosticText\(text\)\.trim\(\)/, '审计尾巴(boundedTail)必须先脱敏再 trim/限长'],
    [/DIAGNOSTIC_TAIL_MAX_LINES = 20/, 'tail 行数上限(20)必须有名字'],
    [/DIAGNOSTIC_TAIL_MAX_LINE_CHARS = 1000/, '单行字符上限(1000)必须有名字'],
  ])
  must('apps/api/src/services/transcode-service.ts', [
    [/\(bearer\|basic\)/, 'ffmpeg stderr 尾巴的 Bearer/Basic 形状必须在脱敏清单内'],
    [/sk-\[A-Za-z0-9_-\]/, '裸 sk- 形状必须在脱敏清单内'],
  ])
  return failures
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const isSelfTest = process.argv.includes('--self-test')
  const failures = isSelfTest ? [...selfTest(), ...sourceChecks()] : sourceChecks()
  if (failures.length > 0) {
    console.error(`[check-diagnostic-redaction]${isSelfTest ? ' --self-test' : ''} FAIL:`)
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log(`[check-diagnostic-redaction]${isSelfTest ? ' --self-test' : ''}: all green`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
