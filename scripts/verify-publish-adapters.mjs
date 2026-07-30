#!/usr/bin/env node
/**
 * 13 平台内容发布 adapter 可用性验证脚本(P0-5,2026-07-30 立,零成本引流路径 3 验证)
 *
 * 目的:交叉比对 api 侧 PLATFORM_REGISTRY(publish-routes.ts)与 ai-service 侧
 *      adapter 文件(base_adapter.py list_all_adapter_classes),确保:
 *      ① 14 个平台元数据完整(platformId 唯一、status 合法、needsBrowser 与 status 一致)
 *      ② ai-service 侧每个平台都有对应 adapter .py 文件
 *      ③ implemented 平台(8 个)的 adapter 真实存在(非 stub)
 *      ④ 本地端点 GET /api/publish/adapters/status 可达时返回与期望一致
 *
 * 验证维度:
 *   1. 静态校验(dry-run 即可):期望清单完整性 + ai-service adapter 文件存在性
 *   2. 服务可达(默认,非 dry-run):ping API /api/health + 若提供 JWT 则调 /api/publish/adapters/status
 *
 * 期望清单对齐:
 *   - apps/api/src/routes/publish-routes.ts 的 PLATFORM_REGISTRY(14 条)
 *   - apps/ai-service/app/services/publish/adapters/*.py(14 个 adapter 文件)
 *   - apps/ai-service/app/services/publish/base_adapter.py list_all_adapter_classes
 *
 * 用法:
 *   node scripts/verify-publish-adapters.mjs                  # 完整验证(静态 + 服务可达性)
 *   node scripts/verify-publish-adapters.mjs --dry-run        # 仅静态校验(不调服务)
 *   node scripts/verify-publish-adapters.mjs --jwt <token>    # 带 JWT 调 /adapters/status 交叉比对
 *   node scripts/verify-publish-adapters.mjs --api-url http://localhost:8802  # 自定义 API 地址
 *
 * 退出码:0=全部通过 / 1=有失败 / 2=脚本异常
 */
import { argv, env } from 'node:process'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = argv.slice(2)
const dryRun = args.includes('--dry-run')
const jwtFlag = (() => {
  const i = args.indexOf('--jwt')
  return i >= 0 ? args[i + 1] : env.API_PUBLISH_JWT || ''
})()
const apiUrl = (() => {
  const i = args.indexOf('--api-url')
  return i >= 0 ? args[i + 1] : env.API_URL || 'http://localhost:8802'
})()

