// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skills 平面加载 — 四级目录扫描 + 两种形态 → slash command。
 *
 * 灵感来源:参考行业 Agent 框架的 skills 加载机制(四级目录兼容 .ihui/.agents/.claude/.cursor)。
 * 简化策略(做减法):
 *   - 收两种形态:平铺 `<root>/<name>.md`,以及目录包 `<root>/<name>/SKILL.md`(**只下钻一层**)
 *   - 四级目录优先级:CWD > repo root > user home(高→低,前者覆盖后者同名 skill)
 *   - skills 内容注入 system prompt 的"项目上下文"段,让 LLM 按指令执行
 *   - 不实现 skill 嵌套引用/变量替换/条件加载(保持最小化)
 *
 * 为什么必须有目录包形态(2026-09-27 补):`.agents/skills`、`.claude/skills`、`~/.ihui/skills`
 * 这三个我们自己声明的根,外部技能包实际就按 `<name>/SKILL.md` 落地;旧实现第一行
 * `if (!entry.isFile()) continue` 把目录整个跳过,于是"装了技能但列表里 0 个"且没有任何解释。
 *
 * 目录结构(按优先级从高到低;每根下「平铺 .md」与「目录包 <名>/SKILL.md」两种形态都收):
 *   <cwd>/.ihui/skills/*.md          — 项目本地(最高优先级)
 *   <cwd>/.agents/skills/*.md        — 通用 agent 社区
 *   <cwd>/.claude/skills/*.md        — Claude Code 兼容
 *   <cwd>/.cursor/skills/*.md        — Cursor 兼容
 *   <repo-root>/.ihui/skills/*.md    — 仓库根(从 cwd 向上找到 .git 止)
 *   ~/.ihui/skills/*.md              — 用户全局(最低优先级)
 *
 * Skill 文件格式(参考行业 Agent 框架的 Skills frontmatter 规范):
 *   ---
 *   name: <skill 名>(可选,覆盖文件名 stem)
 *   description: <一句话描述>(可选)
 *   allowed-tools: [tool-a, tool-b](可选;**仅声明面**:解析+回写,无执行层消费方 ——
 *     "工具白名单"是名字承诺、实现未兑现,消费面登记见 getAllowedTools 注(G-380,2026-10-07))
 *   tools: [tool-c](可选,等价于 allowed-tools 的**解析别名**(同不生效),行业兼容字段)
 *   model: <模型名>(可选)
 *   tags: [coding, review](可选,分类标签)
 *   ---
 *   <skill 内容,注入 system prompt>
 *
 * 加载后:
 *   - skill 名(frontmatter.name 或文件名 stem)注册为 slash 命令(/skill <name> 展示内容)
 *   - 所有 skill 内容合并注入 system prompt(按优先级去重)
 *
 * 两条"进不进自动加载面"的闸(2026-09-29 立,本票):
 *   1) **未知 frontmatter 键 ⇒ 保守档**:出现白名单(`SAFE_FRONTMATTER_KEYS`)之外的顶格键,
 *      该技能**不进 system prompt 段**,但仍在 `/skills` 清单里、`/skill <name>` 照旧可用
 *      —— 第三方技能包带自己那套字段是常态,把它们和自家技能一视同仁地注入,等于给
 *      "谁都能往指令位写话"开路;而显式调用是**用户**下的令,不是自动加载。
 *      降权两处可见:stderr 的 `[skills] conservative load:` 诊断 + 提示段末尾的 `[note]` 计数行。
 *   2) **description 超上限 ⇒ 整条拒载**(见 `SKILL_DESCRIPTION_MAX_CODE_POINTS`),
 *      同样留一条 `[skills] refused to load:` 诊断,不静默少一条。
 *   刻意**不**拦"有 frontmatter 却没有 description":我方清单用正文首行兜底出描述,
 *   上游那一档 `skill_missing_description` 在这里没有对应的失败面(拦了只会挡掉本来能用的技能)。
 *   新增文案一律 ASCII:本文件的硬编码中文额度被守门 70 钉在 HEAD 存量上,
 *   加中文会让下一个碰这文件的人被一道与他无关的红门挡住(§12e 同型);
 *   这些文案的正解位置是 t() + 语言包(动端内 i18n 文件,不在本票清单,已列为后续票)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildSkillPromptSection, codePointLength, sanitizeSkillName } from '../utils/prompt-boundary.js';
import { parseSkillsFrontmatter } from './frontmatter.js';
import { recordInjectionInjected, recordInjectionSkipped } from '../utils/prompt-injection-registry.js';
import { declareShadowSurfaces } from './allowed-tools-shadow.js';
import * as os from 'node:os';
import type { SkillFrontmatter, SkillPrerequisites, SkillSource } from '@ihui/types';

/**
 * Skill frontmatter 元信息由 `@ihui/types` 统一维护(P0-2 对齐 packages/types 契约),
 * 此处 re-export 供现有消费方(../tests/skills.test.ts 等)按原路径 import。
 */
export type { SkillFrontmatter, SkillPrerequisites, SkillSource };

/** 解析后的 skill 定义(原始结构,含路径与 frontmatter) */
export interface SkillDefinition {
  /** 文件绝对路径 */
  filePath: string;
  /** 文件所在目录 */
  sourceDir: string;
  /** frontmatter 元信息(无 frontmatter 块时为空对象) */
  frontmatter: SkillFrontmatter;
  /** skill 正文(去掉 frontmatter 后的内容) */
  content: string;
  /** 是否存在 frontmatter 块(即使块内无字段也为 true) */
  hasFrontmatter: boolean;
  /**
   * 白名单之外的 frontmatter **顶格键名**(按出现顺序去重),仅在非空时挂上。
   *
   * 为什么条件挂载而不是恒挂数组:`parseSkillDefinition` 既有用例按 `toEqual` 断言**完整**结构
   * (`skills.test.ts` 的「返回完整 SkillDefinition 结构」),无条件加字段等于替别人的测试改期望值。
   * 语义上也更诚实 —— 缺席就是"没有未知键",不需要再区分空数组与 undefined。
   */
  unknownFrontmatterKeys?: string[];
}

