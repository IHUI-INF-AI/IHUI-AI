// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:见仓库根 package.json x-ihui-provenance 字段。

'use client'

/**
 * ResourceCategoryDialog — 薄 wrapper(2026-09-06 治理)。
 * 原为跨域复制粘贴的完整实现,已收敛到 @/components/admin/category-admin 唯一事实来源;
 * 本文件仅注入 admin.resources 命名空间的 i18n 文案,页面/helper/types 零改动。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AdminCategoryDialog } from '@/components/admin/category-admin'
import type { Category, CategoryForm } from './types'

interface Props {
  open: boolean
  editing: Category | null
  form: CategoryForm
  setForm: React.Dispatch<React.SetStateAction<CategoryForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  categories: Category[]
}

export function ResourceCategoryDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
  categories,
}: Props) {
  const t = useTranslations('admin.resources')
  return (
    <AdminCategoryDialog
      open={open}
      editing={editing}
      form={form}
      setForm={setForm}
      err={err}
      savePending={savePending}
      onSubmit={onSubmit}
      onClose={onClose}
      categories={categories}
      labels={{
        editTitle: t('editTitle'),
        createTitle: t('createTitle'),
        fieldParent: t('fieldParent'),
        rootCategory: t('rootCategory'),
        fieldName: t('fieldName'),
        namePlaceholder: t('namePlaceholder'),
        fieldSort: t('fieldSort'),
        fieldStatus: t('fieldStatus'),
        enabled: t('enabled'),
        disabled: t('disabled'),
        cancel: t('cancel'),
        save: t('save'),
      }}
    />
  )
}
