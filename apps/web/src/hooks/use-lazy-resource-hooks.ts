'use client'

import * as React from 'react'
import { formatFileSize } from '@ihui/shared/utils/format'
import { listAiSkills, type AiSkillMeta } from '@ihui/api-client/endpoints/ai-skills'
import { getRecentFilesForMention } from '@ihui/api-client'

/**
 * 把后端返回的 mimeType 转换为短标签(image/png → PNG,application/pdf → PDF)。
 * 没有 mimeType 时回退为 "FILE"。
 */
export function mimeToLabel(mimeType: string): string {
  if (!mimeType) return 'FILE'
  const sep = mimeType.indexOf('/')
  if (sep < 0) return mimeType.toUpperCase()
  return mimeType.slice(sep + 1).toUpperCase()
}

export type MentionFile = { id: string; name: string; path: string }

/**
 * 首次打开 @ 提及面板时拉取最近文件列表;失败静默(留空数组,Popover 显示"无匹配文件")。
 */
export function useMentionFiles(open: boolean): {
  mentionFiles: MentionFile[]
} {
  const [mentionFiles, setMentionFiles] = React.useState<MentionFile[]>([])
  const mentionLoadedRef = React.useRef(false)

  React.useEffect(() => {
    if (!open || mentionLoadedRef.current) return
    mentionLoadedRef.current = true
    getRecentFilesForMention(30)
      .then((res) => {
        if (res.success && res.data?.files) {
          setMentionFiles(
            res.data.files.map((f) => ({
              id: f.id,
              name: f.name,
              // API 不返回 path,用 mimeType · size 作为次要展示文本
              path: `${mimeToLabel(f.mimeType)} · ${formatFileSize(f.size)}`,
            })),
          )
        }
      })
      .catch(() => {
        // 2026-08-02 修复 P2 失败不重试:重置 ref 允许下次打开时重试,
        // 原实现 mentionLoadedRef.current = true 在请求前设置,失败时不重置,
        // 导致下次打开 @ 提及面板不会重试(永久锁死空数组)。
        mentionLoadedRef.current = false
        // 静默失败:未登录/网络错误时保持空数组,Popover 显示"无匹配文件"
      })
  }, [open])

  return { mentionFiles }
}

/**
 * 首次打开斜杠命令弹窗时拉取 AI Skills 列表(2026-07-29 二次深化,接入 skill 分组)
 * - 结构A(标准):{ code: 0, data: AiSkillMeta[] } → res.data 是数组
 * - 结构B(兼容):{ code: 0, data: { skills: AiSkillMeta[], count: N } } → res.data.skills 是数组
 * 失败静默 UI(保持空数组),但 console.error 输出错误便于排查
 * 失败时重置 skillsLoadedRef 允许下次重试(避免一次性失败永久锁死)
 */
export function useAiSkills(open: boolean): {
  aiSkills: AiSkillMeta[]
  skillsLoading: boolean
} {
  const [aiSkills, setAiSkills] = React.useState<AiSkillMeta[]>([])
  const [skillsLoading, setSkillsLoading] = React.useState(false)
  const skillsLoadedRef = React.useRef(false)

  React.useEffect(() => {
    if (!open || skillsLoadedRef.current) return
    skillsLoadedRef.current = true
    setSkillsLoading(true)
    listAiSkills({ category: 'all' })
      .then((res) => {
        if (!res.success) {
          // 失败:重置 ref 允许下次打开时重试(避免一次性失败永久锁死)
          skillsLoadedRef.current = false
          console.warn('[slash-cmd] listAiSkills failed:', res.error, res.status)
          return
        }
        // 兼容两种响应结构(后端标准是数组,但防御性处理嵌套结构)
        const skills = Array.isArray(res.data)
          ? res.data
          : res.data && Array.isArray((res.data as { skills?: unknown[] }).skills)
            ? (res.data as { skills: AiSkillMeta[] }).skills
            : []
        if (skills.length > 0) {
          setAiSkills(skills)
        } else {
          // 空响应:重置 ref 允许下次重试(后端可能临时返回空)
          skillsLoadedRef.current = false
          console.warn('[slash-cmd] listAiSkills returned empty or unexpected shape:', res.data)
        }
      })
      .catch((err) => {
        // 网络错误:重置 ref 允许下次重试
        skillsLoadedRef.current = false
        // 静默失败 UI,但记录错误便于排查(生产环境不影响用户体验)
        console.error('[slash-cmd] listAiSkills network error:', err)
      })
      .finally(() => {
        setSkillsLoading(false)
      })
  }, [open])

  return { aiSkills, skillsLoading }
}
