// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端接入配置拼装层(2026-11-18 立)。
 *
 * 立因:qoder2api 系网关把「选客户端 × 出口区域 × 本机/局域网 × 端口 × Key × 模型名」
 * 拼成一份可粘贴配置,只在前端做(不发网络请求)。本仓此前没有这一格 —— 用户接入只能
 * 照着文档手抄,抄错 base_url 或漏 env 键就是一次"接不通"工单。
 *
 * 本模块把拼装放到**后端纯函数**,好处是对照程序没有的:
 *   ① 单一真相源 —— web / CLI / 移动端 / 客服话术共用同一份输出,不再各抄一遍;
 *   ② 可测 —— 每种客户端 × 每种形态都有断言,文案错一个字测试就红;
 *   ③ 可审计 —— 拼了哪些键、漏了什么前置条件,随响应一起返回(warnings)。
 *
 * 纪律:
 * - **不猜端点**:baseUrl 必须由调用方传入(来自实际部署),本模块不内置任何域名常量。
 * - **不落 key**:纯函数,key 只进输出体,不写日志、不进任何存储。
 * - 判不了客户端 ⇒ ok:false + 支持清单(不静默拼一份错配置)。
 */

/** 支持的客户端(新增一种必须同笔加进这里与 `PRESET_ORDER`) */
export const CLIENT_PRESETS = [
  'openai-sdk',
  'codex-cli',
  'claude-code',
  'chatbox',
  'cherry-studio',
  'nextchat',
  'curl',
] as const
export type ClientPreset = (typeof CLIENT_PRESETS)[number]

export const PRESET_LABELS: Readonly<Record<ClientPreset, string>> = {
  'openai-sdk': 'OpenAI SDK',
  'codex-cli': 'Codex CLI',
  'claude-code': 'Claude Code',
  chatbox: 'Chatbox',
  'cherry-studio': 'Cherry Studio',
  nextchat: 'NextChat',
  curl: 'cURL',
}

export interface ClientConfigInput {
  client: string
  /** 网关基址,必须由调用方给出(形如 https://host 或 http://192.168.1.10:8790) */
  baseUrl: string
  /** 该 Key 对应的模型名;缺省时提示"未指定模型"但仍可生成 */
  apiKey: string
  model?: string
  /** 出口区域标签(cn/global);仅用于文案,不改变端点 */
  region?: string | null
}

export type ConfigFormat = 'json' | 'env' | 'shell' | 'text'

export type ClientConfigResult =
  | {
      ok: true
      client: ClientPreset
      clientLabel: string
      format: ConfigFormat
      /** 可直接粘贴的正文 */
      body: string
      /** 前置条件/易错点(拼装时发现的风险,不是错误) */
      warnings: string[]
    }
  | {
      ok: false
      code: 'unknown-client' | 'missing-base-url' | 'missing-api-key'
      reason: string
      supported: ClientPreset[]
    }

function normalizeBaseUrl(raw: string): string {
  let v = raw.trim()
  if (!v) return ''
  // 去掉尾部斜杠,协议必须显式(不猜 https)
  v = v.replace(/\/+$/, '')
  return v
}

function endOf(base: string, path: string): string {
  return `${base}${path}`
}

function isPreset(v: string): v is ClientPreset {
  return (CLIENT_PRESETS as readonly string[]).includes(v)
}

/**
 * 拼装一份配置。纯函数:同输入恒等同输出,不做任何 IO。
 */
