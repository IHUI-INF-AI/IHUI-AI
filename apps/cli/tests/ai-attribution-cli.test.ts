// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui ai-attribution` 的回归(2026-11-05,goal-b49)。
 *
 * 三条要钉住的:
 *  1. **端内不抄判据**:归属判定唯一一份住在服务端
 *     `apps/ai-service/app/core/ai_code_attribution.py`;CLI 侧若出现第二份工具登记表
 *     或判据字面量,就是 §0.6 说的"两份真相必然漂移" ⇒ 本文件用反向锁挡住。
 *  2. **两个占比口径都在**:只给一个占比,读数侧会把「没判出来」读成「不是 AI 写的」。
 *  3. **命令真的注册了**:不是"有个命令文件就算装车"。
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import {
  formatRecordLines,
  formatStatsLines,
  postAttributionBackfill,
  registerAiAttributionCommand,
  type AttributionStatsPayload,
} from '../src/commands/ai-attribution.js';
import { getSettingsPath } from '../src/commands/settings.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMMAND_FILE = join(HERE, '..', 'src', 'commands', 'ai-attribution.ts');

const SAMPLE_STATS: AttributionStatsPayload = {
  total: 10,
  ai: 6,
  human: 1,
  unknown: 3,
  ai_ratio: 0.6,
  known_ratio: 6 / 7,
};

describe('ai-attribution CLI(读数侧)', () => {
  it('两个占比口径都出现在人读输出里', () => {
    const lines = formatStatsLines(SAMPLE_STATS).join('\n');
    expect(lines).toContain('AI 占比(含 unknown):60.0%');
    expect(lines).toContain('AI 占比(只算已判出):85.7%');
    expect(lines).toContain('unknown 3');
  });

  it('明细行标出归属与锚;未提交的改动如实说回溯不出', () => {
    const lines = formatRecordLines([
      {
        record_id: 'r1',
        tool: 'file_edit',
        file: 'a.py',
        attribution: 'ai',
        reason: 'tool_in_ai_registry',
        session_id: 's1',
        at: '2026-11-05T00:00:00Z',
        hunk_summary: '@@ -1 +1 @@',
        anchor: { path: 'a.py', line_start: 3, line_end: 5, hunk_id: 'h1', commit_sha: '' },
      },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[ai]');
    expect(lines[0]).toContain('a.py:3-5');
    expect(lines[0]).toContain('回溯不出');
  });

  it('空账目如实说没有,不留空输出', () => {
    expect(formatRecordLines([])).toEqual(['(归属账里没有匹配的记录)']);
  });

  it('命令真的注册了(装车证明)', () => {
    const program = new Command();
    registerAiAttributionCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'ai-attribution');
    expect(cmd).toBeDefined();
    const subNames = (cmd?.commands ?? []).map((c) => c.name());
    expect(subNames).toContain('stats');
    expect(subNames).toContain('records');
  });

  it('反向锁:CLI 侧不得出现第二份归属判据', () => {
    const src = readFileSync(COMMAND_FILE, 'utf-8');
    expect(src).not.toMatch(/AI_GENERATED_TOOLS|HUMAN_AUTHORED_TOOLS/);
    expect(src).not.toMatch(/tool_in_ai_registry|tool_in_human_registry|tool_not_in_registry/);
    expect(src).not.toMatch(/missing_file_or_hunk/);
  });

  it('回填把提交号和文件清单交给服务端', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ihui-attr-backfill-'));
    const previousHome = process.env.HOME;
    const previousProfile = process.env.USERPROFILE;
    process.env.HOME = dir;
    process.env.USERPROFILE = dir;
    const file = getSettingsPath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ apiKey: 'test-key' }), 'utf-8');
    try {
      let seenPath = '';
      let seenSha = '';
      const ok = await postAttributionBackfill('a'.repeat(40), ['apps/a.py'], async (_base, path, options) => {
        seenPath = path;
        const body = options?.body as { commit_sha?: string };
        seenSha = body.commit_sha ?? '';
        return { code: 0, data: { updated: 1, refused: '' } };
      });
      expect(seenPath).toBe('/backfill');
      expect(seenSha).toBe('a'.repeat(40));
      expect(ok).toEqual({ updated: 1, refused: '' });
      await expect(
        postAttributionBackfill('b'.repeat(40), ['apps/b.py'], async () => {
          throw new Error('服务没起来');
        }),
      ).rejects.toThrow('服务没起来');
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = previousProfile;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
