// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui report agent-trace` — 把一份 agent 工具调用轨迹出成**单文件自包含诊断报告**。
 *
 * 立因:对侧程序随产品分发两枚离线报告 HTML(实测零外链、内联脚本、KPI + 阶段瀑布 + findings +
 * 术语表 + 拖入重渲 + 过滤 + 复制)。本仓此前只有会话导出(md/txt/json/png)与分享快照(仅
 * Markdown 表)—— 缺的正是"KPI + 阶段瀑布 + 自动判据"这一层。判据与渲染住在
 * `packages/shared/src/reports/`(纯函数、零 DOM),本文件只做 IO 与取词注入。
 *
 * 为什么端点选 CLI 而不是 apps/api 只读路由:改动面最小 —— api 路由要同批补迁移 journal、
 * `openapi:export`、ui-routes 两份登记与 README 能力行四条派生腿,而这份工具的能力本来就落在
 * "离线单件"上,与对侧形态一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';

import {
  buildAgentTraceReport,
  normalizeAgentTraceStep,
  type AgentTrace,
  type AgentTraceReport,
  type AgentTraceStep,
  type TraceFindingThresholds,
} from '@ihui/shared/reports';

import { resolveReportTranslate } from './report-copy-dict.js';

interface ReportAgentTraceOptions {
  input: string;
  out?: string;
  title?: string;
  exportedAt?: string;
  locale?: string;
  timezone?: string;
  json?: boolean;
  slowestShareToFlag?: string;
  measuredTotalMsToFlag?: string;
  failOnFindings?: boolean;
}

/** 阈值覆盖:只把命令行显式给了的、且是有限数的档位带进 shared,坏值当场拒绝而不是静默回落 */
export function parseThresholdOverrides(opts: ReportAgentTraceOptions): Partial<TraceFindingThresholds> {
  const overrides: Partial<TraceFindingThresholds> = {};
  const numeric: Array<[keyof TraceFindingThresholds, string | undefined]> = [
    ['slowestShareToFlag', opts.slowestShareToFlag],
    ['measuredTotalMsToFlag', opts.measuredTotalMsToFlag],
  ];
  for (const [key, raw] of numeric) {
    if (raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`--${key} 需要一个有限数字,收到:${raw}`);
    }
    overrides[key] = value;
  }
  return overrides;
}

/**
 * 输入 JSON ⇒ AgentTrace。步读不出来的逐条计数并点名,不静默丢(丢了的报告仍会照常出,
 * 读数就会把"没读出来"说成"没发生")。
 */
export function readAgentTrace(raw: unknown, fallbackTitle: string, fallbackExportedAt: string): { trace: AgentTrace; rejectedStepCount: number } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('输入必须是一个 JSON 对象 { title?, exportedAt?, toolCalls: [...] }');
  }
  const record = raw as Record<string, unknown>;
  const rawSteps = Array.isArray(record.toolCalls) ? record.toolCalls : null;
  if (!rawSteps) throw new Error('字段 toolCalls 缺失或不是数组');

  const steps: AgentTraceStep[] = [];
  let rejectedStepCount = 0;
  for (const entry of rawSteps) {
    const step = normalizeAgentTraceStep(entry);
    if (step) steps.push(step);
    else rejectedStepCount += 1;
  }

  const trace: AgentTrace = {
    title: typeof record.title === 'string' && record.title.trim() !== '' ? record.title : fallbackTitle,
    toolCalls: steps,
    exportedAt:
      typeof record.exportedAt === 'string' && record.exportedAt.trim() !== ''
        ? record.exportedAt
        : fallbackExportedAt,
  };
  if (Array.isArray(record.messages)) {
    trace.messages = record.messages
      .filter((m): m is { role: string; content?: string } => typeof (m as { role?: unknown })?.role === 'string')
      .map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : undefined }));
  }
  if (typeof record.locale === 'string') trace.locale = record.locale;
  if (typeof record.timeZone === 'string') trace.timeZone = record.timeZone;
  return { trace, rejectedStepCount };
}

export function buildReportFromFile(inputPath: string, opts: ReportAgentTraceOptions): AgentTraceReport & { rejectedStepCount: number } {
  const text = fs.readFileSync(inputPath, 'utf8');
  const parsed: unknown = JSON.parse(text);
  const fallbackTitle = path.basename(inputPath, path.extname(inputPath));
  // 缺 exportedAt 时取输入文件的 mtime 而不是当下时钟:同一份文件重复跑必须得同一份文档(可对账)
  const fallbackExportedAt = new Date(fs.statSync(inputPath).mtimeMs).toISOString();
  const { trace, rejectedStepCount } = readAgentTrace(parsed, fallbackTitle, fallbackExportedAt);
  if (opts.title) trace.title = opts.title;
  if (opts.exportedAt) trace.exportedAt = opts.exportedAt;
  if (opts.locale) trace.locale = opts.locale;
  if (opts.timezone) trace.timeZone = opts.timezone;
  const report = buildAgentTraceReport({
    trace,
    translate: resolveReportTranslate(trace.locale),
    thresholds: parseThresholdOverrides(opts),
  });
  return { ...report, rejectedStepCount };
}

export function registerReportCommand(program: Command): void {
  const report = program.command('report').description('诊断报告(自包含单文件 HTML)');

  report
    .command('agent-trace <input>')
    .description('把 agent 工具调用轨迹出成离线诊断报告:KPI + 阶段瀑布 + findings + 术语表')
    .option('--out <file>', '输出 HTML 路径(默认 <input>-agent-trace.html)')
    .option('--title <text>', '报告标题(默认取输入文件名)')
    .option('--exported-at <iso>', '轨迹导出时刻(默认取输入文件 mtime,不读当下时钟)')
    .option('--locale <locale>', '取词语言:zh-CN | en(其余语言回显键名并点名欠账)')
    .option('--timezone <tz>', '时刻换算时区(如 Asia/Shanghai)')
    .option('--slowest-share-to-flag <ratio>', '最慢步占比阈值(0-1,默认 0.5)')
    .option('--measured-total-ms-to-flag <ms>', '已测总耗时阈值(ms,默认 120000)')
    .option('--json', '输出机器可读摘要(kpi / findings / missingCopyKeys)')
    .option('--fail-on-findings', '存在 high 级 finding 时以退出码 1 结束(CI 可用)')
    .action((input: string, opts: ReportAgentTraceOptions) => {
      try {
        const result = buildReportFromFile(input, opts);
        const outFile = opts.out ?? `${path.basename(input, path.extname(input))}-agent-trace.html`;
        fs.writeFileSync(outFile, result.html, 'utf8');
        const high = result.findings.filter((f) => f.severity === 'high').length;
        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                outFile,
                kpi: result.kpi,
                findings: result.findings,
                missingCopyKeys: result.missingCopyKeys,
                rejectedStepCount: result.rejectedStepCount,
                highFindingCount: high,
              },
              null,
              2,
            ),
          );
        } else {
          console.log(
            chalk.cyan(
              `报告:${outFile} · 步 ${result.kpi.stepCount}(失败 ${result.kpi.errorCount}、缺耗时 ${result.kpi.unmeasuredStepCount})` +
                ` · findings ${result.findings.length}(high ${high})` +
                ` · 取词欠账 ${result.missingCopyKeys.length} · 读不出的步 ${result.rejectedStepCount}`,
            ),
          );
        }
        if (opts.failOnFindings && high > 0) process.exitCode = 1;
      } catch (err) {
        console.error(chalk.red(`report agent-trace 失败:${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
