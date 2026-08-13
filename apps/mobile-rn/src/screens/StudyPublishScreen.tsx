/**
 * StudyPublishScreen 课程发布(mobile-rn 端,复杂页 — 双态切换)
 *
 * 1:1 复刻历史 Uniapp pagesA/study/publish.vue 的双态切换结构:
 * - Uniapp 用 Group/AddVideo 两个子组件 + showAddVideo 切换;RN 用 useState(mode) 切换表单
 * - 顶部 Tab:合集(group)/ 视频(video),对齐 Uniapp pageTitle「发布课程合集 / 发布视频」
 * - 合集表单:封面 / 合集标题 / 合集描述 / 主赛道选择 / 课程阶段(对齐 group.vue)
 * - 视频表单:封面 / 视频 / 课程标题 / 课程描述 / 关联AI应用 / 置顶评论(对齐 add_video.vue)
 * - 赛道选择:Pressable chips 占位(对齐 Uniapp Single 选择器;category API 待接入)
 * - 提交:Alert 占位(publishCourse / publishVideo API 仓库暂无)
 *
 * 拆子组件到同文件内 function(AGENTS.md §4):StudyPublishScreen(主,< 250 行)+
 * GroupForm / VideoForm / CategoryPicker / CoverPicker / LabeledInput / LabeledTextarea。
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type PublishMode = 'group' | 'video'

interface CategoryOption {
  id: string
  name: string
}

interface StageOption {
  id: number
  name: string
}

/** mock 赛道(category API 待接入,对齐 Uniapp category(0)) */
const CATEGORIES: readonly CategoryOption[] = [
  { id: '1', name: 'AI 实战' },
  { id: '2', name: '副业变现' },
  { id: '3', name: '职场技能' },
  { id: '4', name: '短视频运营' },
] as const

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

function CoverPicker({ label }: { label: string }): React.JSX.Element {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [coverStyles.box, pressed ? coverStyles.pressed : null]}
        onPress={() => Alert.alert('上传', '上传功能即将上线,敬请期待')}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={coverStyles.icon}>+</Text>
        <Text style={coverStyles.hint}>点击上传</Text>
      </Pressable>
    </View>
  )
}

function CategoryPicker({
  title,
  options,
  selectedId,
  onSelect,
}: {
  title: string
  options: ReadonlyArray<CategoryOption>
  selectedId: string
  onSelect: (id: string) => void
}): React.JSX.Element {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chipStyles.row}>
        {options.map((opt) => {
          const active = opt.id === selectedId
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSelect(opt.id)}
              style={[chipStyles.chip, active ? chipStyles.chipActive : null]}
              accessibilityRole="button"
              accessibilityLabel={opt.name}
            >
              <Text style={[chipStyles.chipText, active ? chipStyles.chipTextActive : null]}>
                {opt.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
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
      <View style={chipStyles.row}>
        {STAGES.map((s) => {
          const active = s.id === selected
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s.id)}
              style={[chipStyles.chip, active ? chipStyles.chipActive : null]}
              accessibilityRole="button"
              accessibilityLabel={s.name}
            >
              <Text style={[chipStyles.chipText, active ? chipStyles.chipTextActive : null]}>
                {s.name}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function SubmitButton({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [submitStyles.btn, pressed ? submitStyles.pressed : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={submitStyles.text}>{label}</Text>
    </Pressable>
  )
}

function GroupForm(): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [stage, setStage] = useState(0)

  const onSubmit = (): void => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入合集标题')
      return
    }
    Alert.alert('发布', '合集发布功能即将上线,敬请期待')
  }

  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker label="封面" />
      <LabeledInput label="合集标题" value={title} onChangeText={setTitle} placeholder="请输入合集标题" />
      <LabeledTextarea label="合集描述" value={content} onChangeText={setContent} placeholder="请输入合集描述" />
      <CategoryPicker title="选择合集赛道" options={CATEGORIES} selectedId={category} onSelect={setCategory} />
      <StagePicker selected={stage} onSelect={setStage} />
      <SubmitButton label="发布" onPress={onSubmit} />
    </ScrollView>
  )
}

function VideoForm(): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [agent, setAgent] = useState('')
  const [remark, setRemark] = useState('')

  const onSubmit = (): void => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入课程标题')
      return
    }
    Alert.alert('发布', '视频发布功能即将上线,敬请期待')
  }

  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker label="封面" />
      <CoverPicker label="视频" />
      <LabeledInput label="课程标题" value={title} onChangeText={setTitle} placeholder="请输入课程标题" />
      <LabeledTextarea label="课程描述" value={content} onChangeText={setContent} placeholder="请输入课程描述" />
      <LabeledInput label="关联AI应用" value={agent} onChangeText={setAgent} placeholder="搜索智能体" />
      <LabeledTextarea label="置顶评论" value={remark} onChangeText={setRemark} placeholder="请输入置顶评论" />
      <SubmitButton label="发布" onPress={onSubmit} />
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
  icon: { fontSize: 28, color: tokens.text.tertiary },
  hint: { fontSize: 12, color: tokens.text.tertiary },
  pressed: { opacity: 0.85 },
})

const chipStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.card,
  },
  chipActive: { backgroundColor: tokens.brand.DEFAULT },
  chipText: { fontSize: 13, color: tokens.text.secondary },
  chipTextActive: { fontSize: 13, fontWeight: '600', color: tokens.surface.light },
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
