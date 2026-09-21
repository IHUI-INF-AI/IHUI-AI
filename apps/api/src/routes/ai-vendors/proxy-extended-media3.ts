// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展媒体代理子路由 3(2026-09-20 n13b 平台补齐):
 *   图像  Leonardo /generations(异步任务轮询) + Adobe Firefly /v3/images/generate
 *         (OAuth2 client_credentials 双 key 换 token,同步下载图片)
 *   音频  Deepgram /v1/listen(Nova STT,URL JSON 或 multipart 原始音频直传) +
 *         Cartesia /tts/bytes(Sonic TTS,同步字节流→base64) +
 *         Azure Speech /cognitiveservices/v1(SSML→WAV/MP3,region 级端点)
 *   文本  Azure OpenAI(专有 deployment 协议,resource 级端点):
 *         chat / models / embeddings / images(DALL-E) / transcriptions / speech
 *
 * Azure 系厂商 baseUrl 为空,由请求参数 resource/region 动态拼接官方端点。
 * 异步任务统一走 createTask/taskStore 模式:本地 taskId → 上游 id → 轮询。
 */
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import {
  requireAuth,
  callVendor,
  fetchWithTimeout,
  recordUsage,
  createTask,
  requireVendorKey,
  requireVendorKeys,
  taskStore,
  VENDORS,
  taskIdParam,
  chatBody,
  type FastifyPluginAsync,
} from './_shared.js'
import { ensurePointsBalance, chargePointsForCall } from './proxy-llm.js'

// ============ Leonardo 官方参数(prompt/modelId/negative_prompt/init_image 等) ============
const leonardoBody = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(), // modelId,如 Leonardo Light XL / Phoenix / Kino
  negative_prompt: z.string().optional(),
  init_image: z.string().optional(), // 图生图(原图 URL)
  init_strength: z.number().min(0).max(1).optional(),
  width: z.number().int().min(32).max(1536).optional(),
  height: z.number().int().min(32).max(1536).optional(),
  num_images: z.number().int().min(1).max(20).optional(),
  guidance_scale: z.number().optional(),
  seed: z.number().int().optional(),
  preset_style: z.string().optional(), // 预设风格 ID
  alchemy: z.boolean().optional(), // Alchemy 高质量管线
  photo_real: z.boolean().optional(), // PhotoReal 模式
  contrast: z.number().min(0).max(10).optional(),
  public: z.boolean().optional(),
})

// ============ Adobe Firefly 官方参数(prompt/n/size/seed/contentClass) ============
const fireflyBody = z.object({
  prompt: z.string().min(1),
  n: z.number().int().min(1).max(4).optional(),
  width: z.number().int().min(512).max(2048).optional(),
  height: z.number().int().min(512).max(2048).optional(),
  seed: z.number().int().optional(),
  content_class: z.string().optional(), // photo | art
  style: z.string().optional(), // 风格预设引用 ID
})

// ============ Deepgram 官方参数(model/language/smart_format/diarize 等) ============
const deepgramBody = z.object({
  url: z.string().optional(), // 公网音频 URL(JSON 模式)
  model: z.string().optional(), // nova-3 | nova-2 | base | enhanced
  language: z.string().optional(), // en | multi | zh ...
  punctuate: z.boolean().optional(),
  smart_format: z.boolean().optional(),
  diarize: z.boolean().optional(),
  paragraphs: z.boolean().optional(),
  detect_language: z.boolean().optional(),
  filler_words: z.boolean().optional(),
  numerals: z.boolean().optional(),
  profanity_filter: z.boolean().optional(),
  redact: z.string().optional(), // pci | ssn | 逗号分隔列表
  keywords: z.array(z.string()).optional(),
})

// ============ Cartesia 官方参数(model_id/transcript/voice/output_format) ============
const cartesiaTtsBody = z.object({
  transcript: z.string().min(1),
  model_id: z.string().optional(), // sonic-2 | sonic | sonic-turbo
  voice_id: z.string().optional(), // 音色 ID
  language: z.string().optional(), // en | zh | fr ...
  container: z.string().optional(), // wav | mp3 | raw
  encoding: z.string().optional(), // pcm_s16le | pcm_f32le | mulaw
  sample_rate: z.number().int().optional(),
  duration: z.number().optional(), // 最长输出秒数
})

