export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AiCategory {
  id: string
  name: string
  description: string
  icon: string
  href: string
}

export interface AiWorldData {
  categories: AiCategory[]
  hotApps: Array<{ id: string; name: string; href: string }>
}
