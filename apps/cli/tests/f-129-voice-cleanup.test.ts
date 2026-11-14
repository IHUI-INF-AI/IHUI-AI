// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-129:录音失败/超时/取消都必须清掉半成品 wav,且 ffmpeg 卡住时不得挂死。
 *
 * 三个方向各一枚牙:
 *   ① 非零退出:此前只 reject 不 unlink ⇒ %TEMP% 留一份含用户语音的 wav;
 *   ② 超时:此前 spawn 无闸 ⇒ ffmpeg 卡在设备初始化时整条命令挂死;
 *   ③ AbortSignal:此前未接 signal ⇒ Ctrl+C 只能靠外层杀进程,半成品仍在。
 * 每例都断言"文件真的没了",不只断言错误文案。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点,属测试面而非生产依赖边
import { DEFAULT_RECORD_TIMEOUT_MS, recordAudio } from '../src/voice/index.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';

type Handler = (...args: unknown[]) => void;

/** 可控的假 ChildProcess:事件由用例手动 emit,不依赖真实 ffmpeg */
class FakeProc {
  readonly stderr = { on: (_event: string, _cb: (chunk: Buffer) => void): void => {} };
  readonly kill = vi.fn();
  private readonly handlers = new Map<string, Handler>();

  on(event: string, cb: Handler): this {
    this.handlers.set(event, cb);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.(...args);
  }
}

describe('F-129 录音失败清理 / 超时 / 取消', () => {
  let tmpDir = '';

  beforeEach(() => {
    tmpDir = mkScratch('f129-voice-');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmScratch(tmpDir);
  });

  it('非零退出:删除半成品 wav 并 reject', async () => {
    const outputPath = path.join(tmpDir, 'fail.wav');
    const proc = new FakeProc();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const pending = recordAudio({ durationSec: 1, outputPath, recordTimeoutMs: 60_000 });
    // 模拟 ffmpeg 已写出半截文件后失败
    fs.writeFileSync(outputPath, Buffer.from('half-audio'));
    proc.emit('close', 1);

    await expect(pending).rejects.toThrow(/ffmpeg 录音失败/);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('超时:kill 子进程、reject 并清理半成品', async () => {
    vi.useFakeTimers();
    const outputPath = path.join(tmpDir, 'timeout.wav');
    const proc = new FakeProc();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const pending = recordAudio({ durationSec: 60, outputPath, recordTimeoutMs: 30 });
    const settled = pending.then(() => null, (error: Error) => error);
    fs.writeFileSync(outputPath, Buffer.from('partial'));

    await vi.advanceTimersByTimeAsync(30);

    const error = await settled;
    expect(error?.message).toMatch(/录音超时/);
    expect(proc.kill).toHaveBeenCalled();
    expect(fs.existsSync(outputPath)).toBe(false);

    // 被 kill 之后 close 仍会到达:不得二次收尾,也不得把结果改判为成功
    proc.emit('close', null);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('AbortSignal:取消时 kill + reject + 清理,且只收尾一次', async () => {
    const outputPath = path.join(tmpDir, 'abort.wav');
    const proc = new FakeProc();
    vi.mocked(spawn).mockReturnValue(proc as never);
    const controller = new AbortController();

    const pending = recordAudio({ durationSec: 60, outputPath, signal: controller.signal });
    const settled = pending.then(() => null, (error: Error) => error);
    fs.writeFileSync(outputPath, Buffer.from('partial'));

    controller.abort();
    const error = await settled;

    expect(error?.message).toMatch(/录音已取消/);
    expect(proc.kill).toHaveBeenCalled();
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('默认超时常量可被测试观测(120s)', () => {
    expect(DEFAULT_RECORD_TIMEOUT_MS).toBe(120_000);
  });

  it.skipIf(process.platform === 'win32')('成功录音后文件收口为 0600', async () => {
    const outputPath = path.join(tmpDir, 'ok.wav');
    const proc = new FakeProc();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const pending = recordAudio({ durationSec: 1, outputPath, recordTimeoutMs: 60_000 });
    fs.writeFileSync(outputPath, Buffer.from('audio'));
    proc.emit('close', 0);

    await expect(pending).resolves.toMatchObject({ filePath: outputPath });
    expect(fs.statSync(outputPath).mode & 0o777).toBe(0o600);
  });
});
