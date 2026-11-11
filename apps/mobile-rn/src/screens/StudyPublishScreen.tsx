// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { getCategories } from '@ihui/api-client/endpoints/course'
import { createPublishTask } from '@ihui/api-client'
import {
  StudyPublishScreen as SharedStudyPublishScreen,
  type StudyPublishScreenProps,
  type StudyCategory,
} from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { NavChrome } from '../components/NavChrome'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type PublishMode = 'group' | 'video'

// [2026-10-24 假赛道兜底已去]原 MOCK_CATEGORIES(4 条假赛道 id)在 getCategories 失败时会被
// 当真实赛道塞进发布表单 ⇒ 用户提交的 categoryId 后端不认识,发布静默错赛道。失败改走空列表,
// 校验分支(t('home.pubSelectTrack'))自然挡住无赛道提交,不再假成功。

/**
 * mobile-rn 课程发布(wrapper 层,保留 RN 独占逻辑)
 *
 * shell 层职责:
 * - 主体调用 @ihui/rn-app StudyPublishScreen(双态表单 + 平台无关 UI)
 * - 保留 NavBar + expo-image-picker 选图/选视频 + getCategories/createPublishTask API
 * - 保留 Alert 提交结果提示 + 导航返回
 */
export default function StudyPublishScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [mode, setMode] = useState<PublishMode>('group')

  // Group form state
  const [groupTitle, setGroupTitle] = useState('')
  const [groupContent, setGroupContent] = useState('')
  const [groupCategory, setGroupCategory] = useState('')
  const [groupStage, setGroupStage] = useState(0)
  const [groupCoverUri, setGroupCoverUri] = useState('')
  const [groupCategories, setGroupCategories] = useState<readonly StudyCategory[]>([])
  const [groupLoadingCategories, setGroupLoadingCategories] = useState(true)

  // Video form state
  const [videoTitle, setVideoTitle] = useState('')
  const [videoContent, setVideoContent] = useState('')
  const [videoAgent, setVideoAgent] = useState('')
  const [videoRemark, setVideoRemark] = useState('')
  const [videoCoverUri, setVideoCoverUri] = useState('')
  const [videoUri, setVideoUri] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setGroupLoadingCategories(true)
      const res = await getCategories()
      if (!cancelled) {
        if (res.success && res.data) {
          setGroupCategories(res.data.map((c) => ({ id: c.id, name: c.name })))
        } else {
          // 失败/空 ⇒ 空列表(见顶注:假 id 会随表单静默提交,不做假兜底)
          setGroupCategories([])
        }
        setGroupLoadingCategories(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pickImage = useCallback(async (): Promise<string> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      appAlert(t('home.pubTip'), t('home.pubPermAlbumImage'))
      return ''
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })
    if (!result.canceled) {
      const asset = result.assets[0]
      if (asset?.uri) {
        return asset.uri
      }
    }
    return ''
    // deps 含 t:两个 pick 回调内有 appAlert(t(…))(exhaustive-deps 纪律)
  }, [t])

  const pickVideo = useCallback(async (): Promise<string> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      appAlert(t('home.pubTip'), t('home.pubPermAlbumVideo'))
      return ''
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 600,
    })
    if (!result.canceled) {
      const asset = result.assets[0]
      if (asset?.uri) {
        return asset.uri
      }
    }
    return ''
    // deps 含 t:两个 pick 回调内有 appAlert(t(…))(exhaustive-deps 纪律)
  }, [t])

  const handleGroupCoverPick = useCallback(async () => {
    const uri = await pickImage()
    if (uri) {
      setGroupCoverUri(uri)
    }
  }, [pickImage])

  const handleVideoCoverPick = useCallback(async () => {
    const uri = await pickImage()
    if (uri) {
      setVideoCoverUri(uri)
    }
  }, [pickImage])

  const handleVideoPick = useCallback(async () => {
    const uri = await pickVideo()
    if (uri) {
      setVideoUri(uri)
    }
  }, [pickVideo])

  const handleGroupSubmit = useCallback(async () => {
    if (!groupTitle.trim()) {
      appAlert(t('home.pubTip'), t('home.pubRequireGroupTitle'))
      return
    }
    if (!groupCategory) {
      appAlert(t('home.pubTip'), t('home.pubSelectTrack'))
      return
    }
    setSubmitting(true)
    try {
      const res = await createPublishTask({
        title: groupTitle.trim(),
        content_md: groupContent,
        content_html: '',
        platforms: [],
      })
      if (res.success) {
        appAlert(t('home.pubTip'), t('home.pubSubmittedReview'), [
          { text: t('home.pubOk'), onPress: () => navigation.goBack() },
        ])
      } else {
        appAlert(t('home.pubTip'), res.error)
      }
    } catch (err) {
      appAlert(t('home.pubTip'), err instanceof Error ? err.message : t('home.pubSubmitFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [groupTitle, groupContent, groupCategory, navigation, t])

  const handleVideoSubmit = useCallback(async () => {
    if (!videoTitle.trim()) {
      appAlert(t('home.pubTip'), t('home.pubRequireCourseTitle'))
      return
    }
    if (!videoUri) {
      appAlert(t('home.pubTip'), t('home.pubSelectVideo'))
      return
    }
    setSubmitting(true)
    try {
      const res = await createPublishTask({
        title: videoTitle.trim(),
        content_md: videoContent,
        content_html: '',
        platforms: [],
      })
      if (res.success) {
        appAlert(t('home.pubTip'), t('home.pubSubmittedReview'), [
          { text: t('home.pubOk'), onPress: () => navigation.goBack() },
        ])
      } else {
        appAlert(t('home.pubTip'), res.error)
      }
    } catch (err) {
      appAlert(t('home.pubTip'), err instanceof Error ? err.message : t('home.pubSubmitFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [videoTitle, videoContent, videoUri, navigation, t])

  const sharedProps: StudyPublishScreenProps = {
    t,
    mode,
    onModeChange: setMode,
    onBack: () => navigation.goBack(),
    groupTitle,
    groupContent,
    groupCategory,
    groupStage,
    groupCoverUri,
    groupCategories,
    groupLoadingCategories,
    onGroupTitleChange: setGroupTitle,
    onGroupContentChange: setGroupContent,
    onGroupCategoryChange: setGroupCategory,
    onGroupStageChange: setGroupStage,
    onGroupCoverPick: handleGroupCoverPick,
    onGroupCoverClear: () => setGroupCoverUri(''),
    onGroupSubmit: handleGroupSubmit,
    videoTitle,
    videoContent,
    videoAgent,
    videoRemark,
    videoCoverUri,
    videoUri,
    onVideoTitleChange: setVideoTitle,
    onVideoContentChange: setVideoContent,
    onVideoAgentChange: setVideoAgent,
    onVideoRemarkChange: setVideoRemark,
    onVideoCoverPick: handleVideoCoverPick,
    onVideoCoverClear: () => setVideoCoverUri(''),
    onVideoPick: handleVideoPick,
    onVideoClear: () => setVideoUri(''),
    onVideoSubmit: handleVideoSubmit,
    submitting,
  }

  return (
    <View style={styles.container}>
      {/* 对齐 Uniapp pagesA/study/publish.vue 双态标题(发布课程合集/发布视频)+ 返回 */}
      <NavChrome>
        <NavBar
          title={mode === 'video' ? t('home.pubVideo') : t('home.pubGroup')}
          onBack={() => navigation.goBack()}
        />
      </NavChrome>
      <SharedStudyPublishScreen {...sharedProps} colorScheme={resolvedTheme} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
