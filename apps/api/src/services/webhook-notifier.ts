/**
 * Webhook 通知发送服务(钉钉/飞书/企业微信机器人)
 *
 * 设计要点:
 * - 使用 globalThis.fetch(Node 18+ 内置),无额外依赖
 * - 所有请求 10s 超时(AbortController)
 * - 钉钉加签:HMAC-SHA256(timestamp + "\n" + secret) → base64 → URL encode
 * - 失败统一返回 { ok: false, error: '错误信息' },成功返回 { ok: true }
 */
import { createHmac } from 'node:crypto'
import type { ChannelConfig, DingtalkMessage, FeishuMessage, WechatWorkMessage } from '@ihui/types'

/** 请求超时时间(毫秒) */
const REQUEST_TIMEOUT_MS = 10_000

/** 统一返回结果 */
export type WebhookResult = { ok: boolean; error?: string }

/**
 * 发送 HTTP 请求并解析 JSON 响应,带 10s 超时
 * @param url 请求地址
 * @param body 请求体对象
 * @returns 解析后的 JSON 响应
 */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`响应非 JSON: ${text.slice(0, 200)}`)
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 计算钉钉加签
 * 算法:HMAC-SHA256(timestamp + "\n" + secret) → base64 → URL encode
 * @param timestamp 毫秒时间戳
 * @param secret 钉钉机器人加签密钥
 * @returns URL 编码后的签名字符串
 */
function signDingtalk(timestamp: number, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`
  const hmac = createHmac('sha256', secret).update(stringToSign).digest('base64')
  return encodeURIComponent(hmac)
}

/**
 * 发送钉钉机器人消息
 * 文档:https://open.dingtalk.com/document/robots/custom-robot-access
 */
export async function sendDingtalk(
  config: ChannelConfig,
  msg: DingtalkMessage,
): Promise<WebhookResult> {
  if (!config.webhookUrl) {
    return { ok: false, error: '钉钉 webhookUrl 未配置' }
  }
  try {
    let url = config.webhookUrl
    // 启用加签时附加 timestamp 和 sign
    if (config.secret) {
      const timestamp = Date.now()
      const sign = signDingtalk(timestamp, config.secret)
      url = `${url}&timestamp=${timestamp}&sign=${sign}`
    }
    const resp = await postJson<{ errcode: number; errmsg: string }>(url, msg)
    if (resp.errcode === 0) {
      return { ok: true }
    }
    return { ok: false, error: `钉钉错误[${resp.errcode}]: ${resp.errmsg}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 发送飞书机器人消息
 * 文档:https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/bot-v2/add-custom-bot
 */
export async function sendFeishu(
  config: ChannelConfig,
  msg: FeishuMessage,
): Promise<WebhookResult> {
  if (!config.webhookUrl) {
    return { ok: false, error: '飞书 webhookUrl 未配置' }
  }
  try {
    const resp = await postJson<{
      StatusCode?: number
      StatusMessage?: string
      code?: number
      msg?: string
    }>(config.webhookUrl, msg)
    // 飞书成功返回 { StatusCode: 0, StatusMessage: 'success' } 或 { code: 0, msg: 'success' }
    if (resp.StatusCode === 0 || resp.code === 0) {
      return { ok: true }
    }
    const errMsg = resp.StatusMessage || resp.msg || JSON.stringify(resp)
    const errCode = resp.StatusCode ?? resp.code ?? 'unknown'
    return { ok: false, error: `飞书错误[${errCode}]: ${errMsg}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 发送企业微信机器人消息
 * 文档:https://developer.work.weixin.qq.com/document/path/91770
 */
export async function sendWechatWork(
  config: ChannelConfig,
  msg: WechatWorkMessage,
): Promise<WebhookResult> {
  if (!config.webhookUrl) {
    return { ok: false, error: '企业微信 webhookUrl 未配置' }
  }
  try {
    const resp = await postJson<{ errcode: number; errmsg: string }>(config.webhookUrl, msg)
    if (resp.errcode === 0) {
      return { ok: true }
    }
    return { ok: false, error: `企业微信错误[${resp.errcode}]: ${resp.errmsg}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 统一发送入口,根据 config.channel 路由到对应渠道
 * @param config 渠道配置
 * @param content 文本内容
 * @param title 可选标题(用于 markdown 消息)
 */
export async function sendWebhookNotification(
  config: ChannelConfig,
  content: string,
  title?: string,
): Promise<WebhookResult> {
  switch (config.channel) {
    case 'dingtalk': {
      const msg: DingtalkMessage = title
        ? { msgtype: 'markdown', markdown: { title, text: content } }
        : { msgtype: 'text', text: { content } }
      return sendDingtalk(config, msg)
    }
    case 'feishu': {
      const msg: FeishuMessage = {
        msg_type: 'text',
        content: { text: title ? `${title}\n${content}` : content },
      }
      return sendFeishu(config, msg)
    }
    case 'wechat': {
      const msg: WechatWorkMessage = title
        ? { msgtype: 'markdown', markdown: { content: `## ${title}\n${content}` } }
        : { msgtype: 'text', text: { content } }
      return sendWechatWork(config, msg)
    }
    case 'sms':
    case 'email':
    case 'notification':
    case 'push':
      return { ok: false, error: `渠道 ${config.channel} 非 webhook 通道,请使用对应发送服务` }
    default:
      return { ok: false, error: `不支持的渠道: ${String(config.channel)}` }
  }
}
