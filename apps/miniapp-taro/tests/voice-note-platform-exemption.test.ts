// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 12 相语音笔记的平台豁免标注锁(D03 会话内快捷笔记 / G-50〔旧号〕,2026-10-27 立)。
 *
 * 票面判据:「miniapp 端按『平台独占:录音 API 差异』标注豁免」(AGENTS §9 平台独占豁免须显式标注)。
 * 本文件锁三格:
 * ① 小程序端录音工具文件头载有该豁免标注(在位);
 * ② 阳性对照:抹掉标注的文本必须被判死(避免"没标注"与"判据失明"同色);
 * ③ 小程序端**没接**共享 12 相机、也没自立第二份表/switch —— 与 shared 矩阵测试
 *    `NOT_YET_WIRED` 登记位(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx`)一致:
 *    豁免是"本端不做语音笔记 UI"的登记行为,不是"接了一半"。若哪天本端真的接线,
 *    这条锁会红,须连同豁免标注一起去掉并把文件搬进 shared 的 WIRED_CONSUMERS。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RECORDER_REL = 'src/utils/voice-recorder.ts'
const RECORDER_ABS = resolve(__dirname, '..', RECORDER_REL)

/** 票面原话:「平台独占:录音 API 差异」(全角冒号一并接受) */
const EXEMPTION = /平台独占[:：]\s*录音 API 差异/
/** 登记行里另须点名"本端不做语音笔记 UI",否则只是标注了差异、没说本端如何处置 */
const NO_UI_CLAIM = /本端不做语音笔记 UI/

function hasExemption(src: string): boolean {
  return EXEMPTION.test(src)
}

/** 端内自立判定表的两种形态:本地 switch、本地判定表(与 shared 矩阵测试同一把尺) */
const LOCAL_SWITCH_RE = /switch\s*\(\s*(?:\w+\.)?phase\s*\)\s*\{/
const LOCAL_RECORD_TABLE_RE = /Record<\s*VoiceNotePhase\s*,/

describe('小程序端 12 相语音笔记的平台豁免标注(D03 / AGENTS §9)', () => {
  const src = readFileSync(RECORDER_ABS, 'utf8')

  it('小程序录音工具文件头显式写明「平台独占:录音 API 差异」', () => {
    expect(
      hasExemption(src),
      '小程序录音工具缺 §9 平台豁免标注:Taro.getRecorderManager 的授权模型/生命周期与 web MediaRecorder 不同,应标注为平台独占',
    ).toBe(true)
  })

  it('豁免标注同时写明本端不做语音笔记 UI(登记行不是光标差异)', () => {
    expect(
      NO_UI_CLAIM.test(src),
      '豁免标注只写了差异、没写本端处置 ⇒ 票面要求的是"登记豁免"这一格',
    ).toBe(true)
  })

  it('阳性对照:抹掉该标注的文本必须被判死(证明上面两条不是恒真)', () => {
    const mutated = src.replace(EXEMPTION, '')
    expect(mutated).not.toBe(src)
    expect(hasExemption(mutated)).toBe(false)
  })

  it('小程序端未接共享 12 相机,也不许自立第二份表/switch', () => {
    // 既不引共享出口,也就没有第二份判定表(shared 矩阵测试 NOT_YET_WIRED 同一登记)
    expect(
      /transitionVoiceNotePhase|VoiceNotePhase/.test(src),
      '小程序端一旦开始用共享 12 相机,须把它搬进 shared 矩阵测试的 WIRED_CONSUMERS,并同步撤掉本端豁免标注',
    ).toBe(false)
    expect(LOCAL_SWITCH_RE.test(src), '小程序端自立了 switch (phase)').toBe(false)
    expect(LOCAL_RECORD_TABLE_RE.test(src), '小程序端自立了 phase 判定表').toBe(false)
  })
})
