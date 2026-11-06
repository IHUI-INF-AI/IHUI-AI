// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins 清单解析层 — 单份 `plugin.json` / `plugin.config.json` 的读取、最小校验、规范化,
 * 以及「判别码 → 严重级」的唯一映射表与诊断构造器。
 *
 * 本文件是 goal-b49/W2 从 `loader.ts`(拆前 533 行,超 AGENTS §3 每页 <250 行)摘出的**第二层**:
 * 装载器只留"扫目录 + 同名歧义裁决 + 三个装载出口",清单级的手艺住这里。
 * 拆分工夫只在文件边界上发生,判据一条没动(G-683/G-684 的语义见各处原注)。
 *
 * 诊断构造集中在本层而不是每个产出点各挑一档:两处算同一件事必漂移(本仓记过多次)。
 * `DIAGNOSTIC_SEVERITY` 是 `Record<PluginDiagnosticCode, …>` 穷尽表 —— 新增码忘了定档,编译期即红。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  PluginDefinition,
  PluginDiagnostic,
  PluginDiagnosticCode,
  PluginDiagnosticSeverity,
  PluginManifest,
} from './types.js';

/** 候选清单文件名(按优先级排序,前者在位时后者被忽略并留一条 warning 诊断) */
export const MANIFEST_FILES = ['plugin.json', 'plugin.config.json'];

/**
 * 判别码 → 严重级的唯一映射。
 *
 * `error` = 有清单没被装载;`warning` = 装载了,但声明的内容被忽略/被本宿主拒收。
 * 两条 `plugin-contribution-*` 码(goal-b49/W2)属后者:插件照常装载,只是它声明的某一档
 * 在本 CLI 宿主没有落点(或压根不在词表内)—— 刻意不升 error,拒档不是装载失败。
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
  'plugin-contribution-declined': 'warning',
  'plugin-contribution-unknown-kind': 'warning',
  // goal-b49/W6:激活事件两档同为 warning —— 插件照常装载,拒的是"什么时候醒"这一维(§12e 不升档)。
  'plugin-activation-rejected': 'warning',
  'plugin-activation-unknown-event': 'warning',
  // goal-b49/Z1:声明被读到但没有运行期消费者 —— 装载仍是成功的,喊的是"这条声明现在不干活"(warning 同训)。
  'plugin-declaration-unconsumed': 'warning',
};

/** 错误文本(unknown 收窄,零 any) */
export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 造一条诊断:severity 由码唯一决定,产出点不得自行挑档 */
export function diagnostic(
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
export function unexpectedDiagnostic(file: string, err: unknown): PluginDiagnostic {
  return diagnostic(
    'manifest-unexpected-error',
    file,
    `Unexpected error while scanning "${path.basename(file)}": ${errorText(err)}`,
  );
}

/** 校验解析后的对象是否符合 PluginManifest 最小约束(name + version 必填) */
export function isValidManifest(obj: unknown): obj is PluginManifest {
  if (!obj || typeof obj !== 'object') return false;
  const m = obj as Record<string, unknown>;
  return typeof m.name === 'string' && m.name.length > 0 && typeof m.version === 'string' && m.version.length > 0;
}

/** 规范化清单 — 仅保留 schema 内字段,数组字段缺失时初始化为 undefined */
export function normalizeManifest(raw: PluginManifest, source: string): PluginDefinition {
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
  // G-682:dependencies 必须透传,否则 JSON 清单声明的依赖到不了 registry 的注册前闭包校验
  if (Array.isArray(raw.dependencies)) def.dependencies = raw.dependencies.filter((d) => typeof d === 'string');
  // goal-b49/X2:P2-4 两族声明同理必须透传。此前只透传 tools/hooks/commands/dependencies,
  // 清单里写的 turnInputContributors / commandContributors 在这里被静默丢掉 ⇒ registry 的
  // getTurnInputContributorExtensions()/getCommandContributorExtensions() 恒为空、两个 runner
  // 恒零 —— 「声明 → 注册表」在装载层就断了(与 G-682 同型:声明的功能到不了运行面)。
  if (Array.isArray(raw.turnInputContributors)) {
    def.turnInputContributors = raw.turnInputContributors.filter((c) => typeof c === 'string');
  }
  if (Array.isArray(raw.commandContributors)) {
    def.commandContributors = raw.commandContributors.filter((c) => typeof c === 'string');
  }
  return def;
}

/** 单个清单的解析结果:manifest 为 null 表示该清单被跳过,diagnostics 是它留下的诊断 */
export interface ManifestParseOutcome {
  manifest: PluginManifest | null;
  diagnostics: PluginDiagnostic[];
}

/**
 * 解析单个清单文件 —— G-683 的核心:把失败编码成数据,不是异常,也不是 null。
 * 每份被跳过的清单**恰好**留一条诊断(首个不成立的条件即返回,不再叠加)。
 */
export function parseManifestFile(file: string): ManifestParseOutcome {
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
export interface ManifestLookup {
  primary: string | null;
  diagnostics: PluginDiagnostic[];
}

/**
 * 在目录中查找清单文件(优先 plugin.json,其次 plugin.config.json)。
 * 高优先级文件在位时,另一份不是"不存在"而是"被忽略" —— 留一条 warning,静默会让
 * 用户以为自己写的那份生效了(与 G-683 同型:被跳过的内容必须报名)。
 * 在位用 stat 而不是 existsSync:ENOENT / ENOTDIR 才算这份没有并继续看下一份;
 * 其它错误不算进 present,也不改用下一份,primary 为 null 并留 manifest-unreadable。
 * 第二参显式传入 undefined 时由函数体内 ?? 补 fs.statSync,不靠参数默认值。
 */
export function findManifestInDir(dir: string, stat?: (path: string) => fs.Stats): ManifestLookup {
  const look = stat ?? ((target: string) => fs.statSync(target));
  const present: string[] = [];
  for (const name of MANIFEST_FILES) {
    const candidate = path.join(dir, name);
    try {
      look(candidate);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') continue;
      return {
        primary: null,
        diagnostics: [
          diagnostic(
            'manifest-unreadable',
            candidate,
            `清单读不到,不能改用下一份: ${errorText(err)}`,
          ),
        ],
      };
    }
    present.push(candidate);
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
