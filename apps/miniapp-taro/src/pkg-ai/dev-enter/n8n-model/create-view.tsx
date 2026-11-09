// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 宿主模块:承接 n8n 模型页的创建富表单(头像 / n8n 备份 JSON / n8n 地址 / 输入出参数 / 提交),
// 该段为小程序独有(RN 的 WorkflowFormModal 只有名称+描述 2 字段,非同构,不上收共享屏)。

import type { ReactNode } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import type { TtFn } from '@/i18n'
import { FocusInput, FocusTextarea } from '@/components/FocusField'
import ThemeRoot from '@/components/ThemeRoot'
import { useUiField } from '@/lib/ui-field-registry'

type ParamType = 'string' | 'number' | 'boolean' | 'file' | 'select' | 'json'

export interface Param {
  name: string
  description: string
  type: ParamType
  defaultValue: string
}

const PARAM_TYPES = (tt: TtFn): { value: ParamType; key: string; fb: string }[] => [
  { value: 'string', key: 'aigc.list.catText', fb: tt('aigc.list.catText', '文本') },
  { value: 'number', key: 'deventerN8nmodel.d1', fb: tt('deventerN8nmodel.d1', '数字') },
  { value: 'boolean', key: 'deventerN8nmodel.d2', fb: tt('deventerN8nmodel.d2', '布尔') },
  { value: 'file', key: 'search.tabs.files', fb: tt('search.tabs.files', '文件') },
  { value: 'select', key: 'deventerN8nmodel.d3', fb: tt('deventerN8nmodel.d3', '选择') },
  { value: 'json', key: 'devEnter.n8nModel.typeJson', fb: 'JSON' },
]

export const newParam = (): Param => ({
  name: '',
  description: '',
  type: 'string',
  defaultValue: '',
})

type TFunc = (key: string, params?: Record<string, string | number>) => string

export interface CreateViewProps {
  t: TFunc
  tt: TtFn
  avatar: string
  name: string
  description: string
  n8nFileName: string
  n8nUrl: string
  inputParams: Param[]
  outputParams: Param[]
  submitting: boolean
  onChooseAvatar: () => void
  onChooseFile: () => void
  onRemoveFile: () => void
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onN8nUrlChange: (value: string) => void
  onUpdateParam: (which: 'in' | 'out', index: number, patch: Partial<Param>) => void
  onAddParam: (which: 'in' | 'out') => void
  onRemoveParam: (which: 'in' | 'out', index: number) => void
  onSubmit: () => void
}

/**
 * 创建表单的登记壳(2026-11 从 n8n-model/index.tsx 逐字迁入):三个文本字段交出
 * 与输入事件同源的 setter;提交动作不可撤回 ⇒ 不注册 submit,由用户自己点。
 */
export function CreateView(props: CreateViewProps): ReactNode {
  const {
    tt,
    name,
    description,
    n8nUrl,
    onNameChange: setName,
    onDescriptionChange: setDescription,
    onN8nUrlChange: setN8nUrl,
  } = props
  useUiField({
    kind: 'input',
    label: tt('devEnter.n8nModel.nameLabel', '智能体名称'),
    placeholder: tt('devEnter.n8nModel.namePlaceholder', '请输入智能体名称'),
    readValue: () => name,
    setValue: setName,
  })
  useUiField({
    kind: 'textarea',
    label: tt('devEnter.n8nModel.descLabel', '智能体描述'),
    placeholder: tt('devEnter.n8nModel.descPlaceholder', '请输入智能体描述'),
    readValue: () => description,
    setValue: setDescription,
  })
  useUiField({
    kind: 'input',
    label: tt('devEnter.n8nModel.n8nUrlLabel', 'n8n 地址'),
    placeholder: tt('devEnter.n8nModel.n8nUrlPlaceholder', '请输入 n8n 地址'),
    readValue: () => n8nUrl,
    setValue: setN8nUrl,
  })
  return renderCreateView(props)
}

