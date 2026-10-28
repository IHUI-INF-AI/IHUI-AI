#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */

/**
 * check-asset-path-health.mjs —— 「受管 .env 引用了不存在的绝对路径」巡检(2026-10-28 立)
 *
 * 起因(实测):生产 `apps/api/.env` 四条支付宝证书路径写的是 `F:/BaiduSyncdisk/...`,
 * 而本机 F: 盘在迁移后已不存在(真实位置 D:)。SDK 读不到证书 ⇒ 支付宝能力静默不可用,
 * 全仓零门喊过;同一形态还包括私钥、目录、模板、模型文件。判据只有一条:**绝对路径必须在位**。
 *
 * 证书到期**不重写判据** —— 委托 `scripts/cert-expiry-check.mjs`(单一真相源),本尺子只判可达性。
 *
 * 只读。不打印值(只打印键名 + 路径),不写入任何文件。
 *
 * 用法:
 *   node scripts/check-asset-path-health.mjs           # 人工巡检
 *   node scripts/check-asset-path-health.mjs --json    # 机器可读(供 git-guardian / 看板)
 *   node scripts/check-asset-path-health.mjs --self-test
 *
 * 退出码: 0 = 全部可达(证书临近到期记 warn 仍为 0) / 1 = 有断链或证书错误 / 2 = 未判定(取不到输入)
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const jsonOut = process.argv.includes('--json')

/** 受管 env 面:存在才扫,全不存在 = 未判定(不冒绿)。 */
export const MANAGED_ENVS = [
  '.env',
  'apps/api/.env',
  'apps/api/.env.local',
  'apps/web/.env',
  'apps/web/.env.local',
  'apps/ai-service/.env',
  'apps/miniapp-taro/.env',
  'apps/desktop/.env',
]

/** 键名必须表达"这是一个文件/目录指针";`*_URL` 不算,`ALIPAY_APP_ID` 这类纯值也不算。 */
export const PATH_KEY_RE = /(^|_)(PATH|FILE|DIR|CERT|KEYSTORE|KEY)(_|$)/

/** 值形态:Windows 盘符绝对路径或 POSIX 绝对路径。相对路径依赖 cwd,不判(误报大于收益)。 */
export function isAbsolutePathValue(raw) {
  const v = String(raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!v) return false
  if (v.includes('${') || v.includes('$env:')) return false // 占位符,运行期才展开
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return false // URL,不是文件路径
  return /^[A-Za-z]:[\\/]/.test(v) || v.startsWith('/')
}

/** 解析 .env 文本 -> [{key, value, line}]。注释、空行、`export ` 前缀都要正确处理。 */
export function parseEnvText(text) {
  const out = []
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const t = line.trim()
      if (!t || t.startsWith('#')) return
      const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(t)
      if (!m) return
      let value = m[2].trim()
      // 引号包裹优先(引号内的 ` #` 是值的一部分),再 fallback 到未加引号的行尾注释
      const quoted = /^(['"])(.*?)\1\s*(?:#.*)?$/.exec(value)
      if (quoted) {
        value = quoted[2]
      } else {
        const hash = value.indexOf(' #')
        if (hash >= 0) value = value.slice(0, hash).trim()
      }
      out.push({ key: m[1], value, line: i + 1 })
    })
  return out
}

/** 统一成 `D:/a/b` 形态再问存在性(Windows 原生 existsSync 两种分隔符都认)。 */
function probeTarget(value) {
  return value.replace(/\\/g, '/')
}

export function checkManagedEnvFiles({ repoRoot = REPO_ROOT, envFiles = MANAGED_ENVS, fs = { existsSync, readFileSync } } = {}) {
  const scanned = []
  const missing = []
  for (const rel of envFiles) {
    const abs = join(repoRoot, rel)
    if (!fs.existsSync(abs)) continue
    let text = ''
    try {
      text = String(fs.readFileSync(abs, 'utf8'))
    } catch {
      scanned.push({ file: rel, keys: 0, error: 'unreadable' })
      continue
    }
    let keys = 0
    for (const { key, value, line } of parseEnvText(text)) {
      if (!PATH_KEY_RE.test(key) || !isAbsolutePathValue(value)) continue
      keys += 1
      if (!fs.existsSync(probeTarget(value))) missing.push({ file: rel, key, line, path: value.replace(/\\/g, '/') })
    }
    scanned.push({ file: rel, keys })
  }
  return { scanned, missing, inputs: scanned.length }
}

/** 委托证书到期尺子(单一真相源)。取不到 ⇒ certs.unjudged,不冒绿也不冒红。 */
export function checkCerts({ repoRoot = REPO_ROOT, runner = null } = {}) {
  const script = join(repoRoot, 'scripts', 'cert-expiry-check.mjs')
  if (!existsSync(script)) return { unjudged: '尺子不在位: scripts/cert-expiry-check.mjs' }
  try {
    const call =
      typeof runner === 'function'
        ? runner()
        : { status: 0, stdout: execFileSync(process.execPath, [script, '--json'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 1 << 20, stdio: ['ignore', 'pipe', 'pipe'] }) }
    const parsed = JSON.parse(String(call.stdout || ''))
    return { ok: parsed.ok ?? 0, warning: parsed.warning ?? 0, error: parsed.error ?? 0, items: parsed.items ?? [] }
  } catch (e) {
    // cert-expiry-check 以非 0 退出时 stdout 仍带完整 JSON(1=过期 2=临近 3=缺失),先解析再谈失败
    const raw = String((e && e.stdout) || '')
    try {
      const parsed = JSON.parse(raw)
      return { ok: parsed.ok ?? 0, warning: parsed.warning ?? 0, error: parsed.error ?? 0, items: parsed.items ?? [] }
    } catch {
      return { unjudged: `证书尺子未产出结论: ${String((e && e.message) || e).split(/\r?\n/)[0].slice(0, 120)}` }
    }
  }
}

