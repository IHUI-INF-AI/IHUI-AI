// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 派发器台账落点 — 沙箱隔离的唯一判据
// =============================================================================
// 立因(2026-11-03):bridge 的沙箱此前只隔离了 LOG_FILE / STATE_FILE / UNDEL / retry-pending,
// 而品牌派发器把台账写死在主仓 `.ihui-agent/state/mail-send-ledger.jsonl`,与 STATE_FILE 无关。
// 结果是测试探针邮件(example.invalid / example.com、故障注入 SMTP/Resend)的 8 条 failed
// 被记进生产台账 —— 量的器物把演练数成了事故。
//
// 判据两档(不可回退):
//   ① 显式 IHUI_MAIL_SEND_LEDGER 一律优先,本模块**绝不覆盖**用户已设的值;
//   ② STATE_FILE 被重定向(≠ 生产默认)⇒ 台账自动跟随其同目录;
//      STATE_FILE 为默认值 ⇒ 不注入,派发器保持生产默认路径(生产行为一字不变)。
// 必须在 spawn 派发器之前生效 —— 派发器是子进程,只认继承到的环境变量。
// =============================================================================
'use strict'

const path = require('path')

/** bridge 的生产默认状态文件;台账跟随判据以它为准(唯一一份,不在别处另写) */
const DEFAULT_STATE_FILE = 'D:\\DevEnv\\state\\alert-bridge-state.json'

/**
 * 解析需要注入给派发器的台账路径。
 * @param {Record<string, string | undefined>} env 进程环境(或测试夹具)
 * @param {string} stateFile 实际生效的 STATE_FILE
 * @param {string} defaultStateFile 生产默认 STATE_FILE
 * @returns {string | null} null = 不注入(派发器走自己的生产默认路径)
 */
function resolveMailSendLedgerEnv(env, stateFile, defaultStateFile = DEFAULT_STATE_FILE) {
  const explicit = String((env && env.IHUI_MAIL_SEND_LEDGER) || '').trim()
  if (explicit) return explicit
  if (stateFile !== defaultStateFile) {
    return path.join(path.dirname(stateFile), 'mail-send-ledger.jsonl')
  }
  return null
}

/** 收件人脱敏:只留前 2 位 + 域名(如 50***@qq.com);无 @ 一律全遮,绝不回显原文 */
function maskMailRecipient(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const at = text.indexOf('@')
  if (at <= 0) return '***'
  return `${text.slice(0, Math.min(2, at))}***${text.slice(at)}`
}

module.exports = { DEFAULT_STATE_FILE, resolveMailSendLedgerEnv, maskMailRecipient }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
