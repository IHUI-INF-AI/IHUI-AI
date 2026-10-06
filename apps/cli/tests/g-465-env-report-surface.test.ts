// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-465:子进程 env 边界的"报名面"(只报名,不剥、不拦)验收用例。
 *
 * 病灶(票面 + 2026-10-06 真实现直测复测):`matchPattern` 的 deny 后缀族
 * (`*_API_KEY/*_SECRET/*_TOKEN/*_PASSWORD`)盖不到单数 `*_KEY`、`*_SENDKEY`、
 * `*_TOKEN_ID`、`*_AUTH_PAYLOAD_FILE`、`*_TOKEN_PATH` 等形态,
 * LIBTV_ACCESS_KEY / SERVERCHAN_SENDKEY / TUNNEL_SERVICE_TOKEN_ID /
 * QODER_SDK_AUTH_PAYLOAD_FILE / TRAE_JWT_TOKEN_PATH 原样漏进子进程。
 *
 * 机主拍板的出路:先只报名不拦 —— 不扩大剥离范围(宁窄不误伤,与
 * child-env-boundary.test.ts 的既有承诺同向),而是把识别面扩宽并对"将进子进程
 * 的疑似凭据变量"逐次产出报名(stderr 一行 + 审计日志结构化字段,点名变量名与命中模式)。
 *
 * 本套件钉三件事:
 *   ① 报名命中票面残留键(分区等值,名单变化必须显式裁决);
 *   ② 报名 ≠ 剥离:残留键的值原样幸存,deny 表行为零变化;
 *   ③ 两条 spawn 站点(同步/异步)真的装了车 —— 审计条目带 suspiciousEnvVars。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  buildFilteredEnv,
  DEFAULT_BLOCKED_ENV_VARS,
  detectSuspiciousEnvVars,
  reportSuspiciousEnvVars,
  runSandboxed,
  runSandboxedAsync,
  SUSPICIOUS_CREDENTIAL_ENV_PATTERNS,
} from '../src/sandbox/index.js';

describe('G-465 报名面识别(detectSuspiciousEnvVars)', () => {
  it('票面 4 残留键 + 复测新增的 TOKEN_PATH 形态全部命中,并点名各自命中模式', () => {
    const env: NodeJS.ProcessEnv = {
      LIBTV_ACCESS_KEY: 'v1',
      SERVERCHAN_SENDKEY: 'v2',
      TUNNEL_SERVICE_TOKEN_ID: 'v3',
      QODER_SDK_AUTH_PAYLOAD_FILE: 'v4',
      TRAE_JWT_TOKEN_PATH: 'v5',
    };
    const reports = detectSuspiciousEnvVars(env);
    expect(reports.map((r) => r.name).sort()).toEqual(
      ['LIBTV_ACCESS_KEY', 'QODER_SDK_AUTH_PAYLOAD_FILE', 'SERVERCHAN_SENDKEY', 'TRAE_JWT_TOKEN_PATH', 'TUNNEL_SERVICE_TOKEN_ID'].sort(),
    );
    const byName = new Map(reports.map((r) => [r.name, r.pattern]));
    expect(byName.get('LIBTV_ACCESS_KEY')).toBe('*_KEY');
    expect(byName.get('SERVERCHAN_SENDKEY')).toBe('*_SENDKEY');
    expect(byName.get('TUNNEL_SERVICE_TOKEN_ID')).toBe('*_TOKEN_ID');
    expect(byName.get('QODER_SDK_AUTH_PAYLOAD_FILE')).toBe('*_AUTH_PAYLOAD_FILE');
    expect(byName.get('TRAE_JWT_TOKEN_PATH')).toBe('*_TOKEN_PATH');
  });

  it('非凭据变量零误伤:PATH / 普通 vendor 变量 / 杂名不报名', () => {
    const reports = detectSuspiciousEnvVars({
      PATH: 'irrelevant',
      SOME_VENDOR_PROFILE: 'keep-me',
      G465_PLAIN_VENDOR_FLAG: '1',
      SSH_AGENT_PID: '4242',
    });
    expect(reports).toEqual([]);
  });

  it('报名模式清单逐字钉死 —— 增删模式必须显式改本例并写下理由', () => {
    expect([...SUSPICIOUS_CREDENTIAL_ENV_PATTERNS]).toEqual([
      '*_SENDKEY',
      '*_AUTH_PAYLOAD_FILE',
      '*_TOKEN_ID',
      '*_SECRET_ID',
      '*_KEY_ID',
      '*_TOKEN_PATH',
      '*_TOKEN_FILE',
      '*_KEY_PATH',
      '*_KEY_FILE',
      '*_KEY',
    ]);
  });

  it('两表不得混用:报名模式清单与 deny 表零交集', () => {
    for (const p of SUSPICIOUS_CREDENTIAL_ENV_PATTERNS) {
      expect(DEFAULT_BLOCKED_ENV_VARS, `报名模式 ${p} 不得混进 deny 表`).not.toContain(p);
    }
  });
});

