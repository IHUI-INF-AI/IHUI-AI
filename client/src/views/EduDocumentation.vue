<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'

const { t } = useI18n()

/**
 * 全项目文档统一查看器（/docs）
 *
 * @description 支持通过 query.doc 加载不同文档，文档中心等入口均跳转至此页查看完整内容
 */
import { ref, onMounted, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { useLegalDocContent } from '@/composables/useLegalDocContent'
import { useAuthStore } from '@/stores/auth'
import { uploadDocument, uploadOriginalDocument, getDocList, deleteDocument, updateDocument, type DocListItem } from '@/api/learn/docs'
import { convertToMarkdown } from '@/utils/fileConverter'
import { formatTimeDistance } from '@/utils/time-utils'
import { ElMessage, ElMessageBox } from 'element-plus'
import DocViewer from '@/components/DocViewer.vue'
/** 7.1 包体优化：文档预览器与 vue-office 按需加载，仅在实际渲染 Word/Excel/PPT 时拉取 */
const InlineOfficeViewer = defineAsyncComponent(() => import('@/components/viewers/InlineOfficeViewer.vue'))
import { getFileType, getCodeLanguage } from '@/utils/fileTypes'
import { highlightCode } from '@/utils/highlight'
import { formatFileSize } from '@/utils/format'
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const ADMIN_PHONE = '18643389808'
const isAdmin = computed(() => {
  // 从 authStore 获取
  const authPhone = (authStore.user?.phone || '').replace(/[\s+-]/g, '')
  const authRoles = authStore.user?.roles || []

  // 从 StorageManager 获取
  let localPhone = ''
  let localRoles: string[] = []
  let authInfoPhone = ''
  try {
    const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    if (userData) {
      localPhone = ((userData.phone as string) || '').replace(/[\s+-]/g, '')
      localRoles = (userData.roles as string[]) || []
      // 检查 authInfo.phone（可能是管理员手机号）
      authInfoPhone = ((userData.authInfo as Record<string, unknown>)?.phone as string || '').replace(/[\s+-]/g, '')
    }
  } catch {
    // 忽略解析错误
  }

  // 合并检查：任一来源匹配即可
  const phones = [authPhone, localPhone, authInfoPhone].filter(p => p)
  const roles = [...authRoles, ...localRoles]

  return phones.some(phone =>
    phone === ADMIN_PHONE || phone.endsWith(ADMIN_PHONE)
  ) || roles.includes('admin')
})

const showUploadDialog = ref(false)
const uploadLoading = ref(false)
const uploadFile = ref<File | null>(null)
const uploadCategory = ref('用户 · 快速开始')
const docCategories = [
  '教育',
  '用户 · 快速开始',
  '用户 · 功能使用',
  '用户 · 使用指南',
  '用户 · 常见问题',
  '开发者 · 激励计划',
  '开发者 · 快速开始',
  '开发者 · API 文档',
  '开发者 · SDK 文档',
  '开发者 · 集成指南',
  '开发者 · 其他',
  '条款与政策',
  '企业服务',
]

/** 文档分类中文值到 i18n key 的映射（category 值保持中文以兼容后端，显示时用 t() 翻译） */
const CATEGORY_I18N_KEY_MAP: Record<string, string> = {
  '教育': 'eduDoc.category.education',
  '用户 · 快速开始': 'eduDoc.category.userQuickStart',
  '用户 · 功能使用': 'eduDoc.category.userFeatures',
  '用户 · 使用指南': 'eduDoc.category.userGuide',
  '用户 · 常见问题': 'eduDoc.category.userFaq',
  '开发者 · 激励计划': 'eduDoc.category.devIncentive',
  '开发者 · 快速开始': 'eduDoc.category.devQuickStart',
  '开发者 · API 文档': 'eduDoc.category.devApi',
  '开发者 · SDK 文档': 'eduDoc.category.devSdk',
  '开发者 · 集成指南': 'eduDoc.category.devIntegration',
  '开发者 · 其他': 'eduDoc.category.devOther',
  '条款与政策': 'eduDoc.category.termsPolicy',
  '企业服务': 'eduDoc.category.enterprise',
}

/** 获取分类的本地化标签 */
const getCategoryLabel = (category: string): string => {
  const key = CATEGORY_I18N_KEY_MAP[category]
  return key ? t(key) : category
}
const uploadedDocs = ref<DocListItem[]>([])

const showEditDialog = ref(false)
const editDocId = ref('')
const editDocTitle = ref('')
const editDocCategory = ref('')
const editLoading = ref(false)

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    uploadFile.value = target.files[0]
  }
}

const uploadMode = ref<'markdown' | 'original'>('original') // 上传模式：markdown 或 original

// 上传超时（毫秒），超时后强制关闭 loading，避免一直卡在「上传中」
const UPLOAD_TIMEOUT_MS = 100 * 1000

const handleUpload = async () => {
  if (!uploadFile.value) {
    ElMessage.warning(t('hardcoded.edu_documentation.selectFile'))
    return
  }

  uploadLoading.value = true
  try {
    const createdBy = authStore.user?.nickname || authStore.user?.phone || t('eduDoc.admin')
    const fileName = uploadFile.value.name.toLowerCase()

    // 判断是否为 Office 文档或 PDF，这些格式建议保留原文件
    const isOfficeDoc = /\.(pptx?|docx?|xlsx?|pdf)$/i.test(fileName)

    if (uploadMode.value === 'original' || isOfficeDoc) {
      // 保留原文件模式：带超时兜底，防止请求一直挂起导致按钮一直「上传中」
      const uploadPromise = uploadOriginalDocument(
        uploadFile.value,
        uploadCategory.value,
        createdBy
      )
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('UPLOAD_TIMEOUT')), UPLOAD_TIMEOUT_MS)
      })
      const response = await Promise.race([uploadPromise, timeoutPromise])

      if (response.success) {
        showUploadDialog.value = false
        uploadFile.value = null
        await loadUploadedDocs()
        showToc.value = true
        if (response.data?.id) {
          router.replace({ path: route.path, query: { ...route.query, doc: response.data.id } })
        }
        ElMessage.success(
          `${t('hardcoded.edu_documentation.uploadSuccessOriginal')} ${t('hardcoded.edu_documentation.uploadSuccessViewHint')}`
        )
      } else {
        ElMessage.error(response.message || t('hardcoded.edu_documentation.uploadFailed'))
        uploadLoading.value = false
      }
    } else {
      // 转换为 Markdown 模式
      const result = await convertToMarkdown(uploadFile.value)

      if (!result.success) {
        ElMessage.error(result.error || t('hardcoded.edu_documentation.convertFailed'))
        uploadLoading.value = false
        return
      }

      const response = await uploadDocument(
        uploadFile.value,
        uploadCategory.value,
        result.markdown,
        createdBy
      )

      if (response.success) {
        showUploadDialog.value = false
        uploadFile.value = null
        await loadUploadedDocs()
        showToc.value = true
        if (response.data?.id) {
          router.replace({ path: route.path, query: { ...route.query, doc: response.data.id } })
        }
        ElMessage.success(
          `${t('hardcoded.edu_documentation.uploadSuccessMarkdown')} ${t('hardcoded.edu_documentation.uploadSuccessViewHint')}`
        )
      } else {
        ElMessage.error(response.message || t('hardcoded.edu_documentation.uploadFailed'))
        uploadLoading.value = false
      }
    }
  } catch (err) {
    const msg =
      err instanceof Error && err.message === 'UPLOAD_TIMEOUT'
        ? t('hardcoded.edu_documentation.uploadTimeout')
        : t('hardcoded.edu_documentation.uploadRetry')
    ElMessage.error(msg)
    uploadLoading.value = false
  } finally {
    uploadLoading.value = false
  }
}

const loadUploadedDocs = async () => {
  try {
    const response = await getDocList()
    if (response.success && response.data) {
      uploadedDocs.value = response.data
    }
  } catch (_error) {
    // 静默处理
  }
}

interface StoredDoc {
  id: string
  fileType?: string
  fileUrl?: string
  fileData?: string
  markdown?: string
}

const getUploadedDocContent = (docId: string): { type: 'markdown' | 'original'; content: string; fileType?: string; fileUrl?: string; fileData?: string } | null => {
  const storedDocs = StorageManager.getItem<StoredDoc[]>(STORAGE_KEYS.UPLOADED_DOCS) || []
  const doc = storedDocs.find((d) => d.id === docId)
  if (!doc) return null

  // 判断是否为原文件模式（优先使用 fileUrl，如果没有则使用 fileData）
  if ((doc.fileUrl || doc.fileData) && doc.fileType) {
    return {
      type: 'original',
      content: '',
      fileType: doc.fileType,
      fileUrl: doc.fileUrl,
      fileData: doc.fileData
    }
  }

  return {
    type: 'markdown',
    content: doc.markdown || ''
  }
}

const getFileTypeIcon = (fileType?: string): string => {
  if (!fileType) return '📄'
  const type = fileType.toLowerCase()
  if (type === 'pdf') return '📕'
  if (type === 'doc' || type === 'docx') return '📘'
  if (type === 'ppt' || type === 'pptx') return '📙'
  if (type === 'xls' || type === 'xlsx') return '📗'
  if (type === 'md') return '📓'
  return '📄'
}

const getFileTypeFromPath = (path?: string): string | undefined => {
  if (!path) return undefined
  const ext = path.split('.').pop()?.toLowerCase()
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'md'].includes(ext || '')) {
    return ext
  }
  return undefined
}

const openUploadDialog = () => {
  showUploadDialog.value = true
  uploadFile.value = null
}