export function buildClientConfig(input: ClientConfigInput): ClientConfigResult {
  const client = typeof input?.client === 'string' ? input.client.trim().toLowerCase() : ''
  if (!isPreset(client)) {
    return {
      ok: false,
      code: 'unknown-client',
      reason: `不支持的客户端「${input?.client ?? ''}」;请从支持清单里选一种`,
      supported: [...CLIENT_PRESETS],
    }
  }

  const base = normalizeBaseUrl(input?.baseUrl ?? '')
  if (!base) {
    return {
      ok: false,
      code: 'missing-base-url',
      reason:
        'baseUrl 为空:本模块不内置任何域名(猜错一次就是"接不通"),请传实际部署地址:' +
        '本机用 http://127.0.0.1:<端口>,局域网用 http://<内网IP>:<端口>',
      supported: [...CLIENT_PRESETS],
    }
  }
  if (!/^https?:\/\//i.test(base)) {
    return {
      ok: false,
      code: 'missing-base-url',
      reason: `baseUrl 缺协议头「${base}」:必须显式写 http:// 或 https://(模块不替你猜)`,
      supported: [...CLIENT_PRESETS],
    }
  }

  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : ''
  if (!apiKey) {
    return {
      ok: false,
      code: 'missing-api-key',
      reason: 'apiKey 为空:先到 Key 池签发一枚,再回来生成配置',
      supported: [...CLIENT_PRESETS],
    }
  }

  const model = typeof input?.model === 'string' ? input.model.trim() : ''
  const warnings: string[] = []
  if (!model) warnings.push('未指定模型:客户端会走默认模型或首项,建议显式填上以免接错模型')
  if (/^http:\/\//i.test(base) === false && !base.startsWith('https://')) {
    warnings.push('基址不是 https:浏览器类客户端可能因混合内容拦截;本机直连可忽略')
  }

  const clientLabel = PRESET_LABELS[client]
  const chatUrl = endOf(base, '/v1/chat/completions')

  switch (client) {
    case 'openai-sdk':
      return {
        ok: true,
        client,
        clientLabel,
        format: 'json',
        body: JSON.stringify(
          {
            baseURL: base,
            apiKey: '${API_KEY}',
            ...(model ? { defaultModel: model } : {}),
          },
          null,
          2,
        ),
        warnings: [...warnings, '把 ${API_KEY} 换成你的 Key(此处刻意不替你回显真 Key,防止截图外泄)'],
      }

    case 'codex-cli':
      return {
        ok: true,
        client,
        clientLabel,
        format: 'env',
        body: [
          `OPENAI_BASE_URL=${base}`,
          `OPENAI_API_KEY=${apiKey}`,
          model ? `OPENAI_MODEL=${model}` : '# OPENAI_MODEL 未指定:Codex 会用默认模型',
        ].join('\n'),
        warnings: [
          ...warnings,
          'Codex CLI 用 Responses API 时 base_url 指到站点根即可,客户端自己拼 /v1/responses',
        ],
      }

    case 'claude-code':
      return {
        ok: true,
        client,
        clientLabel,
        format: 'env',
        body: [
          `ANTHROPIC_BASE_URL=${base}`,
          `ANTHROPIC_AUTH_TOKEN=${apiKey}`,
          model ? `ANTHROPIC_MODEL=${model}` : '# ANTHROPIC_MODEL 未指定:Claude Code 会用默认模型',
        ].join('\n'),
        warnings: [...warnings, 'Claude Code 走 anthropic 协议面:若该网关未开 anthropic 适配,请改用 OpenAI 兼容通道'],
      }

    case 'chatbox':
    case 'cherry-studio':
    case 'nextchat':
      return {
        ok: true,
        client,
        clientLabel,
        format: 'text',
        body: [
          `接口地址: ${base}`,
          `API Key: ${apiKey}`,
          `模型: ${model || '(未指定)'}`,
          `协议: OpenAI 兼容 (Chat Completions)`,
        ].join('\n'),
        warnings: [
          ...warnings,
          '「接口地址」填到站点根(不要自己再加 /v1/chat/completions,客户端会拼)',
        ],
      }

    case 'curl':
      return {
        ok: true,
        client,
        clientLabel,
        format: 'shell',
        body: [
          `curl '${chatUrl}' \\`,
          `  -H 'Content-Type: application/json' \\`,
          `  -H 'Authorization: Bearer ${apiKey}' \\`,
          `  -d '${JSON.stringify({ model: model || '你的模型名', messages: [{ role: 'user', content: 'ping' }] })}'`,
        ].join('\n'),
        warnings: [
          ...warnings,
          '这是最小连通性探针:返回 200 且 body 里有 choices 才算通;401 是 Key 无效,404 多半是 baseUrl 或路径多/少了一段',
        ],
      }

    default: {
      // 类型上不可达(上面 isPreset 已收窄),留一行给未来新增档位漏写时兜底
      const exhaustive: never = client
      return {
        ok: false,
        code: 'unknown-client',
        reason: `未实现的客户端档位:${String(exhaustive)}`,
        supported: [...CLIENT_PRESETS],
      }
    }
  }
}

/** 供 UI 渲染的预设清单(与 `CLIENT_PRESETS` 同源,不另抄) */
export function listClientPresets(): Array<{ value: ClientPreset; label: string }> {
  return CLIENT_PRESETS.map((value) => ({ value, label: PRESET_LABELS[value] }))
}

export const __test__ = { normalizeBaseUrl, endOf, responsesUrlOf: (base: string) => endOf(base, '/v1/responses') }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
