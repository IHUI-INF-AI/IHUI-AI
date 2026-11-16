// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 人事域入口页(2026-11-16 用户规范:一级分类点击后在右侧工作区单独页面展示二三级分类)
 *
 * A 方案与其他域一致:不改任何既有路由 —— 员工自助三页在 /hr/*、HR 管理两页在 /admin/*,
 * 搬目录等于改 URL。故本页用 DomainHub 卡片网格承载人事域全部功能,侧边栏只留
 * 「人事部」一枚入口(/domains/hr),与 /domains/ai、/domains/admin 等同形态。
 *
 * 条目来源 = HR_HUB_ITEMS(侧边栏 hrGroup 收敛前的同一份数据,§0.6 单一真相源),
 * 不另抄清单。adminOnly 两页(人事管理 / 人事数据中心)由 DomainHub 内的
 * useNavVisibilityFilter 统一过滤,普通用户只看得到员工自助三页;数据面仍由后端
 * requirePermission(HR_MANAGE) 与本人作用域双重兜底。
 *
 * 分组(2026-11-16):按 adminOnly 把同一份清单**划分**为「员工自助 / 人事管理」两段
 * —— 只是展示分组,不是第二份清单;两段并集恒等于 HR_HUB_ITEMS(测试钉住)。
 *
 * 标题/副标题取本域自己的键 hrHub.title / hrHub.subtitle,与其余域同族形态;
 * 禁止端内硬编码中文(AGENTS §19)。
 */

import { UsersRound } from 'lucide-react'
import { DomainHub } from '@/components/layout/DomainHub'
import { HR_HUB_ITEMS } from '@/components/sidebar/nav-data'
import { useTranslations } from 'next-intl'

/** 员工自助(所有登录用户):本人考勤 / 请假 / 工资条 */
const SELF_SERVICE_ITEMS = HR_HUB_ITEMS.filter((item) => !item.adminOnly)
/** 人事管理(adminOnly):部门考勤 / 人事数据中心 */
const ADMIN_ITEMS = HR_HUB_ITEMS.filter((item) => item.adminOnly)

export default function HrHubPage() {
  const t = useTranslations('hrHub')

  return (
    <DomainHub
      title={t('title')}
      description={t('subtitle')}
      icon={UsersRound}
      sections={[
        { title: t('sectionSelf'), items: SELF_SERVICE_ITEMS },
        { title: t('sectionAdmin'), items: ADMIN_ITEMS },
      ]}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