export interface Skill {
  /** skill 名(frontmatter.name 或文件名 stem) */
  name: string;
  /** 来源路径(绝对路径) */
  source: string;
  /** 描述(从 frontmatter 提取,缺省为首行注释或正文截断) */
  description: string;
  /** skill 正文(去掉 frontmatter 后的内容) */
  body: string;
  /** 优先级序号(0 最高) */
  priority: number;
  /** frontmatter 元信息(无 frontmatter 块时为 undefined) */
  frontmatter?: SkillFrontmatter;
  /**
   * 保守档旗(上游同名谓词 `safeToAutoLoad`):`false` ⇒ 该技能**不进自动加载面**
   * (即不进 system prompt 的技能段),但仍在 `/skills` 清单里、可被 `/skill <name>` 显式调用。
   *
   * `undefined` 一律按 true 处理:手工构造的 `Skill`(宿主缓存、既有测试)没写过这个旗,
   * 一个"缺席"不构成降权理由 —— 降权必须是由未知键**量出来**的。
   */
  safeToAutoLoad?: boolean;
  /** 降权证据:不在白名单里的键名。只给布尔不给证据,读的人无法判断降得对不对。 */
  unknownFrontmatterKeys?: string[];
}

/** 四级扫描目录(按优先级从高到低) */
const SKILL_DIRS = [
  '.ihui/skills',
  '.agents/skills',
  '.claude/skills',
  '.cursor/skills',
];

/** 用户全局目录优先级最低 */
const USER_SKILL_DIR = '.ihui/skills';

export interface LoadSkillsOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 仓库根目录(可选,缺省从 cwd 向上找 .git) */
  repoRoot?: string;
  /**
   * 扫描过程的可见记录出口(G-408③)。缺省落 console.warn(stderr)。
   * "拒绝跟随符号链接/junction"不得表现为静默跳过 —— 静默与"没有链接"在账面上同形,
   * 那是本仓记过最多次的失效型("判据/功能失效的表现永远是安静")。
   */
  onNotice?: (message: string) => void;
}

/**
 * 从 cwd 向上查找仓库根(含 .git 目录)。
 * 找不到则返回 cwd 本身。
 */
export function findRepoRoot(cwd: string): string {
  let current = path.resolve(cwd);
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(cwd);
}

