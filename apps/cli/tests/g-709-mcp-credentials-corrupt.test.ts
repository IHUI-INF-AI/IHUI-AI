// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-709 — MCP 凭据 store 不得把"损坏 JSON / 形状不合"折算成空 store。
 *
 * 票面五条判据(与 tests/mcp-credentials-corrupt-store.test.ts 同源不同面:那份验的是
 * 六组判据全谱,本份按票面验收清单逐条钉,两组互为独立取证):
 *   ① 损坏 JSON ⇒ 抛 + 备份件存在,且备份内容与损坏原文件**逐字一致**;
 *   ② 形状不合(合法 JSON 但是数组/字符串)⇒ 同 ①;
 *   ③ 正常 JSON ⇒ 原样读出、不产备份件;
 *   ④ ENOENT ⇒ 返回 {} 不抛(唯一可以折算成空 store 的形态);
 *   ⑤ 故障路径的所有 console 输出**不含凭据样本值**。
 *
 * 夹具落点唯一取自 `scripts/lib/scratch-dir.mjs`(§26,不落 os.tmpdir()/裸 mkdtemp);
 * 存储路径经 IHUI_HOME 重定向,绝不写真实 `~/.ihui`。
 * 凭据卫生:token 一律用本文件自造的哨兵字符串,断言只报命中/未命中。
 */
import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 与 tests/mcp-credentials-corrupt-store.test.ts 同一条实测教训:本文件带 vi.mock 会被 Vite
// 外化给 Node 运行时,静态 '../../scripts/…' 在运行时被拧成 '/scripts/…';按 importer 逐字
// 解析的三条 '../' + import.meta.url 才是真实深度(apps/cli/tests → 仓根)。
interface ScratchDirModule {
  mkScratch(prefix?: string): string;
  rmScratch(dir: string): void;
}
let mkScratch!: (prefix?: string) => string;
let rmScratch!: (dir: string) => void;

beforeAll(async () => {
  const spec = pathToFileURL(
    fileURLToPath(new URL('../../../scripts/lib/scratch-dir.mjs', import.meta.url)),
  ).href;
  const loaded: unknown = await import(spec);
  const mod = loaded as Partial<ScratchDirModule>;
  if (typeof mod.mkScratch !== 'function' || typeof mod.rmScratch !== 'function') {
    throw new Error('scratch-dir.mjs 解析失败 —— 夹具落点不许退到 os.tmpdir()');
  }
  mkScratch = mod.mkScratch;
  rmScratch = mod.rmScratch;
});

import {
  getCredentialsPath,
  loadMcpCredentials,
  readCredentialStoreSnapshot,
  readMcpCredentialStoreProblem,
  McpCredentialStoreError,
  type McpCredentialStoreSnapshot,
} from '../src/tools/mcp-credentials.js';

const SENTINEL_A = 'sentinel-g709-access-A-do-not-log';
const SENTINEL_B = 'sentinel-g709-access-B-do-not-log';

let scratchHome = '';
let originalEnv: NodeJS.ProcessEnv = {};
/** 捕获本用例内所有 console 输出,用于判据⑤(凭据样本值不得进日志) */
let logged: string[] = [];
let spies: (() => void)[] = [];

function storeDir(): string {
  return path.dirname(getCredentialsPath());
}
function storePathOf(): string {
  return getCredentialsPath();
}
/** 同目录里所有 `.corrupt-*` 隔离件(= 票面说的"备份原文件") */
async function listEvidence(): Promise<string[]> {
  const names = await fs.readdir(storeDir());
  return names
    .filter((n) => n.startsWith(`${path.basename(storePathOf())}.corrupt-`))
    .sort();
}
async function readStoreFile(): Promise<string> {
  return fs.readFile(storePathOf(), 'utf-8');
}
async function writeStoreFile(text: string): Promise<void> {
  await fs.mkdir(storeDir(), { recursive: true });
  await fs.writeFile(storePathOf(), text, 'utf-8');
}
/** 预置两条凭据(经生产写入口),让"损坏后"的读有可被清空的既存样本 */
async function seedTwoCredentials(): Promise<void> {
  const { setCredential } = await import('../src/tools/mcp-credentials.js');
  await setCredential('https://a.example.com/mcp', { accessToken: SENTINEL_A, obtainedAt: 1 });
  await setCredential('https://b.example.com/mcp', { accessToken: SENTINEL_B, obtainedAt: 2 });
}
/** 抛出的未知错误收窄成快照:只认稳定属性,不靠 instanceof 单条通道 */
function asStoreFailure(err: unknown): McpCredentialStoreSnapshot | null {
  return err instanceof McpCredentialStoreError
    ? {
        state: err.mcpCredentialStoreProblem,
        credentials: {},
        storePath: err.storePath,
        evidencePath: err.evidencePath,
        reasonCode: err.storeReasonCode,
        detail: '',
      }
    : null;
}

