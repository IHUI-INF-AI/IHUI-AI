// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本地服务发现的端到端验证(goal-b49 Q1 复现+超越)。
 * 真起一个服务、真落认领件、真发 HTTP 探测 —— 不用假读数代证"发现可用"。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { startAgentServer, type AgentServerHandle } from '../src/server/http-server.js';
import type { AgentCore } from '../src/server/index.js';
import {
  claimDir,
  defaultProbeEndpoint,
  discoverLiveClaims,
  generationOf,
  pruneStaleClaims,
  publishClaim,
  startClaim,
} from '../src/server/client-claims.js';

let root = '';
let handle: AgentServerHandle | null = null;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-claims-'));
  handle = null;
});

afterEach(async () => {
  await handle?.close();
  handle = null;
  fs.rmSync(root, { recursive: true, force: true });
});

const stubCore = {
  listSessions: () => [],
  resumeSession: async () => null,
  sendMessage: async () => ({ sessionId: 's', stopReason: 'end_turn', iterations: 1, usage: {} }),
} as unknown as AgentCore;

function filesInDir(): string[] {
  const dir = claimDir(root);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

describe('发布与心跳', () => {
  it('① startClaim 落一枚带代次的件,stop() 之后件消失', () => {
    const c = startClaim({ port: 45_999, root, productVersion: 'test' });
    expect(filesInDir()).toEqual([`${c.id}.json`]);
    const rec = JSON.parse(fs.readFileSync(path.join(claimDir(root), `${c.id}.json`), 'utf-8')) as Record<string, unknown>;
    expect(rec.port).toBe(45_999);
    expect(rec.generation).toBe(c.generation);
    expect(typeof rec.timestamp).toBe('number');
    c.stop();
    expect(filesInDir()).toEqual([]);
  });

  it('② 代次只由 (port,startedAt,pid) 决定:换口即换代次(伪造件要同时猜中三元)', () => {
    expect(generationOf(1, 100, 7)).not.toBe(generationOf(2, 100, 7));
    expect(generationOf(1, 100, 7)).toBe(generationOf(1, 100, 7));
  });
});

describe('端到端:真服务的 /health 自述代次 + 真探测发现', () => {
  it('③ 开认领件的服务会在 /health 上带 generation,发现侧据此把该口判为可用', async () => {
    handle = await startAgentServer(stubCore, { port: 0, claim: { root, productVersion: 'test' } });
    const resp = await fetch(`http://127.0.0.1:${handle.port}/health`);
    const body = (await resp.json()) as { data?: { generation?: string; ok?: boolean } };
    expect(body.data?.ok).toBe(true);
    expect(typeof body.data?.generation).toBe('string');

    const found = await discoverLiveClaims(root, { probeEndpoint: defaultProbeEndpoint });
    expect(found.state).toBe('ok');
    expect(found.scanned).toBe(1);
    expect(found.usable).toHaveLength(1);
    expect(found.usable[0]?.port).toBe(handle.port);
    expect(found.usable[0]?.url).toBe(`http://127.0.0.1:${handle.port}`);
  });

  it('④ 关掉服务后认领件被摘(不留"看着还活"的死件),再发现即 0 件 ⇒ unjudged', async () => {
    handle = await startAgentServer(stubCore, { port: 0, claim: { root } });
    const livePort = handle.port;
    await handle.close();
    handle = null;
    expect(filesInDir()).toEqual([]);

    // 手工放一枚指向已死口的件:探测无应答 ⇒ 拒,且必须点名原因
    publishClaim({ id: 'ghost', port: livePort, pid: process.pid, timestamp: Date.now() }, root);
    const found = await discoverLiveClaims(root, { probeEndpoint: defaultProbeEndpoint });
    expect(found.usable).toEqual([]);
    expect(found.rejected[0]?.id).toBe('ghost');
    expect(found.rejected[0]?.reason).toMatch(/无应答|陈旧|消亡/);
  });

  it('⑤ 没给探测注入 ⇒ 整体未判定并点名,绝不静默返回"本机没有实例"', async () => {
    startClaim({ port: 46_001, root });
    const found = await discoverLiveClaims(root);
    expect(found.state).toBe('unjudged');
    expect(found.usable).toEqual([]);
    expect(found.rejected[0]?.reason).toContain('probeEndpoint');
  });
});

describe('清理轮(必须有死亡机制)', () => {
  it('⑥ 心跳陈旧但进程仍活 ⇒ 保留;进程消亡且陈旧 ⇒ 删除', () => {
    const alive = startClaim({ port: 47_001, root });
    const dead = publishClaim(
      { id: 'gone', port: 47_002, pid: 999_999_999, timestamp: Date.now() - 120_000 },
      root,
    );
    const r = pruneStaleClaims(root);
    expect(r.removed.map((x) => x.id)).toEqual(['gone']);
    expect(r.kept.map((x) => x.id)).toContain(alive.id);
    expect(fs.existsSync(dead)).toBe(false);
    alive.stop();
  });

  it('⑦ 形状坏的件保留不删(坏记录也可能是别人正在写的半件),且逐条点名', () => {
    const dir = claimDir(root);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ 半件', 'utf-8');
    const r = pruneStaleClaims(root);
    expect(r.removed).toEqual([]);
    expect(r.kept[0]?.reason).toContain('记录形状不合判据');
    expect(fs.existsSync(path.join(dir, 'broken.json'))).toBe(true);
  });

  it('⑧ 目录不存在 ⇒ scanned=0 且 unjudged(枚举到 0 不判绿)', () => {
    const r = pruneStaleClaims(path.join(root, 'nope'));
    expect(r.state).toBe('unjudged');
    expect(r.scanned).toBe(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
