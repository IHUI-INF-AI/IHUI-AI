export interface UserAgentImage {
  id: string
  userUuid: string | null
  imagePath: string | null
  imageName: string | null
  type: string | null
  platform: string | null
  modelName: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ListData {
  list: UserAgentImage[]
  total: number
}

export interface UserAgentImageForm {
  userUuid: string
  imagePath: string
  imageName: string
  type: string
  platform: string
  modelName: string
}

export interface UserAgentImageSearch {
  userUuid: string
  imageName: string
  platform: string
  modelName: string
}