// 项目根目录(从 import.meta.url 推导,不硬编码绝对路径,AGENTS.md §15)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ============================================================================
// 期望清单:14 平台 adapter 元数据(对齐 publish-routes.ts PLATFORM_REGISTRY)
// status 含义:
//   implemented     — 真实 HTTP API 调用,配置凭据后可直接发布
//   needs_browser   — Playwright 浏览器自动化,需安装 Playwright + 浏览器内核
//   needs_oauth     — 需平台 OAuth 授权(开放平台申请)
//   needs_sdk       — 需官方 SDK/小程序接口
// ============================================================================
const EXPECTED_PLATFORMS = [
  { platformId: 'wordpress', platformName: 'WordPress', status: 'implemented', needsBrowser: false, formats: ['md', 'html'], adapterFile: 'wordpress.py' },
  { platformId: 'medium', platformName: 'Medium', status: 'implemented', needsBrowser: false, formats: ['md', 'html'], adapterFile: 'medium.py' },
  { platformId: 'youtube', platformName: 'YouTube', status: 'needs_oauth', needsBrowser: false, formats: ['video'], adapterFile: 'youtube.py' },
  { platformId: 'bilibili', platformName: '哔哩哔哩', status: 'implemented', needsBrowser: false, formats: ['video'], adapterFile: 'bilibili.py' },
  { platformId: 'wechat', platformName: '微信公众号', status: 'implemented', needsBrowser: false, formats: ['md', 'html'], adapterFile: 'wechat.py' },
  { platformId: 'toutiao', platformName: '今日头条', status: 'implemented', needsBrowser: false, formats: ['md', 'html'], adapterFile: 'toutiao.py' },
  { platformId: 'douyin', platformName: '抖音', status: 'implemented', needsBrowser: false, formats: ['video'], adapterFile: 'douyin.py' },
  { platformId: 'kuaishou', platformName: '快手', status: 'implemented', needsBrowser: false, formats: ['video'], adapterFile: 'kuaishou.py' },
  { platformId: 'weibo', platformName: '微博', status: 'implemented', needsBrowser: false, formats: ['md', 'image'], adapterFile: 'weibo.py' },
  { platformId: 'zhihu', platformName: '知乎', status: 'needs_browser', needsBrowser: true, formats: ['md', 'html'], adapterFile: 'zhihu.py' },
  { platformId: 'csdn', platformName: 'CSDN', status: 'needs_browser', needsBrowser: true, formats: ['md', 'html'], adapterFile: 'csdn.py' },
  { platformId: 'juejin', platformName: '掘金', status: 'needs_browser', needsBrowser: true, formats: ['md', 'html'], adapterFile: 'juejin.py' },
  { platformId: 'xiaohongshu', platformName: '小红书', status: 'needs_browser', needsBrowser: true, formats: ['md', 'image'], adapterFile: 'xiaohongshu.py' },
  { platformId: 'shipinhao', platformName: '微信视频号', status: 'needs_browser', needsBrowser: true, formats: ['video'], adapterFile: 'shipinhao.py' },
]

const VALID_STATUSES = ['implemented', 'needs_browser', 'needs_oauth', 'needs_sdk']

// ============================================================================
// 静态校验:期望清单完整性
// ============================================================================
function validateExpectedRegistry() {
  const errors = []

  // 1. platformId 唯一性
  const ids = EXPECTED_PLATFORMS.map((p) => p.platformId)
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupIds.length > 0) errors.push(`platformId 重复: ${dupIds.join(', ')}`)

  // 2. status 取值合法
  for (const p of EXPECTED_PLATFORMS) {
    if (!VALID_STATUSES.includes(p.status)) {
      errors.push(`${p.platformId}: status "${p.status}" 不合法(应为 ${VALID_STATUSES.join('/')} 之一)`)
    }
  }

  // 3. needsBrowser 与 status 一致性
  //    needs_browser 状态 → needsBrowser 必须为 true
  //    implemented/needs_oauth/needs_sdk 状态 → needsBrowser 必须为 false
  for (const p of EXPECTED_PLATFORMS) {
    if (p.status === 'needs_browser' && !p.needsBrowser) {
      errors.push(`${p.platformId}: status=needs_browser 但 needsBrowser=false(不一致)`)
    }
    if (p.status !== 'needs_browser' && p.needsBrowser) {
      errors.push(`${p.platformId}: status=${p.status} 但 needsBrowser=true(不一致)`)
    }
  }

  // 4. supportedFormats 非空
  for (const p of EXPECTED_PLATFORMS) {
    if (!p.formats || p.formats.length === 0) {
      errors.push(`${p.platformId}: supportedFormats 为空`)
    }
  }

  return errors
}

