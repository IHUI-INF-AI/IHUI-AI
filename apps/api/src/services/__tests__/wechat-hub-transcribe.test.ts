// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语音转写服务层回归：不连真实数据库、不起服务。
 * DB 走 thenable 链桩（db 与 dbRead 都 mock），STT、文件读盘、HTTP 下载全部替身。
 * 覆盖：成功写库、stub 不写库、批量单条失败隔离、超大音频跳过且不调 STT、
 * 桥接占位文案/纯空白按未转写处理、非语音/已转写校验、http 下载分支、常量契约。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { tmpdir } from 'node:os'

const hoisted = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  stt: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: { update: hoisted.update },
  dbRead: { select: hoisted.select },
}))

vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: async () => ({ id: 'acc-1', label: '测试号' }),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: hoisted.stt,
}))

vi.mock('node:fs/promises', () => ({
  readFile: hoisted.readFile,
  stat: hoisted.stat,
  readdir: hoisted.readdir,
}))

import {
  DEFAULT_VOICE_BATCH_LIMIT,
  MAX_VOICE_AUDIO_BYTES,
  MAX_VOICE_BATCH_LIMIT,
  transcribeAccountVoice,
  transcribeMessage,
} from '../wechat-hub/transcribe'

/** 同时支持 await 与链式调用的最小查询桩，与导出分发测试同一范式。 */
function chain(result: unknown) {
  const node: Record<string, unknown> = {
    from: () => node,
    where: () => node,
    orderBy: () => node,
    limit: () => node,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return node
}

function voiceRow(id: string, mediaUrl: string, content = '') {
  return { id, kind: 'voice', content, mediaUrl }
}

function sttOk(text: string, model = 'whisper-small-local') {
  return {
    ok: true,
    status: 200,
    json: async () => ({ text, stub: false, model }),
  }
}

const MEDIA_ROOT = path.join(tmpdir(), 'ihui-transcribe-test')
const previousRoot = process.env.WECHAT_HUB_MEDIA_ROOT

beforeEach(() => {
  process.env.WECHAT_HUB_MEDIA_ROOT = MEDIA_ROOT
  hoisted.select.mockReset()
  hoisted.update.mockReset()
  hoisted.set.mockReset()
  hoisted.stt.mockReset()
  hoisted.readFile.mockReset()
  hoisted.stat.mockReset()
  hoisted.readdir.mockReset()

  hoisted.update.mockImplementation(() => ({ set: hoisted.set }))
  hoisted.set.mockReturnValue({ where: async () => [] })
  hoisted.stat.mockResolvedValue({ isFile: () => true, size: 2048 })
  hoisted.readFile.mockResolvedValue(Buffer.from('audio-bytes'))
})

afterEach(() => {
  if (previousRoot === undefined) delete process.env.WECHAT_HUB_MEDIA_ROOT
  else process.env.WECHAT_HUB_MEDIA_ROOT = previousRoot
  vi.unstubAllGlobals()
})

describe('transcribeMessage 单条转写', () => {
  it('成功转写后 content 写入转写文本，model/chars 正确，mediaUrl 未被改动', async () => {
    const mediaUrl = path.join(MEDIA_ROOT, 'voice.m4a')
    hoisted.select.mockReturnValue(chain([voiceRow('m1', mediaUrl)]))
    hoisted.stt.mockResolvedValue(sttOk(' 你好，这是一段语音内容 '))

    const result = await transcribeMessage('u1', 'acc-1', 'm1')

    expect(result.stub).toBe(false)
    expect(result.text).toBe('你好，这是一段语音内容')
    expect(result.model).toBe('whisper-small-local')
    expect(result.chars).toBe(result.text.length)

    expect(hoisted.update).toHaveBeenCalledTimes(1)
    expect(hoisted.set).toHaveBeenCalledTimes(1)
    const patch = hoisted.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch?.content).toBe('你好，这是一段语音内容')
    // 回写只动 content，mediaUrl 不得出现在 update 入参里。
    expect(patch?.mediaUrl).toBeUndefined()
  })

  it('content 为桥接占位文案 [语音] 时不判已转写，正常转写并覆盖占位', async () => {
    const mediaUrl = path.join(MEDIA_ROOT, 'voice.m4a')
    hoisted.select.mockReturnValue(chain([voiceRow('m9', mediaUrl, '[语音]')]))
    hoisted.stt.mockResolvedValue(sttOk('占位被替换成真实转写'))

    const result = await transcribeMessage('u1', 'acc-1', 'm9')

    expect(result.stub).toBe(false)
    expect(result.text).toBe('占位被替换成真实转写')
    expect(hoisted.update).toHaveBeenCalledTimes(1)
    const patch = hoisted.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch?.content).toBe('占位被替换成真实转写')
    // 占位文案被真实转写覆盖，mediaUrl 仍不得出现在 update 入参里。
    expect(patch?.mediaUrl).toBeUndefined()
  })

  it('content 为纯空白时按未转写处理，正常转写', async () => {
    const mediaUrl = path.join(MEDIA_ROOT, 'voice.m4a')
    hoisted.select.mockReturnValue(chain([voiceRow('m10', mediaUrl, '   ')]))
    hoisted.stt.mockResolvedValue(sttOk('纯空白行也能转'))

    const result = await transcribeMessage('u1', 'acc-1', 'm10')

    expect(result.stub).toBe(false)
    expect(result.text).toBe('纯空白行也能转')
    expect(hoisted.set).toHaveBeenCalledTimes(1)
    const patch = hoisted.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch?.content).toBe('纯空白行也能转')
  })

  it('stub=true 时不写库，返回 stub:true 并保留占位文本', async () => {
    const mediaUrl = path.join(MEDIA_ROOT, 'voice.m4a')
    hoisted.select.mockReturnValue(chain([voiceRow('m2', mediaUrl)]))
    hoisted.stt.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: '[stub] faster-whisper 未安装',
        stub: true,
        model: 'whisper-small-local',
      }),
    })

    const result = await transcribeMessage('u1', 'acc-1', 'm2')

    expect(result.stub).toBe(true)
    expect(result.text).toBe('[stub] faster-whisper 未安装')
    expect(hoisted.update).not.toHaveBeenCalled()
    expect(hoisted.set).not.toHaveBeenCalled()
  })

  it('非语音消息抛 400，已转写过的消息抛 409，都不触达 STT', async () => {
    hoisted.select.mockReturnValue(chain([{ id: 'm6', kind: 'text', content: '', mediaUrl: 'x' }]))
    await expect(transcribeMessage('u1', 'acc-1', 'm6')).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'WECHAT_VOICE_NOT_VOICE',
    })

    hoisted.select.mockReturnValue(
      chain([voiceRow('m7', path.join(MEDIA_ROOT, 'v.m4a'), '已有文本')]),
    )
    await expect(transcribeMessage('u1', 'acc-1', 'm7')).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'WECHAT_VOICE_ALREADY_TRANSCRIBED',
    })

    expect(hoisted.stt).not.toHaveBeenCalled()
    expect(hoisted.update).not.toHaveBeenCalled()
  })

  it('http(s) 音频走 HEAD 探测 + GET 下载分支，成功转写并写库', async () => {
    const fetchMock = vi.fn(async (_input: unknown, init?: { method?: string }) => {
      const method = init?.method ?? 'GET'
      if (method === 'HEAD') {
        return { ok: true, headers: { get: (): string | null => null } }
      }
      return {
        ok: true,
        headers: { get: (): string | null => null },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    hoisted.select.mockReturnValue(chain([voiceRow('m5', 'https://media.example.com/voice.mp3')]))
    hoisted.stt.mockResolvedValue(sttOk('网络音频转写'))

    const result = await transcribeMessage('u1', 'acc-1', 'm5')

    expect(result.stub).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(hoisted.update).toHaveBeenCalledTimes(1)
  })
})

describe('transcribeAccountVoice 批量转写', () => {
  it('一条 STT 异常不影响其余成功，failed/transcribed 计数正确', async () => {
    const rows = [
      voiceRow('m1', path.join(MEDIA_ROOT, 'a.m4a')),
      voiceRow('m2', path.join(MEDIA_ROOT, 'b.m4a')),
      voiceRow('m3', path.join(MEDIA_ROOT, 'c.m4a')),
    ]
    hoisted.select.mockReturnValue(chain(rows))
    hoisted.stt
      .mockResolvedValueOnce(sttOk('第一条转写'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(sttOk('第三条转写'))

    const result = await transcribeAccountVoice('u1', 'acc-1')

    expect(result.scanned).toBe(3)
    expect(result.transcribed).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.items.map((item) => item.ok)).toEqual([true, false, true])
    expect(result.items[1]?.error).toContain('network down')
    expect(hoisted.update).toHaveBeenCalledTimes(2)
  })

  it('混有占位文案 [语音] 的候选被正常转写，计入 transcribed 而非 skipped', async () => {
    const rows = [
      voiceRow('m1', path.join(MEDIA_ROOT, 'a.m4a')),
      voiceRow('m2', path.join(MEDIA_ROOT, 'b.m4a'), '[语音]'),
    ]
    hoisted.select.mockReturnValue(chain(rows))
    hoisted.stt
      .mockResolvedValueOnce(sttOk('空文本那条'))
      .mockResolvedValueOnce(sttOk('占位文案那条'))

    const result = await transcribeAccountVoice('u1', 'acc-1')

    expect(result.scanned).toBe(2)
    expect(result.transcribed).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.items.map((item) => item.ok)).toEqual([true, true])
  })

  it('超过 20MB 的音频被跳过，不读盘也不调用 STT', async () => {
    hoisted.stat.mockResolvedValue({ isFile: () => true, size: MAX_VOICE_AUDIO_BYTES + 1 })
    hoisted.select.mockReturnValue(chain([voiceRow('m4', path.join(MEDIA_ROOT, 'big.m4a'))]))

    const result = await transcribeAccountVoice('u1', 'acc-1')

    expect(result.scanned).toBe(1)
    expect(result.transcribed).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.items[0]?.ok).toBe(false)
    expect(result.items[0]?.error).toContain('20MB')
    expect(hoisted.stt).not.toHaveBeenCalled()
    expect(hoisted.readFile).not.toHaveBeenCalled()
    expect(hoisted.update).not.toHaveBeenCalled()
  })

  it('stub 结果计入 skipped，不写库', async () => {
    hoisted.select.mockReturnValue(chain([voiceRow('m8', path.join(MEDIA_ROOT, 'd.m4a'))]))
    hoisted.stt.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: '[STT 失败] 模型加载失败',
        stub: true,
        model: 'whisper-small-local',
      }),
    })

    const result = await transcribeAccountVoice('u1', 'acc-1')

    expect(result.scanned).toBe(1)
    expect(result.transcribed).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.items[0]?.ok).toBe(false)
    expect(result.items[0]?.error).toContain('stub')
    expect(hoisted.update).not.toHaveBeenCalled()
  })

  it('批量默认值与上限常量符合契约', () => {
    expect(DEFAULT_VOICE_BATCH_LIMIT).toBe(20)
    expect(MAX_VOICE_BATCH_LIMIT).toBe(50)
    expect(MAX_VOICE_AUDIO_BYTES).toBe(20 * 1024 * 1024)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
