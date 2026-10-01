// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814408(2026-10-02)事件流「单一写者」回归。
 *
 * 上游做法(`prompt-command.ts:282-310`,关键在 `:293`):常驻订阅跨回合存活,per-turn
 * `onEvent` 在 submitPrompt 的 finally 里摘掉,两者**绝不同时装**;选「二选一」而不是
 * 「双装 + 按 id 去重」,因为前者让"恰好一次"成为结构性事实,不依赖任何 sink 的调用顺序。
 *
 * 三组用例各有分工,缺任何一组都留一个盲区:
 *  ① 判据本身(纯函数 + 构造面)—— 证明"单一写者通过 / 未声明并存判红 / 显式声明放行并报名"
 *     这三态真会分叉,且被拒的 attach 在登记面与投递面都不留痕迹。
 *  ② 真实链路端到端(真起一个 WebSocket server,走 `connectToServer` + `sendUnified`)——
 *     证明修的是**真机制**:旧 `remote-adapter.ts:86` 把每次 send 的 sink 永久留在同一条流上,
 *     第二次 send 起同一条事件被两个写者各写一次。①全绿而这一组红,说明出口没被接上;
 *     这一组缺席,出口就可以是一台没人调用的判据(本仓记过多次"造好没装车":守门 64/70/81/115)。
 *  ③ 源码形状锁 —— 证明角色只在**一处**决定、attach 只经出口、旧裸订阅形态没有回潮通道。
 *     这一组不可替代:①② 只证明"函数会被正确使用",接线被摘线时它们一路报绿。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';

import {
  __resetStreamWritersForTests,
  activeWritersOn,
  claimPerTurnSink,
  claimResidentWriter,
  describeStreamWriters,
  releaseStreamWriters,
  runPerTurnSink,
  StreamWriterConflictError,
  StreamWriterRuleError,
} from '../src/event-stream-ownership.js';
import { connectToServer, type TuiClient } from '../src/client/tui-client.js';
import { sendUnified } from '../src/client/remote-adapter.js';
import type { AgentEvent } from '../src/server/agent-core.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = join(HERE, '../src');

afterEach(() => {
  __resetStreamWritersForTests();
});

// ==================== ① 判据本身 ====================

