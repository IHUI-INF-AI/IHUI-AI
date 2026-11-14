// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  courseLessonProgressPercent,
  toCourseLessonRows,
  type CourseOutlineItem,
} from '../course-lessons'

const OUTLINE: CourseOutlineItem[] = [
  { title: '认识课程' },
  { title: '环境搭建' },
  { title: '第一个组件' },
  { title: '状态管理' },
]

describe('course-lessons 契约', () => {
  it('未开始时:首节 current,其余未完成未锁(免费课)', () => {
    const rows = toCourseLessonRows(OUTLINE, 0, 0)
    expect(rows.map((r) => r.current)).toEqual([true, false, false, false])
    expect(rows.map((r) => r.completed)).toEqual([false, false, false, false])
    // 免费课目录全开
    expect(rows.map((r) => r.locked)).toEqual([false, false, false, false])
  })

  it('学到第 3 节:前两节 completed、第三节 current', () => {
    const rows = toCourseLessonRows(OUTLINE, 2, 0)
    expect(rows.map((r) => r.completed)).toEqual([true, true, false, false])
    expect(rows.map((r) => r.current)).toEqual([false, false, true, false])
  })

  it('收费课:除首节外全部 locked(与 completed 独立)', () => {
    const rows = toCourseLessonRows(OUTLINE, 0, 199)
    expect(rows.map((r) => r.locked)).toEqual([false, true, true, true])
  })

  it('currentLessonIdx 缺省 -1 ⇒ 无 current', () => {
    const rows = toCourseLessonRows(OUTLINE, undefined as unknown as number, 0)
    expect(rows.every((r) => !r.current)).toBe(true)
    expect(rows.every((r) => !r.completed)).toBe(true)
  })

  it('outline 为空/缺省 ⇒ 空数组,不抛错', () => {
    expect(toCourseLessonRows(undefined)).toEqual([])
    expect(toCourseLessonRows(null)).toEqual([])
    expect(toCourseLessonRows([])).toEqual([])
  })

  it('id 用序号字符串(后端 outline 无稳定主键)', () => {
    const rows = toCourseLessonRows(OUTLINE)
    expect(rows.map((r) => r.id)).toEqual(['0', '1', '2', '3'])
  })

  it('duration 透传(后端给才有)', () => {
    const rows = toCourseLessonRows([{ title: 'a', duration: '12:30' }])
    expect(rows[0]?.duration).toBe('12:30')
  })

  describe('进度百分比', () => {
    it('空大纲 ⇒ 0(不是 NaN)', () => {
      expect(courseLessonProgressPercent([], 0)).toBe(0)
      expect(courseLessonProgressPercent(undefined, 0)).toBe(0)
    })

    it('按当前序号折算', () => {
      expect(courseLessonProgressPercent(OUTLINE, 0)).toBe(0)
      expect(courseLessonProgressPercent(OUTLINE, 2)).toBe(50)
      expect(courseLessonProgressPercent(OUTLINE, 4)).toBe(100)
    })

    it('越界序号被夹紧,不出现负数或 >100', () => {
      expect(courseLessonProgressPercent(OUTLINE, -5)).toBe(0)
      expect(courseLessonProgressPercent(OUTLINE, 99)).toBe(100)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
