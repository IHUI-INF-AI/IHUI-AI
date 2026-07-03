/**
 * 学员档案模块 CRUD 源码级守门 (PR-F F8)
 *
 * 2026-07-03 创建: 固化学员档案 5 类核心功能的源码结构，防止关键文件被误删 / 关键模式被破坏。
 *
 * 覆盖:
 * - 5 个核心 View 页面存在 (Profile / Report / Notes / OfflineRecords / CertUpload)
 * - PR-E 新增 Papers / PaperUpload 页面存在
 * - 4 个 Dialog/List 组件存在 (NoteDialog / OfflineRecordDialog / CertificateList / UploadedPapersList)
 * - useStudentProfile singleton + 8 section refresh + uploadedPapers ref
 * - useAiReportEngine 纯函数 + composable 双导出
 * - 6 语言 edu.json 包含 entryCardTitle + dirtyConfirm 键
 *
 * 运行方式:
 *   npx playwright test e2e/edu-profile-crud.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CLIENT_ROOT = join(process.cwd(), 'src')

function readSrc(relPath: string): string {
  const abs = join(CLIENT_ROOT, relPath)
  if (!existsSync(abs)) {
    throw new Error(`文件不存在: ${abs}`)
  }
  return readFileSync(abs, 'utf-8')
}

function readEduI18n(locale: string): string {
  const abs = join(CLIENT_ROOT, 'locales', 'modules', locale, 'edu.json')
  if (!existsSync(abs)) {
    throw new Error(`i18n 文件不存在: ${abs}`)
  }
  return readFileSync(abs, 'utf-8')
}

// ============================================================================
// 5 类核心 View 页面存在性
// ============================================================================

test.describe('学员档案模块 - 核心 View 页面存在', () => {
  test('Profile.vue 存在 + 包含骨架屏 + AiReportSection 集成', () => {
    const content = readSrc('views/edu/member/Profile.vue')
    expect(content).toBeTruthy()
    // PR-F F6 骨架屏
    expect(content).toMatch(/profile-skeleton/)
    expect(content).toMatch(/el-skeleton/)
    // PR-D D4 AiReportSection 集成
    expect(content).toMatch(/AiReportSection/)
    // PR-E E7 试卷预览区块
    expect(content).toMatch(/UploadedPapersList/)
  })

  test('Report.vue 存在', () => {
    const content = readSrc('views/edu/member/Report.vue')
    expect(content).toBeTruthy()
  })

  test('Notes.vue 存在 + 骨架屏', () => {
    const content = readSrc('views/edu/member/Notes.vue')
    expect(content).toBeTruthy()
    // PR-F F6 骨架屏
    expect(content).toMatch(/notes-skeleton/)
  })

  test('OfflineRecords.vue 存在 + 骨架屏', () => {
    const content = readSrc('views/edu/member/OfflineRecords.vue')
    expect(content).toBeTruthy()
    // PR-F F6 骨架屏
    expect(content).toMatch(/offline-skeleton/)
  })

  test('CertUpload.vue 存在 + validateFile 接入', () => {
    const content = readSrc('views/edu/member/CertUpload.vue')
    expect(content).toBeTruthy()
    // PR-F F5 文件校验接入
    expect(content).toMatch(/import \{ validateFile \} from '@\/utils\/fileValidation'/)
  })

  test('PR-E: Papers.vue 存在', () => {
    const content = readSrc('views/edu/member/Papers.vue')
    expect(content).toBeTruthy()
  })

  test('PR-E: PaperUpload.vue 存在', () => {
    const content = readSrc('views/edu/member/PaperUpload.vue')
    expect(content).toBeTruthy()
  })

  test('PR-E: PaperUploadForm.vue 存在 + validateFile 接入', () => {
    const content = readSrc('views/edu/member/PaperUploadForm.vue')
    expect(content).toBeTruthy()
    expect(content).toMatch(/import \{ validateFile \} from '@\/utils\/fileValidation'/)
  })
})

// ============================================================================
// 关键组件存在性
// ============================================================================

test.describe('学员档案模块 - 关键组件存在', () => {
  test('NoteDialog.vue 存在 + dirty 检测 + validateFile 接入', () => {
    const content = readSrc('components/edu/NoteDialog.vue')
    expect(content).toBeTruthy()
    // PR-F F4 dirty 检测
    expect(content).toMatch(/initialSnapshot/)
    expect(content).toMatch(/isDirty/)
    expect(content).toMatch(/handleBeforeClose/)
    expect(content).toMatch(/ElMessageBox\.confirm/)
    // PR-F F5 文件校验
    expect(content).toMatch(/import \{ validateFile \} from '@\/utils\/fileValidation'/)
    // PR-F F7 焦点管理
    expect(content).toMatch(/input\?\.focus\(\)/)
  })

  test('OfflineRecordDialog.vue 存在 + dirty 检测 + validateFile 接入', () => {
    const content = readSrc('components/edu/OfflineRecordDialog.vue')
    expect(content).toBeTruthy()
    // PR-F F4 dirty 检测
    expect(content).toMatch(/initialSnapshot/)
    expect(content).toMatch(/isDirty/)
    expect(content).toMatch(/handleBeforeClose/)
    // PR-F F5 文件校验
    expect(content).toMatch(/import \{ validateFile \} from '@\/utils\/fileValidation'/)
    // PR-F F7 焦点管理
    expect(content).toMatch(/input\?\.focus\(\)/)
  })

  test('CertificateList.vue 存在', () => {
    const content = readSrc('components/edu/CertificateList.vue')
    expect(content).toBeTruthy()
  })

  test('PR-E: UploadedPapersList.vue 存在 + aria-label', () => {
    const content = readSrc('components/edu/UploadedPapersList.vue')
    expect(content).toBeTruthy()
    // PR-F F7 aria-label
    expect(content).toMatch(/:aria-label/)
  })

  test('PR-D: AiReportSection.vue 存在', () => {
    const content = readSrc('components/edu/AiReportSection.vue')
    expect(content).toBeTruthy()
  })

  test('streaming 前端准备: AiReportSection.vue chat 模式含 chatConsulted 状态分支', () => {
    const content = readSrc('components/edu/AiReportSection.vue')
    // chatConsulted 状态分支（已发送/未发送两种 UI）
    expect(content).toMatch(/chatConsulted/)
    expect(content).toMatch(/aiReportChatSent/)
    expect(content).toMatch(/aiReportChatResend/)
    // CircleCheckFilled 图标（已发送状态）
    expect(content).toMatch(/CircleCheckFilled/)
  })

  test('PR-F F1: LearningProfileEntryCard.vue 存在 + 跳转 /edu/member', () => {
    const content = readSrc('components/edu/LearningProfileEntryCard.vue')
    expect(content).toBeTruthy()
    expect(content).toMatch(/router\.push\('\/edu\/member'\)/)
    // PR-F F7 aria-label + tabindex
    expect(content).toMatch(/aria-label/)
    expect(content).toMatch(/tabindex="0"/)
  })
})

// ============================================================================
// Composable 结构守门
// ============================================================================

test.describe('学员档案模块 - Composable 结构守门', () => {
  test('useStudentProfile.ts: singleton + 8 section + uploadedPapers ref', () => {
    const content = readSrc('composables/useStudentProfile.ts')
    expect(content).toBeTruthy()
    // singleton + inflight 去重
    expect(content).toMatch(/let singleton/)
    expect(content).toMatch(/let inflight/)
    expect(content).toMatch(/resetStudentProfile/)
    // 8 section refresh（notes/offline/certs/exams/courses/wrongbook/ai-report/papers）
    expect(content).toMatch(/'notes'/)
    expect(content).toMatch(/'offline'/)
    expect(content).toMatch(/'certs'/)
    expect(content).toMatch(/'exams'/)
    expect(content).toMatch(/'courses'/)
    expect(content).toMatch(/'wrongbook'/    )
    expect(content).toMatch(/'ai-report'/)
    expect(content).toMatch(/'papers'/)
    // uploadedPapers ref + API import
    expect(content).toMatch(/const uploadedPapers = ref<UploadedPaper\[\]>\(\[\]\)/)
    expect(content).toMatch(/import \{ uploadedPapersApi \} from '@\/api\/edu\/uploaded-papers'/)
  })

  test('useAiReportEngine.ts: 纯函数 + composable 双导出 + 5 条规则', () => {
    const content = readSrc('composables/useAiReportEngine.ts')
    expect(content).toBeTruthy()
    // 双导出
    expect(content).toMatch(/export function generateLocalSuggestions/)
    expect(content).toMatch(/export function useAiReportEngine/)
    // 5 条规则阈值常量
    expect(content).toMatch(/STRENGTH_SCORE/)
    expect(content).toMatch(/WEAKNESS_SCORE/)
    expect(content).toMatch(/PLAN_COMPLETION_RATE/)
    expect(content).toMatch(/RISK_INACTIVE_DAYS/)
    expect(content).toMatch(/TIP_NOTES_COUNT/)
  })

  test('streaming 前端准备: useAiReportEngine chatConsulted + autoSend', () => {
    const content = readSrc('composables/useAiReportEngine.ts')
    // chatConsulted ref（标记已发送到 AI 对话面板）
    expect(content).toMatch(/chatConsulted/)
    // autoSend: true（自动发送 prompt）
    expect(content).toMatch(/autoSend:\s*true/)
  })

  test('streaming 前端准备: useGlobalChat autoSend + sendMessage 接口', () => {
    const content = readSrc('composables/useGlobalChat.ts')
    // OpenChatOptions 含 autoSend 字段
    expect(content).toMatch(/autoSend\?:\s*boolean/)
    // FloatingChatRef 含 sendMessage 方法
    expect(content).toMatch(/sendMessage\?:\s*\(\)\s*=>\s*Promise<void>/)
    // open() 中 autoSend 逻辑
    expect(content).toMatch(/options\?\.autoSend/)
    expect(content).toMatch(/chatRef\.sendMessage/)
  })

  test('streaming 前端准备: AIChat.vue defineExpose 含 sendMessage', () => {
    const content = readSrc('components/ai/AIChat.vue')
    // defineExpose 中暴露 sendMessage（包装 handleSend）
    expect(content).toMatch(/sendMessage:\s*handleSend/)
  })

  test('PR-F F3: auth.logout 调用 resetStudentProfile', () => {
    const content = readSrc('stores/auth/index.ts')
    expect(content).toBeTruthy()
    expect(content).toMatch(/resetStudentProfile/)
  })
})

// ============================================================================
// i18n 6 语言关键键守门
// ============================================================================

test.describe('学员档案模块 - i18n 6 语言关键键', () => {
  const locales = ['zh-CN', 'en', 'en-US', 'zh-TW', 'ja', 'ko']

  for (const locale of locales) {
    test(`${locale}/edu.json 包含 entryCardTitle + dirtyConfirm`, () => {
      const content = readEduI18n(locale)
      expect(content).toBeTruthy()
      // PR-F F1+F2 入口卡
      expect(content).toMatch(/"entryCardTitle"/)
      expect(content).toMatch(/"entryCardDesc"/)
      // PR-F F4 dirty 检测
      expect(content).toMatch(/"dirtyConfirm"/)
      expect(content).toMatch(/"discard"/)
      expect(content).toMatch(/"keepEditing"/)
      // PR-E 试卷相关
      expect(content).toMatch(/"paperUploadTitle"/)
      expect(content).toMatch(/"papersTitle"/)
      // PR-D AI 报告相关
      expect(content).toMatch(/"aiReportTitle"/)
      // streaming 前端准备：chat 模式已发送状态
      expect(content).toMatch(/"aiReportChatSent"/)
      expect(content).toMatch(/"aiReportChatResend"/)
    })
  }
})

// ============================================================================
// API 契约守门
// ============================================================================

test.describe('学员档案模块 - API 契约守门', () => {
  test('PR-E: uploaded-papers.ts API 存在 + 4 方法', () => {
    const content = readSrc('api/edu/uploaded-papers.ts')
    expect(content).toBeTruthy()
    expect(content).toMatch(/export type PaperType/)
    expect(content).toMatch(/export type PaperSubject/)
    expect(content).toMatch(/export interface UploadedPaper/)
    expect(content).toMatch(/uploadedPapersApi/)
    expect(content).toMatch(/list:/)
    expect(content).toMatch(/create:/)
    expect(content).toMatch(/update:/)
    expect(content).toMatch(/delete:/)
  })

  test('PR-D: ai-report.ts API 存在', () => {
    const content = readSrc('api/edu/ai-report.ts')
    expect(content).toBeTruthy()
    expect(content).toMatch(/aiReportApi/)
  })
})
