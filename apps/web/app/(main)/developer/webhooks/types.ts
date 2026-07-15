export interface WebhookItem {
  id: string
  url: string
  events: string[]
  isEnabled: boolean
  createdAt: string
  lastTriggeredAt?: string
}