function renderCreateView(props: CreateViewProps): ReactNode {
  const {
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
    onSubmit,
  } = props

  const renderDefaultInput = (p: Param, which: 'in' | 'out', index: number) => {
    const setVal = (v: string) => updateParam(which, index, { defaultValue: v })
    if (p.type === 'boolean') {
      return (
        <ThemeRoot>
          <View className="nm-bool">
            {(['true', 'false'] as const).map((v) => (
              <View
                key={v}
                className={`nm-bool-opt ${p.defaultValue === v ? 'nm-bool-active' : ''}`}
                onClick={() => setVal(v)}
                hoverClass="opacity-60"
              >
                <Text>
                  {v === 'true'
                    ? tt('devEnter.n8nModel.booleanTrue', '是')
                    : tt('devEnter.n8nModel.booleanFalse', '否')}
                </Text>
              </View>
            ))}
          </View>
        </ThemeRoot>
      )
    }
    if (p.type === 'json') {
      return (
        <ThemeRoot>
          <FocusTextarea
            className="nm-field-textarea"
            placeholderClass="text-[var(--color-text-tertiary)]"
            value={p.defaultValue}
            placeholder={tt('devEnter.n8nModel.paramDefaultPlaceholder', '请输入默认值')}
            onInput={(e) => setVal(e.detail.value)}
          />
        </ThemeRoot>
      )
    }
    return (
      <ThemeRoot>
        <FocusInput
          className="nm-field-input"
          placeholderClass="text-[var(--color-text-tertiary)]"
          type={p.type === 'number' ? 'digit' : 'text'}
          value={p.defaultValue}
          placeholder={tt('devEnter.n8nModel.paramDefaultPlaceholder', '请输入默认值')}
          onInput={(e) => setVal(e.detail.value)}
        />
      </ThemeRoot>
    )
  }

  const renderParamList = (params: Param[], which: 'in' | 'out') => (
    <ThemeRoot>
      <View className="nm-params">
        {params.map((p, index) => (
          <View key={index} className="nm-param">
            <View className="nm-param-head">
              <Text className="nm-param-idx">
                {tt('devEnter.n8nModel.paramPrefix', '参数')} {index + 1}
              </Text>
              {params.length > 1 ? (
                <Text className="nm-param-del" onClick={() => removeParam(which, index)}>
                  {tt('devEnter.n8nModel.deleteParam', '删除')}
                </Text>
              ) : null}
            </View>
            <View className="nm-param-field">
              <Text className="nm-field-label">
                {tt('devEnter.n8nModel.paramNameLabel', '参数名称')}
              </Text>
              <FocusInput
                className="nm-field-input"
                placeholderClass="text-[var(--color-text-tertiary)]"
                value={p.name}
                placeholder={tt('devEnter.n8nModel.paramNamePlaceholder', '请输入参数名称')}
                onInput={(e) => updateParam(which, index, { name: e.detail.value })}
              />
            </View>
            <View className="nm-param-field">
              <Text className="nm-field-label">
                {tt('devEnter.n8nModel.paramDescLabel', '参数描述')}
              </Text>
              <FocusTextarea
                className="nm-field-textarea"
                placeholderClass="text-[var(--color-text-tertiary)]"
                value={p.description}
                placeholder={tt('devEnter.n8nModel.paramDescPlaceholder', '请输入参数描述')}
                onInput={(e) => updateParam(which, index, { description: e.detail.value })}
              />
            </View>
            <View className="nm-param-field">
              <Text className="nm-field-label">
                {tt('devEnter.n8nModel.paramTypeLabel', '键值类型')}
              </Text>
              <View className="nm-type-bar">
                {PARAM_TYPES(tt).map((tp) => (
                  <View
                    key={tp.value}
                    className={`nm-type ${p.type === tp.value ? 'nm-type-active' : ''}`}
                    onClick={() =>
                      updateParam(which, index, {
                        type: tp.value,
                        defaultValue: tp.value === 'boolean' ? 'true' : '',
                      })
                    }
                    hoverClass="opacity-60"
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
        <View className="nm-add-param" onClick={() => addParam(which)} hoverClass="opacity-60">
          <Text>+ {tt('devEnter.n8nModel.addParam', '添加参数')}</Text>
        </View>
      </View>
    </ThemeRoot>
  )

  // 根容器由页面提供(ThemeRoot className="nm-page"),本模块只产出页内内容,避免双重根节点
  return (
    <>
      <View className="nm-header">
        <Text className="nm-title">{tt('devEnter.n8nModel.createTitle', '创建智能体')}</Text>
      </View>
      <ScrollView scrollY className="nm-body">
        {/* 头像 */}
        <Text className="nm-label">{tt('devEnter.n8nModel.avatarLabel', '智能体头像')}</Text>
        <View className="nm-avatar-wrap" onClick={chooseAvatar} hoverClass="opacity-60">
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
        <Text className="nm-label">{tt('devEnter.n8nModel.nameLabel', '智能体名称')}</Text>
        <FocusInput
          className="nm-input"
          placeholderClass="text-[var(--color-text-tertiary)]"
          maxlength={30}
          value={name}
          placeholder={tt('devEnter.n8nModel.namePlaceholder', '请输入智能体名称')}
          onInput={(e) => setName(e.detail.value)}
        />

        {/* 描述 */}
        <Text className="nm-label">{tt('devEnter.n8nModel.descLabel', '智能体描述')}</Text>
        <FocusTextarea
          className="nm-textarea"
          placeholderClass="text-[var(--color-text-tertiary)]"
          value={description}
          placeholder={tt('devEnter.n8nModel.descPlaceholder', '请输入智能体描述')}
          onInput={(e) => setDescription(e.detail.value)}
        />

        {/* n8n 备份文件 */}
        <Text className="nm-label">{tt('devEnter.n8nModel.n8nFileLabel', 'n8n 备份文件')}</Text>
        <View className="nm-file-btn" onClick={chooseN8nFile} hoverClass="opacity-60">
          <Text className="nm-file-text">
            {n8nFileName ||
              tt('devEnter.n8nModel.n8nFilePlaceholder', '点击上传 n8n 备份 JSON 文件')}
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
        <Text className="nm-label">{tt('devEnter.n8nModel.n8nUrlLabel', 'n8n 地址')}</Text>
        <FocusInput
          className="nm-input"
          placeholderClass="text-[var(--color-text-tertiary)]"
          maxlength={200}
          value={n8nUrl}
          placeholder={tt('devEnter.n8nModel.n8nUrlPlaceholder', '请输入 n8n 地址')}
          onInput={(e) => setN8nUrl(e.detail.value)}
        />

        {/* 输入参数 */}
        <Text className="nm-label">{tt('devEnter.n8nModel.inputParamsLabel', '输入参数')}</Text>
        {renderParamList(inputParams, 'in')}

        {/* 输出参数 */}
        <Text className="nm-label">{tt('devEnter.n8nModel.outputParamsLabel', '输出参数')}</Text>
        {renderParamList(outputParams, 'out')}

        {/* 提交 */}
        <View
          className={`nm-submit ${submitting ? 'nm-submit-disabled' : ''}`}
          onClick={onSubmit}
          hoverClass="opacity-60"
        >
          <Text>
            {submitting
              ? tt('devEnter.n8nModel.submitting', '创建中…')
              : tt('devEnter.n8nModel.submit', '创建智能体')}
          </Text>
        </View>
        <View className="nm-bottom-space" />
      </ScrollView>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
