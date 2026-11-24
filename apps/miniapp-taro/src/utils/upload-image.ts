// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import Taro from '@tarojs/taro'
import { getExt } from '@ihui/shared/utils/file-helpers'
import { joinUrl } from '@ihui/shared/utils/image-helpers'
import { refreshAccessTokenOnce } from '@ihui/api-client'
import { classifyRefreshFailureStatus } from '@ihui/shared/auth/auto-login-policy'
import { shouldRefreshNow } from '@ihui/shared/auth/auto-refresh'
import { BASE_URL } from './api-config'
import { getToken } from './auth'

interface UploadResult {
  url: string
  fileName: string
}

/** `Taro.uploadFile` 的一次应答(状态码原样带出,判据只在"是不是凭据被否定"这一处用) */
interface UploadReply {
  statusCode: number
  data: string
}

/**
 * 直连上传的凭据兜带(2026-10-26 立,与 mobile-rn 端 lib/token 的 runWithFreshToken 同一口径)。
 *
 * 病灶:`Taro.uploadFile` 没有全局 fetch,拿不到 api-client 的 401 重放 —— 它带的是
 * `getToken()` 现值,access token 只有 15 分钟,过期后每次上传都直接 reject("上传失败(401)"),
 * 而且**不会自愈**(小程序的 401 拦截器只管 REST 那条腿,这一腿绕过了它)。
 *
 * 判据一律复用现成的,端内不写第二份:
 * - "该不该现在就续期" = `@ihui/shared/auth/auto-refresh` 的 `shouldRefreshNow`(剩余 ≤ 5 分钟)
 * - "这个状态码算不算服务端否定凭据" = `@ihui/shared/auth/auto-login-policy` 的
 *   `classifyRefreshFailureStatus`(401/403 ⇒ rejected;其余含网络失败/5xx/REFRESH_TOKEN_STALE ⇒ transient)
 * - "怎么续期" = `@ihui/api-client` 的 `refreshAccessTokenOnce()`(全局单飞,与 REST 的 401
 *   拦截器同一个刷新源;app.tsx 已 bindTokenStoreToApiClient(tokenStore,{refreshAccessToken}))
 *
 * 下面三个出口是**导出**的:端内另一条自持凭据的直连腿
 * (`src/pkg-ai/ai/conversation-import-transport.ts` 的 /parse 上传)复用同一份实现 ——
 * 它保留自己的 `Taro.uploadFile`(字段/超时/formData 不同),但**不另起一套 401 判据**
 * (§0.6 单一真相源:同类判据第二份必然漂移)。
 *
 * 红线(刻意写在判据旁边):三条出口都**只读不写凭据** —— 续期失败、状态码判不出、
 * 重试仍被拒,一律不许 clearToken / expireSession。瞬时失败销毁凭据这一型本仓刚修过。
 */
export async function freshUploadToken(): Promise<string> {
  const current = getToken()
  if (!current) return current
  if (!shouldRefreshNow(current)) return current
  const fresh = await refreshOnceLoudly()
  return fresh ?? getToken() ?? current
}

async function refreshOnceLoudly(): Promise<string | null> {
  try {
    return await refreshAccessTokenOnce()
  } catch (e) {
    console.warn(
      `[miniapp-upload] refresh failed, retrying with the current token (credentials untouched): ` +
        `${e instanceof Error ? e.message : 'unknown error'}`,
    )
    return null
  }
}

/** 从响应体里取业务 errorCode(有就交给分型判据,解不出就传 undefined,不猜) */
function errorCodeFromPayload(data: string): string | undefined {
  try {
    const body = JSON.parse(data) as { errorCode?: unknown }
    return typeof body?.errorCode === 'string' ? body.errorCode : undefined
  } catch {
    return undefined
  }
}

/** 判据②:这一发应答算不算"服务端否定了发出去的凭据"(唯一口径 = classifyRefreshFailureStatus)。 */
export function isCredentialRejectedReply(reply: { statusCode: number; data: string }): boolean {
  return (
    classifyRefreshFailureStatus(reply.statusCode, errorCodeFromPayload(reply.data)) === 'rejected'
  )
}

/** 判据③:凭据被否定后要不要重试的唯一依据 —— 续期一次,给出重发该用的凭据(调用方自己保证只发第二发)。 */
export async function refreshedTokenAfterRejection(): Promise<string> {
  const fresh = await refreshOnceLoudly()
  return fresh ?? getToken()
}

/**
 * 上传一发改一次凭据兜带:新鲜度前置 + 被否定只重试一次。
 *
 * @returns 最终那一发的原始应答(状态码/响应体),失败判定交给各端点的 parse
 */
async function uploadWithFreshCredential(
  once: (token: string) => Promise<UploadReply>,
): Promise<UploadReply> {
  const first = await once(await freshUploadToken())
  // 2xx 与"不是凭据问题的失败"都不消耗重试额度(网络抖动不该去刷 /auth/refresh)
  if (!isCredentialRejectedReply(first)) return first
  // 只重试一次:续期后重发,仍失败就带着那次的状态码回调用方(可见错误,不静默)
  return await once(await refreshedTokenAfterRejection())
}

/** 单发上传(callback → promise);传输层失败 reject,HTTP 状态码原样 resolve */
function uploadFileOnce(opts: {
  fullUrl: string
  filePath: string
  fileName: string
  token: string
}): Promise<UploadReply> {
  return new Promise<UploadReply>((resolve, reject) => {
    Taro.uploadFile({
      url: opts.fullUrl,
      filePath: opts.filePath,
      name: 'file',
      fileName: opts.fileName,
      header: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
      success: (res) => resolve({ statusCode: res.statusCode, data: res.data }),
      fail: (err) => reject(err),
    })
  })
}

/** 应答 → 结果;非 2xx / code 非成功 / 非法 JSON 各给一条可展示原因(不静默成功) */
function readUploadReply(reply: UploadReply, fileName: string): UploadResult {
  if (reply.statusCode < 200 || reply.statusCode >= 300) {
    throw new Error(`上传失败(${reply.statusCode})`)
  }
  try {
    const body = JSON.parse(reply.data) as {
      code?: number
      data?: { url?: string }
      msg?: string
    }
    if (body.code === 0 || body.code === 200) {
      return { url: body.data?.url || '', fileName }
    }
    throw new Error(body.msg || '上传失败')
  } catch (e) {
    // 上面那条"业务码不对"抛的就是 Error,原样上屏;只有 JSON 解不出才兜成解析失败
    if (e instanceof SyntaxError) throw new Error('响应解析失败')
    throw e
  }
}

export function chooseImages(maxCount = 9): Promise<string[]> {
  return new Promise((resolve, reject) => {
    Taro.chooseImage({
      count: maxCount,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
        resolve(paths)
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '').toLowerCase()
        if (msg.includes('cancel')) {
          resolve([])
          return
        }
        reject(err)
      },
    })
  })
}

export async function uploadImage(filePath: string, url = '/files/upload'): Promise<UploadResult> {
  const ext = getExt(filePath)
  const fileName = `img_${Date.now()}.${ext}`
  const fullUrl = joinUrl(BASE_URL, url)

  const reply = await uploadWithFreshCredential((token) =>
    uploadFileOnce({ fullUrl, filePath, fileName, token }),
  )
  return readUploadReply(reply, fileName)
}

export async function uploadPictures(maxCount = 9, url = '/files/upload'): Promise<UploadResult[]> {
  const paths = await chooseImages(maxCount)
  const results: UploadResult[] = []
  for (const p of paths) {
    results.push(await uploadImage(p, url))
  }
  return results
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
