import { logger } from '@/utils/logger'
import { View, Text, Input, Textarea, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { chooseImages, uploadImage } from '@/utils/upload-image'
import { useI18n } from '@/i18n'
import './index.css'

type ParamType = 'string' | 'number' | 'boolean' | 'file' | 'select' | 'json'

interface Param {
  name: string
  description: string
  type: ParamType
  defaultValue: string
}

const PARAM_TYPES: { value: ParamType; key: string; fb: string }[] = [
  { value: 'string', key: 'devEnter.n8nModel.typeString', fb: '文本' },
  { value: 'number', key: 'devEnter.n8nModel.typeNumber', fb: '数字' },
  { value: 'boolean', key: 'devEnter.n8nModel.typeBoolean', fb: '布尔' },
  { value: 'file', key: 'devEnter.n8nModel.typeFile', fb: '文件' },
  { value: 'select', key: 'devEnter.n8nModel.typeSelect', fb: '选择' },
  { value: 'json', key: 'devEnter.n8nModel.typeJson', fb: 'JSON' },
]

const newParam = (): Param => ({
  name: '',
  description: '',
  type: 'string',
  defaultValue: '',
})

/** 读取文本文件(UTF-8),用于解析 n8n JSON 备份 */
function readTextFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'utf8',
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(err),
    })
  })
}

