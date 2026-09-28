// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-709 — MCP 凭据存储"读坏 ≠ 没有"的三态判据与损坏隔离。
 *
 * 拦的是这一型现网缺陷(旧实现 `mcp-credentials.ts` 的 readAll 在 catch 里一律 `return {}`):
 *   本模块每个写入口都是**整文件读-改-写**,所以一次瞬时损坏之后的第一次保存,
 *   会把其它 server 的 OAuth/登录凭据**全部清空**,而账面没有任何线索。
 * 上游对照(逐字读到体)`credentialService.ts:61-72`:保留损坏文件证据并向上传递错误,
 * 禁止自动覆盖;`ENOENT` 仍单独返回 `{}`(同文件 :48-52)。
 *
 * 六组判据(每一条都有成对的反向对照,防"门只拦自己写得出的那一型"):
 *   ① 阳性:半截 JSON ⇒ 抛 `McpCredentialStoreError`(state=corrupt)**且**留下 `.corrupt-*` 隔离件;
 *      随后修好文件再 save ⇒ **另一个 key 既存的凭据仍在**(证明"不覆盖",不是只证明"抛了")。
 *   ② 反向对照:文件不存在(ENOENT)⇒ 仍返回 `{}` / `state='absent'`,行为与改动前逐字一致,
 *      且**不产任何隔离件**(把"没有"也判成故障就是一台恒红门)。
 *   ③ 形状不合(合法 JSON 但是数组 / 字符串 / 条目不是对象)⇒ 与 ① 同档处置(留证 + 抛)。
 *   ④ 三态:`getCredential` / `deleteCredential` 在存储坏了时**抛**,不得折成 undefined / false。
 *   ⑤ 隔离件按**内容**收敛(反复读同一份损坏只长一件),且原文件**留在原位**继续拒绝下一次读。
 *   ⑥ 变更锁:`setCredential` 的读-改-写全过程在跨进程锁内(锁被持有时**一条字节都不落盘**)。
 *
 * 凭据卫生:所有 token 值都是本文件自造的哨兵字符串(`SENTINEL_*`),断言泄漏时只报"命中/未命中",
 * 不把命中值拼进断言消息(那等于让测试自己把凭据写进 stdout)。
 * 夹具落点唯一取自 `scripts/lib/scratch-dir.mjs`(§26,不落 os.tmpdir()/裸 mkdtemp),
 * 且绝不写真实 `~/.ihui`。
 */
import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 与 tests/mcp-refresh-single-flight.test.ts 同一条实测教训:本文件带 vi.mock 会被 Vite 外化给
// Node 运行时,静态 '../../scripts/…' 在运行时被拧成 '/scripts/…';按 importer 逐字解析的
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
  readMcpCredentialStoreProblem,
  getCredential,
  setCredential,
  deleteCredential,
  McpCredentialStoreError,
  type McpCredentialStoreSnapshot,
} from '../src/tools/mcp-credentials.js';
import { acquireLock, getRefreshLockPath, releaseLock } from '../src/tools/mcp-oauth.js';

const URL_A = 'https://a.example.com/mcp';
const URL_B = 'https://b.example.com/mcp';
const SENTINEL_A = 'sentinel-access-A-do-not-log';
const SENTINEL_B = 'sentinel-access-B-do-not-log';

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

/** 同目录里所有 `.corrupt-*` 隔离件的文件名(排序后可比对"收敛到一件") */
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

async function seedTwoCredentials(): Promise<void> {
  await setCredential(URL_A, { accessToken: SENTINEL_A, obtainedAt: 1 });
  await setCredential(URL_B, { accessToken: SENTINEL_B, obtainedAt: 2 });
}

/** 把抛出的未知错误收窄成断言可用的快照:只认稳定属性,不靠 instanceof 单条通道。 */
function asStoreFailure(err: unknown): {
  message: string;
  problem: string | undefined;
  snapshotLike: McpCredentialStoreSnapshot | null;
} {
  const message = err instanceof Error ? err.message : String(err);
  const problem = readMcpCredentialStoreProblem(err);
  const direct = err instanceof McpCredentialStoreError ? err : null;
  return {
    message,
    problem,
    snapshotLike: direct
      ? {
          state: direct.mcpCredentialStoreProblem,
          credentials: {},
          storePath: direct.storePath,
          evidencePath: direct.evidencePath,
          reasonCode: direct.storeReasonCode,
          detail: '',
        }
      : null,
  };
}

