// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-036 回归:`redactUrl` 遇畸形百分号编码不得抛 URIError。
 *
 * 缺陷形态:`?%ZZ=1` / `?%E0%A4%A=1` / `?%=1` 这类 key 进入 `decodeURIComponent`
 * 直接抛 `URIError: URI malformed`,`auditLog` 无 catch ⇒ 审计写入中断。
 * 判据:畸形 key 原样保留、同一 URL 中其余敏感参数照常脱敏、正常 URL 行为不变。
 */
import { describe, expect, it } from 'vitest';
import { redactSecrets, redactUrl } from '../src/redact.js';

describe('F-036 redactUrl 畸形百分号编码', () => {
  it.each([
    ['http://x/?%ZZ=1'],
    ['http://x/?%E0%A4%A=1'],
    ['http://x/?%=1'],
    ['https://example.com/path?a=%&b=%E0%A4%A'],
  ])('畸形编码不抛异常且原样保留: %s', (input) => {
    expect(() => redactUrl(input)).not.toThrow();
    expect(redactUrl(input)).toBe(input);
  });

  it('畸形 key 不中断同一 URL 中其他敏感参数的脱敏', () => {
    expect(redactUrl('http://x/?%ZZ=1&token=abcdef')).toBe('http://x/?%ZZ=1&token=***REDACTED***');
  });

  it('redactSecrets 顶层出口同样不抛异常', () => {
    expect(() => redactSecrets('http://x/?%E0%A4%A=1')).not.toThrow();
    expect(redactSecrets('http://x/?%E0%A4%A=1')).toBe('http://x/?%E0%A4%A=1');
  });

  it('正常 URL 行为不变(敏感参数脱敏、非敏感参数保留)', () => {
    expect(redactUrl('http://x/?access_token=abc')).toBe('http://x/?access_token=***REDACTED***');
    expect(redactUrl('http://x/?q=1&api_key=k')).toBe('http://x/?q=1&api_key=***REDACTED***');
    expect(redactUrl('http://x/?q=1')).toBe('http://x/?q=1');
  });

  it('合法百分号编码的敏感 key 仍能识别', () => {
    expect(redactUrl('http://x/?%74oken=abc')).toBe('http://x/?%74oken=***REDACTED***');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