// ============ Azure Speech TTS 官方参数(region/voice/lang/outputFormat) ============
const azureSpeechTtsBody = z.object({
  text: z.string().min(1),
  region: z.string().min(1), // 资源区域,如 eastus / westeurope
  voice: z.string().optional(), // zh-CN-XiaoxiaoNeural / en-US-JennyNeural
  lang: z.string().optional(), // SSML xml:lang
  output_format: z.string().optional(), // X-Microsoft-OutputFormat
  rate: z.string().optional(), // 语速,如 '+10%'
  pitch: z.string().optional(), // 音调,如 '+5%'
  volume: z.string().optional(), // 音量,如 '-20%'
})

// ============ Azure OpenAI 专有协议(deployment/resource 级端点) ============
const azureResourceBody = {
  resource: z.string().min(1), // 资源名 → https://{resource}.openai.azure.com
  deployment: z.string().min(1), // 部署名(model deployment)
  apiVersion: z.string().optional(), // 缺省 2024-10-21
}
const azureChatBody = z.object({
  ...azureResourceBody,
  ...chatBody.shape,
  messages: z.array(z.unknown()).min(1),
})
const azureEmbeddingBody = z.object({
  ...azureResourceBody,
  input: z.union([z.string().min(1), z.array(z.string().min(1)).max(100)]),
  dimensions: z.number().int().optional(),
  encoding_format: z.string().optional(),
  user: z.string().optional(),
})
const azureImagesBody = z.object({
  ...azureResourceBody,
  prompt: z.string().min(1),
  model: z.string().optional(),
  size: z.string().optional(), // 1024x1024 | 1792x1024 | 1024x1792
  n: z.number().int().min(1).max(10).optional(),
  quality: z.string().optional(), // standard | hd
  style: z.string().optional(), // natural | vivid
  response_format: z.string().optional(), // url | b64_json
  user: z.string().optional(),
})
const azureTranscriptionBody = z.object({
  ...azureResourceBody,
  language: z.string().optional(),
  prompt: z.string().optional(),
  response_format: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
})
const azureSpeechBody = z.object({
  ...azureResourceBody,
  input: z.string().min(1).max(4096),
  voice: z.string().optional(), // alloy | echo | fable | onyx | nova | shimmer
  response_format: z.string().optional(), // mp3 | opus | aac | flac | wav | pcm
  speed: z.number().min(0.25).max(4.0).optional(),
})
const azureModelsQuery = z.object({
  resource: z.string().min(1),
  apiVersion: z.string().optional(),
})

// ---- Stability Image-to-Video 官方参数(multipart:image/seed/cfg_scale/motion_bucket_id) ----
const stabilityVideoBody = z.object({
  image: z.string().min(1), // 首帧图片(base64,兼容 data: 前缀)
  seed: z.number().int().optional(),
  cfg_scale: z.number().optional(),
  motion_bucket_id: z.number().int().optional(),
})

// ---- ElevenLabs Music 官方参数(prompt/music_length_ms/model) ----
const elevenlabsMusicBody = z.object({
  prompt: z.string().min(1),
  music_length_ms: z.number().int().optional(),
  model: z.string().optional(), // music_v1 等
})

// ---- Deepgram T2S 官方参数(text + query 上的 model/encoding/sample_rate/container 等) ----
const deepgramTtsBody = z.object({
  text: z.string().min(1),
  model: z.string().optional(), // aura-2-thalia-en | aura-asteria-en 等
  encoding: z.string().optional(), // linear16 | mulaw | mp3 ...
  sample_rate: z.number().int().optional(),
  container: z.string().optional(), // none | wav | ogg
  bitrate: z.number().int().optional(),
})

/** Firefly OAuth2 令牌端点(IMS)与官方 scope */
const ADOBE_IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3'
const ADOBE_FIREFLY_SCOPE =
  'openid,additional_info.projectedProductContext,additional_info.job_function,firefly_api,ff_ondemand.onee'

/** Azure OpenAI 端点拼接(resource 级官方 URL) */
function azureUrl(resource: string, path: string, apiVersion: string): string {
  return `https://${resource}.openai.azure.com${path}?api-version=${apiVersion}`
}

