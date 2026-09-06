// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 云运行(Cloud Runs):云托管 Agent 运行记录列表/详情页。
// 对接已代理的 GET /api/cloud-runs 与 GET /api/cloud-runs/{run_id}。
// 复用 CloudRunsView 组件(与 /cloud-agent 同一实现)。后端:ai-service router/cloud_runs.py。

import { CloudRunsView } from '@/components/cloud-runs/CloudRunsView'

export default function CloudRunPage() {
  return <CloudRunsView />
}