const handleDeleteDoc = async (doc: { id: string; title: string }) => {
  try {
    await ElMessageBox.confirm(
      t('hardcoded.edu_documentation.deleteConfirm', { title: doc.title }),
      t('hardcoded.edu_documentation.deleteConfirmTitle'),
      {
        confirmButtonText: t('hardcoded.edu_documentation.confirmDelete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const response = await deleteDocument(doc.id)
    if (response.success) {
      uploadedDocs.value = uploadedDocs.value.filter(d => d.id !== doc.id)
      ElMessage.success(t('hardcoded.edu_documentation.deleteSuccess'))
    } else {
      ElMessage.error(t('hardcoded.edu_documentation.deleteFailed'))
    }
  } catch {
    // 用户取消删除
  }
}

const openEditDialog = (doc: { id: string; title: string; category: string }) => {
  editDocId.value = doc.id
  editDocTitle.value = doc.title
  editDocCategory.value = doc.category
  showEditDialog.value = true
}

const handleEditSave = async () => {
  if (!editDocTitle.value.trim()) {
    ElMessage.warning(t('hardcoded.edu_documentation.enterTitle'))
    return
  }

  editLoading.value = true
  try {
    const response = await updateDocument(editDocId.value, {
      title: editDocTitle.value.trim(),
      category: editDocCategory.value,
    })

    if (response.success && response.data) {
      const index = uploadedDocs.value.findIndex(d => d.id === editDocId.value)
      if (index !== -1) {
        uploadedDocs.value[index] = {
          ...uploadedDocs.value[index],
          title: response.data.title,
          category: response.data.category,
        }
      }
      showEditDialog.value = false
      ElMessage.success(t('hardcoded.edu_documentation.updateSuccess'))
    } else {
      ElMessage.error(t('hardcoded.edu_documentation.updateFailed'))
    }
  } finally {
    editLoading.value = false
  }
}

type DocCatalogItem = { id: string; path?: string; title?: string; titleKey?: string; category: string; type?: 'legal' | 'file'; fileUrl?: string; fileType?: 'ppt' | 'pptx' | 'doc' | 'docx' | 'pdf' | 'xls' | 'xlsx' }

/** docId 到 i18n key 的映射（用于动态获取标题，支持语言切换） */
const DOC_I18N_KEY_MAP: Record<string, string> = {
  'user-introduction': 'text.documentation.平台介绍2',
  'user-register': 'text.documentation.注册与登录3',
  'user-profile': 'text.documentation.个人中心4',
  'user-ai-chat': 'text.documentation.AI对话6',
  'user-agents': 'text.documentation.智能体使用7',
  'user-wallet': 'text.documentation.钱包功能8',
  'user-payment': 'text.documentation.支付功能9',
  'user-customer-service': 'text.documentation.客服系统10',
  'user-video-generation': 'text.documentation.视频生成12',
  'user-data-export': 'text.documentation.数据导出13',
  'user-tech-service': 'text.documentation.技术服务预约14',
  'user-faq': 'text.documentation.常见问题15',
  'dev-introduction': 'text.documentation.开发者平台介绍17',
  'dev-setup': 'text.documentation.环境配置18',
  'dev-authentication': 'text.documentation.身份认证19',
  'dev-api-overview': 'text.documentation.API概览21',
  'dev-api-chat': 'text.documentation.对话API22',
  'dev-api-models': 'text.documentation.模型API23',
  'dev-api-agents': 'text.documentation.智能体API24',
  'dev-api-files': 'text.documentation.文件API25',
  'dev-api-error': 'text.documentation.错误处理26',
  'dev-sdk-javascript': 'JavaScript SDK',
  'dev-sdk-python': 'Python SDK',
  'dev-sdk-curl': 'text.documentation.cURL示例28',
  'dev-integration-webhook': 'text.documentation.Webhook集30',
  'dev-integration-oauth': 'text.documentation.OAuth集成31',
  'dev-integration-third-party': 'text.documentation.第三方登录32',
  'dev-best-practices': 'text.documentation.最佳实践33',
  'dev-troubleshooting': 'text.documentation.故障排查34',
  'dev-incentive-overview': 'eduDoc.title.devIncentiveOverview',
  'dev-incentive-publish': 'eduDoc.title.devIncentivePublish',
  'dev-incentive-monetization': 'eduDoc.title.devIncentiveMonetization',
  'dev-incentive-course': 'eduDoc.title.devIncentiveCourse',
  'dev-incentive-platform': 'eduDoc.title.devIncentivePlatform',
}

/** 从 i18n 获取文档标题 */
const getDocTitleFromI18n = (docId: string): string | null => {
  const key = DOC_I18N_KEY_MAP[docId]
  if (!key) return null
  // 如果是 i18n key（text. 或 eduDoc. 前缀），用 t() 翻译；否则视为固定字符串直接返回
  if (key.startsWith('text.') || key.startsWith('eduDoc.')) return t(key)
  return key
}

/** 全站文档目录：与 docTreeData 保持一致，支持按分类分组展示；type=legal 表示条款与政策（从 i18n 渲染） */
const DOC_CATALOG: DocCatalogItem[] = [
  { id: 'project-readme', path: 'project-readme.md', titleKey: 'eduDoc.title.projectReadme', category: '教育' },
  { id: 'edu-platform', path: 'edu-platform-readme.md', titleKey: 'eduDoc.title.eduPlatform', category: '教育' },
  { id: 'user-introduction', path: 'user/getting-started/introduction.md', category: '用户 · 快速开始' },
  { id: 'user-register', path: 'user/getting-started/register.md', category: '用户 · 快速开始' },
  { id: 'user-profile', path: 'user/getting-started/profile.md', category: '用户 · 快速开始' },
  { id: 'user-ai-chat', path: 'user/features/ai-chat.md', category: '用户 · 功能使用' },
  { id: 'user-agents', path: 'user/features/agents.md', category: '用户 · 功能使用' },
  { id: 'user-wallet', path: 'user/features/wallet.md', category: '用户 · 功能使用' },
  { id: 'user-payment', path: 'user/features/payment.md', category: '用户 · 功能使用' },
  { id: 'user-customer-service', path: 'user/features/customer-service.md', category: '用户 · 功能使用' },
  { id: 'user-video-generation', path: 'user/guides/video-generation.md', category: '用户 · 使用指南' },
  { id: 'user-data-export', path: 'user/guides/data-export.md', category: '用户 · 使用指南' },
  { id: 'user-tech-service', path: 'user/guides/tech-service.md', category: '用户 · 使用指南' },
  { id: 'user-faq', path: 'user/faq.md', category: '用户 · 常见问题' },
  { id: 'dev-incentive-overview', path: 'developer/incentive-program/overview.md', category: '开发者 · 激励计划' },
  { id: 'dev-incentive-publish', path: 'developer/incentive-program/publish-guide.md', category: '开发者 · 激励计划' },
  { id: 'dev-incentive-monetization', path: 'developer/incentive-program/monetization.md', category: '开发者 · 激励计划' },
  { id: 'dev-incentive-course', path: 'developer/incentive-program/course.md', category: '开发者 · 激励计划' },
  { id: 'dev-incentive-platform', path: 'developer/incentive-program/platform-intro.md', category: '开发者 · 激励计划' },
  { id: 'dev-introduction', path: 'developer/getting-started/introduction.md', category: '开发者 · 快速开始' },
  { id: 'dev-setup', path: 'developer/getting-started/setup.md', category: '开发者 · 快速开始' },
  { id: 'dev-authentication', path: 'developer/getting-started/authentication.md', category: '开发者 · 快速开始' },
  { id: 'dev-api-overview', path: 'developer/api/overview.md', category: '开发者 · API 文档' },
  { id: 'dev-api-chat', path: 'developer/api/chat.md', category: '开发者 · API 文档' },
  { id: 'dev-api-models', path: 'developer/api/models.md', category: '开发者 · API 文档' },
  { id: 'dev-api-agents', path: 'developer/api/agents.md', category: '开发者 · API 文档' },
  { id: 'dev-api-files', path: 'developer/api/files.md', category: '开发者 · API 文档' },
  { id: 'dev-api-error', path: 'developer/api/error-handling.md', category: '开发者 · API 文档' },
  { id: 'dev-sdk-javascript', path: 'developer/sdk/javascript.md', category: '开发者 · SDK 文档' },
  { id: 'dev-sdk-python', path: 'developer/sdk/python.md', category: '开发者 · SDK 文档' },
  { id: 'dev-sdk-curl', path: 'developer/sdk/curl.md', category: '开发者 · SDK 文档' },
  { id: 'dev-integration-webhook', path: 'developer/integration/webhook.md', category: '开发者 · 集成指南' },
  { id: 'dev-integration-oauth', path: 'developer/integration/oauth.md', category: '开发者 · 集成指南' },
  { id: 'dev-integration-third-party', path: 'developer/integration/third-party-login.md', category: '开发者 · 集成指南' },
  { id: 'dev-best-practices', path: 'developer/best-practices.md', category: '开发者 · 其他' },
  { id: 'dev-troubleshooting', path: 'developer/troubleshooting.md', category: '开发者 · 其他' },
  { id: 'terms-of-service', titleKey: 'legal.termsOfService.title', category: '条款与政策', type: 'legal' },
  { id: 'privacy-policy', titleKey: 'legal.privacyPolicy.title', category: '条款与政策', type: 'legal' },
  { id: 'user-agreement', titleKey: 'legal.userAgreement.title', category: '条款与政策', type: 'legal' },
  { id: 'payment-terms', titleKey: 'legal.paymentTerms.title', category: '条款与政策', type: 'legal' },
  { id: 'enterprise-whitepaper', fileUrl: '/docs/enterprise-service/whitepaper.pptx', fileType: 'pptx', titleKey: 'eduDoc.title.enterpriseWhitepaper', category: '企业服务', type: 'file' },
  { id: 'enterprise-intro', fileUrl: '/docs/enterprise-service/ai-community-intro.pdf', fileType: 'pdf', titleKey: 'eduDoc.title.enterpriseIntro', category: '企业服务', type: 'file' },
  { id: 'enterprise-decision-maker', fileUrl: '/docs/enterprise-service/decision-maker-community.pdf', fileType: 'pdf', titleKey: 'eduDoc.title.enterpriseDecisionMaker', category: '企业服务', type: 'file' },
  { id: 'enterprise-human-ai-collaboration', fileUrl: '/docs/enterprise-service/human-ai-collaboration.pdf', fileType: 'pdf', titleKey: 'eduDoc.title.enterpriseHumanAiCollaboration', category: '企业服务', type: 'file' },
  { id: 'enterprise-agent-scenarios', fileUrl: '/docs/enterprise-service/agent-scenarios.pdf', fileType: 'pdf', titleKey: 'eduDoc.title.enterpriseAgentScenarios', category: '企业服务', type: 'file' },
]

/** 获取文档标题（支持 i18n） */
const getDocTitle = (doc: DocCatalogItem): string => {
  if (doc.titleKey) return t(doc.titleKey)
  if (doc.title) return doc.title
  return getDocTitleFromI18n(doc.id) || doc.id
}

/** 带 i18n 标题的文档列表（computed，响应语言切换） */
const DOC_CATALOG_WITH_I18N = computed(() => {
  const baseDocs = DOC_CATALOG.map((doc) => ({
    ...doc,
    title: getDocTitle(doc),
  }))

  const uploadedDocsItems = uploadedDocs.value.map((doc) => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    path: doc.path || doc.id,
    fileType: doc.fileType,
    createdAt: doc.createdAt,
  }))

  return [...baseDocs, ...uploadedDocsItems]
})

const docIdToPath = new Map(DOC_CATALOG.filter((d) => d.path).map((d) => [d.id, d.path!]))

/** 当前文档 ID */
const currentDocId = computed(() => (route.query.doc as string) || 'edu-platform')

/** 来自文档中心的搜索关键词（用于侧栏过滤与高亮） */
const searchKeyword = computed(() => (route.query.search as string) || '')

/** 是否为条款与政策类法律文档（从 i18n 渲染，不请求 markdown） */
const isLegalDoc = computed(() => DOC_CATALOG.find((d) => d.id === currentDocId.value)?.type === 'legal')

/** 是否为文件类型文档（直接显示原文件） */
const isFileDoc = computed(() => DOC_CATALOG.find((d) => d.id === currentDocId.value)?.type === 'file')

/** 当前文件类型文档的配置 */
const currentFileDoc = computed(() => {
  const doc = DOC_CATALOG.find((d) => d.id === currentDocId.value)
  if (doc?.type === 'file') {
    return doc
  }
  return null
})

/** 判断当前文件是否是 PDF */
const isPdfFile = computed(() => {
  const fileType = currentFileDoc.value?.fileType?.toLowerCase()
  return fileType === 'pdf' || currentFileDoc.value?.fileUrl?.toLowerCase().endsWith('.pdf')
})

/** 判断上传的文件是否是 PDF */
const isUploadedPdf = computed(() => {
  return currentUploadedDoc.value?.fileType?.toLowerCase() === 'pdf'
})

/** 法律文档内容（仅当 docId 为条款与政策时有值） */
const legalDocContent = useLegalDocContent(currentDocId)

/** 按分类分组的文档列表，用于侧栏展示（使用 i18n 标题；有 search 时只显示标题匹配的文档） */
const DOC_CATALOG_GROUPED = computed(() => {
  let docs = DOC_CATALOG_WITH_I18N.value
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    docs = docs.filter((d) => d.title.toLowerCase().includes(kw) || d.id.toLowerCase().includes(kw) || (d.category && d.category.toLowerCase().includes(kw)))
  }
  const groups = new Map<string, typeof docs>()
  for (const doc of docs) {
    const list = groups.get(doc.category) || []
    list.push(doc)
    groups.set(doc.category, list)
  }
  return Array.from(groups.entries()).map(([category, docs]) => ({ category, docs }))
})

/** 当前要加载的文档路径（仅 markdown 类文档） */
const currentDocPath = computed(() => {
  return docIdToPath.get(currentDocId.value) || docIdToPath.get('edu-platform')!
})

/** 当前文档标题，用于展示（支持 i18n） */
const currentDocTitle = computed(() => {
  if (isLegalDoc.value && legalDocContent.value) return legalDocContent.value.title
  const doc = DOC_CATALOG.find((d) => d.id === currentDocId.value)
  return doc ? getDocTitle(doc) : getDocTitle(DOC_CATALOG[0])
})

const goToDoc = (id: string) => {
  router.replace({ path: '/docs', query: { doc: id } })
  if (isMobile.value) {
    closeMobileSidebar()
  }
}

/** 检查文件是否存在（异步） */
const _checkFileExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/** 目录中的 Office 文件是否使用 iframe 嵌入（仅当 URL 公网可访问时为 true） */
const useOfficeIframeForCatalogDoc = computed(() => {
  const doc = currentFileDoc.value
  if (!doc || isPdfFile.value) return false
  const ft = (doc.fileType || doc.fileUrl?.split('.').pop() || '').toLowerCase()
  if (!isOfficeFileType(ft)) return true
  return isOfficeEmbeddableUrl(doc)
})

/** 当前目录文档是否为 PPT 且使用内联预览（用于 article 高度随内容收缩，避免下方大块空白） */
const isCurrentFileDocPpt = computed(() => {
  if (!currentFileDoc.value || useOfficeIframeForCatalogDoc.value) return false
  const ft = (currentFileDoc.value.fileType || currentFileDoc.value.fileUrl?.split('.').pop() || '').toLowerCase()
  return ft === 'ppt' || ft === 'pptx'
})


/** 当前目录文档的原始文件 URL（用于下载） */
const currentFileDocFileUrl = computed(() => {
  const doc = currentFileDoc.value
  if (!doc?.fileUrl) return ''
  return doc.fileUrl.startsWith('http') ? doc.fileUrl : window.location.origin + doc.fileUrl
})

/** 当前目录文档的文件类型信息（用于图片/视频/音频等预览） */
const currentFileDocFileTypeInfo = computed(() => {
  const doc = currentFileDoc.value
  if (!doc) return getFileType('')
  const ext = (doc.fileType || doc.fileUrl?.split('.').pop() || '').toLowerCase()
  return getFileType(ext ? `x.${ext}` : doc.fileUrl || '')
})

/** 当前上传文档的文件类型信息 */
const currentUploadedDocFileTypeInfo = computed(() => {
  const doc = currentUploadedDoc.value
  if (!doc) return getFileType('')
  return getFileType(doc.fileType ? `x.${doc.fileType}` : '')
})

/** 获取文件预览 URL（目录文档；本地/非公网 Office 不返回 embed，避免微软错误页） */
const getFileViewerUrl = (doc: DocCatalogItem): string => {
  if (!doc.fileUrl) return ''

  const fileUrl = doc.fileUrl.startsWith('http') ? doc.fileUrl : window.location.origin + doc.fileUrl
  const fileType = (doc.fileType || doc.fileUrl.split('.').pop() || '').toLowerCase()

  if (isOfficeFileType(fileType) && !isOfficeEmbeddableUrl(doc)) {
    return ''
  }

  switch (fileType) {
    case 'pdf':
      return `https://view.officeapps.live.com/op/embed.aspx?ui=en-US&src=${encodeURIComponent(fileUrl)}`
    case 'ppt':
    case 'pptx':
    case 'doc':
    case 'docx':
    case 'xls':
    case 'xlsx':
      return `https://view.officeapps.live.com/op/embed.aspx?ui=en-US&src=${encodeURIComponent(fileUrl)}`
    default:
      return fileUrl
  }
}

/** 是否为 Office 类型（Word/Excel/PPT，需微软在线预览） */
const isOfficeFileType = (fileType: string) => {
  const t = fileType.toLowerCase()
  return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(t)
}

