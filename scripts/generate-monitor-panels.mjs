// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 监控面板原生配置生成器(2026-10-18)。
//
// 背景:李总要求监控大屏「彻底融合进项目,不可以单独搞出一个程序」——因此把
// monitoring/grafana/dashboards/*.json 的全部面板(20 张 Prometheus 盘 + 1 张 Loki 日志盘,
// 共 216 条表达式)转译为项目原生面板配置,由 /admin/monitor/panels 页面用项目自己的
// EChart 组件 + /api/admin/monitor-panels/query 接口渲染。Grafana 从此只当 headless
// 的配置源/告警跳板,用户永远不直接接触它。
//
// 运行:node scripts/generate-monitor-panels.mjs
// 输出:apps/web/app/(main)/admin/monitor/panels/dashboard-config.generated.ts
//
// 转译规则:
// - 模板变量 $xxx / ${xxx} → `.*`(All 档语义,拉全量序列);
// - $__interval / $__rate_interval → 保留占位,由页面按所选时间窗换算步长;
// - $__range → 保留占位,由页面替换为所选时间窗;
// - 行面板/文本面板跳过;timeseries/stat/gauge/table/piechart/barchart/logs 全收。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DASH_DIR = path.join(ROOT, 'monitoring/grafana/dashboards');
const OUT = path.join(ROOT, 'apps/web/app/(main)/admin/monitor/panels/dashboard-config.generated.ts');

const GROUP_OF = {
  'ihui-ai-overview': 'AI 可观测',
  'ihui-ai-ai-agent': 'AI 可观测',
  'ihui-ai-ai-cost': 'AI 可观测',
  'ihui-ai-ai-latency': 'AI 可观测',
  'ihui-ai-logs': 'AI 可观测',
  'ihui-ai-alert-history': 'AI 可观测',
  'ihui-ai-business-funnel': '业务',
  'ihui-ai-payment-flow': '业务',
  'ihui-ai-tenant-usage': '业务',
  'ihui-ai-exam-usage': '业务',
  'ihui-ai-live-room': '业务',
  'ihui-ai-auth-security': '业务',
  'ihui-ai-ws': '业务',
  'ihui-ai-bullmq': '基础设施',
  'ihui-ai-cache': '基础设施',
  'ihui-ai-hls': '基础设施',
  'ihui-ai-oss-storage': '基础设施',
  'ihui-ai-postgresql': '基础设施',
  'ihui-ai-pg-deploy': '基础设施',
  'ihui-ai-redis-cluster': '基础设施',
  'ihui-ai-monitor-health': '基础设施',
};

const KIND_MAP = {
  timeseries: 'timeseries',
  barchart: 'timeseries',
  stat: 'stat',
  gauge: 'gauge',
  table: 'table',
  piechart: 'pie',
  logs: 'logs',
};

function normalizeExpr(raw) {
  let e = raw
    .replace(/\$\{__rate_interval\}/g, '$__interval')
    .replace(/\$\{(\w+):[^}]*\}/g, '$$$1')
    .replace(/\$\{(\w+)\}/g, (m, v) => (v === '__range' || v === '__interval' ? `$${v}` : '.*'))
    .replace(/\$(\w+)/g, (m, v) => {
      if (v === '__range' || v === '__interval') return `$${v}`;
      return '.*';
    });
  // 连续的 .*(如 =~".*" 被替换后的空匹配)无害;去掉多余空白
  return e.replace(/\s+/g, ' ').trim();
}

function walkPanels(panels, out) {
  for (const p of panels ?? []) {
    if (p.type === 'row') {
      walkPanels(p.panels, out);
      continue;
    }
    const kind = KIND_MAP[p.type];
    if (!kind) continue;
    const targets = (p.targets ?? [])
      .filter((t) => typeof t.expr === 'string' && t.expr.trim())
      .map((t) => ({
        ref: String(t.refId ?? `t${out.length}`),
        expr: normalizeExpr(t.expr),
        legend: String(t.legendFormat ?? ''),
      }));
    if (targets.length === 0) continue;
    const dsTypes = new Set(
      [p.datasource, ...(p.targets ?? []).map((t) => t.datasource)]
        .filter(Boolean)
        .map((d) => (typeof d === 'string' ? d : d.type)),
    );
    const backend = dsTypes.has('loki') ? 'loki' : 'prometheus';
    out.push({
      id: String(p.id ?? `${p.type}-${out.length}`),
      title: String(p.title ?? '(无标题)'),
      kind,
      backend,
      unit: p.fieldConfig?.defaults?.unit || undefined,
      span: (p.gridPos?.w ?? 12) >= 12 ? 'full' : 'half',
      targets,
    });
  }
}

const dashboards = [];
for (const f of fs.readdirSync(DASH_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(DASH_DIR, f), 'utf8'));
  const panels = [];
  walkPanels(j.panels, panels);
  if (panels.length === 0) continue;
  dashboards.push({
    uid: j.uid,
    title: j.title,
    group: GROUP_OF[j.uid] ?? '其他',
    panels,
  });
}

const banner = `/**
 * 监控面板原生配置(自动生成,请勿手改)。
 *
 * 由 scripts/generate-monitor-panels.mjs 从 monitoring/grafana/dashboards/*.json 转译;
 * 表达式与 Grafana 盘逐条同源(216 条),模板变量已归一为 All 档(.*)。
 * $__interval / $__range 为占位符,由 /admin/monitor/panels 页面按时间窗替换。
 */
`;

const body = `export interface PanelTarget {
  ref: string
  expr: string
  legend: string
}

export type PanelKind = 'timeseries' | 'stat' | 'gauge' | 'table' | 'pie' | 'logs'
export type PanelBackend = 'prometheus' | 'loki'

export interface NativePanel {
  id: string
  title: string
  kind: PanelKind
  backend: PanelBackend
  unit?: string
  span: 'full' | 'half'
  targets: PanelTarget[]
}

export interface NativeDashboard {
  uid: string
  title: string
  group: string
  panels: NativePanel[]
}

export const MONITOR_DASHBOARDS: NativeDashboard[] = ${JSON.stringify(dashboards, null, 2)}

export const PANEL_GROUPS = Array.from(new Set(MONITOR_DASHBOARDS.map((d) => d.group)))
`;

fs.writeFileSync(OUT, banner + body);
const totalTargets = dashboards.reduce((n, d) => n + d.panels.reduce((m, p) => m + p.targets.length, 0), 0);
console.log(`OK ${dashboards.length} 张盘 / ${dashboards.reduce((n, d) => n + d.panels.length, 0)} 面板 / ${totalTargets} 表达式 → ${path.relative(ROOT, OUT)}`);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
