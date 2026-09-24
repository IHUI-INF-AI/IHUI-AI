// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import { CategoryDropdown } from '../../components/category/CategoryDropdown'
import type { TFunction } from '../../types'

import { rnRadius } from '@ihui/design-tokens'

/** 课程分类(共享层简化类型,对齐 @ihui/types CourseCategory) */
export interface StudyCategory {
  id: string
  name: string
}

/** 课程阶段选项 */
export interface StageOption {
  id: number
  name: string
}

/** StudyPublishScreen props(平台无关,wrapper 注入数据+回调) */
export interface StudyPublishScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  mode: 'group' | 'video'
  onModeChange: (mode: 'group' | 'video') => void
  onBack?: () => void
  // Group form
  groupTitle: string
  groupContent: string
  groupCategory: string
  groupStage: number
  groupCoverUri: string
  groupCategories: readonly StudyCategory[]
  groupLoadingCategories: boolean
  onGroupTitleChange: (v: string) => void
  onGroupContentChange: (v: string) => void
  onGroupCategoryChange: (v: string) => void
  onGroupStageChange: (v: number) => void
  onGroupCoverPick: () => void
  onGroupCoverClear: () => void
  onGroupSubmit: () => void
  // Video form
  videoTitle: string
  videoContent: string
  videoAgent: string
  videoRemark: string
  videoCoverUri: string
  videoUri: string
  onVideoTitleChange: (v: string) => void
  onVideoContentChange: (v: string) => void
  onVideoAgentChange: (v: string) => void
  onVideoRemarkChange: (v: string) => void
  onVideoCoverPick: () => void
  onVideoCoverClear: () => void
  onVideoPick: () => void
  onVideoClear: () => void
  onVideoSubmit: () => void
  // Common
  submitting: boolean
}

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
  colorScheme,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createFieldStyles(tk), [tk])
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tk.text.tertiary}
      />
    </View>
  )
}

function LabeledTextarea({
  label,
  value,
  onChangeText,
  placeholder,
  colorScheme,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createFieldStyles(tk), [tk])
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />
    </View>
  )
}

function CoverPicker({
  label,
  uri,
  onPick,
  onClear,
  colorScheme,
}: {
  label: string
  uri: string
  onPick: () => void
  onClear: () => void
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const field = useMemo(() => createFieldStyles(tk), [tk])
  const cover = useMemo(() => createCoverStyles(tk), [tk])
  if (uri) {
    return (
      <View style={field.wrap}>
        <Text style={field.label}>{label}</Text>
        <View style={cover.previewWrap}>
          <Image source={{ uri }} style={cover.preview} resizeMode="cover" />
          <Pressable
            style={({ pressed }) => [cover.clearBtn, pressed ? cover.pressed : null]}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={`删除${label}`}
          >
            <Text style={cover.clearText}>×</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [cover.box, pressed ? cover.pressed : null]}
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={cover.icon}>+</Text>
        <Text style={cover.hint}>点击上传</Text>
      </Pressable>
    </View>
  )
}

function VideoPicker({
  uri,
  onPick,
  onClear,
  colorScheme,
}: {
  uri: string
  onPick: () => void
  onClear: () => void
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const field = useMemo(() => createFieldStyles(tk), [tk])
  const cover = useMemo(() => createCoverStyles(tk), [tk])
  if (uri) {
    return (
      <View style={field.wrap}>
        <Text style={field.label}>视频预览</Text>
        <View style={cover.previewWrap}>
          <View style={cover.preview} />
          <Pressable
            style={({ pressed }) => [cover.clearBtn, pressed ? cover.pressed : null]}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="删除视频"
          >
            <Text style={cover.clearText}>×</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={field.wrap}>
      <Text style={field.label}>视频</Text>
      <Pressable
        style={({ pressed }) => [cover.box, pressed ? cover.pressed : null]}
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel="选择视频"
      >
        <Text style={cover.icon}>+</Text>
        <Text style={cover.hint}>点击上传视频</Text>
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
  colorScheme,
}: {
  title: string
  options: readonly StudyCategory[]
  selectedId: string
  onSelect: (id: string) => void
  loading: boolean
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const field = useMemo(() => createFieldStyles(tk), [tk])
  const chip = useMemo(() => createChipStyles(tk), [tk])
  return (
    <View style={field.wrap}>
      <Text style={field.label}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={tk.brand.DEFAULT} style={chip.loading} />
      ) : options.length === 0 ? (
        <Text style={chip.empty}>暂无赛道</Text>
      ) : (
        <CategoryDropdown
          items={options.map((o) => ({ id: o.id, label: o.name }))}
          selectedId={selectedId}
          onSelect={onSelect}
          colorScheme={colorScheme}
        />
      )}
    </View>
  )
}

function StagePicker({
  selected,
  onSelect,
  colorScheme,
}: {
  selected: number
  onSelect: (id: number) => void
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createFieldStyles(tk), [tk])
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>课程阶段</Text>
      <CategoryDropdown
        items={STAGES.map((s) => ({ id: String(s.id), label: s.name }))}
        selectedId={String(selected)}
        onSelect={(id) => onSelect(Number(id))}
        colorScheme={colorScheme}
      />
    </View>
  )
}

function SubmitButton({
  label,
  onPress,
  loading,
  colorScheme,
}: {
  label: string
  onPress: () => void
  loading: boolean
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createSubmitStyles(tk), [tk])
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={tk.brand.foreground} />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </Pressable>
  )
}

