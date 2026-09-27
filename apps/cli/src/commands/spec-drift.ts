/**
 * Spec ↔ Code 双向落差检测(V3 #83 的第二件)。
 *
 * ## 本仓的「Spec」是哪一份(先论证载体,再立判据)
 *
 * 现读过的候选:
 *   1. `apps/cli/src/commands/spec.ts` 的 `ihui spec *` —— 它是**远程** `/api/spec/*` 的客户端
 *      (要 JWT + api 8802 在跑),内容是人读的 markdown,机器不可判 ⇒ 不能当判据的一侧。
 *   2. `apps/api/openapi.json` —— 生成的 HTTP 契约,对账对象是 `apps/api/src/routes/**`,
 *      而那整片在本票禁改清单内,且已有守门 51/72 在该面上跑 ⇒ 不重叠也不越权。
 *   3. **一等工具面**(`apps/cli/src/tools/**` 导出的 `Tool` 对象)—— `parameters`/`required`/
 *      `dangerLevel`/`contract` 就是**投影给模型的那份规格**(`@ihui/types` 的
 *      `projectToolInputSchema` 从这里出),而 `execute()` 就是实现。两侧同源于同一枚对象,
 *      却长期各写各的:AGENTS §115 实录「`required` 只拿去生成提示文案和 provider schema,
 *      模型少传/传错类型时由 104 枚 handler 各自兜」—— 这正是"规格与实现没有对账"的账面表述。
 *
 * 所以本票取 ③:**不新造第三份真相**,而是把既有载体自身的两侧对上。判据全部作用在
 * **运行时真对象**上(`Object.keys(tool.parameters)`),不靠再写一个源码解析器去猜形状 ——
 * 解析器猜错时的症状不是"差一点",而是把真信号淹在噪声里(本仓在守门 36/C1 上记过同型)。
 *
 * ## 两个方向
 *
 * - **Code → Spec**(代码已有、规格未声明):
 *   · `undeclared-arg-read` handler 读了 `args.k` 而 `parameters` 里没有 `k` ⇒ 模型从来
 *     没被告知这个键,该路径对模型不可达(或被静默兜底)。
 *   · `effect-not-declared` handler 真的写盘/起进程,而声明侧 `dangerLevel:'read'`
 *     (且未声明 mutating `effectScope`)⇒ 权限面按只读处置了一次会改东西的调用。
 * - **Spec → Code**(规格声明了、代码里找不到实现):
 *   · `dead-parameter` `parameters.k` 存在而 handler 从不读 `k` ⇒ 向模型advertise 了一个
 *     填了也没用的键。
 *   · `required-not-declared` `required` 里有 `k` 而 `parameters` 没有 ⇒ provider 侧被要求
 *     提供一条描述里根本没有的参数(AGENTS §113 记过的 `memory.ts` 那一型)。
 *
 * ## 三态(这门的存在理由)
 *
 * `execute.toString()` 里 `args` 被**整体**传给别处(`runInner(args)` / `{...args}` /
 * `Object.keys(args)`)时,键级使用结构上看不见 —— 这类工具一律进 `undetermined` 并**逐条点名**。
 * 把"看不见"写成"无落差"就是本仓最高频的那型失效:判据失效的表现永远是安静。
 * 同理,`dangerLevel` **未写**的工具不进 `effect-not-declared`(那是守门 111 flip-audit 的
 * 地盘,判"未声明即不可信"),本门只判"写了 read 而代码在改"。两道门各量一段,不互相顶掉。
 */
import { mayWriteWorkspace } from '@ihui/types';

// ==================== 判据输入的最小视图 ====================

/** 判据只用到 Tool 的这几个字段;写成结构化最小视图以便测试能构造面(不依赖真注册表)。 */
export interface ProjectableToolLike {
  name: string;
  parameters: Record<string, unknown>;
  required?: string[];
  dangerLevel?: string;
  contract?: Parameters<typeof mayWriteWorkspace>[0];
  execute: unknown;
}

export interface ToolSurfaceEntry {
  tool: ProjectableToolLike;
  /** 该工具来自哪一族(便于点名归属) */
  family: string;
}

export type DriftDirection = 'code->spec' | 'spec->code';

export interface DriftFinding {
  direction: DriftDirection;
  /** undeclared-arg-read | effect-not-declared | dead-parameter | required-not-declared */
  kind: string;
  tool: string;
  family: string;
  detail: string;
}