export default function N8nModel() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }

  const [view, setView] = useState<'list' | 'create'>('list')
  // 列表态
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  // 创建表单态
  const [avatar, setAvatar] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [n8nFileName, setN8nFileName] = useState('')
  const [n8nFileData, setN8nFileData] = useState<unknown>(null)
  const [n8nUrl, setN8nUrl] = useState('')
  const [inputParams, setInputParams] = useState<Param[]>([newParam()])
  const [outputParams, setOutputParams] = useState<Param[]>([newParam()])
  const [submitting, setSubmitting] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await get('/workflows/n8n')) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch (e) {
      logger.error('n8n-model', '加载N8N智能体', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    if (view === 'list') loadList()
  })

  const onItemClick = (id: string) => {
    Taro.navigateTo({ url: `/pages/ai-assistant-n8n/index?id=${id}` })
  }

  const resetForm = () => {
    setAvatar('')
    setName('')
    setDescription('')
    setN8nFileName('')
    setN8nFileData(null)
    setN8nUrl('')
    setInputParams([newParam()])
    setOutputParams([newParam()])
  }

  const onCreate = () => {
    resetForm()
    setView('create')
  }

  const chooseAvatar = async () => {
    try {
      const paths = await chooseImages(1)
      const tempPath = paths[0]
      if (!tempPath) return
      setAvatar(tempPath)
      try {
        const upRes = await uploadImage(tempPath)
        if (upRes.url) setAvatar(upRes.url)
      } catch {
        // 上传失败,保留本地临时路径(mock 展示)
      }
    } catch {
      // 用户取消选择
    }
  }

  const chooseN8nFile = async () => {
    try {
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['json'],
      })
      const file = res.tempFiles[0]
      if (!file) return
      if (file.size > 10 * 1024 * 1024) {
        Taro.showToast({ title: '文件不能超过10MB', icon: 'none' })
        return
      }
      setN8nFileName(file.name)
      try {
        const text = await readTextFile(file.path)
        const json = JSON.parse(text)
        setN8nFileData(json)
        // 尝试从 n8n 备份文件中提取信息填充表单
        const wf =
          json.workflows && Array.isArray(json.workflows) && json.workflows.length
            ? json.workflows[0]
            : json
        if (wf.name && !name) setName(wf.name)
        if (wf.settings?.description && !description)
          setDescription(wf.settings.description)
        Taro.showToast({
          title: tt('devEnter.n8nModel.n8nFileParseSuccess', '文件解析成功'),
          icon: 'success',
        })
      } catch {
        Taro.showToast({
          title: tt('devEnter.n8nModel.n8nFileParseFailed', 'JSON 文件格式错误'),
          icon: 'none',
        })
        setN8nFileName('')
        setN8nFileData(null)
      }
    } catch (err) {
      const msg = String((err as { errMsg?: string })?.errMsg || '')
      if (!msg.includes('cancel')) {
        Taro.showToast({
          title: tt('devEnter.n8nModel.n8nFileReadFailed', '读取文件失败'),
          icon: 'none',
        })
      }
    }
  }

  const removeN8nFile = () => {
    setN8nFileName('')
    setN8nFileData(null)
    Taro.showToast({
      title: tt('devEnter.n8nModel.n8nFileRemoved', '已删除文件'),
      icon: 'success',
    })
  }

  const updateParam = (
    which: 'in' | 'out',
    index: number,
    patch: Partial<Param>,
  ) => {
    const setter = which === 'in' ? setInputParams : setOutputParams
    setter((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    )
  }
  const addParam = (which: 'in' | 'out') => {
    const setter = which === 'in' ? setInputParams : setOutputParams
    setter((prev) => [...prev, newParam()])
  }
  const removeParam = (which: 'in' | 'out', index: number) => {
    const setter = which === 'in' ? setInputParams : setOutputParams
    setter((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const validate = (): boolean => {
    if (!name.trim()) {
      Taro.showToast({
        title: tt('devEnter.n8nModel.nameRequired', '请输入智能体名称'),
        icon: 'none',
      })
      return false
    }
    if (!description.trim()) {
      Taro.showToast({
        title: tt('devEnter.n8nModel.descRequired', '请输入智能体描述'),
        icon: 'none',
      })
      return false
    }
    return true
  }

  const onSubmit = async () => {
    if (submitting) return
    if (!validate()) return
    setSubmitting(true)
    const formData = {
      agentName: name.trim(),
      agentDescription: description.trim(),
      agentAvatar: avatar,
      agentUrl: n8nUrl.trim(),
      agentN8nJson: n8nFileData,
      agentVariablesIn: JSON.stringify(
        inputParams.map((p) => ({
          parameterName: p.name.trim(),
          type: p.type,
          parameterDescription: p.description.trim(),
          Default: p.defaultValue,
        })),
      ),
      agentVariablesOut: JSON.stringify(
        outputParams.map((p) => ({
          parameterName: p.name.trim(),
          type: p.type,
          parameterDescription: p.description.trim(),
          Default: p.defaultValue,
        })),
      ),
    }
    try {
      await post('/developer/n8n-agents', formData)
      Taro.showToast({
        title: tt('devEnter.n8nModel.createSuccess', '智能体创建成功'),
        icon: 'success',
      })
    } catch (e) {
      logger.error('n8n-model', '创建N8N智能体', e)
      Taro.showToast({
        title: tt('devEnter.n8nModel.mockSuccess', '接口暂未开放,已模拟创建'),
        icon: 'success',
      })
    } finally {
      setSubmitting(false)
      setTimeout(() => {
        setView('list')
        loadList()
      }, 1200)
    }
  }

  const renderDefaultInput = (p: Param, which: 'in' | 'out', index: number) => {
    const setVal = (v: string) => updateParam(which, index, { defaultValue: v })
    if (p.type === 'boolean') {
      return (
        <View className="nm-bool">
          {(['true', 'false'] as const).map((v) => (
            <View
              key={v}
              className={`nm-bool-opt ${p.defaultValue === v ? 'nm-bool-active' : ''}`}
              onClick={() => setVal(v)}
            >
              <Text>
                {v === 'true'
                  ? tt('devEnter.n8nModel.booleanTrue', '是')
                  : tt('devEnter.n8nModel.booleanFalse', '否')}
              </Text>
            </View>
          ))}
        </View>
      )
    }
    if (p.type === 'json') {
      return (
        <Textarea
          className="nm-field-textarea"
          value={p.defaultValue}
          placeholder={tt('devEnter.n8nModel.paramDefaultPlaceholder', '请输入默认值')}
          onInput={(e) => setVal(e.detail.value)}
        />
      )
    }
    return (
      <Input
        className="nm-field-input"
        type={p.type === 'number' ? 'digit' : 'text'}
        value={p.defaultValue}
        placeholder={tt('devEnter.n8nModel.paramDefaultPlaceholder', '请输入默认值')}
        onInput={(e) => setVal(e.detail.value)}
      />
    )
  }

  const renderParamList = (params: Param[], which: 'in' | 'out') => (
    <View className="nm-params">
      {params.map((p, index) => (
        <View key={index} className="nm-param">
          <View className="nm-param-head">
            <Text className="nm-param-idx">
              {tt('devEnter.n8nModel.paramPrefix', '参数')} {index + 1}
            </Text>
            {params.length > 1 ? (
              <Text
                className="nm-param-del"
                onClick={() => removeParam(which, index)}
              >
                {tt('devEnter.n8nModel.deleteParam', '删除')}
              </Text>
            ) : null}
          </View>
          <View className="nm-param-field">
            <Text className="nm-field-label">
              {tt('devEnter.n8nModel.paramNameLabel', '参数名称')}
            </Text>
            <Input
              className="nm-field-input"
              value={p.name}
              placeholder={tt('devEnter.n8nModel.paramNamePlaceholder', '请输入参数名称')}
              onInput={(e) => updateParam(which, index, { name: e.detail.value })}
            />
          </View>
          <View className="nm-param-field">
            <Text className="nm-field-label">
              {tt('devEnter.n8nModel.paramDescLabel', '参数描述')}
            </Text>
            <Textarea
              className="nm-field-textarea"
              value={p.description}
              placeholder={tt('devEnter.n8nModel.paramDescPlaceholder', '请输入参数描述')}
              onInput={(e) =>
                updateParam(which, index, { description: e.detail.value })
              }
            />
          </View>
          <View className="nm-param-field">
            <Text className="nm-field-label">
              {tt('devEnter.n8nModel.paramTypeLabel', '键值类型')}
            </Text>
            <View className="nm-type-bar">
              {PARAM_TYPES.map((tp) => (
                <View
                  key={tp.value}
                  className={`nm-type ${p.type === tp.value ? 'nm-type-active' : ''}`}
                  onClick={() =>
                    updateParam(which, index, {
                      type: tp.value,
                      defaultValue: tp.value === 'boolean' ? 'true' : '',
                    })
                  }
                >
                  <Text>{tt(tp.key, tp.fb)}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className="nm-param-field">
            <Text className="nm-field-label">
              {tt('devEnter.n8nModel.paramDefaultLabel', '默认值')}
            </Text>
            {renderDefaultInput(p, which, index)}
          </View>
        </View>
      ))}
      <View className="nm-add-param" onClick={() => addParam(which)}>
        <Text>+ {tt('devEnter.n8nModel.addParam', '添加参数')}</Text>
      </View>
    </View>
  )

  // ===== 列表视图 =====
  if (view === 'list') {
    return (
      <View className="nm-page">
        <View className="nm-header">
          <Text className="nm-title">{t('devEnter.n8nModel.title')}</Text>
          <Text className="nm-create-btn" onClick={onCreate}>
            + {tt('devEnter.n8nModel.create', '新建')}
          </Text>
        </View>
        <View className="nm-content">
          {loading ? (
            <Text className="nm-empty">{t('common.loading')}</Text>
          ) : list.length ? (
            list.map((item) => (
              <View
                key={(item.id as string) || (item.name as string)}
                className="nm-list-item"
                onClick={() => onItemClick(item.id as string)}
              >
                <Text>
                  {(item.name as string) ||
                    (item.title as string) ||
                    t('devEnter.n8nModel.defaultName')}
                </Text>
              </View>
            ))
          ) : (
            <Text className="nm-empty">{t('devEnter.n8nModel.empty')}</Text>
          )}
        </View>
      </View>
    )
  }

  // ===== 创建表单视图 =====
  return (
    <View className="nm-page">
      <View className="nm-header">
        <Text className="nm-back" onClick={() => setView('list')}>
          {t('common.back')}
        </Text>
        <Text className="nm-title">
          {tt('devEnter.n8nModel.createTitle', '创建智能体')}
        </Text>
      </View>
      <ScrollView scrollY className="nm-body">
        {/* 头像 */}
        <Text className="nm-label">
          {tt('devEnter.n8nModel.avatarLabel', '智能体头像')}
        </Text>
        <View className="nm-avatar-wrap" onClick={chooseAvatar}>
          {avatar ? (
            <Image className="nm-avatar" src={avatar} mode="aspectFill" />
          ) : (
            <View className="nm-avatar nm-avatar-ph">
              <Text className="nm-avatar-text">
                {tt('devEnter.n8nModel.avatarPlaceholder', '点击上传头像')}
              </Text>
            </View>
          )}
        </View>

        {/* 名称 */}
        <Text className="nm-label">
          {tt('devEnter.n8nModel.nameLabel', '智能体名称')}
        </Text>
        <Input
          className="nm-input"
          maxlength={30}
          value={name}
          placeholder={tt('devEnter.n8nModel.namePlaceholder', '请输入智能体名称')}
          onInput={(e) => setName(e.detail.value)}
        />

        {/* 描述 */}
        <Text className="nm-label">
          {tt('devEnter.n8nModel.descLabel', '智能体描述')}
        </Text>
        <Textarea
          className="nm-textarea"
          value={description}
          placeholder={tt('devEnter.n8nModel.descPlaceholder', '请输入智能体描述')}
          onInput={(e) => setDescription(e.detail.value)}
        />

        {/* n8n 备份文件 */}
        <Text className="nm-label">
          {tt('devEnter.n8nModel.n8nFileLabel', 'n8n 备份文件')}
        </Text>
        <View className="nm-file-btn" onClick={chooseN8nFile}>
          <Text className="nm-file-text">
            {n8nFileName ||
              tt(
                'devEnter.n8nModel.n8nFilePlaceholder',
                '点击上传 n8n 备份 JSON 文件',
              )}
          </Text>
        </View>
        {n8nFileName ? (
          <View className="nm-file-info">
            <Text className="nm-file-name">{n8nFileName}</Text>
            <Text className="nm-file-remove" onClick={removeN8nFile}>
              {t('common.delete')}
            </Text>
          </View>
        ) : null}

        {/* n8n 地址 */}
        <Text className="nm-label">
          {tt('devEnter.n8nModel.n8nUrlLabel', 'n8n 地址')}
        </Text>
        <Input
          className="nm-input"
          maxlength={200}
          value={n8nUrl}
          placeholder={tt('devEnter.n8nModel.n8nUrlPlaceholder', '请输入 n8n 地址')}
          onInput={(e) => setN8nUrl(e.detail.value)}
        />

        {/* 输入参数 */}
        <Text className="nm-label">
          {tt('devEnter.n8nModel.inputParamsLabel', '输入参数')}
        </Text>
        {renderParamList(inputParams, 'in')}

        {/* 输出参数 */}
        <Text className="nm-label">
          {tt('devEnter.n8nModel.outputParamsLabel', '输出参数')}
        </Text>
        {renderParamList(outputParams, 'out')}

        {/* 提交 */}
        <View
          className={`nm-submit ${submitting ? 'nm-submit-disabled' : ''}`}
          onClick={onSubmit}
        >
          <Text>
            {submitting
              ? tt('devEnter.n8nModel.submitting', '创建中…')
              : tt('devEnter.n8nModel.submit', '创建智能体')}
          </Text>
        </View>
        <View className="nm-bottom-space" />
      </ScrollView>
    </View>
  )
}