function GroupForm({
  title,
  content,
  category,
  stage,
  coverUri,
  categories,
  loadingCategories,
  submitting,
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onStageChange,
  onCoverPick,
  onCoverClear,
  onSubmit,
  colorScheme,
}: {
  title: string
  content: string
  category: string
  stage: number
  coverUri: string
  categories: readonly StudyCategory[]
  loadingCategories: boolean
  submitting: boolean
  onTitleChange: (v: string) => void
  onContentChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onStageChange: (v: number) => void
  onCoverPick: () => void
  onCoverClear: () => void
  onSubmit: () => void
  colorScheme: 'light' | 'dark'
}) {
  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker
        label="封面"
        uri={coverUri}
        onPick={onCoverPick}
        onClear={onCoverClear}
        colorScheme={colorScheme}
      />
      <LabeledInput
        label="合集标题"
        value={title}
        onChangeText={onTitleChange}
        placeholder="请输入合集标题"
        colorScheme={colorScheme}
      />
      <LabeledTextarea
        label="合集描述"
        value={content}
        onChangeText={onContentChange}
        placeholder="请输入合集描述"
        colorScheme={colorScheme}
      />
      <CategoryPicker
        title="选择合集赛道"
        options={categories}
        selectedId={category}
        onSelect={onCategoryChange}
        loading={loadingCategories}
        colorScheme={colorScheme}
      />
      <StagePicker selected={stage} onSelect={onStageChange} colorScheme={colorScheme} />
      <SubmitButton label="发布" onPress={onSubmit} loading={submitting} colorScheme={colorScheme} />
    </ScrollView>
  )
}

function VideoForm({
  title,
  content,
  agent,
  remark,
  coverUri,
  videoUri,
  submitting,
  onTitleChange,
  onContentChange,
  onAgentChange,
  onRemarkChange,
  onCoverPick,
  onCoverClear,
  onVideoPick,
  onVideoClear,
  onSubmit,
  colorScheme,
}: {
  title: string
  content: string
  agent: string
  remark: string
  coverUri: string
  videoUri: string
  submitting: boolean
  onTitleChange: (v: string) => void
  onContentChange: (v: string) => void
  onAgentChange: (v: string) => void
  onRemarkChange: (v: string) => void
  onCoverPick: () => void
  onCoverClear: () => void
  onVideoPick: () => void
  onVideoClear: () => void
  onSubmit: () => void
  colorScheme: 'light' | 'dark'
}) {
  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker
        label="封面"
        uri={coverUri}
        onPick={onCoverPick}
        onClear={onCoverClear}
        colorScheme={colorScheme}
      />
      <VideoPicker
        uri={videoUri}
        onPick={onVideoPick}
        onClear={onVideoClear}
        colorScheme={colorScheme}
      />
      <LabeledInput
        label="课程标题"
        value={title}
        onChangeText={onTitleChange}
        placeholder="请输入课程标题"
        colorScheme={colorScheme}
      />
      <LabeledTextarea
        label="课程描述"
        value={content}
        onChangeText={onContentChange}
        placeholder="请输入课程描述"
        colorScheme={colorScheme}
      />
      <LabeledInput
        label="关联AI应用"
        value={agent}
        onChangeText={onAgentChange}
        placeholder="搜索智能体"
        colorScheme={colorScheme}
      />
      <LabeledTextarea
        label="置顶评论"
        value={remark}
        onChangeText={onRemarkChange}
        placeholder="请输入置顶评论"
        colorScheme={colorScheme}
      />
      <SubmitButton label="发布" onPress={onSubmit} loading={submitting} colorScheme={colorScheme} />
    </ScrollView>
  )
}

