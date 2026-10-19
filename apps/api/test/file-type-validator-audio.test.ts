// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 文件类型校验器 —— 音频白名单单测(2026-10-16 语音消息上线)。
 * 覆盖 m4a/mp3/wav/aac 的 magic number 判定与 MIME 一致性,
 * 以及「音频字节伪装成图片扩展名」必须被拒(CWE-434 防护不回退)。
 */
import { describe, expect, it } from 'vitest'
import { validateUploadFile, MAX_UPLOAD_SIZE } from '../src/utils/file-type-validator'

/** 构造最小合法 m4a(MP4 容器:size + 'ftyp' + brand) */
function m4aBuffer(): Buffer {
  const b = Buffer.alloc(16)
  b.writeUInt32BE(16, 0)
  b.write('ftyp', 4, 'latin1')
  b.write('M4A ', 8, 'latin1')
  return b
}

/** 构造最小合法 wav(RIFF....WAVE) */
function wavBuffer(): Buffer {
  const b = Buffer.alloc(16)
  b.write('RIFF', 0, 'latin1')
  b.writeUInt32BE(16, 8)
  b.write('WAVE', 8, 'latin1')
  return b
}

/** 构造最小合法 mp3(ID3v2 头) */
function mp3Id3Buffer(): Buffer {
  const b = Buffer.alloc(16)
  b.write('ID3', 0, 'latin1')
  return b
}

/** 构造最小合法 mp3(MPEG 帧同步 0xFF 0xFB) */
function mp3FrameSyncBuffer(): Buffer {
  const b = Buffer.alloc(16)
  b[0] = 0xff
  b[1] = 0xfb
  return b
}

/** 构造最小合法 aac(ADTS 帧同步 0xFF 0xF1) */
function aacBuffer(): Buffer {
  const b = Buffer.alloc(16)
  b[0] = 0xff
  b[1] = 0xf1
  return b
}

describe('validateUploadFile 音频类型(2026-10-16)', () => {
  it('m4a(expo-audio 录音产物)通过校验,canonical MIME = audio/mp4', () => {
    const r = validateUploadFile(m4aBuffer(), 'voice-123.m4a', 'audio/m4a')
    expect(r).toEqual({ ok: true, extension: 'm4a', mimeType: 'audio/mp4' })
  })

  it('m4a 接受 audio/mp4 / audio/x-m4a 声明值', () => {
    expect(validateUploadFile(m4aBuffer(), 'a.m4a', 'audio/mp4').ok).toBe(true)
    expect(validateUploadFile(m4aBuffer(), 'a.m4a', 'audio/x-m4a').ok).toBe(true)
  })

  it('mp3(ID3 头与帧同步两种形态)通过校验', () => {
    expect(validateUploadFile(mp3Id3Buffer(), 'a.mp3', 'audio/mpeg').ok).toBe(true)
    expect(validateUploadFile(mp3FrameSyncBuffer(), 'a.mp3', 'audio/mp3').ok).toBe(true)
  })

  it('wav(RIFF/WAVE)通过校验', () => {
    const r = validateUploadFile(wavBuffer(), 'a.wav', 'audio/wav')
    expect(r).toEqual({ ok: true, extension: 'wav', mimeType: 'audio/wav' })
  })

  it('aac(ADTS 帧同步)通过校验', () => {
    const r = validateUploadFile(aacBuffer(), 'a.aac', 'audio/aac')
    expect(r).toEqual({ ok: true, extension: 'aac', mimeType: 'audio/aac' })
  })

  it('音频字节 + 图片扩展名(magic 不匹配)必须拒绝', () => {
    const r = validateUploadFile(m4aBuffer(), 'evil.png', 'image/png')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('magic')
  })

  it('图片字节 + 音频扩展名(magic 不匹配)必须拒绝', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
    const r = validateUploadFile(png, 'evil.m4a', 'audio/mp4')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('magic')
  })

  it('空音频拒绝', () => {
    const r = validateUploadFile(Buffer.alloc(0), 'a.m4a', 'audio/mp4')
    expect(r.ok).toBe(false)
  })

  it('超限音频拒绝(默认 10MB 档)', () => {
    const big = Buffer.concat([m4aBuffer(), Buffer.alloc(MAX_UPLOAD_SIZE + 1)])
    const r = validateUploadFile(big, 'a.m4a', 'audio/mp4')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('MB')
  })
})
