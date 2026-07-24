import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'

const PRIMARY = '#10B981'

type WorkType = 'image' | 'video' | 'audio' | 'text'

interface WorkTypeOption {
  key: WorkType
  label: string
  desc: string
}

const TYPE_OPTIONS: WorkTypeOption[] = [
  { key: 'image', label: '图片', desc: 'AI 生成图片' },
  { key: 'video', label: '视频', desc: 'AI 生成视频' },
  { key: 'audio', label: '音频', desc: 'AI 生成音频' },
  { key: 'text', label: '文案', desc: 'AI 生成文本' },
]

interface MockFile {
  id: string
  url: string
  type: WorkType
}

const MOCK_UPLOADS: MockFile[] = [
  { id: 'm1', url: 'https://picsum.photos/seed/pub1/200/200', type: 'image' },
  { id: 'm2', url: 'https://picsum.photos/seed/pub2/200/200', type: 'image' },
]

export default function AigcPublishScreen() {
  const navigation = useNavigation<any>()
  const [workType, setWorkType] = useState<WorkType>('image')
  const [files, setFiles] = useState<MockFile[]>([])
  const [textContent, setTextContent] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addMockFile = () => {
    if (files.length >= 5) {
      setError('最多上传 5 个素材')
      return
    }
    setError('')
    const seed = `pub${Date.now()}`
    setFiles((prev) => [
      ...prev,
      { id: seed, url: `https://picsum.photos/seed/${seed}/200/200`, type: workType },
    ])
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const validate = (): boolean => {
    if (workType === 'text') {
      if (!textContent.trim()) { setError('请输入文本内容'); return false }
    } else if (files.length === 0) {
      setError('请至少上传一个素材')
      return false
    }
    if (!title.trim()) { setError('请输入作品标题'); return false }
    if (!description.trim()) { setError('请输入作品简介'); return false }
    if (!prompt.trim()) { setError('请输入提示词'); return false }
    setError('')
    return true
  }

  const onSubmit = () => {
    if (!validate()) return
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      Alert.alert('发布成功', '作品已提交,审核通过后将展示在灵感列表', [
        { text: '好的', onPress: () => navigation.goBack() },
      ])
    }, 900)
  }

  const showTextInput = workType === 'text'

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>返回</Text>
      </TouchableOpacity>
      <Text style={styles.title}>发布作品</Text>
      <Text style={styles.subtitle}>选择类型 → 上传素材 → 填写信息 → 发布</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.label}>作品类型</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.typeChip, workType === opt.key && styles.typeChipActive]}
            onPress={() => { setWorkType(opt.key); setFiles([]) }}
          >
            <Text style={[styles.typeChipText, workType === opt.key && styles.typeChipTextActive]}>{opt.label}</Text>
            <Text style={[styles.typeChipDesc, workType === opt.key && styles.typeChipDescActive]}>{opt.desc}</Text>
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
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>上传素材 ({files.length}/5)</Text>
          <View style={styles.fileGrid}>
            {files.map((f) => (
              <View key={f.id} style={styles.fileItem}>
                <Image source={{ uri: f.url }} style={styles.fileImage} resizeMode="cover" />
                <TouchableOpacity style={styles.fileRemove} onPress={() => removeFile(f.id)}>
                  <Text style={styles.fileRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {files.length < 5 ? (
              <TouchableOpacity style={styles.fileAdd} onPress={addMockFile} activeOpacity={0.7}>
                <Text style={styles.fileAddIcon}>+</Text>
                <Text style={styles.fileAddText}>添加</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}

      <Text style={styles.label}>作品标题</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="请输入作品标题"
        placeholderTextColor="#9ca3af"
        maxLength={50}
      />

      <Text style={styles.label}>作品简介</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="请输入作品简介"
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>提示词</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="请输入 AI 生成时使用的提示词"
        placeholderTextColor="#9ca3af"
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
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backText: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280', marginBottom: 12 },
  label: { marginTop: 14, fontSize: 12, color: '#6b7280', marginBottom: 6 },
  errorText: { fontSize: 13, color: '#dc2626', marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
  typeChipActive: { backgroundColor: PRIMARY },
  typeChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  typeChipTextActive: { color: '#fff' },
  typeChipDesc: { marginTop: 2, fontSize: 10, color: '#9ca3af' },
  typeChipDescActive: { color: 'rgba(255,255,255,0.85)' },
  input: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    fontSize: 14, color: '#111827', backgroundColor: '#fff',
  },
  textarea: { minHeight: 88, maxHeight: 180, textAlignVertical: 'top' },
  fileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fileItem: { width: 76, height: 76, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  fileImage: { width: '100%', height: '100%' },
  fileRemove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 6,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center',
  },
  fileRemoveText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 14 },
  fileAdd: {
    width: 76, height: 76, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb',
  },
  fileAddIcon: { fontSize: 24, color: '#9ca3af', lineHeight: 26 },
  fileAddText: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  submitBtn: {
    marginTop: 24, paddingVertical: 14, borderRadius: 8, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  submitDisabled: { backgroundColor: '#9ca3af' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
