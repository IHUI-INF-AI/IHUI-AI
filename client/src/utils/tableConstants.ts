/**
 * ElementPlus TableV2 列固定方向常量
 *
 * 背景: element-plus 的 FixedDir 是 declare enum (名义类型),
 * 直接用 'right' / 'left' 字面量或 'right' as const 都无法赋给 Column['fixed'].
 * 这里提供共享常量, 避免 62+ 个 admin 文件各自导入 enum.
 */
import type { Column, TableV2FixedDir } from 'element-plus'

type FixedType = NonNullable<Column<unknown>['fixed']>

/** 固定列方向 - 右侧 */
export const FIXED_RIGHT: FixedType = 'right' as unknown as TableV2FixedDir
