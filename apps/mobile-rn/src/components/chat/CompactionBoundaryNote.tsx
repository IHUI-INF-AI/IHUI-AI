// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 压缩边界回看条(批次 3,2026-11-06)。
 *
 * 挂在压缩状态条(`ChatCompactionBanner`)下方:状态条说"压缩了什么量",这里回答
 * "压缩前保留了哪几段、丢掉了哪个下标区间"。
 *  - head/anchor/tail 三锚点顺序固定,缺席槽位不渲染占位行(不假装回看过);
 *  - 摘录来自服务端 preservedSegment(≤200 字符),端内只 trim,不二次截断成不可读片段;
 *  - 默认收起,点标题展开;刷新/换端后由屏幕查询 `/compaction-boundaries` 回填。
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import type { CompactBoundary } from '@ihui/shared'
import { boundaryAnchorLines, formatRemovedRange } from '../../utils/compaction-boundary'
import { tokens } from '../../theme/active-tokens'
import { rpx } from '../../utils/rpx'

export interface CompactionBoundaryNoteProps {
  boundary: CompactBoundary
}

export function CompactionBoundaryNote({ boundary }: CompactionBoundaryNoteProps) {
  const [expanded, setExpanded] = useState(false)
  const lines = boundaryAnchorLines(boundary)
  const removedText = formatRemovedRange(boundary.removedRange)
  if (lines.length === 0 && !removedText) return null
  return (
    <View style={styles.card} testID="compaction-boundary-note">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
        onPress={() => setExpanded((value) => !value)}
      >
        <Text style={styles.title}>压缩前关键片段</Text>
        <Text style={styles.toggle}>{expanded ? '收起' : '查看压缩前关键片段'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          {removedText ? <Text style={styles.removed}>{removedText}</Text> : null}
          {lines.map((line) => (
            <View key={line.slot} style={styles.anchorRow}>
              <Text style={styles.anchorMeta}>
                {`${line.label} · #${line.index} · ${line.role}`}
              </Text>
              <Text style={styles.excerpt} numberOfLines={3}>
                {line.excerpt}
              </Text>
            </View>
          ))}
          {lines.length === 0 ? (
            <Text style={styles.empty}>本次压缩没有可回看的保留片段。</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: rpx(24),
    marginBottom: rpx(8),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(12),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brandAccent.light,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.brandAccent.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rpx(12),
  },
  title: {
    fontSize: rnGeometry.textCaption,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  toggle: {
    fontSize: rnGeometry.textCaption,
    color: tokens.brandAccent.deep,
  },
  body: {
    marginTop: rpx(10),
    gap: rpx(10),
  },
  removed: {
    fontSize: rnGeometry.textCaption,
    color: tokens.text.secondary,
  },
  anchorRow: {
    gap: rpx(4),
  },
  anchorMeta: {
    fontSize: rnGeometry.textCaption,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  excerpt: {
    fontSize: rnGeometry.textCaption,
    lineHeight: rpx(32),
    color: tokens.text.secondary,
  },
  empty: {
    fontSize: rnGeometry.textCaption,
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
