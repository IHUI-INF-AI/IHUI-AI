// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D106 steer 交代帧消费(与第 49 轮 #11 citations 同款补法):steer 帧 miniapp 此前 0 消费。
// 渲染判定收敛为 types.ts 的纯函数,这里锁住两条性质:提示出现且带 text、空文本不出现。
import { describe, expect, it } from 'vitest'

import { appendSteerNotice, toSteerNotice, type SteerNoticeView } from '../types'

const evt: SteerNoticeView = { phase: 'injected', text: '重点讲清楚第 3 步的边界条件' }

describe('toSteerNotice(D106 空文本防御)', () => {
  it('正常文本 → 视图带原文(提示出现且带 text)', () => {
    const notice = toSteerNotice(evt)
    expect(notice).not.toBeNull()
    expect(notice?.text).toBe('重点讲清楚第 3 步的边界条件')
    expect(notice?.phase).toBe('injected')
  })

  it('空字符串 → null(不渲染)', () => {
    expect(toSteerNotice({ ...evt, text: '' })).toBeNull()
  })

  it('纯空白 → null(不渲染)', () => {
    expect(toSteerNotice({ ...evt, text: '   \n\t ' })).toBeNull()
  })

  it('两端空白被裁剪', () => {
    expect(toSteerNotice({ ...evt, text: '  讲慢一点  ' })?.text).toBe('讲慢一点')
  })
})

describe('appendSteerNotice(D106 累积)', () => {
  it('undefined 起点 → 单条', () => {
    expect(appendSteerNotice(undefined, evt)).toEqual([evt])
  })

  it('多次引导逐条追加,不整替', () => {
    const two = appendSteerNotice(appendSteerNotice(undefined, evt), {
      phase: 'injected',
      text: '换成表格输出',
    })
    expect(two.map((n) => n.text)).toEqual(['重点讲清楚第 3 步的边界条件', '换成表格输出'])
  })

  it('满 8 条后丢弃后续(对齐后端 _STEER_QUEUE_LIMIT)', () => {
    let list: SteerNoticeView[] | undefined
    for (let i = 0; i < 12; i++) {
      list = appendSteerNotice(list, { phase: 'injected', text: `引导 ${i}` })
    }
    expect(list).toHaveLength(8)
  })
})
