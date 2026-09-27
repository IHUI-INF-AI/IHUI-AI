// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D113 跨语言对账:CLI 的流中预览镜像 ≡ 服务端 `app/routers/llm.py` 的派生规则。
 *
 * 为什么必须有这把尺子:同一件事用两种语言各写一遍,是本仓记过最多次的失败型
 * (守门 139 三轴矩阵、`check-doom-loop-parity`、`publish-proxy-parity` 全是同一族)。
 * CLI 侧这份镜像不是可选优化 —— 该端工具在进程内执行,服务端的 `tool-delta` 帧
 * 对本端**永不出现**,所以"预览长什么样"完全由这份 TS 决定;它漂了,四端里就有一端
 * 悄悄不一样,而 typecheck/lint/单测全都不会红。
 *
 * 三向锁(任一侧改动而不牵动另两侧即红):
 *   ① 台账期望值由**服务端真实函数**生成(`generatedBy` 记明),不是手写、也不是 TS 侧生成;
 *   ② 本测试用 TS 实现重算同一批向量并逐字比对;
 *   ③ 本测试另**静态解析 llm.py(HEAD 面)**的预算常量 / 工具名集合 / 取键表,与 TS 常量对账
 *      —— 只比向量会漏掉"改了常量但向量恰好没覆盖到那一格"的情况。
 *   ④ 反向由 `apps/ai-service/tests/test_file_edit_preview_parity.py` 守:Python 重算必须仍等于台账。
 *
 * 一条**已声明的**不对称(见实现文件头注):`edit_file` 在服务端只认 `new_string`,
 * 而 CLI 的 `edit_file` 参数面是 `search`/`replace`/`patch`。本测试把这个差异钉成
 * "Python 返回 null 而 TS 返回文本"的显式断言 —— 它是登记过的分歧,不是静默漂移;
 * 再多一个键(未在此声明)会当场红。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  FILE_EDIT_PREVIEW_KEYS,
  PREVIEW_LINES_PER_FRAME,
  PREVIEW_MAX_CHARS,
  PREVIEW_MAX_FRAMES,
  PREVIEW_MAX_LINES,
  buildFileEditPreviewEvents,
  fileEditPreviewFrames,
  fileEditPreviewText,
  pyLen,
  pySplitlines,
} from '../src/tools/file-edit-preview.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURE_REL = 'apps/ai-service/tests/fixtures/file-edit-preview-cases.json';
const LLM_PY_REL = 'apps/ai-service/app/routers/llm.py';

interface ExpectedFrame {
  partialText: string;
  truncated: boolean;
}
interface ParityCase {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  /** 该向量**故意**两端结论不同(CLI 本地扩展键);不参与逐字等值,改由显式断言钉住 */
  declaredCliLocalExtension?: string;
  expected: { text: string | null; frames: ExpectedFrame[] };
}
interface Ledger {
  generatedBy: string;
  budget: {
    maxFrames: number;
    linesPerFrame: number;
    maxLines: number;
    maxChars: number;
  };
  previewToolNames: string[];
  sharedKeyTable: Record<string, string[]>;
  divergenceNote?: string;
  cases: ParityCase[];
}

const ledger = JSON.parse(
  readFileSync(path.join(REPO_ROOT, FIXTURE_REL), 'utf8'),
) as Ledger;

/**
 * 取 llm.py 的**被审面**:一律 HEAD(与 `publish-proxy-parity.test.ts`、守门 70/77/83 同口径)。
 * 按磁盘读会让并行会话的在飞改动把本测试钉红,而那份红与本次改动无关。
 */
function headBlob(rel: string): string {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    throw new Error(`取不到 HEAD:${rel} —— 判据失明,不记绿(${String(e)})`);
  }
}

/** 只支持"整数"与"a * b"两种形态(服务端预算常量的实际写法);不认识的形态大声失败 */
function pyIntConst(src: string, name: string): number {
  const m = new RegExp(`^${name}\\s*=\\s*([^\\n#]+)$`, 'm').exec(src);
  if (!m?.[1]) throw new Error(`llm.py 解析不到常量 ${name} —— 它被改名/删除等于本门失明`);
  const parts = m[1]
    .trim()
    .split('*')
    .map((p) => p.trim().replace(/_/g, ''));
  if (!parts.every((p) => /^\d+$/.test(p))) {
    throw new Error(`llm.py ${name} 取值形态不认识:${m[1].trim()}`);
  }
  return parts.reduce((acc, p) => acc * Number(p), 1);
}

