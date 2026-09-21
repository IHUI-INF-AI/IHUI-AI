// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信小程序订阅消息发送服务。
 *
 * 订阅消息机制:用户在小程序内通过 requestSubscribeMessage 一次性授权后,
 * 后端方可通过 cgi-bin/message/subscribe/send 下发一条消息(发送后授权即消耗)。
 *
 * 依赖配置(.env):
 * - WX_MINI_APPID / WX_MINI_SECRET(复用 oauth-providers 的全局 access_token)
 * - WX_MINI_REMIND_TMPL_ID(微信公众平台 → 订阅消息 申请的模板 ID)
 */

import { and, eq, isNull, isNotNull } from 'drizzle-orm'
import { env } from 'node:process'
import { db } from '../db/index.js'
import { userThirdPartyAccounts } from '@ihui/database'
import { getAccessToken, isWechatMiniConfigured } from './oauth-providers.js'

/** 订阅消息下发结果(微信即使失败也返回 HTTP 200,需检查 body.errcode) */
export interface SubscribeSendResult {
  ok: boolean
  errcode?: number
  errmsg?: string
}

/** 订阅消息模板 data 字段值(微信对 thing 类型限 20 字符,超长截断) */
export type SubscribeMessageData = Record<string, { value: string }>

/** 催费提醒订阅是否已完整配置(小程序凭证 + 模板 ID) */
export function isSubscribeMessageConfigured(): boolean {
  return isWechatMiniConfigured() && Boolean(env.WX_MINI_REMIND_TMPL_ID)
}

/** 按 userId 反查小程序 openid(user_third_party_accounts, platform='wechat') */
export async function getWechatMiniOpenId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ openId: userThirdPartyAccounts.openId })
    .from(userThirdPartyAccounts)
    .where(
      and(
        eq(userThirdPartyAccounts.userId, userId),
        eq(userThirdPartyAccounts.platform, 'wechat'),
        isNotNull(userThirdPartyAccounts.openId),
        isNull(userThirdPartyAccounts.deletedAt),
      ),
    )
    .limit(1)
  return row?.openId ?? null
}

/** thing 类型字段 20 字符截断(微信订阅消息 thing.DATA 限制) */
function truncate20(text: string): string {
  return text.length > 20 ? `${text.slice(0, 19)}…` : text
}

/**
 * 构造催费模板 data。
 * 模板「待付款提醒」(priTmplId 经 addtemplate API 申请,2026-09-19):
 * 交易对象:{{thing8}} 订单内容:{{thing3}} 待付金额:{{amount4}} 备注:{{thing10}}
 * thing 类型限 20 字符;amount 格式为 数字+元。
 */
export function buildFeeReminderData(studentName: string, dueAmount: number): SubscribeMessageData {
  return {
    thing8: { value: truncate20(studentName) },
    thing3: { value: '学费催缴' },
    amount4: { value: `${dueAmount}元` },
    thing10: { value: truncate20(`尚有学费${dueAmount}元未缴清,请尽快缴费`) },
  }
}

/** 下发订阅消息(POST cgi-bin/message/subscribe/send) */
export async function sendSubscribeMessage(
  openId: string,
  data: SubscribeMessageData,
  page?: string,
): Promise<SubscribeSendResult> {
  const accessToken = await getAccessToken()
  const resp = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: openId,
        template_id: env.WX_MINI_REMIND_TMPL_ID,
        page,
        data,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!resp.ok) return { ok: false, errcode: resp.status, errmsg: 'http_error' }
  const body = (await resp.json()) as { errcode?: number; errmsg?: string }
  // errcode 0 为成功;43101 表示用户未订阅/授权已消耗完,属预期失败
  if (body.errcode === 0) return { ok: true }
  return { ok: false, errcode: body.errcode, errmsg: body.errmsg }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
