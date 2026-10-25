// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L7570 第③格 — 凭据原文不落诊断(诊断量代替原文)。
 *
 * 拦的是这一型通道:`classifyCredentialPayload` 把 `JSON.parse` 的原始 SyntaxError 挂进
 * `McpCredentialStoreError.cause`,而 V8 短消息策略会把**出错位置附近的原文片段**嵌进
 * SyntaxError.message(实测 Node 24:`JSON.parse('sentinel-bare…')` →
 * `Unexpected token 's', "sentinel-b"... is not valid JSON`)。cause 一旦离开本模块:
 *   - crash 链路(`crash-handler.ts` 的 `flattenErrorForReport`)把 cause 链逐层序列化
 *     进崩溃上报(`Caused by: SyntaxError: <含原文片段的消息>`);
 *   - 调用方 `console.error(err)` 会把 cause 链打进终端。
 * 修法(`redactedParseCause`):cause 只携带**诊断量**(异常名 + 失败位置数字),
 * 原文一律不携带;组装文案过 `@ihui/shared/utils/redact` 的 `redactSecrets`(唯一脱敏出口)。
 * 与上游同型:officialMcpCredentials.ts 的凭据诊断只记 JWT 剩余秒数,不记原文(票面转述)。
 *
 * 判据(每条都先自证威胁模型,再断言出口干净;每条都有正向对照防误伤):
 *   ① 裸 token 形态:先证明同样的文本直接 JSON.parse 时 V8 确实嵌原文片段(威胁真实),
 *      再断言 err.message、cause 链投影、console 输出三面都不含哨兵与那个片段;
 *      诊断量仍在(cause.name=SyntaxError、message 以 JSON parse failed 开头)。
 *   ② 三段式 JWT 形态:V8 嵌的是 JWT 开头片段 ⇒ 断言 cause 链不含任何一段、不含该片段。
 *   ③ 深处失败形态:V8 本就紧凑只报位置 ⇒ 断言位置数字(诊断量)被保留进 cause,
 *      且哨兵不进任何诊断面(锁"位置在、原文不在"的形状防回归)。
 *   ④ 正向对照:完好凭据集合不受影响(state=ok)——判据不误伤。
 *
 * 凭据卫生:所有 token 值都是本文件自造的哨兵字符串(SENTINEL_*);夹具落点唯一取自
 * `scripts/lib/scratch-dir.mjs`(§15b),绝不写真实 `~/.ihui`。
 */
import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 与 tests/mcp-credentials-corrupt-store.test.ts 同一条实测教训:带 vi.mock 的测试文件会被
// Vite 外化给 Node 运行时,静态 '../../../scripts/…' 在运行时被拧歪;按 importer 逐字解析的
// 三条 '../' + import.meta.url 才是真实深度(apps/cli/tests → 仓根)。
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
  McpCredentialStoreError,
} from '../src/tools/mcp-credentials.js';

const URL_A = 'https://a.example.com/mcp';
const URL_B = 'https://b.example.com/mcp';
const SENTINEL_BARE = 'sentinel-bare-token-not-valid-json';
const SENTINEL_JWT_HEAD = 'eyJzZW50aW5lbC1oZWFk';
const SENTINEL_JWT_BODY = 'eyJzZW50aW5lbC1ib2R5';
const SENTINEL_JWT_SIG = 'c2VudGluZWwtc2ln';
const SENTINEL_JWT = `${SENTINEL_JWT_HEAD}.${SENTINEL_JWT_BODY}.${SENTINEL_JWT_SIG}`;
const SENTINEL_X = 'sentinel-deep-position-token';

let scratchHome = '';
let originalEnv: NodeJS.ProcessEnv = {};
/** 捕获本用例内所有 console 输出,用于"凭据内容不得进日志"的阳性对照 */
let logged: string[] = [];
let spies: (() => void)[] = [];

function storeDir(): string {
  return path.dirname(getCredentialsPath());
}
function storePathOf(): string {
  return getCredentialsPath();
}

async function writeStoreFile(text: string): Promise<void> {
  await fs.mkdir(storeDir(), { recursive: true });
  await fs.writeFile(storePathOf(), text, 'utf-8');
}

async function seedTwoCredentials(): Promise<void> {
  const creds = {
    [URL_A]: { accessToken: SENTINEL_X, obtainedAt: 1 },
    [URL_B]: { accessToken: SENTINEL_BARE, obtainedAt: 2 },
  };
  await writeStoreFile(JSON.stringify(creds, null, 2));
}

