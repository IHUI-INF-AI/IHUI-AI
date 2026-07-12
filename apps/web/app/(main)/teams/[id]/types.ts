import type * as React from 'react'
import { Crown, Shield, UserPlus } from 'lucide-react'

export type Role = 'owner' | 'admin' | 'member'

export interface TeamDetail {
  id: string
  name: string
  slug: string
  description: string
  ownerName: string
  createdAt: string
}

export interface TeamMember {
  id: string
  userId: string
  nickname: string
  avatar?: string
  role: Role
  joinedAt: string
}

export interface Invitation {
  id: string
  invitee: string
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: string
}

export const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-amber-500/10 text-amber-600',
  admin: 'bg-primary/10 text-primary',
  member: 'bg-muted text-muted-foreground',
}

export const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  member: UserPlus,
}
