// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 监控面板原生配置生成器(2026-10-18)。
//
// 背景:李总要求监控大屏「彻底融合进项目,不可以单独搞出一个程序」——因此把
// monitoring/panel-defs/panels/*.json 的全部面板(24 张 Prometheus 盘 + 2 张 Loki 日志盘,
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
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DASH_DIR = path.join(ROOT, 'monitoring/panel-defs/panels');
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
  // 2026-10-23 立:访客/机器人流量此前"数据在 api_logs 里、盘上一格没有"。
  'ihui-ai-visitor-bot': '业务',
  'ihui-ai-ws': '业务',
  'ihui-ai-bullmq': '基础设施',
  'ihui-ai-cache': '基础设施',
  'ihui-ai-hls': '基础设施',
  'ihui-ai-oss-storage': '基础设施',
  'ihui-ai-postgresql': '基础设施',
  'ihui-ai-pg-deploy': '基础设施',
  'ihui-ai-redis-cluster': '基础设施',
  'ihui-ai-monitor-health': '基础设施',
  // 2026-10-19 覆盖率审计补的四张盘:此前 Windows 主机层 123 族 / 日志栈 362 族 /
  // 公网隧道 / 应用层黄金信号全是"数据在库里、面板一块没有"的缺口。
  'ihui-ai-windows-host': '基础设施',
  'ihui-ai-cloudflared-tunnel': '基础设施',
  'ihui-ai-log-stack-health': '基础设施',
  'ihui-ai-app-golden-signals': '基础设施',
  'ihui-ai-deep-pipeline': 'AI 可观测',
};

const KIND_MAP = {
  timeseries: 'timeseries',
  barchart: 'timeseries',
  stat: 'stat',
  gauge: 'gauge',
  bargauge: 'gauge', // bargauge 也是最新值语义,与 gauge 同渲染
  table: 'table',
  piechart: 'pie',
  logs: 'logs',
  heatmap: 'timeseries', // 热力图降级为多序列折线(逐档一条线),不留静默丢面板
};

function normalizeExpr(raw) {
  const e = raw
    // 裸写的 $__rate_interval(不带花括号,如 bullmq/pg_deploy 盘)若落到下面的
    // \$(\w+) 兜底会被替换成 .* 生成 [.*] 非法 PromQL —— 必须在兜底前先归一
    .replace(/\$__rate_interval/g, '$__interval')
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
    const fd = p.fieldConfig?.defaults ?? {};
    const thresholds = Array.isArray(fd.thresholds?.steps)
      ? fd.thresholds.steps
          .filter((s) => s && typeof s.color === 'string')
          .map((s) => ({ color: s.color, value: typeof s.value === 'number' ? s.value : null }))
      : undefined;
    out.push({
      id: String(p.id ?? `${p.type}-${out.length}`),
      title: String(p.title ?? '(无标题)'),
      kind,
      backend,
      unit: fd.unit || undefined,
      min: typeof fd.min === 'number' ? fd.min : undefined,
      max: typeof fd.max === 'number' ? fd.max : undefined,
      thresholds: thresholds && thresholds.length ? thresholds : undefined,
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

// 表达式条数由本次实际转译结果算出,不写死 —— 写死过一次(216),加盘后立刻变成假数字,
// 而这类"注释里的存量数字"正是最容易骗住后来人的那一种(见 AGENTS §0.1 凡数字一律现读)。
const totalTargetsNow = dashboards.reduce((n, d) => n + d.panels.reduce((m, p) => m + p.targets.length, 0), 0);
const banner = `/**
 * 监控面板原生配置(自动生成,请勿手改)。
 *
 * 由 scripts/generate-monitor-panels.mjs 从 monitoring/panel-defs/panels/*.json 转译;
 * 表达式与 Grafana 盘逐条同源(${totalTargetsNow} 条),模板变量已归一为 All 档(.*)。
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
  /** Grafana fieldConfig.defaults 显式声明的量程(gauge 量程以此为准,不再自造) */
  min?: number
  max?: number
  /** Grafana thresholds.steps(从 -Inf 起升序),gauge 渲染成轴色带 */
  thresholds?: Array<{ color: string; value: number | null }>
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
// §5c:生成器写完必须紧随注入 —— 产物在覆盖面上,而 check-watermark-coverage 判的是 HEAD blob,
// 不注入就等于每次重跑本器都把已入库的水印洗掉,把 blocking 门 47 的红留在 HEAD 上(§12e 型:
// 与本枚提交内容无关的红只会逼人 --no-verify)。inject 幂等,重复生成不产 diff。
execFileSync(process.execPath, [path.join(ROOT, 'scripts/watermark.mjs'), 'inject', OUT], {
  stdio: 'inherit',
  windowsHide: true,
});
const totalTargets = dashboards.reduce((n, d) => n + d.panels.reduce((m, p) => m + p.targets.length, 0), 0);
console.log(`OK ${dashboards.length} 张盘 / ${dashboards.reduce((n, d) => n + d.panels.length, 0)} 面板 / ${totalTargets} 表达式 → ${path.relative(ROOT, OUT)}`);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
