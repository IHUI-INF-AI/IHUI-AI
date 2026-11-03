// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * LearnDevelop 屏数据层(2026-11-03 M4 api-B)。
 *
 * **明确声明:本屏无需远端接口。**
 * 真源核对:web 端没有 `learn-develop` 页面(全仓 `LearnDevelop` / `learn-develop` 零命中);
 * `apps/web/app/(main)/learn/page.tsx` 是课程列表页(请求 `/api/learn/lessons` 与
 * `/api/learn/categories`),与这屏「学习功能导航入口」不是同一页面,不能拿来做本屏数据源。
 * 因此入口集合保持本地静态配置,`LEARN_DEVELOP_ENDPOINT = null` 是核对结论。
 *
 * 端侧只需按 id 注入图标与真实跳转(逻辑 target 已在此声明,由宿主端口解析)。
 */

export const LEARN_DEVELOP_DATA_SOURCE = 'static' as const
/** 无远端接口:null 为真实结论,不是未填 */
export const LEARN_DEVELOP_ENDPOINT = null

export type LearnDevelopEntryId =
  'coursePlanet' | 'studyPlan' | 'knowledgePlanet' | 'studyIndex' | 'learnCenter'

export interface LearnDevelopEntrySpec {
  id: LearnDevelopEntryId
  titleKey: string
  descKey: string
  /** 跨端逻辑 target(由宿主 onNavigate 解析,不使用平台路径) */
  target: string
}

export const LEARN_DEVELOP_ENTRY_SPECS: readonly LearnDevelopEntrySpec[] = [
  {
    id: 'coursePlanet',
    titleKey: 'learnDevelop.courseTitle',
    descKey: 'learnDevelop.courseDesc',
    target: 'CoursePlanet',
  },
  {
    id: 'studyPlan',
    titleKey: 'studyPlan.title',
    descKey: 'learnDevelop.planDesc',
    target: 'StudyPlan',
  },
  {
    id: 'knowledgePlanet',
    titleKey: 'learnDevelop.kTitle',
    descKey: 'learnDevelop.kDesc',
    target: 'KnowledgePlanet',
  },
  {
    id: 'studyIndex',
    titleKey: 'learnDevelop.videoTitle',
    descKey: 'learnDevelop.videoDesc',
    target: 'StudyIndex',
  },
  {
    id: 'learnCenter',
    titleKey: 'learnDevelop.centerTitle',
    descKey: 'learnDevelop.centerDesc',
    target: 'Learn',
  },
]
