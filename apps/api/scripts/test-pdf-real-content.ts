/**
 * 验证 PDF 真实内容生成(对比修复前后)
 * 用法: pnpm --filter @ihui/api exec tsx scripts/test-pdf-real-content.ts
 */
import { writeFileSync } from 'node:fs'
import { generateReportPDF } from '../src/services/pdf-service.js'

const sampleData = {
  name: 'Li Sihan',
  studentId: 'S20260721001',
  lessonsCompleted: 42,
  examAvg: 88.5,
  notesCount: 18,
  videoMinutes: 1280,
  offlineHours: 24.5,
  certificatesCount: 3,
  homeworkSubmitted: 36,
}

const result = await generateReportPDF({
  title: 'Student Learning Report',
  subtitle: `Generated at ${new Date().toISOString()}`,
  sections: [
    {
      heading: 'Basic Information',
      content: `Name: ${sampleData.name}\nStudent ID: ${sampleData.studentId}\nReport Date: 2026-07-21`,
    },
    {
      heading: 'Course Progress',
      content: `Lessons Completed: ${sampleData.lessonsCompleted}\nVideo Study Time: ${sampleData.videoMinutes} minutes\nOffline Hours: ${sampleData.offlineHours} hours`,
    },
    {
      heading: 'Academic Performance',
      content: `Average Exam Score: ${sampleData.examAvg}\nHomework Submitted: ${sampleData.homeworkSubmitted}\nNotes Written: ${sampleData.notesCount}`,
    },
    {
      heading: 'Achievements',
      content: `Certificates Earned: ${sampleData.certificatesCount}\nStatus: Excellent Student`,
    },
  ],
  generatedAt: new Date(),
})

console.log('===== PDF Generation Result =====')
console.log('stub:', result.stub)
console.log('error:', result.error ?? '(none)')
console.log('size:', result.buffer.length, 'bytes')
console.log('header:', result.buffer.subarray(0, 8).toString('utf-8'))
const textContent = result.buffer.toString('latin1')
console.log('contains %%EOF:', textContent.includes('%%EOF'))
console.log('contains Helvetica font:', textContent.includes('Helvetica'))
console.log('contains FlateDecode (compressed stream):', textContent.includes('FlateDecode'))
console.log('contains text content stream:', textContent.includes('/Length') || textContent.includes('stream'))

const outputPath = process.env.OUTPUT_PATH ?? 'g:\\IHUI-AI\\.trae-cn\\tmp\\pdf-test-after.pdf'
writeFileSync(outputPath, result.buffer)
console.log('PDF written to:', outputPath)

if (result.stub) {
  console.error('FAIL: still generating stub PDF')
  process.exit(1)
}

if (result.buffer.length < 1000) {
  console.error('FAIL: PDF too small, expected > 1KB, got', result.buffer.length, 'bytes')
  process.exit(1)
}

if (!textContent.includes('Helvetica')) {
  console.error('FAIL: PDF does not reference Helvetica font')
  process.exit(1)
}

if (!textContent.includes('FlateDecode')) {
  console.error('FAIL: PDF does not contain FlateDecode compressed content stream')
  process.exit(1)
}

console.log('PASS: PDF contains real content (stub=false, size > 1KB, has Helvetica + FlateDecode content stream)')