/** 文件 URL 是否可被微软 Office 在线服务访问（必须为公网可访问地址，否则会显示错误页并产生 404） */
const isOfficeEmbeddableUrl = (doc: { fileUrl?: string; fileData?: string } | null): boolean => {
  if (!doc?.fileUrl) return false
  const fileUrl = doc.fileUrl.startsWith('http') ? doc.fileUrl : window.location.origin + doc.fileUrl
  try {
    const u = new URL(fileUrl)
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/** 当前上传的 Office 文档是否使用 iframe 嵌入（仅当 URL 公网可访问时为 true，避免本地地址触发微软错误页 404） */
const useOfficeIframeForUploadedDoc = computed(() => {
  const doc = currentUploadedDoc.value
  if (!doc || isUploadedPdf.value) return false
  if (!isOfficeFileType(doc.fileType)) return true
  return isOfficeEmbeddableUrl(doc)
})

/** 当前上传文档是否为 PPT 且使用内联预览（用于 article 高度随内容收缩） */
const isCurrentUploadedDocPpt = computed(() => {
  if (!currentUploadedDoc.value || useOfficeIframeForUploadedDoc.value) return false
  const ft = (currentUploadedDoc.value.fileType || '').toLowerCase()
  return ft === 'ppt' || ft === 'pptx'
})

/** 获取上传文件的预览 URL（本地/非公网 Office 不返回 embed URL，由调用方配合 useOfficeIframeForUploadedDoc 显示 fallback） */
const getUploadedFileViewerUrl = (doc: { type: 'original'; fileType: string; fileUrl?: string; fileData?: string }): string => {
  const fileType = doc.fileType.toLowerCase()

  // 优先使用服务器 URL（生产环境）
  if (doc.fileUrl) {
    const fileUrl = doc.fileUrl.startsWith('http') ? doc.fileUrl : window.location.origin + doc.fileUrl

    // Office 类型且为本地/非公网地址时不使用微软 embed，避免错误页 zh-CN/strings.js 404
    if (isOfficeFileType(fileType) && !isOfficeEmbeddableUrl(doc)) {
      return ''
    }

    switch (fileType) {
      case 'pdf':
        return fileUrl
      case 'ppt':
      case 'pptx':
      case 'doc':
      case 'docx':
      case 'xls':
      case 'xlsx':
        return `https://view.officeapps.live.com/op/embed.aspx?ui=en-US&src=${encodeURIComponent(fileUrl)}`
      default:
        return fileUrl
    }
  }

  if (doc.fileData) {
    if (fileType === 'pdf') return doc.fileData
    return doc.fileData
  }

  return ''
}

/** 当前上传文档的原始文件 URL（用于下载/新窗口打开） */
const currentUploadedDocFileUrl = computed(() => {
  const doc = currentUploadedDoc.value
  if (!doc?.fileUrl) return ''
  return doc.fileUrl.startsWith('http') ? doc.fileUrl : window.location.origin + doc.fileUrl
})

/** 内联文本/Markdown 预览：内容、加载态、错误、是否为 Markdown */
const inlineTextContent = ref('')
const inlineTextLoading = ref(false)
const inlineTextError = ref<string | null>(null)
const inlineTextIsMarkdown = ref(false)

let abortController: AbortController | null = null

async function loadInlineText() {
  const cat = currentFileDoc.value ? currentFileDocFileTypeInfo.value.category : currentUploadedDocFileTypeInfo.value.category
  if (cat !== 'text' && cat !== 'markdown') {
    inlineTextContent.value = ''
    inlineTextError.value = null
    inlineTextIsMarkdown.value = false
    return
  }
  inlineTextLoading.value = true
  inlineTextError.value = null
  inlineTextIsMarkdown.value = cat === 'markdown'
  try {
    if (currentUploadedDoc.value) {
      const doc = currentUploadedDoc.value
      if (doc.fileData) {
        try {
          inlineTextContent.value = atob(doc.fileData)
        } catch {
          inlineTextContent.value = doc.fileData
        }
      } else if (currentUploadedDocFileUrl.value) {
        abortController = new AbortController()
        const res = await fetch(currentUploadedDocFileUrl.value, { signal: abortController.signal })
        if (!res.ok) throw new Error(res.statusText)
        inlineTextContent.value = await res.text()
      } else {
        inlineTextError.value = t('hardcoded.edu_documentation.iframeLoadFailed')
      }
    } else if (currentFileDoc.value && currentFileDocFileUrl.value) {
      abortController = new AbortController()
      const res = await fetch(currentFileDocFileUrl.value, { signal: abortController.signal })
      if (!res.ok) throw new Error(res.statusText)
      inlineTextContent.value = await res.text()
    } else {
      inlineTextError.value = t('hardcoded.edu_documentation.iframeLoadFailed')
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    inlineTextError.value = (e as Error).message || t('hardcoded.edu_documentation.iframeLoadFailed')
  } finally {
    inlineTextLoading.value = false
  }
}

/** 内联文本渲染后的 HTML（仅 Markdown） */
const inlineTextRenderedHtml = computed(() => {
  if (!inlineTextIsMarkdown.value || !inlineTextContent.value) return ''
  const html = marked(inlineTextContent.value, { renderer }) as string
  return DOMPurify.sanitize(html)
})

/** 内联代码预览：内容、加载态、错误 */
const inlineCodeContent = ref('')
const inlineCodeLoading = ref(false)
const inlineCodeError = ref<string | null>(null)

/** 当前预览的代码文件语言（用于高亮） */
const inlineCodeLanguage = computed(() => {
  if (currentFileDoc.value) {
    const ext = (currentFileDoc.value.fileType || currentFileDoc.value.fileUrl?.split('.').pop() || '').toLowerCase()
    return getCodeLanguage(ext ? `x.${ext}` : currentFileDoc.value.fileUrl || '')
  }
  if (currentUploadedDoc.value) {
    const ext = (currentUploadedDoc.value.fileType || '').toLowerCase()
    return getCodeLanguage(ext ? `x.${ext}` : '')
  }
  return 'plaintext'
})

/** 代码高亮后的 HTML */
const inlineCodeHighlightedHtml = computed(() => {
  if (!inlineCodeContent.value) return ''
  return highlightCode(inlineCodeContent.value, inlineCodeLanguage.value)
})

async function loadInlineCode() {
  const cat = currentFileDoc.value ? currentFileDocFileTypeInfo.value.category : currentUploadedDocFileTypeInfo.value.category
  if (cat !== 'code') {
    inlineCodeContent.value = ''
    inlineCodeError.value = null
    return
  }
  inlineCodeLoading.value = true
  inlineCodeError.value = null
  try {
    if (currentUploadedDoc.value) {
      const doc = currentUploadedDoc.value
      if (doc.fileData) {
        try {
          inlineCodeContent.value = atob(doc.fileData)
        } catch {
          inlineCodeContent.value = doc.fileData
        }
      } else if (currentUploadedDocFileUrl.value) {
        abortController = new AbortController()
        const res = await fetch(currentUploadedDocFileUrl.value, { signal: abortController.signal })
        if (!res.ok) throw new Error(res.statusText)
        inlineCodeContent.value = await res.text()
      } else {
        inlineCodeError.value = t('hardcoded.edu_documentation.iframeLoadFailed')
      }
    } else if (currentFileDoc.value && currentFileDocFileUrl.value) {
      abortController = new AbortController()
      const res = await fetch(currentFileDocFileUrl.value, { signal: abortController.signal })
      if (!res.ok) throw new Error(res.statusText)
      inlineCodeContent.value = await res.text()
    } else {
      inlineCodeError.value = t('hardcoded.edu_documentation.iframeLoadFailed')
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    inlineCodeError.value = (e as Error).message || t('hardcoded.edu_documentation.iframeLoadFailed')
  } finally {
    inlineCodeLoading.value = false
  }
}

// 文档内容
const markdownContent = ref('')
const loading = ref(true)
const error = ref<string | null>(null)
const activeSection = ref('')
const showToc = ref(true)
const isMobile = ref(false)
const mobileSidebarOpen = ref(false)

let resizeRafId: number | null = null
const checkMobile = () => {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    isMobile.value = window.innerWidth < 768
    if (isMobile.value) {
      showToc.value = false
    }
  })
}

const toggleMobileSidebar = () => {
  mobileSidebarOpen.value = !mobileSidebarOpen.value
}

const closeMobileSidebar = () => {
  mobileSidebarOpen.value = false
}

const sidebarWidth = ref(200)

const DEFAULT_DOC_LIST_HEIGHT = 200
const MIN_DOC_LIST_HEIGHT = 100
const MAX_DOC_LIST_HEIGHT = 600
const DOC_LIST_STORAGE_KEY = STORAGE_KEYS.DOC_LIST_HEIGHT

const getSavedDocListHeight = (): number => {
  try {
    const saved = StorageManager.getItem<string>(DOC_LIST_STORAGE_KEY)
    if (saved) {
      const height = parseInt(saved, 10)
      if (height >= MIN_DOC_LIST_HEIGHT && height <= MAX_DOC_LIST_HEIGHT) {
        return height
      }
    }
  } catch (_e) {
    logger.warn('Failed to read doc list height from StorageManager')
  }
  return DEFAULT_DOC_LIST_HEIGHT
}

const docListHeight = ref(getSavedDocListHeight())
const isDocListResizing = ref(false)
const docListSection = ref<HTMLElement | null>(null)

const isFullscreen = ref(false)
const docsContentRef = ref<HTMLElement | null>(null)

const toggleFullscreen = async () => {
  const element = docsContentRef.value
  if (!element) return

  if (!document.fullscreenElement) {
    try {
      await element.requestFullscreen()
      isFullscreen.value = true
    } catch (_err) {
      logger.warn('Fullscreen mode not available')
    }
  } else {
    try {
      await document.exitFullscreen()
      isFullscreen.value = false
    } catch (_err) {
      logger.warn('Exit fullscreen failed')
    }
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

const exitFullscreen = async () => {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
      isFullscreen.value = false
    } catch (_err) {
      logger.warn('Exit fullscreen failed')
    }
  }
}

const startDocListResize = (e: MouseEvent) => {
  e.preventDefault()
  isDocListResizing.value = true
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'

  document.addEventListener('mousemove', handleDocListResize)
  document.addEventListener('mouseup', stopDocListResize)
}

// mousemove 节流 rAF ID
let docListResizeRafId: number | null = null

const handleDocListResize = (e: MouseEvent) => {
  if (docListResizeRafId !== null) return
  // rAF 是异步的，先把 clientY 存起来
  const clientY = e.clientY
  docListResizeRafId = requestAnimationFrame(() => {
    docListResizeRafId = null
    if (!isDocListResizing.value || !docListSection.value) return

    const rect = docListSection.value.getBoundingClientRect()
    const newHeight = clientY - rect.top
    if (newHeight >= MIN_DOC_LIST_HEIGHT && newHeight <= MAX_DOC_LIST_HEIGHT) {
      docListHeight.value = newHeight
    }
  })
}

const stopDocListResize = () => {
  isDocListResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  document.removeEventListener('mousemove', handleDocListResize)
  document.removeEventListener('mouseup', stopDocListResize)

  try {
    StorageManager.setItem(DOC_LIST_STORAGE_KEY, docListHeight.value.toString())
  } catch (_e) {
    logger.warn('Failed to save doc list height to StorageManager')
  }
}

// 目录结构
interface TocItem {
  id: string
  text: string
  level: number
}
const tableOfContents = ref<TocItem[]>([])

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
})

// 自定义渲染器，为标题添加 ID
const renderer = new marked.Renderer()
renderer.heading = ({ text, depth }) => {
  const id = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `<h${depth} id="${id}" class="doc-heading doc-h${depth}">${text}</h${depth}>`
}

/** 法律文档渲染 HTML（从 i18n sections 构建） */
const legalRenderedHtml = computed(() => {
  const content = legalDocContent.value
  if (!content) return ''
  const parts: string[] = []
  parts.push(`<p class="doc-meta legal-update">${content.lastUpdated}</p>`)
  parts.push(`<h1 id="doc-title" class="doc-heading doc-h1">${content.title}</h1>`)
  content.sections.forEach((s, i) => {
    const id = s.title
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || `section-${i}`
    parts.push(`<h2 id="${id}" class="doc-heading doc-h2">${s.title}</h2>`)
    parts.push(`<div class="legal-section-content markdown-styled">${sanitizeHtml(s.content)}</div>`)
  })
  return parts.join('')
})

/** 获取当前文档的目录路径（用于处理相对路径图片） */
const currentDocDir = computed(() => {
  const path = currentDocPath.value
  const lastSlash = path.lastIndexOf('/')
  return lastSlash > 0 ? path.substring(0, lastSlash) : ''
})

/** 处理markdown中的相对路径图片，转换为绝对路径 */
const processImagePaths = (content: string): string => {
  const docDir = currentDocDir.value
  if (!docDir) return content

  return content.replace(
    /!\[([^\]]*)\]\(\.\/([^)]+)\)/g,
    (match, alt, imagePath) => {
      const absolutePath = `/docs/${docDir}/${imagePath}`
      return `![${alt}](${absolutePath})`
    }
  )
}

// 渲染后的 HTML - markdown 用 marked+DOMPurify，legal 用 legalRenderedHtml，file 用 iframe 直接显示
const renderedContent = computed(() => {
  if (isLegalDoc.value && legalDocContent.value) return legalRenderedHtml.value
  if (isFileDoc.value) return '' // 文件类型文档使用 iframe 直接显示，不需要渲染 HTML
  if (!markdownContent.value) return ''
  const processedContent = processImagePaths(markdownContent.value)
  const html = marked(processedContent, { renderer }) as string
  return DOMPurify.sanitize(html)
})

