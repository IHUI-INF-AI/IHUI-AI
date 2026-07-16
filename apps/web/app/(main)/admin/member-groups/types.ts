export type GroupStatus = 'active' | 'disabled'

export interface MemberGroup {
  id: string
  name: string
  type: string
  description: string | null
  ownerId: string | null
  memberCount: number
  status: GroupStatus
  createdAt: string
  updatedAt: string
}

export interface GroupForm {
  name: string
  type: string
  description: string
}

export interface GroupsListData {
  list: MemberGroup[]
}