/**
 * 把键名按字面量塞进动态正则。今天的键名(全 kebab/camel)都不含元字符,所以这是恒等操作;
 * 但键名现在**由 `SKILL_FRONTMATTER_KEYS` 单张表供给**,将来一个带 `+`/`?` 的键就会让
 * `new RegExp('^' + key + ':')` 静默匹配不到 —— 表现是"该键永远解析不出",而不是报错。
 */
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 从 frontmatter 文本中解析单值字段(支持引号包裹) */
function parseFrontmatterField(front: string, key: string): string | undefined {
  const re = new RegExp(`^${escapeForRegExp(key)}:\\s*(.+?)\\s*$`, 'm');
  const m = front.match(re);
  if (!m) return undefined;
  return m[1]!.replace(/^["']|["']$/g, '').trim();
}

/** 从 frontmatter 文本中解析数组字段(支持 inline [a,b,c] 和 block `- a`)。
 *
 * Tri-state return (G-428, decided 2026-10-07): a key that can widen the
 * permission surface must never be folded. Values are distinguishable:
 *   - `string[]`  — parsed list, INCLUDING the explicit empty list `key: []` => []
 *   - `null`      — block mapping form (`key:` followed by an indented `k: v`
 *     line) is ILLEGAL, mirroring upstream subagent/profile-frontmatter.ts:76-80
 *     ("a block mapping is not a name list; it must not be swallowed into an
 *     empty array and thereby widen the child MCP scope"). Folding it into []
 *     or into "absent" makes "declared a constraint" indistinguishable from
 *     "said nothing" on the consumer side.
 *   - `undefined` — key absent (including a bare `key:` line with no indented
 *     lines after it)
 */
function parseFrontmatterArray(front: string, key: string): string[] | null | undefined {
  const inlineRe = new RegExp(`^${escapeForRegExp(key)}:\\s*\\[([^\\]]*)\\]\\s*$`, 'm');
  const inlineMatch = front.match(inlineRe);
  if (inlineMatch) {
    return inlineMatch[1]!
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s.length > 0);
  }
  const blockRe = new RegExp(`^${escapeForRegExp(key)}:\\s*$\\n((?:[ \\t]*-\\s+.+\\n?)+)`, 'm');
  const blockMatch = front.match(blockRe);
  if (blockMatch) {
    return blockMatch[1]!
      .split('\n')
      .map((l) => l.match(/^[ \t]*-\s+(.+?)\s*$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]!.replace(/^["']|["']$/g, '').trim());
  }
  // Block-mapping detection: a bare `key:` line whose first following non-blank
  // line is indented but NOT a `- item` list entry. Checked AFTER the two valid
  // forms so valid lists are never misjudged; ordered last so `key: []` and
  // block lists keep their existing semantics byte-for-byte.
  const mappingRe = new RegExp(
    `^${escapeForRegExp(key)}:[ \\t]*$\\n(?:[ \\t]*\\n)*[ \\t]+(?!-[ \\t])\\S`,
    'm',
  );
  if (mappingRe.test(front)) return null;
  return undefined;
}

/** 按 multiple 候选 key(kebab/camel)解析单值字段,返回首个命中 */
function parseFrontmatterFieldAny(front: string, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const v = parseFrontmatterField(front, key);
    if (v) return v;
  }
  return undefined;
}

/** 按 multiple 候选 key(kebab/camel)解析数组字段,返回首个命中且非空 */
function parseFrontmatterArrayAny(front: string, keys: readonly string[]): string[] | undefined {
  for (const key of keys) {
    const v = parseFrontmatterArray(front, key);
    if (v && v.length > 0) return v;
  }
  return undefined;
}

/** 按 multiple 候选 key 解析布尔字段(true/yes→true,false/no→false),未命中返回 undefined */
function parseFrontmatterBool(front: string, keys: readonly string[]): boolean | undefined {
  for (const key of keys) {
    const re = new RegExp(`^${escapeForRegExp(key)}:\\s*(.+?)\\s*$`, 'm');
    const m = front.match(re);
    if (m) {
      const v = m[1]!.trim().toLowerCase().replace(/^["']|["']$/g, '');
      if (v === 'true' || v === 'yes') return true;
      if (v === 'false' || v === 'no') return false;
    }
  }
  return undefined;
}

/** SkillSource 合法值(builtin/user/auto/hub),用于校验 frontmatter source 字段 */
const SKILL_SOURCE_VALUES: ReadonlySet<string> = new Set(['builtin', 'user', 'auto', 'hub']);

/**
 * frontmatter **键位表** —— 解析面与保守档白名单共用这一份,不得各写一遍。
 *
 * 为什么必须共用:保守档的判据是「出现白名单之外的键 ⇒ 该技能不进自动加载面」。
 * 白名单若另抄一份,两种漂法都是坏结局:
 *   ① 解析器新增一个键而白名单没跟上 ⇒ 合法技能被**静默**挡在 prompt 外
 *      (症状是「技能装了却不起作用」,没有报错也没有测试会红);
 *   ② 白名单先加了某个键而解析器不读它 ⇒ 判据对那一格全盲, yet 账面一路绿灯。
 * 本仓记过最多次的失效型就是「两处算同一件事必漂移」,所以这里用一张表把两侧钉死。
 *
 * 每个键的**全部合法拼写**都要列进来(kebab 与 camel 同视,见 parseFrontmatterFieldAny 的历史兼容),
 * 否则按 camel 写的技能会被误判成「未知键」而挡在 prompt 外。
 */
const SKILL_FRONTMATTER_KEYS = {
  name: ['name'],
  description: ['description'],
  allowedTools: ['allowed-tools'],
  tools: ['tools'],
  model: ['model'],
  tags: ['tags'],
  version: ['version'],
  license: ['license'],
  source: ['source'],
  // G-428: permissionMode becomes a parsed key (single spelling, the one upstream
  // profile.ts reads). Being parsed means it also leaves the conservative
  // unknown-key demotion: the protection moves to the load-origin split in
  // readSkillFile (project-source skills drop the value outright), which is the
  // upstream profile.ts:183-185 shape.
  permissionMode: ['permissionMode'],
  relatedSkills: ['related-skills', 'relatedSkills'],
  progressiveDisclosure: ['progressive-disclosure', 'progressiveDisclosure'],
  prerequisites: ['prerequisites'],
  autoGeneratedAt: ['auto-generated-at', 'autoGeneratedAt'],
  autoGeneratedFromTask: ['auto-generated-from-task', 'autoGeneratedFromTask'],
} as const satisfies Record<string, readonly string[]>;

/**
 * 规范里合法、但我方**刻意不消费**的扩展键:算「已知」,不走保守档。
 *
 * 为什么这一格必须存在,而且必须显式列出来(而不是"解析器读到的键就是白名单"):
 * 现测本机可加载到的 30 个真实技能里,**27 个带 `metadata:`**(行业技能包的普遍形态,
 * 内容形如 `metadata: { requires: { bins: [...] } }`)。若白名单只等于解析器读的键,
 * 保守档会一次挡掉 28/30 —— 那就不是"第三方与可信技能可分辨",而是把整端技能注入
 * 默默关掉了(本票的硬约束正是「默认档不得把既有可信技能整片挡掉」)。
 * `when-to-use`/`when_to_use` 同理取自上游的 SAFE_FRONTMATTER_KEYS(那边能加载的技能
 * 不该在这边被静默降权)。
 *
 * 反过来,`disable`、`env_vars` 这类**声明了我方根本不honour的能力/开关**的键刻意**不**进白名单:
 * 那才是保守档要拦的形状(现测各 1 个技能带它们,代价是那两条不进 prompt 而是留可见计数)。
 */
const SPEC_FRONTMATTER_KEYS_NOT_PARSED = ['metadata', 'when-to-use', 'when_to_use'] as const;

/** 解析器认识的键(含全部拼写变体)。由键位表推导,**禁止**在别处再抄一份键名清单。 */
const PARSED_FRONTMATTER_KEYS: readonly string[] = Object.values(SKILL_FRONTMATTER_KEYS).flatMap(
  (variants) => variants,
);

/**
 * 自动加载白名单:出现集合之外的顶格键 ⇒ 该技能不进 prompt 段(保守档)。
 * 判据的唯一入口是下面两个函数,加载处与 prompt 段都只读它们的结论,不得各自重算。
 */
export const SAFE_FRONTMATTER_KEYS: ReadonlySet<string> = new Set<string>([
  ...PARSED_FRONTMATTER_KEYS,
  ...SPEC_FRONTMATTER_KEYS_NOT_PARSED,
]);

/**
 * frontmatter `description` 的长度上限,单位是 **码位**(不是 UTF-16 码元数;
 * emoji/生僻汉字占两个码元,按码元数会把长度算多 —— 同仓 `prompt-boundary.truncateToCodePoints`
 * 就是为这一条被写过一次)。
 *
 * 为什么是 1024 这个数(三条都要成立,否则就是随手挑的魔法数):
 *   ① **跨工具兼容**:上游/行业 skills 规范的 description 档就是 1024
 *      (`.ihui-agent/tmp/zcode-study/.../adapters/src/skills/index.ts` 的 `MAX_DESCRIPTION_LENGTH`)。
 *      同一份技能在那边能加载、在这边被拒,等于我们的技能格式和生态不兼容。
 *   ② **成本口径**:description 是「每个技能、每一轮会话都进上下文」的那一行,
 *      它的代价按**技能数**乘;超档基本等于"把正文写错了地方"(该写进 body)。
 *      所以这里选拒载 + 记诊断,而不是静默截断 —— 截断出来的半句描述对模型是误导。
 *   ③ **默认档的边界**:现测本机 30 个真实技能的最长 description = 528 码位,0 个越界
 *      ⇒ 这一档只挡畸形件,不会把既有可信技能整片挡掉。
 */
export const SKILL_DESCRIPTION_MAX_CODE_POINTS = 1024;

/**
 * 顶格键名的判据。`^` 就是"顶格"这一维的**唯一**强制:缩进行(`metadata:` 下的 `requires:`、
 * `prerequisites:` 下的 `commands:`)、注释行、块列表项都天然匹配不到。
 */
const TOP_LEVEL_KEY_RE = /^([A-Za-z0-9_-]+):/;

/**
 * 取 frontmatter 的**顶格键名**(按出现顺序去重)。
 *
 * 为什么必须只认顶格:把缩进当顶层键 ⇒ 每一个带嵌套块的合法技能都会被判成「有未知键」
 * 而静默不进 prompt(现测本机 27/30 个真实技能带 `metadata:` 嵌套块,全都会中这一枪)。
 * 键行判据与 `parseFrontmatterField` 的 `^key:` 同形(顶格 + 冒号),不再各写一份。
 *
 * 这里刻意**只有**上面那一条锚点。先前还跟着两句 `continue` 守卫(跳过空白行、跳过缩进行),
 * 那是第二条强制 —— 后果不是多余几行,而是这一格测不出来:变异任何一条,另一条仍然挡着,
 * 回归用例恒绿,于是"判据到底由谁生效"没人知道(实测:把键正则改成允许前导空白,
 * 三条 B 组用例全绿)。冗余判据的真实代价是让失明看不出来,所以拆成一条。
 */
function extractTopLevelFrontmatterKeys(front: string): string[] {
  const keys: string[] = [];
  for (const line of front.split(/\r?\n/)) {
    const m = line.match(TOP_LEVEL_KEY_RE);
    if (m && !keys.includes(m[1]!)) keys.push(m[1]!);
  }
  return keys;
}

/**
 * 白名单之外的顶格键名 —— **保守档判据的唯一实现**。
 * 返回空数组 = 全部键已知 = 可自动加载。
 */
export function findUnknownFrontmatterKeys(front: string): string[] {
  return extractTopLevelFrontmatterKeys(front).filter((key) => !SAFE_FRONTMATTER_KEYS.has(key));
}

/** 把 inline 数组字面量 "a, b, c" 拆为 string[](去引号/trim/滤空) */
function splitArrayLiteral(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0);
}

/** 把 block 数组文本("  - a\n  - b")拆为 string[](去引号/trim/滤空) */
function parseBlockArray(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.match(/^[ \t]*-\s+(.+?)\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1]!.replace(/^["']|["']$/g, '').trim());
}

/**
 * 解析 prerequisites 对象(支持嵌套块 + inline 两种写法)。
 *
 * 嵌套块(inline 数组):
 *   prerequisites:
 *     commands: [curl, jq]
 *     env: [GITHUB_TOKEN]
 *
 * 嵌套块(block 数组):
 *   prerequisites:
 *     commands:
 *       - curl
 *       - jq
 *
 * inline(尽力解析):
 *   prerequisites: {commands: [curl], env: [TOKEN]}
 *
 * 解析失败或无内容时返回 undefined,不抛错。
 */
function parsePrerequisites(front: string): SkillPrerequisites | undefined {
  // 键名取自键位表(与保守档白名单同源):这里写死一份字面量,将来表里改名就会出现
  // "白名单认得它、解析器读不到它"的静默失能。
  const key = escapeForRegExp(SKILL_FRONTMATTER_KEYS.prerequisites[0]!);
  // inline: prerequisites: {commands: [curl], env: [TOKEN]}
  const inlineRe = new RegExp(`^${key}:\\s*\\{([^}]*)\\}\\s*$`, 'm');
  const inlineMatch = front.match(inlineRe);
  if (inlineMatch) {
    const inner = inlineMatch[1]!;
    const result: SkillPrerequisites = {};
    const cmds = inner.match(/commands:\s*\[([^\]]*)\]/);
    if (cmds) result.commands = splitArrayLiteral(cmds[1]!);
    const envs = inner.match(/env:\s*\[([^\]]*)\]/);
    if (envs) result.env = splitArrayLiteral(envs[1]!);
    return result.commands || result.env ? result : undefined;
  }

  // 嵌套块:prerequisites:\n  commands: ...\n  env: ...
  const blockRe = new RegExp(`^${key}:\\s*\\n((?:[ \\t]+\\S[^\\n]*\\n?)+)`, 'm');
  const blockMatch = front.match(blockRe);
  if (!blockMatch) return undefined;
  const block = blockMatch[1]!;
  const result: SkillPrerequisites = {};

  // commands:inline [a,b] 或 block 数组
  const cmdInline = block.match(/^[ \t]+commands:\s*\[([^\]]*)\]\s*$/m);
  if (cmdInline) {
    result.commands = splitArrayLiteral(cmdInline[1]!);
  } else {
    const cmdBlock = block.match(/^[ \t]+commands:\s*\n((?:[ \t]+-\s+.+\n?)+)/m);
    if (cmdBlock) result.commands = parseBlockArray(cmdBlock[1]!);
  }

  // env:inline 或 block 数组
  const envInline = block.match(/^[ \t]+env:\s*\[([^\]]*)\]\s*$/m);
  if (envInline) {
    result.env = splitArrayLiteral(envInline[1]!);
  } else {
    const envBlock = block.match(/^[ \t]+env:\s*\n((?:[ \t]+-\s+.+\n?)+)/m);
    if (envBlock) result.env = parseBlockArray(envBlock[1]!);
  }

  return result.commands || result.env ? result : undefined;
}

/**
 * 解析 frontmatter 文本块为 SkillFrontmatter 对象(无法识别的内容跳过,不抛错)。
 * 向后兼容:无新字段的旧 skill 文件仍能正常解析。
 *
 * 键名一律取自 `SKILL_FRONTMATTER_KEYS`(与保守档白名单同一张表)——
 * 这里再写一遍字面量,就是给"解析器认了、白名单没认"那一型留门。
 */
function parseFrontmatter(front: string): SkillFrontmatter {
  const K = SKILL_FRONTMATTER_KEYS;
  const fm: SkillFrontmatter = {};
  const name = parseFrontmatterFieldAny(front, K.name);
  if (name) fm.name = name;
  const description = parseFrontmatterFieldAny(front, K.description);
  if (description) fm.description = description;
  // Single-spelling array keys go through `parseFrontmatterArray` (not `…ArrayAny`):
  // the latter demands "first non-empty hit" and would turn an explicit
  // `allowed-tools: []` from "parsed empty list" into "field absent". G-428
  // additionally requires the null (illegal block mapping) state to land on the
  // object verbatim, so the mount check is `!== undefined`, not truthiness —
  // a falsy `null` must NOT be silently dropped back to "absent".
  const allowedTools = parseFrontmatterArray(front, K.allowedTools[0]!);
  if (allowedTools !== undefined) fm.allowedTools = allowedTools;
  const tools = parseFrontmatterArray(front, K.tools[0]!);
  if (tools !== undefined) fm.tools = tools;
  const model = parseFrontmatterFieldAny(front, K.model);
  if (model) fm.model = model;
  const tags = parseFrontmatterArray(front, K.tags[0]!);
  if (tags) fm.tags = tags;

  // P0-2 新字段(对齐 packages/types SkillFrontmatter 契约)
  const version = parseFrontmatterFieldAny(front, K.version);
  if (version) fm.version = version;
  const license = parseFrontmatterFieldAny(front, K.license);
  if (license) fm.license = license;
  const sourceRaw = parseFrontmatterFieldAny(front, K.source);
  if (sourceRaw && SKILL_SOURCE_VALUES.has(sourceRaw)) {
    fm.source = sourceRaw as SkillSource;
  }
  // G-428: raw declared string, deliberately NOT validated here — value
  // normalization is the (future) consumer's job via permission-mode.ts. The
  // load-origin split (project drops / user keeps) lives in readSkillFile.
  const permissionMode = parseFrontmatterFieldAny(front, K.permissionMode);
  if (permissionMode) fm.permissionMode = permissionMode;
  const relatedSkills = parseFrontmatterArrayAny(front, K.relatedSkills);
  if (relatedSkills) fm.relatedSkills = relatedSkills;
  const progressiveDisclosure = parseFrontmatterBool(front, K.progressiveDisclosure);
  if (progressiveDisclosure !== undefined) fm.progressiveDisclosure = progressiveDisclosure;
  const prerequisites = parsePrerequisites(front);
  if (prerequisites) fm.prerequisites = prerequisites;
  const autoGeneratedAt = parseFrontmatterFieldAny(front, K.autoGeneratedAt);
  if (autoGeneratedAt) fm.autoGeneratedAt = autoGeneratedAt;
  const autoGeneratedFromTask = parseFrontmatterFieldAny(front, K.autoGeneratedFromTask);
  if (autoGeneratedFromTask) fm.autoGeneratedFromTask = autoGeneratedFromTask;
  return fm;
}

/**
 * 解析 skill 文件内容为 SkillDefinition(含 frontmatter + 正文 + 路径信息)。
 * 无 frontmatter 块时 hasFrontmatter=false,frontmatter={},content=原文 trimmed。
 * frontmatter 解析失败(无法识别字段)时降级为空 frontmatter,不抛错。
 *
 * 围栏结构(开启/闭合/截取/bodyLineOffset)统一走 `parseSkillsFrontmatter` 唯一出口:
 * `---` 有开无闭(unterminated_frontmatter,典型是手删了闭合行)同样容错降级 —— 整份原文
 * 当正文、frontmatter 置空、加载不中断;具名 reason 收在 codec 里供测试与诊断点名,
 * 不在这里静默冒充"本来就没有 frontmatter"。
 */
export function parseSkillDefinition(content: string, filePath: string): SkillDefinition {
  const sourceDir = path.dirname(filePath);
  const fence = parseSkillsFrontmatter(content);
  if (fence.ok) {
    const front = fence.front;
    const body = fence.body.trim();
    let frontmatter: SkillFrontmatter;
    try {
      frontmatter = parseFrontmatter(front);
    } catch {
      frontmatter = {};
    }
    const def: SkillDefinition = { filePath, sourceDir, frontmatter, content: body, hasFrontmatter: true };
    // 保守档旗在这里**只算一次**(键白名单的唯一实现在 SAFE_FRONTMATTER_KEYS),
    // 加载处与 prompt 段都只读结论。判据面取原始 frontmatter 文本,取不到解析后的键集:
    // 解析器只会把认识的键写进对象,"没写进去"既可能是未知键、也可能是值为空,分不开。
    const unknownKeys = findUnknownFrontmatterKeys(front);
    if (unknownKeys.length > 0) def.unknownFrontmatterKeys = unknownKeys;
    return def;
  }
  return {
    filePath,
    sourceDir,
    frontmatter: {},
    content: content.trim(),
    hasFrontmatter: false,
  };
}

/**
 * 合并 allowedTools 与 tools 两字段并去重(向后兼容视图)。
 *
 * 三值透传(G-428,2026-10-07 拍板):视图绝不折叠权限面的键 ——
 *   - `undefined` —— frontmatter 整体缺席,或两键都没写("什么都没说");
 *   - `null`      —— 任一字段是块状 mapping(判非法),原样上浮,吞成空表就是
 *                    上游"被空数组吞掉后扩大 scope"的事故重演;
 *   - `string[]`  —— 合并去重结果(显式空表仍是 [])。
 *
 * 消费面如实登记(2026-10-10 更新,取代 G-380 那句"生产零调用方"):唯一生产调用点是
 * `formatSkillsForPrompt`,它把结果交给 `allowed-tools-shadow.ts` **记账(只记不挡)** ——
 * 机主 2026-10-10 拍板「先影子记账一周再开真门控」。所以本函数今天身份是"影子样本的来源",
 * **仍不是已生效判据**:没有任何执行层按这份清单限制工具,名字里的"工具白名单"依旧是
 * 声明面承诺。一周后要不要落闸门是新的拍板,在那之前本注释不得改写成"已实现/已生效",
 * 也不得倒回"零调用方"(那会把已装车的记账说成没装车)。
 */
export function getAllowedTools(fm: SkillFrontmatter | undefined): string[] | null | undefined {
  if (!fm) return undefined;
  if (fm.allowedTools === null || fm.tools === null) return null;
  if (fm.allowedTools === undefined && fm.tools === undefined) return undefined;
  const set = new Set<string>();
  for (const t of fm.allowedTools ?? []) set.add(t);
  for (const t of fm.tools ?? []) set.add(t);
  return Array.from(set);
}

/**
 * Where a skill file was discovered. `project` = inside the repo (cwd or repo
 * root scan roots), `user` = the user home directory. G-428 (mirroring upstream
 * subagent/profile.ts:183-185): repo input must never escalate the runtime, so
 * `permissionMode` is dropped for project-origin skills and kept only for
 * user-origin ones. This is the LOADER's origin, deliberately unrelated to the
 * frontmatter `source:` declaration field (SkillSource builtin/user/auto/hub).
 */
type SkillLoadOrigin = 'project' | 'user';

/**
 * 读取一份技能文件并归一成 Skill。取不到/解析失败/被拒载 ⇒ 返回 null,由调用方跳过。
 * `fallbackName` 是 frontmatter 没有 name 时用的名字(平铺文件用文件名,目录形态用目录名)。
 *
 * 两处"少了一条技能"都必须经 `onNotice` 留下可见记录,不得静默:
 *   - description 超 `SKILL_DESCRIPTION_MAX_CODE_POINTS` ⇒ **整条拒载**(畸形件不进任何面);
 *   - frontmatter 含未知键 ⇒ **仍加载**(清单与显式调用照旧),只是不进自动加载面。
 * 技能清单少一条、提示词少一段,使用者都看不出差别 —— 与本仓「判据/功能失效的表现永远是安静」
 * 同一条禁令,所以出口是调用方传进来的那一个 `onNotice`,不是在这里各写一遍 console。
 */
function readSkillFile(
  fullPath: string,
  fallbackName: string,
  priority: number,
  origin: SkillLoadOrigin,
  onNotice: (message: string) => void,
): Skill | null {
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const def = parseSkillDefinition(raw, fullPath);
    const fm = def.frontmatter;
    // —— description 长度闸:只闸 frontmatter 里**声明**的那一条 ——
    // 兜底路径产出的 description 天然 ≤80 码位,不可能越闸,所以这一档管的正是声明值本身。
    // 文案走英文:本文件的硬编码中文额度由守门 70 钉在 HEAD 存量(见交付报告),
    // 新增中文会让**下一个碰这文件的人**被一道与他无关的红门挡住(§12e 同型)。
    // 这些诊断的正解位置是 t() + 语言包,但那要动端内 i18n 文件,不在本票清单内。
    if (fm.description && codePointLength(fm.description) > SKILL_DESCRIPTION_MAX_CODE_POINTS) {
      const actual = codePointLength(fm.description);
      onNotice(
        `[skills] refused to load ${fm.name ?? fallbackName}: description is ${actual} code points, `
          + `over the ${SKILL_DESCRIPTION_MAX_CODE_POINTS} limit (rationale lives on `
          + `SKILL_DESCRIPTION_MAX_CODE_POINTS) — move that text into the body, not the description. ${fullPath}`,
      );
      return null;
    }
    const name = fm.name ?? fallbackName;
    let description: string;
    if (fm.description) {
      description = fm.description;
    } else if (def.hasFrontmatter) {
      description = def.content.slice(0, 80);
    } else {
      const firstLine = def.content.split('\n').find((l) => l.trim().length > 0) ?? '';
      description = firstLine.slice(0, 80);
    }
    const skill: Skill = {
      name,
      source: fullPath,
      description,
      body: def.content,
      priority,
    };
    if (def.hasFrontmatter) {
      // G-428 (upstream profile.ts:183-185 shape): a project (repo) source must
      // never raise the runtime's permission floor, so the declared value is
      // dropped here — not merely ignored by consumers. `fm` is a fresh object
      // from parseFrontmatter for this file, so mutating it is safe.
      if (origin === 'project' && fm.permissionMode !== undefined) {
        delete fm.permissionMode;
      }
      skill.frontmatter = fm;
    }
    // —— 保守档:未知键 ⇒ 不进自动加载面,并当场留一条可见诊断 ——
    // 判据不在这里重算:`def.unknownFrontmatterKeys` 是 parseSkillDefinition 用
    // SAFE_FRONTMATTER_KEYS 那一份白名单算出来的结论(唯一实现)。
    const unknownKeys = def.unknownFrontmatterKeys;
    if (unknownKeys && unknownKeys.length > 0) {
      skill.safeToAutoLoad = false;
      skill.unknownFrontmatterKeys = unknownKeys;
      onNotice(
        `[skills] conservative load: ${name} has unrecognized frontmatter keys: ${unknownKeys.join(', ')}`
          + ` => not auto-injected into the system prompt (still listed by /skills, still callable via`
          + ` /skill ${name}; to opt a key in, register it in SKILL_FRONTMATTER_KEYS and consume it in parseFrontmatter).`
          + ` ${fullPath}`,
      );
    }
    return skill;
  } catch {
    // 读取失败跳过
    return null;
  }
}

/** 去重键:技能**文件的真实路径**(不是 name)。 */
function realKey(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    // 取不到 realpath(权限/竞态)时退回规范化绝对路径 —— 宁可少去重,也不能把两份不同技能并成一份。
    return path.resolve(file);
  }
}