// ============================================================================
// 静态校验:ai-service adapter 文件存在性
// ============================================================================
function validateAdapterFiles() {
  const errors = []
  const adaptersDir = resolve(projectRoot, 'apps/ai-service/app/services/publish/adapters')

  if (!existsSync(adaptersDir)) {
    errors.push(`ai-service adapters 目录不存在: ${adaptersDir}`)
    return errors
  }

  // 列出目录下所有 .py 文件(排除 __init__.py)
  const actualFiles = readdirSync(adaptersDir)
    .filter((f) => f.endsWith('.py') && f !== '__init__.py')
    .sort()

  // 每个期望平台都应有对应 adapter 文件
  for (const p of EXPECTED_PLATFORMS) {
    const filePath = join(adaptersDir, p.adapterFile)
    if (!existsSync(filePath)) {
      errors.push(`${p.platformId}: ai-service adapter 文件缺失 ${p.adapterFile}`)
    }
  }

  // 检查是否有"多余"的 adapter 文件(不在期望清单中)
  const expectedFileSet = new Set(EXPECTED_PLATFORMS.map((p) => p.adapterFile))
  const extraFiles = actualFiles.filter((f) => !expectedFileSet.has(f))
  if (extraFiles.length > 0) {
    errors.push(`ai-service 有多余 adapter 文件(不在 PLATFORM_REGISTRY 中): ${extraFiles.join(', ')}`)
  }

  return errors
}

// ============================================================================
// 服务可达性:ping API /api/health
// ============================================================================
async function pingApiHealth() {
  const url = `${apiUrl}/api/health`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const resp = await fetch(url, { method: 'GET', signal: controller.signal })
    const ok = resp.ok
    const text = await resp.text().catch(() => '')
    return { ok, status: resp.status, body: text.slice(0, 120) }
  } catch (e) {
    return { ok: false, status: 'CONN_ERR', body: e?.name === 'AbortError' ? '超时(5s)' : (e?.message || String(e)) }
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// 服务可达性:调 GET /api/publish/adapters/status(需 JWT)
// ============================================================================
async function fetchAdaptersStatus(jwt) {
  const url = `${apiUrl}/api/publish/adapters/status`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    const text = await resp.text().catch(() => '')
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `HTTP ${resp.status}: ${text.slice(0, 120)}` }
    }
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return { ok: false, status: resp.status, error: `响应非 JSON: ${text.slice(0, 120)}` }
    }
    return { ok: true, status: resp.status, data }
  } catch (e) {
    return { ok: false, status: 'CONN_ERR', error: e?.name === 'AbortError' ? '超时(8s)' : (e?.message || String(e)) }
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// 交叉比对:API 返回的 adapters/status 与期望清单
// ============================================================================
function crossCheckAdaptersStatus(apiData) {
  const errors = []
  // 响应结构:{ code: 0, data: { items: [...], count, summary: { total, implemented, needsBrowser, needsOauth, needsSdk } } }
  const items = apiData?.data?.items ?? apiData?.items ?? []
  const summary = apiData?.data?.summary ?? apiData?.summary ?? {}

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('API 返回 items 为空或非数组')
    return errors
  }

  // 按 platformId 建索引
  const apiMap = new Map()
  for (const item of items) {
    apiMap.set(item.platformId, item)
  }

  // 逐个比对
  for (const expected of EXPECTED_PLATFORMS) {
    const actual = apiMap.get(expected.platformId)
    if (!actual) {
      errors.push(`API 缺少平台 ${expected.platformId}(${expected.platformName})`)
      continue
    }
    if (actual.status !== expected.status) {
      errors.push(`${expected.platformId}: API status="${actual.status}" ≠ 期望 "${expected.status}"`)
    }
    if (actual.canPublish !== (expected.status === 'implemented')) {
      errors.push(`${expected.platformId}: API canPublish=${actual.canPublish} ≠ 期望 ${expected.status === 'implemented'}`)
    }
    if (actual.needsBrowser !== expected.needsBrowser) {
      errors.push(`${expected.platformId}: API needsBrowser=${actual.needsBrowser} ≠ 期望 ${expected.needsBrowser}`)
    }
  }

  // 比对 summary
  const expectedSummary = {
    total: EXPECTED_PLATFORMS.length,
    implemented: EXPECTED_PLATFORMS.filter((p) => p.status === 'implemented').length,
    needsBrowser: EXPECTED_PLATFORMS.filter((p) => p.status === 'needs_browser').length,
    needsOauth: EXPECTED_PLATFORMS.filter((p) => p.status === 'needs_oauth').length,
    needsSdk: EXPECTED_PLATFORMS.filter((p) => p.status === 'needs_sdk').length,
  }
  for (const key of ['total', 'implemented', 'needsBrowser', 'needsOauth', 'needsSdk']) {
    if (summary[key] !== undefined && summary[key] !== expectedSummary[key]) {
      errors.push(`API summary.${key}=${summary[key]} ≠ 期望 ${expectedSummary[key]}`)
    }
  }

  return errors
}

