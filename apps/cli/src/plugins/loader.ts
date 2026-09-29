// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins 加载器 — 扫描指定目录下的 plugin.json / plugin.config.json。
 *
 * 简化策略(做减法):
 *   - 只支持 JSON 清单(不动态 import .js/.ts,避免 ESM/CJS 互操作复杂度)
 *   - 扫描目录下每个子目录(默认非递归)的 plugin.json 或 plugin.config.json
 *   - 也支持顶层 plugin.json(目录本身就是一个插件)
 *   - 解析失败 / 缺 name / 缺 version 的清单跳过,**各留一条带稳定判别码的诊断**(G-683:
 *     原先 `catch { return null }` 有隔离但零诊断,用户只看到"插件没生效"而账面无线索)
 *   - 同名多份:**两个都不装载**,各点名一条诊断(G-684)——装载顺序不是任何人声明过的意图
 *   - 单点失败一律 `continue`,装载永不抛穿
 *
 * 需要知道"哪些清单被跳过了、为什么"请调 loadPluginsWithDiagnostics();
 * loadPlugins() 保留返回 PluginDefinition[] 的既有契约(agent.ts 等既有调用方零改动)。
 *
 * 目录结构示例:
 *   plugins/
 *     my-plugin/
 *       plugin.json
 *     another/
 *       plugin.config.json
 *     top-level-plugin.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  LoadPluginsOptions,
  PluginDefinition,
  PluginDiagnostic,
  PluginDiagnosticCode,
  PluginDiagnosticSeverity,
  PluginLoadResult,
  PluginManifest,
} from './types.js';

/** 候选清单文件名(按优先级排序,前者在位时后者被忽略并留一条 warning 诊断) */
const MANIFEST_FILES = ['plugin.json', 'plugin.config.json'];

/**
 * 判别码 → 严重级的唯一映射。
 * 集中在装载器这一侧而不是每个产出点各挑一档:两处算同一件事必漂移(本仓记过多次)。
 * `Record<PluginDiagnosticCode, …>` 要求键穷尽联合 —— 新增码忘了定档,编译期就红。
 */
const DIAGNOSTIC_SEVERITY: Record<PluginDiagnosticCode, PluginDiagnosticSeverity> = {
  'manifest-unreadable': 'error',
  'manifest-json-invalid': 'error',
  'manifest-not-object': 'error',
  'manifest-name-missing': 'error',
  'manifest-version-missing': 'error',
  'manifest-shadowed-by-priority': 'warning',
  'plugin_ambiguous_name': 'error',
  'manifest-unexpected-error': 'error',
  'plugin-dependency-cycle': 'error',
};

/** 错误文本(unknown 收窄,零 any) */
function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 造一条诊断:severity 由码唯一决定,产出点不得自行挑档 */
function diagnostic(
  code: PluginDiagnosticCode,
  file: string,
  message: string,
  extra?: { pluginName?: string; relatedFiles?: string[] },
): PluginDiagnostic {
  const entry: PluginDiagnostic = { code, severity: DIAGNOSTIC_SEVERITY[code], file, message };
  if (extra?.pluginName !== undefined) entry.pluginName = extra.pluginName;
  if (extra?.relatedFiles && extra.relatedFiles.length > 0) entry.relatedFiles = extra.relatedFiles;
  return entry;
}

/** 兜底诊断:未预期的抛点也编码成数据,绝不让单点失败抛穿整次装载 */
function unexpectedDiagnostic(file: string, err: unknown): PluginDiagnostic {
  return diagnostic(
    'manifest-unexpected-error',
    file,
    `Unexpected error while scanning "${path.basename(file)}": ${errorText(err)}`,
  );
}

/** 校验解析后的对象是否符合 PluginManifest 最小约束(name + version 必填) */
function isValidManifest(obj: unknown): obj is PluginManifest {
  if (!obj || typeof obj !== 'object') return false;
  const m = obj as Record<string, unknown>;
  return typeof m.name === 'string' && m.name.length > 0 && typeof m.version === 'string' && m.version.length > 0;
}

