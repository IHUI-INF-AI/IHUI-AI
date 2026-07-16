/**
 * 敏感数据脱敏 — 防止 API key / token / 密码泄露到 LLM 或审计日志。
 *
 * 灵感来源:grok-build 的安全设计(工具输出过滤)。
 * 策略:
 *   - 基于正则匹配常见敏感模式:OpenAI key、Bearer token、password=xxx、AWS key
 *   - 替换为 ***REDACTED***,保留前 4 字符便于定位
 *   - 不依赖外部库,纯字符串处理
 */

const SENSITIVE_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // OpenAI / Anthropic / StepFun / Agnes API key: sk-xxx (20+ 字符)
  { pattern: /\b(sk-[A-Za-z0-9_\-]{8})[A-Za-z0-9_\-]{12,}\b/g, replacement: '$1***REDACTED***' },
  // Bearer token: Bearer xxx
  { pattern: /(Bearer\s+[A-Za-z0-9_\-\.]{4})[A-Za-z0-9_\-\.]{8,}/gi, replacement: '$1***REDACTED***' },
  // password=xxx / password: xxx / "password":"xxx"
  { pattern: /(password\s*[:=]\s*"?)([^\s"',]{2})[^\s"',]{4,}/gi, replacement: '$1$2***REDACTED***' },
  // api_key=xxx / api_key: xxx
  { pattern: /(api[_-]?key\s*[:=]\s*"?)([A-Za-z0-9_\-]{2})[A-Za-z0-9_\-]{8,}/gi, replacement: '$1$2***REDACTED***' },
  // AWS access key: AKIA...
  { pattern: /\b(AKIA)[A-Z0-9]{12,}\b/g, replacement: '$1***REDACTED***' },
  // Authorization: Basic xxx
  { pattern: /(Authorization\s*:\s*Basic\s+)[A-Za-z0-9+/=]{8,}/gi, replacement: '$1***REDACTED***' },
];

export function redactSecrets(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = redactSecrets(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
