// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Clipboard from '@react-native-clipboard/clipboard'
import { searchAlgorithmRecords } from '@ihui/api-client'
import { ModelRecordScreen as SharedModelRecordScreen } from '@ihui/rn-app'
import type { ModelRecordQuery, ModelRecordQueryResult } from '@ihui/types'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import ImagePreviewModal from '../components/ImagePreviewModal'
import type { RootStackParamList } from '../navigation/RootNavigator'
/* eslint-disable @typescript-eslint/no-require-imports */
const RECORD_IMAGES: number[] = [
  require('../../assets/images/common/modelRecord1.png'),
  require('../../assets/images/common/modelRecord2.png'),
  require('../../assets/images/common/modelRecord3.png'),
  require('../../assets/images/common/modelRecord4.png'),
]
/* eslint-enable @typescript-eslint/no-require-imports */

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// 取词单源:@ihui/i18n 的 shared 词表已含 modelRecord.title(五语言);取不到时回落旧硬编码
const TITLE_KEY = 'modelRecord.title'
const PAGE_SIZE = 20
const EMPTY_FILTER: ModelRecordQuery = { keyword: '', kind: '', batch: '' }
const EMPTY_RESULT: ModelRecordQueryResult = {
  items: [],
  total: 0,
  stats: null,
  kindCounts: [],
  batches: [],
}

/**
 * 模型备案(RN 壳)— 取数 / 状态 / 平台适配层。
 *
 * 渲染 = packages/app 的共享屏(平台无关纯 UI,自身不 fetch);本文件只做三件事:
 *  ① 调 GET /algorithm-record/search(公开免鉴权,@ihui/api-client 的 searchAlgorithmRecords);
 *  ② 持有筛选/分页/loading/error 状态,切筛选一律重置 page = 1(与 web 同口径);
 *  ③ 平台能力:剪贴板(onCopy)、图片预览模态框、导航返回。
 * 小程序端以 `@rn-shells/ModelRecordScreen` 承载同一份壳(rn-compat 接走主题/取词/原生模块)。
 */
export function ModelRecordScreen() {
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? '模型备案' : tTitle

  const [filter, setFilter] = useState<ModelRecordQuery>(EMPTY_FILTER)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ModelRecordQueryResult>(EMPTY_RESULT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewIndex, setPreviewIndex] = useState<number>(-1)
  // 并发查询守卫:连点/连切筛选时只认最后一次响应,避免旧结果覆盖新结果
  const requestSeqRef = useRef(0)

  const runSearch = useCallback(
    async (next: ModelRecordQuery, targetPage: number) => {
      const seq = requestSeqRef.current + 1
      requestSeqRef.current = seq
      setLoading(true)
      setError('')
      try {
        const res = await searchAlgorithmRecords({
          q: next.keyword.trim() || undefined,
          kind: next.kind || undefined,
          batch: next.batch || undefined,
          page: targetPage,
          pageSize: PAGE_SIZE,
        })
        if (seq !== requestSeqRef.current) return
        if (res.success) {
          setResult({
            items: res.data.items ?? [],
            total: res.data.total ?? 0,
            stats: res.data.stats ?? null,
            kindCounts: res.data.kindCounts ?? [],
            batches: res.data.batches ?? [],
          })
          setPage(targetPage)
        } else {
          setResult(EMPTY_RESULT)
          setError(t('modelRecord.loadFailed'))
        }
      } catch {
        if (seq !== requestSeqRef.current) return
        setResult(EMPTY_RESULT)
        setError(t('modelRecord.loadFailed'))
      } finally {
        if (seq === requestSeqRef.current) setLoading(false)
      }
    },
    [t],
  )

  // 首次挂载拉一遍全量(默认无关键字、全部类型、全部批次)。筛选变更由 handler 直接触发,
  // 不走 effect 反弹 —— 否则 t 变化/重渲染会连带重复请求。
  useEffect(() => {
    void runSearch(EMPTY_FILTER, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeywordChange = useCallback((keyword: string) => {
    setFilter((prev) => ({ ...prev, keyword }))
  }, [])

  const onKindChange = useCallback(
    (kind: string) => {
      const next = { ...filter, kind }
      setFilter(next)
      void runSearch(next, 1)
    },
    [filter, runSearch],
  )

  const onBatchChange = useCallback(
    (batch: string) => {
      const next = { ...filter, batch }
      setFilter(next)
      void runSearch(next, 1)
    },
    [filter, runSearch],
  )

  const onSearch = useCallback(() => {
    void runSearch(filter, 1)
  }, [filter, runSearch])

  const onPageChange = useCallback(
    (nextPage: number) => {
      void runSearch(filter, Math.max(1, nextPage))
    },
    [filter, runSearch],
  )

  const onCopy = useCallback((text: string) => {
    // 剪贴板是平台能力:RN = @react-native-clipboard/clipboard,小程序经 rn-compat 落到
    // Taro.setClipboardData(同一 import 说明符,由构建别名换实现)
    void Clipboard.setString(text)
  }, [])

  return (
    <View style={{ flex: 1 }}>
      <SharedModelRecordScreen
        t={t}
        title={title}
        onBack={() => navigation.goBack()}
        query={filter}
        onKeywordChange={onKeywordChange}
        onKindChange={onKindChange}
        onBatchChange={onBatchChange}
        onSearch={onSearch}
        result={result}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={onPageChange}
        loading={loading}
        error={error}
        onCopy={onCopy}
        images={RECORD_IMAGES}
        previewIndex={previewIndex}
        onPreviewIndexChange={setPreviewIndex}
        colorScheme={resolvedTheme}
      />
      <ImagePreviewModal
        visible={previewIndex >= 0}
        source={previewIndex >= 0 ? (RECORD_IMAGES[previewIndex] ?? null) : null}
        onClose={() => setPreviewIndex(-1)}
      />
    </View>
  )
}

export default ModelRecordScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
