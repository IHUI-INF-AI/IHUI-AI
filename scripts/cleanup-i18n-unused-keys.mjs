#!/usr/bin/env node
/**
 * i18n 无引用 key 批量清理脚本
 *
 * 输入: .trae-cn/tmp/i18n-deletion-list.txt (格式: base_file | key | namespace | value)
 * 作用: 对 web / miniapp-taro 两端各 5 个语言文件,同步删除 safe-to-delete key
 *      删除后清理空父对象,保持 2 空格缩进 + UTF-8 无 BOM + 末尾换行
 *
 * 用法:
 *   node scripts/cleanup-i18n-unused-keys.mjs            # 实际删除
 *   node scripts/cleanup-i18n-unused-keys.mjs --dry-run   # 预览不写
 *   node scripts/cleanup-i18n-unused-keys.mjs --list <path> # 自定义清单
 *
 * 幂等: 重复运行不报错,已删除的 key 会被静默跳过并计入 notFound 计数
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const LIST_IDX = ARGS.indexOf('--list');
const LIST_FILE = LIST_IDX >= 0 && ARGS[LIST_IDX + 1]
  ? path.resolve(ARGS[LIST_IDX + 1])
  : path.join(ROOT, '.trae-cn/tmp/i18n-deletion-list.txt');

const LANGS = ['zh-CN', 'zh-TW', 'ko', 'ja', 'en'];
const I18N_DIR = path.join(ROOT, 'packages/i18n/messages');

/**
 * 解析删除清单,返回按 target 分组的 key 集合
 * @returns {{ web: Set<string>, 'miniapp-taro': Set<string>, raw: Array }}
 */
function parseList(content) {
  const web = new Set();
  const miniapp = new Set();
  const raw = [];
  let skippedMalformed = 0;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split('|');
    if (parts.length < 4) { skippedMalformed++; continue; }

    const baseFile = parts[0].trim();
    const key = parts[1].trim();
    const namespace = parts[2].trim();
    const value = parts.slice(3).join('|').trim();

    if (!baseFile.endsWith('.json') || !key) { skippedMalformed++; continue; }

    let target;
    if (baseFile.includes('/messages/web/')) target = 'web';
    else if (baseFile.includes('/messages/miniapp-taro/')) target = 'miniapp-taro';
    else { skippedMalformed++; continue; }

    if (target === 'web') web.add(key);
    else miniapp.add(key);
    raw.push({ target, key, namespace, value });
  }

  return { web, miniapp, raw, skippedMalformed };
}

/**
 * 递归删除 obj 中 keyPath 指定的叶子 key
 * 删除后若父对象为空对象则一并清理
 * @returns {boolean} true=实际删除,false=key 不存在(幂等跳过)
 */
function deleteKeyPath(obj, keyPath) {
  const stack = [];
  let cur = obj;
  for (let i = 0; i < keyPath.length; i++) {
    const part = keyPath[i];
    if (!(part in cur)) return false;
    if (i === keyPath.length - 1) {
      delete cur[part];
      // 清理空父对象
      for (let j = stack.length - 1; j >= 0; j--) {
        const { parent, key } = stack[j];
        const child = parent[key];
        if (child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length === 0) {
          delete parent[key];
        } else {
          break;
        }
      }
      return true;
    }
    if (typeof cur[part] !== 'object' || cur[part] === null || Array.isArray(cur[part])) {
      // 路径中间段不是对象,无法继续
      return false;
    }
    stack.push({ parent: cur, key: part });
    cur = cur[part];
  }
  return false;
}

/**
 * 递归统计叶子 key 数(非对象/数组的值)
 */
function countLeafKeys(obj) {
  let count = 0;
  for (const k in obj) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      count += countLeafKeys(v);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * 递归删除 obj 中所有空对象 {}
 * @returns {number} 清理的空对象数
 */
function cleanupEmptyObjects(obj) {
  let removed = 0;
  for (const k in obj) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      removed += cleanupEmptyObjects(v);
      if (Object.keys(v).length === 0) {
        delete obj[k];
        removed++;
      }
    }
  }
  return removed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  // 2 空格缩进 + 末尾换行 + UTF-8 无 BOM
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// ============= 主流程 =============
console.log('=== i18n 无引用 key 批量清理 ===');
console.log(`模式: ${DRY_RUN ? 'DRY-RUN (预览不写)' : '实际删除'}`);
console.log(`清单: ${LIST_FILE}`);

