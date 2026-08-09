import { fetchApi } from '@/lib/api'
import type { SkillCategory, SkillCategoryForm } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchCategories(): Promise<SkillCategory[]> {
  const data = await api<{ categories: SkillCategory[] }>('/api/skill-categories')
  return data?.categories ?? []
}

export async function createCategory(
  data: { name: string; slug: string; icon?: string; sort?: number },
): Promise<SkillCategory> {
  return api<SkillCategory>('/api/skill-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCategory(
  id: string,
  data: Partial<{ name: string; slug: string; icon: string; sort: number }>,
): Promise<SkillCategory> {
  return api<SkillCategory>(`/api/skill-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const EMPTY_FORM: SkillCategoryForm = {
  name: '',
  slug: '',
  icon: 'Tag',
  sort: 0,
}

export function categoryToForm(item: SkillCategory): SkillCategoryForm {
  return {
    name: item.name,
    slug: item.slug,
    icon: item.icon ?? 'Tag',
    sort: item.sort,
  }
}

export const CATEGORY_ICONS = [
  'Tag',
  'Bot',
  'Brain',
  'Code2',
  'Wrench',
  'Globe',
  'BookOpen',
  'GraduationCap',
  'Image',
  'Music',
  'Video',
  'MessageSquare',
  'FileText',
  'Database',
  'Cloud',
  'Shield',
  'Zap',
  'Heart',
  'Star',
  'Flag',
  'Settings',
  'Tool',
  'Sparkles',
  'Lightbulb',
] as const