beforeEach(() => {
  scratchHome = mkScratch('mcp-creds-corrupt-');
  originalEnv = { ...process.env };
  process.env.IHUI_HOME = scratchHome;
  // 钉在档位③(明文):本票判的是"读坏/没有/坏了"这一维,加密档位由 D146 自己的测试判。
  // 顺带让夹具不依赖 PowerShell 探针(那是秒级的外部状态)。
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

describe('G-709 ①:半截 JSON ⇒ 留证 + 抛,且第一次保存不得清空别的 key', () => {
  it('抛 McpCredentialStoreError(state=corrupt)、留下 .corrupt-* 隔离件;修好文件后 save 仍保住另一个 key', async () => {
    await seedTwoCredentials();
    const before = await readCredentialStoreSnapshot();
    expect(before.state).toBe('ok');
    expect(before.credentials[URL_B]?.accessToken).toBe(SENTINEL_B);

    // 制造"瞬时损坏":截断到半个 JSON(真实形态就是磁盘抖动/别人写坏的这一型)
    const intact = await readStoreFile();
    const broken = intact.slice(0, Math.floor(intact.length / 2));
    await writeStoreFile(broken);

    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    expect(raw).toBeInstanceOf(McpCredentialStoreError);
    const failure = asStoreFailure(raw);
    expect(failure.problem).toBe('corrupt');
    expect(failure.snapshotLike?.reasonCode).toBe('payload-not-json');
    // 点名路径:没有路径的故障消息等于让下一个人重新猜
    expect(failure.message).toContain(storePathOf());

    // 隔离件在位,且**逐字等于**当时那份坏文件(证据的价值在于原字节可复得)
    const evidence = await listEvidence();
    expect(evidence).toHaveLength(1);
    const evidenceBytes = await fs.readFile(path.join(storeDir(), evidence[0] ?? ''), 'utf-8');
    expect(evidenceBytes).toBe(broken);
    // 原文件**仍在原位**:移走它 ⇒ 下一次读得到 ENOENT ⇒ 又折回"空 store" ⇒ 换条路径继续清空
    expect(await readStoreFile()).toBe(broken);

    // 第二次读仍然抛(不是"第一次喊过就算喊过了")
    await expect(loadMcpCredentials()).rejects.toBeInstanceOf(McpCredentialStoreError);

    // 正向对照 + 本票的核心断言:文件修好之后的一次 save,**不得**让另一个 key 的凭据消失
    await writeStoreFile(intact);
    await setCredential(URL_A, { accessToken: `${SENTINEL_A}-rotated`, obtainedAt: 3 });
    const after = await readCredentialStoreSnapshot();
    expect(after.state).toBe('ok');
    expect(after.credentials[URL_A]?.accessToken).toBe(`${SENTINEL_A}-rotated`);
    expect(after.credentials[URL_B]?.accessToken).toBe(SENTINEL_B);
  });

  it('凭据内容既不进错误消息,也不进任何 console 输出', async () => {
    await seedTwoCredentials();
    const intact = await readStoreFile();
    await writeStoreFile('{this is not json at all');
    logged = [];
    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    const failure = asStoreFailure(raw);
    expect(failure.problem).toBe('corrupt');
    expect(failure.message).not.toContain(SENTINEL_A);
    expect(failure.message).not.toContain(SENTINEL_B);
    expect(intact).toContain(SENTINEL_A); // 阳性对照:原文里确实有哨兵,所以"没命中"不是找错了文件
    for (const line of logged) {
      expect(line).not.toContain(SENTINEL_A);
      expect(line).not.toContain(SENTINEL_B);
    }
  });
});

describe('G-709 ②:反向对照 —— ENOENT 仍折算成空 store,行为与改动前逐字一致', () => {
  it('文件不存在 ⇒ loadMcpCredentials() 返回 {} 且 snapshot.state=absent,不产隔离件、不抛', async () => {
    const creds = await loadMcpCredentials();
    expect(creds).toEqual({});
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('absent');
    expect(snap.reasonCode).toBe('absent');
    expect(await getCredential(URL_A)).toBeUndefined();
    expect(await deleteCredential(URL_A)).toBe(false);
    expect(await listEvidence()).toEqual([]);
  });

  it('空对象不是"故障"的伪装:absent 与 corrupt 在 snapshot 上是两个不同的 state', async () => {
    const absentSnap = await readCredentialStoreSnapshot();
    expect(absentSnap.state).toBe('absent');
    await writeStoreFile('null');
    const corruptSnap = await readCredentialStoreSnapshot().catch((e: unknown) => e);
    // snapshot 出口本身不抛(三态靠返回值);抛的是 loadMcpCredentials 那一条投影
    expect((corruptSnap as McpCredentialStoreSnapshot).state).toBe('corrupt');
  });
});

describe('G-709 ③:形状不合(合法 JSON 但不是凭据集合)与 ① 同档处置', () => {
  const shapes: Array<{ label: string; text: string; reasonCode: string }> = [
    { label: '顶层是数组', text: '["not","an","object"]', reasonCode: 'payload-not-object' },
    { label: '顶层是字符串', text: '"just a string"', reasonCode: 'payload-not-object' },
    { label: '顶层是 null', text: 'null', reasonCode: 'payload-not-object' },
    {
      label: '条目不是对象',
      text: JSON.stringify({ [URL_A]: 'oops' }),
      reasonCode: 'payload-entry-not-object',
    },
  ];

  for (const shape of shapes) {
    it(`${shape.label} ⇒ 抛 corrupt + 留证(不是回退空对象)`, async () => {
      await writeStoreFile(shape.text);
      const raw = await loadMcpCredentials().catch((e: unknown) => e);
      const failure = asStoreFailure(raw);
      expect(failure.problem).toBe('corrupt');
      expect(failure.snapshotLike?.reasonCode).toBe(shape.reasonCode);
      expect(await listEvidence()).toHaveLength(1);
      // 原文件仍在原位 ⇒ 下一次读继续拒绝
      expect(await readStoreFile()).toBe(shape.text);
    });
  }

  it('一份完好的凭据集合不会被本判据误伤(正向对照:判据不是"一律判红")', async () => {
    await seedTwoCredentials();
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('ok');
    expect(Object.keys(snap.credentials)).toHaveLength(2);
    expect(await listEvidence()).toEqual([]);
  });
});

describe('G-709 ④:三态不得被折成"没有这条凭据"', () => {
  it('存储坏了时 getCredential / deleteCredential 抛,而不是 undefined / false', async () => {
    await seedTwoCredentials();
    await writeStoreFile('{"broken": ');
    const before = logged.length;
    await expect(getCredential(URL_B)).rejects.toBeInstanceOf(McpCredentialStoreError);
    await expect(deleteCredential(URL_B)).rejects.toBeInstanceOf(McpCredentialStoreError);
    // 不靠文案:靠属性分档(跨包副本/mock 下 instanceof 会失真,所以两条通道都要给)
    const raw = await getCredential(URL_A).catch((e: unknown) => e);
    expect(readMcpCredentialStoreProblem(raw)).toBe('corrupt');
    expect(readMcpCredentialStoreProblem(new Error('unrelated'))).toBeUndefined();
    expect(readMcpCredentialStoreProblem(undefined)).toBeUndefined();
    // 故障出口不靠"打印一行就算喊过":抛错本身不产生凭据内容日志
    expect(logged.slice(before).join('\n')).not.toContain(SENTINEL_B);
  });

  it('完好信封 + 本机没有钥匙 ⇒ 第三态 undecryptable:仍然抛,但**不**产 .corrupt 隔离件(那份文件并不坏)', async () => {
    // 结构合法的信封(恰一层),kid 是随便写的 ⇒ 明文档下 material=null ⇒ 解不开
    await writeStoreFile(
      JSON.stringify({ ihuiVaultV1: { alg: 'A256GCM', kid: 'ffffffffffffffff', iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA' } }),
    );
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('undecryptable');
    expect(snap.reasonCode).toBe('envelope-without-local-key-material');
    expect(await listEvidence()).toEqual([]);
    const raw = await loadMcpCredentials().catch((e: unknown) => e);
    expect(readMcpCredentialStoreProblem(raw)).toBe('undecryptable');
  });
});

describe('G-709 ⑤:隔离件按内容收敛,不淹在噪声里', () => {
  it('反复读同一份损坏 ⇒ 只长一件证据;内容又变了一次 ⇒ 才长第二件', async () => {
    await writeStoreFile('half-written{');
    for (let i = 0; i < 3; i++) {
      await expect(loadMcpCredentials()).rejects.toBeInstanceOf(McpCredentialStoreError);
    }
    expect(await listEvidence()).toHaveLength(1);
    await writeStoreFile('half-written{different-damage');
    await expect(loadMcpCredentials()).rejects.toBeInstanceOf(McpCredentialStoreError);
    const evidence = await listEvidence();
    expect(evidence).toHaveLength(2);
  });
});

describe('G-709 ⑥:变更锁覆盖 setCredential 的"读 → 改 → 原子替换"全过程', () => {
  it('锁被别的进程持有时,一次落盘都不许发生;释放后才写', async () => {
    await setCredential(URL_A, { accessToken: SENTINEL_A, obtainedAt: 1 });

    // 用生产同一份锁实现冒充"别的进程正持有"(acquireLock 不可重入,判活问到的是本进程 pid)
    await acquireLock(URL_B, { lockPath: getRefreshLockPath(), timeoutMs: 2_000 });
    const pending = setCredential(URL_B, { accessToken: SENTINEL_B, obtainedAt: 2 });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(settled).toBe(false);
    // 关键断言:不是"慢一点",而是**一条字节都没落盘** ⇒ 读-改-写整体在临界区内
    expect(await readStoreFile()).not.toContain(SENTINEL_B);

    await releaseLock({ lockPath: getRefreshLockPath() });
    await pending;
    const snap = await readCredentialStoreSnapshot();
    expect(snap.state).toBe('ok');
    expect(snap.credentials[URL_A]?.accessToken).toBe(SENTINEL_A);
    expect(snap.credentials[URL_B]?.accessToken).toBe(SENTINEL_B);
  });

  it('锁释放干净:setCredential 成功之后 mcp-refresh.lock 不在位(不留幽灵锁给下一个进程)', async () => {
    await setCredential(URL_A, { accessToken: SENTINEL_A, obtainedAt: 1 });
    await expect(fs.access(getRefreshLockPath())).rejects.toThrow();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
