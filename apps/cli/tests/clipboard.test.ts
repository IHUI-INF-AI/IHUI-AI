/**
 * 剪贴板工具测试 — 覆盖跨平台 read/write + 工具 schema + 错误处理。
 *
 * 测试策略:
 *   - 不依赖真实系统剪贴板状态(用 isClipboardAvailable 跳过端到端测试)
 *   - 重点测试工具 schema / 错误处理 / write 校验
 *   - readClipboard/writeClipboard 在 Windows CI 上做往返一致验证
 */
import { describe, it, expect } from 'vitest';
import {
  clipboard_read,
  clipboard_write,
  CLIPBOARD_TOOLS,
  readClipboard,
  writeClipboard,
  isClipboardAvailable,
} from '../src/tools/clipboard.js';

const SKIP_END_TO_END = !isClipboardAvailable();

describe('工具注册', () => {
  it('CLIPBOARD_TOOLS 包含 clipboard_read 和 clipboard_write 两个工具', () => {
    expect(CLIPBOARD_TOOLS.length).toBe(2);
    expect(CLIPBOARD_TOOLS[0]!.name).toBe('clipboard_read');
    expect(CLIPBOARD_TOOLS[1]!.name).toBe('clipboard_write');
  });
});

describe('clipboard_read 工具', () => {
  it('schema 正确:name/description/parameters/required', () => {
    expect(clipboard_read.name).toBe('clipboard_read');
    expect(clipboard_read.description).toContain('剪贴板');
    expect(clipboard_read.dangerLevel).toBe('read');
    expect(clipboard_read.required).toEqual([]);
  });

  it('当平台不支持剪贴板时返回友好错误', async () => {
    if (isClipboardAvailable()) return; // 跳过
    const result = await clipboard_read.execute({}, { workspacePath: '/tmp' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('无可用剪贴板工具');
  });

  it.skipIf(SKIP_END_TO_END)('实际读取剪贴板返回字符串(支持空剪贴板)', async () => {
    const result = await clipboard_read.execute({}, { workspacePath: '/tmp' });
    expect(result.success).toBe(true);
    expect(typeof result.output).toBe('string');
  });
});

describe('clipboard_write 工具', () => {
  it('schema 正确:required = ["text"],dangerLevel = "write"', () => {
    expect(clipboard_write.name).toBe('clipboard_write');
    expect(clipboard_write.required).toEqual(['text']);
    expect(clipboard_write.dangerLevel).toBe('write');
    expect(clipboard_write.parameters.text).toBeDefined();
  });

  it('缺少 text 参数返回错误', async () => {
    const result = await clipboard_write.execute({}, { workspacePath: '/tmp' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('text 参数');
  });

  it('text 不是字符串时返回错误', async () => {
    const result = await clipboard_write.execute({ text: 123 }, { workspacePath: '/tmp' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('text 参数');
  });

  it('空字符串写入也应成功', async () => {
    if (!isClipboardAvailable()) return;
    const result = await clipboard_write.execute({ text: '' }, { workspacePath: '/tmp' });
    expect(result.success).toBe(true);
  });

  it('超长文本应被截断但不报错', async () => {
    if (!isClipboardAvailable()) return;
    const longText = 'x'.repeat(50_000);
    const result = await clipboard_write.execute({ text: longText }, { workspacePath: '/tmp' });
    expect(result.success).toBe(true);
  });
});

describe('readClipboard / writeClipboard 底层函数', () => {
  it('isClipboardAvailable 返回 boolean', () => {
    const v = isClipboardAvailable();
    expect(typeof v).toBe('boolean');
  });

  it('readClipboard 返回字符串(失败时空字符串)', () => {
    const s = readClipboard();
    expect(typeof s).toBe('string');
  });

  it('writeClipboard 返回 boolean', () => {
    if (!isClipboardAvailable()) {
      expect(writeClipboard('test')).toBe(false);
      return;
    }
    const ok = writeClipboard('ihui-clipboard-test');
    expect(typeof ok).toBe('boolean');
  });

  it.skipIf(SKIP_END_TO_END)('writeClipboard + readClipboard 往返一致(Windows/macOS/Linux)', () => {
    const testText = `ihui-test-${Date.now()}-中文测试`;
    const ok = writeClipboard(testText);
    expect(ok).toBe(true);
    const read = readClipboard();
    expect(read).toBe(testText);
  });
});
