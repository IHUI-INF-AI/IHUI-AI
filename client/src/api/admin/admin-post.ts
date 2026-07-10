import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface PostRecord {
  postId?: number | string
  postName?: string
  postCode?: string
  status?: string
  [key: string]: unknown
}

export async function postList(params?: Recordable): Promise<ApiResponse<PaginatedData<PostRecord>>> {
  const data = await http.get<{ list: PostRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/news/articles',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
export async function postCreate(data: Recordable): Promise<ApiResponse> {
  const res = await http.post<{ article: PostRecord }>('/admin/news/articles', data)
  return http.toApiResponse(res.article)
}
export async function postUpdate(data: Recordable): Promise<ApiResponse> {
  const id = data.postId ?? data.id
  const { postId, id: _id, ...body } = data
  const res = await http.put<{ article: PostRecord }>(`/admin/news/articles/${id}`, body)
  return http.toApiResponse(res.article)
}
export async function postDelete(ids: number[] | string): Promise<ApiResponse> {
  const id = Array.isArray(ids) ? ids[0] : ids
  const res = await http.delete<{ ok: boolean }>(`/admin/news/articles/${id}`)
  return http.toApiResponse(res.ok)
}