// 提取目录
const extractToc = (content: string) => {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm
  const toc: TocItem[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].replace(/[*_`]/g, '').trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
    toc.push({ id, text, level })
  }

  tableOfContents.value = toc
}

// 滚动到指定位置
const scrollToSection = (id: string) => {
  activeSection.value = id
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 涟漪效果
const createRipple = (event: MouseEvent) => {
  const button = event.currentTarget as HTMLElement
  const ripple = document.createElement('span')
  const rect = button.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = event.clientX - rect.left - size / 2
  const y = event.clientY - rect.top - size / 2

  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: radial-gradient(circle, color-mix(in srgb, var(--el-color-primary) 40%, transparent) 0%, transparent 70%);
    border-radius: var(--global-border-radius);
    transform: scale(0);
    animation: ripple-effect 0.6s ease-out forwards;
    pointer-events: none;
  `

  const originalPosition = button.style.position
  const originalOverflow = button.style.overflow

  button.style.position = 'relative'
  button.style.overflow = 'hidden'
  button.appendChild(ripple)

  setTimeout(() => {
    ripple.remove()
    button.style.position = originalPosition
    button.style.overflow = originalOverflow
  }, 600)
}

// 目录点击处理（带涟漪）
const handleTocClick = (event: MouseEvent, id: string) => {
  createRipple(event)
  scrollToSection(id)
}

// 返回顶部：滚动到当前文档第一个标题或页面顶部
const handleBackToTop = (event: MouseEvent) => {
  createRipple(event)
  const firstId = tableOfContents.value[0]?.id
  if (firstId) {
    scrollToSection(firstId)
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 当前上传的文档（原文件模式）
const currentUploadedDoc = ref<{ type: 'original'; fileType: string; fileUrl?: string; fileData?: string } | null>(null)

// iframe 加载状态
const iframeLoading = ref(false)
const iframeError = ref<string | null>(null)
const iframeTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const iframeKey = ref(0)
const IFRAME_TIMEOUT_MS = 30000

const resetIframeState = () => {
  iframeLoading.value = true
  iframeError.value = null
  if (iframeTimeout.value) {
    clearTimeout(iframeTimeout.value)
    iframeTimeout.value = null
  }
}

const handleIframeLoad = () => {
  iframeLoading.value = false
  iframeError.value = null
  if (iframeTimeout.value) {
    clearTimeout(iframeTimeout.value)
    iframeTimeout.value = null
  }
}

const handleIframeError = () => {
  iframeLoading.value = false
  iframeError.value = t('hardcoded.edu_documentation.iframeLoadFailed')
  if (iframeTimeout.value) {
    clearTimeout(iframeTimeout.value)
    iframeTimeout.value = null
  }
}

const startIframeTimeout = () => {
  resetIframeState()
  iframeTimeout.value = setTimeout(() => {
    if (iframeLoading.value) {
      iframeLoading.value = false
      iframeError.value = t('hardcoded.edu_documentation.iframeLoadTimeout')
    }
  }, IFRAME_TIMEOUT_MS)
}

const retryIframeLoad = () => {
  iframeKey.value++
  startIframeTimeout()
}

// 加载文档（markdown 请求文件，legal 从 i18n 渲染，uploaded 原文件直接显示）
const loadDocument = async () => {
  loading.value = true
  error.value = null
  currentUploadedDoc.value = null
  iframeError.value = null

  if (isFileDoc.value) {
    loading.value = false
    startIframeTimeout()
    return
  }

  try {
    const docId = currentDocId.value
    const uploadedContent = getUploadedDocContent(docId)

    if (uploadedContent) {
      if (uploadedContent.type === 'original') {
        // 原文件模式 - 使用 iframe 显示
        currentUploadedDoc.value = {
          type: 'original',
          fileType: uploadedContent.fileType!,
          fileUrl: uploadedContent.fileUrl,
          fileData: uploadedContent.fileData
        }
        markdownContent.value = ''
        loading.value = false
        startIframeTimeout()
        return
      } else {
        // Markdown 模式
        markdownContent.value = uploadedContent.content
        extractToc(uploadedContent.content)
      }
      loading.value = false
      return
    }

    if (isLegalDoc.value) {
      const content = legalDocContent.value
      if (content) {
        markdownContent.value = '' // legal 不用于 markdown 渲染
        extractTocFromLegal(content)
      } else {
        error.value = t('error.edu_documentation.文档加载失败')
      }
    } else {
      const path = currentDocPath.value
      abortController = new AbortController()
      const response = await fetch(`/docs/${path}`, { signal: abortController.signal })
      if (!response.ok) throw new Error(t('error.edu_documentation.文档加载失败'))
      const content = await response.text()
      // 检查返回的内容是否是 HTML（可能是 404 页面）
      if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html') || content.trim().startsWith('<!--')) {
        throw new Error(t('eduDoc.fileNotExist', { path }))
      }
      markdownContent.value = content
      extractToc(markdownContent.value)
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

/** 从法律文档 sections 提取目录 */
const extractTocFromLegal = (content: { sections: { title: string }[] }) => {
  tableOfContents.value = content.sections.map((s, i) => {
    const id = s.title
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || `section-${i}`
    return { id, text: s.title, level: 2 }
  })
}

// 监听滚动，高亮当前章节
let scrollRafId: number | null = null
// 滚动动画观察器，组件级变量便于卸载时 disconnect
let scrollObserver: IntersectionObserver | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const headings = document.querySelectorAll('.doc-heading')
    let current = ''

    headings.forEach((heading) => {
      const rect = heading.getBoundingClientRect()
      if (rect.top <= 120) {
        current = heading.id
      }
    })

    if (current) {
      activeSection.value = current
    }
  })
}

// 滚动动画观察器
const initScrollReveal = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  )

  // 观察文档中的标题和段落
  setTimeout(() => {
    document.querySelectorAll('.docs-content h1, .docs-content h2, .docs-content h3, .docs-content p, .docs-content ul, .docs-content table, .docs-content pre').forEach((el) => {
      el.classList.add('scroll-reveal-item')
      scrollObserver?.observe(el)
    })
  }, 100)
}

/** 清理残留的 Element Plus overlay 遮罩（从其他页面 KeepAlive 缓存带来的 dialog/drawer 遮罩）
 * 但保留上传对话框的 overlay */
const cleanupStaleOverlays = () => {
  nextTick(() => {
    document.querySelectorAll('.el-overlay').forEach((el) => {
      // 保留上传对话框的 overlay
      if (el.querySelector('.upload-dialog')) {
        return
      }
      ;(el as HTMLElement).remove()
    })
  })
}

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => {
  abortController?.abort()
  abortController = null
  document.body.classList.remove('route-edu-docs')
})
cleanup.add(() => { if (iframeTimeout.value) { clearTimeout(iframeTimeout.value); iframeTimeout.value = null } })
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
cleanup.add(() => { if (docListResizeRafId !== null) { cancelAnimationFrame(docListResizeRafId); docListResizeRafId = null } })
cleanup.add(() => { if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null } })
// 安全网：拖拽过程中卸载组件时移除监听器
cleanup.add(() => {
  document.removeEventListener('mousemove', handleDocListResize)
  document.removeEventListener('mouseup', stopDocListResize)
})

onMounted(() => {
  document.body.classList.add('route-edu-docs')
  cleanupStaleOverlays()
  cleanup.addEventListener(document, 'fullscreenchange', handleFullscreenChange)
  checkMobile()
  cleanup.addEventListener(window, 'resize', checkMobile)
  const kw = searchKeyword.value.trim()
  const hasDoc = route.query.doc
  if (kw && !hasDoc) {
    const first = DOC_CATALOG_WITH_I18N.value.find(
      (d) =>
        d.title.toLowerCase().includes(kw.toLowerCase()) ||
        d.id.toLowerCase().includes(kw.toLowerCase())
    )
    if (first) {
      router.replace({ path: '/docs', query: { doc: first.id, search: kw } })
    }
  }
  loadDocument()
  cleanup.addEventListener(window, 'scroll', handleScroll)
  cleanup.addTimer(initScrollReveal, 500)
  if (isAdmin.value) {
    loadUploadedDocs()
  }
})

watch(
  () => route.query.doc,
  () => {
    loadDocument()
  }
)

watch(
  [
    () => currentFileDoc.value?.fileUrl,
    () => currentUploadedDoc.value?.fileType,
    () => currentUploadedDoc.value?.fileUrl,
    () => currentUploadedDoc.value?.fileData,
    currentFileDocFileTypeInfo,
    currentUploadedDocFileTypeInfo,
  ],
  () => {
    const cat = currentFileDoc.value
      ? currentFileDocFileTypeInfo.value.category
      : currentUploadedDocFileTypeInfo.value.category
    if (cat === 'text' || cat === 'markdown') {
      loadInlineText()
      inlineCodeContent.value = ''
      inlineCodeError.value = null
    } else if (cat === 'code') {
      loadInlineCode()
      inlineTextContent.value = ''
      inlineTextError.value = null
    } else {
      inlineTextContent.value = ''
      inlineTextError.value = null
      inlineCodeContent.value = ''
      inlineCodeError.value = null
    }
  },
  { immediate: true }
)

