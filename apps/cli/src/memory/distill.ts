// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆蒸馏 — 把一批原始条目归一化、合并近似项、按预算裁剪,产出可写入 MEMORY.md 的稳定文本。
 *
 * 设计约束:
 *   - 纯函数:除可选的 summarize 异步摘要器外,不读盘、不取时钟、不发网络;同一输入两次输出字节一致。
 *   - 账目守恒:一条输入条目最终只会落入 kept(代表保留)、merged(被合并吸收)、dropped(被裁剪)之一,
 *     即 kept + merged + dropped === entries.length,便于上层对账。
 *   - 默认不使用 LLM 摘要;summarize 抛错时回退纯规则产物且绝不向上抛,避免打断会话结束。
 */

import { MEMORY_FILE_BYTE_CAP } from './index.js';

export interface DistillEntry {
  text: string;
  source: string;
  createdAt: number;
  kind: string;
}

export interface DistillOptions {
  /** 字符预算,默认按 MEMORY.md 的 256KB 字节上限折算(见 DISTILL_CHAR_BUDGET 注释) */
  charBudget?: number;
  /** 近似合并的 token Jaccard 阈值,默认 DISTILL_JACCARD_THRESHOLD */
  jaccardThreshold?: number;
  /** 可选摘要器(如 LLM);抛错或返回空串时回退规则产物 */
  summarize?: (entries: readonly DistillEntry[]) => Promise<string>;
}

export interface DistillResult {
  /** 保留的代表条目数(合并后的组数) */
  kept: number;
  /** 被合并吸收的条目数(每组 size-1 之和) */
  merged: number;
  /** 被预算裁剪掉的条目数(含空文本条目) */
  dropped: number;
  /** 蒸馏后的 Markdown 文本(按 kind 分组) */
  text: string;
}

/**
 * 合并阈值 0.7。
 * 理由:token Jaccard 低于 0.7 时,常把「同一主题下的不同结论」(如两种不同选型)误判成同一条,
 * 合并会丢掉差异;高于 0.85 又只能合掉逐字重复,近似复述(换语序/换同义词)会残留。
 * 0.7 在「近似复述」与「不同结论」之间取平衡。
 */
export const DISTILL_JACCARD_THRESHOLD = 0.7;

/**
 * kind 权重:裁剪时同一天内的优先级。
 * 理由:长期记忆的价值不在「数量」而在「可复用性」。决策(为何这样定)、用户偏好/纠错、
 * 项目约定、可复用根因都比零散事实更值得保留;dream 原始搬运物与通用事实权重最低。
 */
export const DISTILL_KIND_WEIGHTS: Readonly<Record<string, number>> = {
  decision: 5,
  决策: 5,
  'explicit-remember': 5,
  '明确要求记住': 5,
  preference: 4,
  用户偏好: 4,
  convention: 4,
  项目约定: 4,
  'root-cause': 4,
  根因: 4,
  correction: 5,
  纠错: 5,
  fact: 2,
  事实: 2,
  dream: 1,
  通用: 2,
  未分类: 2,
};

/**
 * 默认字符预算 = MEMORY.md 单文件字节上限 / 3。
 * 理由:复用已存在的 MEMORY_FILE_BYTE_CAP(256KB)这一唯一预算常量,不自造数字;
 * UTF-8 下中文/emoji 最坏约 3~4 字节/字符,按 3 折算可保证蒸馏产物落盘时基本不超字节上限,
 * 避免写回时触发既有轮转/备份逻辑。预算按 `.length`(UTF-16 code unit)近似字符数,略保守。
 */
function defaultCharBudget(): number {
  return Math.floor(MEMORY_FILE_BYTE_CAP / 3);
}

interface DistillGroup {
  text: string;
  normalized: string;
  kind: string;
  createdAt: number;
  source: string;
  /** 输入数组中的首次出现下标,用于最终渲染顺序(不随 createdAt 排序变化) */
  order: number;
  /** 组内条目数(1 + 被合并吸收数) */
  size: number;
  tokens: ReadonlySet<string>;
}

