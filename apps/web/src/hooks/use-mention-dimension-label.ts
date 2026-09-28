// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

// 提及维度的取词出口(V3 第 61 票)。
//
// 维度表住在 packages/shared,只能带 **i18n 键**、不能带文案(否则共享层就写死了语言)。
// 而"该去哪个命名空间取"也必须跟着表走 —— 若在组件里假定一个 ns,加一行 `@` 维度
// 就得同时记得改组件,那正是本票要消除的那一型。所以这里只提供一个 (ns, key) → 文案
// 的出口,取词位置一律读自 MENTION_DIMENSIONS。
// 用无命名空间的 useTranslations():键是完整路径(`chat.mentionEngine.tabFile`),
// 与本仓 AdminNav / LoginFormContent 同一处置。

import * as React from 'react'
import { useTranslations } from 'next-intl'

export type MentionTranslator = (ns: string, key: string) => string

export function useMentionTranslator(): MentionTranslator {
  const t = useTranslations()
  return React.useCallback((ns: string, key: string) => t(`${ns}.${key}`), [t])
}
