export interface RecommendSlot {
  id: string
  position: string
  name: string
  contentType: 'agent' | 'article' | 'course' | 'activity' | 'live'
  sort: number
  isEnabled: boolean
}

export interface RecommendForm {
  position: string
  name: string
  contentType: RecommendSlot['contentType']
  sort: number
}
