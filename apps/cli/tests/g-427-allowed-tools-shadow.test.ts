// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-427 第①步「allowed-tools 影子记账」的镜像测试(机主 2026-10-10 拍板「先记账一周再开真门控」)。
//
// 两条它必须钉住的方向,缺一不可:
//   · **记了但没挡** —— 影子账本一旦开始拦截,就是替机主提前拍板(本票明令禁止);
//   · **装车了才叫有** —— 生产者侧(formatSkillsForPrompt)与执行侧(executeToolCall)各有一条
//     端到端证明。守门 64/70/81/115/121 记过最多次的失效型就是"函数在、自检过、没人调用",
//     所以这里不调内部函数自证,一律走**生产入口**。
// 自检表本身**不在本文件重抄一份**(§22c):`shadowSelfTestCases()` 是唯一实现,本文件驱动它。
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SHADOW_LEDGER_ENV,
  aggregateShadowLedger,
  declareShadowSurfaces,
  formatShadowReport,
  observeShadowToolCall,
  readShadowLedger,
  resetShadowAllowedTools,
  resetShadowAnnouncements,
  shadowLedgerEnabled,
  snapshotShadowAllowedTools,
} from '../src/skills/allowed-tools-shadow.js';
import { shadowSelfTestCases } from '../src/skills/allowed-tools-shadow.selftest.js';
import { formatSkillsForPrompt, type Skill } from '../src/skills/index.js';
import { clearTools, executeToolCall, registerTools, resetRateLimiter, type Tool, type ToolContext } from '../src/tools/index.js';

let scratch = '';
let ledger = '';

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'g427-shadow-'));
  ledger = path.join(scratch, 'ledger.jsonl');
  // **没有这一行,本文件的每一条断言都可能在往真实用户台账上写** —— 落点默认是开启的,
  // 测试必须自己把它关进一次性目录(与 §25/§26 的同一条纪律)。
  process.env[SHADOW_LEDGER_ENV] = ledger;
  resetShadowAllowedTools();
  resetShadowAnnouncements();
  resetRateLimiter();
  clearTools();
});

afterEach(() => {
  delete process.env[SHADOW_LEDGER_ENV];
  resetShadowAllowedTools();
  try {
    fs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* 一次性目录清理失败不影响结论 */
  }
});

function ledgerLines(): string[] {
  if (!fs.existsSync(ledger)) return [];
  return fs
    .readFileSync(ledger, 'utf-8')
    .split('\n')
    .filter((l) => l.trim() !== '');
}

function makeTool(name: string): Tool {
  return {
    name,
    description: 'demo tool for the G-427 shadow wiring proof',
    parameters: { note: { type: 'string', description: 'arbitrary payload' } },
    required: [],
    dangerLevel: 'read',
    async execute(args: Record<string, unknown>) {
      return { success: true, output: `ran:${String(args['note'] ?? '')}` };
    },
  };
}

const ctx: ToolContext = { workspacePath: process.cwd() };

