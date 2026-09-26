#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// AI 部署诊断助手(P2-13 deploy 运维 AI 化):把部署/运维失败日志交给 LLM 网关,
// 产出结构化诊断报告(直接错误 → 根因假设 → 修复建议 → 风险 → 需人工确认项)。
//
// 用法:
//   node ai-diagnose.mjs --log /var/log/ihui-deploy.log [--tail 400] [--context "额外上下文"] [--out report.md]
//   cat error.log | node ai-diagnose.mjs --context "nginx 切换失败"
//
// 环境变量:
//   IHUI_AI_KEY        必填。LLM 网关 API Key;未设置时本脚本拒绝运行(绝不编造诊断)。
//   IHUI_AI_BASE       选填。OpenAI 兼容网关基址,默认 https://aizhs.top/v1
//   IHUI_AI_MODEL      选填。默认 glm-5.3-flash
//   IHUI_AI_TIMEOUT_MS 选填。请求超时,默认 90000
//
// 安全设计:
//   - 发送前对日志做密钥脱敏 —— **有界,不是"一律抹掉"**:只盖 `sk-` 前缀 / `Bearer <token>` /
//     `api key|token|password|passwd|secret|authorization` 的 k=v 赋值三族;
//     `ihui_…`、`sk_…`、`ghp_…`/`github_pat_…`、`AKIA/ASIA`、裸 JWT `eyJ…`、PEM 私钥、
//     `scheme://user:pass@host` 均未覆盖,逐条理由与实测证据见下面 redact() 的注释块。
//   - 只取日志尾部(默认 400 行 / 24,000 字符),这既是上下文预算也是长度上限:
//     进入模型的不可信文本一律受该档约束,超限即加"前文已截断"可见标记(不静默变短)。
//   - 退出码:0 成功 / 2 配置缺失 / 3 API 失败或超时 / 4 无日志输入
//
// 平台特有:依赖 Node fetch/DOM 编码,作为部署机独立工具,不适合进 packages/。

const DEFAULT_BASE = 'https://aizhs.top/v1'
const DEFAULT_MODEL = 'glm-5.3-flash'
const DEFAULT_TAIL = 400
const MAX_CHARS = 24000

function parseArgs(argv) {
  const args = { tail: DEFAULT_TAIL, log: null, context: '', out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--log') args.log = argv[++i]
    else if (a === '--tail') args.tail = Math.max(1, parseInt(argv[++i], 10) || DEFAULT_TAIL)
    else if (a === '--context') args.context = argv[++i] || ''
    else if (a === '--out') args.out = argv[++i]
    else if (a === '-h' || a === '--help') args.help = true
  }
  return args
}

// 密钥脱敏:**只覆盖下面三条正则真能命中的形态**,不承诺"一律抹掉"。
//
// 为什么不复用共享层那一份更宽的并集(`packages/shared/src/utils/redact.ts`,
// 含 ihui_/sk_/ghp_/github_pat_/AKIA/ASIA/裸 JWT/PEM 私钥/URL 内联凭据/邮箱/IP):
// **实测被否证,不是没试。** 本文件在 `deploy/` 下,而 `pnpm-workspace.yaml` 的 globs 只有
// `apps/*` 与 `packages/*` ⇒ deploy 不是 workspace 包、自身没有 package.json/node_modules;
// 又因 `nodeLinker: isolated`,workspace 包只软链进各消费包自己的 node_modules,
// 根 `node_modules/@ihui/` 里只有 eslint-config。实测:
//   createRequire('G:/IHUI-AI/deploy/scripts/ai-diagnose.mjs').resolve('@ihui/shared')
//   → MODULE_NOT_FOUND: Cannot find module '@ihui/shared'
// 要接通必须新建 deploy/package.json + 改 workspace globs + 跑全量 pnpm install,
// 那是依赖树动作(§12e 记过 `--filter` 剪链接把约 110 道守门一起废掉的事故),不属本票范围。
// **结论:本文件是一份刻意更窄的本地实现,不是"共享层之外不该有第二套"的例外 ——
// 第二套更窄的规则正是 §3 禁止的形状,所以这里以注释把差集写在脸上,而不是假装盖全。
//
// 实测已覆盖(逐条跑过,输入为本文件真实产出形态):
//   1. `sk-` 前缀 key(OpenAI/Anthropic 风格,>=8 位)
//   2. `Bearer <token>` 整段
//   3. `api[_-]?key|token|password|passwd|secret|authorization` 的 `k=v` / `k: v` 赋值
//      (引号包裹亦盖)
//
// 实测**未覆盖**(裸形态、键名不在上面那串里,就原样发给网关):
//   · `ihui_xxx` 对客 key(只在跟在 `Authorization:` 后面时被第 3 条顺带盖掉)
//   · `sk_xxx` 上游号池 key(下划线,第 1 条只认连字符)
//   · `ghp_xxx` / `github_pat_xxx` GitHub token
//   · `AKIAxxxxxxxx` / `ASIAxxxxxxxx` AWS Access Key ID
//   · 裸 JWT `eyJ….….…`(只有带 `Bearer ` 前缀时才盖)
//   · PEM 私钥整块、`scheme://user:pass@host` 内联凭据
//   · 邮箱 / IPv4 / 24 位以上 hex 串
// 处置口径:要给 LLM 诊断的日志若可能含上述裸形态,先人工过一遍再喂本脚本;
// 真正需要宽脱敏的链路(交接单/出库边界)请走 `sanitizeEvidenceText`,别扩这里的正则。
function redact(text) {
  return text
    .replace(/sk-[\w-]{8,}/g, '[REDACTED]')
    .replace(/Bearer\s+[\w.~-]{8,}/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:api[_-]?key|token|password|passwd|secret|authorization)\s*[=:]\s*)(["']?)[^\s"']+\2/gi,
      '$1[REDACTED]',
    )
}

