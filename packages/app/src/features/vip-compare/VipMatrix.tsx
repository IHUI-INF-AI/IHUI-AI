// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export interface VipMatrixRow {
  label: string
  values: string[]
}

export interface VipMatrixProps {
  /** 首格为行标题列,其余为数据列 */
  columns: string[]
  rows: VipMatrixRow[]
  /** 高亮列下标(数据列,0 起) */
  highlightColumn?: number
  colorScheme?: 'light' | 'dark'
}

/** VIP 权益矩阵表(对比页与特权弹层共用,避免表格 UI 复制) */
export function VipMatrix({
  columns,
  rows,
  highlightColumn,
  colorScheme = 'light',
}: VipMatrixProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {columns.map((column, idx) => (
          <Text key={column + idx} style={[styles.cell, idx === 0 && styles.cellFeature]}>
            {column}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIdx) => (
        <View key={row.label + rowIdx} style={[styles.tableRow, rowIdx % 2 === 1 && styles.rowAlt]}>
          <Text style={[styles.cell, styles.cellFeature, styles.cellText]}>{row.label}</Text>
          {row.values.map((value, colIdx) => (
            <Text
              key={colIdx}
              style={[
                styles.cell,
                styles.cellText,
                highlightColumn === colIdx && styles.cellHighlight,
              ]}
            >
              {value}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    table: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.xl,
      overflow: 'hidden',
    },
    tableHeader: { flexDirection: 'row', backgroundColor: tk.surface.muted },
    tableRow: { flexDirection: 'row' },
    rowAlt: { backgroundColor: tk.surface.muted },
    cell: {
      flex: 1,
      padding: rnSpacing['sm-loose'],
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    cellFeature: { flex: 1.2, fontWeight: '600', color: tk.text.primary },
    cellText: { fontSize: rnType.caption.size },
    cellHighlight: { fontWeight: '700', color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
