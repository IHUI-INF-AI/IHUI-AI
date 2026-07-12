export interface DeveloperLink {
  id: string
  developerId: string
  agentId: string
  status: number
  createdAt: string
}

export interface ListData {
  list: DeveloperLink[]
  total: number
}

export interface DeveloperLinkForm {
  developerId: string
  agentId: string
  status: boolean
}
