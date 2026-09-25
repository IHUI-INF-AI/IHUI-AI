// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 日志脱敏(2026-09-26 立)。
 *
 * 审计铁律:PAT 绝不落日志。所有 automations 日志必须经 makeAuditLogger 出口,
 * 它在写日志前对 msg 与序列化后的 meta 做 secrets 替换(redact)。
 */

import type { AuditLogger } from './types.js'

/**
 * 把 text 中出现的每个 secret 替换为 ***REDACTED***。
 * 顺序无关;空 secret 忽略。用于日志出口与错误消息出口的统一兜底。
 */
export function redactSecrets(text: string, secrets: string[]): string {
  let out = text
  for (const secret of secrets) {
    if (secret && out.includes(secret)) {
      out = out.split(secret).join('***REDACTED***')
    }
  }
  return out
}

/**
 * 构造带脱敏的审计 logger:msg 与 meta(JSON 序列化后)都过 redact,
 * 再交给底层 base logger(生产为 utils/logger 的 pino 封装)。
 */
export function makeAuditLogger(secrets: string[], base: AuditLogger): AuditLogger {
  const scrub = (msg: string, meta?: object): [string, object | undefined] => {
    const safeMsg = redactSecrets(msg, secrets)
    if (meta === undefined) return [safeMsg, undefined]
    const raw = JSON.stringify(meta) ?? ''
    return [safeMsg, { detail: redactSecrets(raw, secrets) }]
  }
  return {
    info: (msg, meta) => {
      const [m, mm] = scrub(msg, meta)
      base.info(m, mm)
    },
    warn: (msg, meta) => {
      const [m, mm] = scrub(msg, meta)
      base.warn(m, mm)
    },
    error: (msg, meta) => {
      const [m, mm] = scrub(msg, meta)
      base.error(m, mm)
    },
  }
}
