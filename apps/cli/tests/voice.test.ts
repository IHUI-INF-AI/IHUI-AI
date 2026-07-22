import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  checkMicrophoneAvailable,
  recordAudio,
  transcribeAudio,
  voiceInput,
  formatRecordResult,
  formatTranscribeResult,
  type RecordAudioResult,
  type TranscribeResult,
} from '../src/voice/index.js';

// mock spawn/spawnSync/fetch(避免真实录音 + 网络请求)
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
  spawn: vi.fn(),
}));

import { spawnSync, spawn } from 'node:child_process';

// 创建 mock 的 spawn 返回值类型
interface MockProcess {
  stderr: { on: (event: string, cb: (chunk: Buffer) => void) => void };
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

describe('voice STT 模块', () => {
  let tmpDir: string;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-voice-test-'));
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('checkMicrophoneAvailable', () => {
    it('ffmpeg 返回 exit 0 时返回 true', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 0,
        output: [],
        signal: null,
      });
      expect(checkMicrophoneAvailable()).toBe(true);
      expect(spawnSync).toHaveBeenCalledWith('ffmpeg', ['-version'], expect.objectContaining({
        encoding: 'utf-8',
        windowsHide: true,
      }));
    });

    it('ffmpeg 返回非零 exit 时返回 false', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'error',
        pid: 0,
        output: [],
        signal: null,
      });
      expect(checkMicrophoneAvailable()).toBe(false);
    });

    it('ffmpeg status 为 null(进程被信号杀死)时返回 false', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: null,
        stdout: '',
        stderr: '',
        pid: 0,
        output: [],
        signal: 'SIGTERM',
      });
      expect(checkMicrophoneAvailable()).toBe(false);
    });
  });

  describe('recordAudio', () => {
    it('成功录音并返回文件信息', async () => {
      const outputPath = path.join(tmpDir, 'test.wav');
      // mock spawn 返回的进程
      const mockProc: MockProcess = {
        stderr: { on: () => {} },
        on: (event, cb) => {
          if (event === 'close') {
            // 写入假文件以便 statSync 成功
            fs.writeFileSync(outputPath, Buffer.from('fake-audio-data'));
            cb(0);
          }
        },
      };
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const result = await recordAudio({ durationSec: 3, outputPath });
      expect(result.filePath).toBe(outputPath);
      expect(result.durationSec).toBe(3);
      expect(result.sizeBytes).toBeGreaterThan(0);
      // 验证 spawn 调用参数包含 ffmpeg + 时长
      expect(spawn).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining(['-t', '3']), expect.anything());
    });

    it('ffmpeg 退出码非零时 reject', async () => {
      const mockProc: MockProcess = {
        stderr: { on: (_event, cb) => cb(Buffer.from('error message')) },
        on: (event, cb) => {
          if (event === 'close') cb(1);
        },
      };
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      await expect(recordAudio({ durationSec: 1, outputPath: path.join(tmpDir, 'fail.wav') }))
        .rejects.toThrow(/ffmpeg 录音失败/);
    });

    it('spawn error 事件触发 reject', async () => {
      const mockProc: MockProcess = {
        stderr: { on: () => {} },
        on: (event, cb) => {
          if (event === 'error') cb(new Error('ENOENT'));
        },
      };
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      await expect(recordAudio({ durationSec: 1, outputPath: path.join(tmpDir, 'err.wav') }))
        .rejects.toThrow(/ffmpeg 启动失败/);
    });

    it('使用默认参数(无 opts)时正常工作', async () => {
      // 捕获 spawn 调用参数,以便提取内部生成的 outputPath
      const mockProc: MockProcess = {
        stderr: { on: () => {} },
        on: (event, cb) => {
          if (event === 'close') {
            // 从 spawn 调用参数中提取内部生成的 outputPath(最后一个参数)
            const callArgs = vi.mocked(spawn).mock.calls[0]?.[1] ?? [];
            expect(callArgs).toContain('-t');
            expect(callArgs).toContain('5');
            // outputPath 是 args 数组最后一个元素
            const outputPath = callArgs[callArgs.length - 1] as string;
            fs.writeFileSync(outputPath, Buffer.from('data'));
            cb(0);
          }
        },
      };
      vi.mocked(spawn).mockReturnValue(mockProc as never);
      const result = await recordAudio();
      expect(result.durationSec).toBe(5);
      // 清理默认路径文件
      try { fs.unlinkSync(result.filePath); } catch { /* noop */ }
    });
  });

  describe('transcribeAudio', () => {
    it('成功转写并返回文本', async () => {
      const audioPath = path.join(tmpDir, 'audio.wav');
      fs.writeFileSync(audioPath, Buffer.from('audio-data'));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: '你好世界', stub: false, model: 'whisper-1' }),
      }) as unknown as typeof fetch;

      const result = await transcribeAudio(audioPath, { apiUrl: 'http://localhost:8803' });
      expect(result.text).toBe('你好世界');
      expect(result.stub).toBe(false);
      expect(result.model).toBe('whisper-1');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // 验证 fetch 调用
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8803/api/voice/stt',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('API 返回非 ok 时抛错', async () => {
      const audioPath = path.join(tmpDir, 'audio.wav');
      fs.writeFileSync(audioPath, Buffer.from('audio-data'));

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }) as unknown as typeof fetch;

      await expect(transcribeAudio(audioPath, { apiUrl: 'http://localhost:8803' }))
        .rejects.toThrow(/STT API 返回 500/);
    });

    it('language 参数透传到 multipart body', async () => {
      const audioPath = path.join(tmpDir, 'audio.wav');
      fs.writeFileSync(audioPath, Buffer.from('audio-data'));

      let capturedBody: Buffer | undefined;
      global.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        capturedBody = opts.body as Buffer;
        return {
          ok: true,
          status: 200,
          json: async () => ({ text: 'こんにちは', stub: false }),
        };
      }) as unknown as typeof fetch;

      await transcribeAudio(audioPath, { apiUrl: 'http://localhost:8803', language: 'ja' });
      expect(capturedBody).toBeDefined();
      const bodyStr = capturedBody!.toString('utf-8');
      expect(bodyStr).toContain('name="language"');
      expect(bodyStr).toContain('ja');
    });

    it('网络错误抛 STT 请求失败', async () => {
      const audioPath = path.join(tmpDir, 'audio.wav');
      fs.writeFileSync(audioPath, Buffer.from('audio-data'));

      global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

      await expect(transcribeAudio(audioPath, { apiUrl: 'http://localhost:8803' }))
        .rejects.toThrow(/STT 请求失败/);
    });

    it('apiKey 透传到 Authorization header', async () => {
      const audioPath = path.join(tmpDir, 'audio.wav');
      fs.writeFileSync(audioPath, Buffer.from('audio-data'));

      let capturedHeaders: Record<string, string> | undefined;
      global.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        capturedHeaders = opts.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({ text: 'ok' }),
        };
      }) as unknown as typeof fetch;

      await transcribeAudio(audioPath, { apiUrl: 'http://localhost:8803', apiKey: 'sk-test' });
      expect(capturedHeaders?.Authorization).toBe('Bearer sk-test');
    });
  });

  describe('voiceInput', () => {
    it('完整流程:录音 + 转写 + 清理临时文件', async () => {
      const outputPath = path.join(tmpDir, 'voice.wav');
      const mockProc: MockProcess = {
        stderr: { on: () => {} },
        on: (event, cb) => {
          if (event === 'close') {
            fs.writeFileSync(outputPath, Buffer.from('audio'));
            cb(0);
          }
        },
      };
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: 'final text', stub: true, model: 'stub' }),
      }) as unknown as typeof fetch;

      const result = await voiceInput({
        durationSec: 2,
        outputPath,
        apiUrl: 'http://localhost:8803',
      });
      expect(result.text).toBe('final text');
      expect(result.transcribe.stub).toBe(true);
      expect(result.record.filePath).toBe(outputPath);
      // 临时文件应被清理
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('转写失败时也清理临时文件', async () => {
      const outputPath = path.join(tmpDir, 'voice2.wav');
      const mockProc: MockProcess = {
        stderr: { on: () => {} },
        on: (event, cb) => {
          if (event === 'close') {
            fs.writeFileSync(outputPath, Buffer.from('audio'));
            cb(0);
          }
        },
      };
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'err',
      }) as unknown as typeof fetch;

      await expect(voiceInput({
        durationSec: 1,
        outputPath,
        apiUrl: 'http://localhost:8803',
      })).rejects.toThrow();
      // 临时文件应被清理(即使转写失败)
      expect(fs.existsSync(outputPath)).toBe(false);
    });
  });

  describe('formatRecordResult', () => {
    it('正确格式化录音结果', () => {
      const result: RecordAudioResult = {
        filePath: '/tmp/voice-123.wav',
        durationSec: 5,
        sizeBytes: 16000,
      };
      const formatted = formatRecordResult(result);
      expect(formatted).toContain('[录音完成]');
      expect(formatted).toContain('5s');
      expect(formatted).toContain('15.6KB');  // 16000/1024 = 15.6
      expect(formatted).toContain('voice-123.wav');
    });

    it('小文件显示 0.0KB', () => {
      const result: RecordAudioResult = {
        filePath: '/tmp/x.wav',
        durationSec: 1,
        sizeBytes: 100,
      };
      const formatted = formatRecordResult(result);
      expect(formatted).toContain('0.1KB');  // 100/1024 ≈ 0.1
    });
  });

  describe('formatTranscribeResult', () => {
    it('正确格式化转写结果(stub + model 标签)', () => {
      const result: TranscribeResult = {
        text: 'hello world',
        stub: true,
        model: 'whisper-1',
        durationMs: 250,
      };
      const formatted = formatTranscribeResult(result);
      expect(formatted).toContain('[转写完成');
      expect(formatted).toContain('[stub 模式]');
      expect(formatted).toContain('[whisper-1]');
      expect(formatted).toContain('250ms');
      expect(formatted).toContain('hello world');
    });

    it('非 stub 无 model 时只显示基础信息', () => {
      const result: TranscribeResult = {
        text: 'plain text',
        stub: false,
        durationMs: 100,
      };
      const formatted = formatTranscribeResult(result);
      expect(formatted).not.toContain('[stub 模式]');
      expect(formatted).not.toContain('[]');
      expect(formatted).toContain('100ms');
      expect(formatted).toContain('plain text');
    });
  });
});