function pyFrozenSet(src: string, name: string): string[] {
  const m = new RegExp(`${name}\\s*=\\s*frozenset\\(\\{([^}]*)\\}\\)`, 's').exec(src);
  if (!m?.[1]) throw new Error(`llm.py 解析不到 ${name} 的 frozenset 字面量`);
  return [...m[1].matchAll(/["']([\w]+)["']/g)].map((x) => x[1] as string);
}

/** 从 `_file_edit_preview_text` 函数体解析「工具名 → 取键顺序」(到下一个顶格语句为止) */
function pyPreviewKeyTable(src: string): Record<string, string[]> {
  const start = src.indexOf('def _file_edit_preview_text');
  if (start === -1) throw new Error('llm.py 里找不到 _file_edit_preview_text —— 判据失明');
  const rest = src.slice(start);
  const nextTopLevel = /\n(?=\S)/.exec(rest.slice(1));
  const body = nextTopLevel ? rest.slice(0, nextTopLevel.index + 1) : rest;
  const table: Record<string, string[]> = {};
  let current: string[] = [];
  for (const line of body.split('\n')) {
    const eq = /tool_name\s*==\s*["'](\w+)["']/.exec(line);
    if (eq?.[1]) {
      current = [eq[1]];
      continue;
    }
    const inSet = /tool_name\s+in\s+\(([^)]*)\)/.exec(line);
    if (inSet?.[1]) {
      current = [...inSet[1].matchAll(/["'](\w+)["']/g)].map((x) => x[1] as string);
      continue;
    }
    const get = /args\.get\(\s*["'](\w+)["']\s*\)/.exec(line);
    if (get?.[1]) {
      for (const tool of current) (table[tool] ??= []).push(get[1]);
    }
  }
  return table;
}

const llmSrc = headBlob(LLM_PY_REL);
const pyTable = pyPreviewKeyTable(llmSrc);
const pyToolNames = pyFrozenSet(llmSrc, '_FILE_EDIT_PREVIEW_TOOLS');

/**
 * 已声明的 CLI 本地扩展键(服务端没有)。加键必须**同时**在这里登记 + 在台账里补一条
 * "Python 侧派生不出、TS 侧派生得出"的向量,否则本测试红。
 */
const DECLARED_CLI_LOCAL_KEYS: Readonly<Record<string, readonly string[]>> = {
  edit_file: ['replace'],
};

describe('D113 跨语言对账:CLI 预览镜像 ≡ 服务端 llm.py', () => {
  it('台账自身可用:期望值出自 Python 侧,且向量覆盖到各判据分支', () => {
    expect(ledger.generatedBy).toMatch(/python/i);
    expect(ledger.cases.length).toBeGreaterThan(0);
    // 空台账 = 恒绿尺子,所以这几格"必须有向量"是判据有牙的前提,不是装饰
    const has = (pred: (c: ParityCase) => boolean) => ledger.cases.some(pred);
    expect(has((c) => c.expected.text === null)).toBe(true); // 取不到文本不发帧
    expect(has((c) => c.expected.frames.length >= 2)).toBe(true); // 多帧
    expect(has((c) => c.expected.frames.some((f) => f.truncated))).toBe(true); // 截断
    expect(has((c) => c.expected.frames.length === PREVIEW_MAX_FRAMES)).toBe(true); // 帧数封顶
    // 解析器也不能是瞎的:frozenset 里每个工具都得有取键规则
    for (const tool of pyToolNames) {
      expect(pyTable[tool]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('预算常量两侧逐值同形(TS 常量 ≡ llm.py ≡ 台账)', () => {
    expect(PREVIEW_MAX_FRAMES).toBe(pyIntConst(llmSrc, '_PREVIEW_MAX_FRAMES'));
    expect(PREVIEW_LINES_PER_FRAME).toBe(pyIntConst(llmSrc, '_PREVIEW_LINES_PER_FRAME'));
    expect(PREVIEW_MAX_LINES).toBe(pyIntConst(llmSrc, '_PREVIEW_MAX_LINES'));
    expect(PREVIEW_MAX_CHARS).toBe(pyIntConst(llmSrc, '_PREVIEW_MAX_CHARS'));
    expect(ledger.budget).toEqual({
      maxFrames: PREVIEW_MAX_FRAMES,
      linesPerFrame: PREVIEW_LINES_PER_FRAME,
      maxLines: PREVIEW_MAX_LINES,
      maxChars: PREVIEW_MAX_CHARS,
    });
  });

  it('取键表两侧同形:共享前缀逐字等值,多出来的键必须是已声明扩展', () => {
    expect(Object.keys(pyTable).sort()).toEqual([...pyToolNames].sort());
    expect(ledger.sharedKeyTable).toEqual(pyTable);
    for (const [tool, pyKeys] of Object.entries(pyTable)) {
      const tsKeys = FILE_EDIT_PREVIEW_KEYS[tool] ?? [];
      const declared = DECLARED_CLI_LOCAL_KEYS[tool] ?? [];
      // 顺序也判:共享规则必须排在扩展之前(先服务端语义、后本端兜底)
      expect([...pyKeys, ...declared]).toEqual([...tsKeys]);
    }
    // 反方向:TS 不得有服务端与声明之外的工具项(静默加一个工具 = 静默加一套语义)
    for (const tool of Object.keys(FILE_EDIT_PREVIEW_KEYS)) {
      expect(pyToolNames).toContain(tool);
    }
  });

  it('逐向量等值:fileEditPreviewText 与帧序列都和 Python 输出逐字相同', () => {
    for (const c of ledger.cases) {
      if (c.declaredCliLocalExtension) {
        // 有标记 = 这一格**故意**两端不同。标记本身要能对上已声明的扩展键,且服务端
        // 必须真的派生不出 —— 否则"扩展"就从登记分歧退化成静默的第二套规则。
        expect(Object.values(DECLARED_CLI_LOCAL_KEYS).flat()).toContain(c.declaredCliLocalExtension);
        expect(c.expected.text, `divergence:${c.id}`).toBeNull();
        expect(c.expected.frames, `divergence:${c.id}`).toEqual([]);
        continue;
      }
      expect(fileEditPreviewText(c.toolName, c.args), `text:${c.id}`).toBe(c.expected.text);
      const frames = fileEditPreviewFrames(c.expected.text ?? '').map(
        (f): ExpectedFrame => ({ partialText: f.partialText, truncated: f.truncated }),
      );
      expect(frames, `frames:${c.id}`).toEqual(c.expected.frames);
      // 帧序列经由唯一的发帧出口走一遍,载荷形状与 ToolDeltaEvent 契约一致
      const events = buildFileEditPreviewEvents('call-parity', c.toolName, c.args);
      expect(
        events.map((e): ExpectedFrame => ({
          partialText: e.partialText,
          truncated: e.truncated === true,
        })),
        `events:${c.id}`,
      ).toEqual(c.expected.frames);
      expect(events.map((e) => e.seq), `seq:${c.id}`).toEqual(
        c.expected.frames.map((_f, i) => i + 1),
      );
    }
  });

  it('两条判别力证明:用 JS 直觉写法会红的地方,Python 语义不红', () => {
    const find = (id: string): ParityCase => {
      const hit = ledger.cases.find((c) => c.id === id);
      if (!hit) throw new Error(`台账缺向量 ${id} —— 本测试的判别力断言随之失效`);
      return hit;
    };
    // ① 码点 vs UTF-16 单元:emoji 文本按 .length 算会超 32K 而被判截断,按 Python len() 不超
    const emoji = find('write_emoji_codepoint_count');
    const emojiText = emoji.args.content as string;
    expect(emojiText.length).toBeGreaterThan(PREVIEW_MAX_CHARS); // 用 .length 就漂了
    expect(pyLen(emojiText)).toBeLessThanOrEqual(PREVIEW_MAX_CHARS);
    expect(emoji.expected.frames[0]?.truncated).toBe(false);
    // ② splitlines vs split('\n'):CRLF / 裸 CR / 行尾分隔符不产出空段
    const crlf = find('write_crlf_and_lone_cr');
    const crlfText = crlf.args.content as string;
    // 注意对账的是**帧文本**:`expected.text` 是原始 content(服务端也原样派生),
    // 归一发生在切帧那一步。朴素 split('\n') 会把 \r 留在行里原样拼回去;
    // Python 的 splitlines 认 \r\n 与裸 \r,归一后按 \n 重排。
    const crlfFrame = crlf.expected.frames[0]?.partialText;
    expect(crlfFrame).not.toBe(crlfText);
    expect(crlfFrame).not.toContain('\r');
    expect(crlfFrame).toBe('a\nb\nc');
    expect(pySplitlines(crlfText)).toEqual(['a', 'b', 'c']);
    expect(pySplitlines('')).toEqual([]);
    expect(pySplitlines('a\n\nb')).toEqual(['a', '', 'b']);
  });

  it('已声明的分歧仍是分歧:edit_file+replace 只有 CLI 侧派生得出', () => {
    const c = ledger.cases.find((x) => x.id === 'edit_file_replace_only_cli_local_key');
    expect(c, '台账必须留着这条向量,否则扩展变成了无痕改动').toBeTruthy();
    expect(c?.expected.text).toBeNull(); // Python:派生不出、0 帧
    const text = fileEditPreviewText('edit_file', {
      search: 'old',
      replace: 'CLI-only preview text\nsecond line\n',
    });
    expect(text).toBe('CLI-only preview text\nsecond line\n'); // TS:派生得出
    const events = buildFileEditPreviewEvents('call-x', 'edit_file', {
      search: 'old',
      replace: 'CLI-only preview text\nsecond line\n',
    });
    expect(events.map((e) => e.partialText)).toEqual(['CLI-only preview text\nsecond line']);
  });

  it('空 toolCallId 不发帧(三端同一条纪律,不只在状态层判)', () => {
    expect(buildFileEditPreviewEvents('', 'write_file', { content: 'a\n' })).toEqual([]);
    expect(buildFileEditPreviewEvents('c1', 'read_file', { path: 'a' })).toEqual([]);
    expect(buildFileEditPreviewEvents('c1', 'write_file', { path: 'a' })).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