describe('G-427 allowed-tools 影子记账(只记不挡)', () => {
  it('自检表非空且逐条通过(空表不得被读成"全绿")', () => {
    const cases = shadowSelfTestCases();
    expect(cases.length).toBeGreaterThanOrEqual(10);
    const failed = cases.filter((c) => {
      try {
        return c.run(scratch) !== true;
      } catch {
        return true;
      }
    });
    expect(failed.map((c) => c.name)).toEqual([]);
  });

  it('生产者侧装车:formatSkillsForPrompt 真把声明面交给影子账本(不是只有函数存在)', () => {
    const skill: Skill = {
      name: 'wired-skill',
      source: '/tmp/wired-skill.md',
      description: 'declares a whitelist',
      body: 'body text that is not empty so the section is actually built',
      priority: 0,
      frontmatter: { allowedTools: ['read_file'] },
    };
    const text = formatSkillsForPrompt([skill]);
    expect(text).toContain('wired-skill');
    expect(snapshotShadowAllowedTools().declaredSkills).toEqual(['wired-skill']);
    expect(ledgerLines().some((l) => l.includes('"surface"') && l.includes('wired-skill'))).toBe(true);
  });

  it('被保守降权(未知 frontmatter 键)的技能不进声明面 —— 与"不进提示词"同一批', () => {
    const withheld: Skill = {
      name: 'untrusted',
      source: '/tmp/untrusted.md',
      description: 'has an unknown key',
      body: 'body',
      priority: 0,
      safeToAutoLoad: false,
      unknownFrontmatterKeys: ['sudo-mode'],
      frontmatter: { allowedTools: ['read_file'] },
    };
    formatSkillsForPrompt([withheld]);
    expect(snapshotShadowAllowedTools().declaredSkills).toEqual([]);
  });

  it('执行侧装车且不拦截:白名单外的调用照常跑完,并留下一行命中', async () => {
    registerTools([makeTool('outside_tool')]);
    declareShadowSurfaces([{ name: 'demo', allowed: ['read_file'] }]);
    const res = await executeToolCall({ name: 'outside_tool', arguments: { note: 'x' } }, ctx);
    expect(res.success).toBe(true);
    expect(res.output).toBe('ran:x');
    expect(ledgerLines().filter((l) => l.includes('"hit"'))).toHaveLength(1);
    expect(snapshotShadowAllowedTools().hitCalls).toBe(1);
  });

  it('白名单内的调用照常跑完且**不记**(允许不是债)', async () => {
    registerTools([makeTool('read_file')]);
    declareShadowSurfaces([{ name: 'demo', allowed: ['read_file'] }]);
    const res = await executeToolCall({ name: 'read_file', arguments: {} }, ctx);
    expect(res.success).toBe(true);
    expect(ledgerLines().filter((l) => l.includes('"hit"'))).toHaveLength(0);
  });

  it('被权限规则拒掉的调用不记:一件事不得算两遍', async () => {
    registerTools([makeTool('denied_tool')]);
    declareShadowSurfaces([{ name: 'demo', allowed: ['read_file'] }]);
    const res = await executeToolCall(
      { name: 'denied_tool', arguments: {} },
      { workspacePath: process.cwd(), permissions: { allow: ['read_file'], deny: ['denied_tool'] } },
    );
    expect(res.success).toBe(false);
    expect(res.errorType).toBe('permission_denied');
    expect(ledgerLines().filter((l) => l.includes('"hit"'))).toHaveLength(0);
  });

  it('没技能声明时一次盘都不写(默认开启不等于默认产文件)', () => {
    expect(shadowLedgerEnabled()).toBe(true);
    declareShadowSurfaces([{ name: 'quiet', allowed: undefined }]);
    observeShadowToolCall('anything');
    expect(fs.existsSync(ledger)).toBe(false);
  });

  it('关掉开关后只留内存账,零写盘', () => {
    process.env[SHADOW_LEDGER_ENV] = '0';
    declareShadowSurfaces([{ name: 'demo', allowed: [] }]);
    observeShadowToolCall('read_file');
    const snap = snapshotShadowAllowedTools({ [SHADOW_LEDGER_ENV]: '0' });
    expect(fs.existsSync(ledger)).toBe(false);
    expect(snap.ledgerRows).toBe(0);
    expect(snap.hitCalls).toBe(1);
  });

  it('三态与结论口径:surface 行决定"零命中"是不是一句有效结论', () => {
    const onlySurface = path.join(scratch, 'only-surface.jsonl');
    fs.writeFileSync(
      onlySurface,
      `${JSON.stringify({
        v: 1,
        kind: 'surface',
        ts: '2026-10-10T00:00:00.000Z',
        declared: 1,
        silent: 0,
        undetermined: 0,
        invalid: 0,
        skills: ['demo'],
        skillsOmitted: 0,
      })}\n`,
      'utf-8',
    );
    const clean = aggregateShadowLedger(readShadowLedger(onlySurface), onlySurface);
    expect(clean.insufficient).toBe(false);
    expect(formatShadowReport(clean)).toContain('this IS a conclusion');

    const empty = path.join(scratch, 'empty.jsonl');
    fs.writeFileSync(empty, '', 'utf-8');
    const nothing = aggregateShadowLedger(readShadowLedger(empty), empty);
    expect(nothing.insufficient).toBe(true);
    expect(nothing.insufficientReason).toContain('proves nothing');

    const missing = aggregateShadowLedger(readShadowLedger(path.join(scratch, 'nope.jsonl')), 'nope');
    expect(formatShadowReport(missing)).toContain('UNDETERMINED');
  });

  it('同一张面重复声明不重复计运行(否则一次会话把自己数成八次)', () => {
    declareShadowSurfaces([{ name: 'demo', allowed: ['read_file'] }]);
    declareShadowSurfaces([{ name: 'demo', allowed: ['read_file'] }]);
    expect(ledgerLines().filter((l) => l.includes('"surface"'))).toHaveLength(1);
    declareShadowSurfaces([{ name: 'demo', allowed: ['read_file', 'write_file'] }]);
    expect(ledgerLines().filter((l) => l.includes('"surface"'))).toHaveLength(2);
  });

  it('读台账绝不落回磁盘上的真实用户台账(测试隔离)', () => {
    delete process.env[SHADOW_LEDGER_ENV];
    const read = readShadowLedger(ledger);
    expect(read.path).toBe(ledger);
    expect(read.totalLines).toBe(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
