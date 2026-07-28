import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { tokens } from '@ihui/rn-app'
import { createAigcTask } from '@ihui/api-client'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

const PRIMARY = tokens.brand.DEFAULT

type Nav = NativeStackNavigationProp<RootStackParamList>

type WorkType = 'image' | 'video' | 'audio' | 'text'

interface WorkTypeOption {
  key: WorkType
  label: string
  desc: string
}

// 静态 UI 选项配置(非 mock 数据):作品类型枚举
const TYPE_OPTIONS: WorkTypeOption[] = [
  { key: 'image', label: '图片', desc: 'AI 生成图片' },
  { key: 'video', label: '视频', desc: 'AI 生成视频' },
  { key: 'audio', label: '音频', desc: 'AI 生成音频' },
  { key: 'text', label: '文案', desc: 'AI 生成文本' },
]

export default function AigcPublishScreen() {
  const navigation = useNavigation<Nav>()
  const [workType, setWorkType] = useState<WorkType>('image')
  const [fileUrl, setFileUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const validate = (): boolean => {
    if (workType === 'text') {
      if (!textContent.trim()) {
        setError('请输入文本内容')
        return false
      }
    } else if (!fileUrl.trim()) {
      setError('请输入作品 URL')
      return false
    }
    if (!title.trim()) {
      setError('请输入作品标题')
      return false
    }
    if (!description.trim()) {
      setError('请输入作品简介')
      return false
    }
    if (!prompt.trim()) {
      setError('请输入提示词')
      return false
    }
    setError('')
    return true
  }

  const onSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      const res = await createAigcTask({
        type: workType,
        prompt,
        params: { title, description, textContent, fileUrl },
      })
      if (res.success) {
        Alert.alert('发布成功', '作品已提交,审核通过后将展示在灵感列表', [
          { text: '好的', onPress: () => navigation.goBack() },
        ])
      } else {
        setError(res.error || '提交失败')
      }
    } catch {
      setError('提交失败')
    } finally {
      setSaving(false)
    }
  }

  const showTextInput = workType === 'text'

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>返回</Text>
      </TouchableOpacity>
      <Text style={styles.title}>发布作品</Text>
      <Text style={styles.subtitle}>选择类型 → 填写信息 → 发布</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.label}>作品类型</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.typeChip, workType === opt.key && styles.typeChipActive]}
            onPress={() => {
              setWorkType(opt.key)
              setFileUrl('')
            }}
          >
            <Text style={[styles.typeChipText, workType === opt.key && styles.typeChipTextActive]}>
              {opt.label}
            </Text>
            <Text style={[styles.typeChipDesc, workType === opt.key && styles.typeChipDescActive]}>
              {opt.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showTextInput ? (
        <>
          <Text style={styles.label}>文本内容</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={textContent}
            onChangeText={setTextContent}
            placeholder="请输入文本内容"
            placeholderTextColor={tokens.text.tertiary}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>作品 URL</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={fileUrl}
            onChangeText={setFileUrl}
            placeholder="请粘贴已生成作品的 URL"
            placeholderTextColor={tokens.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
            textAlignVertical="top"
          />
        </>
      )}

      <Text style={styles.label}>作品标题</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="请输入作品标题"
        placeholderTextColor={tokens.text.tertiary}
        maxLength={50}
      />

      <Text style={styles.label}>作品简介</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="请输入作品简介"
        placeholderTextColor={tokens.text.tertiary}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>提示词</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="请输入 AI 生成时使用的提示词"
        placeholderTextColor={tokens.text.tertiary}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitText}>发布作品</Text>
        )}
      </TouchableOpacity>
      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.light,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary, marginBottom: 12 },
  label: { marginTop: 14, fontSize: 12, color: tokens.text.secondary, marginBottom: 6 },
  errorText: { fontSize: 13, color: tokens.error.text, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: PRIMARY },
  typeChipText: { fontSize: 13, color: tokens.text.medium, fontWeight: '600' },
  typeChipTextActive: { color: tokens.surface.light },
  typeChipDesc: { marginTop: 2, fontSize: 10, color: tokens.text.tertiary },
  typeChipDescActive: { color: 'rgba(255,255,255,0.85)' },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    fontSize: 14,
    color: tokens.text.primary,
    backgroundColor: tokens.surface.light,
  },
  textarea: { minHeight: 88, maxHeight: 180, textAlignVertical: 'top' },
  submitBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { backgroundColor: tokens.text.tertiary },
  submitText: { color: tokens.surface.light, fontSize: 15, fontWeight: '600' },
})
