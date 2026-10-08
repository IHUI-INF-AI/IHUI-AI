// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钩子阻断理由的脱敏与截断对账(2026-09-28 立,第九轮 ZCode 对照逼出)。
 *
 * 病灶:`apps/cli/src/hooks/index.ts` 四处 `reason` 都是把钩子脚本的 stderr/stdout **原文**
 * 插进字符串。而 reason 不止进 TUI —— 它随工具结果进模型上下文、进长期落库的对话历史。
 * 用户脚本里一句 `curl -H "Authorization: Bearer $TOKEN"` 失败,响应原文就把那把 token 送进了
 * 会话。上一轮 `buildFilteredEnv` 管住的是**环境**侧(钩子进程读不到我们的 key),这一格是
 * **输出**侧,两条不同层,缺一不可。
 *
 * 修法不新建第二套脱敏:复用唯一出口 `redactCrashText`(packages/shared/src/utils/redact.ts),
 * 顺序固定「先脱敏再截断」(反过来会把凭据切成半截、形状不再成立)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { hookBlockReason, HOOK_REASON_MAX_CHARS } from '../src/hooks/index.js';

const SOURCE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/hooks/index.ts',
);

describe('hookBlockReason — 凭据不外泄', () => {
  it('stderr 里的 Bearer token 必须被盖掉,原文一个字符都不留在 reason 里', () => {
    const token = 'sktestABCDEFGHIJ0123456789';
    const reason = hookBlockReason('钩子 "x" 阻断', {
      exitCode: 1,
      stdout: '',
      stderr: `HTTP 401 Unauthorized from curl -H "Authorization: Bearer ${token}"`,
    });
    expect(reason).not.toContain(token);
    expect(reason).toContain('REDACTED');
    // 上下文仍然可读:前缀与"HTTP 401"这类定位信息不得被抹掉
    expect(reason).toContain('钩子 "x" 阻断:');
    expect(reason).toContain('HTTP 401');
  });

  it('URL 内联凭据(scheme://user:pass@host)同样不得原样出去', () => {
    const reason = hookBlockReason('钩子 "y" 阻断', {
      exitCode: 2,
      stdout: 'failed: https://syncuser:S3cr3tPassw0rd@hooks.example.com/v2/ingest',
      stderr: '',
    });
    expect(reason).not.toContain('S3cr3tPassw0rd');
    expect(reason).toContain('REDACTED');
  });

  it('ihui_ 前缀的平台 key 出现在输出里也必须被盖', () => {
    const key = 'ihui_' + 'A'.repeat(24);
    const reason = hookBlockReason('钩子 "z" 阻断', {
      exitCode: 1,
      stdout: '',
      stderr: `dumped config: API_KEY=${key}`,
    });
    expect(reason).not.toContain(key);
  });
});

describe('hookBlockReason — 不得过度脱敏', () => {
  it('普通中文诊断必须逐字可读(过度盖字等于把报错变成天书)', () => {
    const reason = hookBlockReason('钩子 "lint" 阻断', {
      exitCode: 1,
      stdout: '',
      stderr: '找不到配置文件,请检查 ~/.ihui/hooks.json 的 JSON 语法',
    });
    expect(reason.endsWith('找不到配置文件,请检查 ~/.ihui/hooks.json 的 JSON 语法')).toBe(true);
    expect(reason).not.toContain('REDACTED');
  });

  it('stdout/stderr 都是空时退回 exit 码,不得留空串', () => {
    expect(hookBlockReason('钩子 "e" 阻断', { exitCode: 7, stdout: '', stderr: '' })).toBe(
      '钩子 "e" 阻断: exit 7',
    );
  });
});

describe('hookBlockReason — 截断必须留痕且不得劈开码点', () => {
  it('超长输出截断后必须写明被截掉多少(静默变短=伪造完整性)', () => {
    // 填充取"6 字符 + 空格"的重复形态:上一版用 4500 个连续 a,本身就像一枚 base64 密钥,
    // 被 SECRET_RULES 整段盖掉 ⇒ 量到的是脱敏强度而不是截断留痕(夹具自伤,不是产品缺陷)。
    const filler = 'xxxxxx ';
    const raw = filler.repeat(Math.ceil((HOOK_REASON_MAX_CHARS + 500) / filler.length)).slice(
      0,
      HOOK_REASON_MAX_CHARS + 500,
    );
    const reason = hookBlockReason('钩子 "big" 阻断', {
      exitCode: 1,
      stdout: '',
      stderr: raw,
    });
    expect(reason).not.toContain('REDACTED');
    expect(reason).toContain('[已截断 500 个码点]');
    const body = reason.replace('钩子 "big" 阻断: ', '');
    expect(body.startsWith(raw.slice(0, HOOK_REASON_MAX_CHARS))).toBe(true);
    expect(body).not.toContain(raw.slice(0, HOOK_REASON_MAX_CHARS + 1));
  });

  it('截断点落在代理对上时, astral 字符必须整枚保留或整枚出局', () => {
    const filler = 'あ'.repeat(HOOK_REASON_MAX_CHARS - 1);
    const raw = `${filler}😀${'x'.repeat(50)}`;
    const reason = hookBlockReason('钩子 "u" 阻断', { exitCode: 1, stdout: '', stderr: raw });
    // 反向对照:若按 char 切,第 4000 个 char 会把 😀 的高代理留下、低代理截掉 → 产出孤立代理
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(reason)).toBe(false);
    expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(reason)).toBe(false);
  });
});

describe('hookBlockReason — 装车面', () => {
  it('四处 reason 全部走这一出口:源码里裸插值只允许出现在函数体内一次', () => {
    const src = readFileSync(SOURCE, 'utf8');
    const bare = [...src.matchAll(/r\.stderr \|\| r\.stdout/g)].length;
    expect(bare, `裸插值应只剩出口里那 1 处,实得 ${bare}`).toBe(1);
    const calls = [...src.matchAll(/reason: hookBlockReason\(/g)].length;
    expect(calls, `应有 4 处 reason 走出口,实得 ${calls}`).toBe(4);
  });

  it('函数体内不得再建第二套脱敏正则(唯一出口纪律)', () => {
    const src = readFileSync(SOURCE, 'utf8');
    expect(src).toContain("from '@ihui/shared/utils/redact'");
    expect(/bearer[\s\S]{0,40}gi/.test(src.replace(/import[^\n]*redact[^\n]*\n/g, ''))).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
