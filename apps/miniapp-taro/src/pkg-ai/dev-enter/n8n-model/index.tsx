// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/n8n-model/N8nModelScreen.tsx（n8n 模型列表共享屏）

import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import { get, post } from '@/api'
import { chooseImages, uploadImage } from '@/utils/upload-image'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  N8nModelScreen as SharedN8nModelScreen,
  type N8nModelItem,
  type N8nModelTab,
} from '@ihui/rn-app/features/n8n-model/N8nModelScreen'
import { newParam, renderCreateView, type Param } from './create-view'
import './index.css'
import { onToast } from '@/host/on-toast'

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
  const tt = useTt()
  const { resolvedTheme } = useTheme()

  const [view, setView] = useState<'list' | 'create'>('list')
  // 列表态
  const [items, setItems] = useState<N8nModelItem[]>([])
  const [tab, setTab] = useState<N8nModelTab>('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
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
  // AI 操控通道(2026-09-21):创建视图的三个固定输入框把**自己已绑定的 setter**交给端内注册表,
  // 用户键盘输入走同一个 setter,故 AI 写入必然反映到界面。仅在 create 视图登记(list 视图不注册,
  // 免得快照里出现看不见的控件)。参数行(参数名称/描述/默认值)在 params.map 内渲染、行数可变,
  // hook 不能进循环 —— 需先抽 ParamRow 组件(改 JSX)才能接入,本轮不注册。
  useUiField(
    view === 'create'
      ? {
          kind: 'input',
          label: tt('devEnter.n8nModel.nameLabel', '智能体名称'),
          placeholder: tt('devEnter.n8nModel.namePlaceholder', '请输入智能体名称'),
          readValue: () => name,
          setValue: setName,
        }
      : null,
  )
  useUiField(
    view === 'create'
      ? {
          kind: 'textarea',
          label: tt('devEnter.n8nModel.descLabel', '智能体描述'),
          placeholder: tt('devEnter.n8nModel.descPlaceholder', '请输入智能体描述'),
          readValue: () => description,
          setValue: setDescription,
        }
      : null,
  )
  useUiField(
    view === 'create'
      ? {
          kind: 'input',
          label: tt('devEnter.n8nModel.n8nUrlLabel', 'n8n 地址'),
          placeholder: tt('devEnter.n8nModel.n8nUrlPlaceholder', '请输入 n8n 地址'),
          readValue: () => n8nUrl,
          setValue: setN8nUrl,
        }
      : null,
  )

  /** 原始行 → 共享屏列表项。后端 GET /workflows/n8n 只回 id/name/active/updatedAt,
   *  契约里没有 calls/paramsIn/paramsOut;端内补 0 保持字段必填的"真 0"语义,
   *  计数两行由显式 showStatistics={false} 关闭。 */
  const loadList = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const res = (await get('/workflows/n8n')) as { list?: Record<string, unknown>[] }
        const rows = res?.list ?? []
        setItems(
          rows.map((raw): N8nModelItem => ({
            id: String(raw.id ?? ''),
            name: String(raw.name ?? raw.title ?? ''),
            desc: String(raw.description ?? raw.desc ?? ''),
            url: '',
            status: raw.active === true ? 'running' : 'stopped',
            calls: 0,
            updatedAt: String(raw.updatedAt ?? raw.createTime ?? ''),
            paramsIn: 0,
            paramsOut: 0,
          })),
        )
      } catch (e) {
        logger.error('n8n-model', '加载N8N智能体', e)
        setError(tt('common.operationFailed', '操作失败'))
      } finally {
        if (mode === 'refresh') setRefreshing(false)
        else setLoading(false)
      }
    },
    [tt],
  )

  useDidShow(() => {
    if (view === 'list') void loadList()
  })

  const onItemClick = (id: string) => {
    Taro.navigateTo({ url: `/pkg-ai/ai-assistant-n8n/index?id=${id}` })
  }

  /** 启停:复用 n8n 面唯一存在的启停端点(与 RN toggleN8nWorkflow 同一条腿,后端回读真值) */
  const onToggleStatus = async (item: N8nModelItem) => {
    if (!item.id) return
    try {
      await post(`/ai/n8n/workflows/${item.id}/toggle`, { active: item.status !== 'running' })
      await loadList()
    } catch (e) {
      logger.error('n8n-model', '切换n8n工作流状态', e)
      onToast(tt('common.operationFailed', '操作失败'), { kind: 'error' })
    }
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
        onToast(tt('devEnter.n8nModel.fileSizeExceeded', '文件不能超过10MB'), { kind: 'error' })
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
        if (wf.settings?.description && !description) setDescription(wf.settings.description)
        onToast(tt('devEnter.n8nModel.n8nFileParseSuccess', '文件解析成功'), { kind: 'success' })
      } catch {
        onToast(tt('devEnter.n8nModel.n8nFileParseFailed', 'JSON 文件格式错误'), { kind: 'error' })
        setN8nFileName('')
        setN8nFileData(null)
      }
    } catch (err) {
      const msg = String((err as { errMsg?: string })?.errMsg || '')
      if (!msg.includes('cancel')) {
        onToast(tt('devEnter.n8nModel.n8nFileReadFailed', '读取文件失败'), { kind: 'error' })
      }
    }
  }

  const removeN8nFile = () => {
    setN8nFileName('')
    setN8nFileData(null)
    onToast(tt('devEnter.n8nModel.n8nFileRemoved', '已删除文件'), { kind: 'success' })
  }

  const updateParam = (which: 'in' | 'out', index: number, patch: Partial<Param>) => {
    const setter = which === 'in' ? setInputParams : setOutputParams
    setter((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
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
      onToast(tt('devEnter.n8nModel.nameRequired', '请输入智能体名称'), { kind: 'info' })
      return false
    }
    if (!description.trim()) {
      onToast(tt('devEnter.n8nModel.descRequired', '请输入智能体描述'), { kind: 'info' })
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
      // 真身 = miniapp-compat 的 POST /workflows/n8n/create(api/index.ts 里的 createN8nAgent 同一腿);
      // 旧写法 /developer/n8n-agents 全仓零注册,而 catch 还把失败念成"已模拟创建"
      await post('/workflows/n8n/create', formData)
      onToast(tt('devEnter.n8nModel.createSuccess', '智能体创建成功'), { kind: 'success' })
    } catch (e) {
      logger.error('n8n-model', '创建N8N智能体', e)
      onToast(tt('common.operationFailed', '操作失败'), { kind: 'error' })
    } finally {
      setSubmitting(false)
      setTimeout(() => {
        setView('list')
        void loadList()
      }, 1200)
    }
  }

  const createViewNode =
    view === 'create'
      ? renderCreateView({
          t,
          tt,
          avatar,
          name,
          description,
          n8nFileName,
          n8nUrl,
          inputParams,
          outputParams,
          submitting,
          onChooseAvatar: chooseAvatar,
          onChooseFile: chooseN8nFile,
          onRemoveFile: removeN8nFile,
          onNameChange: setName,
          onDescriptionChange: setDescription,
          onN8nUrlChange: setN8nUrl,
          onUpdateParam: updateParam,
          onAddParam: addParam,
          onRemoveParam: removeParam,
          onSubmit: () => void onSubmit(),
        })
      : null

  return (
    <ThemeRoot className="nm-page">
      {view === 'create' ? (
        createViewNode
      ) : (
        <SharedN8nModelScreen
          t={t}
          items={items}
          tab={tab}
          keyword={keyword}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onSelectTab={setTab}
          onKeywordChange={setKeyword}
          onRefresh={() => void loadList('refresh')}
          onRetry={() => void loadList()}
          onToggle={(it) => void onToggleStatus(it)}
          onEdit={(it) => onItemClick(it.id)}
          onCreate={onCreate}
          onBack={() => Taro.navigateBack()}
          onOpen={(it) => onItemClick(it.id)}
          colorScheme={resolvedTheme}
          showStatistics={false}
        />
      )}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