// 动态更新页面标题和 meta
watch(
  currentDocTitle,
  (title) => {
    if (typeof document !== 'undefined') {
      document.title = `${title} - iHui AI`
      // 更新 meta description
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) {
        metaDesc.setAttribute('content', `${title} - iHui AI ${t('eduDoc.metaDescription')}`)
      }
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="edu-docs-root">
    <!-- 移动端汉堡菜单按钮 -->
    <button
      v-if="isMobile"
      class="mobile-menu-btn cyber-btn"
      @click="toggleMobileSidebar"
      :aria-label="t('eduDoc.menu')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <!-- 移动端侧边栏遮罩 -->
    <div
      v-if="isMobile && mobileSidebarOpen"
      class="mobile-sidebar-overlay"
      @click="closeMobileSidebar"
    ></div>

    <!-- 顶部导航栏 -->
    <header class="docs-header">
      <div class="header-content">
        <div class="header-left">
          <RouterLink to="/learn-ai" class="back-link cyber-btn" @click="createRipple">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>{{ t('hardcoded.edu_documentation.返回') }}</RouterLink>
          <RouterLink to="/support/document-center" class="back-link cyber-btn" @click="createRipple" style="margin-left: 12px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>{{ t('hardcoded.edu_documentation.documentCenter') }}</RouterLink>
          <div class="header-title">
            <span class="title-icon pulse-glow">📚</span>
            <span class="title-text glitch-text">{{ currentDocTitle }}</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="toc-toggle cyber-btn" @click="showToc = !showToc" :class="{ active: showToc }">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>{{ t('hardcoded.edu_documentation.目录') }}</button>
        </div>
      </div>
    </header>

    <div class="docs-layout" :class="{ resizing: isDocListResizing }">
      <!-- 侧边目录 - 玻璃态 -->
      <aside
        class="docs-sidebar glass-panel"
        :class="{ visible: showToc, 'mobile-open': isMobile && mobileSidebarOpen }"
        :style="{ width: showToc ? `${sidebarWidth}px` : '0' }"
      >
        <nav class="toc-nav">
          <div class="doc-list-section" ref="docListSection" :style="{ maxHeight: docListHeight + 'px' }">
            <div class="toc-title doc-list-title">{{ t('hardcoded.edu_documentation.allDocs') }}</div>
            <p v-if="searchKeyword" class="search-hint">{{ t('hardcoded.edu_documentation.search') }}: {{ searchKeyword }}</p>
            <div
              v-for="group in DOC_CATALOG_GROUPED"
              :key="group.category"
              class="doc-group"
            >
              <div class="doc-group-title">{{ getCategoryLabel(group.category) }}</div>
              <ul v-if="group.docs.length > 0" class="doc-list">
                <li
                  v-for="doc in group.docs"
                  :key="doc.id"
                  class="doc-list-item"
                  :class="{ active: (route.query.doc || 'edu-platform') === doc.id }"
                >
                  <a href="#" class="toc-link" @click.prevent="goToDoc(doc.id)">
                    <span class="file-type-icon">{{ getFileTypeIcon(doc.fileType || getFileTypeFromPath(doc.path)) }}</span>
                    <span class="doc-info">
                      <span class="doc-title">{{ doc.title }}</span>
                      <span v-if="doc.createdAt" class="doc-time">{{ formatTimeDistance(doc.createdAt) }}</span>
                    </span>
                  </a>
                  <div v-if="isAdmin && uploadedDocs.find((d: DocListItem) => d.id === doc.id)" class="doc-actions">
                    <button class="doc-action-btn edit-btn" @click.stop="openEditDialog(doc)" :title="t('eduDoc.edit')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button class="doc-action-btn delete-btn" @click.stop="handleDeleteDoc(doc)" :title="t('eduDoc.delete')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </li>
              </ul>
              <p v-else class="empty-hint">{{ t('hardcoded.edu_documentation.noDocs') }}</p>
            </div>
            <div v-if="DOC_CATALOG_GROUPED.length === 0" class="empty-search">
              <span class="empty-icon">🔍</span>
              <span class="empty-text">{{ t('hardcoded.edu_documentation.noMatchingDocs') }}</span>
            </div>
            <div class="doc-list-resize-handle" @mousedown="startDocListResize"></div>
          </div>
          <div class="toc-title">{{ t('hardcoded.edu_documentation.目录导航') }}</div>
          <ul class="toc-list">
            <li
              v-for="(item, index) in tableOfContents"
              :key="item.id"
              :class="['toc-item', `toc-level-${item.level}`, { active: activeSection === item.id }]"
              :style="{ '--item-index': index }"
            >
              <a
                @click.prevent="handleTocClick($event, item.id)"
                :href="`#${item.id}`"
                class="toc-link"
              >
                {{ item.text }}
              </a>
            </li>
          </ul>
        </nav>

      </aside>

      <!-- 主内容区 -->
      <main class="docs-main">
        <!-- 加载状态 - 科技风格 -->
        <div v-if="loading" class="docs-loading">
          <div class="cyber-loader">
            <div class="cyber-loader__ring"></div>
            <div class="cyber-loader__ring"></div>
            <div class="cyber-loader__ring"></div>
            <div class="cyber-loader__core"></div>
          </div>
          <p class="loading-text">{{ t('hardcoded.edu_documentation.正在加载文档') }}<span class="loading-dots"></span></p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="docs-error glass-panel">
          <div class="error-icon glitch-text">⚠️</div>
          <p class="error-text">{{ error }}</p>
          <button @click="loadDocument" class="retry-btn cyber-btn cyber-btn--primary">
            <span class="btn-text">{{ t('hardcoded.edu_documentation.重新加载') }}</span>
            <span class="btn-glow"></span>
          </button>
        </div>

        <!-- PDF 文件 - 使用 DocViewer 组件 -->
        <article
          v-else-if="isFileDoc && currentFileDoc && isPdfFile"
          ref="docsContentRef"
          class="docs-content file-viewer scroll-reveal"
          :class="{ 'is-fullscreen': isFullscreen }"
          :style="{ left: showToc ? `${sidebarWidth + 24}px` : '12px' }"
        >
          <DocViewer :document-url="currentFileDoc.fileUrl || ''" />
        </article>

        <!-- 其他文件类型文档 - 使用 iframe 直接显示原文件 -->
        <article
          v-else-if="isFileDoc && currentFileDoc"
          ref="docsContentRef"
          class="docs-content file-viewer scroll-reveal"
          :class="{ 'is-fullscreen': isFullscreen, 'file-viewer--pptx': isCurrentFileDocPpt }"
          :style="{ left: showToc ? `${sidebarWidth + 24}px` : '12px' }"
        >
          <button class="fullscreen-btn btn-icon-square" @click="toggleFullscreen" :title="t('hardcoded.edu_documentation.fullscreenView')">
            <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          </button>
          <button v-if="isFullscreen" class="exit-fullscreen-btn btn-icon-square" @click="exitFullscreen" :title="t('hardcoded.edu_documentation.exitFullscreen')">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <!-- 目录文档：本地/内网时在页面内用 vue-office 渲染 Word/Excel，PPT 仅下载 -->
          <div v-if="!useOfficeIframeForCatalogDoc && currentFileDoc" class="file-viewer-inline-wrap">
            <InlineOfficeViewer
              :file-url="currentFileDocFileUrl"
              :file-type="(currentFileDoc.fileType || currentFileDoc.fileUrl?.split('.').pop() || '')"
            />
          </div>
          <div v-else-if="!useOfficeIframeForCatalogDoc" class="file-viewer-fallback">
            <p class="fallback-message">{{ t('hardcoded.edu_documentation.officePreviewUnavailable') }}</p>
            <div class="fallback-actions">
              <a v-if="currentFileDocFileUrl" :href="currentFileDocFileUrl" target="_blank" rel="noopener noreferrer" class="cyber-btn cyber-btn--primary" download>
                {{ t('hardcoded.edu_documentation.downloadDocument') }}
              </a>
            </div>
          </div>
          <div v-else-if="currentFileDocFileTypeInfo.category === 'image'" class="file-viewer-media">
            <img :src="currentFileDocFileUrl" :alt="currentFileDoc?.title" class="file-viewer-media__img" loading="lazy" />
          </div>
          <div v-else-if="currentFileDocFileTypeInfo.category === 'video'" class="file-viewer-media">
            <video :src="currentFileDocFileUrl" controls preload="none" class="file-viewer-media__video"></video>
          </div>
          <div v-else-if="currentFileDocFileTypeInfo.category === 'audio'" class="file-viewer-media">
            <audio :src="currentFileDocFileUrl" controls class="file-viewer-media__audio"></audio>
          </div>
          <div v-else-if="currentFileDocFileTypeInfo.category === 'code'" class="file-viewer-inline-code">
            <div v-if="inlineCodeLoading" class="file-viewer-inline-code__loading">
              <div class="cyber-loader">
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__core"></div>
              </div>
              <p>{{ t('hardcoded.edu_documentation.loadingDocument') }}</p>
            </div>
            <div v-else-if="inlineCodeError" class="file-viewer-inline-code__error">
              <p class="error-text">{{ inlineCodeError }}</p>
              <a v-if="currentFileDocFileUrl" :href="currentFileDocFileUrl" class="cyber-btn cyber-btn--primary" download>{{ t('hardcoded.edu_documentation.downloadDocument') }}</a>
            </div>
            <div v-else class="file-viewer-inline-code__wrap">
              <span class="file-viewer-inline-code__lang">{{ inlineCodeLanguage }}</span>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <pre class="file-viewer-inline-code__pre"><code class="hljs" v-html="inlineCodeHighlightedHtml"></code></pre>
            </div>
          </div>
          <div v-else-if="currentFileDocFileTypeInfo.category === 'text' || currentFileDocFileTypeInfo.category === 'markdown'" class="file-viewer-inline-text">
            <div v-if="inlineTextLoading" class="file-viewer-inline-text__loading">
              <div class="cyber-loader">
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__core"></div>
              </div>
              <p>{{ t('hardcoded.edu_documentation.loadingDocument') }}</p>
            </div>
            <div v-else-if="inlineTextError" class="file-viewer-inline-text__error">
              <p class="error-text">{{ inlineTextError }}</p>
              <a v-if="currentFileDocFileUrl" :href="currentFileDocFileUrl" class="cyber-btn cyber-btn--primary" download>{{ t('hardcoded.edu_documentation.downloadDocument') }}</a>
            </div>
            <pre v-else-if="!inlineTextIsMarkdown" class="file-viewer-inline-text__pre">{{ inlineTextContent }}</pre>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else class="file-viewer-inline-text__md markdown-body" v-html="inlineTextRenderedHtml"></div>
          </div>
          <div v-else class="file-viewer-container">
            <div v-if="iframeLoading" class="iframe-loading-overlay">
              <div class="cyber-loader">
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__core"></div>
              </div>
              <p class="loading-text">{{ t('hardcoded.edu_documentation.loadingDocument') }}<span class="loading-dots"></span></p>
            </div>
            <div v-else-if="iframeError" class="iframe-error-overlay">
              <div class="error-icon">⚠️</div>
              <p class="error-text">{{ iframeError }}</p>
              <button @click="retryIframeLoad" class="retry-btn cyber-btn cyber-btn--primary">
                <span class="btn-text">{{ t('hardcoded.edu_documentation.reload') }}</span>
              </button>
            </div>
            <iframe
              v-show="!iframeLoading && !iframeError"
              :key="iframeKey"
              :src="getFileViewerUrl(currentFileDoc)"
              class="file-viewer-iframe"
              frameborder="0"
              allowfullscreen
              @load="handleIframeLoad"
              @error="handleIframeError"
            ></iframe>
          </div>
        </article>

        <!-- 上传的 PDF 文件 - 使用 DocViewer 组件 -->
        <article
          v-else-if="currentUploadedDoc && isUploadedPdf"
          ref="docsContentRef"
          class="docs-content file-viewer scroll-reveal"
          :class="{ 'is-fullscreen': isFullscreen }"
          :style="{ left: showToc ? `${sidebarWidth + 24}px` : '12px' }"
        >
          <DocViewer :document-url="currentUploadedDoc.fileUrl || ''" />
        </article>

        <!-- 上传的其他文件类型 - 使用 iframe 直接显示 -->
        <article
          v-else-if="currentUploadedDoc"
          ref="docsContentRef"
          class="docs-content file-viewer scroll-reveal"
          :class="{ 'is-fullscreen': isFullscreen, 'file-viewer--pptx': isCurrentUploadedDocPpt }"
          :style="{ left: showToc ? `${sidebarWidth + 24}px` : '12px' }"
        >
          <button class="fullscreen-btn btn-icon-square" @click="toggleFullscreen" :title="t('hardcoded.edu_documentation.fullscreenView')">
            <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          </button>
          <button v-if="isFullscreen" class="exit-fullscreen-btn btn-icon-square" @click="exitFullscreen" :title="t('hardcoded.edu_documentation.exitFullscreen')">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <!-- 本地/内网时在页面内用 vue-office 渲染 Word/Excel，PPT 仅下载 -->
          <div v-if="!useOfficeIframeForUploadedDoc && currentUploadedDoc" class="file-viewer-inline-wrap">
            <InlineOfficeViewer
              :file-url="currentUploadedDocFileUrl"
              :file-type="currentUploadedDoc.fileType"
              :file-data="currentUploadedDoc.fileData"
            />
          </div>
          <div v-else-if="!useOfficeIframeForUploadedDoc" class="file-viewer-fallback">
            <p class="fallback-message">{{ t('hardcoded.edu_documentation.officePreviewUnavailable') }}</p>
            <div class="fallback-actions">
              <a v-if="currentUploadedDocFileUrl" :href="currentUploadedDocFileUrl" target="_blank" rel="noopener noreferrer" class="cyber-btn cyber-btn--primary" download>
                {{ t('hardcoded.edu_documentation.downloadDocument') }}
              </a>
            </div>
          </div>
          <div v-else-if="currentUploadedDocFileTypeInfo.category === 'image'" class="file-viewer-media">
            <img v-if="currentUploadedDocFileUrl" :src="currentUploadedDocFileUrl" alt="" class="file-viewer-media__img" loading="lazy" />
            <img v-else-if="currentUploadedDoc?.fileData" :src="'data:' + (currentUploadedDoc.fileType === 'jpg' || currentUploadedDoc.fileType === 'jpeg' ? 'image/jpeg' : currentUploadedDoc.fileType === 'svg' ? 'image/svg+xml' : 'image/png') + ';base64,' + currentUploadedDoc.fileData" alt="" class="file-viewer-media__img" loading="lazy" />
          </div>
          <div v-else-if="currentUploadedDocFileTypeInfo.category === 'video'" class="file-viewer-media">
            <video v-if="currentUploadedDocFileUrl" :src="currentUploadedDocFileUrl" controls preload="none" class="file-viewer-media__video"></video>
            <video v-else-if="currentUploadedDoc?.fileData" :src="'data:video/mp4;base64,' + currentUploadedDoc.fileData" controls preload="none" class="file-viewer-media__video"></video>
          </div>
          <div v-else-if="currentUploadedDocFileTypeInfo.category === 'audio'" class="file-viewer-media">
            <audio v-if="currentUploadedDocFileUrl" :src="currentUploadedDocFileUrl" controls class="file-viewer-media__audio"></audio>
            <audio v-else-if="currentUploadedDoc?.fileData" :src="'data:audio/mpeg;base64,' + currentUploadedDoc.fileData" controls class="file-viewer-media__audio"></audio>
          </div>
          <div v-else-if="currentUploadedDocFileTypeInfo.category === 'code'" class="file-viewer-inline-code">
            <div v-if="inlineCodeLoading" class="file-viewer-inline-code__loading">
              <div class="cyber-loader">
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__core"></div>
              </div>
              <p>{{ t('hardcoded.edu_documentation.loadingDocument') }}</p>
            </div>
            <div v-else-if="inlineCodeError" class="file-viewer-inline-code__error">
              <p class="error-text">{{ inlineCodeError }}</p>
              <a v-if="currentUploadedDocFileUrl" :href="currentUploadedDocFileUrl" class="cyber-btn cyber-btn--primary" download>{{ t('hardcoded.edu_documentation.downloadDocument') }}</a>
            </div>
            <div v-else class="file-viewer-inline-code__wrap">
              <span class="file-viewer-inline-code__lang">{{ inlineCodeLanguage }}</span>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <pre class="file-viewer-inline-code__pre"><code class="hljs" v-html="inlineCodeHighlightedHtml"></code></pre>
            </div>
          </div>
          <div v-else-if="currentUploadedDocFileTypeInfo.category === 'text' || currentUploadedDocFileTypeInfo.category === 'markdown'" class="file-viewer-inline-text">
            <div v-if="inlineTextLoading" class="file-viewer-inline-text__loading">
              <div class="cyber-loader">
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__core"></div>
              </div>
              <p>{{ t('hardcoded.edu_documentation.loadingDocument') }}</p>
            </div>
            <div v-else-if="inlineTextError" class="file-viewer-inline-text__error">
              <p class="error-text">{{ inlineTextError }}</p>
              <a v-if="currentUploadedDocFileUrl" :href="currentUploadedDocFileUrl" class="cyber-btn cyber-btn--primary" download>{{ t('hardcoded.edu_documentation.downloadDocument') }}</a>
            </div>
            <pre v-else-if="!inlineTextIsMarkdown" class="file-viewer-inline-text__pre">{{ inlineTextContent }}</pre>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else class="file-viewer-inline-text__md markdown-body" v-html="inlineTextRenderedHtml"></div>
          </div>
          <div v-else class="file-viewer-container">
            <div v-if="iframeLoading" class="iframe-loading-overlay">
              <div class="cyber-loader">
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__ring"></div>
                <div class="cyber-loader__core"></div>
              </div>
              <p class="loading-text">{{ t('hardcoded.edu_documentation.loadingDocument') }}<span class="loading-dots"></span></p>
            </div>
            <div v-else-if="iframeError" class="iframe-error-overlay">
              <div class="error-icon">⚠️</div>
              <p class="error-text">{{ iframeError }}</p>
              <button @click="retryIframeLoad" class="retry-btn cyber-btn cyber-btn--primary">
                <span class="btn-text">{{ t('hardcoded.edu_documentation.reload') }}</span>
              </button>
            </div>
            <iframe
              v-show="!iframeLoading && !iframeError"
              :key="iframeKey"
              :src="getUploadedFileViewerUrl(currentUploadedDoc)"
              class="file-viewer-iframe"
              frameborder="0"
              allowfullscreen
              @load="handleIframeLoad"
              @error="handleIframeError"
            ></iframe>
          </div>
        </article>

        <!-- 文档内容 - 玻璃态卡片 -->
        <article
          v-else
          ref="docsContentRef"
          class="docs-content markdown-body scroll-reveal"
          :class="{ 'is-fullscreen': isFullscreen }"
          :style="{ left: showToc ? `${sidebarWidth + 24}px` : '12px' }"
        >
          <button class="fullscreen-btn btn-icon-square" @click="toggleFullscreen" :title="t('hardcoded.edu_documentation.fullscreenView')">
            <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          </button>
          <button v-if="isFullscreen" class="exit-fullscreen-btn btn-icon-square" @click="exitFullscreen" :title="t('hardcoded.edu_documentation.exitFullscreen')">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="markdown-content" v-html="renderedContent"></div>
        </article>
      </main>
    </div>

    <!-- 返回顶部 - 科技风格 -->
    <button
      class="back-to-top cyber-btn cyber-btn--float"
      @click="handleBackToTop"
      :title="t('hardcoded.edu_documentation.返回顶部1')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
      <span class="btn-ring"></span>
    </button>

    <!-- 管理员专属上传按钮：与浮动聊天头部统一样式（同圆角、同描边、同背景体系） -->
    <button
      v-if="isAdmin"
      class="admin-upload-btn cyber-btn cyber-btn--float"
      @click="openUploadDialog"
      :title="t('hardcoded.edu_documentation.uploadDocument')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span class="btn-ring"></span>
    </button>

    <!-- 上传对话框 - 使用原生 HTML dialog -->
    <Teleport to="body">
      <div v-if="showUploadDialog" class="upload-dialog-overlay" @click.self="showUploadDialog = false">
        <div class="upload-dialog-content">
          <div class="upload-dialog-header">
            <h3>{{ t('hardcoded.edu_documentation.uploadDialogTitle') }}</h3>
            <button class="close-btn" @click="showUploadDialog = false" aria-label="关闭">&times;</button>
          </div>
          <div class="upload-form">
            <div class="form-item">
              <label>{{ t('hardcoded.edu_documentation.selectFileLabel') }}</label>
              <div class="file-input-row">
                <div class="file-input-cell">
                  <input
                    ref="fileInputRef"
                    type="file"
                    @change="handleFileChange"
                    accept=".doc,.docx,.pdf,.txt,.md,.xlsx,.xls,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.mp3,.wav"
                    class="file-input-hidden"
                  />
                  <div v-if="!uploadFile" class="file-input-ui">
                    <span class="file-input-trigger">{{ t('hardcoded.edu_documentation.selectFileLabel') }}</span>
                    <span class="file-input-status">{{ t('hardcoded.edu_documentation.noFileSelected') }}</span>
                  </div>
                  <div v-else class="file-preview-inline">
                    <span class="file-preview-label">{{ t('hardcoded.edu_documentation.filePreview') }}</span>
                    <div class="preview-info">
                      <span class="file-name">{{ uploadFile.name }}</span>
                      <span class="file-size">{{ formatFileSize(uploadFile.size) }}</span>
                    </div>
                  </div>
                </div>
                <p class="file-hint">
                  <span class="file-hint-title">{{ t('hardcoded.edu_documentation.supportedFormats') }}</span>
                  <span class="format-group">📄 {{ t('hardcoded.edu_documentation.formatDocs') }}</span>
                  <span class="format-group">📊 {{ t('hardcoded.edu_documentation.formatSheets') }}</span>
                  <span class="format-group">📽️ {{ t('hardcoded.edu_documentation.formatSlides') }}</span>
                  <span class="format-group">🖼️ {{ t('hardcoded.edu_documentation.formatImages') }}</span>
                  <span class="format-group">🎬 {{ t('hardcoded.edu_documentation.formatVideos') }}</span>
                  <span class="format-group">🎵 {{ t('hardcoded.edu_documentation.formatAudio') }}</span>
                </p>
              </div>
            </div>
            <div class="form-item">
              <label>{{ t('hardcoded.edu_documentation.docCategory') }}</label>
              <select v-model="uploadCategory" class="category-select">
                <option v-for="cat in docCategories" :key="cat" :value="cat">{{ getCategoryLabel(cat) }}</option>
              </select>
            </div>
            <div class="form-item">
              <label>{{ t('hardcoded.edu_documentation.uploadMode') }}</label>
              <div class="upload-mode-options">
                <label class="mode-option" :class="{ active: uploadMode === 'original' }">
                  <input type="radio" v-model="uploadMode" value="original" />
                  <span class="mode-label">{{ t('hardcoded.edu_documentation.modeOriginal') }}</span>
                  <span class="mode-desc">{{ t('hardcoded.edu_documentation.modeOriginalDesc') }}</span>
                </label>
                <label class="mode-option" :class="{ active: uploadMode === 'markdown' }">
                  <input type="radio" v-model="uploadMode" value="markdown" />
                  <span class="mode-label">{{ t('hardcoded.edu_documentation.modeMarkdown') }}</span>
                  <span class="mode-desc">{{ t('hardcoded.edu_documentation.modeMarkdownDesc') }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="upload-dialog-footer">
            <button class="cyber-btn" @click="showUploadDialog = false">{{ t('common.cancel') }}</button>
            <button class="cyber-btn cyber-btn--primary" @click="handleUpload" :disabled="uploadLoading">
              {{ uploadLoading ? (uploadMode === 'original' ? t('hardcoded.edu_documentation.uploading') : t('hardcoded.edu_documentation.converting')) : t('hardcoded.edu_documentation.uploadAndConvert') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 编辑对话框 -->
    <Teleport to="body">
      <div v-if="showEditDialog" class="upload-dialog-overlay" @click.self="showEditDialog = false">
        <div class="upload-dialog-content edit-dialog">
          <div class="upload-dialog-header">
            <h3>{{ t('hardcoded.edu_documentation.editDialogTitle') }}</h3>
            <button class="close-btn" @click="showEditDialog = false" aria-label="关闭">&times;</button>
          </div>
          <div class="upload-form">
            <div class="form-item">
              <label>{{ t('hardcoded.edu_documentation.docTitle') }}</label>
              <input
                v-model="editDocTitle"
                type="text"
                class="text-input"
                :placeholder="t('hardcoded.edu_documentation.docTitlePlaceholder')"
              />
            </div>
            <div class="form-item">
              <label>{{ t('hardcoded.edu_documentation.docCategory') }}</label>
              <select v-model="editDocCategory" class="category-select">
                <option v-for="cat in docCategories" :key="cat" :value="cat">{{ getCategoryLabel(cat) }}</option>
              </select>
            </div>
          </div>
          <div class="upload-dialog-footer">
            <button class="cyber-btn" @click="showEditDialog = false">{{ t('common.cancel') }}</button>
            <button class="cyber-btn cyber-btn--primary" @click="handleEditSave" :disabled="editLoading">
              {{ editLoading ? t('hardcoded.edu_documentation.saving') : t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
@use "sass:color";

// ============================================
// 高科技工业风格设计令牌
// High-Tech Industrial Design Tokens
// ============================================

// 核心色彩 - 黑灰主题
// 现代浅色文档风格 - 蓝灰主题
$brand-primary: var(--color-brand-blue-2);
$brand-primary-light: var(--color-blue-e8f0ff);
$brand-primary-hover: var(--color-blue-245bdb);
$cyber-accent: var(--color-brand-blue-2);
$cyber-accent-dim: color-mix(in srgb, var(--el-color-primary) 60%, transparent);
$cyber-accent-glow: color-mix(in srgb, var(--el-color-primary) 15%, transparent);

// 背景层级 - 浅色
$bg-void: var(--color-gray-f5f6f7);
$bg-deep: var(--color-gray-f5f6f7);
$bg-surface: var(--el-bg-color);
$bg-elevated: var(--el-bg-color);
$bg-card: var(--el-bg-color);

// 文字色彩 - 深灰色系
$text-primary: var(--el-text-color-primary);
$text-secondary: var(--color-gray-4e5969);
$text-muted: var(--el-text-color-primary);

// 边框 - 浅灰色
$border-subtle: var(--color-gray-e8e9eb);
$border-glow: var(--color-blue-3370ff-30);

// 布局 - 使用全局变量保持一致
$header-height: var(--global-header-height);
$sidebar-width: 200px;

// ============================================
// 涟漪动画
// ============================================
@keyframes ripple-effect {
  0% {
    transform: scale(0);
    opacity: 1;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

// ============================================
// 根容器
// ============================================
.edu-docs-root {
  min-height: calc(100vh - 60px);
  height: calc(100vh - 60px);
  background: $bg-deep;
  position: relative;
  overflow: hidden;
}

// ============================================
// 面板样式 - 简洁现代
// ============================================
.glass-panel {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

// ============================================
// 简洁现代按钮
// ============================================
.cyber-btn {
  position: relative;
  overflow: hidden;
  background: var(--el-bg-color);
  border: var(--unified-border);
  color: $text-secondary;
  padding: 8px 16px;
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:hover {
    border-color: $brand-primary;
    color: $brand-primary;
    background: $brand-primary-light;
  }

  &.active {
    border-color: $brand-primary;
    color: $brand-primary;
    background: $brand-primary-light;
  }

  &--primary {
    background: var(--el-color-primary);
    border: none;
    color: var(--el-bg-color-page);
    font-weight: 500;

    &:hover {
      background: var(--el-color-primary-light-3);
      color: var(--el-bg-color-page);
      transform: translateY(-1px);
      }
  }

  &--float {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    background: var(--el-bg-color);
    border: var(--unified-border);

    /* primary 浮动按钮保持主色，不被 --float 的默认背景覆盖 */
    &.cyber-btn--primary {
      background: var(--el-color-primary);
      color: var(--el-bg-color-page);
      border: none;

      &:hover {
        background: var(--el-color-primary-light-3);
        color: var(--el-bg-color-page);
      }
    }
  }
}

// ============================================
// 脉冲发光
// ============================================
.pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    filter: drop-shadow(0 0 5px $cyber-accent-glow);
  }

  50% {
    filter: drop-shadow(0 0 15px $cyber-accent-dim);
  }
}

// ============================================
// 故障文字效果
// ============================================
.glitch-text {
  position: relative;

  &::before,
  &::after {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
  }

  &:hover {
    animation: glitch 0.3s linear;

    &::before {
      animation: glitch-1 0.3s linear;
      color: var(--el-color-danger);
      opacity: 0.8;
    }

    &::after {
      animation: glitch-2 0.3s linear;
      color: var(--el-color-primary);
      opacity: 0.8;
    }
  }
}

@keyframes glitch {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(-2px, -2px); }
  60% { transform: translate(2px, 2px); }
  80% { transform: translate(2px, -2px); }
}

@keyframes glitch-1 {
  0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
  20% { clip-path: inset(20% 0 60% 0); transform: translate(-3px); }
  40% { clip-path: inset(40% 0 40% 0); transform: translate(3px); }
  60% { clip-path: inset(60% 0 20% 0); transform: translate(-3px); }
  80% { clip-path: inset(80% 0 0% 0); transform: translate(3px); }
}

@keyframes glitch-2 {
  0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
  20% { clip-path: inset(60% 0 20% 0); transform: translate(3px); }
  40% { clip-path: inset(20% 0 60% 0); transform: translate(-3px); }
  60% { clip-path: inset(80% 0 0% 0); transform: translate(3px); }
  80% { clip-path: inset(40% 0 40% 0); transform: translate(-3px); }
}

// ============================================
// 顶部导航 - 隐藏使用全局导航
// ============================================
.docs-header {
  display: none;

  .header-content {
    max-width: 1600px;
    margin: 0 auto;
    height: 100%;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;

    .title-icon {
      font-size: 24px;
    }

    .title-text {
      font-size: 18px;
      font-weight: 700;
      color: $text-primary;
      letter-spacing: -0.02em;
    }
  }

  .toc-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

// ============================================
// 主布局
// ============================================
.docs-layout {
  display: flex;
  padding-top: 0;
  min-height: calc(100vh - 60px);
  height: calc(100vh - 60px);
  position: relative;
  z-index: var(--z-base);

}

// ============================================
// 侧边栏 - 简洁现代
// ============================================
.docs-sidebar {
  position: fixed;
  top: calc(var(--global-header-height) + 12px);
  left: 12px;
  width: $sidebar-width;
  height: calc(100vh - var(--global-header-height) - 24px);
  border-radius: var(--global-border-radius);
  overflow-y: auto;
  transform: translateX(calc(-100% - 12px));
  transition: transform 0.3s ease, width 0.15s ease;
  background: var(--el-bg-color);
  border: var(--unified-border);
  &::-webkit-scrollbar {
    width: 4px;
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: $border-subtle;
    border-radius: var(--global-border-radius);
  }

  &.visible { transform: translateX(0); }

  .toc-nav { padding: 6px; }

  .toc-title {
    font-size: 12px;
    font-weight: 600;
    color: $text-muted;
    margin: 6px 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .doc-list-section { overflow-y: auto; position: relative; }

  .doc-list-title {
    position: sticky;
    top: 0;
    z-index: var(--z-base);
    margin-top: 0; /* 首个标题与 .toc-nav 上 padding 6px 一致 */
    margin-bottom: 6px;
    flex-shrink: 0;
    background: var(--el-bg-color);
    padding-bottom: 4px;
  }

  .search-hint {
    font-size: 12px;
    color: $text-muted;
    margin: 0 0 10px 12px;
  }

  .doc-group {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: var(--unified-border-bottom);

    &:last-of-type {
      border-bottom: none;
    }
  }

  .doc-group-title {
    font-size: 12px;
    font-weight: 600;
    color: $text-secondary;
    margin-bottom: 8px;
    padding: 6px 12px;
    background: var(--color-gray-f5f6f7);
    border-radius: var(--global-border-radius);
    letter-spacing: 0.02em;
  }

  .doc-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .doc-list-item {
    position: relative;
    display: flex;
    align-items: center;

    .toc-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      color: $text-secondary;
      text-decoration: none;
      font-size: 13px;
      cursor: pointer;
      border-radius: var(--global-border-radius);
      transition: all 0.2s ease;
      flex: 1;
    }

    .file-type-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .doc-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .doc-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .doc-time {
      font-size: 12px;
      color: $text-muted;
    }

    .doc-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    &:hover .doc-actions {
      opacity: 1;
    }

    .doc-action-btn {
      width: 24px;
      height: 24px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      color: $text-muted;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--color-gray-f2f3f5);
        color: $text-secondary;
      }

      &.edit-btn:hover {
        color: $brand-primary;
      }

      &.delete-btn:hover {
        color: var(--color-danger-variant);
      }
    }

    &.active .toc-link {
      color: $brand-primary;
      background: var(--color-blue-e8f0ff);
      font-weight: 500;
    }

    &:hover .toc-link {
      color: $text-primary;
      background: var(--color-gray-f2f3f5);
    }
  }

  .empty-hint {
    font-size: 12px;
    color: $text-muted;
    text-align: center;
    padding: 12px;
    margin: 0;
  }

  .empty-search {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 12px;
    gap: 8px;

    .empty-icon {
      font-size: 24px;
      opacity: 0.5;
    }

    .empty-text {
      font-size: 12px;
      color: $text-muted;
    }
  }

  .doc-list-resize-handle {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    height: 8px;
    cursor: row-resize;
    background: transparent;
    z-index: calc(var(--z-base) + 9);
    transition: background 0.2s;
    margin-top: 4px;

    &::before {
      content: '';
      position: absolute;
      left: 50%;
      bottom: 2px;
      transform: translateX(-50%);
      width: 40px;
      height: 3px;
      background: var(--color-white-10);
      border-radius: var(--global-border-radius);
      transition: all 0.25s;
      opacity: 0;
    }

    &:hover {
      background: var(--color-green-00ff88-05);

      &::before {
        opacity: 1;
        background: $cyber-accent-dim;
      }
    }

    &:active {
      background: var(--color-green-00ff88-10);

      &::before {
        opacity: 1;
        background: $cyber-accent;
      }
    }
  }

  .toc-list { overflow-y: auto; }

  .toc-item {
    .toc-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      color: $text-secondary;
      text-decoration: none;
      font-size: 13px;
      border-radius: var(--global-border-radius);
      cursor: pointer;

      &__text {
        flex: 1;
      }

      &:hover {
        color: $text-primary;
      }
    }

    &.active .toc-link {
      color: $cyber-accent;
    }

    &.toc-level-2 .toc-link {
      padding-left: 28px;
    }

    &.toc-level-3 .toc-link {
      padding-left: 44px;
      font-size: 12px;
      color: $text-muted;
    }
  }
}

// ============================================
// 简洁加载动画
// ============================================
.docs-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: $text-secondary;
}

.cyber-loader {
  position: relative;
  width: 40px;
  height: 40px;
  margin-bottom: 16px;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border: 3px solid $border-subtle;
    border-top-color: $brand-primary;
    border-radius: 50%;
    animation: loader-spin 0.8s linear infinite;
  }
}

@keyframes loader-spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: $text-secondary;
  letter-spacing: 0.05em;
}

.loading-dots::after {
  content: '';
  animation: loading-dots 1.5s steps(4, end) infinite;
}

@keyframes loading-dots {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
}

// ============================================
// 错误状态
// ============================================
.docs-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 48px;
  border-radius: var(--global-border-radius);
  text-align: center;

  .error-icon {
    font-size: 64px;
    margin-bottom: 20px;
  }

  .error-text {
    font-size: 16px;
    color: $text-secondary;
    margin-bottom: 24px;
  }

  .retry-btn {
    padding: 12px 32px;
  }
}

// ============================================
// 滚动动画
// ============================================
.scroll-reveal-item {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;

  &.revealed {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 文档内容 - 简洁现代
// ============================================
.docs-content {
  border-radius: var(--global-border-radius);
  padding: 32px 40px;
  box-sizing: border-box;
  position: fixed;
  top: calc(var(--global-header-height) + 12px);
  right: 12px;
  height: calc(100vh - var(--global-header-height) - 24px);
  overflow: hidden auto;
  background: var(--el-bg-color);

  .markdown-content {
    width: 100%;
  }

  :deep(.legal-update) {
    font-size: 12px;
    color: $text-muted;
    margin-bottom: 16px;
  }

  :deep(.legal-section-content) {
    margin-bottom: 32px;
    line-height: 1.8;
  }

  // 移除顶部装饰线

  :deep(h1) {
    font-size: 32px;
    font-weight: 700;
    color: $text-primary;
    margin: 0 0 24px;
    padding-bottom: 16px;
    letter-spacing: -0.02em;
    border-bottom: var(--unified-border-bottom);
  }

  :deep(h2) {
    font-size: 24px;
    font-weight: 600;
    color: $text-primary;
    margin: 40px 0 16px;
    padding-top: 0;
    letter-spacing: -0.01em;
  }

  :deep(h3) {
    font-size: 18px;
    font-weight: 600;
    color: $text-primary;
    margin: 28px 0 12px;
  }

  :deep(h4) {
    font-size: 15px;
    font-weight: 600;
    color: $text-secondary;
    margin: 20px 0 10px;
  }

  :deep(p) {
    font-size: 15px;
    line-height: 1.8;
    color: $text-secondary;
    margin: 0 0 16px;
  }

  :deep(ul), :deep(ol) {
    margin: 0 0 20px;
    padding-left: 24px;

    li {
      font-size: 15px;
      line-height: 1.8;
      color: $text-secondary;
      margin-bottom: 8px;
      position: relative;

      &::marker {
        color: $cyber-accent;
      }
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 24px 0;
    font-size: 14px;
    border-radius: var(--global-border-radius);
    overflow: hidden;
    border: var(--unified-border);

    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: var(--unified-border-bottom);
    }

    th {
      background: var(--color-gray-f5f6f7);
      font-weight: 600;
      color: $text-primary;
      font-size: 13px;
    }

    td {
      color: $text-secondary;
      transition: background 0.2s;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: var(--color-gray-f2f3f5);
    }
  }

  :deep(code) {
    font-family: var(--font-family-mono);
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  :deep(pre) {
    background: var(--color-gray-f8f9fa);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    padding: 16px 20px;
    margin: 20px 0;
    overflow-x: auto;

    code {
      display: block;
      font-family: var(--font-family-mono);
      font-size: 13px;
      line-height: 1.7;
      color: $text-primary;
      background: transparent;
      padding: 0;
      border: none;
      tab-size: 2;
    }
  }

  :deep(blockquote) {
    margin: 24px 0;
    padding: 16px 20px;
    background: var(--color-gray-f5f6f7);
    border-left: 4px solid $brand-primary;
    border-radius: 0 6px 6px 0;

    p {
      margin: 0;
      color: $text-secondary;
      font-style: normal;
    }
  }

  :deep(a) {
    color: $brand-primary;
    text-decoration: none;
    transition: all 0.2s;

    &:hover {
      color: $brand-primary-hover;
      text-decoration: underline;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: var(--global-border-radius);
    margin: 20px 0;
  }

  :deep(hr) {
    border: none;
    height: 1px;
    background: $border-subtle;
    margin: 32px 0;
  }

  // 徽章样式
  :deep(img[src*="badge"]), :deep(img[src*="shields.io"]) {
    display: inline-block;
    vertical-align: middle;
    margin: 4px 4px 4px 0;
    border-radius: var(--global-border-radius);
    border: none;
  }
}

// ============================================
// 文件查看器样式
// ============================================
.file-viewer {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .file-viewer-inline-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    .inline-office-viewer {
      flex: 1;
      min-height: 0;
    }
  }

  .file-viewer-media {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);

    &__img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    &__video {
      max-width: 100%;
      max-height: 100%;
    }

    &__audio {
      width: 100%;
      max-width: 480px;
    }
  }

  .file-viewer-inline-text {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: auto;
    padding: 24px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);

    &__loading,
    &__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 200px;

      .error-text {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin: 0;
      }
    }

    &__pre {
      margin: 0;
      padding: 16px;
      font-size: 13px;
      line-height: 1.6;
      color: var(--el-text-color-primary);
      background: var(--el-bg-color-page);
      border-radius: var(--global-border-radius);
      white-space: pre-wrap;
      word-break: break-word;
    }

    &__md {
      padding: 16px;
      background: var(--el-bg-color-page);
      border-radius: var(--global-border-radius);
    }
  }

  .file-viewer-inline-code {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: auto;
    padding: 24px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);

    &__loading,
    &__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 200px;

      .error-text {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin: 0;
      }
    }

    &__wrap {
      position: relative;
      background: var(--el-bg-color-page);
      border-radius: var(--global-border-radius);
      overflow: hidden;
    }

    &__lang {
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      z-index: var(--z-base);
    }

    &__pre {
      margin: 0;
      padding: 16px 16px 16px 24px;
      font-size: 13px;
      line-height: 1.5;
      overflow: auto;

      code {
        padding: 0;
        background: transparent;
        font-family: var(--font-family-mono);
      }
    }
  }

  .file-viewer-container {
    flex: 1;
    min-height: 0;
    width: 100%;
    position: relative;
  }

  .file-viewer-fallback {
    width: 100%;
    height: 100%;
    min-height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    padding: 24px;

    .fallback-message {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      text-align: center;
      margin: 0 0 20px;
      max-width: 420px;
    }

    .fallback-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;

      .cyber-btn {
        text-decoration: none;
      }
    }
  }

  .file-viewer-iframe {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
  }

  .iframe-loading-overlay,
  .iframe-error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--color-gray-f5f6f7);
    z-index: calc(var(--z-base) + 9);
  }

  .iframe-error-overlay {
    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .error-text {
      font-size: 14px;
      color: $text-secondary;
      margin-bottom: 20px;
      text-align: center;
      padding: 0 20px;
    }

    .retry-btn {
      padding: 10px 24px;
    }
  }
}

