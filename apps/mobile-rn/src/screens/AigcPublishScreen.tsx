import { rnLightTokens as tokens } from '@ihui/design-tokens'
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
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { createAigcTask, uploadFileMultipart, resolveFileUrl } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useI18n } from '../i18n'

const PRIMARY = tokens.brand.DEFAULT

type Nav = NativeStackNavigationProp<RootStackParamList>

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

interface UploadFile {
  id: string
  url: string
  type: WorkType
}

export default function AigcPublishScreen() {
  const navigation = useNavigation<Nav>()
  const { t } = useI18n()
  const [workType, setWorkType] = useState<WorkType>('image')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [textContent, setTextContent] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [urlInput, setUrlInput] = useState('')

  const addFileByUrl = () => {
    const url = urlInput.trim()
    if (!url) {
      setError('请输入文件 URL')
      return
    }
    if (files.length >= 5) {
      setError('最多上传 5 个素材')
      return
    }
    setError('')
    setFiles((prev) => [...prev, { id: `file-${Date.now()}`, url, type: workType }])
    setUrlInput('')
  }

  /**
   * 调用 expo-image-picker 从相册选择图片,通过 uploadFileMultipart 上传到 /api/files/upload/form。
   * expo-image-picker 16.x(SDK 53 兼容):result.canceled + assets[] 数组,
   * asset 含 uri/mimeType/fileName 字段,无需推断 MIME 与扩展名。
   */
  const pickImage = async () => {
    if (uploading) return
    if (files.length >= 5) {
      setError('最多上传 5 个素材')
      return
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      })
      // 16.x 用 canceled(美式拼写);cancelled(英式)是 8.x 老字段
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset?.uri) return
      setUploading(true)
      setError('')
      const isVideo = asset.type === 'video'
      const res = await uploadFileMultipart({
        uri: asset.uri,
        type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        name: asset.fileName || `upload-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      })
      if (res.success && res.data) {
        const url = resolveFileUrl(res.data.path)
        setFiles((prev) => [...prev, { id: res.data!.id, url, type: workType }])
      } else {
        setError(res.error || '上传失败')
      }
    } catch {
      setError('选择文件失败')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const validate = (): boolean => {
    if (workType === 'text') {
      if (!textContent.trim()) {
        setError('请输入文本内容')
        return false
      }
    } else if (files.length === 0) {
      setError('请至少上传一个素材')
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
    try {
      const res = await createAigcTask({
        type: workType,
        prompt,
        params: {
          title,
          description,
          textContent,
          fileUrl: files.map((f) => f.url),
        },
      })
      if (res.success) {
        Alert.alert(t('aigcPublish.success.title'), t('aigcPublish.success.message'), [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ])
      } else {
        setError(res.error || '发布失败')
      }
    } catch {
      setError('发布失败,请稍后重试')
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
      <Text style={styles.subtitle}>选择类型 → 上传素材 → 填写信息 → 发布</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.label}>作品类型</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.typeChip, workType === opt.key && styles.typeChipActive]}
            onPress={() => {
              setWorkType(opt.key)
              setFiles([])
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
          <Text style={styles.label}>上传素材 ({files.length}/5)</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="请输入素材 URL"
              placeholderTextColor={tokens.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.urlAddBtn} onPress={addFileByUrl} activeOpacity={0.7}>
              <Text style={styles.urlAddText}>添加</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.pickerBtn, uploading && styles.pickerBtnDisabled]}
            onPress={pickImage}
            disabled={uploading}
            activeOpacity={0.7}
          >
            {uploading ? (
              <View style={styles.pickerBtnInner}>
                <ActivityIndicator color={tokens.surface.light} size="small" />
                <Text style={styles.pickerBtnTextUploading}>上传中...</Text>
              </View>
            ) : (
              <Text style={styles.pickerBtnText}>从相册选择</Text>
            )}
          </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.fileAdd}
                onPress={pickImage}
                disabled={uploading}
                activeOpacity={0.7}
              >
                <Text style={styles.fileAddIcon}>+</Text>
                <Text style={styles.fileAddText}>{uploading ? '上传中' : '从相册'}</Text>
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
          <ActivityIndicator color={tokens.surface.light} size="small" />
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
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  urlInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    fontSize: 13,
    color: tokens.text.primary,
    backgroundColor: tokens.surface.light,
  },
  urlAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  urlAddText: { color: tokens.surface.light, fontSize: 13, fontWeight: '600' },
  pickerBtn: {
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
    backgroundColor: tokens.surface.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pickerBtnDisabled: {
    opacity: 0.6,
    borderColor: tokens.text.tertiary,
    backgroundColor: tokens.text.tertiary,
  },
  pickerBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickerBtnText: { color: PRIMARY, fontSize: 13, fontWeight: '600' },
  pickerBtnTextUploading: { color: tokens.surface.light, fontSize: 13, fontWeight: '600' },
  fileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fileItem: {
    width: 76,
    height: 76,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: tokens.border.light,
  },
  fileImage: { width: '100%', height: '100%' },
  fileRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: tokens.error.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileRemoveText: { color: tokens.surface.light, fontSize: 14, fontWeight: '700', lineHeight: 14 },
  fileAdd: {
    width: 76,
    height: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  fileAddIcon: { fontSize: 24, color: tokens.text.tertiary, lineHeight: 26 },
  fileAddText: { fontSize: 11, color: tokens.text.tertiary, marginTop: 2 },
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