describe('G-465 报名 ≠ 剥离(对真 env 的分区对账)', () => {
  // 逐键 set/delete,不做 process.env 整体替换(与 child-env-boundary.test.ts 同一既有形态)
  const RESIDUAL_LEDGER: string[] = [
    'LIBTV_ACCESS_KEY',
    'SERVERCHAN_SENDKEY',
    'TUNNEL_SERVICE_TOKEN_ID',
    'QODER_SDK_AUTH_PAYLOAD_FILE',
    'TRAE_JWT_TOKEN_PATH',
  ];
  // 对照组:同形但被既有 deny 后缀族盖住的,必须一个都不出现在报名里
  const BLOCKED_CONTROLS: string[] = [
    'IHUI_API_KEY',
    'STEPFUN_API_KEY',
    'AI_CALLBACK_SECRET',
    'IHUI_AGENT_TOKEN',
    'DB_PASSWORD',
    'IHUI_SERVE_MACHINE_KEYS',
  ];
  // 反对照组:既不该剥也不该报
  const NEGATIVE_CONTROLS: string[] = ['G465_VENDOR_PROFILE', 'G465_PLAIN_FLAG'];
  const CANDIDATES = [...RESIDUAL_LEDGER, ...BLOCKED_CONTROLS, ...NEGATIVE_CONTROLS];

  it('分区等值:残留键全部报名且值原样幸存;deny 盖住的不报名;报名模式清单不在 deny 表里', () => {
    const previous = new Map<string, string | undefined>();
    try {
      for (const k of CANDIDATES) {
        previous.set(k, process.env[k]);
        process.env[k] = 'sentinel-value-not-a-real-credential';
      }
      const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
      const reports = detectSuspiciousEnvVars(filtered);
      const reportedCandidates = CANDIDATES.filter((k) => reports.some((r) => r.name === k));
      // 残留名单逐字相等:多报(判据放宽盖到别人)或少报(漏了残留)都翻红
      expect(reportedCandidates.slice().sort()).toEqual(RESIDUAL_LEDGER.slice().sort());
      // 报名 ≠ 剥离:被点名的变量,值必须原样进子进程 env
      for (const k of RESIDUAL_LEDGER) {
        expect(filtered[k], `${k} 只报名不剥离,值必须幸存`).toBe('sentinel-value-not-a-real-credential');
      }
      // deny 表照旧:对照键一个不剩
      for (const k of BLOCKED_CONTROLS) {
        expect(filtered[k], `${k} 应当被既有后缀族盖住`).toBeUndefined();
      }
      // 反对照组:幸存且不报名
      for (const k of NEGATIVE_CONTROLS) {
        expect(filtered[k]).toBe('sentinel-value-not-a-real-credential');
      }
    } finally {
      for (const [k, v] of previous) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe('G-465 报名出口(reportSuspiciousEnvVars)', () => {
  it('空名单零输出', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      reportSuspiciousEnvVars([]);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('写一行报名,点名变量名与命中模式;同签名去重只喊一次,新签名再喊', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      reportSuspiciousEnvVars([{ name: 'G465_EMIT_A_KEY', pattern: '*_KEY' }]);
      expect(spy).toHaveBeenCalledTimes(1);
      const line = String(spy.mock.calls[0]![0]);
      expect(line).toContain('⚠ env-report:');
      expect(line).toContain('G465_EMIT_A_KEY(*_KEY)');
      // 同签名去重:同一组(变量,模式)进程生命周期内只喊一次
      reportSuspiciousEnvVars([{ name: 'G465_EMIT_A_KEY', pattern: '*_KEY' }]);
      expect(spy).toHaveBeenCalledTimes(1);
      // 新签名(不同变量)再喊
      reportSuspiciousEnvVars([{ name: 'G465_EMIT_B_TOKEN_PATH', pattern: '*_TOKEN_PATH' }]);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(String(spy.mock.calls[1]![0])).toContain('G465_EMIT_B_TOKEN_PATH(*_TOKEN_PATH)');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('G-465 装车对账:两条 spawn 站点启动时真的报名进审计', () => {
  let DIR = '';
  let AUDIT = '';
  let prevAuditLog: string | undefined;
  const PROBE = 'G465_WIRING_PROBE_KEY';
  let prevProbe: string | undefined;

  beforeAll(() => {
    DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'g465-env-report-'));
    AUDIT = path.join(DIR, 'audit.jsonl');
    prevAuditLog = process.env.IHUI_SANDBOX_AUDIT_LOG;
    process.env.IHUI_SANDBOX_AUDIT_LOG = AUDIT;
    prevProbe = process.env[PROBE];
    process.env[PROBE] = 'sentinel-value-not-a-real-credential';
  });

  afterAll(() => {
    if (prevAuditLog === undefined) delete process.env.IHUI_SANDBOX_AUDIT_LOG;
    else process.env.IHUI_SANDBOX_AUDIT_LOG = prevAuditLog;
    if (prevProbe === undefined) delete process.env[PROBE];
    else process.env[PROBE] = prevProbe;
    try {
      fs.rmSync(DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch {
      /* best-effort:残留目录由系统 TEMP 收割 */
    }
  });

  function readAuditEntries(): Array<Record<string, unknown>> {
    return fs
      .readFileSync(AUDIT, 'utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  }

  function entriesReportingProbe(): Array<Record<string, unknown>> {
    return readAuditEntries().filter((e) =>
      Array.isArray(e.suspiciousEnvVars)
        && (e.suspiciousEnvVars as Array<{ name: string; pattern: string }>).some((s) => s.name === PROBE),
    );
  }

  it('runSandboxed(同步站点):审计条目带 suspiciousEnvVars,点名探针键与 *_KEY 模式', () => {
    const result = runSandboxed('node -v', { cwd: DIR });
    expect(result.blocked).toBe(false);
    const hits = entriesReportingProbe();
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const reports = hits.at(-1)!.suspiciousEnvVars as Array<{ name: string; pattern: string }>;
    expect(reports.some((s) => s.name === PROBE && s.pattern === '*_KEY')).toBe(true);
  });

  it('runSandboxedAsync(异步站点):同上', async () => {
    const handle = runSandboxedAsync('node -v', { cwd: DIR });
    const result = await handle.result;
    expect(result.blocked).toBe(false);
    const hits = entriesReportingProbe();
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});
