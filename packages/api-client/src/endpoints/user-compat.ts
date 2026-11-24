// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/**
 * 小程序兼容面(user-bind / user-profile)端点共享单源。
 *
 * 立因:这些路由由 apps/api 的 miniapp-compat-routes.ts 注册(前缀 /api,见 routes/index.ts:1132),
 * 后端在册但 packages/api-client 此前**没有对应封装**——端内薄封装 `apps/miniapp-taro/src/api/index.ts`
 * 各自拼字面量。注意:user.ts 里已有的 `bindPhone` 打的是 `/api/users/change-phone`(换绑已绑号),
 * 与这里 `/api/user/phone/bind`(账号原本无手机号时的首次绑定)是两条不同路由,故另起函数名,不复用。
 *
 * 每枚返回类型 T 逐字核对后端 `success(...)` 实参形状(2026-11-06 现读 miniapp-compat-routes.ts)。
 */

/** POST /api/user/phone/bind —— 真身 success({ bound: true, phone })(miniapp-compat-routes.ts:2446)。 */
export async function bindUserPhone(input: {
  phone: string
  code: string
}): Promise<ApiResult<{ bound: boolean; phone: string }>> {
  return fetchApi<{ bound: boolean; phone: string }>('/api/user/phone/bind', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** POST /api/user/email/bind —— 真身 success({ bound: true, email })(miniapp-compat-routes.ts:2483)。 */
export async function bindUserEmail(input: {
  email: string
  code: string
}): Promise<ApiResult<{ bound: boolean; email: string }>> {
  return fetchApi<{ bound: boolean; email: string }>('/api/user/email/bind', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** POST /api/user/realname —— 真身 success({ userUuid, realName, authStatus })(miniapp-compat-routes.ts:2551)。 */
export async function submitUserRealNameAuth(input: {
  realName: string
  idCard: string
  authSource?: string
}): Promise<ApiResult<{ userUuid: string; realName: string; authStatus: string }>> {
  return fetchApi<{ userUuid: string; realName: string; authStatus: string }>(
    '/api/user/realname',
    { method: 'POST', body: JSON.stringify(input) },
  )
}

/** PUT /api/user/avatar —— 真身 success({ avatar })(miniapp-compat-routes.ts:2391)。 */
export async function updateUserAvatar(
  avatar: string,
): Promise<ApiResult<{ avatar: string }>> {
  return fetchApi<{ avatar: string }>('/api/user/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatar }),
  })
}

/** PUT /api/user/nickname —— 真身 success({ nickname })(miniapp-compat-routes.ts:2405)。 */
export async function updateUserNickname(
  nickname: string,
): Promise<ApiResult<{ nickname: string }>> {
  return fetchApi<{ nickname: string }>('/api/user/nickname', {
    method: 'PUT',
    body: JSON.stringify({ nickname }),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
