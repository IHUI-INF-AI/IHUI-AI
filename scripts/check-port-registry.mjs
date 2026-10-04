#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 端口注册表守门脚本(2026-07-22 立)
 *
 * 守门规则(docs/port-management.md §3):
 * - dev/宿主映射端口必须以 88 开头
 * - 检测 staged 文件中的 localhost:PORT 引用,PORT 非 88xx → warn
 * - 豁免:CI workflows / 测试默认值 / Docker 容器内部端口 / healthcheck / 第三方端口
 *
 * 登记表对账(2026-09-28 票 G-409 新增,同一条缝的成本最低、判定最硬的那一半):
 *   本脚本过去**自己抄一份端口清单**,注释还写着"与 docs/port-management.md §2 同步" ——
 *   于是三副本(JSON 注册表 / docs §2 / 代码 Set)里代码那份既不由谁派生,也没有一道门问它
 *   跟另两份是否同值;docs 侧更是从未参与过任何比较。现按两条机械判据收口:
 *     P0 代码侧不再手抄:`REGISTERED_PORTS` 一律从 `scripts/dev-port-registry.json` 的
 *        `registered_ports` 派生;派生不出来(键缺失 / 形态判不出 / 派生出 0 个)⇒ **无法判定
 *        exit 2**,绝不回落成"空清单"或任何旧的手抄表(那等于把尺子调成恒绿)。
 *     P1 `docs/port-management.md §2` 表格里出现的端口(含 §2 明写的预留槽)与派生集**双向**
 *        对账:文档多报(§2 写了而注册表没认领)/ 注册表多认领(认领了而 §2 没写)都点名。
 *   定级:本门在 runner(id 24b)是 warn-only,所以 P1 的偏差按 warn 口径 exit 1 并逐条报名;
 *   要单独问责跑 `--parity`(该档把 P1 当唯一判据:偏差 exit 1、输入取不到 exit 2,不记通过)。
 *   现读(HEAD 面,2026-09-28):文档侧与派生集**同为 50 槽、双向差集均为 0**;而被删掉的那份
 *   手抄表是 49 槽(漏 8840) —— 即三副本今天确实已漂一格,漂的正是无人对账的那一份。
 *
 * 集成位置:pre-commit 第 24 项(warn-only,不阻塞 commit)
 *
 * 用法:
 *   node scripts/check-port-registry.mjs           # 扫描 staged 文件
 *   node scripts/check-port-registry.mjs --all      # 扫描全项目
 *   node scripts/check-port-registry.mjs --parity   # 只跑 P0/P1 登记表对账(问责档)
 *   取材面旗(仅作用于 P0/P1 的两份输入):默认 HEAD blob / --staged 索引 blob / --worktree 人工逃生舱,
 *   两面旗同给 ⇒ exit 2。扫描 corpus 的口径一字未动(仍按 cwd 的工作树读,见下方"为什么扫描面不迁")。
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
// 两份登记表输入走统一取材层(守门 118:改了判据面不许散写 git / 不许按磁盘判被审内容)。
// 刻意**不**把上面的 corpus 扫描也迁过去:那一扫的是"本次要提交的在途内容",本门立项理由
// 就是看见尚未入库的端口引用;迁移它等于换判据(守门 70/103 那条"改判据必须同批改口径")。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

// 2026-09-23 加固:单文件字节上限 + git 调用超时。成因见 main() 内注释。
const MAX_SCAN_BYTES = 2 * 1024 * 1024

// ============================================================
// 端口认领清单(唯一真相 = scripts/dev-port-registry.json 的 registered_ports)
// ============================================================
const REGISTRY_REL = 'scripts/dev-port-registry.json'
const DOC_REL = 'docs/port-management.md'

/**
 * 纯函数:把注册表的一条认领项展开成端口数组。
 * 只认两种形态:`{port:8877}` 与 `{range:[8801,8809]}`(端点均为整数且区间 ≤1000)。
 * 其余(变量、字符串、倒序区间)一律返回 null 交上层点名 —— 判据不猜,更不"顺手放宽一档"。
 */
export function expandRegisteredEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (Number.isInteger(entry.port)) return [entry.port]
  const r = entry.range
  if (!Array.isArray(r) || r.length !== 2) return null
  const [a, b] = r
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a || b - a > 1000) return null
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

