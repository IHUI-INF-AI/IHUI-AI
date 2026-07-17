/**
 * Plugins 加载器 — 扫描指定目录下的 plugin.json / plugin.config.json。
 *
 * 简化策略(做减法):
 *   - 只支持 JSON 清单(不动态 import .js/.ts,避免 ESM/CJS 互操作复杂度)
 *   - 扫描目录下每个子目录(默认非递归)的 plugin.json 或 plugin.config.json
 *   - 也支持顶层 plugin.json(目录本身就是一个插件)
 *   - 解析失败 / 缺 name / 缺 version 的清单跳过(返回有效插件数组,不抛异常)
 *   - 名称冲突时后扫到的覆盖前者(警告由集成方按 logger 决定)
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
import type { LoadPluginsOptions, PluginDefinition, PluginManifest } from './types.js';

/** 候选清单文件名(按优先级排序,前者覆盖后者) */
const MANIFEST_FILES = ['plugin.json', 'plugin.config.json'];

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

/** 解析单个清单文件,失败返回 null */
function parseManifestFile(file: string): PluginManifest | null {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(content);
    if (!isValidManifest(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 在目录中查找清单文件(优先 plugin.json,其次 plugin.config.json) */
function findManifestInDir(dir: string): string | null {
  for (const name of MANIFEST_FILES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * 扫描 pluginsDir 下所有 plugin 清单,返回 PluginDefinition[]。
 *
 * 扫描规则:
 *   - pluginsDir 不存在 → 返回 []
 *   - pluginsDir 本身含 plugin.json/plugin.config.json → 视为顶层单插件,返回 [它]
 *   - 否则扫描 pluginsDir 的每个子目录,各子目录内查找清单文件
 *   - recursive=true 时递归扫描子目录
 *   - 任一清单解析失败/校验失败 → 跳过,不抛异常
 *   - 同名插件后扫到的覆盖前者
 */
export function loadPlugins(opts: LoadPluginsOptions): PluginDefinition[] {
  const dir = path.resolve(opts.pluginsDir);
  if (!fs.existsSync(dir)) return [];

  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return [];

  const results = new Map<string, PluginDefinition>();

  const topLevel = findManifestInDir(dir);
  if (topLevel) {
    const manifest = parseManifestFile(topLevel);
    if (manifest) results.set(manifest.name, normalizeManifest(manifest, topLevel));
    return Array.from(results.values());
  }

  function scanDir(current: string, depth: number): void {
    if (!opts.recursive && depth > 1) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = path.join(current, entry.name);
      const manifestFile = findManifestInDir(subDir);
      if (manifestFile) {
        const manifest = parseManifestFile(manifestFile);
        if (manifest) results.set(manifest.name, normalizeManifest(manifest, manifestFile));
      } else if (opts.recursive) {
        scanDir(subDir, depth + 1);
      }
    }
  }

  scanDir(dir, 1);
  return Array.from(results.values());
}

/** 校验单个清单对象(导出供测试与 registry 内部复用) */
export function validateManifest(obj: unknown): obj is PluginManifest {
  return isValidManifest(obj);
}
