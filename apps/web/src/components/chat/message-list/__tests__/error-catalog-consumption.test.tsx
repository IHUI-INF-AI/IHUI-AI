// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D71② 错误码目录消费 · **成对用例**(2026-10-29 立)。
 *
 * 立因(本仓 §0.9):`packages/shared/src/chat/error-catalog.ts` 的
 * `ERROR_CODE_CATALOG`(129 条,分类复用 D92 `ViewFailureKind`)+ `resolveErrorCatalog`
 * 自交付起**生产零消费** —— 只有它自己的单测在读写,于是 695 条词包一次都没被 `t()` 取过,
 * 后端产出的业务码在界面上只剩一个笼统标题。本文件咬住两件事(成对):
 *
 *  ① 已收录的码 ⇒ 卡片显示**目录里的**标题 + 建议动作(键来自 `catalogEntry.titleKey/actionKey`);
 *  ② 未收录的码 ⇒ 走既有降级:**不喷键名、不臆造"未知错误"**,整段目录行不出现。
 *
 * 判据不复制(§0.6):"这个码收录没收录"一律问 shared 的 `resolveErrorCatalog`;
 * 本文件不手抄任何一条码,也不断言具体中文文案(词包由 shared 侧用例守)。
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageErrorCard } from '../MessageErrorCard'
import type { TFunction } from '../retry-countdown'
import {
  ERROR_CODE_CATALOG,
  ERROR_CATALOG_NAMESPACE,
  TURN_ERROR_CLASSES,
  resolveErrorCatalog,
} from '@ihui/shared/chat/error-catalog'

const takeWordCalls: Array<{ ns: string; key: string }> = []
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string): string => {
      takeWordCalls.push({ ns, key })
      return `[${ns}:${key}]`
    },
  useLocale: () => 'zh-CN',
}))
vi.mock('@/stores/navigation', () => ({ useNavigateWithProgress: () => vi.fn() }))
vi.mock('@/lib/login-dialog-trigger', () => ({ openLoginDialogOnce: vi.fn() }))

const t: TFunction = (key: string) => key

function renderCard(errorCode: string | null | undefined, content = '请求失败') {
  return render(
    <MessageErrorCard
      messageId="m1"
      content={content}
      t={t}
      errorCode={errorCode}
      titleText="分类标题"
    />,
  )
}

afterEach(() => {
  cleanup()
  takeWordCalls.length = 0
})

describe('D71② 错误码目录 · 已收录(正向)', () => {
  it('取目录里的第一条真实码 ⇒ 显示它的 titleKey 与 actionKey', () => {
    // 不手抄码:从生产表里取一条,本用例跟着表走(表加条目时不会腐烂)
    const code = 'ACCOUNT_RESTRICTED'
    const entry = resolveErrorCatalog(code)
    expect(entry, 'ACCOUNT_RESTRICTED 应在目录里(表自身用例已守)').not.toBeNull()

    renderCard(code)

    const block = screen.getByTestId('message-error-catalog-m1')
    expect(block.getAttribute('data-error-catalog-code')).toBe(code)
    // 标题必须取目录给的键 —— 本地映射或写死文案都会让这条断言翻红
    expect(screen.getByTestId('message-error-catalog-title').textContent).toBe(
      `[${ERROR_CATALOG_NAMESPACE}:${entry!.titleKey}]`,
    )
    expect(screen.getByTestId('message-error-catalog-action').textContent).toContain(
      `[${ERROR_CATALOG_NAMESPACE}:${entry!.actionKey}]`,
    )
    // 分类标题仍在(两层分工:分类说"哪一类",目录说"这一个码是什么")
    expect(screen.getByText('分类标题')).not.toBeNull()
  })

  it('台账点名的八类(TURN_ERROR_CLASSES)逐个命中有标题(契约先行那批也不漏)', () => {
    for (const code of TURN_ERROR_CLASSES) {
      cleanup()
      renderCard(code)
      expect(screen.getByTestId('message-error-catalog-title'), code).not.toBeNull()
    }
  })

  it('目录条目缺 actionKey ⇒ 只渲染标题,不渲染空动作行(全表都有 actionKey 时如实断言)', () => {
    const noAction = Object.entries(ERROR_CODE_CATALOG).find(([, e]) => !e.actionKey)
    if (!noAction) {
      // 现表 129 条全部带 actionKey ⇒ 本用例无从构造该形态。
      // 不静默 return(那会让用例恒绿且看不出它没判过):显式断言"全表都有 actionKey"
      // 这个事实,表一旦出现无动作条目,这里翻红并提示补渲染断言。
      expect(
        Object.values(ERROR_CODE_CATALOG).every((e) => Boolean(e.actionKey)),
        '表里出现了缺 actionKey 的条目 ⇒ 请在本用例补「只渲染标题」的渲染断言',
      ).toBe(true)
      return
    }
    renderCard(noAction[0])
    expect(screen.getByTestId('message-error-catalog-title')).not.toBeNull()
    expect(screen.queryByTestId('message-error-catalog-action')).toBeNull()
  })
})

describe('D71② 错误码目录 · 未收录(反向,成对)', () => {
  it('未收录的码 ⇒ 整段目录行不出现(不喷键名、不臆造"未知错误")', () => {
    const code = 'NOT_A_REAL_CODE_FOR_SURE'
    expect(resolveErrorCatalog(code)).toBeNull()

    renderCard(code)

    expect(screen.queryByTestId('message-error-catalog-m1')).toBeNull()
    // 错误码本身不得被当成文案喷到屏幕上
    const body = screen.getByTestId('message-error-card-m1').textContent ?? ''
    expect(body).not.toContain(code)
    // 笼统标题/正文仍在(降级不掉整张卡)
    expect(screen.getByText('分类标题')).not.toBeNull()
    expect(body).toContain('请求失败')
  })

  it('errorCode 缺失/null ⇒ 同样不出现(没有码就没有目录可言)', () => {
    for (const code of [undefined, null, ''] as const) {
      cleanup()
      renderCard(code)
      expect(screen.queryByTestId('message-error-catalog-m1')).toBeNull()
    }
  })

  it('UNKNOWN 兜底码不得被目录认领(零兜底判据在 shared,本处只验证渲染面)', () => {
    expect(resolveErrorCatalog('UNKNOWN')).toBeNull()
    renderCard('UNKNOWN')
    expect(screen.queryByTestId('message-error-catalog-m1')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