/**
 * 纯函数(P0):从注册表对象派生"已认领端口集"。
 * `problems` 非空 ⇒ 派生不出来,调用方必须判"无法判定",**禁止**回落成空集继续扫
 * (空集会让每一个 88xx 引用都变违规 —— 那是把尺子调成恒红,与恒红门同罪)。
 */
export function deriveRegisteredPorts(reg) {
  const problems = []
  const ports = new Set()
  const list = reg && Array.isArray(reg.registered_ports) ? reg.registered_ports : null
  if (!list) {
    return { ports, problems: ['注册表缺 registered_ports 数组(不回落任何手抄清单)'], entries: 0 }
  }
  if (list.length === 0) {
    return { ports, problems: ['registered_ports 为空数组(空扫不派生,拒绝当作"无认领端口"继续判)'], entries: 0 }
  }
  list.forEach((entry, i) => {
    const got = expandRegisteredEntry(entry)
    if (!got) {
      problems.push(`registered_ports[${i}] 形态判不出:既没有整数 port,也没有合法 range 数组`)
      return
    }
    for (const p of got) ports.add(p)
  })
  if (ports.size === 0) problems.push('派生出 0 个端口(条目全被跳过 ⇒ 判据失明,不是"没有认领")')
  return { ports, problems, entries: list.length }
}

/**
 * 纯函数:把 §2 表格首格展开成端口数组。
 * 认 '8801'、'8822-8829'、'8840/8842-8849'、以及 Markdown 装饰(`~~删除线~~`/`` ` ``/粗体)包裹的形态;
 * '—' / '-' / '预留扩展' / 分隔行一律返回空数组(那不是端口)。
 */