/**
 * 该路径本身是否为符号链接 / Windows junction(重解析点)。G-408③ 的显式判据。
 *
 * 必须用 **lstat** 而不是 stat:`stat`/`existsSync` 会**跟随**重解析点去报告目标的状态,
 * 链接本体反而看不见(AGENTS §26 实测:Node 侧 `lstatSync(p).isSymbolicLink()` 对 Windows
 * junction 也返回 true,不需要它是 POSIX symlink)。
 * lstat 自身失败(无权限/竞态)返回 false ⇒ 交回调用方按"该路径不可读"的既有路径处理 ——
 * 不得把"判不出"伪装成"确实是链接"而静默拒绝。
 */
function isReparseLink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * 扫描单个目录下的技能,返回 Skill 数组。两种形态都收:
 *   ① 平铺 `<dir>/<name>.md`                      —— 本仓历史形态
 *   ② 目录包 `<dir>/<name>/SKILL.md`(只下一层) —— 社区/行业 Agent 技能包的实际落地形态
 *
 * 病灶(第三十七批):旧实现第一行就是 `if (!entry.isFile()) continue`,于是整个目录被跳过,
 * 而 `.agents/skills`、`.claude/skills`、`~/.ihui/skills` 这三个我们自己声明的扫描根,
 * 外部技能包一律按 `<name>/SKILL.md` 落地(本机的第三方技能集就是这个形态)。
 * 症状是"装了技能但 /skills 里 0 个",且**没有任何一句解释** —— 与本仓最高频的失效型同族:
 * 判据/功能失效的表现永远是安静,而不是报错。
 *
 * 两条刻意的设计:
 *  - 按**文件真实路径**去重,不按 name:同名两份是两份不同的技能(上游同口径),
 *    按 name 去重会静默吞掉后来那一份;realpath 同时兜住"目录被软链进来"的重复命中。
 *  - 只下钻一层、且只认 `SKILL.md` 这一个文件名:再深就是别人的资源目录
 *    (`references/`、`scripts/`、`assets/`),把它们当技能读会污染提示词。
 */
