#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 凭据前缀一致性守门(2026-09-13 立)。
 *
 * 根因案例(2026-09-13 实修 8 处):IHUI 中转站对外 API 的凭据体系是两个字段——
 *   - `key`    形如 `ihui_` + 24 位 hex,**唯一可当 Bearer 用**的凭据
 *   - `secret` 形如 `sk_`  + 32 位 hex,**只走 `X-Api-Secret` 头**的可选二次校验因子
 * 鉴权实现见 `apps/api/src/plugins/api-key-auth.ts`(Bearer → 查 `developer_api_keys.key`;
 * `X-Api-Secret` → 校验 `secret`)。但 4 个 UI 页面 + 4 份文档把 Bearer 占位符写成
 * `sk-xxx`,用户照抄必然 401 `Invalid or revoked API key`。
 *
 * 规则:面向用户的凭据文案/示例中,`Authorization: Bearer` / `api_key` / `API_KEY`
 * 一律使用 `ihui_` 前缀;`sk_` 只允许出现在描述 `X-Api-Secret` 的语境里。
 *
 * 豁免(不误报):
 *   - 上游厂商自有 key(DeepSeek/OpenAI 等 `sk-...`)——测试夹具、provider smoke 脚本
 *     (`tests/` `__tests__/` `*.test.*` `*.spec.*` 与 `apps/ai-service/scripts/` 均不在扫描面)
 *   - 脱敏展示值 `sk-***`(响应示例里已被掩码,非可复制凭据)
 *
 * 用法:
 *   node scripts/check-api-credential-prefix.mjs --staged   (pre-commit, 有违规则 exit 1)
 *   node scripts/check-api-credential-prefix.mjs             (全量扫描报告, exit 0)
 *   node scripts/check-api-credential-prefix.mjs --self-test (自检规则正则)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const isStaged = argv.includes('--staged')
const isSelfTest = argv.includes('--self-test')

/** 扫描面:面向用户暴露凭据文案的目录/文件(相对 ROOT)。 */
const SCAN_ROOTS = [
  'apps/web',
  'docs',
  'packages/sdk',
  'apps/cli/README.md',
  'README.md',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
]
const SCAN_EXTS = ['.md', '.ts', '.tsx', '.js', '.jsx', '.vue', '.json']
const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.next',
  'out',
  'coverage',
  'tests',
  '__tests__',
  'test',
  'e2e',
  '.ihui-agent',
  '.git',
  '.workbuddy',
  '.husky',
])

/**
 * 违规规则。每条 = { id, re, why, suggest }。
 * 全部为「把 secret 当 Bearer / 把不存在的 sk- 前缀当产品凭据」的写法。
 */
const RULES = [
  {
    id: 'bearer-sk',
    // Bearer 后跟 sk- 或 sk_(我们的 secret 前缀),无论出现在示例还是文案里都是错的
    re: /Bearer\s+sk[-_]/i,
    why: 'Bearer 必须用公开标识 `ihui_xxx`,不能用 `sk_`(secret 只走 X-Api-Secret)',
  },
  {
    id: 'placeholder-sk',
    re: /sk-your-api-key/i,
    why: '占位符 `sk-your-api-key` 会让用户照抄成不可用的 Bearer,应为 `ihui_xxx`',
  },
  {
    id: 'mixed-prefix',
    re: /ihui_sk_/i,
    why: '`ihui_sk_` 是混合前缀(不存在),应为 `ihui_`',
  },
  {
    id: 'apikey-sk-ihui',
    // 明确的本公司凭据标记:sk-ihui-xxxxx(不存在的混合前缀)
    re: /api[-_]?key["']?\s*[:=]\s*["']sk-ihui/i,
    why: '公司凭据不能写成 `sk-ihui-xxx`,应为 `ihui_xxx`(secret 是 `X-Api-Secret` 专用)',
  },
  {
    id: 'apikey-sk-placeholder',
    // 通用占位符 sk-xxx 出现在 apiKey 赋值处(上游厂商 key 形如 sk-ant-/sk-step-/sk-... 不命中)
    // BYOK 语境豁免:紧邻上文出现 provider 字段 / CreateUserModel / create_user_model 时,
    // 该 apiKey 指的是「用户自有的上游厂商 key」,`sk-xxx` 是正确写法(见 contextIsByok)。
    re: /api[-_]?key["']?\s*[:=]\s*["']sk-xxx["']/i,
    contextIsByok: true,
    why: '`apiKey` 字段承载的 Bearer 凭据应为 `ihui_xxx`(secret 是 `X-Api-Secret` 专用)',
  },
  {
    id: 'env-sk',
    re: /IHUI_API_KEY\s*[:=]\s*["']?sk[-_]/i,
    why: '`IHUI_API_KEY` 应为 `ihui_xxx`(或 JWT 访问令牌),不能是 `sk_`',
  },
]

/** 允许出现的正则(行级豁免)——脱敏展示值。 */
const LINE_ALLOW = [/sk-\*{2,}/, /\bsk-\*\*\*/, /X-Api-Secret/i]

function walk(target, out = []) {
  const full = join(ROOT, target)
  if (!existsSync(full)) return out
  if (statSync(full).isFile()) {
    if (SCAN_EXTS.some((e) => target.endsWith(e))) out.push(target)
    return out
  }
  for (const name of readdirSync(full)) {
    if (EXCLUDE_DIR_NAMES.has(name)) continue
    const rel = `${target}/${name}`
    const abs = join(ROOT, rel)
    if (statSync(abs).isDirectory()) walk(rel, out)
    else if (SCAN_EXTS.some((e) => name.endsWith(e))) out.push(rel)
  }
  return out
}

function listStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    return out
      .split('\n')
      .map((f) => f.trim().replace(/\\/g, '/'))
      .filter((f) => f && SCAN_EXTS.some((e) => f.endsWith(e)))
  } catch {
    return []
  }
}

