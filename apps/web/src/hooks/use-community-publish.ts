'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface CommunityPostInput {
  title: string
  content: string
  tags?: string[]
  cover?: string
  category?: string
  visibility?: 'public' | 'private' | 'followers'
}

export interface CommunityPost {
  id: string
  title: string
  content: string
  tags: string[]
  authorId: string
  status: 'draft' | 'published' | 'reviewing' | 'rejected'
  publishedAt?: string
}

export interface UseCommunityPublishReturn {
  publish: (input: CommunityPostInput) => Promise<CommunityPost | null>
  saveDraft: (input: CommunityPostInput) => Promise<CommunityPost | null>
  publishing: boolean
  saving: boolean
  error: Error | null
}

async function publishPost(input: CommunityPostInput): Promise<CommunityPost> {
  const res = await fetchApi<CommunityPost>('/api/community/posts', {
    method: 'POST',
    body: JSON.stringify({ ...input, status: 'published' }),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function saveDraftFn(input: CommunityPostInput): Promise<CommunityPost> {
  const res = await fetchApi<CommunityPost>('/api/community/posts/draft', {
    method: 'POST',
    body: JSON.stringify({ ...input, status: 'draft' }),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 社区发布 Hook，支持发布与存草稿 */
export function useCommunityPublish(): UseCommunityPublishReturn {
  const publishMutation = useMutation({ mutationFn: publishPost })
  const draftMutation = useMutation({ mutationFn: saveDraftFn })

  const publish = React.useCallback(
    async (input: CommunityPostInput) => {
      try {
        return await publishMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [publishMutation],
  )

  const saveDraft = React.useCallback(
    async (input: CommunityPostInput) => {
      try {
        return await draftMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [draftMutation],
  )

  return {
    publish,
    saveDraft,
    publishing: publishMutation.isPending,
    saving: draftMutation.isPending,
    error: (publishMutation.error ?? draftMutation.error) as Error | null,
  }
}
