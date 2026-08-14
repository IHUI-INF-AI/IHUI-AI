/**
 * StudyPublishScreen 课程发布(mobile-rn 端,复杂页 — 双态切换)
 *
 * 1:1 复刻历史 Uniapp pagesA/study/publish.vue 的双态切换结构:
 * - Uniapp 用 Group/AddVideo 两个子组件 + showAddVideo 切换;RN 用 useState(mode) 切换表单
 * - 顶部 Tab:合集(group)/ 视频(video),对齐 Uniapp pageTitle「发布课程合集 / 发布视频」
 * - 合集表单:封面 / 合集标题 / 合集描述 / 主赛道选择 / 课程阶段(对齐 group.vue)
 * - 视频表单:封面 / 视频 / 课程标题 / 课程描述 / 关联AI应用 / 置顶评论(对齐 add_video.vue)
 * - 赛道选择:接 getCategories API(失败降级 mock 4 项,对齐 Uniapp category(0))
 * - 封面/视频上传:expo-image-picker 选图/选视频 + 预览 + 删除
 * - 提交:接 createPublishTask API(课程发布不走多平台分发,platforms 留空)
 *
 * 拆子组件到同文件内 function(AGENTS.md §4):StudyPublishScreen(主,< 250 行)+
 * GroupForm / VideoForm / CategoryPicker / CoverPicker / VideoPicker / LabeledInput / LabeledTextarea。
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { createPublishTask } from '@ihui/api-client'
import { getCategories, type CourseCategory } from '@ihui/api-client/endpoints/course'
import { NavBar } from '../components/NavBar'
import { SingleTypeBar } from '../components/SingleTypeBar'
import { VideoPlayer } from '../components/VideoPlayer'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type PublishMode = 'group' | 'video'

/** mock 赛道兜底(getCategories API 失败时降级,对齐 Uniapp category(0)) */
const MOCK_CATEGORIES: readonly CourseCategory[] = [
  { id: '1', name: 'AI 实战', icon: null, sort: 0, courseCount: 0 },
  { id: '2', name: '副业变现', icon: null, sort: 1, courseCount: 0 },
  { id: '3', name: '职场技能', icon: null, sort: 2, courseCount: 0 },
  { id: '4', name: '短视频运营', icon: null, sort: 3, courseCount: 0 },
]

interface StageOption {
  id: number
  name: string
}

/** 课程阶段(对齐 Uniapp group.vue stageList) */
const STAGES: readonly StageOption[] = [
  { id: 0, name: '入门' },
  { id: 1, name: '进阶' },
  { id: 2, name: '精通' },
] as const

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
}): React.JSX.Element {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.text.tertiary}
      />
    </View>
  )
}

function LabeledTextarea({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
}): React.JSX.Element {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, fieldStyles.textarea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.text.tertiary}
        multiline
        textAlignVertical="top"
      />
    </View>
  )
}

/** 封面选择器:expo-image-picker 选图 + 预览 + 删除 */
function CoverPicker({
  label,
  uri,
  onPick,
  onClear,
}: {
  label: string
  uri: string
  onPick: (uri: string) => void
  onClear: () => void
}): React.JSX.Element {
  const pick = async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('提示', '需要相册权限才能选择封面')
      return
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
        onPick(asset.uri)
      }
    }
  }

  if (uri) {
    return (
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>{label}</Text>
        <View style={coverStyles.previewWrap}>
          <Image source={{ uri }} style={coverStyles.preview} resizeMode="cover" />
          <Pressable
            style={({ pressed }) => [coverStyles.clearBtn, pressed ? coverStyles.pressed : null]}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={`删除${label}`}
          >
            <Text style={coverStyles.clearText}>×</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [coverStyles.box, pressed ? coverStyles.pressed : null]}
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={coverStyles.icon}>+</Text>
        <Text style={coverStyles.hint}>点击上传</Text>
      </Pressable>
    </View>
  )
}

/** 视频选择器:expo-image-picker 选视频 + VideoPlayer 预览 + 删除 */
function VideoPicker({
  uri,
  onPick,
  onClear,
}: {
  uri: string
  onPick: (uri: string) => void
  onClear: () => void
}): React.JSX.Element {
  const pick = async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('提示', '需要相册权限才能选择视频')
      return
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
        onPick(asset.uri)
      }
    }
  }

  if (uri) {
    return (
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>视频预览</Text>
        <View style={coverStyles.previewWrap}>
          <VideoPlayer url={uri} />
          <Pressable
            style={({ pressed }) => [coverStyles.clearBtn, pressed ? coverStyles.pressed : null]}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="删除视频"
          >
            <Text style={coverStyles.clearText}>×</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>视频</Text>
      <Pressable
        style={({ pressed }) => [coverStyles.box, pressed ? coverStyles.pressed : null]}
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel="选择视频"
      >
        <Text style={coverStyles.icon}>+</Text>
        <Text style={coverStyles.hint}>点击上传视频</Text>
      </Pressable>
    </View>
  )
}

