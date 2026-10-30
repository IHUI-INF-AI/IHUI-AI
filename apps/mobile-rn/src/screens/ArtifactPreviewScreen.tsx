// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { useNavigation, useRoute } from '@react-navigation/native'
import { getArtifactDownload } from '@ihui/api-client'
import { BackChevron } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { tokens } from '../theme/active-tokens'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * 产物预览屏(html_report / slides 的 html 导出体)—— 对齐 web 的「在线看产物」
 * 语义。渲染直接用导出端点的自包含 HTML 体(出口前有 sha256 复验),不走
 * ai-service 签名 URL:web 的 token+iframe 依赖同源反代,RN 无该基址配置面,
 * 应用内 WebView 加载下载体即同一份内容、少一次跨服务往返。
 * 全局 headerShown:false ⇒ 自绘返回头(BackChevron 单一源头)。
 */
export function ArtifactPreviewScreen() {
  const route = useRoute<{
    key: string
    name: 'ArtifactPreview'
    params: RootStackParamList['ArtifactPreview']
  }>()
  const navigation = useNavigation()
  const { artifactId, name } = route.params
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setHtml(null)
    try {
      setHtml(await getArtifactDownload(artifactId, 'html'))
    } catch {
      setError(true)
    }
  }, [artifactId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={() => navigation.goBack()}
          label={t('common.back')}
          colorScheme={resolvedTheme}
        />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: tokens.error.text }]}>
            {t('artifacts.previewFailed')}
          </Text>
        </View>
      ) : html === null ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>{t('artifacts.loading')}</Text>
        </View>
      ) : (
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          style={{ flex: 1, backgroundColor: tokens.surface.bg }}
          // resolvedTheme 只作重渲依赖:主题切换时 WebView 底色跟 tokens 走
          key={resolvedTheme}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: tokens.text.primary, flexShrink: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { fontSize: 13 },
  loadingText: { fontSize: 13, color: tokens.text.secondary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
