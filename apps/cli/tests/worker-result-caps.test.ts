// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-04 票3 —— 超限一律"拒绝不截断" + 审计输入有界化(truncated 位)。
 *
 * 两条成对纪律(上游 world-read-caps / world-read-input 的双面语义):
 *  · 下游判定侧:喂给调用方判定的 worker 结果超 cap ⇒ 结构化拒绝点名恢复动作,
 *    断然不交半截结果("截断把一份悄悄残缺的世界视图交给脚本,脚本会拿它去扇出");
 *  · 审计侧:诊断尾巴有界化 + truncated 标记,"宁可诚实地说被截了"。
 *
 * 另含两条静态锁:
 *  · grep 型守门:subagents 域内每个代码面 `.slice(` 必须靠近 truncated 位或入白名单;
 *  · parity:TS/Python 两侧 caps 表都存在且字节上限同源(4096)。
 *
 * 全程注入 forkImpl 假 proc,不派生任何真实子进程。
 */
import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SubagentWorkerPool, defaultWorkerPoolConfig, WORKER_RESULT_CAPS } from '../src/subagents/worker-pool.js';
import type { ChildProcess } from 'node:child_process';
import type { SubagentSpawnRequest } from '@ihui/types';

class FakeProc extends EventEmitter {
  pid = 4242;
  exitCode: number | null = null;
  signalCode: number | null = null;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killImpl: (signal?: string) => void = () => {};
  send(_msg: unknown, _cb?: () => void): boolean {
    return true;
  }
  kill(signal?: string): boolean {
    this.killImpl(signal ?? 'SIGTERM');
    return true;
  }
}

const REQ: SubagentSpawnRequest = { persona: 'coder', task: '夹具任务', workspacePath: '.' } as unknown as SubagentSpawnRequest;

let lastProc: FakeProc;

function makePool(): SubagentWorkerPool {
  return new SubagentWorkerPool(
    defaultWorkerPoolConfig({ maxWorkers: 2, taskTimeoutSeconds: 60, heartbeatTimeoutSeconds: 60 }),
    {
      forkImpl: () => {
        lastProc = new FakeProc();
        return lastProc as unknown as ChildProcess;
      },
      killExitBudgetMs: 50,
    },
  );
}

/** 等到池把 worker 真正启动(条目已入表、假 proc 已捕获)。 */
async function waitForStart(pool: SubagentWorkerPool): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (pool.activeSubagentIds().length > 0) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('夹具:worker 未启动');
}

/** 发一条 message_delta NDJSON 事件(assistantText 累计其 text 字段)。 */
function emitAssistantText(proc: FakeProc, text: string): void {
  proc.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'message_delta', text }) + '\n', 'utf8'));
}

describe('WORKER_RESULT_CAPS 常量表(数字即契约)', () => {
  it('每条 cap 都有名字、数字与 enforcement 侧标注', () => {
    for (const entry of Object.values(WORKER_RESULT_CAPS)) {
      expect(Number(entry.cap)).toBeGreaterThan(0);
      expect(entry.enforcement.length).toBeGreaterThan(0);
      expect(['service 执行', '记录侧执行']).toContain(entry.enforcement);
    }
  });

  it('parity:Python 侧 STEP_RECORD_CAPS 同在,审计字节上限同源 4096', () => {
    const py = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../ai-service/app/services/agent_step_recorder.py'),
      'utf8',
    );
    expect(py).toContain('STEP_RECORD_CAPS');
    expect(py).toContain('"auditInputMaxBytes": {"cap": 4096');
    expect(py).toContain('记录侧执行');
  });
});

describe('下游判定侧:超 cap 拒绝不截断', () => {
  it('(a) output 恰好 = cap ⇒ 成功返回完整结果', async () => {
    const pool = makePool();
    const pending = pool.spawn(REQ);
    await waitForStart(pool);
    emitAssistantText(lastProc, 'x'.repeat(WORKER_RESULT_CAPS.resultOutputMaxBytes.cap));
    lastProc.emit('exit', 0, null);
    const resp = await pending;
    await pool.shutdown();
    expect(resp.status).toBe('completed');
    expect(resp.output).toBe('x'.repeat(WORKER_RESULT_CAPS.resultOutputMaxBytes.cap));
  });

  it('(b) output = cap+1 ⇒ 结构化拒绝点名恢复动作,不返回半截结果', async () => {
    const pool = makePool();
    const pending = pool.spawn(REQ);
    await waitForStart(pool);
    emitAssistantText(lastProc, 'x'.repeat(WORKER_RESULT_CAPS.resultOutputMaxBytes.cap + 1));
    lastProc.emit('exit', 0, null);
    const resp = await pending;
    await pool.shutdown();
    expect(resp.status).toBe('failed');
    expect(resp.error).toContain('超上限');
    expect(resp.error).toContain('恢复动作');
    expect(resp.error).toContain('拆分子任务');
    expect(resp.output).toBeUndefined(); // 断然不交半截
  });
});

describe('审计侧:尾巴有界化 + truncated 标记', () => {
  it('(c) stderr 超 errorTailMaxChars ⇒ error 带截断标记且有界', async () => {
    const pool = makePool();
    const pending = pool.spawn(REQ);
    await waitForStart(pool);
    lastProc.stderr.emit('data', Buffer.from('y'.repeat(600), 'utf8'));
    lastProc.emit('exit', 1, null);
    const resp = await pending;
    await pool.shutdown();
    expect(resp.status).toBe('failed');
    expect(resp.error).toContain('[truncated:true 原长 600]');
    expect(resp.error!.length).toBeLessThan(600);
  });

  it('(d) stderr 未超上限 ⇒ 原样保留、无截断标记', async () => {
    const pool = makePool();
    const pending = pool.spawn(REQ);
    await waitForStart(pool);
    lastProc.stderr.emit('data', Buffer.from('z'.repeat(100), 'utf8'));
    lastProc.emit('exit', 1, null);
    const resp = await pending;
    await pool.shutdown();
    expect(resp.error).toBe('z'.repeat(100));
    expect(resp.error).not.toContain('truncated');
  });
});

describe('grep 型守门:subagents 域不得新增"无 truncated 位的静默 slice"', () => {
  it('每个代码面 .slice( 都在 truncated 位旁或有名有姓(白名单)', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/subagents');
    // 白名单:字符串常量前缀/后缀剥离与随机 id 生成 —— 不是"喂给下一步判定的集合"
    const whitelist = [
      /toString\(36\)\.slice\(/,
      /\.slice\([^)]*['"`]/, // slice('worktree '.length) / slice(0, -'.json'.length) 形:常量前后缀剥离
      /\.slice\(1\)/, // 去单个首字符(domain.slice(1))
    ];
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const lines = readFileSync(join(dir, f), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // 注释不是调用点
        if (!line.includes('.slice(')) return;
        if (whitelist.some((re) => re.test(line))) return;
        if (/truncated/i.test(line)) return; // 本行自带标记(如 boundedTail)
        const window = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 6)).join('\n');
        if (/truncated/i.test(window)) return; // 5 行内带 truncated 位
        offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
