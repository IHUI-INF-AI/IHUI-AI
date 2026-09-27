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
  View,
} from 'react-native'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import { CategoryDropdown } from '../../components/category/CategoryDropdown'
import type { TFunction } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

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
  const fieldStyles = useMemo(() => createFieldStyles(tk), [tk])
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
  colorScheme,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const fieldStyles = useMemo(() => createFieldStyles(tk), [tk])
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
  colorScheme,
}: {
  label: string
  uri: string
  onPick: () => void
  onClear: () => void
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  const fieldStyles = useMemo(() => createFieldStyles(tk), [tk])
  const coverStyles = useMemo(() => createCoverStyles(tk), [tk])
  if (uri) {
    return (
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>{label}</Text>
        <View style={coverStyles.previewWrap}>
          <Image source={{ uri }} style={coverStyles.preview} resizeMode="cover" />
          {/* 封面删除钮是绝对定位的定尺寸小圆盒,且盒上有底色/圆角 —— 属"整盒下移"那一档:
              外层只承接定位与尺寸这几条纯布局档(命中区与位置一分不动),底色/圆角/居中连盒
              一起下移到子 View 的数组形态上,并按外层定尺寸撑满,画出来的圆与改前逐像素同位。 */}
          <Pressable
            style={coverStyles.clearHit}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={`删除${label}`}
          >
            {({ pressed }) => (
              <View style={[coverStyles.clearBtn, pressed ? coverStyles.pressed : null]}>
                <Text style={coverStyles.clearText}>×</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      {/* 上传占位盒带虚线描边与底色 —— 属"整盒下移"那一档:函数形态的 style 落在 Pressable 上会被
          cssInterop 整份丢掉,盒子留外层又会把描边挤到 padding 内圈,所以外层只承接点击与无障碍语义,
          盒子(含按压态)下移到子 View 的数组形态上,并用撑满档把父级 stretch 给的整行宽还给盒子。 */}
      <Pressable onPress={onPick} accessibilityRole="button" accessibilityLabel={label}>
        {({ pressed }) => (
          <View
            style={[coverStyles.boxFace, coverStyles.box, pressed ? coverStyles.pressed : null]}
          >
            <Text style={coverStyles.icon}>+</Text>
            <Text style={coverStyles.hint}>点击上传</Text>
          </View>
        )}
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
  const fieldStyles = useMemo(() => createFieldStyles(tk), [tk])
  const coverStyles = useMemo(() => createCoverStyles(tk), [tk])
  if (uri) {
    return (
      <View style={fieldStyles.wrap}>
        <Text style={fieldStyles.label}>视频预览</Text>
        <View style={coverStyles.previewWrap}>
          <View style={coverStyles.preview} />
          {/* 同上(封面那处关闭钮):定尺寸圆盒整盒下移,外层只留定位与尺寸。 */}
          <Pressable
            style={coverStyles.clearHit}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="删除视频"
          >
            {({ pressed }) => (
              <View style={[coverStyles.clearBtn, pressed ? coverStyles.pressed : null]}>
                <Text style={coverStyles.clearText}>×</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>视频</Text>
      {/* 与封面上传那一处同型:整盒下移 + 撑满档保持整行宽(见封面处的说明)。 */}
      <Pressable onPress={onPick} accessibilityRole="button" accessibilityLabel="选择视频">
        {({ pressed }) => (
          <View
            style={[coverStyles.boxFace, coverStyles.box, pressed ? coverStyles.pressed : null]}
          >
            <Text style={coverStyles.icon}>+</Text>
            <Text style={coverStyles.hint}>点击上传视频</Text>
          </View>
        )}
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
  const fieldStyles = useMemo(() => createFieldStyles(tk), [tk])
  const chipStyles = useMemo(() => createChipStyles(tk), [tk])
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={tk.brand.DEFAULT} style={chipStyles.loading} />
      ) : options.length === 0 ? (
        <Text style={chipStyles.empty}>暂无赛道</Text>
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
  const fieldStyles = useMemo(() => createFieldStyles(tk), [tk])
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>课程阶段</Text>
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
  const submitStyles = useMemo(() => createSubmitStyles(tk), [tk])
  return (
    // 发布按钮是品牌实底盒(底色 + 圆角)—— 属"整盒下移"那一档:函数形态的 style 落在 Pressable 上
    // 会被 cssInterop 整份丢掉,所以外层只承接点击/禁用与无障碍语义,盒子连按压态一起下移到子 View
    // 的数组形态上,并用撑满档把父级 stretch 给出的整行宽还给盒子;上边距留在盒内,可见位置不变。
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {({ pressed }) => (
        <View
          style={[
            submitStyles.submitFace,
            submitStyles.submitBtn,
            pressed ? submitStyles.pressed : null,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={tk.brand.foreground} />
          ) : (
            <Text style={submitStyles.submitText}>{label}</Text>
          )}
        </View>
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
  colorScheme,
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
  colorScheme: 'light' | 'dark'
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
      <SubmitButton
        label="发布"
        onPress={onSubmit}
        loading={submitting}
        colorScheme={colorScheme}
      />
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
  colorScheme,
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
  colorScheme: 'light' | 'dark'
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
      <SubmitButton
        label="发布"
        onPress={onSubmit}
        loading={submitting}
        colorScheme={colorScheme}
      />
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
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
          colorScheme={colorScheme}
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
          colorScheme={colorScheme}
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
    tabTextActive: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
  })
}

const formStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 14, gap: 14, paddingBottom: 32 },
})

// 以下四个 StyleSheet 均含主题色,不能模块级锁浅色:按当前 colorScheme 的 tokens 动态创建(组件内 useMemo)。
function createFieldStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    wrap: { gap: 6 },
    label: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
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
    // 上传占位盒下移到子 View 后用这一档取回原来由父级 stretch 给出的整行宽;不是新的尺寸档。
    boxFace: { width: '100%' },
    box: {
      height: 120,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: tk.surface.card,
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
    // 关闭钮拆两层:外层 clearHit 只有定位与定尺寸(纯布局档,命中区与位置与改前一字不差),
    clearHit: { position: 'absolute', top: 4, right: 4, width: 24, height: 24 },
    // 盒子的圆角/底色/居中连按压态一起下移到内层,并按父盒(定尺寸 24×24)撑满 —— 画出来的圆同位同径。
    clearBtn: {
      width: '100%',
      height: '100%',
      borderRadius: rnRadius.xl,
      backgroundColor: tk.overlay.modal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 蒙层恒为深色半透明,其上的关闭符两主题都用白色(base=不随主题翻转的浅色档,同 SearchInput 先例)
    clearText: { fontSize: 18, color: baseTokens.surface.light, lineHeight: 18 },
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
    // 下移到子 View 的发布盒用这一档取回原来由父级 stretch 给出的整行宽;不是新的尺寸档。
    submitFace: { width: '100%' },
    submitBtn: {
      height: 50,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    // 品牌实底之上的前景必须用配对档 brand.foreground(深色下 brand.DEFAULT 翻白,surface.light 会变成深灰)
    submitText: { fontSize: 16, fontWeight: '600', color: tk.brand.foreground },
    pressed: { opacity: 0.85 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