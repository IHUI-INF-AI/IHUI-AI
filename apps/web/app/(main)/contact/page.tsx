import * as React from 'react'
import type { Metadata } from 'next'
import { ContactContent, type ContactItem } from './ContactContent'

export const metadata: Metadata = {
  title: '联系我们',
  description:
    '联系智汇 AI 社区团队。商务合作、课程咨询、企业服务定制,欢迎通过微信、电话或邮件与我们取得联系。',
}

// 静态降级联系方式(API 不可用或未配置时使用)
export const FALLBACK_CONTACTS: ContactItem[] = [
  {
    icon: 'wechat',
    label: '微信咨询',
    value: 'ihui-ai(添加时备注"咨询")',
    href: '/support?source=contact',
  },
  {
    icon: 'phone',
    label: '客服电话',
    value: '400-000-0000',
    href: 'tel:400-000-0000',
  },
  {
    icon: 'mail',
    label: '商务邮箱',
    value: 'support@ihui.ai',
    href: 'mailto:support@ihui.ai',
  },
  {
    icon: 'globe',
    label: '官方网站',
    value: 'https://www.ihui.ai',
    href: 'https://www.ihui.ai',
  },
]

export const FALLBACK_COMPANY = {
  name: '吉林省爱智汇人工智能科技有限公司',
  merchantId: '1714645682',
  address: '',
}

export default function ContactPage() {
  return <ContactContent fallbackContacts={FALLBACK_CONTACTS} fallbackCompany={FALLBACK_COMPANY} />
}
