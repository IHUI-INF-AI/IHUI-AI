// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { Button, Card, CardContent, CardHeader, CardTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import {
  ChatAdvancedParams,
  CHAT_ADVANCED_DEFAULTS,
  ModelSelect,
  parseChatAdvanced,
  useVendorModels,
  type ChatAdvancedValues,
} from './vendor-models'

/**
 * OpenAI 兼容厂商通用对话窗口(2026-09-20,2026-09-21 n15a 扩至 66 家;2026-09-21 fallback 清单刷新至各厂当前在售版本)。
 * 覆盖 66 个官方直连厂商,共用后端 /api/ai/{vendor}/chat 全参数透传端点:
 *   - 厂商下拉切换 → 动态拉取该厂商官方全量模型(GET /api/ai/{vendor}/models)
 *   - 参数窗口 → ChatAdvancedParams(OpenAI 官方 15 参数,与后端 chatBody 对齐)
 */

interface CompatVendor {
  vendor: string
  brand: string
  fallback: readonly string[]
}

const VENDORS: readonly CompatVendor[] = [
  { vendor: 'openai', brand: 'OpenAI', fallback: ['gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna'] },
  { vendor: 'deepseek', brand: 'DeepSeek', fallback: ['deepseek-chat', 'deepseek-reasoner'] },
  { vendor: 'zhipu', brand: 'Zhipu GLM', fallback: ['glm-5.3', 'glm-4.7', 'glm-4.5-air'] },
  { vendor: 'groq', brand: 'Groq', fallback: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'] },
  { vendor: 'nvidia', brand: 'NVIDIA NIM', fallback: ['meta/llama-3.2-11b-vision-instruct'] },
  { vendor: 'openrouter', brand: 'OpenRouter', fallback: ['openrouter/free', 'deepseek/deepseek-v4-flash-0731:free'] },
  { vendor: 'siliconflow', brand: 'SiliconFlow', fallback: ['deepseek-ai/DeepSeek-V4-Pro', 'Qwen/Qwen3.5-397B-A17B', 'Qwen/Qwen2.5-7B-Instruct'] },
  { vendor: 'step', brand: 'StepFun', fallback: ['step-5-preview', 'step-3.7-flash', 'step-3.5-flash'] },
  { vendor: 'mimo', brand: 'MiMo', fallback: ['mimo-7b-rl'] },
  { vendor: 'moonshot', brand: 'Moonshot Kimi', fallback: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6'] },
  { vendor: 'minimax', brand: 'MiniMax', fallback: ['MiniMax-M3', 'MiniMax-M2.5', 'MiniMax-M2'] },
  { vendor: 'baichuan', brand: 'Baichuan', fallback: ['Baichuan-M2-32B', 'Baichuan4-Turbo', 'Baichuan4'] },
  { vendor: 'spark', brand: 'iFlytek Spark', fallback: ['4.0Ultra', 'generalv3.5', 'spark-max'] },
  { vendor: 'mistral', brand: 'Mistral', fallback: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
  { vendor: 'xai', brand: 'xAI Grok', fallback: ['grok-4.6', 'grok-4.20'] },
  { vendor: 'perplexity', brand: 'Perplexity', fallback: ['sonar-pro', 'sonar-reasoning-pro', 'sonar'] },
  { vendor: 'lingyiwanwu', brand: '零一万物 Yi', fallback: ['yi-lightning', 'yi-large', 'yi-vision-v2'] },
  { vendor: 'baidu', brand: '百度千帆', fallback: ['ernie-5.0', 'ernie-4.5-turbo-128k'] },
  { vendor: 'hunyuan', brand: '腾讯混元', fallback: ['hunyuan-turbos-latest', 'hunyuan-t1-latest'] },
  { vendor: 'ai360', brand: '360智脑', fallback: ['360gpt-pro', '360gpt-turbo', '360gpt2-pro'] },
  { vendor: 'cohere', brand: 'Cohere', fallback: ['command-a-03-2025', 'command-r-plus', 'command-r7b-12-2024'] },
  { vendor: 'together', brand: 'Together AI', fallback: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct-Turbo'] },
  { vendor: 'fireworks', brand: 'Fireworks AI', fallback: ['accounts/fireworks/models/llama4-maverick-instruct-basic', 'accounts/fireworks/models/deepseek-v3'] },
  { vendor: 'cerebras', brand: 'Cerebras', fallback: ['llama-3.3-70b', 'llama-4-maverick-17b-128e-instruct', 'qwen-3-235b-a22b-instruct-2507'] },
  { vendor: 'deepinfra', brand: 'DeepInfra', fallback: ['meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'] },
  { vendor: 'ai21', brand: 'AI21 Jamba', fallback: ['jamba-1.6-large', 'jamba-1.6-mini', 'jamba-1.5-large'] },
  // 2026-09-20 n13a 平台补齐 11 家(Azure OpenAI 走专有 deployment 协议,不适用本通用 UI)
  { vendor: 'longcat', brand: 'LongCat 美团', fallback: ['LongCat-Flash-Chat', 'LongCat-Flash-Thinking'] },
  { vendor: 'sensenova', brand: '商汤 SenseNova', fallback: ['SenseChat-5', 'SenseNova-V6-Turbo', 'SenseChat-Turbo'] },
  { vendor: 'upstage', brand: 'Upstage Solar', fallback: ['solar-pro2', 'solar-pro', 'solar-mini'] },
  { vendor: 'hyperbolic', brand: 'Hyperbolic', fallback: ['meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'] },
  { vendor: 'novita', brand: 'Novita AI', fallback: ['meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-v3', 'qwen/qwen-2.5-72b-instruct'] },
  { vendor: 'nebius', brand: 'Nebius AI Studio', fallback: ['meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct-fast'] },
  { vendor: 'writer', brand: 'Writer Palmyra', fallback: ['palmyra-x5', 'palmyra-x-004', 'palmyra-med'] },
  { vendor: 'lambda', brand: 'Lambda Cloud', fallback: ['hermes3-70b', 'llama3.3-70b-instruct-hermes2-pro', 'llama3.1-nemotron-70b-instruct'] },
  { vendor: 'sambanova', brand: 'SambaNova', fallback: ['Meta-Llama-3.3-70B-Instruct', 'DeepSeek-R1-Distill-Llama-70B', 'Qwen2.5-72B-Instruct'] },
  { vendor: 'ppio', brand: 'PPIO 派欧云', fallback: ['qwen/qwen2.5-72b-instruct', 'deepseek/deepseek-v3/community', 'meta-llama/llama-3.1-70b-instruct'] },
  { vendor: 'meta', brand: 'Meta Llama', fallback: ['Llama-4-Maverick-17B-128E-Instruct-FP8', 'Llama-4-Scout-17B-16E-Instruct', 'Llama-3.3-70B-Instruct'] },
  // 2026-09-20 n14b 平台补齐 10 家(Voyage/Jina 仅 embeddings 无 chat,不适用本通用 UI)
  { vendor: 'hf', brand: 'Hugging Face Router', fallback: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3'] },
  { vendor: 'featherless', brand: 'Featherless AI', fallback: ['meta-llama/Meta-Llama-3.1-8B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-R1'] },
  { vendor: 'kluster', brand: 'Kluster AI', fallback: ['klusterai/Meta-Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct'] },
  { vendor: 'chutes', brand: 'Chutes', fallback: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct'] },
  { vendor: 'parasail', brand: 'Parasail AI', fallback: ['meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'] },
  { vendor: 'ovh', brand: 'OVHcloud AI', fallback: ['Meta-Llama-3.1-8B-Instruct', 'Qwen2.5-72B-Instruct', 'mistral-nemo-instruct-2407'] },
  { vendor: 'baseten', brand: 'Baseten', fallback: ['deepseek-ai/DeepSeek-V3-0324', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct', 'Qwen/Qwen3-235B-A22B'] },
  { vendor: 'ollama', brand: 'Ollama 本地', fallback: ['llama3.2', 'qwen2.5', 'deepseek-r1'] },
  { vendor: 'skywork', brand: 'Skywork 天工', fallback: ['T1', 'skywork-13b-8k-open', 'V3'] },
  { vendor: 'openbmb', brand: 'OpenBMB 面壁', fallback: ['MiniCPM4-8B', 'minicpm-o-2.6', 'MiniCPM3-4B'] },
  // 2026-09-21 n15a 平台补齐 19 家(官方 OpenAI 兼容端点;lmstudio/vllm/xinference 为本地/自托管)
  { vendor: 'bedrock', brand: 'AWS Bedrock', fallback: ['openai.gpt-oss-120b-1:0', 'anthropic.claude-sonnet-4-5-20250929-v1:0'] },
  { vendor: 'modelscope', brand: 'ModelScope 魔搭', fallback: ['Qwen/Qwen3-235B-A22B', 'deepseek-ai/DeepSeek-V3'] },
  { vendor: 'zai', brand: 'Z.ai 智谱国际', fallback: ['glm-5.3', 'glm-4.7'] },
  { vendor: 'minimaxintl', brand: 'MiniMax 国际', fallback: ['MiniMax-M3', 'MiniMax-M2.5', 'MiniMax-M2'] },
  { vendor: 'dashscopeintl', brand: 'DashScope 阿里国际', fallback: ['qwen3-max', 'qwen-plus', 'qwen-turbo'] },
  { vendor: 'byteplus', brand: 'BytePlus ModelArk', fallback: ['doubao-seed-1-6-250615', 'doubao-seed-1-6-flash-250615'] },
  { vendor: 'pangu', brand: 'Pangu 华为盘古', fallback: ['pangu-pro-moe'] },
  { vendor: 'internlm', brand: 'InternLM 书生', fallback: ['internlm3-latest'] },
  { vendor: 'infini', brand: 'Infini-AI 无问芯穹', fallback: ['deepseek-r1', 'qwen2.5-72b-instruct'] },
  { vendor: 'vercel', brand: 'Vercel AI Gateway', fallback: ['openai/gpt-5.1', 'anthropic/claude-sonnet-4.5'] },
  { vendor: 'scaleway', brand: 'Scaleway', fallback: ['glm-5.2', 'deepseek-v4-flash-0731', 'qwen3.6-35b-a3b'] },
  { vendor: 'friendli', brand: 'FriendliAI', fallback: ['meta-llama-3.3-70b-instruct'] },
  { vendor: 'nscale', brand: 'Nscale', fallback: ['deepseek-ai/DeepSeek-V3'] },
  { vendor: 'gmi', brand: 'GMI Cloud', fallback: ['deepseek-ai/deepseek-r1'] },
  { vendor: 'ubicloud', brand: 'Ubicloud', fallback: ['llama-3.1-8b-instruct'] },
  { vendor: 'inferencenet', brand: 'Inference.net', fallback: ['Qwen/Qwen2.5-72B-Instruct'] },
  { vendor: 'lmstudio', brand: 'LM Studio 本地', fallback: ['qwen2.5-7b-instruct'] },
  { vendor: 'vllm', brand: 'vLLM 自托管', fallback: ['Qwen/Qwen2.5-7B-Instruct'] },
  { vendor: 'xinference', brand: 'Xinference 自托管', fallback: ['qwen2.5-instruct'] },
]

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// OpenAI 原生响应 { choices: [{ message: { content } }] };content 为空时回退 reasoning_content(推理模型)
function extractChatText(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const choices = (data as { choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }> })
      .choices
    const message = choices?.[0]?.message
    if (typeof message?.content === 'string' && message.content.trim()) return message.content
    if (typeof message?.reasoning_content === 'string' && message.reasoning_content.trim())
      return message.reasoning_content
  }
  return ''
}

export const ChatGenOpenAICompat = React.memo(function ChatGenOpenAICompat() {
  const t = useTranslations('aiGeneration')
  const [vendor, setVendor] = React.useState<CompatVendor>(VENDORS[0]!)
  const [prompt, setPrompt] = React.useState('')
  const [model, setModel] = React.useState<string>(VENDORS[0]!.fallback[0]!)
  const [advanced, setAdvanced] = React.useState<ChatAdvancedValues>(CHAT_ADVANCED_DEFAULTS)
  const [answer, setAnswer] = React.useState('')
  const { models, isDynamic, isLoading } = useVendorModels(vendor.vendor, vendor.fallback)

  const mutation = useMutation({
    mutationFn: async (payload: {
      vendor: string
      body: Record<string, unknown>
    }) => {
      const res = await fetchApi<unknown>(`/api/ai/${payload.vendor}/chat`, {
        method: 'POST',
        body: JSON.stringify(payload.body),
      })
      if (!res.success) throw new Error(res.error)
      const text = extractChatText(res.data)
      if (!text) throw new Error(t('noResult'))
      return text
    },
    onSuccess: (text) => setAnswer(text),
    onError: (err: Error) => toast.error(err.message),
  })

  const onVendorChange = (vendorKey: string) => {
    const next = VENDORS.find((v) => v.vendor === vendorKey)
    if (!next) return
    setVendor(next)
    setAnswer('')
  }

  const onSubmit = () => {
    if (!prompt.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    mutation.mutate({
      vendor: vendor.vendor,
      body: {
        messages: [{ role: 'user', content: prompt.trim() }],
        model,
        ...parseChatAdvanced(advanced),
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('openaiCompatTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('openaiCompatSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t('vendor')}</Label>
          <Select value={vendor.vendor} onValueChange={onVendorChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VENDORS.map((v) => (
                <SelectItem key={v.vendor} value={v.vendor}>
                  {v.brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="compat-chat-prompt">{t('prompt')}</Label>
          <textarea
            id="compat-chat-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={4}
            className={TEXTAREA_CLS}
          />
        </div>
        <ModelSelect
          models={models}
          value={model}
          onChange={setModel}
          isDynamic={isDynamic}
          isLoading={isLoading}
        />
        <ChatAdvancedParams values={advanced} onChange={setAdvanced} />
        <Button onClick={onSubmit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generateText')}
        </Button>

        {answer ? (
          <div className="space-y-1">
            <div className="text-sm font-medium">{t('result')}</div>
            <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
              {answer}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
})

export default ChatGenOpenAICompat
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
