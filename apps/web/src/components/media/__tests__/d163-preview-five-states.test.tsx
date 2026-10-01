// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'

import { previewCopyText } from '../preview-degradation-copy'
import {
  PreviewExpiredState,
  PreviewNoContentState,
  PreviewSnapshotNotice,
  PreviewTooLargeState,
} from '../preview-degradation-banner'
import {
  INITIAL_FEED_STATE,
  PREVIEW_MAX_BYTES,
  reducePreviewFeed,
} from '../use-preview-staleness'

afterEach(cleanup)

const copy = (key: Parameters<typeof previewCopyText>[1]) =>
  previewCopyText(undefined, key, undefined)

const OK = { kind: 'ok' as const, text: 'hello', at: 1, version: 'v1' }

describe('D163 预览五态(状态机层)', () => {
  it('loading:初始态', () => {
    expect(INITIAL_FEED_STATE.loading).toBe(true)
  })

  it('loadFailed 给重试:有记录时读失败 ⇒ cannot-read 态,渲染层出"重试"按钮', () => {
    const withRecord = reducePreviewFeed(INITIAL_FEED_STATE, {
      type: 'read',
      mode: 'initial',
      outcome: OK,
    })
    const degraded = reducePreviewFeed(withRecord, {
      type: 'read',
      mode: 'revalidate',
      outcome: { kind: 'failed' },
    })
    expect(degraded.notice).toBe('cannot-read')
    expect(degraded.isRecord).toBe(true)
    render(
      <PreviewSnapshotNotice
        isRecord={degraded.isRecord}
        notice={degraded.notice}
        readAt={degraded.readAt}
        copy={copy}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /重试|Retry/ })).toBeTruthy()
  })

  it('loadFailed 向后兼容:不传 onRetry 不出按钮(既有宿主不回归)', () => {
    render(
      <PreviewSnapshotNotice isRecord notice="cannot-read" readAt={1} copy={copy} />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('expired:地址/记录失效(403/410)⇒ 独立 expired 态,给"重试 + 打开原文"', () => {
    const state = reducePreviewFeed(INITIAL_FEED_STATE, {
      type: 'read',
      mode: 'initial',
      outcome: { kind: 'expired' },
    })
    expect(state.notice).toBe('expired')
    expect(state.loading).toBe(false)
    render(<PreviewExpiredState copy={copy} onRetry={() => {}} onOpenSource={() => {}} />)
    expect(document.querySelector('[data-preview-state="expired"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /重试|Retry/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /打开原文|Open original/ })).toBeTruthy()
  })

  it('tooLarge:内容超 PREVIEW_MAX_BYTES ⇒ 独立 too-large 态,只给"打开原文"不给重试', () => {
    const state = reducePreviewFeed(INITIAL_FEED_STATE, {
      type: 'read',
      mode: 'initial',
      outcome: { kind: 'too-large' },
    })
    expect(state.notice).toBe('too-large')
    render(<PreviewTooLargeState copy={copy} onOpenSource={() => {}} />)
    expect(document.querySelector('[data-preview-state="too-large"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /打开原文|Open original/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /重试|Retry/ })).toBeNull()
  })

  it('unavailable:无内容可展示 ⇒ no-content 态,给刷新动作', () => {
    const state = reducePreviewFeed(INITIAL_FEED_STATE, { type: 'unavailable' })
    expect(state.notice).toBe('no-content')
    render(<PreviewNoContentState copy={copy} refreshLabel="刷新" onRefresh={() => {}} />)
    expect(document.querySelector('[data-preview-state="no-content"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /刷新/ })).toBeTruthy()
  })

  it('阈值是显式常量(2MB):字面值钉死,防止悄悄漂移', () => {
    expect(PREVIEW_MAX_BYTES).toBe(2 * 1024 * 1024)
  })
})

describe('D163 读侧事实判定(readRemoteResource 的映射契约,经 reducer 钉住)', () => {
  it('过期是大文件之前先拦:content-length 声明超限即 too-large,不读正文', () => {
    // 该行为在 use-preview-staleness.ts 的 readRemoteResource 内联实现;
    // 这里钉住"too-large 的产物态是完整状态而非错误文案"这一契约
    const tooLarge = reducePreviewFeed(INITIAL_FEED_STATE, {
      type: 'read',
      mode: 'initial',
      outcome: { kind: 'too-large' },
    })
    expect(tooLarge).toEqual({ ...INITIAL_FEED_STATE, loading: false, notice: 'too-large' })
  })
})