// ============================================
// 全屏按钮样式
// ============================================
.fullscreen-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: var(--z-header);
  width: var(--icon-btn-square-size);
  min-width: var(--icon-btn-square-size);
  height: var(--icon-btn-square-size);
  min-height: var(--icon-btn-square-size);
  padding: 0;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: $text-secondary;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  &:hover {
    border-color: $brand-primary;
    color: $brand-primary;
    background: $brand-primary-light;
  }
}

.exit-fullscreen-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: var(--z-notification);
  width: var(--icon-btn-square-size);
  min-width: var(--icon-btn-square-size);
  height: var(--icon-btn-square-size);
  min-height: var(--icon-btn-square-size);
  padding: 0;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: $text-secondary;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  &:hover {
    border-color: var(--color-danger-variant);
    color: var(--color-danger-variant);
    background: var(--color-red-fef0f0);
  }
}

// ============================================
// 全屏模式样式
// ============================================
.docs-content.is-fullscreen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 24px 48px;
  border-radius: 0;
  z-index: var(--z-notification);
  background: var(--el-bg-color);

  &::before {
    display: none;
  }

  .fullscreen-btn {
    top: 20px;
    right: 72px;
  }
}

// ============================================
// 返回顶部按钮
// ============================================
.back-to-top {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: calc(var(--z-base) + 49);

  /* 与浮动聊天条、上传按钮统一高度（46px 含边框） */
  &.cyber-btn--float {
    width: 46px;
    height: 46px;
  }

  &:hover {
    border-color: $brand-primary;
    color: $brand-primary;
  }

  .btn-ring {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
}

// ============================================
// 管理员上传按钮：与浮动聊天头部统一样式（同圆角、同描边、同背景，图标用主色）
// ============================================
.admin-upload-btn {
  position: fixed;
  bottom: 24px;

  /* 与 .floating-chat-trigger 不重叠：聊天按钮占 right: 24px 起 46px 宽，本按钮在其左侧，间距 12px */
  right: 82px; /* 24 + 46 + 12 */
  z-index: calc(var(--z-base) + 49);
  box-sizing: border-box;
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: var(--el-color-primary);
  /* 与浮动聊天触发按钮统一样式（46×46px 含边框） */
  &.cyber-btn--float {
    width: 46px;
    height: 46px;
  }

  &:hover {
    background: var(--el-fill-color-light);
    border-color: var(--el-border-color);
    color: var(--el-color-primary);
  }

  svg {
    color: inherit;
  }
}

// ============================================
// 上传对话框样式
// ============================================
.upload-dialog {
  :deep(.el-dialog) {
    background: var(--el-bg-color-page);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    }

  :deep(.el-dialog__title) {
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  :deep(.el-dialog__body) {
    color: var(--el-text-color-secondary);
  }
}

.upload-form {
  padding: 14px 20px;

  .form-item {
    margin-bottom: 12px;

    &:has(.file-hint) {
      margin-bottom: 4px;
    }

    label {
      display: block;
      margin-bottom: 4px;
      color: var(--el-text-color-primary);
      font-weight: 500;
      font-size: 14px;
    }
  }

  .file-input-row {
    display: flex;
    align-items: stretch;
    gap: 12px;
  }

  .file-input-cell {
    flex: 0 0 auto;
    width: 240px;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--upload-field-bg);
    border: var(--el-border-width-primary) solid var(--el-border-color);
    border-radius: var(--global-border-radius);
    transition: border-color 0.2s;

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
    }
  }

  .file-input-hidden {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    z-index: var(--z-base);
    font-size: 0;
  }

  .file-input-ui {
    position: relative;
    z-index: var(--z-0);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 12px 14px;
    min-height: 80px;
  }

  .file-input-trigger {
    display: inline-block;
    padding: 10px 20px;
    background: var(--upload-file-btn-bg);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    border-radius: var(--global-border-radius);
    color: var(--upload-file-btn-color);
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .file-input-status {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-align: center;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .file-hint {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 8px 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
    background: var(--upload-field-bg);
    border: var(--el-border-width-primary) solid var(--el-border-color);
    border-radius: var(--global-border-radius);
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 6px 8px;

    .file-hint-title {
      width: 100%;
      font-weight: 600;
      font-size: 12px;
      color: var(--el-text-color-primary);
      margin-bottom: 2px;
    }

    .format-group {
      display: inline-block;
      padding: 3px 8px;
      background: var(--el-bg-color-page);
      border-radius: var(--global-border-radius);
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .file-input-cell .file-preview-inline {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .file-preview-inline {
    .file-preview-label {
      font-weight: 600;
      font-size: 12px;
      color: var(--el-text-color-primary);
    }

    .preview-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .file-name {
      color: var(--el-text-color-primary);
      font-weight: 500;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      color: var(--el-color-primary);
      font-size: 12px;
      flex-shrink: 0;
    }
  }

  .file-preview {
    padding: 10px;
    background: var(--el-color-primary-light-9);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    border-radius: var(--global-border-radius);

    .preview-info {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .file-name {
        color: var(--el-text-color-primary);
        font-weight: 500;
      }

      .file-size {
        color: var(--el-color-primary);
        font-size: 12px;
      }
    }
  }

  .category-select {
    width: 100%;
    padding: 12px 36px 12px 12px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 16px;
    background-color: var(--upload-field-bg);
    border: var(--el-border-width-primary) solid var(--el-border-color);
    border-radius: var(--global-border-radius);
    color: var(--el-text-color-primary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
    }

    option {
      background: var(--el-bg-color-page);
      color: var(--el-text-color-primary);
    }
  }

  .text-input {
    width: 100%;
    padding: 10px;
    background: var(--upload-field-bg);
    border: var(--el-border-width-primary) solid var(--el-border-color);
    border-radius: var(--global-border-radius);
    color: var(--el-text-color-primary);
    font-size: 14px;
    transition: all 0.2s;

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
    }

    &:focus {
      outline: none;
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      background: var(--el-bg-color-page);
    }

    &::placeholder {
      color: var(--el-text-color-placeholder);
    }
  }

  .upload-mode-options {
    display: flex;
    flex-direction: row;
    gap: 12px;

    .mode-option {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 10px 12px;

      /* 亮色：中性灰 （--color-neutral-100），暗色：沿用 --el-fill-color-light */
      background: var(--upload-field-bg);
      border: var(--el-border-width-primary) solid var(--el-border-color);
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: all 0.2s;

      input[type="radio"] {
        display: none;
      }

      &:hover {
        border: var(--el-border-width-primary) solid var(--el-color-primary);
      }

      &.active {
        /* 亮色：纯白，暗色：纯黑；2px 描边 */
        background: var(--upload-option-active-bg);
        border: var(--el-border-width-primary) solid var(--el-color-primary);

        .mode-label {
          color: var(--el-color-primary);
        }
      }

      .mode-label {
        font-weight: 600;
        color: var(--el-text-color-primary);
        margin-bottom: 2px;
        font-size: 13px;
      }

      .mode-desc {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        line-height: 1.4;
      }
    }
  }
}

// ============================================
// 响应式
// ============================================
@media (width <= 1024px) {
  .docs-content {
    padding: 28px;
  }
}

// 移动端汉堡菜单按钮
.mobile-menu-btn {
  position: fixed;
  top: calc(var(--global-header-height) + 12px);
  left: 12px;
  z-index: var(--z-header);
  width: 44px;
  height: 44px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-dark-111111-90);
  backdrop-filter: blur(10px);
  border-radius: var(--global-border-radius);
}

// 移动端侧边栏遮罩
.mobile-sidebar-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-black-50);
  z-index: calc(var(--z-base) + 98);
}

@media (width <= 768px) {
  .docs-sidebar {
    width: 200px;
    max-width: 85vw;
    border-radius: var(--global-border-radius);
    z-index: var(--z-header);
    transform: translateX(calc(-100% - 12px));

    &.mobile-open {
      transform: translateX(0);
    }
  }

  .resize-handle {
    display: none;
  }

  .docs-content {
    left: 8px;
    right: 8px;
    padding: 16px;
    border-radius: var(--global-border-radius);

    :deep(h1) {
      font-size: 24px;
    }

    :deep(h2) {
      font-size: 18px;

      &::before {
        width: 3px;
        height: 18px;
      }
    }

    :deep(h3) {
      font-size: 16px;
    }

    :deep(table) {
      display: block;
      overflow-x: auto;
      font-size: 13px;

      th, td {
        padding: 10px 12px;
      }
    }
  }

  .header-title .title-text {
    display: none;
  }

  .back-to-top {
    bottom: 20px;

    &.cyber-btn--float {
      width: 44px;
      height: 44px;
    }
  }

  .admin-upload-btn {
    bottom: 80px;

    /* 与 .floating-chat-trigger 保持 12px 间距，不重叠 */
    right: 82px;
  }
}
</style>

<!-- 亮色模式适配 - 非 scoped 以确保选择器优先级 -->
<style lang="scss">
// ============================================
// 亮色模式适配
// ============================================
:where(html:not(.dark) body) .edu-docs-root {
  background: var(--el-fill-color-lighter);
}

:where(html:not(.dark) body) .edu-docs-root .glass-panel {
  background: var(--color-white-85);
  border-color: var(--border-unified-color);
}

:where(html:not(.dark) body) .edu-docs-root .cyber-btn {
  border-color: var(--border-unified-color);
  color: var(--el-text-color-primary);

  &:hover {
    border-color: var(--color-green-50);
    color: var(--el-text-color-primary);
  }

  &.active {
    border-color: var(--el-color-success);
    color: var(--el-color-success);
  }

  /* primary 按钮使用全局主色，不被上方默认样式覆盖 */
  &.cyber-btn--primary {
    background: var(--el-color-primary);
    border: none;
    color: var(--el-bg-color-page);

    &:hover {
      background: var(--el-color-primary-light-3);
      color: var(--el-bg-color-page);
    }
  }

  /* 管理员上传按钮：与浮动聊天头部统一样式（同圆角、同描边、同背景） */
  &.admin-upload-btn {
    background: var(--el-bg-color-page);
    border: var(--unified-border);
    color: var(--el-color-primary);

    &:hover {
      background: var(--el-fill-color-light);
      border-color: var(--el-border-color);
      color: var(--el-color-primary);
    }
  }
}

:where(html:not(.dark)) :where(body) :where(.edu-docs-root) .docs-sidebar {
  .toc-title {
    color: var(--el-color-success);
    border-bottom-color: var(--border-unified-color);

    &__icon {
      background: var(--el-color-success);
      animation: none;
    }
  }

  .toc-item {
    .toc-link {
      color: var(--el-text-color-secondary);

      &__indicator {
        background: var(--el-color-success);
      }

      &:hover {
        background: var(--color-green-glow);
        color: var(--el-text-color-primary);
      }
    }

    &.active .toc-link {
      background: var(--color-green-009664-12);
      color: var(--el-color-success);
    }

    &.toc-level-3 .toc-link {
      color: var(--el-text-color-placeholder);
    }
  }
}

:where(html:not(.dark)) :where(body) :where(.edu-docs-root) .doc-list-item {
  .toc-link {
    color: var(--el-text-color-secondary);
  }

  .doc-time {
    color: var(--el-text-color-placeholder);
  }

  &.active .toc-link {
    color: var(--el-color-success);
    background: var(--color-green-glow);
  }

  &:hover .toc-link {
    background: var(--color-green-009664-05);
    color: var(--el-text-color-primary);
  }
}

:where(html:not(.dark) body) .edu-docs-root .doc-group {
  border-bottom-color: var(--color-black-5);
}

:where(html:not(.dark) body) .edu-docs-root .doc-group-title {
  color: var(--el-text-color-secondary);
  background: var(--color-green-glow);
}

:where(html:not(.dark) body) .edu-docs-root .search-hint {
  color: var(--el-text-color-placeholder);
}

:where(html:not(.dark) body) .edu-docs-root .empty-hint {
  color: var(--el-text-color-placeholder);
}

:where(html:not(.dark)) :where(body) :where(.edu-docs-root) .empty-search {
  .empty-text {
    color: var(--el-text-color-placeholder);
  }
}

:where(html:not(.dark) body) .edu-docs-root .doc-list-resize-handle {
  &::before {
    background: var(--color-black-10);
  }

  &:hover {
    background: var(--color-green-009664-05);

    &::before {
      background: var(--color-green-50);
    }
  }
}

:where(html:not(.dark) body) .edu-docs-root .cyber-loader {
  &__ring:nth-child(1) {
    border-top-color: var(--el-color-success);
  }

  &__ring:nth-child(2) {
    border-right-color: var(--color-blue-006496-60);
  }

  &__core {
    background: var(--el-color-success);
  }
}

:where(html:not(.dark) body) .edu-docs-root .loading-text {
  color: var(--el-text-color-secondary);
}

:where(html:not(.dark)) :where(body) :where(.edu-docs-root) .docs-error .error-text {
  color: var(--el-text-color-secondary);
}

:where(html:not(.dark) body) .edu-docs-root .docs-content {
  &::before {
    background: var(--color-green-glow-3);
  }

  h1, h2, h3, h4 {
    color: var(--el-text-color-primary);
  }

  h1 {
    border-bottom-color: var(--border-unified-color);

    &::after {
      background: var(--el-color-success);
    }
  }

  h2 {
    border-top-color: var(--border-unified-color);

    &::before {
      background: var(--el-color-success);
    }
  }

  h3 {
    border-left-color: var(--color-green-50);
  }

  h4 {
    color: var(--el-text-color-secondary);
  }

  p, li {
    color: var(--el-text-color-secondary);
  }

  table {
    border-color: var(--border-unified-color);

    th {
      background: var(--color-green-glow);
      color: var(--el-text-color-primary);
    }

    th, td {
      border-bottom-color: var(--border-unified-color);
    }

    td {
      color: var(--el-text-color-secondary);
    }

    tr:hover td {
      background: var(--color-green-009664-04);
    }
  }

  code {
    color: var(--el-text-color-regular);
  }

  pre {
    background: var(--el-fill-color-lighter);
  }

  blockquote {
    background: var(--color-green-009664-06);
    border-left-color: var(--el-color-success);

    &::before {
      color: var(--el-color-success);
    }

    p {
      color: var(--el-text-color-primary);
    }
  }

  a {
    color: var(--el-color-success);

    &:hover {
      color: var(--el-color-success-dark-2);
    }
  }

  img {
    border-color: var(--border-unified-color);
  }

  hr {
    background: var(--color-black-10);
  }
}

:where(html:not(.dark) body) .edu-docs-root .back-to-top.cyber-btn {
  border-color: var(--border-unified-color);
  background: var(--color-white-80);
  color: var(--el-text-color-primary);

  &:hover {
    border-color: var(--color-green-50);
  }

  .btn-ring {
    border-color: var(--color-green-glow-3);
  }
}

:where(html:not(.dark) body) .edu-docs-root .fullscreen-btn {
  background: var(--color-white-80);
  border-color: var(--border-unified-color);
  color: var(--el-text-color-secondary);

  &:hover {
    background: var(--color-green-009664-10);
    border-color: var(--color-green-50);
    color: var(--el-color-success);
  }
}

:where(html:not(.dark) body) .edu-docs-root .exit-fullscreen-btn {
  background: var(--color-white-90);
  border-color: var(--color-green-50);
  color: var(--el-color-success);

  &:hover {
    background: var(--color-green-009664-15);
  }
}

:where(html:not(.dark) body) .edu-docs-root .docs-content.is-fullscreen {
  background: var(--color-white-98);
}

:where(html:not(.dark) body) .edu-docs-root .iframe-loading-overlay,
:where(html:not(.dark) body) .edu-docs-root .iframe-error-overlay {
  background: var(--color-white-90);
}

:where(html:not(.dark)) :where(body) :where(.edu-docs-root) .iframe-error-overlay .error-text {
  color: var(--el-text-color-secondary);
}

:where(html:not(.dark) body) .edu-docs-root .mobile-menu-btn {
  background: var(--color-white-90);
  border-color: var(--border-unified-color);
  color: var(--el-text-color-primary);
}



:where(html:not(.dark) body) .edu-docs-root .pulse-glow {
  animation: pulse-glow-light 2s ease-in-out infinite;
}

@keyframes pulse-glow-light {
  0%, 100% {
    filter: drop-shadow(0 0 5px var(--color-green-glow-2));
  }

  50% {
    filter: drop-shadow(0 0 15px var(--color-green-009664-40));
  }
}

// ============================================
// 暗色主题适配 - 文档页整体随系统/主题切换
// ============================================
:where(html.dark) body .edu-docs-root {
  background: var(--el-bg-color-page);
}

:where(html.dark) body .edu-docs-root .glass-panel {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
  }

:where(html.dark) body .edu-docs-root .cyber-btn {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);

  &:hover {
    border-color: var(--el-color-success);
    color: var(--el-color-success);
    background: rgb(var(--el-color-success-rgb), 0.12);
  }

  &.active {
    border-color: var(--el-color-success);
    color: var(--el-color-success);
    background: rgb(var(--el-color-success-rgb), 0.18);
  }

  &--float {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    }
}