export function expandDocCell(cell) {
  const s = String(cell ?? '')
    .replace(/[*_`~]/g, '')
    .trim()
  if (!s || /^[-—–:|]+$/.test(s)) return []
  const out = new Set()
  let matched = false
  for (const part of s.split(/[,/]/)) {
    const seg = part.trim()
    const rng = seg.match(/^(\d{4})\s*[-–~]\s*(\d{4})$/)
    if (rng) {
      const a = Number(rng[1])
      const b = Number(rng[2])
      if (b >= a && b - a <= 1000) {
        for (let p = a; p <= b; p++) out.add(p)
        matched = true
      }
      continue
    }
    const one = seg.match(/^(\d{4})$/)
    if (one) {
      out.add(Number(one[1]))
      matched = true
    }
  }
  return matched ? [...out] : []
}

/**
 * 纯函数(P1 的文档侧):只取 `## 2 端口注册表` 到下一个非 2 级章节之间的**表格行首格**。
 * 为什么必须限定在 §2:§3.3 的段位规则(`8800-8809 → 应用服务`)、§4 链路图、§6 变更记录里的
 * 数字都是叙述,把它们当登记表会造出满天假阳(本仓"注释里的形态不得判红"同一条禁令)。
 * 返回 {ports, rows, stoppedAtHeading}:rows=0 ⇒ 上层判"文档侧枚举为空",不记为通过。
 */
export function parseDocPortTable(mdText) {
  const lines = String(mdText ?? '').split(/\r?\n/)
  const ports = new Set()
  let rows = 0
  let inSec2 = false
  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(.*)$/)
    if (h) {
      const title = h[1].trim()
      if (/^2(\.|\s|$)/.test(title)) inSec2 = true
      else if (inSec2) inSec2 = false
      continue
    }
    if (!inSec2) continue
    if (!/^\s*\|/.test(line)) continue
    const cells = line.split('|')
    const first = cells.length > 2 ? cells[1] : ''
    const got = expandDocCell(first)
    if (got.length === 0) continue
    rows += 1
    for (const p of got) ports.add(p)
  }
  return { ports, rows, inSec2 }
}

/** 纯函数:双向差集。两侧都是"排序后的整数数组",便于逐条点名而不是只报一个数。 */
export function comparePortSets(docPorts, derivedPorts) {
  const onlyDoc = [...docPorts].filter((p) => !derivedPorts.has(p)).sort((a, b) => a - b)
  const onlyDerived = [...derivedPorts].filter((p) => !docPorts.has(p)).sort((a, b) => a - b)
  return { onlyDoc, onlyDerived }
}


// 豁免的非 88xx 端口(容器内部 / CI / 第三方)
const EXEMPT_PORTS = new Set([
  // Docker 容器内部端口
  5432, 6379, 4317, 4318, 16686, 9090, 9100, 3100,
  // CI/测试默认端口(GitHub Actions service containers)
  9091, // Prometheus 旧映射(CI 兼容)
  // 第三方服务端口
  587, 465, 25, // SMTP
  443, 80, // HTTP/HTTPS
  22, // SSH
  8888, // OTel Collector 自身 metrics(容器内部)
  14250, 14268, 14269, // Jaeger 内部
  13133, // OTel Collector 内部健康检查
  9080, // Promtail 内部健康检查
  1025, // mock SMTP(开发工具)
  // 只读探针的"必然失败"对照端口(不是任何服务的监听口):`scripts/check-public-path-probe.mjs`
  // 必须证明"连不上"这件事真的会被判成失败,否则它报的 0 次失败毫无意义。该端口刻意**不绑定**,
  // 因此它不属于"dev/宿主服务端口须 88xx"这一族 —— 登记表管的是会占口的东西。
  // 边界:只放这一个;日后若换端口必须同笔改探针与本行,否则对照会退化成"连到了一个真服务上"。
  47801, // 探针阳性对照(永不监听)
  // RSSHub(自建服务,127.0.0.1:12000,现处停用期;prometheus 抓取与告警规则都指向它)。
  // 属"自建服务的非 88xx 口",不是第三方容器口 —— 登记为例外是**带条件的**:
  // 若日后重新启用 RSSHub,应把它挪进 8830-8839(辅助)段并**同笔删掉本行**,
  // 同时改 monitoring/prometheus/{prometheus,alerts}.yml 里的 5 处引用;豁免不是永久通行证。
  12000, // RSSHub(停用中;重新启用时须改回 88xx 并删本行)
  11434, // Ollama 本地 LLM 服务
  1234, // LM Studio 本地 LLM 服务
  8765, // MCP transport 服务
  18999, // MCP OAuth 测试端口
  8001, // ai-service 测试 mock 端口
  8082, // 生产 admin-api 旧端口(部署文档兼容)
  9093, // Alertmanager 端口
  6688, // ai-feed-sources 第三方 feed 端口
  5173, // Vite 默认端口(第三方工具)
  9997, // Xinference(自托管)出厂默认端口 —— 与 11434(Ollama)/1234(LM Studio)同类的本地推理服务默认口;
  // 出现处是 provider 注册表的 default_base_url / baseUrl 兜底值,不是本仓 dev/宿主映射端口。
  // 2026-08-19 立:补充 --all monorepo-wide 扫描后发现的合法端口
  8080, // llama.cpp / 通用 Web 服务(ai-service providers 默认端口)
  8000, // dev container / FastAPI uvicorn 默认端口(.env.act / ai-service providers)
  // 2026-09-10 立:清零 --all 全量扫描遗留违规(均为工具/容器内部,非 dev/宿主映射端口)
  7897, // Clash 出站代理(SYNC_PROXY_URL 默认口,第三方工具)
  8081, // React Native Metro bundler /status(第三方工具默认端口)
  9000, // CLI 测试内联的 mock SSE URL(测试数据)
  9096, // alertbridge 监控 sidecar(容器内部)
  9121, // redis_exporter(容器内部)
  9182, // node_exporter(容器内部)
  9187, // postgres_exporter(容器内部)
  9222, // Chrome/Edge CDP --remote-debugging-port(browser 工具)
  9919, // MCP OAuth loopback 回调口(mcp_oauth_realnet_e2e.py,同 1738 SSO loopback 类)
  8901, // deploy-online.ps1 文档中本机参考验证端口(注释文本,非运行时配置)
  // 2026-10-03 立:收敛 --all 全量扫描慢性红(均为测试 fixture / 注释示例,非 dev/宿主映射端口)
  59999, // egress-retry-safety.ts 头注引用的 Node 原生错误消息示例(connect ECONNREFUSED),注释文本
  7800, // check-service-binary-paths.mjs 探针自检 fixture(模拟对端 192.168.1.37:7800 观测端点)
])

// 豁免文件路径模式(不扫描)
const EXEMPT_PATH_PATTERNS = [
  /node_modules\//,
  /\.next\//,
  /dist\//,
  /\.turbo\//,
  /pnpm-lock\.yaml$/,
  /uv\.lock$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.gif$/,
  /\.ico$/,
  /^docs\//, // docs/ 整目录豁免(文档端口是历史示例,非运行时配置)
  /docs\/port-management\.md$/, // 本规则文件自身(已被 ^docs/ 覆盖,保留显式注释)
  /scripts\/check-port-registry\.mjs$/, // 本守门脚本自身
  /scripts\/tests\/check-port-registry\.test\.mjs$/, // 本守门脚本测试文件
  /\.github\/workflows\//, // CI workflows(豁免)
  /apps\/api\/tests\//, // API 测试默认值(豁免)
  /apps\/ai-service\/tests\//, // AI-Service 测试默认值(豁免)
  /apps\/cli\/tests\//, // CLI 测试默认值(豁免,2026-10-03 补:plugin git-guard/url-shape/min-version fixtures)
  /apps\/web\/src\/lib\/__tests__\//, // web lib 测试 netstat/lsof/ss fixture(豁免)
  /scripts\/tests\//, // 守门脚本镜像测试 fixtures(豁免)
  /apps\/api\/scripts\//, // API 运维脚本(豁免)
  /apps\/cli\/src\/lib\/sso\.ts$/, // CLI SSO loopback 回调(设计端口 1738)
  /\.env\.example$/, // 环境变量模板(包含第三方工具端口示例)
  /PROJECT_PLAN\.md$/, // 项目计划文档(历史记录)
  /\.ihui-agent\/archive\//, // 归档文档(历史快照,不修改)
]

// ============================================================
// 工具函数
// ============================================================

/** 获取 staged 文件列表 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return output.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/** 检查文件路径是否豁免 */
function isExemptPath(filePath) {
  return EXEMPT_PATH_PATTERNS.some((pattern) => pattern.test(filePath))
}

/** 因"端口位置其实是正则字符类"而被跳过的引用数(判不了 ⇒ 如实报数,不静默丢掉)。 */
let regexishSkipped = 0
export function regexishSkippedCount() {
  return regexishSkipped
}

/** 从文件内容中提取 localhost:PORT 引用 */
function extractPortRefs(content) {
  const refs = []
  // 匹配 localhost:PORT 或 127.0.0.1:PORT
  const regex = /(?:localhost|127\.0\.0\.1):(\d{2,5})\b/g
  let match
  while ((match = regex.exec(content)) !== null) {
    // 紧跟捕获组的字符若是 `[` / `{`,那"端口"不是端口,而是**别的门里的正则字符类/量词**:
    // 实测假阳 `/localhost:880[23]|127\.0\.0\.1:880[23]/` —— `\b` 把 `880` 收进捕获组,
    // 真实意图是 8802/8803,于是本门把他人判据的模式串报成"非 88xx 端口 880"。
    // 判据扫到判据自己的文本,是本仓反复出现过的一型(守门 108 的 alpha 夹具、79 的标记字面量)。
    const next = content[match.index + match[0].length]
    if (next === '[' || next === '{') {
      regexishSkipped += 1
      continue
    }
    refs.push({
      port: parseInt(match[1], 10),
      fullMatch: match[0],
      index: match.index,
    })
  }
  return refs
}

/**
 * 检查端口是否合规。`registered` 一律由调用方喂**派生集**(P0)——
 * 函数内不得再出现任何端口字面量集合,否则手抄清单会以"更近的默认值"形态重新长回来。
 */
export function checkPort(port, registered) {
  if (registered.has(port)) {
    return { compliant: true, reason: '已注册 88xx' }
  }
  if (EXEMPT_PORTS.has(port)) {
    return { compliant: true, reason: '豁免端口(容器内部/CI/第三方)' }
  }
  // 88xx 范围但未注册
  if (port >= 8800 && port <= 8899) {
    return { compliant: false, reason: `88xx 端口 ${port} 未在注册表中注册(见 docs/port-management.md §2)` }
  }
  // 非 88xx 端口
  return { compliant: false, reason: `非 88xx 端口 ${port}(dev/宿主端口必须以 88 开头,见 docs/port-management.md §3)` }
}

// ============================================================
// 主逻辑
// ============================================================

/** 结论行里如实报出取材面(与守门 36/124/93 同一条禁令:不得静默说用了哪个面)。 */
export const FACE_TXT = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }

