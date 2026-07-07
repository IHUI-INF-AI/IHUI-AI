/**
 * 学情分析报告多格式导出工具
 *
 * 支持 4 种格式：
 *  1. Markdown (.md) — 纯文本表格，通用可读
 *  2. Word (.docx) — 使用 docx 库生成结构化 Word 文档
 *  3. Excel (.xlsx) — 使用 exceljs 生成多 sheet 工作簿
 *  4. PDF — 由 exportService.ts 的 exportElementToPDF 处理（DOM 截图方式）
 *
 * 翻译：通过 i18n.global.t 获取当前语言标签，导出文件语言跟随用户 locale
 */
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx'
import ExcelJS from 'exceljs'
import i18n from '@/locales'
import { downloadText, downloadBlob } from '@/utils/download'
import type { ReportMetadata } from '@/composables/useReportGenerator'
import type { CourseWithProgress } from '@/composables/useStudentProfile'
import type {
  EduMember,
  EduExamRecord,
  EduCertificate,
} from '@/api/edu'
import type { LearningNote } from '@/api/edu/notes'
import type { OfflineRecord } from '@/api/edu/offline-records'
import type { UploadedCert } from '@/api/edu/uploaded-certs'
import type { DailyStat, CategoryStat, SkillRadarStat } from '@/api/edu/stats'

/** 导出数据载荷 */
export interface ReportExportData {
  metadata: ReportMetadata
  profile: EduMember | null
  weakSubjects: string[]
  dailyStats: DailyStat[]
  categoryStats: CategoryStat[]
  skillRadar: SkillRadarStat[]
  courses: CourseWithProgress[]
  examRecords: EduExamRecord[]
  certificates: EduCertificate[]
  uploadedCerts: UploadedCert[]
  notes: LearningNote[]
  offlineRecords: OfflineRecord[]
}

/** 导出格式类型 */
export type ExportFormat = 'pdf' | 'markdown' | 'word' | 'excel'

type TFunc = (key: string) => string

function getT(): TFunc {
  return (key: string) => {
    const global = i18n.global as unknown as { t: (k: string) => string }
    return global.t(key)
  }
}

