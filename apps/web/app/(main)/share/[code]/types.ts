import type { ShareContent } from '@ihui/api-client'

export interface ShareContentProps {
  shareData: ShareContent
  copy: (text: string) => Promise<boolean>
  copied: boolean
}