/**
 * 纯函数(argv → 面):两面旗同给 = 自相矛盾,由调用方判死。
 * 默认档判 HEAD,与 36/124/93/98 一致(共享工作树常年滞后 HEAD,按磁盘判会在恒红/假绿之间跳)。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

/**
 * 取两份登记表输入(注册表 JSON + docs §2),一律经统一取材层,取不到 ⇒ {ok:false,reason}。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场,不依赖真仓瞬时状态。
 */
export function readRegistryInputs(root, face) {
  const rels = [REGISTRY_REL, DOC_REL]
  let texts
  try {
    if (face === 'worktree') {
      texts = rels.map((rel) => readWorktreeFile(root, rel))
    } else {
      const prefix = face === 'staged' ? ':' : 'HEAD:'
      const specs = rels.map((rel) => `${prefix}${rel}`)
      const got = catBatch(root, specs, { maxBuffer: 1 << 26 })
      texts = specs.map((s) => (got.has(s) ? got.get(s) : null))
    }
  } catch (e) {
    const known = e instanceof Undetermined
    return { ok: false, reason: `${FACE_TXT[face]} 取材失败${known ? '' : '(未预期异常)'}:${String(e && e.message ? e.message : e).split('\n')[0].slice(0, 200)}` }
  }
  const missing = rels.filter((_, i) => texts[i] === null || texts[i] === undefined)
  if (missing.length > 0) {
    return { ok: false, reason: `${FACE_TXT[face]} 取不到 ${missing.join(' / ')}(该面上没有这份登记表)` }
  }
  return { ok: true, registryText: texts[0], docText: texts[1] }
}

