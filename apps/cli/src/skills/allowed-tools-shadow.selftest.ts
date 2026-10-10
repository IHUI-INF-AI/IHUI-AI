// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-427 allowed-tools 影子账本的**自检表**(与生产模块分文件的唯一理由是单文件行数闸,不是分层)。
//
// 读法与三条口径写在 `allowed-tools-shadow.ts` 的文件头,这里不重述一遍(两处写同一件事必漂移)。
// 两条本文件特有的纪律:
//   ① 用例表**对外只读一份**(`shadowSelfTestCases()`):镜像测试直接驱动它,不得在测试里另抄
//      一份判据(§22c)。表被清空 ⇒ `runShadowSelfTest()` 判失败 —— 空扫不是通过。
//   ② 用例只在一次性目录里跑,任何一步都不许碰真实台账路径。"关档零写盘"那一格因此用
//      "内存里 ledgerRows 仍为 0" 来证,而不是断言真实用户目录里有没有文件(那种断言在
//      别人机器上会与既有数据撞形)。

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  SHADOW_LEDGER_ENV,
  SHADOW_LEDGER_MAX_ROWS_PER_PROCESS,
  SHADOW_SCHEMA_VERSION,
  aggregateShadowLedger,
  declareShadowSurfaces,
  drainShadowAlerts,
  formatShadowReport,
  observeShadowToolCall,
  readShadowLedger,
  resetShadowAllowedTools,
  shadowLedgerEnabled,
  snapshotShadowAllowedTools,
} from './allowed-tools-shadow.js';

// ==================== 自检(一次性目录,用完即删) ====================
//
// 落点用系统 TEMP:`os.tmpdir()` 是 §15 认可的写法(禁止的是硬编码盘符),且这里**不建 git 仓**,
// 所以 §26 那条"临时夹具唯一落点 = scripts/lib/scratch-dir.mjs"(它防的是夹具向上逃逸到真仓)
// 与本处不同型。自检任何一步都不许碰真实台账路径 —— 关档那一格因此用"内存里 ledgerRows 仍为 0"
// 来证,而不是去断言真实用户目录里有没有文件(那种断言在别人机器上会与既有数据撞形)。

export interface SelfCase {
  name: string;
  run: (dir: string) => boolean;
}

