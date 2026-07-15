export interface ArticleForm {
  title: string
  summary: string
  content: string
  categoryId: string
  coverImage: string
}

export interface ArticleCategoryOption {
  id: string
  name: string
}

export const EMPTY_FORM: ArticleForm = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  coverImage: '',
}
