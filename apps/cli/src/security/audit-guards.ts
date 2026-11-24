// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Security 判据层(单一真相源,AGENTS §0.6)—— 自 `commands/security.ts` 提取,
 * 命令壳与任何内部调用方(会话钩子、脚本)都只 import 这里,不得复制判据(§22c)。
 *
 * 内容 = 后端 `/api/security/*` 响应的**纯判据**:类型契约、类型守卫、参数校验。
 * 零 IO、零 chalk —— 呈现面(着色/排版)留在命令壳里,判据不伪装成 UI。
 *
 * i18n-content-exempt-file: 参数校验的中文报错文案为既有 CLI 输出逐字节迁移
 * (commands/security.ts → 本文件,守门 70 基线棘轮不得把纯搬家判成新增文案;
 * 改动任一消息即破坏 CLI 行为兼容,本席交付契约明令禁止)。
 *
 * 类型与 apps/api/src/services/anomaly-detector.ts + apps/api/src/plugins/threat-detector.ts 对齐。
 */

// === 请求 / 响应类型(本地定义,与后端 anomaly-detector.ts / threat-detector.ts 对齐) ===

/** 安全审计日志条目(对应 security_logs 表,$inferSelect)。 */
export interface SecurityLogEntry {
  id: string;
  userId: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditListData {
  list: SecurityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export type AnomalyRecommendation = 'allow' | 'monitor' | 'challenge' | 'block';

export interface AnomalyDimension {
  name: string;
  score: number;
  weight: number;
}

export interface AnomalyEvent {
  timestamp: number;
  ip: string;
  userId?: string;
  url: string;
  score: number;
  recommendation: AnomalyRecommendation;
  dimensions: AnomalyDimension[];
}

export interface AnomalyListData {
  total: number;
  list: AnomalyEvent[];
}

export interface WatchedIp {
  ip: string;
  score: number;
  reasons: string[];
}

export interface RecentBlock {
  ip: string;
  score: number;
  duration: string;
  timestamp: number;
}

export interface ThreatStats {
  totalChecks: number;
  totalAutoBlocks: number;
  totalWarnings: number;
  watchedIps: WatchedIp[];
  recentBlocks: RecentBlock[];
}

// === CLI options 类型 ===

export interface AuditOptions {
  page?: string;
  pageSize?: string;
  json?: boolean;
}

export interface ScanOptions {
  path?: string;
  limit?: string;
  offset?: string;
  minScore?: string;
  json?: boolean;
}

export interface ReportOptions {
  json?: boolean;
}

// === 类型守卫 ===

export function isSecurityLogEntry(v: unknown): v is SecurityLogEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'userId' in v &&
    typeof (v as { userId: unknown }).userId === 'string' &&
    'action' in v &&
    typeof (v as { action: unknown }).action === 'string' &&
    'createdAt' in v
  );
}

export function isAuditListData(v: unknown): v is AuditListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list) &&
    'total' in v
  );
}

export function isAnomalyEvent(v: unknown): v is AnomalyEvent {
  return (
    typeof v === 'object' &&
    v !== null &&
    'ip' in v &&
    typeof (v as { ip: unknown }).ip === 'string' &&
    'score' in v &&
    typeof (v as { score: unknown }).score === 'number' &&
    'recommendation' in v
  );
}

export function isAnomalyListData(v: unknown): v is AnomalyListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list) &&
    'total' in v
  );
}

export function isThreatStats(v: unknown): v is ThreatStats {
  return (
    typeof v === 'object' &&
    v !== null &&
    'totalChecks' in v &&
    typeof (v as { totalChecks: unknown }).totalChecks === 'number' &&
    'totalAutoBlocks' in v &&
    typeof (v as { totalAutoBlocks: unknown }).totalAutoBlocks === 'number'
  );
}

// === 参数校验 ===

export function parsePositiveInt(v: string | undefined, fallback: number, max: number, label: string): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`无效的 ${label} "${v}",必须为正整数`);
  }
  return Math.min(n, max);
}

export function parseNonNegativeInt(v: string | undefined, fallback: number, label: string): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`无效的 ${label} "${v}",必须为非负整数`);
  }
  return n;
}

export function parseScore(v: string | undefined, label: string): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`无效的 ${label} "${v}",合法范围 0-100`);
  }
  return n;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
