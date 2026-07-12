export interface UserAgentAudio {
  id: string
  uuid: string | null
  audioId: string | null
  agentId: string | null
  audioPath: string | null
  source: string | null
  platform: string | null
  createdAt: string | null
  updateAt: string | null
}

export interface ListData {
  list: UserAgentAudio[]
  total: number
}

export interface UserAgentAudioForm {
  uuid: string
  audioId: string
  agentId: string
  audioPath: string
  source: string
  platform: string
}

export interface UserAgentAudioSearch {
  uuid: string
  audioId: string
  agentId: string
  source: string
  platform: string
}