/**
 * 纯函数(P0+P1 的判读):输入两份文本 + 已取到的面,输出三态结论。
 * 三态绝不并桶:derivedFail(派生不出来)/ undetermined(输入取不到)/ judged(真判过)。
 * 注册表解析失败**不回落**任何旧手抄表 —— 那是把"没判"写成"判过了"。
 */
export function evaluateRegistryParity({ registryText, docText }) {
  const out = { status: 'judged', parityRed: false, lines: [] }
  let reg
  try {
    reg = JSON.parse(String(registryText))
  } catch (e) {
    out.status = 'derivedFail'
    out.lines.push(`❌ P0 无法判定:注册表 ${REGISTRY_REL} JSON 解析失败(${String(e.message).slice(0, 120)})`)
    return out
  }
  const derived = deriveRegisteredPorts(reg)
  if (derived.problems.length > 0) {
    out.status = 'derivedFail'
    for (const p of derived.problems) out.lines.push(`❌ P0 无法判定:${p}`)
    return out
  }
  out.registered = derived.ports
  out.lines.push(
    `   🧮 P0 派生认领清单:${REGISTRY_REL}.registered_ports → ${derived.ports.size} 个端口(${derived.entries} 条认领项),代码侧零手抄`
  )
  const doc = parseDocPortTable(docText)
  if (doc.rows === 0 || doc.ports.size === 0) {
    out.status = 'undetermined'
    out.lines.push(
      `⚠️ P1 未判定:${DOC_REL} §2 表格里枚举到 ${doc.rows} 行端口(0 行 ⇒ 判据看不见文档侧,不得记为"一致")`
    )
    return out
  }
  const { onlyDoc, onlyDerived } = comparePortSets(doc.ports, derived.ports)
  out.onlyDoc = onlyDoc
  out.onlyDerived = onlyDerived
  out.docCount = doc.ports.size
  out.derivedCount = derived.ports.size
  if (onlyDoc.length === 0 && onlyDerived.length === 0) {
    out.lines.push(
      `   ✅ P1 双向对账:${DOC_REL} §2 ${doc.ports.size} 槽 ≡ 派生集 ${derived.ports.size} 槽(文档多报 0 / 注册表多认领 0)`
    )
    return out
  }
  out.parityRed = true
  out.lines.push(`   ⚠️ P1 双向对账不一致(文档侧 ${doc.ports.size} 槽 / 派生集 ${derived.ports.size} 槽):`)
  if (onlyDoc.length > 0) {
    out.lines.push(
      `      文档多报(§2 写了而 ${REGISTRY_REL} 没认领):${onlyDoc.join(', ')} —— 出路:在 registered_ports 认领它,或把 §2 那一行改成不占口的叙述`
    )
  }
  if (onlyDerived.length > 0) {
    out.lines.push(
      `      注册表多认领(派生集有而 §2 没写):${onlyDerived.join(', ')} —— 出路:按 §3.1 在 §2 补一行(端口 + 服务名 + 配置文件),不得只改代码`
    )
  }
  return out
}

