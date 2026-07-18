/**
 * Voice STT — 语音输入(录音 + 转写)。
 *
 * 灵感来源:参考行业 Agent 框架的 voice input 能力(用户口述 → 转文本 → 注入 prompt)。
 * 简化策略(做减法):
 *   - 录音:跨平台调用 ffmpeg(开发机常备,零 npm 依赖)
 *   - 转写:POST 音频文件到 ai-service /api/voice/stt 端点
 *   - feature flag 默认关闭(settings.voice.enabled),关闭时完全零回归
 *   - Windows 兼容:PowerShell 执行 ffmpeg,path 含空格正确转义
 *
 * 使用方式:
 *   1. settings.voice.enabled = true 启用
 *   2. /voice 录音 5 秒并转写
 *   3. /voice 10 录音 10 秒并转写
 *   4. 转写结果直接注入为下一条 user 消息
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync, spawn } from 'node:child_process';

/** 录音选项 */
export interface RecordAudioOptions {
  /** 录音时长(秒,默认 5) */
  durationSec?: number;
  /** 输出文件路径(默认临时文件) */
  outputPath?: string;
  /** 采样率(默认 16000,whisper 推荐) */
  sampleRate?: number;
  /** 声道数(默认 1,单声道) */
  channels?: number;
}

/** 录音结果 */
export interface RecordAudioResult {
  /** 音频文件绝对路径 */
  filePath: string;
  /** 录音时长(秒) */
  durationSec: number;
  /** 文件大小(字节) */
  sizeBytes: number;
}

/** 转写选项 */
export interface TranscribeOptions {
  /** ai-service API URL(如 http://localhost:8000) */
  apiUrl: string;
  /** API key(可选,透传 Authorization) */
  apiKey?: string;
  /** 语言提示(如 zh/en/ja,可选) */
  language?: string;
  /** 超时毫秒(默认 30000) */
  timeoutMs?: number;
}

/** 转写结果 */
export interface TranscribeResult {
  /** 转写文本 */
  text: string;
  /** 是否为 stub 模式(后端无 API key) */
  stub: boolean;
  /** 使用的模型 */
  model?: string;
  /** 耗时毫秒 */
  durationMs: number;
}

/** Voice input 完整选项 */
export interface VoiceInputOptions extends RecordAudioOptions, TranscribeOptions {}

/** Voice input 完整结果 */
export interface VoiceInputResult {
  /** 录音结果 */
  record: RecordAudioResult;
  /** 转写结果 */
  transcribe: TranscribeResult;
  /** 最终文本 */
  text: string;
}

/**
 * 检测系统是否有可用的录音工具(ffmpeg)。
 * ffmpeg 跨平台(Windows/macOS/Linux),是最佳通用选择。
 */
export function checkMicrophoneAvailable(): boolean {
  const result = spawnSync('ffmpeg', ['-version'], {
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 5000,
  });
  return result.status === 0;
}

/**
 * 跨平台录音:调用 ffmpeg 从默认麦克风录制 WAV 音频。
 *
 * ffmpeg 参数:
 *   -f dshow (Windows) / avfoundation (macOS) / alsa (Linux)
 *   -i default — 默认音频输入设备
 *   -t <duration> — 录音时长
 *   -ar <sample_rate> — 采样率
 *   -ac <channels> — 声道数
 *   -y — 覆盖输出文件
 */
