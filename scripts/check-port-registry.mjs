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
 * 集成位置:pre-commit 第 24 项(warn-only,不阻塞 commit)
 *
 * 用法:
 *   node scripts/check-port-registry.mjs           # 扫描 staged 文件
 *   node scripts/check-port-registry.mjs --all      # 扫描全项目
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, statSync } from 'node:fs'

// 2026-09-23 加固:单文件字节上限 + git 调用超时。成因见 main() 内注释。
const MAX_SCAN_BYTES = 2 * 1024 * 1024

// ============================================================
// 端口注册表(与 docs/port-management.md §2 同步)
// ============================================================
const REGISTERED_PORTS = new Set([
  // 应用服务 8801-8809
  8801, 8802, 8803, 8804, 8805, 8806, 8807, 8808, 8809,
  // 基础设施 8810-8819
  8810, 8811, 8812, 8813, 8814, 8815, 8816, 8817, 8818, 8819,
  // 辅助工具 8820-8829
  8820, 8821, 8822, 8823, 8824, 8825, 8826, 8827, 8828, 8829,
  // SaaS 部署 8830-8839
  8830, 8831, 8832, 8833, 8834, 8835, 8836, 8837, 8838, 8839,
  // 蓝绿部署 8840-8849
  8841, 8842, 8843, 8844, 8845, 8846, 8847, 8848, 8849,
])

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
  11434, // Ollama 本地 LLM 服务
  1234, // LM Studio 本地 LLM 服务
  8765, // MCP transport 服务
  18999, // MCP OAuth 测试端口
  8001, // ai-service 测试 mock 端口
  8082, // 生产 admin-api 旧端口(部署文档兼容)
  9093, // Alertmanager 端口
  6688, // ai-feed-sources 第三方 feed 端口
  5173, // Vite 默认端口(第三方工具)
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

/** 检查端口是否合规 */
function checkPort(port) {
  if (REGISTERED_PORTS.has(port)) {
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

function main() {
  const scanAll = process.argv.includes('--all')
  let files

  if (scanAll) {
    // 全项目扫描(仅 git tracked 文件)
    // 2026-09-23 挂死根治:Windows 下并发会话持有 index 句柄时,无超时的 execSync('git ls-files')
    // 会**无限阻塞**在子进程管道读上(实测一次纯文档提交的 pre-commit 卡 80 分钟:
    // Get-Process 读数 CPU 2.84s / 墙钟 80min / Responding=True,即完全没在读文件)。
    // 超时后回退 staged 口径而不是静默 exit 0 —— 静默通过会让全量审计假绿。
    try {
      const output = execSync('git ls-files', {
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

  if (files.length === 0) {
    process.exit(0)
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
      const result = checkPort(ref.port)
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
    process.exit(0)
  }

  console.log('⚠️  端口注册表守门提醒(warn-only,不阻塞 commit)')
  console.log(`   扫描 ${scannedCount} 个文件,发现 ${warnings.length} 处端口引用需确认:${skippedNote}`)
  console.log()

  for (const w of warnings) {
    console.log(`   ${w.file}:${w.line}  ${w.fullMatch}  → ${w.reason}`)
  }

  console.log()
  console.log('   📋 规则参考:docs/port-management.md')
  console.log('   📋 已注册端口:8801-8809(应用) / 8810-8819(基础设施) / 8820-8829(辅助) / 8830-8839(SaaS)')
  console.log('   💡 如确需使用非 88xx 端口(如 CI/容器内部),请确认属于豁免场景')
  console.log()

  // 2026-08-19 立:warn-only 违规显式 exit 1,让 guardian-runner 计入 warned 计数
  // (原本 exit 0 会让违规被 guardian-runner 静默吞掉,统计不可信;
  //  warn-only 不阻塞 commit,exit 1 仅供统计)
  process.exit(1)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