describe('G-814408 ① 单一写者判据(构造面)', () => {
  it('正例:一条流只有一个写者 ⇒ 通过并登记', () => {
    const lease = claimResidentWriter('s1', 'resident-render');
    expect(lease.active).toBe(true);
    expect(activeWritersOn('s1')).toEqual([{ kind: 'resident', label: 'resident-render' }]);
    const report = describeStreamWriters();
    expect(report).toHaveLength(1);
    expect(report[0]!.writers[0]).toMatchObject({ kind: 'resident', label: 'resident-render', attachOrdinal: 1 });
    // 声明并存的两行都不存在 ⇒ "没有声明"与"没查到"在账面上必须不同形
    expect(report[0]!.declaredCoexistence).toEqual([]);
  });

  it('反例:第二条写者未声明 ⇒ 判红,并点名已有写者', () => {
    claimResidentWriter('s2', 'first-writer');
    let caught: unknown;
    try {
      claimPerTurnSink('s2', 'second-writer');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StreamWriterConflictError);
    const err = caught as StreamWriterConflictError;
    expect(err.code).toBe('STREAM_WRITER_CONFLICT');
    expect(err.existingWriters).toEqual([{ kind: 'resident', label: 'first-writer' }]);
    expect(err.message).toContain('first-writer');
  });

  it('反例的副作用判据:被拒的 attach 在登记面不留名额', () => {
    claimResidentWriter('s3', 'first-writer');
    expect(() => claimPerTurnSink('s3', 'intruder')).toThrow(StreamWriterConflictError);
    const report = describeStreamWriters().find((r) => r.streamId === 's3')!;
    // attachCount 仍为 1 —— 被拦下的尝试混进份数,就等于"试过几次"与"装上几份"同形
    expect(report.attachCount).toBe(1);
    expect(report.writers).toHaveLength(1);
  });

  it('正例:显式声明的并存 ⇒ 放行并报名(不是"逢双即红")', () => {
    claimResidentWriter('s4', 'resident-render');
    const lease = claimPerTurnSink('s4', 'per-turn-sink', {
      reason: '常驻渲染器只管人读面,机器面 NDJSON 必须逐条另发一次',
      with: 'resident-render',
    });
    expect(lease.active).toBe(true);
    const report = describeStreamWriters().find((r) => r.streamId === 's4')!;
    expect(report.writers.map((w) => w.label)).toEqual(['resident-render', 'per-turn-sink']);
    expect(report.declaredCoexistence).toEqual([
      {
        label: 'per-turn-sink',
        reason: '常驻渲染器只管人读面,机器面 NDJSON 必须逐条另发一次',
        with: 'resident-render',
      },
    ]);
    expect(report.attachCount).toBe(2);
  });

  it('反例:声明指向不存在的写者 ⇒ 判红(对着空气声明比没声明更糟)', () => {
    claimResidentWriter('s5', 'real-writer');
    expect(() =>
      claimPerTurnSink('s5', 'ghost-declared', { reason: '要并存', with: 'not-there' }),
    ).toThrow(StreamWriterRuleError);
  });

  it('反例:声明没有实质 reason / 没有 with ⇒ 判红', () => {
    claimResidentWriter('s6', 'resident-render');
    expect(() => claimPerTurnSink('s6', 'blank-reason', { reason: '   ', with: 'resident-render' })).toThrow(
      StreamWriterRuleError,
    );
    expect(() =>
      claimPerTurnSink('s6', 'no-with', {
        reason: '有理由',
        with: undefined as unknown as string,
      }),
    ).toThrow(StreamWriterRuleError);
  });

  it('反例:流上没有任何在位写者却带并存声明 ⇒ 判红', () => {
    expect(() => claimResidentWriter('s7', 'lonely', { reason: '并存给谁看?', with: 'ghost' })).toThrow(
      StreamWriterRuleError,
    );
  });

  it('反例:streamId / label 为空 ⇒ 判红(不知名的流无法对账)', () => {
    expect(() => claimResidentWriter('   ', 'x')).toThrow(StreamWriterRuleError);
    expect(() => claimResidentWriter('s8', '  ')).toThrow(StreamWriterRuleError);
  });

  it('正例:常驻写者 release 后,同一条流可以再只有一个写者', () => {
    const lease = claimResidentWriter('s9', 'resident-render');
    lease.release();
    expect(lease.active).toBe(false);
    expect(activeWritersOn('s9')).toEqual([]);
    const second = claimPerTurnSink('s9', 'per-turn-sink');
    expect(second.active).toBe(true);
    // release 不掉的那份账是证据:装过 1 份、现在在位 1 份
    expect(describeStreamWriters().find((r) => r.streamId === 's9')!.attachCount).toBe(2);
  });

  it('release 幂等:重复摘不会误伤后来者,也不报错', () => {
    const a = claimResidentWriter('s10', 'first');
    a.release();
    a.release();
    claimResidentWriter('s10', 'second');
    expect(activeWritersOn('s10')).toEqual([{ kind: 'resident', label: 'second' }]);
  });
});