async function readInput(args) {
  if (args.log) {
    const fs = await import('node:fs')
    const raw = fs.readFileSync(args.log, 'utf8')
    const lines = raw.split('\n')
    return lines.slice(Math.max(0, lines.length - args.tail)).join('\n')
  }
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const SYSTEM_PROMPT = `你是资深部署运维诊断工程师,负责分析 IHUI-AI 项目的部署失败日志。
项目拓扑:Next.js web + Fastify api + FastAPI ai-service,nginx 蓝绿切换(blue 8801/8802,green 8803/8804),
部署机经 Cloudflare Tunnel 暴露,无公网 SSH。
严格只依据给定日志与上下文诊断,绝不编造日志中不存在的事实;证据不足时明确说"证据不足"。
输出 Markdown,结构固定如下(不要输出其他内容):
## 结论
(一句话:最可能的失败原因)
## 直接错误
(日志中逐字摘录的关键错误行,注明行号或位置)
## 根因假设
(按可能性排序,每条注明支持它的日志证据;无证据的猜测不写)
## 修复建议
(可直接执行的命令或配置修改,按步骤列出)
## 风险
(执行修复建议可能影响的方面)
## 需人工确认
(日志无法判断、需要人上服务器确认的点)`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('用法: node ai-diagnose.mjs --log <file> [--tail 400] [--context "..."] [--out report.md];或 cat error.log | node ai-diagnose.mjs')
    process.exit(0)
  }
  const key = process.env.IHUI_AI_KEY
  if (!key) {
    console.error('[ai-diagnose] 缺少 IHUI_AI_KEY 环境变量,拒绝运行(不产生编造诊断)。退出码 2。')
    process.exit(2)
  }
  const base = (process.env.IHUI_AI_BASE || DEFAULT_BASE).replace(/\/+$/, '')
  const model = process.env.IHUI_AI_MODEL || DEFAULT_MODEL
  const timeoutMs = parseInt(process.env.IHUI_AI_TIMEOUT_MS || '90000', 10)

  let logText = ''
  try {
    logText = await readInput(args)
  } catch (e) {
    console.error(`[ai-diagnose] 读取日志失败: ${String(e && e.message ? e.message : e)}`)
    process.exit(4)
  }
  logText = redact(logText)
  if (logText.trim().length === 0) {
    console.error('[ai-diagnose] 日志内容为空,无输入可诊断。退出码 4。')
    process.exit(4)
  }
  if (logText.length > MAX_CHARS) {
    logText = '...(前文已截断,仅保留尾部)\n' + logText.slice(-MAX_CHARS)
  }

  const userContent = [
    args.context ? `【运维上下文】${args.context}` : '',
    `【日志时间】${new Date().toISOString()}`,
    `【失败日志(尾部)】\n${logText}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  let resp
  try {
    resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    console.error(`[ai-diagnose] 网关请求失败(${base}): ${String(e && e.message ? e.message : e)}。退出码 3。`)
    process.exit(3)
  }
  if (!resp.ok) {
    const body = (await resp.text().catch(() => '')).slice(0, 500)
    console.error(`[ai-diagnose] 网关返回 HTTP ${resp.status}: ${body}。退出码 3。`)
    process.exit(3)
  }
  let report = ''
  try {
    const data = await resp.json()
    report = data?.choices?.[0]?.message?.content || ''
  } catch {
    console.error('[ai-diagnose] 网关响应不是合法 JSON。退出码 3。')
    process.exit(3)
  }
  if (!report.trim()) {
    console.error('[ai-diagnose] 网关返回空诊断。退出码 3。')
    process.exit(3)
  }
  console.log(report)
  if (args.out) {
    const fs = await import('node:fs')
    fs.writeFileSync(args.out, report, 'utf8')
    console.error(`[ai-diagnose] 报告已写入 ${args.out}`)
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