const SELF_CASES: SelfCase[] = [
  {
    name: 'a call outside the declared surface is recorded (one surface row + one hit row)',
    run: (dir) => {
      const ledger = path.join(dir, 'a.jsonl');
      const env = { [SHADOW_LEDGER_ENV]: ledger };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 'demo', allowed: ['read_file'] }], env);
      const r = observeShadowToolCall('run_command', env);
      const lines = fs.readFileSync(ledger, 'utf-8').trim().split('\n');
      return r.hits === 1 && r.recorded === 1 && lines.length === 2;
    },
  },
  {
    name: 'a call inside the surface records nothing (allowed is not debt)',
    run: (dir) => {
      const env = { [SHADOW_LEDGER_ENV]: path.join(dir, 'b.jsonl') };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 'demo', allowed: ['read_file'] }], env);
      const inside = observeShadowToolCall('read_file', env);
      return inside.hits === 0 && snapshotShadowAllowedTools(env).hitCalls === 0;
    },
  },
  {
    name: 'a skill that says nothing never becomes a surface and never hits',
    run: (dir) => {
      const ledger = path.join(dir, 'c.jsonl');
      const env = { [SHADOW_LEDGER_ENV]: ledger };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 'quiet', allowed: undefined }], env);
      const snap = snapshotShadowAllowedTools(env);
      return !fs.existsSync(ledger) && snap.declaredSkills.length === 0 && snap.silentSkills === 1 && observeShadowToolCall('anything', env).hits === 0;
    },
  },
  {
    name: 'an unparseable surface is undetermined: counted, never read as "no restriction", never hits',
    run: (dir) => {
      const env = { [SHADOW_LEDGER_ENV]: path.join(dir, 'd.jsonl') };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 'blocked_shape', allowed: null }], env);
      const snap = snapshotShadowAllowedTools(env);
      return snap.undeterminedSkills === 1 && snap.declaredSkills.length === 0 && observeShadowToolCall('x', env).hits === 0;
    },
  },
  {
    name: 'an explicit empty surface means "nothing allowed": every call hits (G-428 tri-state)',
    run: (dir) => {
      const env = { [SHADOW_LEDGER_ENV]: path.join(dir, 'e.jsonl') };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 'none_allowed', allowed: [] }], env);
      return snapshotShadowAllowedTools(env).declaredSkills.length === 1 && observeShadowToolCall('read_file', env).hits === 1;
    },
  },
  {
    name: 'an unusable skill name lands in the invalid bucket instead of being dropped silently',
    run: (dir) => {
      const env = { [SHADOW_LEDGER_ENV]: path.join(dir, 'f.jsonl') };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: '   ', allowed: ['a'] }, { name: 42, allowed: ['a'] }], env);
      const snap = snapshotShadowAllowedTools(env);
      return snap.invalidSkills === 2 && snap.declaredSkills.length === 0;
    },
  },
  {
    name: 'the disabled switch is a pure predicate and writes nothing (counts stay in memory)',
    run: (dir) => {
      void dir;
      const off = { [SHADOW_LEDGER_ENV]: 'off' };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 's', allowed: ['a'] }], off);
      observeShadowToolCall('b', off);
      const snap = snapshotShadowAllowedTools(off);
      return shadowLedgerEnabled(off) === false && snap.ledgerRows === 0 && snap.hitCalls === 1;
    },
  },
  {
    name: 'read side aggregates repeats and counts bad lines (unknown schema version is not "no record")',
    run: (dir) => {
      const file = path.join(dir, 'g.jsonl');
      fs.writeFileSync(
        file,
        [
          row({ kind: 'surface', ts: '2026-10-10T00:00:00.000Z', declared: 1, silent: 0, undetermined: 0, invalid: 0, skills: ['s'], skillsOmitted: 0 }),
          row({ kind: 'hit', ts: '2026-10-10T00:00:01.000Z', skill: 's', tool: 't1' }),
          row({ kind: 'hit', ts: '2026-10-10T00:00:02.000Z', skill: 's', tool: 't1' }),
          'not json',
          JSON.stringify({ v: 99, kind: 'hit', ts: 'x', skill: 's', tool: 'future-shape' }),
        ].join('\n') + '\n',
        'utf-8',
      );
      const read = readShadowLedger(file);
      const agg = aggregateShadowLedger(read, file);
      return read.pairs.length === 1 && read.pairs[0]!.count === 2 && read.malformedLines === 2 && agg.insufficient === false;
    },
  },
  {
    name: 'zero hits with surfaces reads as a conclusion; zero surfaces reads as insufficient (two wordings, not one)',
    run: (dir) => {
      const empty = path.join(dir, 'h1.jsonl');
      fs.writeFileSync(empty, '', 'utf-8');
      const aggEmpty = aggregateShadowLedger(readShadowLedger(empty), empty);
      const onlySurface = path.join(dir, 'h2.jsonl');
      fs.writeFileSync(
        onlySurface,
        `${row({ kind: 'surface', ts: '2026-10-10T00:00:00.000Z', declared: 2, silent: 0, undetermined: 0, invalid: 0, skills: ['a', 'b'], skillsOmitted: 0 })}\n`,
        'utf-8',
      );
      const aggClean = aggregateShadowLedger(readShadowLedger(onlySurface), onlySurface);
      const cleanText = formatShadowReport(aggClean);
      const missingText = formatShadowReport(aggregateShadowLedger(readShadowLedger(path.join(dir, 'missing.jsonl')), 'missing'));
      return (
        aggEmpty.insufficient === true &&
        aggEmpty.insufficientReason !== null &&
        aggClean.insufficient === false &&
        cleanText.includes('this IS a conclusion') &&
        missingText.includes('UNDETERMINED')
      );
    },
  },
  {
    name: 'the per-process cap stops disk growth and announces itself instead of silently truncating',
    run: (dir) => {
      const file = path.join(dir, 'i.jsonl');
      const env = { [SHADOW_LEDGER_ENV]: file };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 's', allowed: [] }], env);
      for (let i = 0; i < SHADOW_LEDGER_MAX_ROWS_PER_PROCESS + 5; i += 1) observeShadowToolCall('t', env);
      const snap = snapshotShadowAllowedTools(env);
      const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').length;
      return lines === SHADOW_LEDGER_MAX_ROWS_PER_PROCESS && snap.capReached && snap.hitCalls > lines && drainShadowAlerts().some((a) => a.includes('cap'));
    },
  },
  {
    name: 'poison input never throws, and a missing directory is created on demand',
    run: (dir) => {
      const env = { [SHADOW_LEDGER_ENV]: path.join(dir, 'nested', 'j.jsonl') };
      resetShadowAllowedTools();
      declareShadowSurfaces([{ name: 's', allowed: ['read_file'] }], env);
      const a = observeShadowToolCall(undefined, env);
      const b = observeShadowToolCall({}, env);
      const c = observeShadowToolCall('run_command', env);
      return a.hits === 0 && b.hits === 0 && c.hits === 1 && fs.existsSync(path.join(dir, 'nested', 'j.jsonl'));
    },
  },
];

function row(fields: Record<string, unknown>): string {
  return JSON.stringify({ v: SHADOW_SCHEMA_VERSION, ...fields });
}

/**
 * 自检用例表**对外只读**一份:镜像测试直接驱动它,不得在测试里另抄一份判据(§22c)。
 * 表若被清空,`runShadowSelfTest()` 与 `--self-test` 都会判失败 —— 空扫不等于通过。
 */
export function shadowSelfTestCases(): readonly SelfCase[] {
  return SELF_CASES;
}

/**
 * 自检出口。返回 0 全绿 / 1 有失败 —— 与姊妹出口 `runSelfTest` 同一条约定:
 * "跑完"不等于"过了",失败必须非零,否则报告读起来像合格证。
 */
export function runShadowSelfTest(): number {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skill-shadow-'));
  const failed: string[] = [];
  try {
    for (const c of SELF_CASES) {
      try {
        if (!c.run(dir)) failed.push(c.name);
      } catch (e) {
        failed.push(`${c.name} [threw: ${e instanceof Error ? e.message : String(e)}]`);
      }
    }
    resetShadowAllowedTools();
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 一次性目录清理失败不改变结论;失败清单已在返回值里,这里不静默喊成功 */
    }
  }
  for (const name of failed) process.stderr.write(`FAIL ${name}\n`);
  process.stdout.write(`allowed-tools shadow self-test: ${SELF_CASES.length - failed.length}/${SELF_CASES.length} assertions passed\n`);
  return failed.length === 0 ? 0 : 1;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