export interface UndeterminedTool {
  tool: string;
  family: string;
  reason: string;
}

export interface SpecDriftReport {
  /** 参与判定的工具数 */
  toolCount: number;
  families: string[];
  findings: DriftFinding[];
  undetermined: UndeterminedTool[];
  /** 每个 kind 的命中数(报告与测试都读它,不读列表长度) */
  countsByKind: Record<string, number>;
  /** 声明为 mutating 的工具数(诊断:说明 C2 一侧有多少输入) */
  mutatingDeclared: number;
}

// ==================== 代码侧:从函数源码里取「读了哪些键 / 有没有整体传走」 ====================

/** 在源码里把一段遮成等长空格:已识别的用法不再被当成"整体把 args 传走"。 */
function maskSpan(src: string, from: number, to: number): string {
  const chars = src.split('');
  for (let i = from; i < to && i < chars.length; i++) chars[i] = ' ';
  return chars.join('');
}

/**
 * 取 handler 的第一个形参名(通常 `args`)。**识别不了返回 null**,不再兜底成 `'args'`。
 *
 * `toString()` 在不同构建下有三种前缀形态:`async execute(args, ctx) {` / `(args, ctx) => {` /
 * `function(args, ctx)`。首参是**解构模式**(`execute({ path, query }, ctx)`)时键级取用藏在
 * 签名里,这里返回 null ⇒ 调用方必须把该工具记作**未判定**。
 *
 * 旧实现兜底 `'args'` 的后果是反的:量不到任何键 ⇒ 该工具**每一个**声明参数都被判成
 * `dead-parameter`(误红),而不是"看不见"(诚实)。宁可不判,不可猜。
 */
