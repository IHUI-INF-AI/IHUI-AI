// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getComments, getLikeCounts, getPlazaDetail } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { PostDetailScreen as SharedPostDetailScreen, type PostDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useRefreshOnFocus } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type Route = RouteProp<RootStackParamList, 'PostDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function PostDetailScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [post, setPost] = useState<PostDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getPlazaDetail(id)
      if (cancelled) return
      if (res.success) {
        const item = res.data
        // 详情回包不带点赞/评论计数(后端 /plaza 详情只回内容字段),此前这里把两者
        // 硬编码成 0 ⇒ 用户永远看到 0 0。改走既有的两个只读查询面:
        //   · 点赞数 POST /behavior/likes/counts —— behavior 面**只有查计数,没有点赞写端点**
        //     (backend `toggleLike` 已实现但没有任何路由暴露它),所以这里只取真实数、不做点赞动作
        //   · 评论数 GET /comments?resourceType=post —— 评论写入端点存在,但 RN 侧没有评论页可跳
        // 两者都 allSettled:计数取不到不得拖垮详情本身,回落 0。
        const [likeRes, commentRes] = await Promise.allSettled([
          getLikeCounts('post', [String(item.id)]),
          getComments({ resourceType: 'post', resourceId: String(item.id), page: 1, pageSize: 1 }),
        ])
        if (cancelled) return
        const likes =
          likeRes.status === 'fulfilled' && likeRes.value.success
            ? (likeRes.value.data.find((row) => row.resourceId === String(item.id))?.count ?? 0)
            : 0
        const comments =
          commentRes.status === 'fulfilled' && commentRes.value.success
            ? (commentRes.value.data.total ?? 0)
            : 0
        setPost({
          id: item.id,
          title: item.title,
          content: item.description ?? '',
          author: item.creator ?? t('ranking.anonymous'),
          createdAt: item.createdAt ?? '',
          likes,
          comments,
          status: item.status,
          taskStatus: item.taskStatus,
          imgs: item.imgs,
          types: item.types,
          categories: item.categories,
          lowestPrice: item.lowestPrice,
          peakPrice: item.peakPrice,
          contact: item.contact,
          cycle: item.cycle,
          cycleUnit: item.cycleUnit,
          closingTime: item.closingTime,
        })
      } else setError(apiFailureToText(res, t('postDetail.loadFailed')))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t, reloadKey])

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新):bump reloadKey 让上面的 effect 重跑
  useRefreshOnFocus(() => setReloadKey((k) => k + 1))

  const { onNavigate, onToast } = useHostPorts()

  return (
    <SharedPostDetailScreen
      t={t}
      item={post}
      loading={loading}
      error={error}
      onRetry={reload}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
      onNavigate={onNavigate}
      onToast={onToast}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
