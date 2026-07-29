import { useState } from 'react'
import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { createAigcTask, uploadFileMultipart, resolveFileUrl } from '@ihui/api-client'
import {
  AigcPublishScreen as SharedAigcPublishScreen,
  type AigcPublishFile,
  type AigcPublishWorkType,
} from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useI18n } from '../i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function AigcPublishScreen() {
  const navigation = useNavigation<Nav>()
  const { t } = useI18n()
  const [workType, setWorkType] = useState<AigcPublishWorkType>('image')
  const [files, setFiles] = useState<AigcPublishFile[]>([])
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
      setError(t('aigcPublish.errorNoUrl'))
      return
    }
    if (files.length >= 5) {
      setError(t('aigcPublish.errorMaxFiles'))
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
      setError(t('aigcPublish.errorMaxFiles'))
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
        setError(res.error || t('aigcPublish.errorUploadFailed'))
      }
    } catch {
      setError(t('aigcPublish.errorPickFailed'))
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const validate = (): boolean => {
    if (workType === 'text') {
      if (!textContent.trim()) {
        setError(t('aigcPublish.errorNoText'))
        return false
      }
    } else if (files.length === 0) {
      setError(t('aigcPublish.errorNoFile'))
      return false
    }
    if (!title.trim()) {
      setError(t('aigcPublish.errorNoTitle'))
      return false
    }
    if (!description.trim()) {
      setError(t('aigcPublish.errorNoDescription'))
      return false
    }
    if (!prompt.trim()) {
      setError(t('aigcPublish.errorNoPrompt'))
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
        setError(res.error || t('aigcPublish.errorPublishFailed'))
      }
    } catch {
      setError(t('aigcPublish.errorPublishRetry'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SharedAigcPublishScreen
      t={t}
      workType={workType}
      files={files}
      textContent={textContent}
      title={title}
      description={description}
      prompt={prompt}
      urlInput={urlInput}
      saving={saving}
      uploading={uploading}
      error={error}
      onWorkTypeChange={(type) => {
        setWorkType(type)
        setFiles([])
      }}
      onTextContentChange={setTextContent}
      onTitleChange={setTitle}
      onDescriptionChange={setDescription}
      onPromptChange={setPrompt}
      onUrlInputChange={setUrlInput}
      onAddFileByUrl={addFileByUrl}
      onPickImage={pickImage}
      onRemoveFile={removeFile}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