/** 该文件是否属于扫描面。 */
function inScope(file) {
  return SCAN_ROOTS.some((r) => (r.endsWith('.md') ? file === r : file.startsWith(`${r}/`)))
}

/** 该文件是否命中排除目录。 */
function isExcluded(file) {
  return file.split('/').some((seg) => EXCLUDE_DIR_NAMES.has(seg) || isExcludedDirName(seg))
}

const SUPPRESS = /check-api-credential-prefix-disable-next-line|api-credential-prefix-ignore/i

/** BYOK 语境标记:该处 apiKey 指的是用户自有的上游厂商 key,而非平台凭据。 */
const BYOK_CONTEXT = /["']?provider["']?\s*[:=]|create_user_model|CreateUserModel/

/** 扫描单个文件,返回 findings。 */
export function scanFile(file) {
  const abs = join(ROOT, file)
  if (!existsSync(abs)) return []
  let text
  try {
    text = readFileSync(abs, 'utf8')
  } catch {
    return []
  }
  const findings = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (LINE_ALLOW.some((re) => re.test(line))) continue
    if (SUPPRESS.test(line)) continue
    for (const rule of RULES) {
      if (!rule.re.test(line)) continue
      // BYOK 语境豁免:向上回看 4 行,若出现 provider 字段/用户自定义模型 API,则跳过
      if (rule.contextIsByok) {
        const from = Math.max(0, i - 4)
        const ctx = lines.slice(from, i + 1).join('\n')
        if (BYOK_CONTEXT.test(ctx)) continue
      }
      findings.push({ file, line: i + 1, rule: rule.id, why: rule.why, text: line.trim() })
      break
    }
  }
  return findings
}

function selfTest() {
  const cases = [
    ['-H "Authorization: Bearer sk-xxx"', true],
    ['-H "Authorization: Bearer sk_abc"', true],
    ['Authorization: Bearer ihui_xxx', false],
    ['X-Api-Secret: sk_xxx', false],
    ['"apiKey": "sk-xxx"', true],
    ['APIKey:   "sk-xxx",', true],
    ['client = IHUIClient(api_key="sk-ihui-...")', true],
    ['api_key="sk-ihui-xxxxx",', true],
    ['"apiKey": "sk-***"', false],
    ['"openai": {"api_key": "sk-...", "api_base": "https://api.openai.com/v1"},', false],
    ['"anthropic":  {"api_key": "sk-ant-..."},', false],
    ['openaiApiKey: "sk-...",', false],
    ['"stepfun":    {"api_key": "sk-step-..."},', false],
    ['apiKey: "ihui_xxx"', false],
    ['IHUI_API_KEY="sk-your-api-key"', true],
    ['IHUI_API_KEY="ihui_your_api_key"', false],
    ['export IHUI_API_KEY="eyJhbGciOi..."', false],
    ['sk-your-api-key', true],
    ['ihui_sk_xxxx', true],
    ['Bearer eyJhbGciOiJIUzI1NiJ9', false],
  ]
  let bad = 0
  for (const [line, expect] of cases) {
    if (LINE_ALLOW.some((re) => re.test(line))) {
      if (expect) {
        console.error(`${C.red}✗ 自检失败(被豁免掉但期望命中):${line}`)
        bad++
      }
      continue
    }
    const hit = RULES.some((r) => r.re.test(line))
    if (hit !== expect) {
      console.error(`${C.red}✗ 自检失败:${line} → 命中=${hit} 期望=${expect}`)
      bad++
    }
  }
  if (bad === 0) console.log(`${C.green}✅ 规则自检通过(${cases.length} 条)`)
  else console.error(`${C.red}❌ 规则自检失败 ${bad} 条`)
  return bad === 0
}

function main() {
  if (isSelfTest) process.exit(selfTest() ? 0 : 1)

  const files = isStaged
    ? listStagedFiles().filter((f) => inScope(f) && !isExcluded(f))
    : SCAN_ROOTS.flatMap((r) => walk(r)).filter((f) => !isExcluded(f))

  const findings = files.flatMap(scanFile)

  if (findings.length === 0) {
    const scope = isStaged ? `${files.length} 个已暂存文件` : `${files.length} 个文件`
    console.log(`${C.green}✅ 凭据前缀一致(${scope})`)
    return 0
  }

  console.error(`${C.red}❌ 发现 ${findings.length} 处凭据前缀误用:`)
  for (const f of findings) {
    console.error(`   ${f.file}:${f.line}  [${f.rule}]  ${f.text}`)
    console.error(`      → ${f.why}`)
  }
  console.error('')
  console.error('   统一口径:`Authorization: Bearer ihui_xxx`;`sk_xxx` 仅用于 `X-Api-Secret`。')
  console.error('   权威说明:docs/developer/getting-started/authentication.md')
  return isStaged ? 1 : 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
