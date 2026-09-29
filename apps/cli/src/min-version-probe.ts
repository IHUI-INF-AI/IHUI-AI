// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 服务端最低版本闸门的问责入口（G-243，2026-09-27）。
 *
 * 为什么要有它：闸门把"服务端说最低几版"变成了能挡住人的东西，所以必须有人能直接问一句
 * "服务端现在要求哪个最低版本、这个值是哪来的" —— 拿不到出口的判断不是判断。
 * 判据与闸门共用同一份实现（`updater.ts` 导出的 fetch/parse/decide），避免出现
 * "探针说没事、闸门挡住人"的两把尺子互相指认。
 *
 * 刻意**不**注册成 `ihui` 子命令：注册要改 `apps/cli/src/index.ts` 与命令表，不在本票文件清单内。
 * 退出码：0 = 服务端不拦 / 78 = 当前版本低于要求（= EXIT_CODE_BELOW_MINIMUM）/ 2 = 问不到（无法判定，
 * 与"服务端没要求"是两件事，不得混写成通过）。
 *
 * 用法：
 *   pnpm --filter @ihui/cli exec tsx src/min-version-probe.ts [--json] [--timeout=ms]
 */

import { pathToFileURL } from 'node:url';
import {
  decideGate,
  fetchServerMinVersion,
  getCurrentVersion,
  GATE_PATH,
  GATE_TIMEOUT_MS,
  parseServerMinVersion,
  UPGRADE_COMMAND,
  EXIT_CODE_BELOW_MINIMUM,
} from './updater.js';
import { resolveBaseUrl } from './commands/http-utils.js';

export interface ProbeReport {
  endpoint: string;
  currentVersion: string;
  /** false = 没问到 / 形状不认识 ⇒ 无法判定（不是"服务端没要求"）。 */
  determined: boolean;
  serverMinimumVersion: string | null;
  requirementSource: string;
  serverReason: string;
  blocked: boolean;
  upgradeCommand: string;
  error?: string;
}

export interface ProbeOutcome {
  exitCode: number;
  report: ProbeReport;
}

function numberFlag(argv: string[], flag: string, fallback: number): number {
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  const raw = inline ? inline.slice(flag.length + 1) : argv[argv.indexOf(flag) + 1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 问一次并折成报告。不发 warn、不退出进程 —— 那是闸门路径的职责，探针只负责回答。 */
export async function probeServerMinimumVersion(
  timeoutMs = GATE_TIMEOUT_MS,
  baseUrl: string = resolveBaseUrl(undefined),
  request: (baseUrl: string, timeoutMs: number) => Promise<unknown> = fetchServerMinVersion,
): Promise<ProbeOutcome> {
  const endpoint = `${baseUrl}${GATE_PATH}`;
  const currentVersion = getCurrentVersion();
  const base: ProbeReport = {
    endpoint,
    currentVersion,
    determined: false,
    serverMinimumVersion: null,
    requirementSource: 'unknown',
    serverReason: '',
    blocked: false,
    upgradeCommand: UPGRADE_COMMAND,
  };

  let raw: unknown;
  try {
    raw = await request(baseUrl, timeoutMs);
  } catch (e) {
    return {
      exitCode: 2,
      report: {
        ...base,
        serverReason: 'undetermined: could not reach the server (NOT the same as "no requirement")',
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const facts = parseServerMinVersion(raw);
  if (!facts) {
    return {
      exitCode: 2,
      report: {
        ...base,
        serverReason: 'undetermined: response shape not recognised (gate fails open)',
      },
    };
  }
  const verdict = decideGate(currentVersion, facts);
  return {
    // 三态(G-660):拦下 ⇒ 78;真判出来了且没拦 ⇒ 0;**判不了 ⇒ 2**,不得伪装成"服务端没要求"。
    exitCode: verdict.blocked ? EXIT_CODE_BELOW_MINIMUM : verdict.determined ? 0 : 2,
    report: {
      ...base,
      determined: verdict.determined,
      serverMinimumVersion: facts.minimumVersion,
      requirementSource: facts.source,
      serverReason: verdict.determined ? facts.reason : verdict.reason,
      blocked: verdict.blocked,
    },
  };
}

export function renderProbeReport(r: ProbeReport): string {
  const lines = [
    `endpoint          : ${r.endpoint}`,
    `current cli       : ${r.currentVersion}`,
    `determined        : ${String(r.determined)}`,
    `server minimum    : ${r.serverMinimumVersion ?? 'none'}`,
    `source of truth   : ${r.requirementSource}`,
    `server reason     : ${r.serverReason}`,
    `verdict           : ${
      r.blocked ? `BLOCKED — run \`${r.upgradeCommand}\` and retry` : r.determined ? 'pass' : 'UNDETERMINED'
    }`,
  ];
  if (r.error) lines.push(`error             : ${r.error}`);
  return lines.join('\n');
}

/** 只在被直接执行时跑 CLI 主体（被测试 import 时不得发网络请求）。AGENTS §22d 的判据形态。 */
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const timeout = numberFlag(argv, '--timeout', GATE_TIMEOUT_MS);
  const { exitCode, report } = await probeServerMinimumVersion(timeout);
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log(renderProbeReport(report));
  process.exitCode = exitCode;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
