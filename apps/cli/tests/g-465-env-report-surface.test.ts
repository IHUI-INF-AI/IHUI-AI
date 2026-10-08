// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-465:子进程 env 边界的凭据形态面验收用例。
 *
 * 病灶(票面 + 2026-10-06 真实现直测复测):`matchPattern` 的 deny 后缀族
 * (`*_API_KEY/*_SECRET/*_TOKEN/*_PASSWORD`)盖不到单数 `*_KEY`、`*_SENDKEY`、
 * `*_TOKEN_ID`、`*_AUTH_PAYLOAD_FILE`、`*_TOKEN_PATH` 等形态,
 * LIBTV_ACCESS_KEY / SERVERCHAN_SENDKEY / TUNNEL_SERVICE_TOKEN_ID /
 * QODER_SDK_AUTH_PAYLOAD_FILE / TRAE_JWT_TOKEN_PATH 原样漏进子进程。
 *
 * 2026-10-06 机主拍板的出路:先只报名不拦(宁窄不误伤)。**2026-10-08 机主拍板采纳扩展**:
 * 子进程 env 从「只剥我方凭据」扩到「一切凭据形态」,MCP/hook 子进程改白名单透传
 * (默认全剥)作逃生门 —— 报名面自此反转为**剥离侧报名**:点名"这个子进程被剥掉了哪些
 * 疑似凭据变量",作为第三方 CLI 突然拿不到凭据时的直接取证出口。
 *
 * 本套件钉三件事:
 *   ① 凭据形态模式表逐字钉死,且与 deny 形态集**同源**(10-08 拍板升格进 deny);
 *   ② 剥离对账:原残留名单全部被剥 + 被剥离侧报名点名,非凭据形态不误伤;
 *   ③ 两条 spawn 站点(同步/异步)真的装了车 —— 审计条目带 suspiciousEnvVars(被剥凭据名单)。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  buildFilteredEnv,
  CREDENTIAL_SHAPE_BLOCKED_PATTERNS,
  DEFAULT_BLOCKED_ENV_VARS,
  detectStrippedSuspiciousEnvVars,
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

  it('表须同源:deny 形态集必须包含全部报名模式(2026-10-08 拍板升格,报名面即剥离面)', () => {
    for (const p of SUSPICIOUS_CREDENTIAL_ENV_PATTERNS) {
      expect(CREDENTIAL_SHAPE_BLOCKED_PATTERNS, `报名模式 ${p} 必须在 deny 形态集里`).toContain(p);
    }
  });
});

describe('G-465 剥离侧对账(2026-10-08 拍板:原"报名不拦"反转为"拦了报名给你看")', () => {
  // 逐键 set/delete,不做 process.env 整体替换(与 child-env-boundary.test.ts 同一既有形态)
  // 原残留名单五键:今天必须全部被剥,且被剥离侧报名点名
  const STRIPPED_EXPECTED: string[] = [
    'LIBTV_ACCESS_KEY',
    'SERVERCHAN_SENDKEY',
    'TUNNEL_SERVICE_TOKEN_ID',
    'QODER_SDK_AUTH_PAYLOAD_FILE',
    'TRAE_JWT_TOKEN_PATH',
  ];
  // 对照组:一直被既有后缀族盖住的凭据,同样被剥 + 被点名(剥离侧报名对所有被剥凭据形态生效)
  const BLOCKED_CONTROLS: string[] = [
    'IHUI_API_KEY',
    'STEPFUN_API_KEY',
    'AI_CALLBACK_SECRET',
    'IHUI_AGENT_TOKEN',
    'DB_PASSWORD',
    'IHUI_SERVE_MACHINE_KEYS',
  ];
  // 反对照组:非凭据形态,既不该剥也不该报
  const NEGATIVE_CONTROLS: string[] = ['G465_VENDOR_PROFILE', 'G465_PLAIN_FLAG'];
  const CANDIDATES = [...STRIPPED_EXPECTED, ...BLOCKED_CONTROLS, ...NEGATIVE_CONTROLS];

  it('原残留五键 + 对照键全部被剥且被剥离侧报名点名;反对照组幸存不报名', () => {
    const previous = new Map<string, string | undefined>();
    try {
      for (const k of CANDIDATES) {
        previous.set(k, process.env[k]);
        process.env[k] = 'sentinel-value-not-a-real-credential';
      }
      const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
      // 剥离:原残留名单一个不剩(2026-10-08 拍板的核心翻转)
      for (const k of STRIPPED_EXPECTED) {
        expect(filtered[k], `${k} 应当被宽 deny 剥除`).toBeUndefined();
      }
      // 对照键照旧:一个不剩
      for (const k of BLOCKED_CONTROLS) {
        expect(filtered[k], `${k} 应当被既有后缀族盖住`).toBeUndefined();
      }
      // 反对照组:幸存
      for (const k of NEGATIVE_CONTROLS) {
        expect(filtered[k]).toBe('sentinel-value-not-a-real-credential');
      }
      // 剥离侧报名:被剥的凭据形态键全部被点名(归因词表 = 完整 deny 形态集,窄四族在前);
      // IHUI_SERVE_MACHINE_KEYS 属具名 deny 条目而非形态模式,被剥但无模式可点,不出现。
      const reports = detectStrippedSuspiciousEnvVars(process.env, filtered);
      const expectedReported = [
        ...STRIPPED_EXPECTED,
        'IHUI_API_KEY',
        'STEPFUN_API_KEY',
        'AI_CALLBACK_SECRET',
        'IHUI_AGENT_TOKEN',
        'DB_PASSWORD',
      ].sort();
      const reportedCandidates = CANDIDATES.filter((k) => reports.some((r) => r.name === k));
      expect(reportedCandidates.slice().sort()).toEqual(expectedReported);
      const byName = new Map(reports.map((r) => [r.name, r.pattern]));
      expect(byName.get('SERVERCHAN_SENDKEY')).toBe('*_SENDKEY');
      expect(byName.get('TUNNEL_SERVICE_TOKEN_ID')).toBe('*_TOKEN_ID');
      expect(byName.get('DB_PASSWORD')).toBe('*_PASSWORD');
      expect(byName.get('LIBTV_ACCESS_KEY')).toBe('*_KEY');
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