if (!fs.existsSync(LIST_FILE)) {
  console.error(`❌ 清单文件不存在: ${LIST_FILE}`);
  process.exit(1);
}

const listContent = fs.readFileSync(LIST_FILE, 'utf8');
const { web: webKeys, miniapp: miniappKeys, raw, skippedMalformed } = parseList(listContent);

console.log(`解析清单: web=${webKeys.size} unique key, miniapp-taro=${miniappKeys.size} unique key, 总条目=${raw.length}, 跳过畸形=${skippedMalformed}`);

const targets = [
  { name: 'web', keys: webKeys },
  { name: 'miniapp-taro', keys: miniappKeys },
];

const stats = {};
let totalDeletedZhCN = 0;
let totalNotFoundZhCN = 0;

for (const target of targets) {
  const dir = path.join(I18N_DIR, target.name);
  stats[target.name] = {};

  for (const lang of LANGS) {
    const filePath = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      process.exit(1);
    }
    const obj = readJson(filePath);
    const before = countLeafKeys(obj);

    let deleted = 0;
    let notFound = 0;
    for (const key of target.keys) {
      const keyPath = key.split('.');
      if (deleteKeyPath(obj, keyPath)) {
        deleted++;
      } else {
        notFound++;
      }
    }

    // 清理可能残留的空对象(deleteKeyPath 已清理路径上的,这里兜底)
    cleanupEmptyObjects(obj);

    const after = countLeafKeys(obj);
    stats[target.name][lang] = { before, deleted, notFound, after };

    if (!DRY_RUN) {
      writeJson(filePath, obj);
    }

    if (lang === 'zh-CN') {
      totalDeletedZhCN += deleted;
      totalNotFoundZhCN += notFound;
    }
  }
}

// ============= 输出统计 =============
console.log('\n=== 删除统计 ===');
console.log('target          | lang  | before  | deleted | notFound | after   | delta');
console.log('----------------|-------|---------|---------|----------|---------|------');
for (const target of targets) {
  for (const lang of LANGS) {
    const s = stats[target.name][lang];
    const delta = s.before - s.after;
    console.log(
      `${target.name.padEnd(15)} | ${lang.padEnd(5)} | ${String(s.before).padStart(7)} | ${String(s.deleted).padStart(7)} | ${String(s.notFound).padStart(8)} | ${String(s.after).padStart(7)} | ${String(delta).padStart(5)}`
    );
  }
}

console.log(`\nzh-CN 基准删除总数: ${totalDeletedZhCN}`);
console.log(`zh-CN 未找到(notFound,幂等跳过)总数: ${totalNotFoundZhCN}`);

// ============= Parity 自检 =============
console.log('\n=== Parity 自检 (5 语言 deleted 应一致) ===');
let parityOk = true;
for (const target of targets) {
  const zhDeleted = stats[target.name]['zh-CN'].deleted;
  for (const lang of LANGS) {
    const d = stats[target.name][lang].deleted;
    if (d !== zhDeleted) {
      console.log(`❌ ${target.name}: zh-CN deleted=${zhDeleted}, ${lang} deleted=${d} (不一致!)`);
      parityOk = false;
    }
  }
}
if (parityOk) {
  console.log('✅ 5 语言 deleted 数一致, parity 维护 OK');
}

// ============= 预期对比 =============
console.log('\n=== 预期对比 ===');
const expected = { web: 14525, 'miniapp-taro': 511 };
for (const target of targets) {
  const zhDeleted = stats[target.name]['zh-CN'].deleted;
  const exp = expected[target.name];
  const uniqueKeys = target.keys.size;
  const matchUnique = zhDeleted === uniqueKeys;
  const matchExpected = zhDeleted === exp;
  console.log(`${target.name}: uniqueKeys=${uniqueKeys}, zh-CN deleted=${zhDeleted}, 预期=${exp}, unique 匹配=${matchUnique?'✅':'❌'}, 预期匹配=${matchExpected?'✅':'❌'}`);
}

if (DRY_RUN) {
  console.log('\n[Dry-run] 未写入任何文件');
} else {
  console.log('\n✅ 已写入 10 个 i18n 文件');
}