export async function recordAudio(opts: RecordAudioOptions = {}): Promise<RecordAudioResult> {
  const duration = opts.durationSec ?? 5;
  const sampleRate = opts.sampleRate ?? 16000;
  const channels = opts.channels ?? 1;
  const outputPath = opts.outputPath ?? path.join(os.tmpdir(), `ihui-voice-${Date.now()}.wav`);

  // 平台特定的输入格式
  const platform = process.platform;
  let inputArgs: string[];
  if (platform === 'win32') {
    // Windows: dshow(需设备名,用 "default" 简化,实际用音频设备名)
    // 简化:用 -f dshow -i audio="Microphone" 可能因设备名不同失败,
    // 改用 -f dshow -list_devices true 列设备太复杂,这里用通用 "audio=" 默认
    inputArgs = ['-f', 'dshow', '-i', 'audio=Microphone'];
  } else if (platform === 'darwin') {
    // macOS: avfoundation,默认输入设备 ":0"
    inputArgs = ['-f', 'avfoundation', '-i', ':0'];
  } else {
    // Linux: alsa,默认设备 "default"
    inputArgs = ['-f', 'alsa', '-i', 'default'];
  }

  const args = [
    ...inputArgs,
    '-t', String(duration),
    '-ar', String(sampleRate),
    '-ac', String(channels),
    '-y', // 覆盖输出
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      reject(new Error(`ffmpeg 启动失败: ${err.message}(请确认 ffmpeg 已安装并在 PATH 中)`));
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        // Windows dshow 设备名可能不是 "Microphone",给出友好提示
        const hint = platform === 'win32'
          ? '(Windows 下可能需要用 ffmpeg -f dshow -list_devices true -i dummy 查看设备名)'
          : '';
        reject(new Error(`ffmpeg 录音失败(exit ${code})${hint}\n${stderr.slice(-500)}`));
        return;
      }
      try {
        const stat = fs.statSync(outputPath);
        resolve({
          filePath: outputPath,
          durationSec: duration,
          sizeBytes: stat.size,
        });
      } catch {
        reject(new Error(`录音文件创建失败: ${outputPath}`));
      }
    });
  });
}

/**
 * 发送音频文件到 ai-service /api/voice/stt 端点进行转写。
 * 使用 Node 18+ 内置 fetch + multipart/form-data(手工构造,零依赖)。
 */
export async function transcribeAudio(
  audioPath: string,
  opts: TranscribeOptions,
): Promise<TranscribeResult> {
  const startTime = Date.now();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const url = `${opts.apiUrl.replace(/\/$/, '')}/api/voice/stt`;

  // 读取音频文件
  const fileBuffer = fs.readFileSync(audioPath);
  const fileName = path.basename(audioPath);

  // 手工构造 multipart/form-data(零依赖,不引入 form-data 包)
  const boundary = `----ihui-voice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];

  // 文件 part
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
  parts.push(Buffer.from('Content-Type: audio/wav\r\n\r\n'));
  parts.push(fileBuffer);
  parts.push(Buffer.from('\r\n'));

  // language part(可选)
  if (opts.language) {
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="language"\r\n\r\n`));
    parts.push(Buffer.from(`${opts.language}\r\n`));
  }

  // 结束边界
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    if (opts.apiKey) {
      headers['Authorization'] = `Bearer ${opts.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`STT API 返回 ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as { text?: string; stub?: boolean; model?: string };
    return {
      text: data.text ?? '',
      stub: data.stub ?? false,
      model: data.model,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('aborted')) {
      throw new Error(`STT 请求超时(${timeoutMs / 1000}s)`);
    }
    throw new Error(`STT 请求失败: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 完整的语音输入流程:录音 + 转写。
 * 返回转写文本,可直接注入为 user 消息。
 */
export async function voiceInput(opts: VoiceInputOptions): Promise<VoiceInputResult> {
  const record = await recordAudio(opts);
  try {
    const transcribe = await transcribeAudio(record.filePath, opts);
    return {
      record,
      transcribe,
      text: transcribe.text,
    };
  } finally {
    // 转写完成后清理临时音频文件
    try {
      fs.unlinkSync(record.filePath);
    } catch {
      // 清理失败忽略
    }
  }
}

/**
 * 格式化录音结果为可显示的字符串。
 */
export function formatRecordResult(result: RecordAudioResult): string {
  const sizeKb = (result.sizeBytes / 1024).toFixed(1);
  return `[录音完成] ${result.durationSec}s, ${sizeKb}KB, ${path.basename(result.filePath)}`;
}

/**
 * 格式化转写结果为可显示的字符串。
 */
export function formatTranscribeResult(result: TranscribeResult): string {
  const stubTag = result.stub ? ' [stub 模式]' : '';
  const modelTag = result.model ? ` [${result.model}]` : '';
  return `[转写完成${stubTag}${modelTag}] ${result.durationMs}ms\n${result.text}`;
}
