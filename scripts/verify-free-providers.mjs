#!/usr/bin/env node
/**
 * 零成本 provider 真实连通性测试 CLI(P1,2026-07-30 立,零成本引流路径 1 验证)
 *
 * 目的:直接调用 free_provider_registry 中 zero_cost=true 的 provider 上游端点,
 *      验证无需 API key 即可拿到真实回复(零成本引流核心保证)。
 *      与已有脚本的区别:
 *        - verify-relay-free-models.mjs:查 DB 上架状态(不调上游)
 *        - test-llm-connection.mjs:测本项目 ai-service 端点(不测上游 zero_cost provider)
 *        - scan-upstream-models.mjs:测 DB 已配置 provider 的 /v1/models(需 key)
 *        - 本脚本:直接测 zero_cost provider 的 chat/completions(无需 key)
 *
 * 测试策略(按 provider 协议差异):
 *   - pollinations / llm7 / opencode_zen:OpenAI 兼容,POST {base}/chat/completions
 *   - aihorde:众包协议,GET /api/v2/status 测 API 可达(真实生成需排队,不适合连通性测试)
 *
 * 期望清单对齐:apps/ai-service/app/services/free_provider_registry.py 的 _ZERO_COST_CODES
 *
 * 用法:
 *   node scripts/verify-free-providers.mjs                  # 测试所有 zero_cost provider
 *   node scripts/verify-free-providers.mjs --dry-run        # 预览期望清单(不调上游)
 *   node scripts/verify-free-providers.mjs --provider llm7  # 只测指定 provider
 *   node scripts/verify-free-providers.mjs --timeout 30000  # 自定义超时(默认 20s)
 *
 * 退出码:0=全部通过 / 1=有失败 / 2=脚本异常
 */
import { argv } from 'node:process'

const args = argv.slice(2)
const dryRun = args.includes('--dry-run')
const providerFilter = (() => {
  const i = args.indexOf('--provider')
  return i >= 0 ? args[i + 1] : null
})()
const timeoutMs = (() => {
  const i = args.indexOf('--timeout')
  return i >= 0 ? Number(args[i + 1]) : 20000
})()

// ============================================================================
// 零成本 provider 期望清单(对齐 free_provider_registry.py 的 _ZERO_COST_CODES)
// 每项含:provider_code / display_name / base_url / 测试模型 / 协议类型
// ============================================================================
const ZERO_COST_PROVIDERS = [
  {
    provider_code: 'pollinations',
    display_name: 'Pollinations(无 key 免费)',
    base_url: 'https://text.pollinations.ai/openai',
    model: 'openai-fast',
    protocol: 'openai_chat',
    notes: 'OmniRoute forever free;速率极低(1 req/6-15s)',
  },
  {
    provider_code: 'llm7',
    display_name: 'LLM7(免费镜像)',
    base_url: 'https://api.llm7.io/v1',
    model: 'gpt-4o',
    protocol: 'openai_chat',
    notes: '5M tokens/天,有下线风险',
  },
  {
    provider_code: 'opencode_zen',
    display_name: 'OpenCode Zen(免费编码模型)',
    base_url: 'https://opencode.ai/zen/v1',
    model: 'deepseek-v4-flash-free',
    protocol: 'openai_chat',
    notes: 'recurring-uncapped 轮换模型;无 key 可调(免费模型层,已验证返回 thinking 内容)',
  },
  {
    provider_code: 'aihorde',
    display_name: 'AI Horde(众包 GPU)',
    base_url: 'https://aihorde.net/api/v2',
    model: 'auto',
    protocol: 'aihorde_status', // 众包协议,只测 /status 可达(真实生成需排队)
    notes: '众包 GPU,匿名可用,模型随机',
  },
]

// ============================================================================
// 单个 provider 连通性测试
// ============================================================================
async function testOpenAICompatible(provider, timeoutMs) {
  const url = `${provider.base_url}/chat/completions`
  const body = {
    model: provider.model,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 20,
  }
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const latency = Date.now() - start
    const text = await resp.text().catch(() => '')
    if (!resp.ok) {
      return {
        ok: false,
        latency,
        status: resp.status,
        model: provider.model,
        error: `HTTP ${resp.status}: ${text.slice(0, 120)}`,
      }
    }
    // 解析 OpenAI 兼容响应
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return { ok: false, latency, status: resp.status, model: provider.model, error: `响应非 JSON: ${text.slice(0, 120)}` }
    }
    const msg = data?.choices?.[0]?.message ?? {}
    const content = msg.content ?? ''
    // thinking 模型(deepseek-r1/v4-flash 等)内容可能在 reasoning_content / reasoning 字段
    const reasoning = msg.reasoning_content ?? msg.reasoning ?? ''
    if (!content && !reasoning) {
      const preview = text.slice(0, 120)
      return { ok: false, latency, status: resp.status, model: provider.model, error: `响应缺 choices[0].message.content(可能需 API key 或模型不可用): ${preview}` }
    }
    const reply = content || reasoning
    return {
      ok: true,
      latency,
      status: resp.status,
      model: data?.model ?? provider.model,
      content: typeof reply === 'string' ? reply.slice(0, 60) : JSON.stringify(reply).slice(0, 60),
    }
  } catch (e) {
    const latency = Date.now() - start
    const errName = e?.name === 'AbortError' ? `超时(${timeoutMs}ms)` : (e?.message || String(e))
    return { ok: false, latency, status: 'CONN_ERR', model: provider.model, error: errName }
  } finally {
    clearTimeout(timer)
  }
}