describe('G-814408 ①b per-turn 的寿命纪律(装 → 用 → finally 摘)', () => {
  it('正例:body 正常结束时钩已摘、租约已放', async () => {
    let attached = 0;
    let detached = 0;
    const out = await runPerTurnSink({
      streamId: 'p1',
      label: 'per-turn-sink',
      attach: () => {
        attached += 1;
      },
      detach: () => {
        detached += 1;
      },
      body: async () => 'ok',
    });
    expect(out).toBe('ok');
    expect(attached).toBe(1);
    expect(detached).toBe(1);
    expect(activeWritersOn('p1')).toEqual([]);
  });

  it('正例:body 抛错时同样摘钩(旧形态缺的就是这一条 —— 异常路径把 sink 永久留下)', async () => {
    let detached = 0;
    await expect(
      runPerTurnSink({
        streamId: 'p2',
        label: 'per-turn-sink',
        attach: () => undefined,
        detach: () => {
          detached += 1;
        },
        body: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow('boom');
    expect(detached).toBe(1);
    expect(activeWritersOn('p2')).toEqual([]);
  });

  it('反例:常驻写者在位时 per-turn 未声明 ⇒ 判红,且 attach 一次都没被调用', async () => {
    claimResidentWriter('p3', 'resident-render');
    let attached = 0;
    await expect(
      runPerTurnSink({
        streamId: 'p3',
        label: 'per-turn-sink',
        attach: () => {
          attached += 1;
        },
        detach: () => undefined,
        body: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(StreamWriterConflictError);
    // "先判后装"是这条断言的全部意义:装了再拒就是在投递面上留下过一份写者
    expect(attached).toBe(0);
    expect(activeWritersOn('p3')).toHaveLength(1);
  });

  it('正例:声明并存的 per-turn ⇒ 通过,attach/detach 各一次', async () => {
    claimResidentWriter('p4', 'resident-render');
    let attached = 0;
    let detached = 0;
    await runPerTurnSink({
      streamId: 'p4',
      label: 'per-turn-sink',
      attach: () => {
        attached += 1;
      },
      detach: () => {
        detached += 1;
      },
      body: async () => undefined,
      coexist: { reason: '机器面与常驻人读面各写各的', with: 'resident-render' },
    });
    expect([attached, detached]).toEqual([1, 1]);
  });

  it('判据覆盖门自己产出的形态:runPerTurnSink 装上的那份在登记面里就是 per-turn', async () => {
    await runPerTurnSink({
      streamId: 'p5',
      label: 'from-outlet',
      attach: () => undefined,
      detach: () => undefined,
      body: async () => {
        const during = describeStreamWriters().find((r) => r.streamId === 'p5')!;
        expect(during.writers).toEqual([{ kind: 'per-turn', label: 'from-outlet', attachOrdinal: 1 }]);
      },
    });
    expect(activeWritersOn('p5')).toEqual([]);
  });

  it('判据自己不得成为泄漏源:20 次 per-turn 之后保留条目数仍等于在位写者数', async () => {
    for (let k = 0; k < 20; k += 1) {
      await runPerTurnSink({
        streamId: 'leak',
        label: `per-turn-${k}`,
        attach: () => undefined,
        detach: () => undefined,
        body: async () => undefined,
      });
    }
    const rep = describeStreamWriters().find((r) => r.streamId === 'leak')!;
    expect(rep.attachCount).toBe(20); // 账留着:装过几份是可核事实
    expect(rep.writers).toHaveLength(0); // 但一条都不在位
    // 这条断言才是"没泄漏"的判据:保留条目若不随 release 收缩,长会话就是无界数组
    expect(rep.retainedEntries).toBe(rep.writers.length);
  });

  it('宿主 close 的出口:整片摘除并返回份数(两侧同摘,不留僵尸账)', () => {
    claimResidentWriter('c1', 'a');
    claimPerTurnSink('c1', 'b', { reason: '并存已声明', with: 'a' });
    expect(releaseStreamWriters('c1')).toBe(2);
    expect(activeWritersOn('c1')).toEqual([]);
    expect(releaseStreamWriters('no-such-stream')).toBe(0);
    const rep = describeStreamWriters().find((r) => r.streamId === 'c1')!;
    expect(rep.retainedEntries).toBe(0);
  });
});

// ==================== ② 真实链路端到端 ====================

/** 起一条真 ws 服务:每收到一条 message 就回两条 token + 一条 done。 */
async function startFakeAgentServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((res) => wss.once('listening', () => res()));
  wss.on('connection', (sock: WebSocket) => {
    sock.on('message', () => {
      const frames: AgentEvent[] = [
        { type: 'token', text: 'A' },
        { type: 'token', text: 'B' },
        { type: 'done', sessionId: 'x', stopReason: 'end_turn', iterations: 1, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 } },
      ];
      for (const f of frames) sock.send(JSON.stringify(f));
    });
  });
  const addr = wss.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  return {
    url: `ws://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((res) => {
        for (const c of wss.clients) c.close();
        wss.close(() => res());
      }),
  };
}

async function waitUntil(pred: () => boolean, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (!pred()) {
    if (Date.now() - started > timeoutMs) throw new Error('等待事件超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('G-814408 ② 真 WebSocket 链路端到端(修的是真机制)', () => {
  it('两次 send 之间同一条事件恰写一次(per-turn 摘钩生效)', async () => {
    const server = await startFakeAgentServer();
    const client: TuiClient = await connectToServer({ url: server.url });
    try {
      const seen: string[] = [];
      const sink = (e: AgentEvent): void => {
        if (e.type === 'token') seen.push(e.text);
      };
      const handle = { mode: 'remote' as const, client };
      await sendUnified(handle, '第一句', sink);
      await sendUnified(handle, '第二句', sink);
      await waitUntil(() => seen.length >= 2);
      // 旧形态:第一次 send 的 sink 永不摘钩 ⇒ 第二次 send 的 A/B 被写两遍 ⇒ seen 是
      // ['A','B','A','B','A','B']。单一写者后恰一遍。
      expect(seen).toEqual(['A', 'B', 'A', 'B']);
      expect(activeWritersOn(client.streamId)).toEqual([]);
    } finally {
      client.close();
      await server.close();
    }
  });

  it('常驻写者在位时 sendUnified ⇒ 当场被拒(静默并存结构上不可能)', async () => {
    const server = await startFakeAgentServer();
    const client = await connectToServer({ url: server.url });
    try {
      const residentSeen: string[] = [];
      client.attachResidentWriter((e) => {
        if (e.type === 'token') residentSeen.push(e.text);
      }, { label: 'resident-render' });

      const handle = { mode: 'remote' as const, client };
      await expect(sendUnified(handle, '撞车', () => undefined)).rejects.toBeInstanceOf(
        StreamWriterConflictError,
      );
      // 端到端的"账面对得上":被拒的那次 attach 没有把 attachCount 顶上去,在位的仍只有常驻
      const rep = describeStreamWriters().find((r) => r.streamId === client.streamId);
      expect(rep?.attachCount).toBe(1);
      expect(rep?.writers.map((w) => w.label)).toEqual(['resident-render']);
      // 拒绝之后常驻写者照旧在位、照旧收得到事件(判据不得顺手把已有写者摘掉)
      await client.send('仍然可发').catch(() => undefined);
      await waitUntil(() => residentSeen.length >= 2);
      expect(activeWritersOn(client.streamId)).toEqual([{ kind: 'resident', label: 'resident-render' }]);
    } finally {
      client.close();
      await server.close();
    }
  });

  it('声明并存的第二份写者 ⇒ 两份各收一次(出口不静默去重)', async () => {
    const server = await startFakeAgentServer();
    const client = await connectToServer({ url: server.url });
    try {
      const resident: string[] = [];
      const perTurn: string[] = [];
      client.attachResidentWriter((e) => {
        if (e.type === 'token') resident.push(e.text);
      }, { label: 'resident-render' });

      await client.runWithPerTurnSink(
        (e) => {
          if (e.type === 'token') perTurn.push(e.text);
        },
        () => client.send('并存'),
        {
          label: 'per-turn-machine',
          coexist: { reason: '机器面 NDJSON 与常驻人读面各写各的', with: 'resident-render' },
        },
      );
      await waitUntil(() => resident.length >= 2 && perTurn.length >= 2);
      // 每个写者各拿到一次(不是"两条写者抢一份事件",也不是"装完再去重")
      expect(resident).toEqual(['A', 'B']);
      expect(perTurn).toEqual(['A', 'B']);
    } finally {
      client.close();
      await server.close();
    }
  });

  it('close 之后这条流不再有人在写(租约随宿主消失)', async () => {
    const server = await startFakeAgentServer();
    const client = await connectToServer({ url: server.url });
    const detach = client.attachResidentWriter(() => undefined, { label: 'resident-render' });
    expect(activeWritersOn(client.streamId)).toHaveLength(1);
    detach();
    client.close();
    await server.close();
    expect(activeWritersOn(client.streamId)).toEqual([]);
  });
});

// ==================== ③ 源码形状锁 ====================

/**
 * 形状锁必须判**代码面**。理由不是洁癖:说明性文字里逐字引用被禁的写法(本仓的注释常这样
 * 复盘旧形态),会把"不得再出现"的断言永远钉红 —— 与本仓多次记过的同一坑。
 * 这里的遮罩只剥注释(行注释 / 块注释),**保留字符串**:被禁的调用形态与合法形态都可能
 * 出现在字符串里,而这一族判据在乎的是"代码里有没有真的调"。
 */
function maskComments(src: string): string {
  let out = '';
  let i = 0;
  let state: 'code' | 'line' | 'block' | 'string' | 'template' = 'code';
  let quoteChar = '';
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (state === 'code') {
      if (c === '/' && n === '/') {
        state = 'line';
        i += 2;
        continue;
      }
      if (c === '/' && n === '*') {
        state = 'block';
        i += 2;
        continue;
      }
      if (c === '"' || c === "'") {
        state = 'string';
        quoteChar = c;
        out += c;
        i += 1;
        continue;
      }
      if (c === '`') {
        state = 'template';
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code';
        out += c;
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && n === '/') {
        state = 'code';
        i += 2;
        continue;
      }
      // 块注释里的换行保留:行号与"整行被剥"的可读性都依赖它
      out += c === '\n' ? '\n' : '';
      i += 1;
      continue;
    }
    // string / template:原样输出,只处理转义与结束符
    if (c === '\\') {
      out += c + (n ?? '');
      i += 2;
      continue;
    }
    if ((state === 'string' && c === quoteChar) || (state === 'template' && c === '`')) {
      state = 'code';
      quoteChar = '';
      out += c;
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function readSrc(rel: string): string {
  return readFileSync(join(SRC_DIR, rel), 'utf8');
}

/** 递归列出 src 下的 .ts(排除 .d.ts 与 workflows —— 那一路由并行代理持有,不在本票射程)。 */
function listSrcTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'workflows') continue;
      listSrcTs(abs, acc);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      acc.push(abs);
    }
  }
  return acc;
}

describe('G-814408 ③ 源码形状锁(角色只在一处决定)', () => {
  it('遮罩自身有牙:同一形态写在注释里必须看不见、写在代码里必须看见', () => {
    const forbiddenCall = ['.on(', "'event'", ', cb)'].join(''); // 避免本文件自身命中形状锁
    const withComment = ['// 旧写法 ' + forbiddenCall, 'const x = 1'].join('\n');
    expect(maskComments(withComment)).not.toContain(forbiddenCall);
    const realCode = ['const y = z' + forbiddenCall, '// 说明'].join('\n');
    expect(maskComments(realCode)).toContain(forbiddenCall);
  });

  it('remote-adapter:裸订阅已消失,且真的走出口', () => {
    const code = maskComments(readSrc('client/remote-adapter.ts'));
    expect(code).not.toMatch(/\.on\(\s*['"]event['"]/);
    expect(code).toMatch(/runWithPerTurnSink\(/);
  });

  it('tui-client:两个 attach 出口都判定后才装钩,close 整片释放', () => {
    const code = maskComments(readSrc('client/tui-client.ts'));
    expect(code).toMatch(/claimResidentWriter\(/);
    expect(code).toMatch(/runPerTurnSink\(/);
    expect(code).toMatch(/releaseStreamWriters\(/);
    // 接口面不得再留裸订阅方法(那是第二条写者的回潮通道)。
    // 两端锚点必须先各自命中 —— 任一 indexOf 落 -1 时 slice 会给出自洽却错位的窗口,
    // 断言于是变成"永远绿"(本仓记过多次:判据失效的表现永远是安静)。
    const ifaceStart = code.indexOf('export interface TuiClient');
    const ifaceEnd = code.indexOf('function loadWsClient');
    expect(ifaceStart, 'TuiClient 接口声明必须仍在位').toBeGreaterThan(-1);
    expect(ifaceEnd, 'loadWsClient 必须在 TuiClient 接口之后').toBeGreaterThan(ifaceStart);
    const iface = code.slice(ifaceStart, ifaceEnd);
    expect(iface).toMatch(/attachResidentWriter\(/);
    expect(iface).toMatch(/runWithPerTurnSink</);
    expect(iface).not.toMatch(/^\s*on\(/m);
  });

  it("角色字面量只在出口模块里出现 —— 谁在写这条流不是调用方自报的", () => {
    const outlet = maskComments(readSrc('event-stream-ownership.ts'));
    expect(outlet).toContain("'resident'");
    expect(outlet).toContain("'per-turn'");
    const offenders: string[] = [];
    for (const abs of listSrcTs(SRC_DIR)) {
      if (abs.endsWith('event-stream-ownership.ts')) continue;
      const code = maskComments(readFileSync(abs, 'utf8'));
      if (/['"]resident['"]/.test(code) || /['"]per-turn['"]/.test(code)) offenders.push(abs);
    }
    expect(offenders).toEqual([]);
  });

  it('出口模块不得出现"按 id 去重"的通道(判据选的是二选一,不是双装再抹平)', () => {
    const code = maskComments(readSrc('event-stream-ownership.ts'));
    // 本模块唯一的"丢弃"动作是被拒的 attach 自己回收名额;不允许任何按事件身份丢重复行的逻辑
    expect(code).not.toMatch(/\b(dedup|dedupe|seenEvent|eventIds)\b/i);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