function scanDir(
  dir: string,
  priority: number,
  origin: SkillLoadOrigin,
  onNotice: (message: string) => void,
): Skill[] {
  // G-408③:此前"不跟随链接"是 Dirent.isFile()/isDirectory() 对重解析点恰好返回 false 的
  // **偶然行为** —— 无注释、无判据,libuv 的 dtype 映射哪天变了,这里就静默变成跨根穿透。
  // 现把"一律不跟随符号链接/junction"落成三粒度的显式拒绝(根、子项候选、技能文件本体),
  // 每处遇到都留可见记录。理由同 AGENTS §26:递归遍历穿透 junction 曾把"清理工具"变成
  // "清空真实目标"的事故现场;技能扫描读的是**仓库内容**,别人放一个指向 ~/.ssh 或
  // 用户主目录的链接,跟随=把任意第三方文件读进 system prompt,那是外读通道不是容错。
  let rootLink: boolean;
  try {
    rootLink = fs.lstatSync(dir).isSymbolicLink();
  } catch {
    return []; // 根不存在:正常跳过,不是"拒绝"
  }
  if (rootLink) {
    onNotice(`[skills] 拒绝跟随符号链接/junction(扫描根本体),该根整根不扫: ${dir}`);
    return [];
  }
  const skills: Skill[] = [];
  const seen = new Set<string>();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const push = (file: string, fallbackName: string): void => {
    // 第三粒度:根下条目都是真目录时,`<dir>/<name>/SKILL.md` 本体仍可能是链接
    // (readdir 只看过根的一层子项,没看过这个文件)。
    if (isReparseLink(file)) {
      onNotice(`[skills] 拒绝跟随符号链接/junction(技能文件本体),不读取: ${file}`);
      return;
    }
    const key = realKey(file);
    if (seen.has(key)) return;
    const skill = readSkillFile(file, fallbackName, priority, origin, onNotice);
    if (!skill) return;
    seen.add(key);
    skills.push(skill);
  };
  // 排序保证同一目录内的遍历顺序稳定(否则 readdirSync 的顺序会让"同一文件被两个形态命中"
  // 时保留哪一份变成随机的)
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    // 第二粒度:根下子项候选(Dirent 与 lstat 双查,任一判为链接即拒 —— 判据不得只信一面)
    if (entry.isSymbolicLink() || isReparseLink(full)) {
      onNotice(`[skills] 拒绝跟随符号链接/junction(扫描根子项),不进目录: ${full}`);
      continue;
    }
    if (entry.isFile()) {
      if (!entry.name.endsWith('.md')) continue;
      const fileStem = entry.name.slice(0, -3);
      if (!fileStem || fileStem.startsWith('_')) continue;
      push(full, fileStem);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    push(path.join(full, 'SKILL.md'), entry.name);
  }
  return skills;
}

