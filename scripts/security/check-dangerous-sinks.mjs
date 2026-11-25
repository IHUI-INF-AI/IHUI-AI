#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 门需要 stdout 诊断 */
/**
 * 危险 sink 静态检查(2026-11-24 立)。
 *
 * 只收「拿到输入就能直接打成 RCE/注入/越权」的组合,不收"用了 child_process"这种
 * 形态判断 —— 本仓运维脚本大量合法使用 execFile/spawn,按形态判会制造一片恒红,
 * 结局是整道门被 --no-verify 废掉(AGENTS §12e)。
 *
 * 语言分流(这一条是降噪的关键):
 *   Python 的 `r.eval(...)` 是 Redis 客户端 API、`conn.deserialize` 是第三方库方法,
 *   按 JS 的「eval/deserialize 即危险」去判会产生 200+ 条假红。故规则按扩展名分组,
 *   Python 只判 `pickle.loads` / 非 SafeLoader 的 yaml.load / `os.system` 拼接 /
 *   `subprocess(shell=True)` / `verify=False`,以及**不带点前缀**的真 eval。
 *
 * 每条危险规则都要求「输入与 sink 同现」:`exec(\`...\`)` 带插值才判,
 * `execFile('git', args)` 不判;`query('...' + x)` 才判,`query(sql, params)` 不判。
 *
 * 用法:
 *   node scripts/security/check-dangerous-sinks.mjs
 *   node scripts/security/check-dangerous-sinks.mjs --update-baseline
 *   node scripts/security/check-dangerous-sinks.mjs --json
 * 退出码: 0 无新增 | 1 新增 | 2 未判定
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultBaselinePath, listRepoFiles, runScanCli, scanLines } from './lib/scan-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

const JS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
const PY = ['.py']

export const SINKS_RULES = Object.freeze([
  // ── JS / TS ────────────────────────────────────────────────
  { id: 'eval', severity: 'critical', exts: JS, re: /(?<![.\w])eval\s*\(/, message: 'eval 执行动态代码', ignore: /eval\s*\([^)]*\)\s*:\s*(?:Promise|unknown|void)/ },
  { id: 'new-function', severity: 'critical', exts: JS, re: /\bnew\s+Function\s*\(/, message: 'Function 构造器执行动态代码' },
  { id: 'exec-interp', severity: 'critical', exts: JS, re: /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/, message: 'shell 命令含插值/拼接（命令注入）' },
  { id: 'spawn-shell', severity: 'high', exts: JS, re: /\bspawn(?:Sync)?\s*\([\s\S]{0,200}shell\s*:\s*true/, message: 'spawn 开启 shell（参数被 shell 解析）' },
  { id: 'sql-concat', severity: 'high', exts: JS, re: /\b(?:query|execute)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/, message: 'SQL 语句含插值/拼接（注入）' },
  { id: 'vm-run', severity: 'high', exts: JS, re: /\b(?:runInContext|runInNewContext|runInThisContext)\s*\(/, message: 'vm 执行动态代码' },
  { id: 'tls-bypass', severity: 'critical', exts: JS, re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|rejectUnauthorized\s*:\s*false/, message: '关闭 TLS 证书校验（中间人）' },
  { id: 'jwt-noexp', severity: 'critical', exts: JS, re: /ignoreExpiration\s*:\s*true|algorithms\s*:\s*\[\s*['"]none['"]\s*\]/, message: 'JWT 关闭过期/允许 none 算法' },
  { id: 'weak-random-secret', severity: 'high', exts: JS, re: /(?:token|secret|password|nonce|salt)[^\n]{0,40}Math\.random\s*\(/i, message: '用 Math.random 生成安全敏感值' },
  { id: 'path-from-input', severity: 'medium', exts: JS, re: /(?:readFile|readFileSync|createReadStream|writeFile|sendFile)\s*\(\s*(?:path\.)?join\(\s*[^)]*\b(?:req|query|params|body)\b/, message: '文件路径由请求参数拼接（路径穿越）' },
  { id: 'ssrf-fetch', severity: 'high', exts: JS, re: /\bfetch\s*\(\s*(?:req\.|request\.|ctx\.|query\.|\$\{)/, message: '出站请求地址来自请求参数（SSRF）' },
  { id: 'dangerous-html', severity: 'medium', exts: ['.tsx', '.jsx'], re: /dangerouslySetInnerHTML\s*=/, message: '直接注入 HTML（XSS，需确认已 sanitize）', ignore: /DOMPurify|sanitize|jsonLdHtml|escapeHtml/i },

  // ── Python ─────────────────────────────────────────────────
  // 不带点前缀的 eval 才是 Python 内置 eval;`r.eval(` 是 Redis Lua,不判。
  { id: 'py-eval', severity: 'critical', exts: PY, re: /(?:^|[^.\w])eval\s*\(/, message: 'Python eval 执行动态代码' },
  { id: 'py-exec', severity: 'high', exts: PY, re: /(?:^|[^.\w])exec\s*\(/, message: 'Python exec 执行动态代码', ignore: /\bdef\s+exec\s*\(/ },
  { id: 'py-pickle', severity: 'high', exts: PY, re: /\b(?:pickle|cPickle)\.loads?\s*\(/, message: '反序列化不可信数据（pickle RCE）' },
  { id: 'py-yaml-unsafe', severity: 'high', exts: PY, re: /\byaml\.load\s*\(/, message: 'yaml.load 未指定 SafeLoader（RCE）', ignore: /SafeLoader|safe_load/ },
  { id: 'py-os-system', severity: 'high', exts: PY, re: /\bos\.system\s*\(\s*(?:f['"]|['"][^'"]*['"]\s*(?:%|\+|\.format))/, message: 'os.system 拼接命令（命令注入）' },
  { id: 'py-subprocess-shell', severity: 'high', exts: PY, re: /\bsubprocess\.(?:run|call|Popen|check_output)\s*\([\s\S]{0,120}\bshell\s*=\s*True/, message: 'subprocess 开启 shell（参数注入）' },
  // 本仓 TLS 关闭是**有意的 dev 开关**(生产由 IHUI_TLS_VERIFY 强制开启),故只记 medium;
  // 真在生产无条件关闭的那一条由「行内无 dev/switch 语义」的复核用例兜底。
  { id: 'py-tls-verify', severity: 'medium', exts: PY, re: /\bverify\s*=\s*False/, message: 'requests 关闭 TLS 校验（确认是否 dev 开关）', ignore: /\b(?:dev|development|allow|switch|insecure|tls_verify)\b/i },
])

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']
const TEST_RE = /(?:^|\/)(?:__tests__|tests?|e2e)\/|\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs|py)$/
// 只扫「会被公网请求触达」的代码:构建脚本 / CLI 工具 / 小程序脚手架里的
// execSync 与 new Function 是工具链的正常实现,攻击者根本碰不到它们。
// 把工具链也算进来会把这道门变成 150 条恒红 —— 那不是安全,是噪音。
const SCOPE_RE = /^(?:apps\/(?:api|ai-service|web)\/(?:src|app)\/|packages\/|deploy\/win\/)/

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const updateBaseline = argv.includes('--update-baseline')
  const strict = !argv.includes('--no-strict')
  const baselinePath = defaultBaselinePath(ROOT, 'dangerous-sinks')

  const { files, error } = listRepoFiles(ROOT, { exts: EXTS })
  const scanned = files.filter((f) => SCOPE_RE.test(f) && !TEST_RE.test(f))
  const { findings, skipped } = scanLines(scanned, SINKS_RULES, ROOT)

  const result = runScanCli({
    name: 'dangerous-sinks',
    findings,
    skipped,
    baselinePath,
    strict,
    updateBaseline,
    root: ROOT,
    extraLines: [`扫描面 ${scanned.length} 个源文件（已排除测试与构建产物）`],
    unjudged: error,
  })
  if (json) console.log(JSON.stringify({ ok: result.code === 0, ...result.counts, findings: findings.slice(0, 200) }, null, 2))
  return result.code
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('check-dangerous-sinks.mjs')
if (IS_MAIN) process.exit(main())

export const __test__ = { SINKS_RULES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
