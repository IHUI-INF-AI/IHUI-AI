'use client'

import * as React from 'react'
import { useTagsViewStore } from '@/stores/tags-view'

/**
 * 把"当前页表单是否处于 dirty 状态"声明给 TagsView。
 * 当 dirty 变为 true 时,对应 path 的标签会显示未保存指示点;
 * 关闭标签 / closeOther / closeAll 会自动清理脏状态,无需手动解绑。
 *
 * 用法:
 *   useTagDirty('/user/profile', form.dirty)
 */
export function useTagDirty(path: string, dirty: boolean): void {
  const setDirty = useTagsViewStore((s) => s.setDirty)
  React.useEffect(() => {
    setDirty(path, dirty)
    // 卸载/路由切换时清除,避免脏状态跨页残留
    return () => setDirty(path, false)
  }, [path, dirty, setDirty])
}