export const extendedMediaVendorRoutes3: FastifyPluginAsync = async (server) => {
  // ============ 图像:Leonardo(异步 generations + 轮询) ============
  server.post(
    '/leonardo/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Leonardo AI 文生/图生图',
        description:
          '代理调用 https://cloud.leonardo.ai/api/rest/v1/generations(官方全参数,' +
          '支持 alchemy/photoReal/图生图 init_image);返回本地 taskId,用 /leonardo/tasks/:taskId 轮询',
        tags: ['AI', 'Leonardo', '图像'],
        body: leonardoBody,
      }),
    },
    async (request, reply) => {
      const body = leonardoBody.parse(request.body)
      const key = requireVendorKey('leonardo', reply)
      if (!key) return
      const payload: Record<string, unknown> = { prompt: body.prompt }
      if (body.model) payload.modelId = body.model
      if (body.negative_prompt) payload.negative_prompt = body.negative_prompt
      if (body.init_image) {
        payload.init_image = body.init_image
        payload.init_type = 'IMAGE_TO_IMAGE'
        if (body.init_strength !== undefined) payload.init_strength = body.init_strength
      }
      if (body.width !== undefined) payload.width = body.width
      if (body.height !== undefined) payload.height = body.height
      if (body.num_images !== undefined) payload.num_images = body.num_images
      if (body.guidance_scale !== undefined) payload.guidance_scale = body.guidance_scale
      if (body.seed !== undefined) payload.seed = body.seed
      if (body.preset_style) payload.presetStyle = body.preset_style
      if (body.alchemy !== undefined) payload.alchemy = body.alchemy
      if (body.photo_real !== undefined) payload.photoReal = body.photo_real
      if (body.contrast !== undefined) payload.contrast = body.contrast
      if (body.public !== undefined) payload.public = body.public
      const data = await callVendor('leonardo', `${VENDORS.leonardo!.baseUrl}/generations`, reply, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (data === null) return
      const task = createTask(request.userId!, 'leonardo', 'image', data)
      recordUsage(request.userId!, 'leonardo')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/leonardo/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Leonardo 任务查询',
        description:
          '代理调用 /generations/{上游id} 轮询(status: PENDING/GENERATING/COMPLETE/FAILED,' +
          'COMPLETE 时返回 generated_images 列表)',
        tags: ['AI', 'Leonardo', '图像'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'leonardo' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstreamId = String(
        (task.result as { sdGenerationJob?: { generationId?: string } } | undefined)
          ?.sdGenerationJob?.generationId ?? '',
      )
      const upstream = await callVendor(
        'leonardo',
        `${VENDORS.leonardo!.baseUrl}/generations/${upstreamId}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) {
        task.result = { ...(task.result as Record<string, unknown>), ...(upstream as Record<string, unknown>) }
        const st = (upstream as { generations_by_pk?: { status?: string } }).generations_by_pk?.status
        if (st === 'COMPLETE') task.status = 'succeeded'
        else if (st === 'FAILED') task.status = 'failed'
        else if (st === 'PENDING' || st === 'GENERATING') task.status = 'running'
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  // ============ 图像:Adobe Firefly(OAuth2 双 key 换 token,同步下载) ============
  server.post(
    '/firefly/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Adobe Firefly 文生图',
        description:
          '代理调用 https://firefly-api.adobe.com/v3/images/generate(先用 ADOBE_CLIENT_ID/' +
          'ADOBE_CLIENT_SECRET 走 IMS OAuth2 client_credentials 换 token,再生成并下载 base64 图片)',
        tags: ['AI', 'Firefly', '图像'],
        body: fireflyBody,
      }),
    },
    async (request, reply) => {
      const body = fireflyBody.parse(request.body)
      const creds = requireVendorKeys('firefly', reply)
      if (!creds) return
      const clientId = creds.key
      const clientSecret = creds.secret
      // 第一步:IMS OAuth2 client_credentials 换 access_token
      let accessToken: string
      try {
        const tokenResp = await fetchWithTimeout(ADOBE_IMS_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: ADOBE_FIREFLY_SCOPE,
          }),
        })
        const tokenData = (await tokenResp.json().catch(() => ({}))) as { access_token?: string }
        if (!tokenResp.ok || !tokenData.access_token) {
          return reply.status(502).send(
            error(502, `Firefly 令牌获取失败: ${tokenResp.status} ${JSON.stringify(tokenData).slice(0, 400)}`),
          )
        }
        accessToken = tokenData.access_token
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Firefly 令牌获取异常: ${msg}`))
      }
      // 第二步:生成图片
      const genResp = await fetchWithTimeout(
        `${VENDORS.firefly!.baseUrl}/v3/images/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'X-Api-Key': clientId,
          },
          body: JSON.stringify({
            prompt: body.prompt,
            ...(body.n ? { n: body.n } : {}),
            ...(body.width && body.height ? { size: { width: body.width, height: body.height } } : {}),
            ...(body.seed !== undefined ? { seed: body.seed } : {}),
            ...(body.content_class ? { contentClass: body.content_class } : {}),
            ...(body.style ? { styles: [{ reference: body.style, strength: 1 }] } : {}),
          }),
        },
        120_000,
      )
      const genData = (await genResp.json().catch(() => ({}))) as {
        outputs?: Array<{ seed?: number; image?: { id?: string } }>
      }
      if (!genResp.ok) {
        return reply.status(502).send(
          error(502, `Firefly 调用失败: ${genResp.status} ${JSON.stringify(genData).slice(0, 400)}`),
        )
      }
      // 第三步:逐一下载生成的图片转 base64
      const images: string[] = []
      for (const out of genData.outputs ?? []) {
        const imageId = out.image?.id
        if (!imageId) continue
        try {
          const dl = await fetchWithTimeout(
            `${VENDORS.firefly!.baseUrl}/v3/images/${imageId}`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${accessToken}`, 'X-Api-Key': clientId },
            },
            60_000,
          )
          if (dl.ok) {
            const buf = Buffer.from(await dl.arrayBuffer())
            images.push(`data:image/png;base64,${buf.toString('base64')}`)
          }
        } catch {
          // 单图下载失败不阻断整体响应
        }
      }
      recordUsage(request.userId!, 'firefly')
      return reply.send(success({ images, raw: genData }))
    },
  )

  // ============ 音频:Deepgram STT(JSON URL 模式 / multipart 原始音频直传) ============
  server.post(
    '/deepgram/transcribe',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Deepgram 语音转文本(Nova STT)',
        description:
          '代理调用 https://api.deepgram.com/v1/listen(官方全参数)。JSON 模式传 { url };' +
          '或 multipart 直传音频文件(字段名 file,model 缺省 nova-3)',
        tags: ['AI', 'Deepgram', '音频'],
        body: deepgramBody,
      }),
    },
    async (request, reply) => {
      const body = deepgramBody.parse(request.body ?? {})
      const key = requireVendorKey('deepgram', reply)
      if (!key) return
      const q = new URLSearchParams()
      if (body.model) q.set('model', body.model)
      if (body.language) q.set('language', body.language)
      for (const b of ['punctuate', 'smart_format', 'diarize', 'paragraphs', 'detect_language', 'filler_words', 'numerals', 'profanity_filter'] as const) {
        if (body[b] !== undefined) q.set(b, String(body[b]))
      }
      if (body.redact) q.set('redact', body.redact)
      for (const kw of body.keywords ?? []) q.append('keywords', kw)
      const listenUrl = `${VENDORS.deepgram!.baseUrl}/v1/listen?${q.toString()}`
      const contentType = String(request.headers['content-type'] ?? '')
      try {
        if (contentType.includes('application/json')) {
          // JSON 模式:上游拉取 url 音频
          if (!body.url) return reply.status(400).send(error(400, 'JSON 模式必须传 url'))
          const data = await callVendor('deepgram', listenUrl, reply, {
            method: 'POST',
            body: JSON.stringify({ url: body.url }),
          })
          if (data === null) return
          recordUsage(request.userId!, 'deepgram')
          return reply.send(success(data))
        }
        // multipart 模式:原始音频字节直传
        const file = await request.file()
        if (!file) return reply.status(400).send(error(400, '缺少音频文件(字段名 file)或 JSON url'))
        const buffer = await file.toBuffer()
        const resp = await fetchWithTimeout(
          listenUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': file.mimetype || 'audio/wav',
              ...VENDORS.deepgram!.authHeader(key),
            },
            body: new Uint8Array(buffer),
          },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) {
          return reply.status(502).send(
            error(502, `Deepgram 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`),
          )
        }
        recordUsage(request.userId!, 'deepgram')
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Deepgram 调用异常: ${msg}`))
      }
    },
  )

  // ============ 音频:Cartesia Sonic TTS(同步字节流→base64) ============
  server.post(
    '/cartesia/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Cartesia 文本转语音(Sonic)',
        description:
          '代理调用 https://api.cartesia.ai/tts/bytes(官方全参数,model 缺省 sonic-2,' +
          'voice 缺省官方默认音色);返回 base64 data URL 音频',
        tags: ['AI', 'Cartesia', '音频'],
        body: cartesiaTtsBody,
      }),
    },
    async (request, reply) => {
      const body = cartesiaTtsBody.parse(request.body)
      const key = requireVendorKey('cartesia', reply)
      if (!key) return
      const container = body.container ?? 'wav'
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.cartesia!.baseUrl}/tts/bytes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: `audio/${container}`,
              ...VENDORS.cartesia!.authHeader(key),
            },
            body: JSON.stringify({
              model_id: body.model_id ?? 'sonic-2',
              transcript: body.transcript,
              voice: { mode: 'id', id: body.voice_id ?? '694f9389-aac1-45b6-b726-9d9369183238' },
              output_format: {
                container,
                ...(body.encoding ? { encoding: body.encoding } : { encoding: 'pcm_s16le' }),
                sample_rate: body.sample_rate ?? 44100,
              },
              ...(body.language ? { language: body.language } : {}),
              ...(body.duration !== undefined ? { duration: body.duration } : {}),
            }),
          },
          120_000,
        )
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          return reply.status(502).send(
            error(502, `Cartesia 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 400)}`),
          )
        }
        const buf = Buffer.from(await resp.arrayBuffer())
        recordUsage(request.userId!, 'cartesia')
        return reply.send(
          success({ audio: `data:audio/${container};base64,${buf.toString('base64')}`, bytes: buf.length }),
        )
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Cartesia 调用异常: ${msg}`))
      }
    },
  )

  // ============ 音频:Azure Speech TTS(SSML→WAV/MP3) ============
  server.post(
    '/azure-speech/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Azure Speech 文本转语音',
        description:
          '代理调用 https://{region}.tts.speech.microsoft.com/cognitiveservices/v1(SSML 官方协议,' +
          'region 必填如 eastus;voice 缺省 zh-CN-XiaoxiaoNeural);返回 base64 data URL 音频',
        tags: ['AI', 'AzureSpeech', '音频'],
        body: azureSpeechTtsBody,
      }),
    },
    async (request, reply) => {
      const body = azureSpeechTtsBody.parse(request.body)
      const key = requireVendorKey('azure-speech', reply)
      if (!key) return
      const voice = body.voice ?? 'zh-CN-XiaoxiaoNeural'
      const lang = body.lang ?? 'zh-CN'
      const outputFormat = body.output_format ?? 'audio-24khz-48kbitrate-mono-mp3'
      const prosody =
        body.rate || body.pitch || body.volume
          ? `<prosody${body.rate ? ` rate='${body.rate}'` : ''}${body.pitch ? ` pitch='${body.pitch}'` : ''}${body.volume ? ` volume='${body.volume}'` : ''}>${body.text}</prosody>`
          : body.text
      const ssml =
        `<speak version='1.0' xml:lang='${lang}'><voice name='${voice}'>${prosody}</voice></speak>`
      try {
        const resp = await fetchWithTimeout(
          `https://${body.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': outputFormat,
              'User-Agent': 'IHUI-AI',
              ...VENDORS['azure-speech']!.authHeader(key),
            },
            body: ssml,
          },
          120_000,
        )
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          return reply.status(502).send(error(502, `AzureSpeech 调用失败: ${resp.status} ${errText.slice(0, 400)}`))
        }
        const buf = Buffer.from(await resp.arrayBuffer())
        const ext = outputFormat.includes('mp3') ? 'mp3' : 'wav'
        recordUsage(request.userId!, 'azure-speech')
        return reply.send(
          success({ audio: `data:audio/${ext};base64,${buf.toString('base64')}`, bytes: buf.length }),
        )
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `AzureSpeech 调用异常: ${msg}`))
      }
    },
  )

  // ============ 文本:Azure OpenAI(专有 deployment 协议,6 端点) ============

  // POST /azure/chat → https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions
  server.post(
    '/azure/chat',
    {
      schema: buildSchema({
        summary: 'Azure OpenAI 对话补全',
        description:
          '代理调用 https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/' +
          'completions?api-version=(Azure 专有 deployment 协议全参数透传)',
        tags: ['AI', 'Azure', '文本'],
        body: azureChatBody,
      }),
    },
    async (request, reply) => {
      const body = azureChatBody.parse(request.body)
      const { resource, deployment, apiVersion, ...payload } = body
      if (!(await ensurePointsBalance(request, reply, deployment))) return
      const data = await callVendor(
        'azure',
        azureUrl(resource, `/openai/deployments/${deployment}/chat/completions`, apiVersion ?? '2024-10-21'),
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'azure')
      await chargePointsForCall(request, deployment, data, request.id)
      return reply.send(success(data))
    },
  )

  // GET /azure/models → /openai/models(资源区域可用模型列表)
  server.get(
    '/azure/models',
    {
      schema: buildSchema({
        summary: 'Azure OpenAI 模型列表',
        description: '代理调用 https://{resource}.openai.azure.com/openai/models?api-version=',
        tags: ['AI', 'Azure', '文本'],
        querystring: azureModelsQuery,
      }),
    },
    async (request, reply) => {
      const { resource, apiVersion } = azureModelsQuery.parse(request.query)
      const data = await callVendor(
        'azure',
        azureUrl(resource, '/openai/models', apiVersion ?? '2024-10-21'),
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // POST /azure/embeddings → /openai/deployments/{deployment}/embeddings
  server.post(
    '/azure/embeddings',
    {
      schema: buildSchema({
        summary: 'Azure OpenAI 文本向量化',
        description:
          '代理调用 https://{resource}.openai.azure.com/openai/deployments/{deployment}/embeddings',
        tags: ['AI', 'Azure', '文本'],
        body: azureEmbeddingBody,
      }),
    },
    async (request, reply) => {
      const body = azureEmbeddingBody.parse(request.body)
      const { resource, deployment, apiVersion, ...payload } = body
      if (!(await ensurePointsBalance(request, reply, deployment))) return
      const data = await callVendor(
        'azure',
        azureUrl(resource, `/openai/deployments/${deployment}/embeddings`, apiVersion ?? '2024-10-21'),
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'azure')
      await chargePointsForCall(request, deployment, data, request.id)
      return reply.send(success(data))
    },
  )

  // POST /azure/images → /openai/deployments/{deployment}/images/generations(DALL-E 3)
  server.post(
    '/azure/images',
    {
      schema: buildSchema({
        summary: 'Azure OpenAI 文生图(DALL-E)',
        description:
          '代理调用 https://{resource}.openai.azure.com/openai/deployments/{deployment}/images/' +
          'generations?api-version=(dall-e-3 支持 quality/style)',
        tags: ['AI', 'Azure', '图像'],
        body: azureImagesBody,
      }),
    },
    async (request, reply) => {
      const body = azureImagesBody.parse(request.body)
      const { resource, deployment, apiVersion, ...payload } = body
      const data = await callVendor(
        'azure',
        azureUrl(resource, `/openai/deployments/${deployment}/images/generations`, apiVersion ?? '2024-10-21'),
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'azure')
      return reply.send(success(data))
    },
  )

  // POST /azure/transcriptions → /openai/deployments/{deployment}/audio/transcriptions(multipart)
  server.post(
    '/azure/transcriptions',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Azure OpenAI 语音转文本(Whisper)',
        description:
          '代理调用 https://{resource}.openai.azure.com/openai/deployments/{deployment}/audio/' +
          'transcriptions?api-version=(multipart 上传,文件字段名 file)',
        tags: ['AI', 'Azure', '音频'],
        body: azureTranscriptionBody,
      }),
    },
    async (request, reply) => {
      const body = azureTranscriptionBody.parse(request.body ?? {})
      const { resource, deployment, apiVersion, ...rest } = body
      const key = requireVendorKey('azure', reply)
      if (!key) return
      const file = await request.file()
      if (!file) return reply.status(400).send(error(400, '缺少音频文件(字段名 file)'))
      const buffer = await file.toBuffer()
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(buffer)], { type: file.mimetype }), file.filename)
      if (rest.language) form.append('language', rest.language)
      if (rest.prompt) form.append('prompt', rest.prompt)
      if (rest.response_format) form.append('response_format', rest.response_format)
      if (rest.temperature !== undefined) form.append('temperature', String(rest.temperature))
      try {
        const resp = await fetchWithTimeout(
          azureUrl(
            resource,
            `/openai/deployments/${deployment}/audio/transcriptions`,
            apiVersion ?? '2024-02-01',
          ),
          { method: 'POST', headers: { ...VENDORS.azure!.authHeader(key) }, body: form },
          120_000,
        )
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          return reply.status(502).send(
            error(502, `Azure 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 500)}`),
          )
        }
        const ct = resp.headers.get('content-type') ?? ''
        const data = ct.includes('application/json') ? await resp.json() : { text: await resp.text() }
        recordUsage(request.userId!, 'azure')
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Azure 调用异常: ${msg}`))
      }
    },
  )

  // POST /azure/speech → /openai/deployments/{deployment}/audio/speech(TTS 二进制)
  server.post(
    '/azure/speech',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Azure OpenAI 文本转语音(tts-1)',
        description:
          '代理调用 https://{resource}.openai.azure.com/openai/deployments/{deployment}/audio/' +
          'speech?api-version=(deployment 缺省 tts-1,voice 缺省 alloy,返回 base64 音频)',
        tags: ['AI', 'Azure', '音频'],
        body: azureSpeechBody,
      }),
    },
    async (request, reply) => {
      const body = azureSpeechBody.parse(request.body)
      const { resource, deployment, apiVersion, ...payload } = body
      const key = requireVendorKey('azure', reply)
      if (!key) return
      try {
        const resp = await fetchWithTimeout(
          azureUrl(resource, `/openai/deployments/${deployment}/audio/speech`, apiVersion ?? '2024-02-01'),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...VENDORS.azure!.authHeader(key) },
            body: JSON.stringify({
              input: payload.input,
              voice: payload.voice ?? 'alloy',
              response_format: payload.response_format ?? 'mp3',
              ...(payload.speed !== undefined ? { speed: payload.speed } : {}),
            }),
          },
          120_000,
        )
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          return reply.status(502).send(
            error(502, `Azure 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 500)}`),
          )
        }
        const format = payload.response_format ?? 'mp3'
        const buf = Buffer.from(await resp.arrayBuffer())
        recordUsage(request.userId!, 'azure')
        return reply.send(
          success({ audio: `data:audio/${format};base64,${buf.toString('base64')}`, bytes: buf.length }),
        )
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Azure 调用异常: ${msg}`))
      }
    },
  )

  // ============ 视频:Stability Image-to-Video(异步 multipart + 二进制结果) ============
  // 官方端点:POST https://api.stability.ai/v2beta/image-to-video(上游返回 id)
  server.post(
    '/stability/video',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Stability 图生视频(Stable Video Diffusion)',
        description:
          '代理调用 https://api.stability.ai/v2beta/image-to-video(multipart 官方参数:' +
          'image 首帧 base64/seed/cfg_scale/motion_bucket_id);返回上游 id,' +
          '用 /stability/video/tasks/:taskId 轮询',
        tags: ['AI', 'Stability', '视频'],
        body: stabilityVideoBody,
      }),
    },
    async (request, reply) => {
      const body = stabilityVideoBody.parse(request.body ?? {})
      const key = requireVendorKey('stability', reply)
      if (!key) return
      const base64 = body.image.startsWith('data:')
        ? body.image.slice(body.image.indexOf(',') + 1)
        : body.image
      const form = new FormData()
      form.append(
        'image',
        new Blob([new Uint8Array(Buffer.from(base64, 'base64'))], { type: 'image/png' }),
        'image.png',
      )
      if (body.seed !== undefined) form.append('seed', String(body.seed))
      if (body.cfg_scale !== undefined) form.append('cfg_scale', String(body.cfg_scale))
      if (body.motion_bucket_id !== undefined)
        form.append('motion_bucket_id', String(body.motion_bucket_id))
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.stability!.baseUrl}/v2beta/image-to-video`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}` },
            body: form,
          },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) {
          return reply.status(502).send(
            error(502, `Stability 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`),
          )
        }
        recordUsage(request.userId!, 'stability')
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Stability 调用异常: ${msg}`))
      }
    },
  )

  // 官方端点:GET https://api.stability.ai/v2beta/image-to-video/result/{id}(202 时返回视频二进制)
  server.get(
    '/stability/video/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Stability 图生视频结果',
        description:
          '代理调用 /v2beta/image-to-video/result/{上游id}:上游 202 时直接透传 video 二进制流,' +
          '200 时返回任务状态 JSON(in-progress 等)',
        tags: ['AI', 'Stability', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const key = requireVendorKey('stability', reply)
      if (!key) return
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.stability!.baseUrl}/v2beta/image-to-video/result/${encodeURIComponent(taskId)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${key}`, Accept: 'video/*' },
          },
          300_000,
        )
        const ct = resp.headers.get('content-type') ?? ''
        // 202(或任意 video/* 二进制):直接透传视频字节流
        if (resp.status === 202 || ct.startsWith('video/')) {
          const buf = Buffer.from(await resp.arrayBuffer())
          return reply.type(ct || 'video/mp4').send(buf)
        }
        if (ct.includes('application/json')) {
          const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
          if (!resp.ok) {
            return reply.status(502).send(
              error(502, `Stability 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`),
            )
          }
          return reply.send(success(data))
        }
        const text = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `Stability 调用失败: ${resp.status} ${text.slice(0, 400)}`))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Stability 调用异常: ${msg}`))
      }
    },
  )

  // ============ 音乐:ElevenLabs Music(官方端点 POST https://api.elevenlabs.io/v1/music) ============
  server.post(
    '/elevenlabs/music',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'ElevenLabs 音乐生成',
        description:
          '代理调用 https://api.elevenlabs.io/v1/music(官方全参数,prompt/music_length_ms,' +
          'model 缺省 music_v1);返回 base64 data URL 音频',
        tags: ['AI', 'ElevenLabs', '音乐'],
        body: elevenlabsMusicBody,
      }),
    },
    async (request, reply) => {
      const body = elevenlabsMusicBody.parse(request.body ?? {})
      const key = requireVendorKey('elevenlabs', reply)
      if (!key) return
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.elevenlabs!.baseUrl}/v1/music`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
              ...VENDORS.elevenlabs!.authHeader(key),
            },
            body: JSON.stringify({
              prompt: body.prompt,
              ...(body.music_length_ms !== undefined
                ? { music_length_ms: body.music_length_ms }
                : {}),
              ...(body.model ? { model: body.model } : {}),
            }),
          },
          300_000,
        )
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          return reply.status(502).send(
            error(502, `ElevenLabs 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 400)}`),
          )
        }
        const buf = Buffer.from(await resp.arrayBuffer())
        recordUsage(request.userId!, 'elevenlabs')
        return reply.send(
          success({ audio: `data:audio/mpeg;base64,${buf.toString('base64')}`, bytes: buf.length }),
        )
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `ElevenLabs 调用异常: ${msg}`))
      }
    },
  )

  // ============ 音频:Deepgram T2S(官方端点 POST https://api.deepgram.com/v1/speak?model=) ============
  server.post(
    '/deepgram/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Deepgram 文本转语音(Aura)',
        description:
          '代理调用 https://api.deepgram.com/v1/speak?model=(model 缺省 aura-2-thalia-en,' +
          'encoding/sample_rate/container/bitrate 官方 query 参数);返回 base64 data URL 音频',
        tags: ['AI', 'Deepgram', '音频'],
        body: deepgramTtsBody,
      }),
    },
    async (request, reply) => {
      const body = deepgramTtsBody.parse(request.body ?? {})
      const key = requireVendorKey('deepgram', reply)
      if (!key) return
      const q = new URLSearchParams({ model: body.model ?? 'aura-2-thalia-en' })
      if (body.encoding) q.set('encoding', body.encoding)
      if (body.sample_rate !== undefined) q.set('sample_rate', String(body.sample_rate))
      if (body.container) q.set('container', body.container)
      if (body.bitrate !== undefined) q.set('bitrate', String(body.bitrate))
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.deepgram!.baseUrl}/v1/speak?${q.toString()}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...VENDORS.deepgram!.authHeader(key),
            },
            body: JSON.stringify({ text: body.text }),
          },
          120_000,
        )
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          return reply.status(502).send(
            error(502, `Deepgram 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 400)}`),
          )
        }
        const ct = resp.headers.get('content-type') ?? 'audio/mpeg'
        const buf = Buffer.from(await resp.arrayBuffer())
        const ext = ct.includes('wav') ? 'wav' : ct.includes('ogg') ? 'ogg' : 'mp3'
        recordUsage(request.userId!, 'deepgram')
        return reply.send(
          success({ audio: `data:audio/${ext};base64,${buf.toString('base64')}`, bytes: buf.length }),
        )
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Deepgram 调用异常: ${msg}`))
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