beforeEach(() => {
  scratchHome = mkScratch('g-709-mcp-cred-');
  originalEnv = { ...process.env };
  process.env.IHUI_HOME = scratchHome;
  // 钉在档位③(明文):本票判的是"读坏/没有"这一维,加密档位由 D146 自己的测试判;
  // 顺带让夹具不依赖 PowerShell 探针(秒级外部状态)。
  process.env.IHUI_MCP_CRED_PLAINTEXT = '1';
  logged = [];
  spies = [];
  for (const level of ['warn', 'info', 'error'] as const) {
    const spy = vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    });
    spies.push(() => spy.mockRestore());
  }
});

afterEach(() => {
  for (const restore of spies) restore();
  spies = [];
  process.env = originalEnv;
  rmScratch(scratchHome);
});

describe('G-709 ①:损坏 JSON ⇒ 抛 + 备份件逐字留证', () => {
  it('半截 JSON ⇒ loadMcpCredentials 抛 corrupt,备份件存在且内容与损坏原文件逐字一致', async () => {
    await seedTwoCredentials();
    const intact = await readStoreFile();
    expect(intact).toContain(SENTINEL_A); // 阳性对照:store 里确实有样本,后面的"损坏"才是真损坏
    const broken = intact.slice(0, Math.floor(intact.length / 2));
    await writeStoreFile(broken);

    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    expect(raw).toBeInstanceOf(McpCredentialStoreError);
    const snap = asStoreFailure(raw);
    expect(snap?.state).toBe('corrupt');
    expect(snap?.reasonCode).toBe('payload-not-json');
    expect(snap?.storePath).toBe(storePathOf()); // 点名路径

    const evidence = await listEvidence();
    expect(evidence).toHaveLength(1);
    const evidenceBytes = await fs.readFile(path.join(storeDir(), evidence[0] ?? ''), 'utf-8');
    expect(evidenceBytes).toBe(broken); // 备份逐字等于损坏原文件(原字节可复得)
    expect(await readStoreFile()).toBe(broken); // 原文件留在原位,不被移走、不被覆盖
  });
});

describe('G-709 ②:形状不合(合法 JSON 但不是凭据集合)⇒ 同①处置', () => {
  const shapes: Array<{ label: string; text: string; reasonCode: string }> = [
    { label: '顶层是数组', text: '["not","a","store"]', reasonCode: 'payload-not-object' },
    { label: '顶层是字符串', text: '"just a string"', reasonCode: 'payload-not-object' },
  ];
  for (const shape of shapes) {
    it(`${shape.label} ⇒ 抛 corrupt + 备份件逐字一致`, async () => {
      await writeStoreFile(shape.text);
      const raw = await loadMcpCredentials().catch((e: unknown) => e);
      const snap = asStoreFailure(raw);
      expect(snap?.state).toBe('corrupt');
      expect(snap?.reasonCode).toBe(shape.reasonCode);
      const evidence = await listEvidence();
      expect(evidence).toHaveLength(1);
      const evidenceBytes = await fs.readFile(path.join(storeDir(), evidence[0] ?? ''), 'utf-8');
      expect(evidenceBytes).toBe(shape.text);
      expect(await readStoreFile()).toBe(shape.text);
    });
  }
});

describe('G-709 ③:正常 JSON ⇒ 原样读出、无备份件', () => {
  it('完好凭据集合读回原样,且不产任何 .corrupt-* 隔离件(判据不是"一律判红")', async () => {
    await seedTwoCredentials();
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('ok');
    expect(snap.credentials['https://a.example.com/mcp']?.accessToken).toBe(SENTINEL_A);
    expect(snap.credentials['https://b.example.com/mcp']?.accessToken).toBe(SENTINEL_B);
    const viaLoad = await loadMcpCredentials();
    expect(viaLoad).toEqual(snap.credentials);
    expect(await listEvidence()).toEqual([]);
  });
});

describe('G-709 ④:ENOENT ⇒ 返回 {} 不抛(唯一可折算成空 store 的形态)', () => {
  it('文件不存在 ⇒ loadMcpCredentials() 返回 {}、snapshot.state=absent,不产备份件', async () => {
    const creds = await loadMcpCredentials();
    expect(creds).toEqual({});
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('absent');
    expect(snap.reasonCode).toBe('absent');
    expect(snap.evidencePath).toBeNull();
    expect(await listEvidence()).toEqual([]);
  });
});

describe('G-709 ⑤:故障路径的所有 console 输出不含凭据样本值', () => {
  it('损坏读盘时 warn/error 捕获面里找不到任一哨兵 token', async () => {
    await seedTwoCredentials();
    await writeStoreFile('{this is not json at all');
    logged = [];
    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    expect(readMcpCredentialStoreProblem(raw)).toBe('corrupt'); // 确认真的走了故障路径
    for (const line of logged) {
      expect(line).not.toContain(SENTINEL_A);
      expect(line).not.toContain(SENTINEL_B);
    }
    // 阳性对照(别让断言在空集上假绿):故障喊话确实发生了,且点名了路径
    expect(logged.join('\n')).toContain(storePathOf());
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