/** 归一化仅用于比较:NFKC + 小写 + 去掉空白/标点/符号,原文保留用于输出。 */
function normalizeForCompare(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

/**
 * 分词:拉丁字母数字词块 + CJK 单字与双字二元组。
 * 理由:CJK 没有空格,单字集合会把「不同句子里相同的常用字」放大成高相似度;
 * 加上双字二元组能捕捉短语级相似,同时保留单字以抵抗最长公共子串漂移。
 */
function tokenize(normalized: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of normalized.matchAll(/[a-z0-9]{2,}/g)) {
    tokens.add(match[0]!);
  }
  for (const match of normalized.matchAll(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g)) {
    const run = match[0]!;
    if (run.length === 1) {
      tokens.add(run);
      continue;
    }
    for (let i = 0; i < run.length; i++) {
      tokens.add(run[i]!);
      if (i + 1 < run.length) tokens.add(run.slice(i, i + 2));
    }
  }
  return tokens;
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;
  for (const token of small) {
    if (large.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function kindWeight(kind: string): number {
  return DISTILL_KIND_WEIGHTS[kind] ?? DISTILL_KIND_WEIGHTS['fact'] ?? 2;
}

/** 合并时选代表文本:更长者优先,等长取字典序更小者,保证同输入结果稳定。 */
function shouldReplaceRepresentative(candidate: string, current: string): boolean {
  if (candidate.length !== current.length) return candidate.length > current.length;
  return candidate < current;
}

/**
 * 渲染:按输入首现顺序输出,同 kind 相邻的组归到一个 `## <kind>` 段。
 * 该格式与 LongTermMemory.load 的解析口径一致(# Memory + ## 分类 + - 条目)。
 */
function renderGroups(groups: readonly DistillGroup[]): string {
  const ordered = [...groups].sort((a, b) => a.order - b.order);
  const lines: string[] = [];
  let lastKind: string | null = null;
  for (const group of ordered) {
    if (group.kind !== lastKind) {
      if (lines.length > 0) lines.push('');
      lines.push(`## ${group.kind}`);
      lastKind = group.kind;
    }
    lines.push(`- ${group.text}`);
  }
  return lines.join('\n');
}

/**
 * 预算裁剪评分 = 日粒度最近优先 + kind 权重。
 * 理由:长期记忆不是日志,「最近」决定了时效性(旧结论可能已被推翻),所以天级别的先后是主序;
 * 同一天内再用 kind 权重区分可复用性,避免同批写入的零散事实挤掉决策/约定。
 */
function groupScore(group: DistillGroup): number {
  const dayBucket = Math.floor(group.createdAt / 86_400_000);
  return dayBucket * 10 + kindWeight(group.kind);
}

function toDistillEntry(group: DistillGroup): DistillEntry {
  return {
    text: group.text,
    source: group.source,
    createdAt: group.createdAt,
    kind: group.kind,
  };
}

/**
 * 蒸馏记忆条目。
 *
 * 步骤:① 按 createdAt(同刻按输入下标)排序后流式合并「同 kind 且相邻且近似」条目;
 * ② 按「最近优先 + kind 权重」贪心选入预算,直到下一次加入会超字符预算;
 * ③ 可选 summarize 覆盖文本,失败回退规则产物。
 */
export async function distillMemoryEntries(
  entries: readonly DistillEntry[],
  opts: DistillOptions = {},
): Promise<DistillResult> {
  const jaccardThreshold = opts.jaccardThreshold ?? DISTILL_JACCARD_THRESHOLD;
  const charBudget = opts.charBudget ?? defaultCharBudget();

  const groups: DistillGroup[] = [];
  let merged = 0;
  let dropped = 0;

  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.createdAt - b.entry.createdAt || a.index - b.index);

  for (const { entry, index } of ordered) {
    const kind = entry.kind.trim() || '未分类';
    const normalized = normalizeForCompare(entry.text);
    if (normalized === '') {
      // 空白条目不是记忆,直接计入裁剪,保证账目守恒。
      dropped++;
      continue;
    }
    const tokens = tokenize(normalized);
    const previous = groups[groups.length - 1];
    if (previous && previous.kind === kind && jaccard(previous.tokens, tokens) >= jaccardThreshold) {
      previous.size++;
      previous.createdAt = Math.max(previous.createdAt, entry.createdAt);
      merged++;
      if (shouldReplaceRepresentative(normalized, previous.normalized)) {
        previous.text = entry.text;
        previous.normalized = normalized;
        previous.tokens = tokens;
        previous.source = entry.source;
      }
      continue;
    }
    groups.push({
      text: entry.text,
      normalized,
      kind,
      createdAt: entry.createdAt,
      source: entry.source,
      order: index,
      size: 1,
      tokens,
    });
  }

  // 贪心入预算:每次试加一条后重算真实渲染长度,避免组标题重复计入造成低/高估。
  const accepted: DistillGroup[] = [];
  const keptSet = new Set<DistillGroup>();
  const candidates = [...groups].sort(
    (a, b) => groupScore(b) - groupScore(a) || b.createdAt - a.createdAt || a.order - b.order,
  );
  for (const candidate of candidates) {
    if (renderGroups([...accepted, candidate]).length <= charBudget) {
      accepted.push(candidate);
      keptSet.add(candidate);
    }
  }

  for (const group of groups) {
    if (!keptSet.has(group)) dropped += group.size;
  }

  let text = renderGroups(accepted);
  if (opts.summarize) {
    try {
      const summary = await opts.summarize(accepted.map(toDistillEntry));
      if (summary.trim() !== '') text = summary;
    } catch {
      // 摘要器失败(模型不可用/超时)只回退规则产物,不打断调用方会话结束。
    }
  }

  return { kept: accepted.length, merged, dropped, text };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
