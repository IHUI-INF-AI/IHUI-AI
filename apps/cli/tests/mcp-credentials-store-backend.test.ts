// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D146 — MCP 凭据落盘档位的三态判据与迁移防护(2026-09-29 拍板"按预填")。
 *
 * 票第 6 栏的三条验收在本文件逐条钉住(不钉住就等于没测):
 *   ① 可见化:任何一次运行都能回答"存在哪、哪一档、为什么" —— 降级档**不接受"没打印"**;
 *   ② 新写入即加密:非降级档上,盘上那份文件**必须**再也 `JSON.parse` 不出 token
 *      (等价于票面那条 `grep -c '"accessToken"'` 必须为 0);
 *   ③ 迁移有任何不确定 ⇒ 保留原文件不覆盖并大声报 —— 判据不是"报了错",而是"**字节没动过**",
 *      因为票第 8 栏点名的最高风险就是"迁移把可用凭据变孤儿"。
 *
 * 档位钉选用 `IHUI_MCP_CRED_BACKEND='encrypted-file'`:OS 档(Windows DPAPI)每次判档都要派生
 * 一个 PowerShell 进程,把它放进单测会让这组用例既慢又取决于机器状态。
 * 注意"钉选只往低处钉"——`describeCredentialStore()` 报的仍是**实际**那一档,不是被 env 冒充的档。
 *
 * 凭据值一律是 `d146-fixture-` 前缀的假 token;阳性对照判的是"**键名**还在不在盘上",
 * 真实 token 原文绝不进 stdout / 日志 / 断言字符串(AGENTS §5d)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
// arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 与 mcp-refresh-single-flight.test.ts 同一夹具落点,不得另开第二处 until 2026-12-28

import {
  getCredentialsPath,
  loadMcpCredentials,
  saveMcpCredentials,
  setCredential,
  getCredential,
  describeCredentialStore,
  announceCredentialStore,
  parseCredentialEnvelope,
  sealCredentialEnvelope,
  CRED_PLAINTEXT_ENV,
  CRED_BACKEND_ENV,
  type McpCredentials,
} from '../src/tools/mcp-credentials.js';
import { Command } from 'commander';
import { registerCapabilitiesCommand } from '../src/commands/capabilities.js';

const FIXTURE = 'd146-fixture-access-token';
const SERVER = 'https://mcp-d146.example.com';

function credFile(dir: string): string {
  return path.join(dir, 'mcp-credentials.json');
}

function sampleCreds(): McpCredentials {
  return {
    [SERVER]: {
      accessToken: FIXTURE,
      refreshToken: `${FIXTURE}-refresh`,
      expiresAt: Date.now() + 3_600_000,
      scope: ['read'],
      obtainedAt: Date.now(),
      generation: 1,
    },
  };
}

function printedLines(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls
    .map((args: unknown[]) => args.map((a) => String(a)).join(' '))
    .join('\n');
}