/** 同一文本直接 JSON.parse 的 V8 原始消息(测试内自证威胁模型用) */
function v8MessageOf(text: string): string {
  try {
    JSON.parse(text);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return '';
}

/**
 * crash 报告的 cause 链消费方式(与 crash-handler.ts 的 flattenErrorForReport 同型):
 * 根 message + 沿 cause 逐层的 "Name: message"。返回投影全文,供"原文不出现在任何一节"断言。
 * 崩溃上报看到的就是这份全文。
 */
async function crashProjectionOf(err: unknown): Promise<string> {
  const lines: string[] = [];
  let node: unknown = err;
  let guard = 0;
  while (node instanceof Error && guard < 8) {
    lines.push(`${node.name}: ${node.message}`);
    node = (node as { cause?: unknown }).cause;
    guard += 1;
  }
  return lines.join('\n');
}

function causeOf(err: unknown): Error {
  const direct = err instanceof McpCredentialStoreError ? err : null;
  const cause = direct?.cause;
  if (!(cause instanceof Error)) {
    throw new Error('McpCredentialStoreError.cause 应为 Error(脱敏诊断代理)');
  }
  return cause;
}

beforeEach(() => {
  scratchHome = mkScratch('mcp-creds-diag-');
  originalEnv = { ...process.env };
  process.env.IHUI_HOME = scratchHome;
  // 钉在档位③(明文):本票判的是"诊断面无原文"这一维,加密档位由 D146 自己的测试判。
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

describe('L7570 ①:裸 token 短文本 ⇒ 原文片段不进 cause 链,诊断量(异常名)仍在', () => {
  it('err.message、cause 链投影、console 输出三面都不含哨兵与 V8 会嵌入的片段', async () => {
    await writeStoreFile(SENTINEL_BARE);
    logged = [];

    // 威胁模型自证:同样的文本直接 JSON.parse,V8 短消息确实嵌原文片段
    const v8Msg = v8MessageOf(SENTINEL_BARE);
    expect(v8Msg).toContain(SENTINEL_BARE.slice(0, 8));

    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    expect(raw).toBeInstanceOf(McpCredentialStoreError);
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('corrupt');
    expect(snap.reasonCode).toBe('payload-not-json');

    // 诊断量仍在:异常名保留、代理文案可点名
    const cause = causeOf(raw);
    expect(cause.name).toBe('SyntaxError');
    expect(cause.message.startsWith('JSON parse failed')).toBe(true);

    // 原文三面皆无:根消息 + cause 链投影(crash 报告所见)与 console 各行
    const projection = await crashProjectionOf(raw);
    expect(projection).not.toContain(SENTINEL_BARE);
    expect(projection).not.toContain(SENTINEL_BARE.slice(0, 8));
    expect(projection).not.toContain(v8Msg);
    for (const line of logged) {
      expect(line).not.toContain(SENTINEL_BARE);
    }
  });
});

describe('L7570 ②:三段式 JWT 形态 ⇒ 任何一段都不进 cause 链', () => {
  it('裸 JWT 文本作为 store 内容:根消息、cause 链、console 三面无任何一段', async () => {
    await writeStoreFile(SENTINEL_JWT);
    logged = [];

    const v8Msg = v8MessageOf(SENTINEL_JWT);
    expect(v8Msg).toContain(SENTINEL_JWT_HEAD.slice(0, 8)); // V8 嵌的是 JWT 开头片段

    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    expect(raw).toBeInstanceOf(McpCredentialStoreError);

    const projection = await crashProjectionOf(raw);
    expect(projection).not.toContain(SENTINEL_JWT_HEAD);
    expect(projection).not.toContain(SENTINEL_JWT_BODY);
    expect(projection).not.toContain(SENTINEL_JWT_SIG);
    expect(projection).not.toContain(SENTINEL_JWT);
    expect(projection).not.toContain(SENTINEL_JWT_HEAD.slice(0, 8));
    for (const line of logged) {
      expect(line).not.toContain(SENTINEL_JWT);
      expect(line).not.toContain(SENTINEL_JWT_HEAD);
      expect(line).not.toContain(SENTINEL_JWT_SIG);
    }
  });
});

describe('L7570 ③:深处失败的 SyntaxError ⇒ 位置诊断量保留,原文不进', () => {
  it('缺逗号形态:V8 紧凑消息的位置数字被带进 cause,哨兵不出现在任何诊断面', async () => {
    await seedTwoCredentials();
    const intact = await fs.readFile(storePathOf(), 'utf-8');
    expect(intact).toContain(SENTINEL_X); // 阳性对照:原文里确实有哨兵
    await writeStoreFile(`{"accessToken": "${SENTINEL_X}" "trailing`);
    logged = [];

    const v8Msg = v8MessageOf(`{"accessToken": "${SENTINEL_X}" "trailing`);
    const pos = /position (\d+)/.exec(v8Msg)?.[1];
    expect(pos).toBeDefined(); // V8 对深处失败本就报位置:诊断量的来源真实

    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    expect(raw).toBeInstanceOf(McpCredentialStoreError);
    const cause = causeOf(raw);
    expect(cause.name).toBe('SyntaxError');
    expect(pos === undefined ? false : cause.message.includes(`at position ${pos}`)).toBe(true);

    const projection = await crashProjectionOf(raw);
    expect(projection).not.toContain(SENTINEL_X);
    for (const line of logged) {
      expect(line).not.toContain(SENTINEL_X);
    }
  });
});

describe('L7570 ④:正向对照 —— 完好凭据集合不受判据影响', () => {
  it('完好文件 ⇒ state=ok、不抛、两条凭据都可读(判据不是"一律判红")', async () => {
    await seedTwoCredentials();
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('ok');
    expect(Object.keys(snap.credentials)).toHaveLength(2);
    expect(snap.credentials[URL_A]?.accessToken).toBe(SENTINEL_X);
    expect(snap.credentials[URL_B]?.accessToken).toBe(SENTINEL_BARE);
    const loaded = await loadMcpCredentials();
    expect(Object.keys(loaded)).toHaveLength(2);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
