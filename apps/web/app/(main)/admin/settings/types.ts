import type { ComponentType } from 'react'

export type TabKey = 'site' | 'email' | 'storage' | 'security'

export interface TabDef {
  key: TabKey
  icon: ComponentType<{ className?: string }>
}

export interface SiteConfig {
  name: string
  description: string
  logo: string
  icp: string
}

export interface EmailConfig {
  host: string
  port: string
  user: string
  pass: string
  from: string
}

export interface StorageConfig {
  type: 'local' | 'oss' | 's3'
  bucket: string
  endpoint: string
  accessKey: string
  secretKey: string
}

export interface SecurityConfig {
  allowRegister: boolean
  maxLoginAttempts: string
  jwtExpires: string
}