function main() {
  const argv = process.argv.slice(2)
  const scanAll = argv.includes('--all')
  const parityOnly = argv.includes('--parity')
  const root = process.cwd()

  // ── 取材面(只作用于 P0/P1 的两份输入;corpus 扫描的口径一字未动)──
  const sel = faceFromArgv(argv)
  if (sel.error) {
    console.error(`❌ ${sel.error} ⇒ 无法判定(不记红也不记绿)`)
    return 2
  }
  const face = sel.face
  const inputs = readRegistryInputs(root, face)
  const parity = inputs.ok
    ? evaluateRegistryParity({ registryText: inputs.registryText, docText: inputs.docText })
    : { status: 'undetermined', parityRed: false, lines: [`⚠️ P0/P1 未判定:${inputs.reason}`] }

  if (parityOnly) {
    console.log(`🧭 端口登记表对账(取材面:${FACE_TXT[face]}):P0 派生 + P1 docs §2 双向`)
    for (const l of parity.lines) console.log(l)
    if (parity.status === 'derivedFail') {
      console.log('   ⇒ 无法判定:派生不出来即拒绝出具"端口合规"结论(不回落任何手抄表)')
      return 2
    }
    if (parity.parityRed) return 1
    if (parity.status === 'undetermined') {
      console.log('   ⇒ 未判定(不作为通过证据):文档侧没枚举到任何登记行')
      return 2
    }
    console.log('   ✅ P0/P1 均通过')
    return 0
  }

  let files
  if (scanAll) {
    // 全项目扫描(仅 git tracked 文件)
    // 2026-09-23 挂死根治:Windows 下并发会话持有 index 句柄时,无超时的 execSync('git ls-files')
    // 会**无限阻塞**在子进程管道读上(实测一次纯文档提交的 pre-commit 卡 80 分钟:
    // Get-Process 读数 CPU 2.84s / 墙钟 80min / Responding=True,即完全没在读文件)。
    // 超时后回退 staged 口径而不是静默 exit 0 —— 静默通过会让全量审计假绿。
    try {
      const output = execSync('git ls-files', {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 60_000,
        maxBuffer: 64 * 1024 * 1024,
      })
      files = output.trim().split('\n').filter(Boolean)
    } catch {
      files = getStagedFiles()
      console.log(`⚠️  git ls-files 超时/失败,已回退 staged 口径(${files.length} 文件)——不静默通过`)
    }
  } else {
    files = getStagedFiles()
  }

  // 扫描的判据**就是**这份派生集:派不出来 / 输入取不到 ⇒ 都没有清单可用,此时
  // "扫描 N 个文件无违规"是一句做不到的承诺(把没判写成判过了 = 本仓最高频失效型)。
  // 未判定一律 exit 2,不回落任何手抄表,也不静默 exit 0。
  // 刻意放在文件枚举**之后**:那一步自己的失败提示("git ls-files 超时/失败 → 回退 staged")
  // 是 2026-09-23 那条契约的一部分,不能被新的前置判定抢先吞掉(镜像测试第 14 例钉住两者都在)。
  if (!parity.registered) {
    for (const l of parity.lines) console.error(l)
    console.error(
      `   ⇒ 无法判定:${parity.status === 'derivedFail' ? 'P0 派生不出来' : 'P0/P1 的输入在该面上取不到'} —— 没有认领清单时端口合规性无从判(exit 2)`
    )
    return 2
  }
  const registered = parity.registered
  if (parity.status === 'undetermined') {
    // 文档侧一行都没枚举到:扫描照判(派生集在位),但 P1 不得被读成"已对账"。
    parity.lines.push('   ⚠️ P1 本轮未对账成功,不构成"登记表已核对"的合格证(结论行已点名)')
  }

  const warnings = []
  let scannedCount = 0

  for (const file of files) {
    if (isExemptPath(file)) continue

    const fullPath = `${process.cwd()}/${file}`
    if (!existsSync(fullPath)) continue

    // 2026-09-23:超大文件(打包产物 / sourcemap / lock 二进制)一律跳过 —— 端口引用不可能出现在
    // 这类文件里,而整读它们是本类守门最常见的二次拖死源。
    let st
    try {
      st = statSync(fullPath)
    } catch {
      continue
    }
    if (!st.isFile() || st.size > MAX_SCAN_BYTES) continue

    let content
    try {
      content = readFileSync(fullPath, 'utf-8')
    } catch {
      continue
    }

    scannedCount++
    const refs = extractPortRefs(content)

    for (const ref of refs) {
      const result = checkPort(ref.port, registered)
      if (!result.compliant) {
        // 找到行号
        const lines = content.substring(0, ref.index).split('\n')
        const lineNum = lines.length
        warnings.push({
          file,
          line: lineNum,
          port: ref.port,
          fullMatch: ref.fullMatch,
          reason: result.reason,
        })
      }
    }
  }

  // 输出结果
  const skippedNote =
    regexishSkipped > 0
      ? `\n   另:形如 "localhost:880[23]" 的正则字符类引用 ${regexishSkipped} 处已跳过` +
        '(那不是端口;报数而不静默,免得判据哪天真的看不见端口)'
      : ''

  if (warnings.length === 0) {
    if (scannedCount > 0) {
      console.log(`✅ 端口注册表守门:扫描 ${scannedCount} 个文件,无违规端口${skippedNote}`)
    }
    for (const l of parity.lines) console.log(l)
    if (parity.parityRed) return 1
    if (parity.status === 'undetermined') {
      // 文档侧看不见登记表时不得声称"一切正常",但也不得把与之无关的提交判红(warn-only 门):
      // 未判定只在结论行喊出来,退出码仍随扫描(0)。
      console.log('   ⚠️ 上列 P0/P1 为「未判定」,不构成"登记表已对账"的合格证。')
    }
    return 0
  }

  console.log('⚠️  端口注册表守门提醒(warn-only,不阻塞 commit)')
  console.log(`   扫描 ${scannedCount} 个文件,发现 ${warnings.length} 处端口引用需确认:${skippedNote}`)
  console.log()

  for (const w of warnings) {
    console.log(`   ${w.file}:${w.line}  ${w.fullMatch}  → ${w.reason}`)
  }

  console.log()
  for (const l of parity.lines) console.log(l)
  console.log()
  console.log('   📋 规则参考:docs/port-management.md')
  console.log(
    `   📋 已注册端口:派生自 ${REGISTRY_REL}.registered_ports(${registered.size} 槽;段位语义见 §3.3,认领清单见 §2)`
  )
  console.log('   💡 如确需使用非 88xx 端口(如 CI/容器内部),请确认属于豁免场景')
  console.log()

  // 2026-08-19 立:warn-only 违规显式 exit 1,让 guardian-runner 计入 warned 计数
  // (原本 exit 0 会让违规被 guardian-runner 静默吞掉,统计不可信;
  //  warn-only 不阻塞 commit,exit 1 仅供统计)
  return 1
}

// §22d isDirectRun 守卫:本文件同时是 CLI(钩子/手动跑)与判据源(镜像测试 import 纯函数),
// 顶层裸调 main() 会让测试一 import 就派生 git、按 cwd 判面,把测试环境炸成"结论与夹具无关"。
const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ 端口注册表守门自身异常(不静默当通过):${e && e.message ? e.message : e}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  expandRegisteredEntry,
  deriveRegisteredPorts,
  expandDocCell,
  parseDocPortTable,
  comparePortSets,
  evaluateRegistryParity,
  readRegistryInputs,
  faceFromArgv,
  checkPort,
  REGISTRY_REL,
  DOC_REL,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