async function testAIHordeStatus(provider, timeoutMs) {
  // aihorde 众包协议:GET /status/heartbeat 测 API 可达(不测真实生成,避免排队等待)
  const url = `${provider.base_url}/status/heartbeat`
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Client-Agent': 'IHUI:1.0:https://ihui.ai' },
      signal: controller.signal,
    })
    const latency = Date.now() - start
    const text = await resp.text().catch(() => '')
    if (!resp.ok) {
      return { ok: false, latency, status: resp.status, model: provider.model, error: `HTTP ${resp.status}: ${text.slice(0, 120)}` }
    }
    let data
    try {
      data = JSON.parse(text)
    } catch {
      // /status 非 JSON 也算可达(只要 HTTP 200)
      return { ok: true, latency, status: resp.status, model: provider.model, content: '(API 可达,响应非 JSON)' }
    }
    const workers = data?.worker_count ?? data?.queued_requests ?? '?'
    return {
      ok: true,
      latency,
      status: resp.status,
      model: provider.model,
      content: `API 可达(workers=${workers})`,
    }
  } catch (e) {
    const latency = Date.now() - start
    const errName = e?.name === 'AbortError' ? `超时(${timeoutMs}ms)` : (e?.message || String(e))
    return { ok: false, latency, status: 'CONN_ERR', model: provider.model, error: errName }
  } finally {
    clearTimeout(timer)
  }
}

async function testProvider(provider, timeoutMs) {
  if (provider.protocol === 'aihorde_status') {
    return testAIHordeStatus(provider, timeoutMs)
  }
  return testOpenAICompatible(provider, timeoutMs)
}

// ============================================================================
// 主流程
// ============================================================================
async function main() {
  const targets = providerFilter
    ? ZERO_COST_PROVIDERS.filter((p) => p.provider_code === providerFilter)
    : ZERO_COST_PROVIDERS

  if (targets.length === 0) {
    console.error(`❌ 未知 provider: ${providerFilter}`)
    console.error(`可用: ${ZERO_COST_PROVIDERS.map((p) => p.provider_code).join(', ')}`)
    process.exit(2)
  }

  console.log(`\n========== 零成本 provider 连通性测试 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  console.log(`目标:${targets.length} 个 zero_cost provider(对齐 free_provider_registry.py _ZERO_COST_CODES)`)
  console.log(`超时:${timeoutMs}ms\n`)

  // 1. 打印期望清单
  console.log('--- 期望清单(zero_cost=true 的 provider) ---')
  for (const p of targets) {
    console.log(`  ${p.provider_code.padEnd(16)} ${p.display_name}`)
    console.log(`                  base_url: ${p.base_url}`)
    console.log(`                  model:    ${p.model}`)
    console.log(`                  notes:    ${p.notes}`)
  }
  console.log('')

  if (dryRun) {
    console.log('[DRY-RUN] 不调上游,仅打印期望清单')
    console.log('========== 完成 ==========\n')
    return
  }

  // 2. 逐个测试
  console.log('--- 连通性测试结果 ---')
  const results = []
  for (const p of targets) {
    process.stdout.write(`  测试 ${p.provider_code}...`)
    const r = await testProvider(p, timeoutMs)
    results.push({ provider: p, result: r })
    const icon = r.ok ? '✅' : '❌'
    console.log(`\r  ${icon} ${p.provider_code.padEnd(16)} HTTP=${r.status} 延迟=${r.latency}ms 模型=${r.model}`)
    if (r.ok) {
      console.log(`                  回复: ${r.content}`)
    } else {
      console.log(`                  错误: ${r.error}`)
    }
  }

  // 3. 汇总表格
  console.log('\n--- 汇总表 ---')
  console.log('provider_code      | 状态  | HTTP  | 延迟(ms) | 模型                          | 备注')
  console.log('-------------------+-------+-------+----------+-------------------------------+----------------')
  for (const { provider, result } of results) {
    const pc = provider.provider_code.padEnd(17)
    const st = result.ok ? '✅ OK ' : '❌ FAIL'
    const http = String(result.status).padEnd(5)
    const lat = String(result.latency).padEnd(8)
    const model = (result.model || '').slice(0, 29).padEnd(29)
    const note = result.ok ? (result.content || '').slice(0, 40) : (result.error || '').slice(0, 40)
    console.log(`${pc} | ${st} | ${http} | ${lat} | ${model} | ${note}`)
  }

  // 4. 汇总报告
  const okCount = results.filter((r) => r.result.ok).length
  const failCount = results.length - okCount
  console.log('\n--- 汇总报告 ---')
  console.log(`总数:    ${results.length}`)
  console.log(`✅ 通过: ${okCount}`)
  console.log(`❌ 失败: ${failCount}`)

  if (failCount > 0) {
    console.log('\n--- 失败详情 ---')
    for (const { provider, result } of results.filter((r) => !r.result.ok)) {
      console.log(`  ${provider.provider_code}: ${result.error}`)
    }
    console.log('\n修复建议:')
    console.log('  1. 检查网络连接(部分 provider 可能需要代理)')
    console.log('  2. pollinations 速率极低,可加 --timeout 60000 重试')
    console.log('  3. aihorde 众包节点可能临时不可达,稍后重试')
    console.log('  4. 确认 free_provider_registry.py 的 _ZERO_COST_CODES 与本脚本清单一致')
  } else {
    console.log('\n🎉 所有零成本 provider 连通性正常,免费用户零成本可调用')
  }
  console.log(`\n========== 验证结果:${failCount === 0 ? '✅ 全通过(退出码 0)' : '❌ 有失败(退出码 1)'} ==========\n`)

  process.exit(failCount === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e?.message || e)
  process.exit(2)
})
