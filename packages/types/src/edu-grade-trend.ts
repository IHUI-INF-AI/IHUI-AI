// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 成绩趋势 / 薄弱环节屏的形状单源(web `edu/edu-management/grades/trend/[studentId]` ↔ RN `EduGradeTrend`)。
 *
 * 2026-10-28 立:RN 侧此前只有成绩列表(`EduGradesScreen` GET /exam-score?termId)与
 * 家长端子成绩(`EduChildGradesScreen`),**都没有**按 studentId 的趋势/短板屏 ⇒ web 页
 * `apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/PageClient.tsx` 的
 * 字段清单只能留在页内内联 interface 里,两边各写一份。本文件收成一份,共享屏
 * `packages/app/src/features/edu-grade-trend/EduGradeTrendScreen.tsx` 直取。
 *
 * ⚠️ 端点现状(读 apps/api/src/routes/edu-ai-management.ts:4939-5004 实回):
 *  - `GET /exam-score/trend/:id` → `success({ list })`,行字段 id/examName/subject/score/
 *    totalScore/examDate,按 examDate 升序;可选 `?subject=` 过滤。**与 web 读法一致**。
 *  - `GET /exam-score/weakness/:id` → `success({ studentId, weaknesses })`,行字段
 *    subject/avgScore/examCount/totalScore/weak;**只有 weak<0.6 的科目才回**,
 *    且**没有** `percentage`、也没有 `isWeak`。
 *    而 web 读的是 `data.weakness`(单数)与 `w.percentage` / `w.isWeak` ⇒ 这三个都是
 *    既有的假字段:radar 恒空、薄弱徽章恒不亮、得分率恒 NaN。
 *
 * 所以本文件的类型按**归一后的契约形状**声明(percentage 为 0..100 的得分率、isWeak 为
 * 「是否薄弱」),端侧适配层负责:
 *  1. `weaknesses` / `weakness` 两种键名都认;
 *  2. `percentage` 缺失时按 `avgScore / totalScore * 100` 现算;
 *  3. `isWeak` 缺失时回落后端真实字段 `weak`;
 *  4. 数字字段一律过一遍数值归一(NaN / null / 字符串 → 0),屏侧不重复防御。
 */
import type { TFunction } from './app-shared.js'

/** 一条考试成绩(时间线的一个点;web 的 TrendEntry) */
export interface EduGradeTrendEntry {
  id: string
  /** 考试名称(web 横轴 / RN 分组标题) */
  examName: string
  /** 科目(web 每条折线 / RN 每条色条) */
  subject: string
  score: number
  /** 满分;<=0 时得分率按 0 处理(后端脏数据不参与除法) */
  totalScore: number
  /** 考试日期(后端是 date 列,ISO 串或 `YYYY-MM-DD`) */
  examDate: string
}

/** 一个科目的薄弱统计(web 的 WeaknessItem,已归一) */
export interface EduGradeWeaknessItem {
  subject: string
  /** 平均分(后端已四舍五入到 1 位) */
  avgScore: number
  /** 满分 */
  totalScore: number
  /** 得分率百分比 0..100(后端不回 ⇒ 适配层现算) */
  percentage: number
  /** 考试次数 */
  examCount: number
  /** 是否薄弱(后端 `weak` 的归一;适配层未给就按 percentage<60 兜底) */
  isWeak: boolean
}

/**
 * EduGradeTrendScreen 受控 props 契约。
 * 平台无关:两条 GET、筛选后的重取、登录态、导航全部由 wrapper 注入;
 * 颜色走 colorScheme 语义 token。
 */
export interface EduGradeTrendScreenProps {
  t: TFunction
  /** 学生 id(web 路由段;副标题只展示前 8 位,同 web) */
  studentId: string
  /** 趋势点(已按 examDate 升序;空数组 ⇒ 渲染「暂无成绩数据」) */
  entries: EduGradeTrendEntry[]
  /** 科目薄弱统计(空数组 ⇒ 分布卡/薄弱卡各渲染自己的空态) */
  weaknesses: EduGradeWeaknessItem[]
  /** 当前科目筛选;空串 = 全部科目(与后端 `?subject=` 缺省同义) */
  selectedSubject: string
  /** 加载中(仅首屏无数据时铺骨架,已有数据时不闪) */
  loading: boolean
  /** 加载失败文案(非空且无数据时渲染错误态 + 重试) */
  error: string
  /** 顶部返回 */
  onBack: () => void
  /** 错误态重试 */
  onRetry: () => void
  /** 切换科目筛选(宿主据此重取 trend;空串 = 全部) */
  onSelectSubject: (subject: string) => void
  colorScheme?: 'light' | 'dark'
}
