// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { redirect } from 'next/navigation'

/**
 * 下载中心入口:直接访问 /download 时重定向到默认平台详情页(desktop)。
 * 2026-08-31 立:此前 /download 无顶层入口页,直接访问 404(各端入口均直达
 * /download/[platform])。静态导出下 redirect 生成 meta refresh 页面,行为与动态一致。
 */
export default function DownloadIndexPage() {
  redirect('/download/desktop')
}
