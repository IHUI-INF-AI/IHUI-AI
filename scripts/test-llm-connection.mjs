// scripts/test-llm-connection.mjs
// 验证 AI service LLM 接入是否可用
const AI_URL = process.env.AI_URL ?? 'http://localhost:8000'

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options)
  return { status: r.status, body: await r.json().catch(() => null) }
}

const results = []

// 1. 健康检查
try {
  const r = await fetchJson(`${AI_URL}/health`)
  results.push({ name: '健康检查', ...r, pass: r.status === 200 })
} catch (e) {
  results.push({ name: '健康检查', status: 'CONN_ERR', pass: false, err: e.message })
}

// 2. 模型列表
try {
  const r = await fetchJson(`${AI_URL}/api/llm/models`)
  const models = r.body?.models ?? r.body?.data
  const modelCount = Array.isArray(models) ? models.length : 0
  const stubMode = r.body?.stub_mode === true
  results.push({
    name: '模型列表',
    status: r.status,
    pass: r.status === 200 && modelCount > 0,
    info: `${modelCount} 个模型${stubMode ? ' (stub mode)' : ''}`,
  })
} catch (e) {
  results.push({ name: '模型列表', status: 'CONN_ERR', pass: false, err: e.message })
}

// 3. 简单对话
const chatModel = process.env.LITELLM_MODEL ?? 'stepfun/step-3.5-flash'
try {
  const start = Date.now()
  const r = await fetchJson(`${AI_URL}/api/llm/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: chatModel,
      messages: [{ role: 'user', content: '用一句话介绍你自己' }],
      max_tokens: 100,
    }),
  })
  const latency = Date.now() - start
  const isStub = r.body?.error === true || r.body?.content?.includes('stub') || r.body?.data?.content?.includes('stub')
  const content = r.body?.content ?? r.body?.data?.content ?? ''
  results.push({
    name: `对话测试 (${chatModel})`,
    status: r.status,
    latency: `${latency}ms`,
    pass: r.status === 200 && !isStub,
    info: isStub ? '⚠️ Stub 模式(无 LLM key)' : content.slice(0, 50) ?? 'OK',
  })
} catch (e) {
  results.push({ name: '对话测试', status: 'CONN_ERR', pass: false, err: e.message })
}

// 打印结果
console.log('\n========== LLM 连通性测试 ==========')
for (const r of results) {
  const icon = r.pass ? '✅' : '❌'
  console.log(`${icon} ${r.name}: HTTP=${r.status} ${r.info ?? r.err ?? ''}`)
}
const passCount = results.filter((r) => r.pass).length
console.log(`\n通过: ${passCount}/${results.length}`)
console.log(passCount === results.length ? '\n🎉 全部通过,LLM 已就绪' : '\n⚠️  部分失败,详见 scripts/setup-llm.md')
process.exit(passCount === results.length ? 0 : 1)
