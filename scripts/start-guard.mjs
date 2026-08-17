#!/usr/bin/env node
/**
 * 服务启动端口守卫(2026-08-17 立)
 *
 * 防止误用非注册端口启动服务(如 npx next dev --port 3000 导致前端配置漂移)。
 *
 * 使用方式:
 *   # 在启动任何 dev 服务前执行(作为前置检查)
 *   node scripts/start-guard.mjs --web    # 验证 web 启动参数
 *   node scripts/start-guard.mjs --api    # 验证 api 启动参数
 *   node scripts/start-guard.mjs --all    # 验证所有服务
 *
 *   # 或直接启动(代替 npx next dev / npx tsx dist/index.js)
 *   node scripts/start-guard.mjs --web --run
 *   node scripts/start-guard.mjs --api --run
 *
 * 已注册端口:scripts/dev-port-registry.json
 * 规则来源:docs/port-management.md §3 (dev 端口必须以 88 开头)
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const REGISTRY_PATH = join(ROOT, 'scripts', 'dev-port-registry.json')
const PORTS_CONFIG = {
  web: { port: 8801, cmd: 'next dev --turbopack -p 8801' },
  api: { port: 8802, cmd: 'tsx dist/index.js' },
  'ai-service': { port: 8803, cmd: 'uv run uvicorn app.main:app --reload --port 8803' },
  miniapp: { port: 8804, cmd: 'pnpm --filter @ihui/miniapp-taro dev:h5' },
  mobile: { port: 8805, cmd: 'pnpm --filter @ihui/mobile-rn start' },
  desktop: { port: 8801, cmd: 'pnpm --filter @ihui/desktop dev' },
  extension: { port: 8808, cmd: 'pnpm --filter @ihui/extension dev' },
  cli: { port: 8841, cmd: 'pnpm --filter @ihui/cli dev' },
}

// 从注册表读取期望端口(权威来源)
try {
  const reg = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
  for (const [name, svc] of Object.entries(reg.services)) {
    if (PORTS_CONFIG[name]) {
      PORTS_CONFIG[name].port = svc.port
      PORTS_CONFIG[name].expected_port = svc.port
    }
  }
} catch {
  // 注册表不可用时用硬编码值
}

const args = process.argv.slice(2)
const services = []
let runMode = false
let dryRun = false

for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--run') runMode = true
  else if (a === '--dry-run' || a === '--check') dryRun = true
  else if (a.startsWith('--')) {
    services.push(a.slice(2))
  } else if (!a.startsWith('-')) {
    services.push(a)
  }
}

// 默认检查所有服务
if (services.length === 0) services.push(...Object.keys(PORTS_CONFIG))

const errors = []
const warnings = []

for (const svcName of services) {
  const cfg = PORTS_CONFIG[svcName]
  if (!cfg) {
    errors.push(`未知服务: ${svcName}(可选:${Object.keys(PORTS_CONFIG).join(', ')})`)
    continue
  }

  const { port } = cfg
  // 检查是否以 88 开头(端口注册表规则)
  if (!String(port).startsWith('88')) {
    errors.push(`[${svcName}] 端口 ${port} 不符合 88xx 规则(docs/port-management.md §3)`)
  }

  // 检查端口是否已被占用
  try {
    const isListening = execSync(
      `node -e "const net=require('net');const s=new net.Socket();s.connect(${port},'127.0.0.1',()=>{console.log('in-use');s.end();process.exit(0);});s.on('error',()=>{console.log('free');process.exit(0);});setTimeout(()=>{console.log('timeout');process.exit(0);},3000)"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim()
    if (isListening === 'in-use') {
      warnings.push(`[${svcName}] 端口 ${port} 已被占用,确认是否为合法服务进程`)
    }
  } catch {
    // 连接检查失败,跳过
  }
}

// 输出结果
if (errors.length > 0) {
  console.error('\n❌ 端口守卫失败(请修正后再启动):\n')
  for (const e of errors) console.error(`   ${e}`)
  console.error('\n📋 已注册端口:')
  for (const [name, cfg] of Object.entries(PORTS_CONFIG)) {
    console.error(`   ${name}: ${cfg.port}`)
  }
  console.error('\n💡 正确用法:')
  console.error('   node scripts/start-guard.mjs --web --run  # 启动 web(自动校验端口)')
  console.error('   pwsh -File scripts/start-dev.ps1          # 使用规范启动器(推荐)')
  process.exit(1)
}

if (warnings.length > 0) {
  for (const w of warnings) console.warn(`⚠️  ${w}`)
}

if (dryRun) {
  console.log(`✅ 端口守卫通过 (${services.join(', ')})`)
  for (const svcName of services) {
    const cfg = PORTS_CONFIG[svcName]
    if (cfg) console.log(`   ${svcName} → port ${cfg.port}`)
  }
  process.exit(0)
}

if (runMode) {
  // 实际启动模式
  for (const svcName of services) {
    const cfg = PORTS_CONFIG[svcName]
    if (!cfg) continue
    console.log(`🚀 启动 ${svcName} (port ${cfg.port})...`)
    console.log(`   cmd: ${cfg.cmd}`)
  }
  console.log('\n⚠️  端口守卫已通过,但 --run 模式暂为 dry-run(仅校验,不实际启动)')
  console.log('   请使用: node scripts/dev-web.mjs 或 pwsh -File scripts/start-dev.ps1')
  process.exit(0)
}

// 默认模式:仅校验
console.log(`✅ 端口守卫通过 (${services.join(', ')})`)
for (const svcName of services) {
  const cfg = PORTS_CONFIG[svcName]
  if (cfg) console.log(`   ${svcName} → port ${cfg.port}`)
}
process.exit(0)