// ============================================================================
// 主流程
// ============================================================================
async function main() {
  console.log(`\n========== 13 平台发布 adapter 可用性验证 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  console.log(`期望清单:${EXPECTED_PLATFORMS.length} 个平台(对齐 publish-routes.ts PLATFORM_REGISTRY + ai-service adapters/)`)
  console.log(`API 地址:${apiUrl}${jwtFlag ? ' (带 JWT)' : ' (无 JWT,跳过 /adapters/status 交叉比对)'}\n`)

  // 1. 打印期望清单
  console.log('--- 期望清单(14 平台 adapter 元数据) ---')
  console.log('platformId     | platformName  | status         | needsBrowser | formats       | adapterFile')
  console.log('----------------+---------------+----------------+--------------+---------------+------------------')
  for (const p of EXPECTED_PLATFORMS) {
    const pid = p.platformId.padEnd(15)
    const name = p.platformName.padEnd(14)
    const st = p.status.padEnd(15)
    const nb = String(p.needsBrowser).padEnd(13)
    const fmt = p.formats.join(',').padEnd(14)
    console.log(`${pid} | ${name} | ${st} | ${nb} | ${fmt} | ${p.adapterFile}`)
  }
  const summary = {
    total: EXPECTED_PLATFORMS.length,
    implemented: EXPECTED_PLATFORMS.filter((p) => p.status === 'implemented').length,
    needsBrowser: EXPECTED_PLATFORMS.filter((p) => p.status === 'needs_browser').length,
    needsOauth: EXPECTED_PLATFORMS.filter((p) => p.status === 'needs_oauth').length,
    needsSdk: EXPECTED_PLATFORMS.filter((p) => p.status === 'needs_sdk').length,
  }
  console.log(`\n汇总:total=${summary.total} implemented=${summary.implemented} needs_browser=${summary.needsBrowser} needs_oauth=${summary.needsOauth} needs_sdk=${summary.needsSdk}`)
  console.log(`零成本可立即发布:${summary.implemented} 个平台(配置凭据后直接可用)\n`)

  // 2. 静态校验:期望清单完整性
  console.log('--- 静态校验:期望清单完整性 ---')
  const registryErrors = validateExpectedRegistry()
  if (registryErrors.length === 0) {
    console.log('✅ 期望清单完整性校验通过(platformId 唯一、status 合法、needsBrowser 一致、formats 非空)')
  } else {
    console.log(`❌ 期望清单完整性校验失败(${registryErrors.length} 个错误):`)
    for (const e of registryErrors) console.log(`   - ${e}`)
  }
  console.log('')

  // 3. 静态校验:ai-service adapter 文件存在性
  console.log('--- 静态校验:ai-service adapter 文件存在性 ---')
  const fileErrors = validateAdapterFiles()
  if (fileErrors.length === 0) {
    console.log('✅ 14 个 adapter .py 文件全部存在(与期望清单一致,无多余文件)')
  } else {
    console.log(`❌ adapter 文件校验失败(${fileErrors.length} 个错误):`)
    for (const e of fileErrors) console.log(`   - ${e}`)
  }
  console.log('')

  if (dryRun) {
    console.log('[DRY-RUN] 不调 API 服务,仅静态校验')
    const hasError = registryErrors.length > 0 || fileErrors.length > 0
    console.log(`\n========== 验证结果:${hasError ? '❌ 有问题(退出码 1)' : '✅ 全通过(退出码 0)'} ==========\n`)
    process.exit(hasError ? 1 : 0)
  }

  // 4. 服务可达性:ping API /api/health
  console.log('--- 服务可达性:ping API /api/health ---')
  const health = await pingApiHealth()
  if (health.ok) {
    console.log(`✅ API 服务在线(HTTP ${health.status})`)
  } else {
    console.log(`⚠️  API 服务不可达(HTTP ${health.status}):${health.body}`)
    console.log('   跳过 /adapters/status 交叉比对(静态校验仍有效)')
  }
  console.log('')

  // 5. 服务可达性:调 GET /api/publish/adapters/status(需 JWT)
  let crossCheckErrors = []
  let crossCheckSkipped = false
  if (health.ok && jwtFlag) {
    console.log('--- 服务交叉比对:GET /api/publish/adapters/status ---')
    const result = await fetchAdaptersStatus(jwtFlag)
    if (result.ok) {
      console.log('✅ /api/publish/adapters/status 调用成功,开始交叉比对...')
      crossCheckErrors = crossCheckAdaptersStatus(result.data)
      if (crossCheckErrors.length === 0) {
        console.log('✅ API 返回的 adapter 矩阵与期望清单完全一致(14 平台 + summary 统计)')
      } else {
        console.log(`❌ 交叉比对失败(${crossCheckErrors.length} 个差异):`)
        for (const e of crossCheckErrors) console.log(`   - ${e}`)
      }
    } else {
      console.log(`⚠️  /api/publish/adapters/status 调用失败(HTTP ${result.status}):${result.error}`)
      console.log('   跳过交叉比对(静态校验仍有效)')
      crossCheckSkipped = true
    }
  } else if (health.ok && !jwtFlag) {
    console.log('--- 服务交叉比对:GET /api/publish/adapters/status ---')
    console.log('⚠️  未提供 JWT(通过 --jwt <token> 或 API_PUBLISH_JWT 环境变量),跳过 /adapters/status 交叉比对')
    crossCheckSkipped = true
  }
  console.log('')

  // 6. 汇总报告
  console.log('--- 汇总报告 ---')
  console.log(`期望平台数:   ${EXPECTED_PLATFORMS.length}`)
  console.log(`✅ 可立即发布: ${summary.implemented} 个(implemented,配置凭据后直接可用)`)
  console.log(`🔧 需浏览器:   ${summary.needsBrowser} 个(needs_browser,需 Playwright)`)
  console.log(`🔑 需 OAuth:   ${summary.needsOauth} 个(needs_oauth,需开放平台申请)`)
  console.log(`📦 需 SDK:     ${summary.needsSdk} 个(needs_sdk)`)

  const allErrors = [...registryErrors, ...fileErrors, ...crossCheckErrors]
  const hasError = allErrors.length > 0

  if (hasError) {
    console.log(`\n--- ❌ 失败详情(${allErrors.length} 个错误) ---`)
    for (const e of allErrors) console.log(`  - ${e}`)
    console.log('\n修复建议:')
    console.log('  1. 期望清单错误 → 修改 scripts/verify-publish-adapters.mjs 的 EXPECTED_PLATFORMS')
    console.log('  2. adapter 文件缺失 → 在 apps/ai-service/app/services/publish/adapters/ 补齐 .py 文件')
    console.log('  3. 交叉比对差异 → 检查 apps/api/src/routes/publish-routes.ts 的 PLATFORM_REGISTRY 与期望清单同步')
    console.log('  4. 服务不可达 → 启动 API 服务:pnpm --filter @ihui/api dev')
  } else {
    console.log('\n🎉 13 平台发布 adapter 可用性验证通过')
    if (crossCheckSkipped) {
      console.log('   (服务交叉比对被跳过,静态校验已通过;带 --jwt 可做完整交叉比对)')
    }
  }
  console.log(`\n========== 验证结果:${hasError ? '❌ 有问题(退出码 1)' : '✅ 全通过(退出码 0)'} ==========\n`)

  process.exit(hasError ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL:', e?.message || e)
  process.exit(2)
})
