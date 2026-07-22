/**
 * 测试 ai-service /llm/complete 端点连通性 + 真实 LLM 响应(非 stub)。
 * 用法:pnpm --filter @ihui/api exec tsx scripts/test-llm-complete.mts
 */
const baseUrl = process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8803'

async function main() {
  const start = Date.now()
  const res = await fetch(`${baseUrl}/api/llm/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            '请对以下资讯标题进行分类,仅返回以下类别之一:ai-models(AI 模型发布/升级)、ai-products(AI 产品/应用/工具上线)、industry(AI 行业动态/融资/收购/政策)、paper(AI 论文/研究/学术)、tip(AI 技巧/教程/最佳实践)。仅返回类别名称,不要解释。',
        },
        { role: 'user', content: 'OpenAI 发布 GPT-5 多模态推理模型' },
      ],
    }),
  })
  const elapsed = Date.now() - start
  console.log('status:', res.status, 'elapsed:', elapsed + 'ms')
  const json = (await res.json()) as {
    content?: string
    model?: string
    usage?: Record<string, number>
    stub?: boolean
    error?: boolean
    error_message?: string
  }
  console.log('body:', JSON.stringify(json, null, 2))
  if (json.stub) {
    console.error('❌ stub 模式,LLM 未真实调用,请检查 ai-service .env 的 API key')
    process.exit(1)
  }
  if (json.error) {
    console.error('❌ LLM 调用失败:', json.error_message)
    process.exit(1)
  }
  if (!json.content) {
    console.error('❌ 返回 content 为空')
    process.exit(1)
  }
  console.log('✅ 真实 LLM 响应:', json.content.trim())
  console.log('✅ 模型:', json.model)
  console.log('✅ usage:', JSON.stringify(json.usage))
}

main().catch((e) => {
  console.error('❌ 调用异常:', e)
  process.exit(1)
})