export function evaluate({ repoRoot = REPO_ROOT, envFiles = MANAGED_ENVS, fs, certRunner } = {}) {
  const env = checkManagedEnvFiles({ repoRoot, envFiles, ...(fs ? { fs } : {}) })
  const certs = checkCerts({ repoRoot, runner: certRunner })
  const certUnjudged = Boolean(certs.unjudged)
  const breaches = env.missing.length + (certs.error ?? 0)
  if (env.inputs === 0 && certUnjudged) {
    return { verdict: 'unjudged', why: '受管 .env 一个都不在,证书尺子也未出结论 ⇒ 没有可判输入', env, certs }
  }
  if (breaches > 0) return { verdict: 'breach', env, certs }
  if (certs.warning > 0) return { verdict: 'warn', env, certs }
  return { verdict: certUnjudged ? 'warn' : 'ok', env, certs, ...(certUnjudged ? { why: certs.unjudged } : {}) }
}

function selfTest() {
  const eq = (label, got, want) => {
    const a = JSON.stringify(got)
    const b = JSON.stringify(want)
    if (a !== b) {
      console.error(`✗ ${label}\n  got  ${a}\n  want ${b}`)
      process.exitCode = 1
    } else console.log(`✓ ${label}`)
  }
  eq('盘符路径判绝对', isAbsolutePathValue('F:/a/b.crt'), true)
  eq('反斜杠盘符判绝对', isAbsolutePathValue('D:\\x\\y.pem'), true)
  eq('POSIX 判绝对', isAbsolutePathValue('/opt/cert.pem'), true)
  eq('URL 不判绝对', isAbsolutePathValue('https://a/b.crt'), false)
  eq('相对路径不判绝对', isAbsolutePathValue('./cert/a.pem'), false)
  eq('占位符不判绝对', isAbsolutePathValue('${HOME}/a.pem'), false)
  eq('键名过 PATH 筛', PATH_KEY_RE.test('ALIPAY_APP_CERT_PATH'), true)
  eq('键名过 KEY 筛', PATH_KEY_RE.test('WX_PAY_PRIVATE_KEY_PATH'), true)
  eq('APP_ID 不是路径键', PATH_KEY_RE.test('ALIPAY_APP_ID'), false)
  eq('NOTIFY_URL 不是路径键', PATH_KEY_RE.test('ALIPAY_NOTIFY_URL'), false)
  eq(
    '解析注释/export/引号',
    parseEnvText('# c\nexport A_PATH="D:/x"\n\nB_KEY=\'D:/y\' # tail\nC=1').map((x) => [x.key, x.value]),
    [
      ['A_PATH', 'D:/x'],
      ['B_KEY', 'D:/y'],
      ['C', '1'],
    ],
  )
  const fakeFs = {
    existsSync: (p) => String(p).endsWith('env') || p === 'D:/ok.pem',
    readFileSync: () => 'GOOD_PATH=D:/ok.pem\nBAD_PATH=F:/nope/x.crt\nPLAIN_ID=123\n',
  }
  const r = checkManagedEnvFiles({ repoRoot: '/repo', envFiles: ['env'], fs: fakeFs })
  eq('断链被点名', r.missing.map((m) => m.key), ['BAD_PATH'])
  eq('非路径键不参与', r.scanned[0].keys, 2)
  if (!process.exitCode) console.log('\n✅ self-test 全过')
}

if (process.argv.includes('--self-test')) {
  selfTest()
} else {
  const result = evaluate()
  const { verdict } = result
  if (jsonOut) {
    console.info(JSON.stringify(result, null, 2))
  } else {
    for (const s of result.env.scanned) console.log(`· ${s.file}: ${s.keys} 个路径键`)
    for (const m of result.env.missing) console.log(`✗ 断链 ${m.file}:${m.line} ${m.key} -> ${m.path}`)
    if (result.certs && !result.certs.unjudged) console.log(`· 证书: ok=${result.certs.ok} warn=${result.certs.warning} err=${result.certs.error}`)
    else if (result.certs) console.log(`· 证书: 未判定 —— ${result.certs.unjudged}`)
    console.log(verdict === 'ok' ? '✅ 所有路径可达' : verdict === 'warn' ? `⚠️ 需关注${result.why ? `(${result.why})` : ''}` : verdict === 'breach' ? '❌ 有断链/证书错误' : `ℹ️ 未判定${result.why ? `: ${result.why}` : ''}`)
  }
  process.exit(verdict === 'breach' ? 1 : verdict === 'unjudged' ? 2 : 0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
