// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BUG-0023 形制锁:语音输入「完成回调单通道」。
 *
 * 病灶:STT 在 500ms 内落定时,`final` 事件先调一次 onComplete,`stopRecognizing()`
 * 返回非空 recognitionResult 再调一次 ⇒ 重复上屏/重复发送。
 * 判据:onComplete 的调用点只许有 1 处,且必须在 `on('final'` 回调里;
 * stopRecord 函数体不得再回调 onComplete,但必须仍 await stopRecognizing
 * (500ms 等待语义保留,只去掉第二条回调通道)。
 * 阳性对照:把二次回调加回去,下面三条必须同时判死 —— 防止锁恒真。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC_ABS = resolve(__dirname, '../src/components/VoiceInput.tsx')

/** onComplete 的可选调用形制(声明/透传不算调用点) */
const ON_COMPLETE_CALL = /onComplete\?\.\(/g
/** final 事件回调体:从 on('final' 到其收尾行 */
const FINAL_CALLBACK = /on\('final',\s*\(text\)\s*=>\s*\{([\s\S]*?)\n\s*\}\)/
/** stopRecord 回调体:const stopRecord = useCallback(async () => { ... }, [recording]) */
const STOP_RECORD_BODY =
  /const\s+stopRecord\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*,\s*\[recording\]\s*\)/

function countOnCompleteCalls(src: string): number {
  return (src.match(ON_COMPLETE_CALL) ?? []).length
}

function finalCallbackBody(src: string): string {
  const m = FINAL_CALLBACK.exec(src)
  const body = m?.[1]
  if (body === undefined) {
    throw new Error("源码形制已变:未找到 on('final' 事件回调,VoiceInput.tsx 的完成通道判定失效")
  }
  return body
}

function stopRecordBody(src: string): string {
  const m = STOP_RECORD_BODY.exec(src)
  const body = m?.[1]
  if (body === undefined) {
    throw new Error('源码形制已变:未找到 stopRecord 函数体,VoiceInput.tsx 的完成通道判定失效')
  }
  return body
}

/** 阳性对照用的破坏版本:把二次回调按原病灶写法加回 stopRecord */
const RESTORED_SECOND_CALLBACK = {
  from: 'await streamingRecognizer.stopRecognizing()',
  to: 'const text = await streamingRecognizer.stopRecognizing()\n    if (text) cbRef.current.onComplete?.(text)',
}

function restoreSecondCallback(src: string): string {
  return src.replace(RESTORED_SECOND_CALLBACK.from, RESTORED_SECOND_CALLBACK.to)
}

describe('VoiceInput 完成回调单通道(BUG-0023)', () => {
  const src = readFileSync(SRC_ABS, 'utf8')

  it("onComplete 的调用点在源码中只有 1 处,且位于 on('final') 回调内", () => {
    expect(countOnCompleteCalls(src), 'onComplete 出现多个调用点 ⇒ 完成通道被重新分裂').toBe(1)
    const finalBody = finalCallbackBody(src)
    expect(
      countOnCompleteCalls(finalBody),
      "唯一那处 onComplete 调用不在 on('final') 回调内 ⇒ 完成出口不是 final 事件",
    ).toBe(1)
    expect(finalBody).toContain('setPartial(')
  })

  it('stopRecord 函数体内不含 onComplete(不设第二条完成通道)', () => {
    const body = stopRecordBody(src)
    expect(body, 'stopRecord 内又出现了 onComplete ⇒ 二次回调加回来了').not.toContain('onComplete')
  })

  it('stopRecord 仍 await stopRecognizing(只删回调、不删 500ms 等待)', () => {
    const body = stopRecordBody(src)
    expect(
      /await\s+streamingRecognizer\.stopRecognizing\(\)/.test(body),
      'stopRecord 不再 await stopRecognizing ⇒ 时序改变,结果可能未落定就结束录音',
    ).toBe(true)
  })

  it('阳性对照:把二次回调加回来,上述三条判据必须红', () => {
    const broken = restoreSecondCallback(src)
    expect(broken).not.toBe(src)
    expect(countOnCompleteCalls(broken)).toBe(2)
    expect(countOnCompleteCalls(finalCallbackBody(broken))).toBe(1)
    expect(stopRecordBody(broken)).toContain('onComplete')
    expect(/await\s+streamingRecognizer\.stopRecognizing\(\)/.test(stopRecordBody(broken))).toBe(
      true,
    )
    // 守卫本体在破坏版本上复算一次,证明它们不是恒真
    expect(countOnCompleteCalls(broken) === 1).toBe(false)
    expect(stopRecordBody(broken).includes('onComplete')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
