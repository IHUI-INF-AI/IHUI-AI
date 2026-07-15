export interface TeamMember {
  id: string
  nickname: string
  avatar?: string
  email: string
  role: 'owner' | 'admin' | 'developer' | 'viewer'
  joinedAt: string
}

export const ROLE_CONFIG: Record<TeamMember['role'], { label: string; cls: string }> = {
  owner: { label: '所有者', cls: 'bg-primary/10 text-primary' },
  admin: { label: '管理员', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  developer: { label: '开发者', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  viewer: { label: '观察者', cls: 'bg-muted text-muted-foreground' },
}

export const ROLE_OPTIONS: TeamMember['role'][] = ['admin', 'developer', 'viewer']
