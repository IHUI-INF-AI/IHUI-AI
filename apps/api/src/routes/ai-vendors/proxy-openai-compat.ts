// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenAI 兼容厂商子路由(2026-09-20)。
 *
 * 覆盖用户提供官方 key 的 9 个厂商:openai / deepseek / siliconflow / openrouter /
 * groq / nvidia / step / mimo / zhipu。全部走 OpenAI 协议透传:
 *   - POST /{vendor}/chat        → {base}/chat/completions(官方全参数 chatBody)
 *   - GET  /{vendor}/models      → {base}/models(动态模型列表)
 *   - POST /{vendor}/embeddings  → {base}/embeddings(仅支持 embeddings 的厂商)
 *   - POST /{vendor}/images      → {base}/images/generations(仅支持生图的厂商)
 *
 * 端点不存在于上游时由 callVendor 透传上游 404/400 报错,不吞错。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { buildSchema } from '../../utils/swagger.js'
import { success, error } from '../../utils/response.js'
import {
  callVendor,
  recordUsage,
  chatBody,
  imageBody,
  VENDORS,
  requireVendorKey,
  fetchWithTimeout,
  requireAuth,
} from './_shared.js'
import { ensurePointsBalance, chargePointsForCall } from './proxy-llm.js'

/** 各厂商能力矩阵(接通上游真实存在的端点,避免死端点) */
const OPENAI_COMPAT_VENDORS = [
  { vendor: 'openai', chat: true, embeddings: true, images: true },
  { vendor: 'deepseek', chat: true, embeddings: false, images: false },
  { vendor: 'siliconflow', chat: true, embeddings: true, images: true },
  { vendor: 'openrouter', chat: true, embeddings: false, images: false },
  { vendor: 'groq', chat: true, embeddings: false, images: false },
  { vendor: 'nvidia', chat: true, embeddings: true, images: false },
  { vendor: 'step', chat: true, embeddings: false, images: false },
  { vendor: 'mimo', chat: true, embeddings: false, images: false },
  { vendor: 'zhipu', chat: true, embeddings: true, images: true },
  // 2026-09-20 四大模态补齐:文本 8 家(官方 OpenAI 兼容端点)
  { vendor: 'moonshot', chat: true, embeddings: false, images: false },
  { vendor: 'minimax', chat: true, embeddings: false, images: false },
  { vendor: 'baichuan', chat: true, embeddings: false, images: false },
  { vendor: 'spark', chat: true, embeddings: false, images: false },
  { vendor: 'mistral', chat: true, embeddings: true, images: false },
  { vendor: 'xai', chat: true, embeddings: false, images: true },
  { vendor: 'perplexity', chat: true, embeddings: false, images: false },
  { vendor: 'lingyiwanwu', chat: true, embeddings: false, images: false },
  // 2026-09-20 n12a 平台补齐:文本 9 家(官方 OpenAI 兼容端点)
  { vendor: 'baidu', chat: true, embeddings: true, images: false },
  { vendor: 'hunyuan', chat: true, embeddings: true, images: false },
  { vendor: 'ai360', chat: true, embeddings: false, images: false },
  { vendor: 'cohere', chat: true, embeddings: true, images: false },
  { vendor: 'together', chat: true, embeddings: true, images: false },
  { vendor: 'fireworks', chat: true, embeddings: true, images: false },
  { vendor: 'cerebras', chat: true, embeddings: false, images: false },
  { vendor: 'deepinfra', chat: true, embeddings: true, images: false },
  { vendor: 'ai21', chat: true, embeddings: false, images: false },
  // 2026-09-20 n13a 平台补齐:文本 12 家(官方 OpenAI 兼容端点)
  { vendor: 'longcat', chat: true, embeddings: false, images: false },
  { vendor: 'sensenova', chat: true, embeddings: true, images: false },
  { vendor: 'upstage', chat: true, embeddings: true, images: false },
  { vendor: 'hyperbolic', chat: true, embeddings: true, images: false },
  { vendor: 'novita', chat: true, embeddings: true, images: false },
  { vendor: 'nebius', chat: true, embeddings: true, images: false },
  { vendor: 'writer', chat: true, embeddings: true, images: false },
  { vendor: 'lambda', chat: true, embeddings: false, images: false },
  { vendor: 'sambanova', chat: true, embeddings: true, images: false },
  { vendor: 'ppio', chat: true, embeddings: true, images: false },
  { vendor: 'meta', chat: true, embeddings: false, images: false },
  // 2026-09-20 n14a 平台补齐:文本 10 家 + 向量 2 家(官方 OpenAI 兼容端点)
  { vendor: 'hf', chat: true, embeddings: false, images: false },
  { vendor: 'featherless', chat: true, embeddings: false, images: false },
  { vendor: 'kluster', chat: true, embeddings: false, images: false },
  { vendor: 'chutes', chat: true, embeddings: false, images: false },
  { vendor: 'parasail', chat: true, embeddings: false, images: false },
  { vendor: 'ovh', chat: true, embeddings: false, images: false },
  { vendor: 'baseten', chat: true, embeddings: false, images: false },
  { vendor: 'ollama', chat: true, embeddings: true, images: false },
  { vendor: 'skywork', chat: true, embeddings: false, images: false },
  { vendor: 'openbmb', chat: true, embeddings: false, images: false },
  { vendor: 'voyage', chat: false, embeddings: true, images: false },
  { vendor: 'jina', chat: false, embeddings: true, images: false },
  // 2026-09-21 n15a 平台补齐:文本 19 家(官方 OpenAI 兼容端点;lmstudio/vllm/xinference
  // 为本地/自部署 key 可选,baseUrl 环境变量与可选 key 由 _shared.ts 注册表处理)
  { vendor: 'bedrock', chat: true, embeddings: false, images: false },
  { vendor: 'modelscope', chat: true, embeddings: false, images: false },
  { vendor: 'zai', chat: true, embeddings: false, images: false },
  { vendor: 'minimaxintl', chat: true, embeddings: false, images: false },
  { vendor: 'dashscopeintl', chat: true, embeddings: false, images: false },
  { vendor: 'byteplus', chat: true, embeddings: false, images: false },
  { vendor: 'pangu', chat: true, embeddings: false, images: false },
  { vendor: 'internlm', chat: true, embeddings: false, images: false },
  { vendor: 'infini', chat: true, embeddings: false, images: false },
  { vendor: 'vercel', chat: true, embeddings: false, images: false },
  { vendor: 'scaleway', chat: true, embeddings: false, images: false },
  { vendor: 'friendli', chat: true, embeddings: false, images: false },
  { vendor: 'nscale', chat: true, embeddings: false, images: false },
  { vendor: 'gmi', chat: true, embeddings: false, images: false },
  { vendor: 'ubicloud', chat: true, embeddings: false, images: false },
  { vendor: 'inferencenet', chat: true, embeddings: false, images: false },
  { vendor: 'lmstudio', chat: true, embeddings: false, images: false },
  { vendor: 'vllm', chat: true, embeddings: false, images: false },
  { vendor: 'xinference', chat: true, embeddings: false, images: false },
] as const

