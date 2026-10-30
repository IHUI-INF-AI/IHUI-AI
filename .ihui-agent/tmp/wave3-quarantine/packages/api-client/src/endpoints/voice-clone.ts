// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 声纹库(voice clone)端点封装 —— web `/voices` 页的跨端取数出口。
 *
 * **后端落点不在 apps/api,而在 ai-service(FastAPI)**,取证:
 * - `apps/ai-service/app/routers/voice_tts.py:275` GET `/voice/voices` → 裸 JSON
 *   `{ "voices": [...], "count": N }`(无 `{code,data}` 信封)
 * - `apps/ai-service/app/routers/voice_tts.py:290` POST `/voice/voices`(multipart 字段 `file`)
 *   → `token6688_provider.py:610-647` 的返回:`{ "voice": {...}, "raw": {...} }`(有 task_id 时)
 *   或上游原样 JSON(无 task_id 时);官方硬限制 = 仅 MP3/M4A/WAV、严格 <20MiB、时长 10~300s
 * - `apps/ai-service/app/routers/voice_tts.py:313` GET `/voice/voices/{voice_id}` → 单条裸 JSON
 * - `apps/ai-service/app/routers/voice_tts.py:327` DELETE `/voice/voices/{voice_id}`
 *   → `Depends(_require_admin)`:**仅 admin(roleId>=1)**,非管理员 403;成功回 provider 结果
 * - 路由前缀:`apps/ai-service/app/main.py:1033` `include_router(voice_tts.router, prefix="/api")`
 * - web 侧同源可达的原因 = Next 重写代理:`apps/web/next.config.ts:370-371`
 *   `/api/voice/:path*` → ai-service;**apps/api 未注册 `/api/voice/*`**
 *   (`apps/api/src/routes/index.ts:568` 只注册了 `/api/voice-notes`,是另一回事)。
 *
 * 因此 `baseUrl` 是**必填**参数:调用方传"能兑现 /api/voice/* 的那一侧基址"
 * - web/桌面:同源空串或 web 源(重写代理)
 * - mobile-rn:web 源(`apps/mobile-rn/src/lib/config.ts:100` WEB_BASE_URL),与
 *   `apps/mobile-rn/src/screens/VoiceSttScreen.tsx:118` 走 STT 时同一个口径
 * 走 `fetchAiServiceJson`(`packages/api-client/src/client.ts:1170`):它把整个响应体当 data
 * (ai-service 无 `{code,data}` 信封),并在 401 时静默续期后重放一次。
 */

import type { ApiResult } from '@ihui/types'

import { fetchAiServiceJson } from '../client.js'

/** 列表行(provider 原始字段为 snake_case,后端不裁剪,故保留索引签名)。 */
export interface VoiceCloneItem {
  voice_id?: string
  id?: string
  name?: string
  status?: string
  created_at?: string
  preview_url?: string
  audio_url?: string
  model?: string
  [key: string]: unknown
}

/** GET /api/voice/voices 的响应体。 */
export interface VoiceCloneListResult {
  voices: VoiceCloneItem[]
  count?: number
  ok?: boolean
}

/** POST /api/voice/voices 的响应体(provider 有 task_id 时形如 `{voice, raw}`)。 */
export interface VoiceCloneUploadResult {
  voice?: VoiceCloneItem
  raw?: unknown
  [key: string]: unknown
}

/** DELETE /api/voice/voices/:id 的响应体(provider 原样,含 ok/status/error)。 */
export interface VoiceCloneDeleteResult {
  ok?: boolean
  status?: string
  error?: string
  [key: string]: unknown
}

/** 所有函数共用的入参:目标基址。 */
export interface VoiceCloneRequestOptions {
  /** 兑现 `/api/voice/*` 的一侧基址(绝对 URL 或同源空前缀),见文件头注 */
  baseUrl: string
  /** 访问令牌;缺省取包内 tokenProvider 的当前值 */
  token?: string
}

function voicesPath(baseUrl: string, suffix = ''): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/voice/voices${suffix}`
}

/** 声纹库列表(克隆进行中时条目为非终态,调用方需轮询到终态)。 */
export function listVoiceClones(
  options: VoiceCloneRequestOptions,
): Promise<ApiResult<VoiceCloneListResult>> {
  return fetchAiServiceJson<VoiceCloneListResult>(voicesPath(options.baseUrl), {
    ...(options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : {}),
  })
}

/**
 * 上传参考音频建声纹(异步克隆任务)。
 * `form` 由调用方按端形态构造:web/桌面 `form.append('file', blob, name)`;
 * mobile-rn `form.append('file', { uri, type, name })`(原生 fetch 会读文件)。
 */
export function uploadVoiceClone(
  form: FormData,
  options: VoiceCloneRequestOptions,
): Promise<ApiResult<VoiceCloneUploadResult>> {
  return fetchAiServiceJson<VoiceCloneUploadResult>(voicesPath(options.baseUrl), {
    method: 'POST',
    body: form,
    timeoutMs: 120_000,
    ...(options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : {}),
  })
}

/** 单条声纹详情(确认克隆终态/取全部字段)。 */
export function getVoiceClone(
  voiceId: string,
  options: VoiceCloneRequestOptions,
): Promise<ApiResult<VoiceCloneItem>> {
  return fetchAiServiceJson<VoiceCloneItem>(
    voicesPath(options.baseUrl, `/${encodeURIComponent(voiceId)}`),
    {
      ...(options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : {}),
    },
  )
}

/** 删除声纹(后端 `_require_admin`:非 admin 一律 403,调用方不得把它当乐观成功)。 */
export function deleteVoiceClone(
  voiceId: string,
  options: VoiceCloneRequestOptions,
): Promise<ApiResult<VoiceCloneDeleteResult>> {
  return fetchAiServiceJson<VoiceCloneDeleteResult>(
    voicesPath(options.baseUrl, `/${encodeURIComponent(voiceId)}`),
    {
      method: 'DELETE',
      ...(options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : {}),
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
