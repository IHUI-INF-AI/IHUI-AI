// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { TreeSelectLabels } from '@ihui/ui-react'

/** TreeSelect 界面文案注入(组件内中文兜底仅供无法引 next-intl 的包,消费端必须传 labels) */
export function useTreeSelectLabels(): TreeSelectLabels {
  const t = useTranslations('treeSelect')
  return useMemo<TreeSelectLabels>(
    () => ({
      placeholder: t('placeholder'),
      searchPlaceholder: t('searchPlaceholder'),
      treeAriaLabel: t('treeAriaLabel'),
      emptyText: t('emptyText'),
    }),
    [t],
  )
}
