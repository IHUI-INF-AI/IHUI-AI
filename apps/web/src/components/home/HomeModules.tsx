'use client'

import { useTranslations } from 'next-intl'
import {
  GraduationCap,
  Video,
  FileCheck,
  Newspaper,
  FileText,
  MessageCircle,
  Users,
  BookOpen,
  Award,
  Flame,
} from 'lucide-react'
import { ModuleSection } from './ModuleSection'
import { fetchApi } from '@/lib/api'
import { getLearnCourses, getRecommendLearnCourses, getHotLearnCourses } from '@/lib/learn-api'
import { getLiveList } from '@/lib/live-api'
import { getExams } from '@/lib/exam-api'
import { getNews, getAsks, getCircles } from '@/lib/community-api'
import { getKnowledgeList } from '@/lib/resource-api'

function unwrap<T>(r: { success: boolean; data?: T; error?: string }): T {
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

interface ArticleListItem {
  id: string
  title: string
  coverImage?: string | null
  authorName?: string | null
  viewCount?: number
}

export function HomeModules() {
  const t = useTranslations('home.modules')
  const tUnits = useTranslations('home.units')
  return (
    <div className="space-y-5">
      <ModuleSection
        title={t('courses')}
        englishTitle={t('coursesEn')}
        icon={GraduationCap}
        href="/learn"
        queryKey={['home', 'courses']}
        queryFn={async () => {
          const d = unwrap(await getLearnCourses({ page: 1, pageSize: 4 }))
          return d.list.map((c) => ({
            id: c.id,
            title: c.title,
            cover: c.coverImage ?? undefined,
            meta: c.teacherName,
            href: `/learn/${c.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('recommend')}
        englishTitle={t('recommendEn')}
        icon={Award}
        href="/learn"
        queryKey={['home', 'recommend']}
        queryFn={async () => {
          const list = unwrap(await getRecommendLearnCourses(4))
          return list.map((c) => ({
            id: c.id,
            title: c.title,
            cover: c.coverImage ?? undefined,
            meta: c.teacherName,
            href: `/learn/${c.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('hot')}
        englishTitle={t('hotEn')}
        icon={Flame}
        href="/learn"
        queryKey={['home', 'hot']}
        queryFn={async () => {
          const list = unwrap(await getHotLearnCourses(4))
          return list.map((c) => ({
            id: c.id,
            title: c.title,
            cover: c.coverImage ?? undefined,
            meta: c.teacherName,
            href: `/learn/${c.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('live')}
        englishTitle={t('liveEn')}
        icon={Video}
        href="/live"
        queryKey={['home', 'live']}
        queryFn={async () => {
          const d = unwrap(await getLiveList({ page: 1, pageSize: 4 }))
          return d.list.map((l) => ({
            id: l.id,
            title: l.title,
            cover: l.coverImage ?? undefined,
            meta: l.lecturerName ?? undefined,
            href: `/live/${l.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('exam')}
        englishTitle={t('examEn')}
        icon={FileCheck}
        href="/exam"
        variant="list"
        queryKey={['home', 'exams']}
        queryFn={async () => {
          const d = unwrap(await getExams({ page: 1, pageSize: 5 }))
          return d.list.map((e) => ({
            id: e.id,
            title: e.title,
            meta: tUnits('questions', { count: e.questionCount }),
            href: `/exam/${e.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('news')}
        englishTitle={t('newsEn')}
        icon={Newspaper}
        href="/news"
        queryKey={['home', 'news']}
        queryFn={async () => {
          const d = unwrap(await getNews({ page: 1, pageSize: 4 }))
          return d.list.map((n) => ({
            id: n.id,
            title: n.title,
            cover: n.coverImage ?? undefined,
            meta: n.authorName ?? undefined,
            href: `/news/${n.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('article')}
        englishTitle={t('articleEn')}
        icon={FileText}
        href="/articles"
        variant="list"
        queryKey={['home', 'articles']}
        queryFn={async () => {
          const r = await fetchApi<ArticleListItem[]>('/api/articles?limit=6')
          if (r.success && Array.isArray(r.data) && r.data.length > 0) {
            return r.data.map((a) => ({
              id: a.id,
              title: a.title,
              cover: a.coverImage ?? undefined,
              meta: a.authorName ?? undefined,
              href: `/articles/${a.id}`,
            }))
          }
          return []
        }}
      />
      <ModuleSection
        title={t('ask')}
        englishTitle={t('askEn')}
        icon={MessageCircle}
        href="/asks"
        variant="list"
        queryKey={['home', 'asks']}
        queryFn={async () => {
          const d = unwrap(await getAsks({ page: 1, pageSize: 5 }))
          return d.list.map((a) => ({
            id: a.id,
            title: a.title,
            meta: tUnits('answers', { count: a.answerCount }),
            href: `/asks/${a.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('community')}
        englishTitle={t('communityEn')}
        icon={Users}
        href="/circles"
        queryKey={['home', 'circles']}
        queryFn={async () => {
          const d = unwrap(await getCircles({ page: 1, pageSize: 4 }))
          return d.list.map((c) => ({
            id: c.id,
            title: c.name,
            cover: c.coverImage ?? undefined,
            meta: tUnits('members', { count: c.memberCount }),
            href: `/circles/${c.id}`,
          }))
        }}
      />
      <ModuleSection
        title={t('knowledge')}
        englishTitle={t('knowledgeEn')}
        icon={BookOpen}
        href="/resources"
        queryKey={['home', 'knowledge']}
        queryFn={async () => {
          const d = unwrap(await getKnowledgeList({ page: 1, pageSize: 4 }))
          return d.list.map((k) => ({
            id: k.id,
            title: k.title,
            cover: (k.coverImage as string | null | undefined) ?? undefined,
            meta: k.category,
            href: `/resources/${k.id}`,
          }))
        }}
      />
    </div>
  )
}