:where(html.dark) body .edu-docs-root .docs-sidebar {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
  .toc-title,
  .doc-list-title {
    color: var(--el-text-color-primary);
    border-bottom-color: var(--el-border-color);
  }

  .doc-list-title {
    background: var(--el-bg-color);
  }

  .doc-group-title {
    color: var(--el-text-color-secondary);
    background: rgb(var(--el-color-success-rgb), 0.12);
    border-bottom-color: var(--color-white-6);
  }

  .doc-list-item .toc-link {
    color: var(--el-text-color-secondary);
  }

  .doc-list-item .doc-time {
    color: var(--el-text-color-placeholder);
  }

  .doc-list-item.active .toc-link {
    color: var(--el-color-success);
    background: rgb(var(--el-color-success-rgb), 0.15);
  }

  .doc-list-item:hover .toc-link {
    background: var(--color-white-6);
    color: var(--el-text-color-primary);
  }

  .toc-item .toc-link {
    color: var(--el-text-color-secondary);
  }

  .toc-item.active .toc-link {
    color: var(--el-color-success);
    background: rgb(var(--el-color-success-rgb), 0.15);
  }

  .toc-item .toc-link:hover {
    background: var(--color-white-6);
    color: var(--el-text-color-primary);
  }

  .search-hint,
  .empty-hint,
  .empty-search .empty-text {
    color: var(--el-text-color-placeholder);
  }

  .doc-list-resize-handle::before {
    background: var(--color-white-15);
  }

  .doc-list-resize-handle:hover {
    background: rgb(var(--el-color-success-rgb), 0.1);
  }

  .doc-list-resize-handle:hover::before {
    background: var(--el-color-success);
  }
}

