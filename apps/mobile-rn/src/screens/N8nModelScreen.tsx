// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  createN8nWorkflow,
  getN8nWorkflows,
  toggleN8nWorkflow,
  updateN8nWorkflow,
  type N8nWorkflow,
} from '@ihui/api-client'
import {
  N8nModelScreen as SharedN8nModelScreen,
  type N8nModelItem,
  type N8nModelTab,
} from '@ihui/rn-app'
import { Zap, PauseCircle } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ViewMode = 'shared' | 'local'

type FormMode = 'create' | 'edit'

function toNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function toString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function mapWorkflow(w: N8nWorkflow): N8nModelItem {
  return {
    id: w.id,
    name: w.name,
    desc: w.description ?? '',
    url: toString(w.url),
    status: w.active ? 'running' : 'stopped',
    calls: toNumber(w.calls),
    updatedAt: w.updatedAt ?? w.createdAt ?? '',
    paramsIn: toNumber(w.paramsIn),
    paramsOut: toNumber(w.paramsOut),
  }
}

/** N8nWorkflow → ModelListItem(简化版 ModelList 渲染,固定 1 个 vendor 分组) */
function toModelListItem(w: N8nWorkflow): ModelListItem {
  const isActive = Boolean(w.active)
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? '',
    icon: isActive ? Zap : PauseCircle,
    isFree: true,
  }
}

function buildModelGroup(items: N8nWorkflow[]): ModelListGroup[] {
  return [{ vendor: 'n8n 工作流', models: items.map(toModelListItem) }]
}

export default function N8nModelScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [viewMode, setViewMode] = useState<ViewMode>('shared')
  const [tab, setTab] = useState<N8nModelTab>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<N8nModelItem[]>([])
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [formVisible, setFormVisible] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [formId, setFormId] = useState('')
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getN8nWorkflows()
      if (res.success) {
        const list = res.data?.list ?? []
        setItems(list.map(mapWorkflow))
        setWorkflows(list)
      } else {
        setError(res.error || t('n8nModel.loadFailed'))
      }
    } catch {
      setError(t('n8nModel.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const handleToggle = (m: N8nModelItem) => {
    const wf = workflows.find((w) => w.id === m.id)
    const isActive = wf ? Boolean(wf.active) : m.status === 'running'
    Alert.alert(
      isActive ? t('n8nModel.toggle.stopTitle') : t('n8nModel.toggle.startTitle'),
      isActive
        ? t('n8nModel.toggle.stopMessage', { name: m.name })
        : t('n8nModel.toggle.startMessage', { name: m.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              const res = await toggleN8nWorkflow(m.id, !isActive)
              if (res.success) {
                Alert.alert(t('common.hint'), t('n8nModel.toggle.success'))
                await load()
              } else {
                Alert.alert(t('common.hint'), res.error || t('n8nModel.toggle.failed'))
              }
            } catch {
              Alert.alert(t('common.hint'), t('n8nModel.operationFailed'))
            }
          },
        },
      ],
    )
  }

  const openEdit = (m: N8nModelItem) => {
    setFormMode('edit')
    setFormId(m.id)
    setFormName(m.name)
    setFormDesc(m.desc ?? '')
    setFormSubmitting(false)
    setFormVisible(true)
  }

  const openCreate = () => {
    setFormMode('create')
    setFormId('')
    setFormName('')
    setFormDesc('')
    setFormSubmitting(false)
    setFormVisible(true)
  }

  const handleFormSubmit = async () => {
    const name = formName.trim()
    if (!name) {
      Alert.alert(t('common.hint'), t('n8nModel.nameRequired'))
      return
    }
    setFormSubmitting(true)
    try {
      const input: Partial<N8nWorkflow> = { name, description: formDesc.trim() || undefined }
      const res =
        formMode === 'create'
          ? await createN8nWorkflow(input)
          : await updateN8nWorkflow(formId, input)
      if (res.success) {
        setFormVisible(false)
        Alert.alert(
          t('common.hint'),
          formMode === 'create' ? t('n8nModel.createSuccess') : t('n8nModel.editSuccess'),
        )
        await load()
        if (formMode === 'create' && res.data?.id) {
          setSelectedIds([res.data.id])
        }
      } else {
        Alert.alert(t('common.hint'), res.error || t('n8nModel.operationFailed'))
      }
    } catch {
      Alert.alert(t('common.hint'), t('n8nModel.operationFailed'))
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleEdit = (m: N8nModelItem) => {
    openEdit(m)
  }

  const handleCreate = () => {
    openCreate()
  }

  const modelGroups = useMemo<ModelListGroup[]>(() => buildModelGroup(workflows), [workflows])

  return (
    <View style={styles.shell}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'shared' && styles.tabActive]}
          onPress={() => setViewMode('shared')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'shared' ? styles.tabTextActive : styles.tabText}>工作流</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'local' && styles.tabActive]}
          onPress={() => setViewMode('local')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'local' ? styles.tabTextActive : styles.tabText}>列表视图</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.viewport}>
        {viewMode === 'shared' ? (
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
            onRefresh={onRefresh}
            onRetry={() => void load()}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onCreate={handleCreate}
            onBack={() => navigation.goBack()}
          />
        ) : (
          <ModelList
            groups={modelGroups}
            selectionMode="single"
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
          />
        )}
      </View>
      <WorkflowFormModal
        visible={formVisible}
        title={formMode === 'create' ? t('n8nModel.createTitle') : t('n8nModel.editTitle')}
        name={formName}
        desc={formDesc}
        submitting={formSubmitting}
        onChangeName={setFormName}
        onChangeDesc={setFormDesc}
        onCancel={() => setFormVisible(false)}
        onConfirm={handleFormSubmit}
      />
    </View>
  )
}

