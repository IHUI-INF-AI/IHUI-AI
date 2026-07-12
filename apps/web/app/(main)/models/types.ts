export type Provider = 'openai' | 'anthropic' | 'google' | 'meta' | 'local'

export interface Model {
  id: string
  name: string
  provider: Provider
  description: string
  contextLength: number
  inputPrice: number
  features: string[]
}