/** 规范化清单 — 仅保留 schema 内字段,数组字段缺失时初始化为 undefined */
function normalizeManifest(raw: PluginManifest, source: string): PluginDefinition {
  const def: PluginDefinition = {
    name: raw.name,
    version: raw.version,
    source,
  };
  if (raw.description !== undefined) def.description = raw.description;
  if (raw.author !== undefined) def.author = raw.author;
  if (Array.isArray(raw.tools)) def.tools = raw.tools.filter((t) => typeof t === 'string');
  if (Array.isArray(raw.hooks)) def.hooks = raw.hooks.filter((h) => typeof h === 'string');
  if (Array.isArray(raw.commands)) def.commands = raw.commands.filter((c) => typeof c === 'string');
  return def;
}

/** 单个清单的解析结果:manifest 为 null 表示该清单被跳过,diagnostics 是它留下的诊断 */
interface ManifestParseOutcome {
  manifest: PluginManifest | null;
  diagnostics: PluginDiagnostic[];
}

/**
 * 解析单个清单文件 —— G-683 的核心:把失败编码成数据,不是异常,也不是 null。
 * 每份被跳过的清单**恰好**留一条诊断(首个不成立的条件即返回,不再叠加)。
 */
function parseManifestFile(file: string): ManifestParseOutcome {
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    return { manifest: null, diagnostics: [diagnostic('manifest-unreadable', file, `Cannot read manifest file: ${errorText(err)}`)] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return { manifest: null, diagnostics: [diagnostic('manifest-json-invalid', file, `Manifest is not valid JSON: ${errorText(err)}`)] };
  }

  // 数组/字符串/数字/null 都能 JSON.parse 成功,但都不是清单 —— 旧实现会把它们报成"缺 name",
  // 那是把"形态就不对"和"字段没填"混成一码,排查方向会被指错(同名歧义的教训是同一条)。
  if (Array.isArray(parsed) || !parsed || typeof parsed !== 'object') {
    return { manifest: null, diagnostics: [diagnostic('manifest-not-object', file, 'Manifest JSON must decode to a plain object')] };
  }

  const obj = parsed as Record<string, unknown>;
  if (!isValidManifest(obj)) {
    const code: PluginDiagnosticCode =
      typeof obj.name !== 'string' || obj.name.length === 0 ? 'manifest-name-missing' : 'manifest-version-missing';
    const field = code === 'manifest-name-missing' ? 'name' : 'version';
    return { manifest: null, diagnostics: [diagnostic(code, file, `Manifest is missing the required field "${field}"`)] };
  }

  return { manifest: obj, diagnostics: [] };
}

/** 目录内清单查找结果:primary = 实际装载的那份;diagnostics = 被优先级压掉的那份留下的 warning */
interface ManifestLookup {
  primary: string | null;
  diagnostics: PluginDiagnostic[];
}

/**
 * 在目录中查找清单文件(优先 plugin.json,其次 plugin.config.json)。
 * 高优先级文件在位时,另一份不是"不存在"而是"被忽略" —— 留一条 warning,静默会让
 * 用户以为自己写的那份生效了(与 G-683 同型:被跳过的内容必须报名)。
 */
function findManifestInDir(dir: string): ManifestLookup {
  const present: string[] = [];
  for (const name of MANIFEST_FILES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) present.push(candidate);
  }
  const primary = present[0] ?? null;
  const diagnostics: PluginDiagnostic[] = [];
  if (primary) {
    for (const shadowed of present.slice(1)) {
      diagnostics.push(
        diagnostic(
          'manifest-shadowed-by-priority',
          shadowed,
          `Ignored because "${path.basename(primary)}" in the same directory has higher priority`,
        ),
      );
    }
  }
  return { primary, diagnostics };
}

/** 已通过最小校验、等待歧义裁决的候选(保留 file 与 definition,歧义时要点名路径) */
interface ManifestCandidate {
  name: string;
  file: string;
  definition: PluginDefinition;
}

/**
 * 扫描 pluginsDir,返回已装载插件 + 每一条被跳过清单的诊断。
 *
 * 扫描规则:
 *   - pluginsDir 不存在 / 不是目录 → 返回空集合(不存在是常态,不记诊断)
 *   - pluginsDir 本身含 plugin.json/plugin.config.json → 视为顶层单插件,不再扫子目录
 *   - 否则扫描 pluginsDir 的每个子目录,各子目录内查找清单文件
 *   - recursive=true 时递归扫描没有清单的子目录
 *   - 任一清单解析失败/校验失败 → 跳过并留诊断,不抛异常
 *   - 同名多份 → 全部不装载,各点名一条诊断(G-684)
 */
