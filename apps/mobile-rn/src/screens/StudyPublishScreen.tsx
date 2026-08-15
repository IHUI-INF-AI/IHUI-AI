import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { getCategories, type CourseCategory } from '@ihui/api-client/endpoints/course'
import { createPublishTask } from '@ihui/api-client'
import {
  StudyPublishScreen as SharedStudyPublishScreen,
  type StudyPublishScreenProps,
  type StudyCategory,
} from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type PublishMode = 'group' | 'video'

/** mock 赛道兜底(getCategories API 失败时降级,对齐 Uniapp category(0)) */
const MOCK_CATEGORIES: readonly CourseCategory[] = [
  { id: '1', name: 'AI 实战', icon: '', sort: 0, courseCount: 0 },
  { id: '2', name: '副业变现', icon: '', sort: 1, courseCount: 0 },
  { id: '3', name: '职场技能', icon: '', sort: 2, courseCount: 0 },
  { id: '4', name: '短视频运营', icon: '', sort: 3, courseCount: 0 },
]

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
          setGroupCategories(MOCK_CATEGORIES.map((c) => ({ id: c.id, name: c.name })))
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
      Alert.alert('提示', '需要相册权限才能选择封面')
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
  }, [])

  const pickVideo = useCallback(async (): Promise<string> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('提示', '需要相册权限才能选择视频')
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
  }, [])

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
      Alert.alert('提示', '请输入合集标题')
      return
    }
    if (!groupCategory) {
      Alert.alert('提示', '请选择赛道')
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
        Alert.alert('提示', '提交成功,等待审核', [
          { text: '知道了', onPress: () => navigation.goBack() },
        ])
      } else {
        Alert.alert('提示', res.error)
      }
    } catch (err) {
      Alert.alert('提示', err instanceof Error ? err.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }, [groupTitle, groupContent, groupCategory, navigation])

  const handleVideoSubmit = useCallback(async () => {
    if (!videoTitle.trim()) {
      Alert.alert('提示', '请输入课程标题')
      return
    }
    if (!videoUri) {
      Alert.alert('提示', '请选择视频')
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
        Alert.alert('提示', '提交成功,等待审核', [
          { text: '知道了', onPress: () => navigation.goBack() },
        ])
      } else {
        Alert.alert('提示', res.error)
      }
    } catch (err) {
      Alert.alert('提示', err instanceof Error ? err.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }, [videoTitle, videoContent, videoUri, navigation])

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
      <NavBar
        title={mode === 'video' ? '发布视频' : '发布课程合集'}
        onBack={() => navigation.goBack()}
      />
      <SharedStudyPublishScreen {...sharedProps} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
})
