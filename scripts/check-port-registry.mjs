#!/usr/bin/env node
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
import { readFileSync, existsSync } from 'node:fs'

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
  8080, 8081, 3000, 8000, 5432, 6379, 4317, 4318, 16686, 9090, 9100, 3100,
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
  /docs\/port-management\.md$/, // 本规则文件自身
  /scripts\/check-port-registry\.mjs$/, // 本守门脚本自身
  /\.github\/workflows\//, // CI workflows(豁免)
  /apps\/api\/tests\//, // API 测试默认值(豁免)
  /apps\/api\/scripts\//, // API 运维脚本(豁免)
  /\.trae-cn\/archive\//, // 归档文档(历史快照,不修改)
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

/** 从文件内容中提取 localhost:PORT 引用 */
function extractPortRefs(content) {
  const refs = []
  // 匹配 localhost:PORT 或 127.0.0.1:PORT
  const regex = /(?:localhost|127\.0\.0\.1):(\d{2,5})\b/g
  let match
  while ((match = regex.exec(content)) !== null) {
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
    try {
      const output = execSync('git ls-files', { encoding: 'utf-8' })
      files = output.trim().split('\n').filter(Boolean)
    } catch {
      console.log('⚠️  无法获取 git tracked 文件列表')
      process.exit(0)
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
  if (warnings.length === 0) {
    if (scannedCount > 0) {
      console.log(`✅ 端口注册表守门:扫描 ${scannedCount} 个文件,无违规端口`)
    }
    process.exit(0)
  }

  console.log('⚠️  端口注册表守门提醒(warn-only,不阻塞 commit)')
  console.log(`   扫描 ${scannedCount} 个文件,发现 ${warnings.length} 处端口引用需确认:`)
  console.log()

  for (const w of warnings) {
    console.log(`   ${w.file}:${w.line}  ${w.fullMatch}  → ${w.reason}`)
  }

  console.log()
  console.log('   📋 规则参考:docs/port-management.md')
  console.log('   📋 已注册端口:8801-8809(应用) / 8810-8819(基础设施) / 8820-8829(辅助) / 8830-8839(SaaS)')
  console.log('   💡 如确需使用非 88xx 端口(如 CI/容器内部),请确认属于豁免场景')
  console.log()

  // warn-only:不阻塞 commit
  process.exit(0)
}

main()
