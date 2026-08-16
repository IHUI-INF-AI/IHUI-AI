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
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

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
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
}) {
  const tk = getTokens('light')
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
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
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
}) {
  const tk = getTokens('light')
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, fieldStyles.textarea]}
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
}: {
  label: string
  uri: string
  onPick: () => void
  onClear: () => void
}) {
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
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={coverStyles.icon}>+</Text>
        <Text style={coverStyles.hint}>点击上传</Text>
      </Pressable>
    </View>
  )
}

function VideoPicker({
  uri,
  onPick,
  onClear,
}: {
  uri: string
  onPick: () => void
  onClear: () => void
}) {
  if (uri) {
    return (
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>视频预览</Text>
        <View style={coverStyles.previewWrap}>
          <View style={coverStyles.preview} />
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
        onPress={onPick}
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
  options: readonly StudyCategory[]
  selectedId: string
  onSelect: (id: string) => void
  loading: boolean
}) {
  const tk = getTokens('light')
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={tk.brand.DEFAULT} style={chipStyles.loading} />
      ) : options.length === 0 ? (
        <Text style={chipStyles.empty}>暂无赛道</Text>
      ) : (
        <View style={chipStyles.chipRow}>
          {options.map((o) => {
            const active = o.id === selectedId
            return (
              <Pressable
                key={o.id}
                style={({ pressed }) => [
                  chipStyles.chip,
                  active ? chipStyles.chipActive : null,
                  pressed ? chipStyles.chipPressed : null,
                ]}
                onPress={() => onSelect(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={o.name}
              >
                <Text style={[chipStyles.chipText, active ? chipStyles.chipTextActive : null]}>
                  {o.name}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

function StagePicker({ selected, onSelect }: { selected: number; onSelect: (id: number) => void }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>课程阶段</Text>
      <View style={chipStyles.chipRow}>
        {STAGES.map((s) => {
          const active = s.id === selected
          return (
            <Pressable
              key={s.id}
              style={({ pressed }) => [
                chipStyles.chip,
                active ? chipStyles.chipActive : null,
                pressed ? chipStyles.chipPressed : null,
              ]}
              onPress={() => onSelect(s.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
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

function SubmitButton({
  label,
  onPress,
  loading,
}: {
  label: string
  onPress: () => void
  loading: boolean
}) {
  const tk = getTokens('light')
  return (
    <Pressable
      style={({ pressed }) => [submitStyles.btn, pressed ? submitStyles.pressed : null]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={tk.surface.light} />
      ) : (
        <Text style={submitStyles.text}>{label}</Text>
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
}) {
  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker label="封面" uri={coverUri} onPick={onCoverPick} onClear={onCoverClear} />
      <LabeledInput
        label="合集标题"
        value={title}
        onChangeText={onTitleChange}
        placeholder="请输入合集标题"
      />
      <LabeledTextarea
        label="合集描述"
        value={content}
        onChangeText={onContentChange}
        placeholder="请输入合集描述"
      />
      <CategoryPicker
        title="选择合集赛道"
        options={categories}
        selectedId={category}
        onSelect={onCategoryChange}
        loading={loadingCategories}
      />
      <StagePicker selected={stage} onSelect={onStageChange} />
      <SubmitButton label="发布" onPress={onSubmit} loading={submitting} />
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
}) {
  return (
    <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
      <CoverPicker label="封面" uri={coverUri} onPick={onCoverPick} onClear={onCoverClear} />
      <VideoPicker uri={videoUri} onPick={onVideoPick} onClear={onVideoClear} />
      <LabeledInput
        label="课程标题"
        value={title}
        onChangeText={onTitleChange}
        placeholder="请输入课程标题"
      />
      <LabeledTextarea
        label="课程描述"
        value={content}
        onChangeText={onContentChange}
        placeholder="请输入课程描述"
      />
      <LabeledInput
        label="关联AI应用"
        value={agent}
        onChangeText={onAgentChange}
        placeholder="搜索智能体"
      />
      <LabeledTextarea
        label="置顶评论"
        value={remark}
        onChangeText={onRemarkChange}
        placeholder="请输入置顶评论"
      />
      <SubmitButton label="发布" onPress={onSubmit} loading={submitting} />
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
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.card,
    },
    tabItemActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 16, color: tk.text.secondary },
    tabTextActive: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
  })
}

const formStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 14, gap: 14, paddingBottom: 32 },
})

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: getTokens('light').text.primary },
  input: {
    borderWidth: 1,
    borderColor: getTokens('light').border.light,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: getTokens('light').text.primary,
    backgroundColor: '#f5f5f5',
  },
  textarea: {
    minHeight: 80,
  },
})

const coverStyles = StyleSheet.create({
  box: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: getTokens('light').border.light,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: getTokens('light').surface.light,
  },
  previewWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  clearBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 18, color: getTokens('light').surface.light, lineHeight: 18 },
  icon: { fontSize: 28, color: getTokens('light').text.tertiary },
  hint: { fontSize: 14, color: getTokens('light').text.tertiary },
  pressed: { opacity: 0.85 },
})

const chipStyles = StyleSheet.create({
  loading: { paddingVertical: 8 },
  empty: { fontSize: 14, color: getTokens('light').text.tertiary, paddingVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: getTokens('light').border.light,
    backgroundColor: getTokens('light').surface.card,
  },
  chipActive: {
    backgroundColor: getTokens('light').brand.DEFAULT,
    borderColor: getTokens('light').brand.DEFAULT,
  },
  chipPressed: { opacity: 0.85 },
  chipText: { fontSize: 14, color: getTokens('light').text.secondary },
  chipTextActive: { fontSize: 14, color: getTokens('light').surface.light, fontWeight: '500' },
})

const submitStyles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: getTokens('light').brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  text: { fontSize: 16, fontWeight: '600', color: getTokens('light').surface.light },
  pressed: { opacity: 0.85 },
})
