// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { redirect } from 'next/navigation'

/**
 * 2026-11-28 用户定档:工作台整合进 AI 总管,不再保留独立 `/start` 页面。
 * 旧链接、书签和外部入口全部落到总管工作台;八卡与今日队列在 `/master` 渲染。
 */
export default function StartPage() {
  redirect('/master')
}
