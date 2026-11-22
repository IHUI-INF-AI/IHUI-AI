// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-729:REPL 上屏的工具入参摘要必须"先脱敏、再按码点截断"。
 *
 * 三条判据成对钉住(阳性对照 / 反向对照 / 截断口径):
 *   ① 入参里埋着 sk- / Bearer / JWT / 键名型凭据 / 用户机器绝对路径 ⇒ 上屏串与回看串都不含它们;
 *   ② 普通无害入参逐字不被改坏(display 就是 JSON.stringify(args),不裁字符、不改大小写);
 *   ③ 截断切在代理对中间时不得产出孤立半对(UTF-16 `.slice` 的旧缺陷)。
 * 只 import 投影出口本身(`projectToolArgsForScreen`),不驱动整个 REPL 会话。
 */
import { describe, expect, it } from 'vitest';
import * as os from 'node:os';
import { NO_ARGS_PLACEHOLDER, TOOL_ARGS_DISPLAY_MAX_CODEPOINTS, projectToolArgsForScreen } from '../src/commands/repl.js';

/** 孤立代理检测:高位后不跟低位,或低位前不跟高位 */
const LONE_HIGH = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;
const LONE_LOW = /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('G-729 projectToolArgsForScreen — 上屏的那一份就是脱敏后的那一份', () => {
  it('① 阳性对照:凭据形状的入参,上屏摘要与回看全文都不含原文', () => {
    const home = os.homedir();
    const args = {
      url: 'https://api.openai.com/v1/chat/completions',
      key: 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX',
      header: 'Authorization: Bearer abcdefghijklmnopQRSTUV',
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      api_key: 'plain-looking-secret-value',
      file: `${home}\\IHUI-AI\\secret.env`,
    };
    const view = projectToolArgsForScreen(args);
    // 上屏串里绝不允许出现这些原文
    expect(view.display).not.toContain('sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX');
    expect(view.display).not.toContain('abcdefghijklmnopQRSTUV');
    expect(view.display).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV');
    expect(view.display).not.toContain('plain-looking-secret-value');
    if (home.length > 3) expect(view.display).not.toContain(home);
    // 回看全文同源:同一份脱敏结果,不存在"上屏脱敏了而全文没脱敏"的分裂
    expect(view.redacted).not.toContain('plain-looking-secret-value');
    expect(view.redacted).toContain('[redacted]');
  });

  it('①b 阳性对照:超长入参被截断后,前 100 码点窗口内也不得漏出凭据', () => {
    const filler = 'x'.repeat(400);
    const args = { note: filler, content: `tail ${filler} sk-proj-ZZZZYYYYXXXXWWWWVVVVUUUU end` };
    const view = projectToolArgsForScreen(args);
    expect(view.truncated).toBe(true);
    expect(view.display).not.toContain('sk-proj-ZZZZYYYYXXXXWWWWVVVVUUUU');
    expect(Array.from(view.display).length).toBeLessThanOrEqual(TOOL_ARGS_DISPLAY_MAX_CODEPOINTS + 1); // +1 是省略号
  });

  it('② 反向对照:普通无害入参逐字不被改坏', () => {
    const args = { path: 'src/index.ts', pattern: 'TODO', limit: 20, recursive: true };
    const view = projectToolArgsForScreen(args);
    const plain = JSON.stringify(args);
    expect(view.redacted).toBe(plain);
    expect(view.display).toBe(plain);
    expect(view.truncated).toBe(false);
  });

  it('②b 反向对照:无参数时给出占位文案且不算截断', () => {
    const view = projectToolArgsForScreen({});
    expect(view.redacted).toBe(NO_ARGS_PLACEHOLDER);
    expect(view.display).toBe(NO_ARGS_PLACEHOLDER);
    expect(view.truncated).toBe(false);
  });

  it('③ 截断切在代理对中间时不得产出孤立半对(旧 .slice(0,100) 的缺陷)', () => {
    // JSON.stringify 不转义 BMP 外字符:'{"k":"' 占 7 个 UTF-16 码元,补 92 个 'a' ⇒
    // 第 100 个码元正好落在 😀 的高位代理上(旧口径在此切出半个字符)。
    const head = '{"k":"';
    const pad = 'a'.repeat(TOOL_ARGS_DISPLAY_MAX_CODEPOINTS - head.length - 1);
    const args = { k: `${pad}😀😀tail` };
    const rawSlice = JSON.stringify(args).slice(0, TOOL_ARGS_DISPLAY_MAX_CODEPOINTS);
    const view = projectToolArgsForScreen(args);
    // 旧口径会切出孤立高位代理 —— 这条是本用例的立因,先把它量出来(否则用例证明不了任何事)
    expect(LONE_HIGH.test(rawSlice)).toBe(true);
    // 新口径:整对要么全进要么全不进
    expect(LONE_HIGH.test(view.display)).toBe(false);
    expect(LONE_LOW.test(view.display)).toBe(false);
    expect(view.truncated).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