export function StudyPublishScreen({
  t,
  colorScheme = 'light',
  mode,
  onModeChange,
  onBack,
  groupTitle,
  groupContent,
  groupCategory,
  groupStage,
  groupCoverUri,
  groupCategories,
  groupLoadingCategories,
  onGroupTitleChange,
  onGroupContentChange,
  onGroupCategoryChange,
  onGroupStageChange,
  onGroupCoverPick,
  onGroupCoverClear,
  onGroupSubmit,
  videoTitle,
  videoContent,
  videoAgent,
  videoRemark,
  videoCoverUri,
  videoUri,
  onVideoTitleChange,
  onVideoContentChange,
  onVideoAgentChange,
  onVideoRemarkChange,
  onVideoCoverPick,
  onVideoCoverClear,
  onVideoPick,
  onVideoClear,
  onVideoSubmit,
  submitting,
}: StudyPublishScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>{t('studyPublish.title') || '发布课程'}</Text>
      </View>
      <View style={styles.tabRow}>
        {(['group', 'video'] as const).map((m) => {
          const active = mode === m
          const label = m === 'group' ? '合集' : '视频'
          return (
            <Pressable
              key={m}
              onPress={() => onModeChange(m)}
              style={[styles.tabItem, active ? styles.tabItemActive : null]}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      {mode === 'group' ? (
        <GroupForm
          title={groupTitle}
          content={groupContent}
          category={groupCategory}
          stage={groupStage}
          coverUri={groupCoverUri}
          categories={groupCategories}
          loadingCategories={groupLoadingCategories}
          submitting={submitting}
          onTitleChange={onGroupTitleChange}
          onContentChange={onGroupContentChange}
          onCategoryChange={onGroupCategoryChange}
          onStageChange={onGroupStageChange}
          onCoverPick={onGroupCoverPick}
          onCoverClear={onGroupCoverClear}
          onSubmit={onGroupSubmit}
          colorScheme={colorScheme}
        />
      ) : (
        <VideoForm
          title={videoTitle}
          content={videoContent}
          agent={videoAgent}
          remark={videoRemark}
          coverUri={videoCoverUri}
          videoUri={videoUri}
          submitting={submitting}
          onTitleChange={onVideoTitleChange}
          onContentChange={onVideoContentChange}
          onAgentChange={onVideoAgentChange}
          onRemarkChange={onVideoRemarkChange}
          onCoverPick={onVideoCoverPick}
          onCoverClear={onVideoCoverClear}
          onVideoPick={onVideoPick}
          onVideoClear={onVideoClear}
          onSubmit={onVideoSubmit}
          colorScheme={colorScheme}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 8,
    },
    tabItem: {
      flex: 1,
      height: 48,
      borderRadius: rnRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.card,
    },
    tabItemActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 16, color: tk.text.secondary },
    tabTextActive: { fontSize: 16, fontWeight: '600', color: tk.brand.foreground },
  })
}

const formStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 14, gap: 14, paddingBottom: 32 },
})

function createFieldStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    wrap: { gap: 6 },
    label: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.xl,
      height: 50,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    textarea: {
      minHeight: 80,
    },
  })
}

function createCoverStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    box: {
      height: 120,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: tk.surface.light,
    },
    previewWrap: {
      position: 'relative',
      borderRadius: rnRadius.xl,
      overflow: 'hidden',
    },
    preview: {
      width: '100%',
      height: 120,
      borderRadius: rnRadius.xl,
    },
    clearBtn: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: rnRadius.xl,
      backgroundColor: baseTokens.overlay.modal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 底是 overlay.modal(恒 rgba(0,0,0,0.6),不随主题翻),故其上符号须恒白:
    // 用 surface.light 的话,深色档案该值 = #262626 深灰,× 在黑遮罩上直接隐形。
    clearText: { fontSize: 18, color: '#FFFFFF', lineHeight: 18 },
    icon: { fontSize: 28, color: tk.text.tertiary },
    hint: { fontSize: 14, color: tk.text.tertiary },
    pressed: { opacity: 0.85 },
  })
}

function createChipStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    loading: { paddingVertical: 8 },
    empty: { fontSize: 14, color: tk.text.tertiary, paddingVertical: 4 },
  })
}

function createSubmitStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    btn: {
      height: 50,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    text: { fontSize: 16, fontWeight: '600', color: tk.brand.foreground },
    pressed: { opacity: 0.85 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
