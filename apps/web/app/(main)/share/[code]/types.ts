import type { ShareContent } from '@/lib/share-api'

export interface ShareContentProps {
  shareData: ShareContent
  copy: (text: string) => Promise<boolean>
  copied: boolean
}