function CategoryPicker({
  title,
  options,
  selectedId,
  onSelect,
  loading,
}: {
  title: string
  options: ReadonlyArray<CourseCategory>
  selectedId: string
  onSelect: (id: string) => void
  loading: boolean
}): React.JSX.Element {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={tokens.brand.DEFAULT} style={chipStyles.loading} />
      ) : options.length === 0 ? (
        <Text style={chipStyles.empty}>暂无赛道</Text>
      ) : (
        <SingleTypeBar
          items={options.map((o) => ({ id: o.id, label: o.name }))}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </View>
  )
}

function StagePicker({
  selected,
  onSelect,
}: {
  selected: number
  onSelect: (id: number) => void
}): React.JSX.Element {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>课程阶段</Text>
      <SingleTypeBar
        items={STAGES.map((s) => ({ id: String(s.id), label: s.name }))}
        selectedId={String(selected)}
        onSelect={(id) => onSelect(Number(id))}
      />
    </View>
  )
}

function SubmitButton({
  label,
  onPress,
  loading,
}: {
  label: string
  onPress: () => void
  loading: boolean
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [submitStyles.btn, pressed ? submitStyles.pressed : null]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={tokens.surface.light} />
      ) : (
        <Text style={submitStyles.text}>{label}</Text>
      )}
    </Pressable>
  )
}

function GroupForm(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [stage, setStage] = useState(0)
  const [coverUri, setCoverUri] = useState('')
  const [categories, setCategories] = useState<readonly CourseCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingCategories(true)
      const res = await getCategories()
      if (!cancelled) {
        if (res.success && res.data) {
          setCategories(res.data)
        } else {
          setCategories(MOCK_CATEGORIES)
        }
        setLoadingCategories(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (): Promise<void> => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入合集标题')
      return
    }
    if (!category) {
      Alert.alert('提示', '请选择赛道')
      return
    }
    setSubmitting(true)
    try {
      const res = await createPublishTask({
        title: title.trim(),
        content_md: content,
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
  }

  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker label="封面" uri={coverUri} onPick={setCoverUri} onClear={() => setCoverUri('')} />
      <LabeledInput label="合集标题" value={title} onChangeText={setTitle} placeholder="请输入合集标题" />
      <LabeledTextarea label="合集描述" value={content} onChangeText={setContent} placeholder="请输入合集描述" />
      <CategoryPicker
        title="选择合集赛道"
        options={categories}
        selectedId={category}
        onSelect={setCategory}
        loading={loadingCategories}
      />
      <StagePicker selected={stage} onSelect={setStage} />
      <SubmitButton label="发布" onPress={handleSubmit} loading={submitting} />
    </ScrollView>
  )
}

function VideoForm(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [agent, setAgent] = useState('')
  const [remark, setRemark] = useState('')
  const [coverUri, setCoverUri] = useState('')
  const [videoUri, setVideoUri] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    if (!title.trim()) {
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
        title: title.trim(),
        content_md: content,
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
  }

  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker label="封面" uri={coverUri} onPick={setCoverUri} onClear={() => setCoverUri('')} />
      <VideoPicker uri={videoUri} onPick={setVideoUri} onClear={() => setVideoUri('')} />
      <LabeledInput label="课程标题" value={title} onChangeText={setTitle} placeholder="请输入课程标题" />
      <LabeledTextarea label="课程描述" value={content} onChangeText={setContent} placeholder="请输入课程描述" />
      <LabeledInput label="关联AI应用" value={agent} onChangeText={setAgent} placeholder="搜索智能体" />
      <LabeledTextarea label="置顶评论" value={remark} onChangeText={setRemark} placeholder="请输入置顶评论" />
      <SubmitButton label="发布" onPress={handleSubmit} loading={submitting} />
    </ScrollView>
  )
}

export default function StudyPublishScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [mode, setMode] = useState<PublishMode>('group')

  return (
    <View style={styles.root}>
      <NavBar
        title={mode === 'group' ? '发布课程合集' : '发布视频'}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.tabRow}>
        {(['group', 'video'] as const).map((m) => {
          const active = mode === m
          const label = m === 'group' ? '合集' : '视频'
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.tabItem, active ? styles.tabItemActive : null]}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      {mode === 'group' ? <GroupForm /> : <VideoForm />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.card,
  },
  tabItemActive: { backgroundColor: tokens.brand.DEFAULT },
  tabText: { fontSize: 14, color: tokens.text.secondary },
  tabTextActive: { fontSize: 14, fontWeight: '600', color: tokens.surface.light },
})

const formStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
})

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500', color: tokens.text.primary },
  input: {
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.text.primary,
    backgroundColor: tokens.surface.card,
  },
  textarea: {
    minHeight: 80,
  },
})

const coverStyles = StyleSheet.create({
  box: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: tokens.surface.card,
  },
  previewWrap: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  clearBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 16, color: tokens.surface.light, lineHeight: 18 },
  icon: { fontSize: 28, color: tokens.text.tertiary },
  hint: { fontSize: 12, color: tokens.text.tertiary },
  pressed: { opacity: 0.85 },
})

const chipStyles = StyleSheet.create({
  loading: { paddingVertical: 8 },
  empty: { fontSize: 13, color: tokens.text.tertiary, paddingVertical: 4 },
})

const submitStyles = StyleSheet.create({
  btn: {
    height: 46,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  text: { fontSize: 15, fontWeight: '600', color: tokens.surface.light },
  pressed: { opacity: 0.85 },
})