:where(html.dark) body .edu-docs-root .docs-main {
  background: transparent;
}

/* 暗色下文档内容区：强制高对比度文字（覆盖 scoped 内的亮色变量） */
:where(html.dark) body .edu-docs-root .docs-content {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
}

:where(html.dark) body .edu-docs-root .docs-content::before {
  background: rgb(var(--el-color-success-rgb), 0.25);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content,
:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content p,
:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content li,
:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content td {
  color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content h1,
:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content h2,
:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content h3 {
  color: var(--el-text-color-primary);
  border-color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content h4 {
  color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content table th {
  background: var(--color-white-6);
  color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content table td {
  color: var(--el-text-color-primary);
  border-bottom-color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content code {
  color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content pre {
  background: var(--el-text-color-primary);
  border-color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content pre code {
  color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content blockquote,
:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content blockquote p {
  color: var(--el-text-color-primary);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content a {
  color: var(--el-color-success);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content ul li::marker,
:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content ol li::marker {
  color: var(--el-color-success);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content hr {
  background: var(--el-text-color-primary);
}

:where(html.dark) :where(body) :where(.edu-docs-root) .docs-content .markdown-content .legal-update {
  color: var(--el-text-color-primary);
}

:where(html.dark) body .edu-docs-root .docs-content.is-fullscreen {
  background: var(--el-bg-color);
}

:where(html.dark, body) :where(.edu-docs-root) :where(.docs-content) .markdown-content blockquote {
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  border-left-color: var(--el-color-success);
}

:where(html.dark) body .edu-docs-root .iframe-loading-overlay,
:where(html.dark) body .edu-docs-root .iframe-error-overlay {
  background: var(--el-bg-color);
}

:where(html.dark) body .edu-docs-root .iframe-error-overlay .error-text {
  color: var(--el-text-color-secondary);
}

:where(html.dark) body .edu-docs-root .file-viewer .file-viewer-iframe {
  background: var(--el-bg-color);
}

:where(html.dark) body .edu-docs-root .back-to-top.cyber-btn {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

:where(html.dark) body .edu-docs-root .fullscreen-btn,
:where(html.dark) body .edu-docs-root .exit-fullscreen-btn {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
  color: var(--el-text-color-secondary);
}

:where(html.dark) body .edu-docs-root .fullscreen-btn:hover,
:where(html.dark) body .edu-docs-root .exit-fullscreen-btn:hover {
  border-color: var(--el-color-success);
  color: var(--el-color-success);
  background: rgb(var(--el-color-success-rgb), 0.12);
}

:where(html.dark) body .edu-docs-root .mobile-menu-btn {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

:where(html.dark) body .edu-docs-root .cyber-loader__ring:nth-child(1) {
  border-top-color: var(--el-color-success);
}

:where(html.dark) body .edu-docs-root .cyber-loader__core {
  background: var(--el-color-success);
}

:where(html.dark) body .edu-docs-root .loading-text,
:where(html.dark) body .edu-docs-root .docs-error .error-text {
  color: var(--el-text-color-secondary);
}

// 仅 edu-docs 页：隐藏 Element Plus overlay，但保留上传对话框的 overlay
body.route-edu-docs .el-overlay:not(:has(.upload-dialog)) {
  display: none;
  visibility: hidden;
  pointer-events: none;
  opacity: 0;
}

// 上传对话框的 overlay 需要正常显示
body.route-edu-docs .el-overlay:has(.upload-dialog) {
  display: flex;
  visibility: visible;
  pointer-events: auto;
  opacity: 1;
}

// 原生上传对话框样式
.upload-dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-black-60);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.upload-dialog-content {
  /* 亮色：浮层容器 （--color-gray-fafafa）；暗色：沿用主题 */
  background: var(--el-fill-color-lighter);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  width: 620px;
  max-width: 92vw;
  max-height: 90vh;
  overflow: auto;
  }

/* 亮色模式下上传表单区域使用中性灰，避免偏蓝/过暗 */
html:not(.dark) .upload-dialog-content {
  --upload-field-bg: var(--color-neutral-100);
  --upload-option-active-bg: var(--el-bg-color);
  --upload-file-btn-bg: var(--el-bg-color);
  --upload-file-btn-color: var(--color-gray-111);
}

html.dark .upload-dialog-content {
  --upload-option-active-bg: var(--el-text-color-primary);
  --upload-file-btn-bg: var(--el-text-color-primary);
  --upload-file-btn-color: var(--color-gray-ededed);
}

@media (width <= 768px) {
  .upload-dialog-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .upload-dialog-content {
    width: 100%;
    max-width: 100%;
    max-height: 85vh;
    border-radius: var(--global-border-radius) 12px 0 0;
  }
}

.upload-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: var(--unified-border-bottom);

  h3 {
    margin: 0;
    font-size: 16px;
    color: var(--el-text-color-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    padding: 0;
    line-height: 1;

    &:hover {
      color: var(--el-color-danger);
    }
  }
}

.upload-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  border-top: var(--unified-border);
}

.edit-dialog {
  width: 400px;
}
</style>