/** OpenAI embeddings 官方参数集 */
const embeddingBody = z.object({
  input: z.union([z.string(), z.array(z.string()).max(100)]).optional(),
  model: z.string().optional(),
  dimensions: z.number().int().optional(),
  encoding_format: z.string().optional(),
  user: z.string().optional(),
})

const VENDOR_NAME_MAP: Record<string, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek(深度求索)',
  siliconflow: 'SiliconFlow(硅基流动)',
  openrouter: 'OpenRouter(聚合中转)',
  groq: 'Groq(高速推理)',
  nvidia: 'NVIDIA(NIM)',
  step: 'Step(阶跃星辰)',
  mimo: 'MiMo(小米)',
  zhipu: 'Zhipu(智谱)',
  moonshot: 'Moonshot(Kimi)',
  minimax: 'MiniMax(海螺)',
  baichuan: 'Baichuan(百川)',
  spark: 'Spark(讯飞星火)',
  mistral: 'Mistral',
  xai: 'xAI(Grok)',
  perplexity: 'Perplexity(Sonar)',
  lingyiwanwu: 'LingYi(零一万物)',
  // 2026-09-20 n12a 新增 9 家
  baidu: 'Baidu(百度千帆)',
  hunyuan: 'Hunyuan(腾讯混元)',
  ai360: 'Ai360(360智脑)',
  cohere: 'Cohere(Command)',
  together: 'Together AI',
  fireworks: 'Fireworks AI',
  cerebras: 'Cerebras',
  deepinfra: 'DeepInfra',
  ai21: 'AI21(Jamba)',
  // 2026-09-20 n13a 新增 12 家
  longcat: 'LongCat(美团)',
  sensenova: 'SenseNova(商汤日日新)',
  upstage: 'Upstage(Solar)',
  hyperbolic: 'Hyperbolic',
  novita: 'Novita AI',
  nebius: 'Nebius AI Studio',
  writer: 'Writer(Palmyra)',
  lambda: 'Lambda Cloud',
  sambanova: 'SambaNova',
  ppio: 'PPIO(派欧云)',
  meta: 'Meta(Llama)',
  // 2026-09-20 n14a 新增 12 家
  hf: 'Hugging Face(Router)',
  featherless: 'Featherless AI',
  kluster: 'Kluster AI',
  chutes: 'Chutes',
  parasail: 'Parasail AI',
  ovh: 'OVHcloud(AI Endpoints)',
  baseten: 'Baseten',
  ollama: 'Ollama(本地)',
  skywork: 'Skywork(昆仑万维天工)',
  openbmb: 'OpenBMB(面壁MiniCPM)',
  voyage: 'Voyage AI(向量化)',
  jina: 'Jina AI(向量/重排)',
  // 2026-09-21 n15a 新增 19 家
  bedrock: 'AWS Bedrock',
  modelscope: 'ModelScope(魔搭)',
  zai: 'Z.ai(智谱国际)',
  minimaxintl: 'MiniMax(国际)',
  dashscopeintl: 'DashScope(阿里国际)',
  byteplus: 'BytePlus(ModelArk)',
  pangu: 'Pangu(华为盘古)',
  internlm: 'InternLM(书生)',
  infini: 'Infini-AI(无问芯穹)',
  vercel: 'Vercel AI Gateway',
  scaleway: 'Scaleway(生成API)',
  friendli: 'FriendliAI',
  nscale: 'Nscale',
  gmi: 'GMI Cloud',
  ubicloud: 'Ubicloud',
  inferencenet: 'Inference.net',
  lmstudio: 'LM Studio(本地)',
  vllm: 'vLLM(自托管)',
  xinference: 'Xinference(自托管)',
}