/** 格式化日期为 YYYY-MM-DD */
function formatDate(iso: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

/** 格式化日期时间为 YYYY-MM-DD HH:mm */
function formatDateTime(iso: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

// ============================================================================
// Markdown 导出
// ============================================================================

/**
 * 将报告数据导出为 Markdown 文件
 */
export function exportReportToMarkdown(data: ReportExportData, filename: string): void {
  const t = getT()
  const md = buildMarkdownReport(data, t)
  const finalName = filename.endsWith('.md') ? filename : `${filename}.md`
  downloadText(md, finalName, 'text/markdown;charset=utf-8')
}

function buildMarkdownReport(data: ReportExportData, t: TFunc): string {
  const lines: string[] = []
  const m = data.metadata

  // 标题
  lines.push(`# ${t('edu.profile.reportTitle')}`)
  lines.push('')
  lines.push(`> ${t('edu.profile.reportSubtitle')}`)
  lines.push('')

  // 元数据
  lines.push(`## ${t('edu.profile.reportMetadata')}`)
  lines.push('')
  lines.push(`| ${t('edu.profile.reportGeneratedAt')} | ${formatDateTime(m.generatedAt)} |`)
  lines.push(`|---|---|`)
  lines.push(`| ${t('edu.profile.studentNameLabel')} | ${m.studentName} |`)
  lines.push(`| ${t('edu.profile.memberNo')} | ${m.memberNo} |`)
  lines.push(`| ${t('edu.profile.memberLevel')} | Lv.${m.level} |`)
  lines.push(`| ${t('edu.profile.statTotalLearnHours')} | ${m.totalLearnHours} |`)
  lines.push(`| ${t('edu.profile.statAverageExamScore')} | ${m.averageExamScore} |`)
  lines.push(`| ${t('edu.profile.statCompletionRate')} | ${m.completionRate}% |`)
  lines.push(`| ${t('edu.profile.statExamPassRate')} | ${m.examPassRate}% |`)
  lines.push('')

  // 薄弱科目
  if (data.weakSubjects.length > 0) {
    lines.push(`## ${t('edu.profile.weakSubjects')}`)
    lines.push('')
    for (const s of data.weakSubjects) {
      lines.push(`- ${s}`)
    }
    lines.push('')
  }

  // 学习趋势
  if (data.dailyStats.length > 0) {
    lines.push(`## ${t('edu.profile.learningTrend')}`)
    lines.push('')
    lines.push(`| Date | ${t('edu.profile.statTotalLearnHours')} (min) |`)
    lines.push(`|---|---|`)
    for (const d of data.dailyStats) {
      lines.push(`| ${d.date} | ${d.minutes} |`)
    }
    lines.push('')
  }

  // 科目分布
  if (data.categoryStats.length > 0) {
    lines.push(`## ${t('edu.profile.categoryDistribution')}`)
    lines.push('')
    lines.push(`| ${t('edu.profile.categoryDistribution')} | min | count |`)
    lines.push(`|---|---|---|`)
    for (const c of data.categoryStats) {
      lines.push(`| ${c.category} | ${c.minutes} | ${c.count} |`)
    }
    lines.push('')
  }

  // 技能雷达
  if (data.skillRadar.length > 0) {
    lines.push(`## ${t('edu.profile.skillRadar')}`)
    lines.push('')
    lines.push(`| skill | score |`)
    lines.push(`|---|---|`)
    for (const s of data.skillRadar) {
      lines.push(`| ${s.skill} | ${s.score} |`)
    }
    lines.push('')
  }

  // 课程进度
  if (data.courses.length > 0) {
    lines.push(`## ${t('edu.profile.courseProgress')}`)
    lines.push('')
    lines.push(`| ${t('edu.profile.courseProgress')} | % |`)
    lines.push(`|---|---|`)
    for (const c of data.courses) {
      lines.push(`| ${c.course.title} | ${c.completion}% |`)
    }
    lines.push('')
  }

  // 考试记录
  if (data.examRecords.length > 0) {
    lines.push(`## ${t('edu.profile.examRecords')}`)
    lines.push('')
    lines.push(`| ID | ${t('edu.profile.statAverageExamScore')} | ${t('edu.profile.statExamPassRate')} |`)
    lines.push(`|---|---|---|`)
    for (const e of data.examRecords) {
      const passStr = e.is_passed ? '✓' : '✗'
      lines.push(`| ${e.id} | ${e.score ?? '-'} | ${passStr} |`)
    }
    lines.push('')
  }

  // 证书
  if (data.certificates.length > 0 || data.uploadedCerts.length > 0) {
    lines.push(`## ${t('edu.profile.certificates')}`)
    lines.push('')
    lines.push(`| ${t('edu.profile.certTitleLabel')} | ${t('edu.profile.certIssuerLabel')} | ${t('edu.profile.certIssueDateLabel')} |`)
    lines.push(`|---|---|---|`)
    for (const c of data.certificates) {
      lines.push(`| ${c.title} | ${c.certificate_no} | ${formatDate(c.issue_date)} |`)
    }
    for (const c of data.uploadedCerts) {
      lines.push(`| ${c.title} | ${c.issuer} | ${formatDate(c.issue_date)} |`)
    }
    lines.push('')
  }

  // 笔记
  if (data.notes.length > 0) {
    lines.push(`## ${t('edu.profile.myNotes')}`)
    lines.push('')
    for (const n of data.notes) {
      lines.push(`### ${n.title}`)
      lines.push('')
      const truncated = n.content.length > 200
        ? Array.from(n.content).slice(0, 200).join('')
        : n.content
      lines.push(truncated)
      if (n.content.length > 200) lines.push('...')
      lines.push('')
    }
  }

  // 线下记录
  if (data.offlineRecords.length > 0) {
    lines.push(`## ${t('edu.profile.offlineRecords')}`)
    lines.push('')
    lines.push(`| ${t('edu.profile.offlineTitleField')} | ${t('edu.profile.offlineDate')} | ${t('edu.profile.offlineDuration')} |`)
    lines.push(`|---|---|---|`)
    for (const r of data.offlineRecords) {
      lines.push(`| ${r.title} | ${formatDate(r.record_date)} | ${r.duration_minutes} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// Word (.docx) 导出
// ============================================================================

/**
 * 将报告数据导出为 Word (.docx) 文件
 */
export async function exportReportToWord(data: ReportExportData, filename: string): Promise<void> {
  const t = getT()
  const doc = buildWordDocument(data, t)
  const blob = await Packer.toBlob(doc)
  const finalName = filename.endsWith('.docx') ? filename : `${filename}.docx`
  downloadBlob(blob, finalName)
}

function buildWordDocument(data: ReportExportData, t: TFunc): Document {
  const m = data.metadata
  const children: (Paragraph | Table)[] = []

  // 标题
  children.push(
    new Paragraph({
      text: t('edu.profile.reportTitle'),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  )

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: t('edu.profile.reportSubtitle'),
          color: '666666',
          size: 20,
        }),
      ],
    })
  )

  // 元数据表
  children.push(
    new Paragraph({
      text: t('edu.profile.reportMetadata'),
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 },
    })
  )

  const metaRows = [
    [t('edu.profile.reportGeneratedAt'), formatDateTime(m.generatedAt)],
    [t('edu.profile.studentNameLabel'), m.studentName],
    [t('edu.profile.memberNo'), m.memberNo],
    [t('edu.profile.memberLevel'), `Lv.${m.level}`],
    [t('edu.profile.statTotalLearnHours'), String(m.totalLearnHours)],
    [t('edu.profile.statAverageExamScore'), String(m.averageExamScore)],
    [t('edu.profile.statCompletionRate'), `${m.completionRate}%`],
    [t('edu.profile.statExamPassRate'), `${m.examPassRate}%`],
  ]

  children.push(buildWordTable(metaRows))

  // 薄弱科目
  if (data.weakSubjects.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.weakSubjects'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    for (const s of data.weakSubjects) {
      children.push(
        new Paragraph({
          text: s,
          bullet: { level: 0 },
        })
      )
    }
  }

  // 学习趋势
  if (data.dailyStats.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.learningTrend'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    const trendRows: string[][] = [
      ['Date', 'min'],
      ...data.dailyStats.map(d => [d.date, String(d.minutes)]),
    ]
    children.push(buildWordTable(trendRows))
  }

  // 科目分布
  if (data.categoryStats.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.categoryDistribution'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    const catRows: string[][] = [
      [t('edu.profile.categoryDistribution'), 'min', 'count'],
      ...data.categoryStats.map(c => [c.category, String(c.minutes), String(c.count)]),
    ]
    children.push(buildWordTable(catRows))
  }

  // 技能雷达
  if (data.skillRadar.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.skillRadar'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    const radarRows: string[][] = [
      ['skill', 'score'],
      ...data.skillRadar.map(s => [s.skill, String(s.score)]),
    ]
    children.push(buildWordTable(radarRows))
  }

  // 课程进度
  if (data.courses.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.courseProgress'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    const courseRows: string[][] = [
      [t('edu.profile.courseProgress'), '%'],
      ...data.courses.map(c => [c.course.title, `${c.completion}%`]),
    ]
    children.push(buildWordTable(courseRows))
  }

  // 考试记录
  if (data.examRecords.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.examRecords'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    const examRows: string[][] = [
      ['ID', t('edu.profile.statAverageExamScore'), t('edu.profile.statExamPassRate')],
      ...data.examRecords.map(e => [
        String(e.id),
        String(e.score ?? '-'),
        e.is_passed ? '✓' : '✗',
      ]),
    ]
    children.push(buildWordTable(examRows))
  }

  // 证书
  if (data.certificates.length > 0 || data.uploadedCerts.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.certificates'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    const certRows: string[][] = [
      [t('edu.profile.certTitleLabel'), t('edu.profile.certIssuerLabel'), t('edu.profile.certIssueDateLabel')],
    ]
    for (const c of data.certificates) {
      certRows.push([c.title, c.certificate_no, formatDate(c.issue_date)])
    }
    for (const c of data.uploadedCerts) {
      certRows.push([c.title, c.issuer, formatDate(c.issue_date)])
    }
    children.push(buildWordTable(certRows))
  }

  // 笔记
  if (data.notes.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.myNotes'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    for (const n of data.notes) {
      children.push(
        new Paragraph({
          text: n.title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
        })
      )
      const content = n.content.length > 200
        ? Array.from(n.content).slice(0, 200).join('') + '...'
        : n.content
      children.push(
        new Paragraph({
          text: content,
          spacing: { after: 120 },
        })
      )
    }
  }

  // 线下记录
  if (data.offlineRecords.length > 0) {
    children.push(
      new Paragraph({
        text: t('edu.profile.offlineRecords'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    )
    const offlineRows: string[][] = [
      [t('edu.profile.offlineTitleField'), t('edu.profile.offlineDate'), t('edu.profile.offlineDuration')],
      ...data.offlineRecords.map(r => [r.title, formatDate(r.record_date), String(r.duration_minutes)]),
    ]
    children.push(buildWordTable(offlineRows))
  }

  return new Document({
    sections: [{
      properties: {},
      children,
    }],
  })
}

function buildWordTable(rows: string[][]): Table {
  const noBorder = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, rowIdx) => {
      return new TableRow({
        tableHeader: rowIdx === 0,
        children: cells.map(cellText => {
          return new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cellText,
                    bold: rowIdx === 0,
                    size: rowIdx === 0 ? 22 : 20,
                  }),
                ],
              }),
            ],
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
            },
          })
        }),
      })
    }),
  })
}

// ============================================================================
// Excel (.xlsx) 导出
// ============================================================================

/**
 * 将报告数据导出为 Excel (.xlsx) 文件
 */
export async function exportReportToExcel(data: ReportExportData, filename: string): Promise<void> {
  const t = getT()
  const wb = new ExcelJS.Workbook()
  const m = data.metadata

  /** Excel sheet 名称安全化：移除非法字符，截断到 31 字符 */
  function safeSheetName(name: string): string {
    return name.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Sheet'
  }

  // Sheet 1: 元数据
  const metaSheet = wb.addWorksheet(safeSheetName(t('edu.profile.reportMetadata')))
  metaSheet.columns = [
    { header: t('edu.profile.reportGeneratedAt'), key: 'label', width: 28 },
    { header: '', key: 'value', width: 32 },
  ]
  const metaData = [
    [t('edu.profile.reportGeneratedAt'), formatDateTime(m.generatedAt)],
    [t('edu.profile.studentNameLabel'), m.studentName],
    [t('edu.profile.memberNo'), m.memberNo],
    [t('edu.profile.memberLevel'), `Lv.${m.level}`],
    [t('edu.profile.statTotalLearnHours'), m.totalLearnHours],
    [t('edu.profile.statAverageExamScore'), m.averageExamScore],
    [t('edu.profile.statCompletionRate'), `${m.completionRate}%`],
    [t('edu.profile.statExamPassRate'), `${m.examPassRate}%`],
  ]
  for (const [label, value] of metaData) {
    metaSheet.addRow({ label, value })
  }
  styleHeaderRow(metaSheet)

  // Sheet 2: 薄弱科目
  if (data.weakSubjects.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.weakSubjects')))
    ws.columns = [{ header: t('edu.profile.weakSubjects'), key: 'subject', width: 30 }]
    for (const s of data.weakSubjects) {
      ws.addRow({ subject: s })
    }
    styleHeaderRow(ws)
  }

  // Sheet 3: 学习趋势
  if (data.dailyStats.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.learningTrend')))
    ws.columns = [
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Minutes', key: 'minutes', width: 12 },
    ]
    for (const d of data.dailyStats) {
      ws.addRow({ date: d.date, minutes: d.minutes })
    }
    styleHeaderRow(ws)
  }

  // Sheet 4: 科目分布
  if (data.categoryStats.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.categoryDistribution')))
    ws.columns = [
      { header: t('edu.profile.categoryDistribution'), key: 'category', width: 24 },
      { header: 'Minutes', key: 'minutes', width: 12 },
      { header: 'Count', key: 'count', width: 10 },
    ]
    for (const c of data.categoryStats) {
      ws.addRow({ category: c.category, minutes: c.minutes, count: c.count })
    }
    styleHeaderRow(ws)
  }

  // Sheet 5: 技能雷达
  if (data.skillRadar.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.skillRadar')))
    ws.columns = [
      { header: 'Skill', key: 'skill', width: 24 },
      { header: 'Score', key: 'score', width: 10 },
    ]
    for (const s of data.skillRadar) {
      ws.addRow({ skill: s.skill, score: s.score })
    }
    styleHeaderRow(ws)
  }

  // Sheet 6: 课程进度
  if (data.courses.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.courseProgress')))
    ws.columns = [
      { header: t('edu.profile.courseProgress'), key: 'title', width: 40 },
      { header: 'Completion (%)', key: 'completion', width: 16 },
    ]
    for (const c of data.courses) {
      ws.addRow({ title: c.course.title, completion: c.completion })
    }
    styleHeaderRow(ws)
  }

  // Sheet 7: 考试记录
  if (data.examRecords.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.examRecords')))
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: t('edu.profile.statAverageExamScore'), key: 'score', width: 14 },
      { header: t('edu.profile.statExamPassRate'), key: 'passed', width: 10 },
    ]
    for (const e of data.examRecords) {
      ws.addRow({ id: e.id, score: e.score ?? '-', passed: e.is_passed ? '✓' : '✗' })
    }
    styleHeaderRow(ws)
  }

  // Sheet 8: 证书
  const allCerts = [
    ...data.certificates.map(c => ({ title: c.title, issuer: c.certificate_no, date: formatDate(c.issue_date) })),
    ...data.uploadedCerts.map(c => ({ title: c.title, issuer: c.issuer, date: formatDate(c.issue_date) })),
  ]
  if (allCerts.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.certificates')))
    ws.columns = [
      { header: t('edu.profile.certTitleLabel'), key: 'title', width: 30 },
      { header: t('edu.profile.certIssuerLabel'), key: 'issuer', width: 24 },
      { header: t('edu.profile.certIssueDateLabel'), key: 'date', width: 16 },
    ]
    for (const c of allCerts) {
      ws.addRow(c)
    }
    styleHeaderRow(ws)
  }

  // Sheet 9: 笔记
  if (data.notes.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.myNotes')))
    ws.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Content', key: 'content', width: 60 },
    ]
    for (const n of data.notes) {
      const content = n.content.length > 200
        ? Array.from(n.content).slice(0, 200).join('') + '...'
        : n.content
      ws.addRow({ title: n.title, content })
    }
    styleHeaderRow(ws)
  }

  // Sheet 10: 线下记录
  if (data.offlineRecords.length > 0) {
    const ws = wb.addWorksheet(safeSheetName(t('edu.profile.offlineRecords')))
    ws.columns = [
      { header: t('edu.profile.offlineTitleField'), key: 'title', width: 30 },
      { header: t('edu.profile.offlineDate'), key: 'date', width: 16 },
      { header: t('edu.profile.offlineDuration'), key: 'duration', width: 14 },
    ]
    for (const r of data.offlineRecords) {
      ws.addRow({ title: r.title, date: formatDate(r.record_date), duration: r.duration_minutes })
    }
    styleHeaderRow(ws)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  downloadBlob(blob, finalName)
}

function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
}

// ============================================================================
// 统一入口：根据格式类型分发
// ============================================================================

/**
 * 根据格式类型导出报告
 * @param format 导出格式
 * @param data 报告数据
 * @param filename 文件名（不含扩展名）
 */
export async function exportReportByFormat(
  format: ExportFormat,
  data: ReportExportData,
  filename: string,
): Promise<void> {
  switch (format) {
    case 'markdown':
      exportReportToMarkdown(data, filename)
      break
    case 'word':
      await exportReportToWord(data, filename)
      break
    case 'excel':
      await exportReportToExcel(data, filename)
      break
    case 'pdf':
      // PDF 由调用方通过 exportElementToPDF 处理（DOM 截图方式）
      throw new Error('PDF export should be handled by exportElementToPDF in the calling component')
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}
