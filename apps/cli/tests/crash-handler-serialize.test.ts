// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 崩溃日志的 error 序列化接入回归(2026-09-26 立)。
 *
 * handleCrash 的归一改走唯一出口 serializeError 后,crash 报告的 Error 段
 * 必须带出 cause 链与截断标注(旧手写三元只有一层,cause 整条丢)。
 */
import { describe, expect, it } from 'vitest';
import { flattenErrorForReport, type CrashInfo } from '../src/crash-handler.js';
import { serializeError, type SerializedError } from '@ihui/types';

type Causable = Error & { cause?: unknown };

function makeInfo(error: SerializedError): CrashInfo {
  return {
    timestamp: '2026-09-26T00:00:00.000Z',
    timestampMs: 1,
    kind: 'uncaughtException',
    error,
    runtime: {
      nodeVersion: 'v24.0.0',
      platform: 'win32',
      arch: 'x64',
      pid: 1,
      cwd: 'C:\\',
      argv: ['node', 'ihui'],
    },
    version: '0.0.0-test',
  };
}

describe('crash 报告 Error 段(经唯一出口)', () => {
  it('message 可见 + cause 链逐层列出(旧手写归一只有一层,cause 全丢)', () => {
    const inner = new Error('disk full');
    inner.name = 'IOError';
    const outer = new Error('write failed');
    (outer as Causable).cause = inner;

    const lines = flattenErrorForReport(serializeError(outer));
    expect(lines).toContain('Name: Error');
    expect(lines).toContain('Message: write failed');
    expect(lines).toContain('Caused by: IOError: disk full');
  });

  it('深度封顶的链在截断处落标注行,不静默丢', () => {
    let node = new Error('c0');
    for (let i = 1; i < 9; i++) {
      const next = new Error(`c${String(i)}`);
      (next as Causable).cause = node;
      node = next;
    }
    const lines = flattenErrorForReport(serializeError(node));
    expect(lines.some((l) => l.includes('[truncated: deeper cause omitted]'))).toBe(true);
  });

  it('非 Error 崩溃输入也留 Name/Message 两行(报告形状稳定)', () => {
    const lines = flattenErrorForReport(serializeError('string thrown'));
    expect(lines).toContain('Name: NonThrownError');
    expect(lines).toContain('Message: string thrown');
  });

  it('makeInfo 编译面钉住 CrashInfo.error 已是 SerializedError(带 cause 的闭集)', () => {
    const info = makeInfo(serializeError(new Error('typed ok')));
    expect(info.error.message).toBe('typed ok');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
