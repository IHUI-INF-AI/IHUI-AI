// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分页条(学生中心域 4 个列表屏共用)—— 对齐 web student/* 页底部
 * prev / "第 x / y 页" / next 三件套;仅 totalPages>1 时渲染。
 */
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { Text, TouchableOpacity, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'
import type { TFunction } from '../../types'

/**
 * 分页条只需要这四档。此前它绑死 `ReturnType<typeof createStudentStyles>`,
 * 于是别的域的样式表(同四档、不同表)喂不进来 —— 结构类型即可,不必为复用再造一份学生表。
 */
export interface ListPagerStyles {
  pagerRow: ViewStyle
  pagerBtn: ViewStyle
  pagerBtnText: TextStyle
  pagerBtnTextDisabled: TextStyle
  pageInfo: TextStyle
}

export interface ListPagerProps {
  t: TFunction
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  styles: ListPagerStyles
}

export function ListPager({ t, page, totalPages, onPageChange, styles }: ListPagerProps) {
  if (totalPages <= 1) return null
  const prevDisabled = page <= 1
  const nextDisabled = page >= totalPages
  return (
    <View style={styles.pagerRow}>
      <TouchableOpacity
        style={styles.pagerBtn}
        activeOpacity={0.85}
        disabled={prevDisabled}
        accessibilityRole="button"
        accessibilityLabel={t('studentPage.prev')}
        onPress={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft
          size={14}
          color={prevDisabled ? styles.pagerBtnTextDisabled.color : undefined}
          strokeWidth={2}
        />
        <Text style={prevDisabled ? styles.pagerBtnTextDisabled : styles.pagerBtnText}>
          {t('studentPage.prev')}
        </Text>
      </TouchableOpacity>
      <Text style={styles.pageInfo}>{t('studentPage.pageInfo', { page, total: totalPages })}</Text>
      <TouchableOpacity
        style={styles.pagerBtn}
        activeOpacity={0.85}
        disabled={nextDisabled}
        accessibilityRole="button"
        accessibilityLabel={t('studentPage.next')}
        onPress={() => onPageChange(page + 1)}
      >
        <Text style={nextDisabled ? styles.pagerBtnTextDisabled : styles.pagerBtnText}>
          {t('studentPage.next')}
        </Text>
        <ChevronRight
          size={14}
          color={nextDisabled ? styles.pagerBtnTextDisabled.color : undefined}
          strokeWidth={2}
        />
      </TouchableOpacity>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