export function handlerArgsParamName(src: string): string | null {
  const named = src.match(/^\s*(?:async\s+)?(?:function\s+)?[A-Za-z_$][\w$]*\s*\(\s*([A-Za-z_$][\w$]*)/);
  if (named) return named[1] ?? null;
  const arrow = src.match(/^\s*(?:async\s*)?\(\s*([A-Za-z_$][\w$]*)/);
  if (arrow) return arrow[1] ?? null;
  // 无括号箭头单参:`async args => { ... }`
  const bare = src.match(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/);
  return bare?.[1] ?? null;
}

/**
 * 定位 handler **函数体**的起点:括号/方括号深度 0 上出现的第一个 `{`(函数体)
 * 或 `=>`(箭头体)。它之前整段是**签名**。
 *
 * 为什么必须有这一步:`args` 出现在 `async execute(args, ctx){` 里是**声明**,不是
 * "把 args 整体传走"的**使用**。旧实现只遮"用法"、从不遮"声明位",于是签名里那个
 * `args` 永远残留 ⇒ `\bargs\b` 恒成立 ⇒ **每一枚工具都落 unetermined**。
 * 真仓实测(修前):121 枚工具里 117 枚 opaque、双向落差各 0 处、退出码 0 ——
 * 一条双向对账判据对它立项要防的那一型整片失明,而账面"逐条点名了未判定"看着像在工作。
 * 这正是本仓记过最多次的那一型:**判据失效的表现永远是安静(或看起来很吵但什么都没判)**。
 *
 * 返回 -1 表示找不到体起点(形态不认识)⇒ 调用方不遮任何东西 ⇒ 保守落 unetermined,
 * 不会产假正。
 */
export function handlerBodyStart(src: string): number {
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[') {
      depth++;
      continue;
    }
    if (c === ')' || c === ']') {
      depth--;
      continue;
    }
    if (c === '{') {
      if (depth === 0) return i;
      depth++;
      continue;
    }
    if (c === '}') {
      depth--;
      continue;
    }
    if (depth === 0 && c === '=' && src[i + 1] === '>') return i;
  }
  return -1;
}


/**
 * 一次扫完代码侧的两个问题:读了哪些键、`args` 有没有被整体传走。
 *
 * 识别的用法:`a.k` / `a?.k` / `a['k']` / `const {k, k2: x} = a` / `helper(a, 'k')`。
 * 剩下任何一处裸 `a` ⇒ `opaque = true`(该工具的键级使用判不了,只能进未判定)。
 */
interface UsagePattern {
  re: RegExp;
  /** direct: 捕获组 1 就是键名;destructure: 捕获组 1 是 `{ a, b: c }` 内部文本 */
  shape: 'direct' | 'destructure';
}

export function extractArgUsage(src: string, paramName: string): { keys: string[]; opaque: boolean } {
  const name = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let masked = src;
  const keys = new Set<string>();
  let opaque = false;

  // 先遮**签名区**:那里的 `args` 是声明不是使用(见 handlerBodyStart 的说明)。
  // 只遮 `masked`,不遮 `src` —— 用法模式仍在原文上找键名,偏移量因此与 maskSpan 对齐。
  const bodyStart = handlerBodyStart(src);
  if (bodyStart > 0) masked = maskSpan(masked, 0, bodyStart);

  const patterns: UsagePattern[] = [
    // a.k / a?.k —— 整段(含 a)遮掉,使这处 a 不被算成"整体传走"
    { shape: 'direct', re: new RegExp(`\\b${name}\\s*(?:\\?\\.|\\.)\\s*([A-Za-z_$][\\w$]*)`, 'g') },
    // a['k'] / a["k"]
    { shape: 'direct', re: new RegExp(`\\b${name}\\s*\\[\\s*['"]([^'"]+)['"]\\s*\\]`, 'g') },
    // helper(a, 'k') —— 键名以字面量出现在调用第二位(browser_type 的 requireString(args,'selector') 就是这个形状)
    { shape: 'direct', re: new RegExp(`[A-Za-z_$][\\w$.]*\\(\\s*${name}\\s*,\\s*['"]([A-Za-z_$][\\w$]*)['"]`, 'g') },
    // const { k, k2: x } = a
    { shape: 'destructure', re: new RegExp(`\\{([^{}]*)\\}\\s*=\\s*${name}\\b`, 'g') },
  ];

  for (const { re, shape } of patterns) {
    for (const m of src.matchAll(re)) {
      const start = m.index ?? 0;
      masked = maskSpan(masked, start, start + m[0].length);
      if (shape === 'direct') {
        const k = m[1];
        if (k) keys.add(k);
        continue;
      }
      for (const part of (m[1] ?? '').split(',')) {
        const head = part.split(':')[0]!.trim();
        if (head.startsWith('...')) {
          // { ...rest } = args ⇒ 整份被摊开用,键级判不了
          opaque = true;
          continue;
        }
        if (/^[A-Za-z_$][\w$]*$/.test(head)) keys.add(head);
      }
    }
  }

  // 还剩任何一处裸 a(如 runInner(args) / { ...args } / Object.keys(args))⇒ 键级使用看不见
  if (!opaque) opaque = new RegExp(`\\b${name}\\b`).test(masked);
  return { keys: [...keys].sort(), opaque };
}

/** 会改写外部世界的调用形态。**只认调用位**且刻意不认 `exec(` / `rm(` 这类同名歧义形状。 */
const EFFECT_CALL_PATTERNS: Array<[string, RegExp]> = [
  ['writeFileSync', /\bwriteFileSync\s*\(/g],
  ['appendFileSync', /\bappendFileSync\s*\(/g],
  ['writeFile', /\bwriteFile\s*\(/g],
  ['appendFile', /\bappendFile\s*\(/g],
  ['mkdirSync', /\bmkdirSync\s*\(/g],
  ['rmSync', /\brmSync\s*\(/g],
  ['unlinkSync', /\bunlinkSync\s*\(/g],
  ['renameSync', /\brenameSync\s*\(/g],
  ['copyFileSync', /\bcopyFileSync\s*\(/g],
  ['cpSync', /\bcpSync\s*\(/g],
  ['spawn', /\bspawn\s*\(/g],
  ['spawnSync', /\bspawnSync\s*\(/g],
  ['execSync', /\bexecSync\s*\(/g],
  ['execFileSync', /\bexecFileSync\s*\(/g],
  ['execFile', /\bexecFile\s*\(/g],
];

/** 量出 handler 源码里真的出现过的副作用调用名。 */
export function detectEffectCalls(src: string): string[] {
  const found: string[] = [];
  for (const [name, re] of EFFECT_CALL_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(src)) found.push(name);
  }
  return found;
}

// ==================== 判定 ====================

/**
 * 声明侧是否说了"我只读"。`dangerLevel` 未写 ⇒ **不判**(那是守门 111 flip-audit 的地盘)。
 *
 * 旧写法是 `!mayWriteWorkspace(tool.contract ?? null)`,而 `@ihui/types` 那条谓词的语义是
 * **"字段缺席 ⇒ 也判会"**(缺省即不可信)—— 于是"没写契约"被读成"契约说它会改写",
 * `declaresReadOnly` 恒为 false,`effect-not-declared` **结构上永不成立**。
 * 实测佐证:`apps/cli/src/tools/**` 里 `effectScope` 出现 **0 次**,而 `dangerLevel: 'read'`
 * 有大量使用者 —— 一侧的判据静静躺在代码里、一次也没生效过,报告却一路打印"code->spec 0 处"。
 *
 * 现在的口径:**缺席 ≠ 反证**。没声明 effectScope 时以 `dangerLevel` 为准(它才是那一档的
 * 声明);一旦声明了,判断仍交回 `@ihui/types` 的唯一出口(不在本文件抄第二份 mutating 清单)。
 */
function declaresReadOnly(tool: ProjectableToolLike): boolean {
  if (tool.dangerLevel !== 'read') return false;
  const carrier = tool.contract ?? null;
  const view = carrier as unknown as { contract?: { permission?: { effectScope?: unknown } } | null } | null;
  const declaredScope = view?.contract?.permission?.effectScope;
  if (declaredScope === undefined || declaredScope === null || declaredScope === '') return true;
  return !mayWriteWorkspace(carrier);
}

/**
 * 双向判据的唯一实现。纯函数:输入是构造好的工具面,不读盘、不起进程 ⇒ 取证可用构造面,
 * 正反成对用例互不污染。
 */
export function analyzeToolSurface(entries: ToolSurfaceEntry[]): SpecDriftReport {
  const findings: DriftFinding[] = [];
  const undetermined: UndeterminedTool[] = [];
  const countsByKind: Record<string, number> = {};
  const families = new Set<string>();
  let mutatingDeclared = 0;

  const push = (f: DriftFinding): void => {
    findings.push(f);
    countsByKind[f.kind] = (countsByKind[f.kind] ?? 0) + 1;
  };

  for (const { tool, family } of entries) {
    families.add(family);
    if (typeof tool.execute !== 'function') {
      undetermined.push({ tool: tool.name, family, reason: 'execute 不是函数,代码侧无从量起' });
      continue;
    }
    const src = (tool.execute as () => unknown).toString();
    const paramName = handlerArgsParamName(src);
    if (paramName === null) {
      // 首参识别不了(解构模式 / 未知形态):键级两侧都不判。
      // 判"无落差"是把看不见写成通过,判 dead-parameter 是拿猜出来的键名误红 —— 两者都禁止。
      undetermined.push({
        tool: tool.name,
        family,
        reason: 'handler 首参不是可识别的标识符(解构签名或未知形态)⇒ 键级取用量不到,两侧均不判',
      });
      continue;
    }
    const { keys, opaque } = extractArgUsage(src, paramName);
    const declared = Object.keys(tool.parameters ?? {});
    const declaredSet = new Set(declared);

    // —— Code → Spec ①:读了没声明的键
    for (const k of keys) {
      if (!declaredSet.has(k)) {
        push({
          direction: 'code->spec',
          kind: 'undeclared-arg-read',
          tool: tool.name,
          family,
          detail: `handler 读 args.${k},而 parameters 里没有它 ⇒ 模型从未被告知这个键`,
        });
      }
    }

    // —— Code → Spec ②:真在改东西,声明侧却说是只读
    const effects = detectEffectCalls(src);
    if (effects.length > 0) mutatingDeclared += declaresReadOnly(tool) ? 0 : 1;
    if (effects.length > 0 && declaresReadOnly(tool)) {
      push({
        direction: 'code->spec',
        kind: 'effect-not-declared',
        tool: tool.name,
        family,
        detail:
          `dangerLevel 声明为 read,而 handler 里有副作用调用:${effects.join(', ')} ` +
          `⇒ 权限/批准面按只读处置了一次会改东西的调用`,
      });
    }

    // —— Spec → Code ①:声明了却没人读
    if (!opaque) {
      const used = new Set(keys);
      for (const k of declared) {
        if (!used.has(k)) {
          push({
            direction: 'spec->code',
            kind: 'dead-parameter',
            tool: tool.name,
            family,
            detail: `parameters.${k} 声明给了模型,但 handler 里量不到对它的任何取用 ⇒ 填了也没用`,
          });
        }
      }
    } else {
      undetermined.push({
        tool: tool.name,
        family,
        reason: `handler 把 ${paramName} 整体传给了别处 ⇒ 键级取用量不到;dead-parameter 对该工具不判`,
      });
    }

    // —— Spec → Code ②:required 点名了一个不存在于 parameters 的键(两侧都是纯数据,恒可判)
    for (const r of tool.required ?? []) {
      if (!declaredSet.has(r)) {
        push({
          direction: 'spec->code',
          kind: 'required-not-declared',
          tool: tool.name,
          family,
          detail: `required 里有 '${r}' 而 parameters 没有该键 ⇒ provider 被要求提供一条描述里不存在的参数`,
        });
      }
    }
  }

  return {
    toolCount: entries.length,
    families: [...families].sort(),
    findings,
    undetermined,
    countsByKind,
    mutatingDeclared,
  };
}

// ==================== 真载体的装配 ====================

/** 一族工具:名字 + 数组。`excluded` 见 EXCLUDED_FAMILIES 的理由说明。 */
export interface ToolFamily {
  family: string;
  tools: readonly ProjectableToolLike[];
}

/**
 * 装配被审的工具面。
 *
 * 这里**刻意写死一份族清单**并把没进来的族带上理由,而不是"扫目录动态 import":
 * 扫目录在打包后的 dist 里按 `.js` 解析、在 dev 下按 `.ts` 解析,同一道判据会在两种构建里
 * 看着两个不同的面(而"同一份代码两侧结论不同"正是守门 103 记过的那型)。清单会不会腐烂,
 * 由 `apps/cli/tests/spec-drift.test.ts` 的覆盖对账用例钉住:静态扫 `src/tools/**` 导出的
 * `*_TOOLS`,凡不在本清单、又不在 EXCLUDED_FAMILIES 的族 ⇒ 测试红。
 */
export async function loadToolFamilies(): Promise<{ families: ToolFamily[]; loadErrors: string[] }> {
  const families: ToolFamily[] = [];
  const loadErrors: string[] = [];
  const wanted: Array<[string, () => Promise<{ [k: string]: unknown }>]> = [
    ['BUILTIN_TOOLS', async () => import('../tools/builtins.js')],
    ['GIT_TOOLS', async () => import('../tools/git.js')],
    ['GIT_ADVANCED_TOOLS', async () => import('../tools/git-advanced.js')],
    ['GITHUB_PR_TOOLS', async () => import('../tools/github-pr.js')],
    ['FETCH_TOOLS', async () => import('../tools/fetch-url.js')],
    ['WEB_SEARCH_TOOLS', async () => import('../tools/web-search.js')],
    ['TEST_TOOLS', async () => import('../tools/run-tests.js')],
    ['DIAGNOSTIC_TOOLS', async () => import('../tools/diagnostics.js')],
    ['DEBUG_TOOLS', async () => import('../tools/debug.js')],
    ['CODEGRAPH_TOOLS', async () => import('../tools/codegraph.js')],
    ['CLIPBOARD_TOOLS', async () => import('../tools/clipboard.js')],
    ['MEMORY_TOOLS', async () => import('../tools/memory.js')],
    ['LSP_TOOLS', async () => import('../tools/lsp.js')],
    ['BROWSER_TOOLS', async () => import('../tools/browser.js')],
    ['BROWSER_PAGE_TOOLS', async () => import('../tools/browser-page.js')],
  ];
  for (const [family, loader] of wanted) {
    try {
      const mod = (await loader()) as Record<string, unknown>;
      const value = mod[family];
      if (!Array.isArray(value)) {
        loadErrors.push(`${family}: 模块导出的同名值不是数组`);
        continue;
      }
      families.push({ family, tools: value as ProjectableToolLike[] });
    } catch (err) {
      loadErrors.push(`${family}: ${(err as Error).message.split('\n')[0]}`);
    }
  }
  return { families, loadErrors };
}

/**
 * 未纳入判定的族与**为什么**(空数组 = 判据对该族结构上失明,必须能说清是哪一种失明)。
 * 这些族都是"要运行期 opts 才造得出来"的工厂,与守门 111 的 flip-audit 输入同一批对象。
 */
export const EXCLUDED_FAMILIES: Record<string, string> = {
  'createFileEditTools()': '工厂:需要 workspacePath/checkpoints/hunkTracker 才实例化 ⇒ 参数声明随 opts 变;归另票',
  'createSubagentTool()': '工厂:需要父会话凭据与 modelId 才实例化 ⇒ 参数面随父会话 opts 变;归另票',
  'createSpawnParallelTool()': '工厂:需要并发度与子任务模板才实例化 ⇒ 参数面随 opts 变;归另票',
  'PAGE_ACTION_TOOLS': '按 action 动态建名,清单法看不见',
};

/** 把报告压成给人读的输出(计数 + 逐条 + 未判定逐条点名)。 */
export function formatDriftReport(report: SpecDriftReport): string {
  const lines: string[] = [];
  lines.push(
    `工具面:${report.toolCount} 枚 / ${report.families.length} 族 · 落差 ${report.findings.length} 处 · 未判定 ${report.undetermined.length} 枚`,
  );
  for (const kind of Object.keys(report.countsByKind).sort()) {
    lines.push(`  ${kind}: ${report.countsByKind[kind]}`);
  }
  for (const dir of ['code->spec', 'spec->code'] as DriftDirection[]) {
    const side = report.findings.filter((f) => f.direction === dir);
    lines.push('');
    lines.push(`${dir}(共 ${side.length} 处)`);
    if (side.length === 0) lines.push('  (无 —— 注意:该侧为 0 也可能是未判定过多,见下)');
    for (const f of side) lines.push(`  - ${f.tool} [${f.family}] ${f.detail}`);
  }
  if (report.undetermined.length > 0) {
    lines.push('');
    lines.push(`未判定(逐条点名;把"看不见"写成"无落差"是禁止的)`);
    for (const u of report.undetermined) lines.push(`  - ${u.tool} [${u.family}] ${u.reason}`);
  }
  return lines.join('\n');
}

/** 报告的可机读形态(含清单本身,便于外部比对"这一轮到底判了哪些族")。 */
export function driftReportToJson(report: SpecDriftReport, loadErrors: string[]): string {
  return `${JSON.stringify({ ...report, loadErrors, excludedFamilies: EXCLUDED_FAMILIES }, null, 2)}\n`;
}

export interface SpecDriftOptions {
  json: boolean;
  /** 有落差时以退出码 1 结束(问责档);缺省只报不判,便于人在改到一半时看差多少 */
  strict: boolean;
}

/**
 * 跑一次双向落差检测并打印结果,返回退出码。
 *
 * 两条"不得静默"的前置:
 *   · 任何一族 import 失败 ⇒ 报告里点名并把退出码抬到 1(判据少看了整族却报"无落差",
 *     与守门 70/76/81 记过的"看起来有、其实没装车"同型);
 *   · 枚举到 0 枚工具 ⇒ 直接判"无法判定"并 exit 1,不得打印 ✅。
 */
export async function runSpecDrift(opts: SpecDriftOptions): Promise<number> {
  const { families, loadErrors } = await loadToolFamilies();
  const entries: ToolSurfaceEntry[] = families.flatMap((f) =>
    f.tools.filter((t): t is ProjectableToolLike => Boolean(t) && typeof t.name === 'string').map((tool) => ({ tool, family: f.family })),
  );

  if (entries.length === 0) {
    const msg = `工具面枚举到 0 枚(families=${families.length}, loadErrors=${loadErrors.length})⇒ 无法判定,这不是"无落差"`;
    console.error(msg);
    return 1;
  }

  const report = analyzeToolSurface(entries);
  if (opts.json) {
    process.stdout.write(driftReportToJson(report, loadErrors));
  } else {
    console.log(formatDriftReport(report));
    console.log(`\n被审族:${report.families.join(' ')}`);
    console.log(`未纳入判定的族(带理由):`);
    for (const [name, why] of Object.entries(EXCLUDED_FAMILIES)) console.log(`  - ${name}: ${why}`);
    if (loadErrors.length > 0) {
      console.log('');
      console.error(`加载失败的族 ${loadErrors.length} 个 ⇒ 本结论对它们不适用:`);
      for (const e of loadErrors) console.error(`  - ${e}`);
    }
    console.log(`\n判定范围:${report.toolCount} 枚工具;其中未判定 ${report.undetermined.length} 枚(dead-parameter 一侧看不见它们)。`);
  }

  if (loadErrors.length > 0) return 1;
  if (opts.strict && report.findings.length > 0) return 1;
  return 0;
}
