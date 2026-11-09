// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {} from 'react-native'
import { appAlert } from '../components/BottomPops'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { createAigcTask, resolveFileUrl } from '@ihui/api-client'
import { uploadFileWithProgress } from './AigcPublishUpload'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  AigcPublishScreen as SharedAigcPublishScreen,
  type AigcPublishFile,
  type AigcPublishWorkType,
} from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useI18n } from '../i18n'
import { useHostPorts } from '../host/use-host-ports'

type Nav = NativeStackNavigationProp<RootStackParamList>

/** RN 类型档全开:四档都有上传/校验链路(本端 validate 恒要求提示词) */
const PUBLISH_WORK_TYPES: readonly AigcPublishWorkType[] = ['image', 'video', 'audio', 'text']

export default function AigcPublishScreen() {
  const { resolvedTheme } = useTheme()
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
  // XUI-070:选图/上传是同 tick 可连点的入口,state 来不及刷新 ⇒ 用 ref 上锁;
  // 上传进度回调可能在卸载后到达 ⇒ mountedRef 拦掉。
  const uploadingRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )
  /** 真实上传进度端口:0-100,来自 expo UploadTask 的 bytesSent/totalBytes;undefined = 未知 */
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined)
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
    setFiles((prev) => [...prev, { id: `file-${Date.now()}`, url }])
    setUrlInput('')
  }

  const pickImage = async () => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    if (files.length >= 5) {
      setError(t('aigcPublish.errorMaxFiles'))
      uploadingRef.current = false
      return
    }
    try {
      // 权限被拒时原实现直接调 launchImageLibraryAsync ⇒ 什么都不发生、也不提示。
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (perm.status !== 'granted') {
        appAlert(t('home.pubPermAlbumImage'))
        uploadingRef.current = false
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      })
      if (result.canceled) {
        uploadingRef.current = false
        return
      }
      const asset = result.assets?.[0]
      if (!asset?.uri) {
        uploadingRef.current = false
        return
      }
      setUploading(true)
      setUploadProgress(0)
      setError('')
      const isVideo = asset.type === 'video'
      const res = await uploadFileWithProgress(
        {
          uri: asset.uri,
          type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          name: asset.fileName || `upload-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        },
        {
          onUploadProgress: (percent) => {
            if (mountedRef.current) setUploadProgress(percent)
          },
        },
      )
      if (!mountedRef.current) return
      if (res.success && res.data) {
        const url = resolveFileUrl(res.data.path)
        setFiles((prev) => [...prev, { id: res.data!.id, url }])
      } else {
        setError(apiFailureToText(res, t('aigcPublish.errorUploadFailed')))
      }
    } catch {
      if (mountedRef.current) setError(t('aigcPublish.errorPickFailed'))
    } finally {
      uploadingRef.current = false
      if (mountedRef.current) {
        setUploading(false)
        setUploadProgress(undefined)
      }
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
        appAlert(t('aigcPublish.success.title'), t('aigcPublish.success.message'), [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ])
      } else {
        setError(apiFailureToText(res, t('aigcPublish.errorPublishFailed')))
      }
    } catch {
      setError(t('aigcPublish.errorPublishRetry'))
    } finally {
      setSaving(false)
    }
  }

  const { onToast } = useHostPorts()

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
      uploadProgress={uploadProgress}
      error={error}
      onWorkTypeChange={(wt) => {
        setWorkType(wt)
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
      colorScheme={resolvedTheme}
      onToast={onToast}
      workTypes={PUBLISH_WORK_TYPES}
      showPromptField
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
