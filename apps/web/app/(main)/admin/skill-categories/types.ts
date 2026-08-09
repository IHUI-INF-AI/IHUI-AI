export interface SkillCategory {
  id: string
  name: string
  slug: string
  icon?: string | null
  sort: number
  createdAt: string
}

export interface SkillCategoryForm {
  name: string
  slug: string
  icon: string
  sort: number
}