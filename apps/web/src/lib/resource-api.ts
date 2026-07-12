/**
 * 资源相关 API
 * 合并迁移自旧架构：resource, certificate, knowledge, skills
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/** 资源 */
export interface Resource {
  id: string
  title: string
  description?: string
  cover?: string
  url?: string
  type?: string
  category?: string
  tags?: string[]
  downloadCount?: number
  viewCount?: number
  likeCount?: number
  status?: number
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 证书 */
export interface Certificate {
  id: string
  userId?: string
  userNickname?: string
  title: string
  certificateNo: string
  type?: string
  issueDate?: string
  expiryDate?: string
  issuer?: string
  score?: number
  status?: 'pending' | 'issued' | 'revoked' | 'expired'
  templateId?: string
  imageUrl?: string
  createdAt: string
  [key: string]: unknown
}

/** 证书模板 */
export interface CertificateTemplate {
  id: string
  name: string
  description?: string
  backgroundImage?: string
  fields?: Array<{ key: string; label: string; x?: number; y?: number; fontSize?: number }>
  status?: number
  createdAt: string
  [key: string]: unknown
}

/** 知识库 */
export interface Knowledge {
  id: string
  title: string
  content?: string
  summary?: string
  category?: string
  tags?: string[]
  viewCount?: number
  likeCount?: number
  status?: number
  authorId?: string
  authorName?: string
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 技能 */
export interface Skill {
  id: string
  name: string
  description?: string
  icon?: string
  category?: string
  level?: number
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  status?: number
  sort?: number
  createdAt: string
  [key: string]: unknown
}

// ===================== resource（资源） =====================

/** 获取资源列表 */
export async function getResources(
  query: PageQuery & { type?: string; category?: string; keyword?: string } = {},
): Promise<ApiResult<PageData<Resource>>> {
  return fetchApi<PageData<Resource>>(`/api/resource${buildQs(query)}`)
}

/** 获取资源详情 */
export async function getResourceDetail(id: string): Promise<ApiResult<Resource>> {
  return fetchApi<Resource>(`/api/resources/${id}`)
}

/** 创建资源 */
export async function createResource(input: Partial<Resource>): Promise<ApiResult<Resource>> {
  return fetchApi<Resource>('/api/resource', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新资源 */
export async function updateResource(
  id: string,
  input: Partial<Resource>,
): Promise<ApiResult<Resource>> {
  return fetchApi<Resource>(`/api/resources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除资源 */
export async function deleteResource(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/resources/${id}`, { method: 'DELETE' })
}

/** 下载资源 */
export async function downloadResource(
  id: string,
): Promise<ApiResult<{ url: string; expiresAt?: string }>> {
  return fetchApi<{ url: string; expiresAt?: string }>(`/api/resources/${id}/download`, {
    method: 'POST',
  })
}

/** 点赞资源 */
export async function likeResource(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/resources/${id}/like`, { method: 'POST' })
}

// ===================== certificate（证书） =====================

/** 获取证书列表 */
export async function getCertificates(
  query: PageQuery & { userId?: string; type?: string; status?: Certificate['status'] } = {},
): Promise<ApiResult<PageData<Certificate>>> {
  return fetchApi<PageData<Certificate>>(`/api/certificate${buildQs(query)}`)
}

/** 获取证书详情 */
export async function getCertificateDetail(id: string): Promise<ApiResult<Certificate>> {
  return fetchApi<Certificate>(`/api/certificates/${id}`)
}

/** 获取我的证书 */
export async function getMyCertificates(
  query: PageQuery = {},
): Promise<ApiResult<PageData<Certificate>>> {
  return fetchApi<PageData<Certificate>>(`/api/certificates/my${buildQs(query)}`)
}

/** 颁发证书 */
export async function issueCertificate(input: {
  userId: string
  title: string
  type?: string
  templateId?: string
  score?: number
  issueDate?: string
  expiryDate?: string
}): Promise<ApiResult<Certificate>> {
  return fetchApi<Certificate>('/api/certificates/issue', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 撤销证书 */
export async function revokeCertificate(
  id: string,
  reason?: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/certificates/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/** 验证证书 */
export async function verifyCertificate(
  certificateNo: string,
): Promise<ApiResult<{ valid: boolean; certificate?: Certificate }>> {
  return fetchApi<{ valid: boolean; certificate?: Certificate }>(
    `/api/certificates/verify${buildQs({ certificateNo })}`,
  )
}

// ===================== certificate templates（证书模板） =====================

/** 获取证书模板列表 */
export async function getCertificateTemplates(
  query: PageQuery = {},
): Promise<ApiResult<PageData<CertificateTemplate>>> {
  return fetchApi<PageData<CertificateTemplate>>(`/api/certificates/templates${buildQs(query)}`)
}

/** 获取证书模板详情 */
export async function getCertificateTemplateDetail(
  id: string,
): Promise<ApiResult<CertificateTemplate>> {
  return fetchApi<CertificateTemplate>(`/api/certificates/templates/${id}`)
}

/** 创建证书模板 */
export async function createCertificateTemplate(
  input: Partial<CertificateTemplate>,
): Promise<ApiResult<CertificateTemplate>> {
  return fetchApi<CertificateTemplate>('/api/certificates/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新证书模板 */
export async function updateCertificateTemplate(
  id: string,
  input: Partial<CertificateTemplate>,
): Promise<ApiResult<CertificateTemplate>> {
  return fetchApi<CertificateTemplate>(`/api/certificates/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除证书模板 */
export async function deleteCertificateTemplate(
  id: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/certificates/templates/${id}`, { method: 'DELETE' })
}

// ===================== knowledge（知识库） =====================

/** 获取知识库列表 */
export async function getKnowledgeList(
  query: PageQuery & { category?: string; keyword?: string } = {},
): Promise<ApiResult<PageData<Knowledge>>> {
  return fetchApi<PageData<Knowledge>>(`/api/knowledge${buildQs(query)}`)
}

/** 获取知识库详情 */
export async function getKnowledgeDetail(id: string): Promise<ApiResult<Knowledge>> {
  return fetchApi<Knowledge>(`/api/knowledge/${id}`)
}

/** 创建知识库条目 */
export async function createKnowledge(input: Partial<Knowledge>): Promise<ApiResult<Knowledge>> {
  return fetchApi<Knowledge>('/api/knowledge', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新知识库条目 */
export async function updateKnowledge(
  id: string,
  input: Partial<Knowledge>,
): Promise<ApiResult<Knowledge>> {
  return fetchApi<Knowledge>(`/api/knowledge/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除知识库条目 */
export async function deleteKnowledge(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/knowledge/${id}`, { method: 'DELETE' })
}

/** 点赞知识库 */
export async function likeKnowledge(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/knowledge/${id}/like`, { method: 'POST' })
}

// ===================== skills（技能） =====================

/** 获取技能列表 */
export async function getSkills(
  query: PageQuery & { category?: string } = {},
): Promise<ApiResult<PageData<Skill>>> {
  return fetchApi<PageData<Skill>>(`/api/skills${buildQs(query)}`)
}

/** 获取技能详情 */
export async function getSkillDetail(id: string): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>(`/api/skills/${id}`)
}

/** 创建技能 */
export async function createSkill(input: Partial<Skill>): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>('/api/skills', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新技能 */
export async function updateSkill(id: string, input: Partial<Skill>): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>(`/api/skills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除技能 */
export async function deleteSkill(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/skills/${id}`, { method: 'DELETE' })
}
