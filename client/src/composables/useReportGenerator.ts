/**
 * 学习档案报告生成器 composable
 *
 * 聚合 useStudentProfile 的所有数据，生成结构化报告对象：
 * - metadata: 报告元数据（生成时间、学员信息、统计摘要）
 * - sections: 报告 section 配置（哪些 section 显示/隐藏 + 数据引用）
 *
 * 用法：
 *   const { metadata, sections, generateReport } = useReportGenerator()
 *   await generateReport()
 */
import { computed } from 'vue'
import { useStudentProfile } from './useStudentProfile'
import type { CourseWithProgress, LearnStat } from './useStudentProfile'
import type {
  EduMember,
  EduExamRecord,
  EduCertificate,
} from '@/api/edu'
import type { LearningNote } from '@/api/edu/notes'
import type { OfflineRecord } from '@/api/edu/offline-records'
import type { UploadedCert } from '@/api/edu/uploaded-certs'
import type { DailyStat, CategoryStat, SkillRadarStat } from '@/api/edu/stats'

/** 报告元数据（打印/PDF 头部展示） */
export interface ReportMetadata {
  generatedAt: string
  studentName: string
  memberNo: string
  level: number
  totalLearnHours: number
  averageExamScore: number
  completionRate: number
  examPassRate: number
}

/** 报告 section 配置 */
export interface ReportSection {
  key: string
  title: string
  visible: boolean
  data: unknown
}

/** 完整报告对象 */
export interface GeneratedReport {
  metadata: ReportMetadata
  sections: ReportSection[]
}

/** section 数据载荷类型 */
interface SectionData {
  profile: EduMember | null
  learnStat: LearnStat | null
  courses: CourseWithProgress[]
  examRecords: EduExamRecord[]
  certificates: EduCertificate[]
  uploadedCerts: UploadedCert[]
  notes: LearningNote[]
  offlineRecords: OfflineRecord[]
  dailyStats: DailyStat[]
  categoryStats: CategoryStat[]
  skillRadar: SkillRadarStat[]
  weakSubjects: string[]
  totalLearnHours: number
  averageExamScore: number
  completionRate: number
  examPassRate: number
}

export function useReportGenerator() {
  const {
    profile,
    learnStat,
    courses,
    examRecords,
    certificates,
    uploadedCerts,
    notes,
    offlineRecords,
    dailyStats,
    categoryStats,
    skillRadar,
    weakSubjects,
    loadAll,
    totalLearnHours,
    averageExamScore,
    completionRate,
    examPassRate,
  } = useStudentProfile()

  const metadata = computed<ReportMetadata>(() => ({
    generatedAt: new Date().toISOString(),
    studentName: profile.value?.real_name || '-',
    memberNo: profile.value?.member_no || profile.value?.student_no || '-',
    level: profile.value?.level ?? 0,
    totalLearnHours: totalLearnHours.value,
    averageExamScore: averageExamScore.value,
    completionRate: completionRate.value,
    examPassRate: examPassRate.value,
  }))

  const sections = computed<ReportSection[]>(() => {
    const data: SectionData = {
      profile: profile.value,
      learnStat: learnStat.value,
      courses: courses.value,
      examRecords: examRecords.value,
      certificates: certificates.value,
      uploadedCerts: uploadedCerts.value,
      notes: notes.value,
      offlineRecords: offlineRecords.value,
      dailyStats: dailyStats.value,
      categoryStats: categoryStats.value,
      skillRadar: skillRadar.value,
      weakSubjects: weakSubjects.value,
      totalLearnHours: totalLearnHours.value,
      averageExamScore: averageExamScore.value,
      completionRate: completionRate.value,
      examPassRate: examPassRate.value,
    }

    return [
      {
        key: 'studentInfo',
        title: 'pageTitle',
        visible: true,
        data: data.profile,
      },
      {
        key: 'learningTrend',
        title: 'learningTrend',
        visible: data.dailyStats.length > 0,
        data: data.dailyStats,
      },
      {
        key: 'categoryDistribution',
        title: 'categoryDistribution',
        visible: data.categoryStats.length > 0,
        data: data.categoryStats,
      },
      {
        key: 'skillRadar',
        title: 'skillRadar',
        visible: data.skillRadar.length > 0,
        data: data.skillRadar,
      },
      {
        key: 'courseProgress',
        title: 'courseProgress',
        visible: data.courses.length > 0,
        data: data.courses,
      },
      {
        key: 'examRecords',
        title: 'examRecords',
        visible: data.examRecords.length > 0,
        data: data.examRecords,
      },
      {
        key: 'certificates',
        title: 'certificates',
        visible: data.certificates.length > 0 || data.uploadedCerts.length > 0,
        data: { online: data.certificates, uploaded: data.uploadedCerts },
      },
      {
        key: 'weakSubjects',
        title: 'weakSubjects',
        visible: data.weakSubjects.length > 0,
        data: data.weakSubjects,
      },
      {
        key: 'notes',
        title: 'myNotes',
        visible: data.notes.length > 0,
        data: data.notes,
      },
      {
        key: 'offlineRecords',
        title: 'offlineRecords',
        visible: data.offlineRecords.length > 0,
        data: data.offlineRecords,
      },
    ]
  })

  async function generateReport(): Promise<GeneratedReport> {
    await loadAll()
    return {
      metadata: metadata.value,
      sections: sections.value,
    }
  }

  return {
    metadata,
    sections,
    generateReport,
  }
}