export function loadPluginsWithDiagnostics(opts: LoadPluginsOptions): PluginLoadResult {
  const plugins: PluginDefinition[] = [];
  const diagnostics: PluginDiagnostic[] = [];
  /** name → 声明它的候选(长度 >1 即为歧义) */
  const candidates = new Map<string, ManifestCandidate[]>();

  const dir = path.resolve(opts.pluginsDir);

  let isDirectory = false;
  try {
    isDirectory = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch (err) {
    diagnostics.push(unexpectedDiagnostic(dir, err));
  }
  if (!isDirectory) return { plugins, diagnostics };

  /** 收下一份清单:坏清单只留诊断(恰好一条)并继续,好清单进候选等待歧义裁决 */
  function acceptManifest(file: string): void {
    try {
      const outcome = parseManifestFile(file);
      diagnostics.push(...outcome.diagnostics);
      if (!outcome.manifest) return;
      const definition = normalizeManifest(outcome.manifest, file);
      const bucket = candidates.get(definition.name);
      if (bucket) bucket.push({ name: definition.name, file, definition });
      else candidates.set(definition.name, [{ name: definition.name, file, definition }]);
    } catch (err) {
      diagnostics.push(unexpectedDiagnostic(file, err));
    }
  }

  function scanDir(current: string, depth: number): void {
    if (!opts.recursive && depth > 1) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      diagnostics.push(unexpectedDiagnostic(current, err));
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = path.join(current, entry.name);
      try {
        const lookup = findManifestInDir(subDir);
        diagnostics.push(...lookup.diagnostics);
        if (lookup.primary) acceptManifest(lookup.primary);
        else if (opts.recursive) scanDir(subDir, depth + 1);
      } catch (err) {
        // 单点失败 continue:一个坏目录不得让整次装载抛穿
        diagnostics.push(unexpectedDiagnostic(subDir, err));
      }
    }
  }

  /**
   * G-684/G-658:同名多份 ⇒ **两个都不装载**,各留一条点名双方路径的 plugin_ambiguous_name 诊断。
   *
   * 原实现是 `results.set(manifest.name, …)`(后写覆盖前写):谁的凭据/工具生效由
   * 目录枚举顺序决定,而"扫描顺序"不是任何人声明过的意图 —— 歧义被静默裁决等于掷骰子,
   * 所以宁可不玩。宁可一个都不装、把两份路径都喊出来,也不要"碰巧赢的那份"。
   * 刻意不比较正文是否等价:一旦开始比"这两份算不算同一回事",就又要回答"那到底听谁的",
   * 回到同一个洞。
   */
  function adjudicate(): void {
    for (const [name, list] of candidates) {
      if (list.length === 1) {
        const only = list[0];
        if (only) plugins.push(only.definition);
        continue;
      }
      for (const candidate of list) {
        const relatedFiles = list.filter((other) => other.file !== candidate.file).map((other) => other.file);
        diagnostics.push(
          diagnostic(
            'plugin_ambiguous_name',
            candidate.file,
            `Plugin name "${name}" is declared by ${list.length} manifests, so none of them is loaded (scan order is not an intent)`,
            { pluginName: name, relatedFiles },
          ),
        );
      }
    }
  }

  const topLevel = findManifestInDir(dir);
  diagnostics.push(...topLevel.diagnostics);
  if (topLevel.primary) acceptManifest(topLevel.primary);
  else scanDir(dir, 1);

  adjudicate();
  return { plugins, diagnostics };
}

/**
 * 兼容出口 — 只返回成功装载的插件数组(既有调用方与既有测试钉的就是这个形态)。
 * 想知道"某份清单为什么没生效"请改调 loadPluginsWithDiagnostics()。
 */
export function loadPlugins(opts: LoadPluginsOptions): PluginDefinition[] {
  return loadPluginsWithDiagnostics(opts).plugins;
}

/** 校验单个清单对象(导出供测试与 registry 内部复用) */
export function validateManifest(obj: unknown): obj is PluginManifest {
  return isValidManifest(obj);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