describe('D146 凭据落盘档位(可见化 / 新写入即加密 / 迁移不覆盖)', () => {
  let scratch: string;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    scratch = mkScratch(`d146-store-${randomUUID().slice(0, 8)}`);
    savedEnv = { ...process.env };
    process.env.IHUI_HOME = scratch;
    delete process.env[CRED_PLAINTEXT_ENV];
    delete process.env[CRED_BACKEND_ENV];
  });

  afterEach(() => {
    process.env = savedEnv;
    rmScratch(scratch);
    vi.restoreAllMocks();
  });

  // ==================== 验收①:可见化 ====================

  it('明文档的 describe 必须同时给出"档位 + 路径 + 原因"(不接受"没打印")', async () => {
    process.env[CRED_PLAINTEXT_ENV] = '1';
    const desc = await describeCredentialStore();
    expect(desc.backend).toBe('plaintext-file');
    expect(desc.path).toBe(getCredentialsPath());
    expect(desc.reasonCode).toBe('env-plaintext-opt-in');
    expect(desc.reason).toContain('明文');
    expect(desc.reason).toContain(desc.path);
    expect(desc.detail.length).toBeGreaterThan(0);
  });

  it('写盘后自检必须喊出来:逃生口只关"要不要加密",不关"要不要喊"', async () => {
    process.env[CRED_PLAINTEXT_ENV] = '1';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await saveMcpCredentials(sampleCreds());
    const oneShot = printedLines(warn);
    expect(oneShot).toContain('明文');

    const desc = await announceCredentialStore();
    expect(desc.backend).toBe('plaintext-file');
    expect(printedLines(warn)).toContain(desc.path);

    // 阳性对照:这一档**就是**明文。判据若看不见这种形态,后面"非降级档必须为 0"就是空支票。
    const raw = await fs.readFile(credFile(scratch), 'utf-8');
    expect(raw).toContain('"accessToken"');
    expect(JSON.parse(raw)[SERVER].accessToken).toBe(FIXTURE);
  });

  it('不钉选档位时也必须答得出(实际档由机器能力判出,拒绝空回复)', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const desc = await describeCredentialStore();
    expect(['keychain', 'encrypted-file', 'plaintext-file']).toContain(desc.backend);
    expect(desc.path.length).toBeGreaterThan(0);
    expect(desc.reason.length).toBeGreaterThan(0);
    expect(desc.reasonCode.length).toBeGreaterThan(0);
  });

  // ==================== 验收②:新写入即加密 ====================

  it('encrypted-file 档:写盘后那份文件再也 JSON.parse 不出 token', async () => {
    process.env[CRED_BACKEND_ENV] = 'encrypted-file';
    await saveMcpCredentials(sampleCreds());
    const raw = await fs.readFile(credFile(scratch), 'utf-8');
    expect(parseCredentialEnvelope(raw)).not.toBeNull();
    expect(raw).not.toContain('"accessToken"');
    expect(raw).not.toContain(FIXTURE);
    // 读回来必须还是那份凭据 —— 加密不是丢数据的借口
    const back = await loadMcpCredentials();
    expect(back[SERVER]?.accessToken).toBe(FIXTURE);
  });

  it('主密钥文件是信封而不是口令(恰一层、字段不多不少)', async () => {
    process.env[CRED_BACKEND_ENV] = 'encrypted-file';
    await setCredential(SERVER, sampleCreds()[SERVER] as NonNullable<McpCredentials[string]>);
    const keyRaw = await fs.readFile(path.join(scratch, 'mcp-cred-key.json'), 'utf-8');
    const parsed = JSON.parse(keyRaw) as Record<string, Record<string, unknown>>;
    expect(Object.keys(parsed)).toEqual(['ihuiMcpKeyV1']);
    expect(Object.keys(parsed.ihuiMcpKeyV1).sort()).toEqual(['ct', 'iv', 'mb']);
    expect(keyRaw).not.toContain(FIXTURE);
  });

  it('describe 的 keyPath 与实际生成的密钥文件同一路径(报告不得指向别处)', async () => {
    process.env[CRED_BACKEND_ENV] = 'encrypted-file';
    await saveMcpCredentials(sampleCreds());
    const desc = await describeCredentialStore();
    expect(desc.keyPath).toBe(path.join(scratch, 'mcp-cred-key.json'));
    expect(desc.envelopeAtRest).toBe(true);
    expect(desc.plaintextAtRest).toBe(false);
    expect(desc.entryCount).toBe(1);
  });

  // ==================== 验收③:迁移与"不覆盖" ====================

  it('存量明文在首次读时迁移为信封,且反复读不叠加层数', async () => {
    process.env[CRED_BACKEND_ENV] = 'encrypted-file';
    const target = credFile(scratch);
    await fs.writeFile(target, JSON.stringify(sampleCreds(), null, 2), 'utf-8');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const first = await loadMcpCredentials();
    expect(first[SERVER]?.accessToken).toBe(FIXTURE);
    const migrated = await fs.readFile(target, 'utf-8');
    expect(parseCredentialEnvelope(migrated)).not.toBeNull();
    expect(migrated).not.toContain('"accessToken"');

    await getCredential(SERVER);
    await loadMcpCredentials();
    const after = await fs.readFile(target, 'utf-8');
    expect(parseCredentialEnvelope(after)).not.toBeNull();
    // 恰一层:解开一次就应当是明文 JSON,再解一次不是信封(双重包裹即幂等失败)
    const body = parseCredentialEnvelope(after);
    expect(body).not.toBeNull();
    expect(printedLines(info)).toContain('已加密存储');
  });

  it('信封在而本机没有可用密钥 ⇒ 大声报 + **原文件一个字节都没动**', async () => {
    process.env[CRED_BACKEND_ENV] = 'encrypted-file';
    const target = credFile(scratch);
    await fs.writeFile(
      target,
      JSON.stringify({
        ihuiVaultV1: {
          alg: 'A256GCM',
          kid: 'deadbeefcafebabe',
          iv: 'AAAAAAAAAAAAAAAA',
          ct: 'AAAAAAAAAAAAAAAAAAAAAAAA',
        },
      }),
      'utf-8',
    );
    const before = await fs.readFile(target, 'utf-8');

    // 读侧的"解不开"由 G-709 那一版收口成**抛错**(而不是折成空 store)——
    // 本票要的是"不覆盖 + 大声报",两者都成立;把断言写成"返回 {}"会替一版更弱的行为背书。
    const thrown = await loadMcpCredentials().then(
      () => '',
      (e: unknown) => String((e as Error).message),
    );
    expect(thrown).toMatch(/MCP credential store cannot be read safely/);
    // 喊出来的那句必须带**稳定码**:只有人话的警告脚本与巡检都消费不了(AGENTS §5e 同一条禁令)
    expect(thrown).toContain('reason=machine-key');
    expect(await fs.readFile(target, 'utf-8')).toBe(before);
    const desc = await describeCredentialStore();
    expect(desc.unreadableAtRest).toBe(true);
    expect(desc.plaintextAtRest).toBe(false);
    expect(desc.reasonCode).toContain('machine-key');
  });

  it('口令文件的机器指纹与本机不符(换机/换账号)⇒ 判"解不开"、不覆盖口令、也不冒充已加密', async () => {
    process.env[CRED_BACKEND_ENV] = 'encrypted-file';
    const keyPath = path.join(scratch, 'mcp-cred-key.json');
    const forged = JSON.stringify({
      ihuiMcpKeyV1: { mb: '0000000000000000', iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAA' },
    });
    await fs.writeFile(keyPath, forged, 'utf-8');
    const target = credFile(scratch);
    const original = JSON.stringify({
      ihuiVaultV1: {
        alg: 'A256GCM',
        kid: '1111111122222222',
        iv: 'AAAAAAAAAAAAAAAA',
        ct: 'AAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });
    await fs.writeFile(target, original, 'utf-8');

    await expect(loadMcpCredentials()).rejects.toThrow(/machine-key-binding-mismatch/);
    // 两份文件都必须原地不动:换机之后它们是唯一还能救回凭据的东西
    expect(await fs.readFile(keyPath, 'utf-8')).toBe(forged);
    expect(await fs.readFile(target, 'utf-8')).toBe(original);
    const desc = await describeCredentialStore();
    expect(desc.unreadableAtRest).toBe(true);
    expect(desc.reasonCode).not.toBe('');
    // 明文档也不能被冒充成"已加密":档位必须落到 plaintext-file 并给出原因
    expect(desc.backend).toBe('plaintext-file');
    expect(desc.reason).toContain('明文');
  });

  it('明文档的降级必须仍走同一条"喊"的出口(不允许静默回退)', async () => {
    // 空 store + 逃生口:describe 判的是"这一档会被用",而 announce 必须把它喊出来
    process.env[CRED_PLAINTEXT_ENV] = '1';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const desc = await announceCredentialStore();
    expect(desc.backend).toBe('plaintext-file');
    expect(printedLines(warn)).toContain('明文');
    expect(printedLines(warn)).toContain(desc.path);
  });

  // ==================== 形状锁 ====================

  it('capabilities --json 必须带出 credentialStore 的"档位 + 路径 + 原因"(票第 6 栏①)', async () => {
    process.env[CRED_BACKEND_ENV] = 'encrypted-file';
    await saveMcpCredentials(sampleCreds());

    const program = new Command();
    program.name('ihui-test').exitOverride().configureOutput({ writeOut: () => {}, writeErr: () => {} });
    registerCapabilitiesCommand(program);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await program.parseAsync(['node', 'ihui', 'capabilities', '--json']);

    const out = printedLines(info);
    const json = JSON.parse(out.slice(out.indexOf('{'))) as {
      credentialStore?: { backend?: string; path?: string; reason?: string; reasonCode?: string };
    };
    expect(json.credentialStore).toBeDefined();
    expect(json.credentialStore?.backend).toBe('encrypted-file');
    expect(json.credentialStore?.path).toBe(credFile(scratch));
    expect((json.credentialStore?.reason ?? '').length).toBeGreaterThan(0);
    expect((json.credentialStore?.reasonCode ?? '').length).toBeGreaterThan(0);
    // 状态命令自己也不得把 token 原文带出去(JSON 里只允许掩码串)
    expect(out).not.toContain(FIXTURE);
  });

  it('sealCredentialEnvelope 的产出必须过同一份"恰一层"结构判据(判据与出口同源)', () => {
    const resealed = sealCredentialEnvelope(JSON.stringify(sampleCreds()), Buffer.alloc(32, 7), 'a'.repeat(16));
    const body = parseCredentialEnvelope(resealed);
    expect(body).not.toBeNull();
    expect(body?.alg).toBe('A256GCM');
    expect(body?.kid).toBe('a'.repeat(16));
    expect(typeof body?.iv).toBe('string');
    expect(typeof body?.ct).toBe('string');
    // 结构判据不接受"多一个键"(否则双重包裹会被读成已加密)
    const extra = JSON.parse(resealed) as Record<string, Record<string, unknown>>;
    expect(Object.keys(extra)).toEqual(['ihuiVaultV1']);
    expect(Object.keys(extra.ihuiVaultV1).sort()).toEqual(['alg', 'ct', 'iv', 'kid']);
  });

  it('非信封形态不得被 parseCredentialEnvelope 认成"已加密"(否则明文会被静默放过)', () => {
    expect(parseCredentialEnvelope(JSON.stringify(sampleCreds()))).toBeNull();
    expect(parseCredentialEnvelope('{"ihuiVaultV1":{"alg":"A256GCM","kid":"x"}}')).toBeNull();
    expect(parseCredentialEnvelope('not json')).toBeNull();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