function vendorTag(vendor: string): string[] {
  return ['AI', 'OpenAI兼容', VENDOR_NAME_MAP[vendor] ?? vendor]
}

export const openaiCompatVendorRoutes: FastifyPluginAsync = async (server) => {
  for (const cap of OPENAI_COMPAT_VENDORS) {
    const vendor = cap.vendor
    const baseUrl = VENDORS[vendor]!.baseUrl

    // ---- POST /{vendor}/chat → {base}/chat/completions(仅矩阵 chat:true 厂商) ----
    if (cap.chat) {
      server.post(
        `/${vendor}/chat`,
        {
          schema: buildSchema({
            summary: `${VENDOR_NAME_MAP[vendor]} 对话补全`,
            description: `代理调用 ${baseUrl}/chat/completions(OpenAI 协议全参数透传)`,
            tags: vendorTag(vendor),
            body: chatBody,
          }),
        },
        async (request, reply) => {
          const body = chatBody.parse(request.body ?? {})
          if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
          const data = await callVendor(vendor, `${baseUrl}/chat/completions`, reply, {
            method: 'POST',
            body: JSON.stringify(body),
          })
          if (data === null) return
          recordUsage(request.userId!, vendor)
          await chargePointsForCall(request, body.model ?? '', data, request.id)
          return reply.send(success(data))
        },
      )
    }

    // ---- GET /{vendor}/models → {base}/models ----
    server.get(
      `/${vendor}/models`,
      {
        schema: buildSchema({
          summary: `${VENDOR_NAME_MAP[vendor]} 模型列表`,
          description: `代理调用 ${baseUrl}/models 动态获取官方全量模型`,
          tags: vendorTag(vendor),
        }),
      },
      async (_request, reply) => {
        const data = await callVendor(vendor, `${baseUrl}/models`, reply, { method: 'GET' })
        if (data === null) return
        return reply.send(success(data))
      },
    )

    // ---- POST /{vendor}/embeddings → {base}/embeddings ----
    if (cap.embeddings) {
      server.post(
        `/${vendor}/embeddings`,
        {
          schema: buildSchema({
            summary: `${VENDOR_NAME_MAP[vendor]} 文本向量化`,
            description: `代理调用 ${baseUrl}/embeddings(OpenAI embeddings 协议全参数)`,
            tags: vendorTag(vendor),
            body: embeddingBody,
          }),
        },
        async (request, reply) => {
          const body = embeddingBody.parse(request.body ?? {})
          if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
          const data = await callVendor(vendor, `${baseUrl}/embeddings`, reply, {
            method: 'POST',
            body: JSON.stringify(body),
          })
          if (data === null) return
          recordUsage(request.userId!, vendor)
          await chargePointsForCall(request, body.model ?? '', data, request.id)
          return reply.send(success(data))
        },
      )
    }

    // ---- POST /{vendor}/images → {base}/images/generations ----
    if (cap.images) {
      server.post(
        `/${vendor}/images`,
        {
          schema: buildSchema({
            summary: `${VENDOR_NAME_MAP[vendor]} 文生图`,
            description: `代理调用 ${baseUrl}/images/generations(OpenAI images 协议全参数)`,
            tags: vendorTag(vendor),
            body: imageBody,
          }),
        },
        async (request, reply) => {
          const body = imageBody.parse(request.body ?? {})
          const data = await callVendor(vendor, `${baseUrl}/images/generations`, reply, {
            method: 'POST',
            body: JSON.stringify(body),
          })
          if (data === null) return
          recordUsage(request.userId!, vendor)
          return reply.send(success(data))
        },
      )
    }
  }

  // ---- 2026-09-20 n12c: OpenAI 音频(TTS + STT) ----

  /** OpenAI TTS 官方参数集(tts-1/tts-1-hd/gpt-4o-mini-tts) */
  const openaiSpeechBody = z.object({
    model: z.string().optional(),
    input: z.string().min(1).max(4096).optional(),
    voice: z.string().optional(),
    instructions: z.string().optional(),
    response_format: z.string().optional(),
    speed: z.number().min(0.25).max(4.0).optional(),
  })

  // POST /openai/speech → {base}/audio/speech(二进制音频 → base64 data URL)
  server.post(
    '/openai/speech',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'OpenAI 文本转语音(TTS)',
        description:
          '代理调用 https://api.openai.com/v1/audio/speech(官方全参数);' +
          'model 缺省 gpt-4o-mini-tts,voice 缺省 alloy,返回 base64 data URL 音频',
        tags: ['AI', 'OpenAI', '音频'],
        body: openaiSpeechBody,
      }),
    },
    async (request, reply) => {
      const body = openaiSpeechBody.parse(request.body ?? {})
      const key = requireVendorKey('openai', reply)
      if (!key) return
      const resp = await fetchWithTimeout(
        `${VENDORS.openai!.baseUrl}/audio/speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: body.model ?? 'gpt-4o-mini-tts',
            input: body.input,
            voice: body.voice ?? 'alloy',
            ...(body.instructions ? { instructions: body.instructions } : {}),
            ...(body.response_format ? { response_format: body.response_format } : {}),
            ...(body.speed !== undefined ? { speed: body.speed } : {}),
          }),
        },
        120_000,
      )
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        return reply
          .status(502)
          .send(error(502, `OpenAI 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 500)}`))
      }
      const format = body.response_format ?? 'mp3'
      const buf = Buffer.from(await resp.arrayBuffer())
      recordUsage(request.userId!, 'openai')
      return reply.send(
        success({ audio: `data:audio/${format};base64,${buf.toString('base64')}`, format }),
      )
    },
  )

  /** OpenAI STT 官方参数集(whisper-1/gpt-4o-transcribe,multipart) */
  const openaiTranscriptionBody = z.object({
    model: z.string().optional(),
    language: z.string().optional(),
    prompt: z.string().optional(),
    response_format: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    timestamp_granularities: z.array(z.enum(['word', 'segment'])).optional(),
  })

  // POST /openai/transcriptions → {base}/audio/transcriptions(multipart 透传)
  server.post(
    '/openai/transcriptions',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'OpenAI 语音转文本(STT)',
        description:
          '代理调用 https://api.openai.com/v1/audio/transcriptions(multipart 官方全参数;' +
          'model 缺省 whisper-1,上传文件字段名 file)',
        tags: ['AI', 'OpenAI', '音频'],
        body: openaiTranscriptionBody,
      }),
    },
    async (request, reply) => {
      const body = openaiTranscriptionBody.parse(request.body ?? {})
      const key = requireVendorKey('openai', reply)
      if (!key) return
      const file = await request.file()
      if (!file) return reply.status(400).send(error(400, '缺少音频文件(字段名 file)'))
      const buffer = await file.toBuffer()
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(buffer)], { type: file.mimetype }), file.filename)
      form.append('model', body.model ?? 'whisper-1')
      if (body.language) form.append('language', body.language)
      if (body.prompt) form.append('prompt', body.prompt)
      if (body.response_format) form.append('response_format', body.response_format)
      if (body.temperature !== undefined) form.append('temperature', String(body.temperature))
      for (const g of body.timestamp_granularities ?? [])
        form.append('timestamp_granularities[]', g)
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.openai!.baseUrl}/audio/transcriptions`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}` },
            body: form,
          },
          120_000,
        )
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          return reply
            .status(502)
            .send(
              error(502, `OpenAI 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 500)}`),
            )
        }
        const ct = resp.headers.get('content-type') ?? ''
        const data = ct.includes('application/json')
          ? await resp.json()
          : { text: await resp.text() }
        recordUsage(request.userId!, 'openai')
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `OpenAI 调用异常: ${msg}`))
      }
    },
  )

  // ---- 2026-09-21 n15a: OpenAI Responses API 透传(GPT-5.1/o系列/codex 时代主力 API) ----
  // 官方参数集(2026-09):model/input/instructions/previous_response_id/temperature/top_p/
  // max_output_tokens/tools/tool_choice/parallel_tool_calls/reasoning/text/truncation/
  // service_tier/store/stream/metadata/include/background/safety_identifier/prompt/
  // conversation/prompt_cache_key。
  // 注意:stream=true 时上游返回 SSE 事件流,本端点仅做 JSON 透传(不做 SSE 转发),
  // handler 内会直接 400 拒绝 stream=true(见下方审计修复注释),需要流式请走 /v1 SSE 网关。

  /** OpenAI Responses API 官方参数集(全 optional) */
  const responsesBody = z.object({
    model: z.string().optional(),
    input: z.unknown().optional(),
    instructions: z.string().optional(),
    previous_response_id: z.string().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    max_output_tokens: z.number().int().optional(),
    tools: z.array(z.unknown()).max(128).optional(),
    tool_choice: z.unknown().optional(),
    parallel_tool_calls: z.boolean().optional(),
    reasoning: z.record(z.string(), z.unknown()).optional(),
    text: z.record(z.string(), z.unknown()).optional(),
    truncation: z.string().optional(),
    service_tier: z.string().optional(),
    store: z.boolean().optional(),
    stream: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    include: z.array(z.string()).optional(),
    background: z.boolean().optional(),
    safety_identifier: z.string().optional(),
    prompt: z.record(z.string(), z.unknown()).optional(),
    conversation: z.string().optional(),
    prompt_cache_key: z.string().optional(),
  })

  const responseIdParam = z.object({ responseId: z.string().min(1) })

  // POST /openai/responses → {base}/responses(官方全参数透传)
  server.post(
    '/openai/responses',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'OpenAI Responses API(创建响应)',
        description:
          '代理调用 https://api.openai.com/v1/responses(官方全参数透传;' +
          'GPT-5.1/o系列/codex 主力 API,支持 reasoning/tools/previous_response_id)',
        tags: ['AI', 'OpenAI', 'Responses'],
        body: responsesBody,
      }),
    },
    async (request, reply) => {
      const body = responsesBody.parse(request.body ?? {})
      // 审计修复:stream=true 时上游返回 SSE 事件流,下方 resp.json() 解析 SSE 必然失败,
      // 且会被 .catch(() => ({})) 吞成 {} 静默丢流。本代理仅做非流式 JSON 透传,
      // 流式请求在发上游前直接 400 拒绝,引导调用方走 /v1 SSE 网关。
      if (body.stream === true) {
        return reply
          .status(400)
          .send(error(400, 'Responses API 流式请走 /v1 网关 SSE;本代理仅支持非流式'))
      }
      const key = requireVendorKey('openai', reply)
      if (!key) return
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.openai!.baseUrl}/responses`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(body),
          },
          120_000,
        )
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) {
          return reply
            .status(502)
            .send(
              error(502, `OpenAI 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
            )
        }
        recordUsage(request.userId!, 'openai')
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `OpenAI 调用异常: ${msg}`))
      }
    },
  )

  // GET /openai/responses/:responseId → {base}/responses/{response_id}(结果检索)
  server.get(
    '/openai/responses/:responseId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'OpenAI Responses API(结果检索)',
        description:
          '代理 GET https://api.openai.com/v1/responses/{response_id}' +
          '(background:true 后台任务/上一次响应的结果检索)',
        tags: ['AI', 'OpenAI', 'Responses'],
        params: responseIdParam,
      }),
    },
    async (request, reply) => {
      const { responseId } = responseIdParam.parse(request.params)
      const key = requireVendorKey('openai', reply)
      if (!key) return
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.openai!.baseUrl}/responses/${encodeURIComponent(responseId)}`,
          { method: 'GET', headers: { Authorization: `Bearer ${key}` } },
          30_000,
        )
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) {
          return reply
            .status(502)
            .send(
              error(502, `OpenAI 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
            )
        }
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `OpenAI 调用异常: ${msg}`))
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
