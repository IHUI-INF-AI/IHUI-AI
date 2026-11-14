// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D-AI-3(2026-11-13,错误卡目录化)拼装层钉:
// `buildStreamErrorLabelSet` 是三端共用的 labels 构造器 —— 端上只喂两个取词函数,
// 9 档动作 + 5 态准入 + catalog 的映射**只写这一份**(§3 共享层优先)。
// 这里钉四件:
// ① 9 档动作 / 5 态准入全档产出,无遗漏(枚举闭集遍历,加档时这里红);
// ② **缺键归空串**:取词函数未命中返回 key 本身 ⇒ 归一成空串(键名回显会被当真文案喷出);
// ③ catalog 经同一缺键判据:未收录码的 title/action 取词回显 key ⇒ 空串 ⇒ buildStreamErrorView 不呈现;
// ④ 真实词表贯通:用 shared zh-CN 的 streamErrors + errorCatalog 喂进去,CONTEXT_TOO_LONG 出具体标题+建议。
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { buildStreamErrorLabelSet, buildStreamErrorView } from '../stream-error-view'
import { STREAM_ERROR_ACTIONS } from '../stream-error-disposition'
import { ADMISSION_PHASES } from '../send-admission'

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..')
const SHARED_MESSAGES = join(REPO_ROOT, 'packages/i18n/messages/shared')

describe('buildStreamErrorLabelSet 拼装层', () => {
  it('① 9 档动作 + 5 态准入全档产出,无遗漏', () => {
    // 桩:命中即返回「文案:<key>」,便于断言每档都被取过词
    const labels = buildStreamErrorLabelSet({
      tStream: (k) => `文案:${k}`,
      tCatalog: (k) => `目录:${k}`,
    })
    for (const a of STREAM_ERROR_ACTIONS) {
      expect(labels.actions[a]).toBe(`文案:action.${a}`)
    }
    for (const p of ADMISSION_PHASES) {
      expect(labels.admission[p]).toBe(`文案:admission.${p}`)
    }
    expect(labels.nextStepLabel).toBe('文案:nextStepLabel')
  })

  it('② 缺键归空串:取词回显 key 时归一成空串,不把键名当文案', () => {
    // 模拟小程序 loader / next-intl 缺键行为:未命中返回传入的 key 本身
    const labels = buildStreamErrorLabelSet({
      tStream: (k) => k,
      tCatalog: (k) => k,
    })
    for (const a of STREAM_ERROR_ACTIONS) {
      expect(labels.actions[a]).toBe('')
    }
    for (const p of ADMISSION_PHASES) {
      expect(labels.admission[p]).toBe('')
    }
    expect(labels.nextStepLabel).toBe('')
    expect(labels.catalog('CONTEXT_TOO_LONG.title')).toBe('')
  })

  it('③ 未收录码 → buildStreamErrorView 回落 fallback,不喷键名', () => {
    const labels = buildStreamErrorLabelSet({
      tStream: (k) => `文案:${k}`,
      tCatalog: (k) => `目录:${k}`,
    })
    const view = buildStreamErrorView({
      errorCode: 'TOTALLY_UNKNOWN_CODE',
      fallbackTitle: '请求失败',
      fallbackMessage: '网络异常,请稍后重试',
      labels,
    })
    expect(view.title).toBe('请求失败')
    expect(view.detail).toBe('网络异常,请稍后重试')
    expect(view.action).toBeNull()
    expect(view.retryable).toBeNull()
  })

  it('④ 真实词表贯通:CONTEXT_TOO_LONG 出具体标题 + 建议动作', () => {
    const zh = JSON.parse(readFileSync(join(SHARED_MESSAGES, 'zh-CN.json'), 'utf8')) as Record<
      string,
      never
    >
    const streamErrors = (zh as unknown as { streamErrors: Record<string, never> }).streamErrors
    const errorCatalog = (
      zh as unknown as { ai: { pane: { errorCatalog: Record<string, Record<string, string>> } } }
    ).ai.pane.errorCatalog
    const labels = buildStreamErrorLabelSet({
      tStream: (k) => {
        const [ns, sub] = k.split('.')
        const table = streamErrors as unknown as Record<string, Record<string, string>>
        return table?.[ns]?.[sub] ?? k
      },
      tCatalog: (k) => {
        const [code, field] = k.split('.')
        return errorCatalog?.[code]?.[field] ?? k
      },
    })
    const view = buildStreamErrorView({
      errorCode: 'CONTEXT_TOO_LONG',
      fallbackTitle: '',
      fallbackMessage: '原始报错',
      labels,
    })
    // 目录命中:标题来自词表(非 fallback),建议动作非空
    expect(view.title.length).toBeGreaterThan(0)
    expect(view.title).not.toBe('')
    expect(view.detail).not.toBeNull()
    // 9 档动作标签全部非空(词表齐全)
    for (const a of STREAM_ERROR_ACTIONS) {
      expect(labels.actions[a].length).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