interface WorkflowFormModalProps {
  visible: boolean
  title: string
  name: string
  desc: string
  submitting: boolean
  onChangeName: (value: string) => void
  onChangeDesc: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

function WorkflowFormModal({
  visible,
  title,
  name,
  desc,
  submitting,
  onChangeName,
  onChangeDesc,
  onCancel,
  onConfirm,
}: WorkflowFormModalProps) {
  const { t } = useI18n()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalMask}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalLabel}>{t('n8nModel.nameLabel')}</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={onChangeName}
            placeholder={t('n8nModel.namePlaceholder')}
            placeholderTextColor={tokens.text.tertiary}
          />
          <Text style={styles.modalLabel}>{t('n8nModel.descLabel')}</Text>
          <TextInput
            style={[styles.modalInput, styles.modalInputMultiline]}
            value={desc}
            onChangeText={onChangeDesc}
            placeholder={t('n8nModel.descPlaceholder')}
            placeholderTextColor={tokens.text.tertiary}
            multiline
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel]}
              onPress={onCancel}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnTextCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                styles.modalBtnConfirm,
                submitting && styles.modalBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={tokens.surface.light} />
              ) : (
                <Text style={styles.modalBtnTextConfirm}>{t('common.confirm')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: rpx(24),
    paddingTop: rpx(96),
    paddingBottom: rpx(16),
    gap: rpx(16),
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: rpx(28),
    paddingVertical: rpx(12),
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  tabActive: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  tabText: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  tabTextActive: {
    fontSize: 13,
    color: tokens.surface.light,
    fontWeight: '600',
  },
  viewport: {
    flex: 1,
  },
  modalMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    justifyContent: 'center',
    paddingHorizontal: rpx(40),
  },
  modalCard: {
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: rpx(28),
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
    marginBottom: rpx(20),
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13,
    color: tokens.text.secondary,
    marginBottom: rpx(8),
  },
  modalInput: {
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 8,
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(12),
    fontSize: 14,
    color: tokens.text.primary,
    backgroundColor: tokens.surface.muted,
    marginBottom: rpx(16),
  },
  modalInputMultiline: {
    minHeight: rpx(88),
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: rpx(16),
    marginTop: rpx(8),
  },
  modalBtn: {
    flex: 1,
    height: rpx(88),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: tokens.surface.muted,
  },
  modalBtnConfirm: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalBtnTextCancel: {
    fontSize: 15,
    color: tokens.text.secondary,
  },
  modalBtnTextConfirm: {
    fontSize: 15,
    color: tokens.surface.light,
    fontWeight: '600',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
