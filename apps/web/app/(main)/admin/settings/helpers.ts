import { Settings, Mail, HardDrive, Shield } from 'lucide-react'
import type { TabDef, SiteConfig, EmailConfig, StorageConfig, SecurityConfig } from './types'

export const TABS: TabDef[] = [
  { key: 'site', icon: Settings },
  { key: 'email', icon: Mail },
  { key: 'storage', icon: HardDrive },
  { key: 'security', icon: Shield },
]

export const INITIAL_SITE: SiteConfig = { name: 'IHUI AI', description: '', logo: '', icp: '' }
export const INITIAL_EMAIL: EmailConfig = { host: '', port: '465', user: '', pass: '', from: '' }
export const INITIAL_STORAGE: StorageConfig = {
  type: 'local',
  bucket: '',
  endpoint: '',
  accessKey: '',
  secretKey: '',
}
export const INITIAL_SECURITY: SecurityConfig = {
  allowRegister: true,
  maxLoginAttempts: '5',
  jwtExpires: '7d',
}
