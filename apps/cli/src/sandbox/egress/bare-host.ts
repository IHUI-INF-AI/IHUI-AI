// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 裸域名取词(goal-b49 Z3 腿③,补 B6 §4.3 留下的缺口:URL 有 host,裸域名没有取)。
 *
 * B6 的解锁条件是"与 syntax-table 的网络类命令联动定位,而不是凭猜扩面"。本文件正是这么做的:
 *  1. **闸门**(唯一判据 import,§0.6):该段的命令经 `evaluateArgv` 结算出 `network` 效应才继续 ——
 *     效应表住在 `tools/command-policy/syntax-table.ts`,这里一个字都不抄。`node script.js`、
 *     `git checkout v1.2` 这类没有网络效应的段整段不问,不产生取词噪声。
 *  2. **语法**(保守形态,只在闸门内跑):scp 形态 `user@host:path`、`user@host`、`host:port`、
 *     `--targethost foo.internal` 的裸值。判定标准 = 逆序标签全是合法 DNS label 且 TLD 为
 *     字母起始 ≥2 字符;含 scheme/双冒号(IPv6)/斜杠路径的形态一律交回原有取词通道
 *     (`extractEgressTargets` 认 URL 与 IP 字面量,两边以 host 去重会合)。
 *
 * 失效方向(§0.3):取不出来就是"没有裸域名目标",不硬造;而取出来的目标仍要过
 * `judgeEgressTarget` / `adjudicateDomain` 那把唯一的尺 —— 本文件零裁决逻辑。
 * 分词复用 `tokenizer.ts` 的唯一分词器(引号/分段/变量展开标记都在它那里,不抄第二份)。
 */

import { evaluateArgv } from '../../tools/command-policy/evaluate.js';
import { tokenizeCommand } from '../../tools/command-policy/tokenizer.js';
import { normalizeEgressHost } from './policy.js';
import { parseIpAddress } from '@ihui/shared/utils/ssrf-guard';

/** 本地形态(结构上兼容 `ExtractedTarget`的 `origin: 'bare-host'` 档,不做跨文件类型循环)。 */
export interface BareHostTarget {
  readonly raw: string;
  readonly origin: 'bare-host';
}

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^[a-z][a-z0-9-]{1,}$/;

/**
 * 单词元 → 裸主机名(取不出 ⇒ null,不是 deny 也不是 allow —— 这里只做取词不做裁决)。
 * 处理顺序刻意是 user 剥离 → 冒号切割 → 归一 → 形态校验:`C:Users`、`10:30`、`v1.2`、
 * `a/b.c`、`8080:80` 这些"看着像 host:port 的普通参数"都在形态校验处被拦下。
 */
export function bareHostOf(raw: string): string | null {
  let value = String(raw ?? '').trim().toLowerCase();
  if (value === '' || value.includes('://')) return null;
  const at = value.lastIndexOf('@');
  if (at >= 0) value = value.slice(at + 1);
  if (value === '') return null;
  const colon = value.indexOf(':');
  if (colon > 0) {
    if (value.indexOf(':', colon + 1) >= 0) return null; // IPv6 或畸形形态,不猜
    const head = value.slice(0, colon);
    if (head === '') return null;
    value = head; // host:path(scp 形态)与 host:port 都只取左侧
  }
  const slash = value.indexOf('/');
  if (slash > 0) value = value.slice(0, slash); // 无 scheme 的 URL 形态 `host.example/path` 取 host 段
  const host = normalizeEgressHost(value);
  if (host === '' || host.includes(':') || !host.includes('.')) return null;
  if (parseIpAddress(host) !== null) return null; // IP 字面量归原有取词通道
  if (host.length > 253) return null;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  if (!labels.every((label) => LABEL_RE.test(label))) return null;
  if (!TLD_RE.test(labels[labels.length - 1] ?? '')) return null;
  return host;
}

/**
 * 命令行 → 裸域名目标(带网络效应闸门)。
 * 已知覆盖面边界(设计而非缺陷):未登记命令(如 `nc`)拿不到 network 效应 ⇒ 不扩面 ——
 * "不知道"不折算成"是出口",宁漏判于未知命令也不在取词层造第二把尺。
 */
export function extractBareHostTargets(commandLine: string): BareHostTarget[] {
  const out: BareHostTarget[] = [];
  const seen = new Set<string>();
  if ((commandLine ?? '').trim() === '') return out;
  let segments;
  try {
    segments = tokenizeCommand(commandLine).segments;
  } catch {
    return out; // 分词器自身抛错 = 没有可取的段;主通道的 unjudged 由裁决层点名
  }
  for (const segment of segments) {
    const argv = segment.argv;
    if (argv.length === 0 || argv[0]!.expanded) continue;
    const finding = evaluateArgv(argv.map((token) => token.value));
    if (!finding.effects.includes('network')) continue;
    for (let i = 1; i < argv.length; i += 1) {
      const token = argv[i]!;
      if (token.expanded) continue; // 变量化参数走既有 dynamic → unjudged 通道
      const value = token.value;
      if (value === '' || value.startsWith('-')) continue;
      const host = bareHostOf(value);
      if (host === null || seen.has(host)) continue;
      seen.add(host);
      out.push({ raw: host, origin: 'bare-host' });
    }
  }
  return out;
}

// 2026-11-05: __test__ 聚集体已删(knip 报未用导出;测试直接 import bareHostOf/extractBareHostTargets,不经此对象)。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