/**
 * 加载所有 skills,按优先级去重(同名 skill 高优先级覆盖低优先级)。
 *
 * 扫描顺序(优先级从高到低):
 *   0-3: <cwd>/.{ihui,agents,claude,cursor}/skills
 *   4-7: <repoRoot>/.{ihui,agents,claude,cursor}/skills(若 repoRoot !== cwd)
 *   8:   ~/.ihui/skills
 */
export function loadSkills(opts: LoadSkillsOptions): Skill[] {
  const cwd = path.resolve(opts.cwd);
  const repoRoot = opts.repoRoot ?? findRepoRoot(cwd);
  const home = os.homedir();

  const scanLocations: Array<{ dir: string; priority: number; origin: SkillLoadOrigin }> = [];

  let priority = 0;
  for (const sub of SKILL_DIRS) {
    scanLocations.push({ dir: path.join(cwd, sub), priority, origin: 'project' });
    priority++;
  }
  if (repoRoot !== cwd) {
    for (const sub of SKILL_DIRS) {
      scanLocations.push({ dir: path.join(repoRoot, sub), priority, origin: 'project' });
      priority++;
    }
  }
  scanLocations.push({ dir: path.join(home, USER_SKILL_DIR), priority, origin: 'user' });

  const onNotice = opts.onNotice ?? ((m: string) => console.warn(m));
  const all: Skill[] = [];
  for (const loc of scanLocations) {
    all.push(...scanDir(loc.dir, loc.priority, loc.origin, onNotice));
  }

  // 按优先级去重(低 priority 值 = 高优先级,覆盖高 priority 值)
  const byName = new Map<string, Skill>();
  for (const s of all) {
    const existing = byName.get(s.name);
    if (!existing || s.priority < existing.priority) {
      byName.set(s.name, s);
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 保守档未注入时的可见计数行。
 *
 * 为什么必须有它:提示词**静默变短**是本仓记过最多次的失效型(读的人以为技能生效了,
 * 实际那一条根本没进上下文,而没有任何地方报错)。所以降权必须落两处:stderr 的逐条诊断
 * (给排障的人)+ 提示里的计数行(给这一轮会话里的人与模型)。
 *
 * 三条刻意选择:
 *  - 前缀用 `[note]` 而不是 `[系统提醒]` 那类裸宿主字样:后者会被提示注入登记门判成冒充,
 *    而且第三方内容里出现同样字样时模型无从分辨"宿主在说话"与"技能正文里写着"。
 *    文案取 ASCII 的理由同本文件头注(守门 70 的每文件中文额度)。
 *  - 名称与键名都过 `sanitizeSkillName`(剥控制符/尖括号并按码位限长):含未知键的技能来自
 *    第三方目录,它的**名字**同样不可信,直接插值等于给伪造标签开门。
 *  - 整行自己封顶:`buildSkillPromptSection` 的字节预算管不到追加在它外面的这一段,
 *    所以最多点名 MAX_WITHHELD_NAMED 条 —— 否则上百个畸形技能会把这一段撑成噪声。
 */
const MAX_WITHHELD_NAMED = 10;

function withheldCountLine(withheld: readonly Skill[]): string {
  const named = withheld.slice(0, MAX_WITHHELD_NAMED).map((s) => {
    const name = sanitizeSkillName(s.name) || 'unnamed';
    const keys = (s.unknownFrontmatterKeys ?? []).slice(0, 3).map((k) => sanitizeSkillName(k) || '?');
    return keys.length > 0 ? `${name}[${keys.join(' ')}]` : name;
  });
  const more = withheld.length > named.length ? ` (${withheld.length} total)` : '';
  return (
    `\n[note] ${withheld.length} skill(s) were not auto-injected because their frontmatter has `
    + `unrecognized keys: ${named.join(', ')}${more}. They stay in /skills and can be invoked with /skill <name>.`
  );
}

/**
 * Name of the model-invokable skill tool the prompt section is gated on (G-427,
 * decided 2026-10-07: copy upstream). Upstream `context/builder.ts:225-228` only
 * advertises the skills list when this tool is actually present in the tool
 * table: a prompt that advertises capabilities the real tool surface lacks is a
 * lie the model will act on. Our repo has no `Skill` tool registered yet, so the
 * gate is opt-in via {@link SkillsPromptGateOptions.toolTable} until a caller
 * passes the surface (the only producer call site is commands/agent.ts).
 */
export const SKILL_INVOCATION_TOOL_NAME = 'Skill';

/** Optional gate inputs for {@link formatSkillsForPrompt}. */
export interface SkillsPromptGateOptions {
  /**
   * Tool names registered for the agent whose prompt is being built. When
   * provided and `Skill` is absent, the skills section is withheld and the
   * omission is recorded via the injection registry (never silently). Omitted
   * = legacy behavior, byte-identical to before G-427 (no tool-table judgment).
   */
  toolTable?: readonly string[];
}

/**
 * 把 skills 合并为 system prompt 注入段。
 *
 * 委托给 `buildSkillPromptSection`(提示词边界唯一出口):技能正文来自第三方目录,
 * 原样拼接等于把"别人的文本"放进指令位而不设预算;清洗、单条/总量预算、
 * 以及"被省略必须留下可读计数"都在那一处实现,本函数不再自带第二份逻辑。
 *
 * **自动加载面就在这一处**:带未知 frontmatter 键的技能(`safeToAutoLoad === false`)不进本段。
 * 这里只读那一面旗、**不重算白名单** —— 判据住在 `SAFE_FRONTMATTER_KEYS` 与
 * `findUnknownFrontmatterKeys`,两处各写一遍必然漂,而漂的方向一定是"合法技能被静默降权"。
 * 旗缺席(undefined)按可加载处理:降权必须由未知键量出来,不能由"构造方没写过这个字段"推出来。
 *
 * G-427 广告门控(拍板 2026-10-07"抄上游"):调用方传入 `toolTable` 且其中没有
 * `Skill` 工具时,技能段整块不出(走 recordInjectionSkipped 留下可见记过,不静默)——
 * 广告的能力必须按真实工具表门控。不传 toolTable = 改动前行为逐字不变。
 */
export function formatSkillsForPrompt(skills: Skill[], gate?: SkillsPromptGateOptions): string {
  if (gate?.toolTable && !gate.toolTable.includes(SKILL_INVOCATION_TOOL_NAME)) {
    return recordInjectionSkipped(
      'skill_list',
      `skill invocation tool "${SKILL_INVOCATION_TOOL_NAME}" is not in the tool table; `
        + `the skills section is not advertised (G-427 ad gate)`,
    );
  }
  if (skills.length === 0) return recordInjectionSkipped('skill_list', '未发现任何技能');
  const autoLoadable: Skill[] = [];
  const withheld: Skill[] = [];
  for (const s of skills) {
    (s.safeToAutoLoad === false ? withheld : autoLoadable).push(s);
  }
  if (autoLoadable.length === 0) {
    return recordInjectionSkipped(
      'skill_list',
      `all ${skills.length} skill(s) withheld by the conservative rule (unrecognized frontmatter keys); see the [skills] diagnostics for the key names`,
    );
  }
  const built = buildSkillPromptSection(autoLoadable.map((s) => ({ name: s.name, body: s.body })));
  if (built.included === 0) {
    return recordInjectionSkipped(
      'skill_list',
      `${autoLoadable.length} auto-loadable skill(s) all have empty bodies (${withheld.length} more withheld by the conservative rule)`,
    );
  }
  // G-427 第①步(机主拍板 2026-10-10「先影子记账一周再开真门控」):把**进自动加载面**的这批
  // 技能交给 allowed-tools 影子账本。声明点选在"提示词真的产出了技能段"之后,而不是
  // "磁盘上有这些文件" —— 记账的口径必须与"这批技能真的在生效"同形,否则一周后拿到的
  // 是一份没发生过的样本。三值口径直接取 `getAllowedTools`(唯一实现,本文件不重算一遍),
  // 影子账本**永不拦截、永不改判定**(见 allowed-tools-shadow.ts 文件头①)。
  declareShadowSurfaces(autoLoadable.map((s) => ({ name: s.name, allowed: getAllowedTools(s.frontmatter) })));
  const text = withheld.length === 0 ? built.text : built.text + withheldCountLine(withheld);
  return recordInjectionInjected('skill_list', text);
}

/**
 * 按 name 查找单个 skill。
 */
export function findSkill(skills: Skill[], name: string): Skill | undefined {
  return skills.find((s) => s.name === name);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
