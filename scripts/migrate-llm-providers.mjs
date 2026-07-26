#!/usr/bin/env node
/**
 * LLM provider .env 迁移脚本(2026-07-26 阶段 2)
 *
 * 把扁平字段格式(OPENAI_API_KEY=... / OPENAI_API_BASE=...)
 * 转换为 JSON 格式(LLM_PROVIDERS='{...}').
 *
 * 用法:
 *   node scripts/migrate-llm-providers.mjs --input .env --output .env.migrated
 *   node scripts/migrate-llm-providers.mjs --input .env --output .env.migrated --apply
 *   node scripts/migrate-llm-providers.mjs --dry-run --input .env.example
 *   node scripts/migrate-llm-providers.mjs --help
 *
 * 必读:阶段 2 仍保留 24+7 扁平字段向后兼容(阶段 3 才删),本脚本生成 JSON 后
 * 可与扁平字段共存,Settings.get_provider_config 优先读 JSON.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

// Provider 字段名映射:从 config.py 扁平字段同步(单一 source of truth)
// 格式: { canonical_name: [字段前缀列表] }
// 每个 alias 对应一个扁平字段前缀,env var 格式为 ${PREFIX}_API_KEY / ${PREFIX}_API_BASE
// (特殊: cloudflare/github 用 ${PREFIX}_TOKEN 而非 _API_KEY)
const PROVIDER_ALIASES = {
  // 主流量 provider
  openai: ['openai'],
  anthropic: ['anthropic'],
  google: ['gemini'],  // gemini_api_key
  groq: ['groq'],
  openrouter: ['openrouter'],
  cohere: ['cohere'],
  mistral: ['mistral'],
  huggingface: ['huggingface'],
  // 用户 plan 套餐
  agnes: ['agnes'],
  stepfun: ['stepfun'],
  // 免费/试用 provider
  cloudflare: ['cloudflare'],  // token
  nvidia: ['nvidia'],
  github: ['github'],  // token
  vercel: ['vercel_ai_gateway'],
  opencode: ['opencode_zen'],
  modal: ['modal'],
  inference_net: ['inference_net'],
  nlp_cloud: ['nlp_cloud'],
  scaleway: ['scaleway'],
  alibaba_intl: ['alibaba_intl'],
  cerebras: ['cerebras'],
  zai: ['zai'],
  kilo: ['kilo'],  // 仅 api_base
  pollinations: ['pollinations'],  // 仅 api_base
  llm7: ['llm7'],
  ovh: ['ovh'],  // 仅 api_base
  aihorde: ['aihorde'],
  reka: ['reka'],
  routeway: ['routeway'],
  bazaarlink: ['bazaarlink'],
  ainative: ['ainative'],
};

/**
 * 解析 .env 文件为 key→value 字典(简化版,不支持引号转义 + 多行值)
 * 真实生产应使用 dotenv 等成熟库,本脚本仅供一次性迁移使用
 */
function parseEnv(content) {
  const env = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) {
      let value = m[2];
      // 去除单/双引号包裹
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[m[1]] = value;
    }
  }
  return env;
}

/**
 * 把扁平 env 字典转换为 LLM_PROVIDERS JSON 格式
 * 返回 { providers: { [name]: { api_key, api_base } }, json: 'string', stats }
 */
function migrate(env) {
  const providers = {};
  const stats = { matched: 0, skipped: 0 };

  for (const [canonical, aliases] of Object.entries(PROVIDER_ALIASES)) {
    if (providers[canonical]) continue;  // 防止 Object 重复 key 边界情况

    for (const alias of aliases) {
      // 三种可能的字段名约定
      const keyField = `${alias.toUpperCase()}_API_KEY`;
      const baseField = `${alias.toUpperCase()}_API_BASE`;
      const tokenField = `${alias.toUpperCase()}_TOKEN`;  // cloudflare/github 用 token

      const apiKey = env[keyField] || env[tokenField] || '';
      const apiBase = env[baseField] || null;

      // 必须有 api_key 或 api_base 才算该 provider 已配置
      if (apiKey || apiBase) {
        providers[canonical] = {
          api_key: apiKey,
          api_base: apiBase,
        };
        stats.matched++;
        break;  // 找到第一个有值的 alias 后跳出
      }
    }
  }

  // 单行 JSON:写入 .env 文件时用(多行 JSON 会被守门脚本/部分 dotenv 解析器按行 split 失败)
  const json = JSON.stringify(providers);
  return { providers, json, stats };
}

/**
 * 格式化时间戳为 YYYYMMDD_HHMMSS
 */
function formatTimestamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * 备份 input 文件到 <input>.bak.<YYYYMMDD_HHMMSS>(已存在则追加毫秒后缀)
 * 返回备份文件路径
 */
function backupEnv(inputPath) {
  const ts = formatTimestamp(new Date());
  let backupPath = `${inputPath}.bak.${ts}`;
  if (existsSync(backupPath)) {
    const ms = String(Date.now() % 1000).padStart(3, '0');
    backupPath = `${inputPath}.bak.${ts}.${ms}`;
  }
  copyFileSync(inputPath, backupPath);
  return backupPath;
}

/**
 * 脱敏单个 api_key 值
 * - 空字符串 → "(empty)"
 * - 长度 ≤ 8 → "***"
 * - 长度 > 8 → 前 4 + *** + 后 4
 */
function redactApiKey(key) {
  if (!key) return '(empty)';
  if (key.length <= 8) return '***';
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

/**
 * 返回 providers 的脱敏副本(只 redact api_key,api_base 保持原样)
 */
function redactProviders(providers) {
  const out = {};
  for (const [name, cfg] of Object.entries(providers)) {
    out[name] = {
      api_key: redactApiKey(cfg.api_key),
      api_base: cfg.api_base,
    };
  }
  return out;
}

/**
 * 从 .env 内容中删除已迁移的 LLM 扁平字段
 * 删除规则:遍历 PROVIDER_ALIASES 所有 alias,生成 ${PREFIX}_API_KEY / _API_BASE / _TOKEN
 * 保留:注释行、空行、非 LLM provider 字段
 * 返回 { strippedContent, removed: [被删除的原始行] }
 */
function stripFlatFields(content) {
  const flatFields = new Set();
  for (const aliases of Object.values(PROVIDER_ALIASES)) {
    for (const alias of aliases) {
      const prefix = alias.toUpperCase();
      flatFields.add(`${prefix}_API_KEY`);
      flatFields.add(`${prefix}_API_BASE`);
      flatFields.add(`${prefix}_TOKEN`);
    }
  }
  const lines = content.split('\n');
  const removed = [];
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      kept.push(line);
      continue;
    }
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (m && flatFields.has(m[1])) {
      removed.push(line);
    } else {
      kept.push(line);
    }
  }
  return { strippedContent: kept.join('\n'), removed };
}

// =============================================================================
// CLI
// =============================================================================

function printHelp() {
  console.log(`
LLM provider .env 迁移脚本(2026-07-26 阶段 2)

用法:
  node scripts/migrate-llm-providers.mjs --input <file> [--output <file>] [--apply] [--dry-run] [--help]

参数:
  --input <file>    输入 .env 文件路径(默认: .env)
  --output <file>   输出文件路径(默认: .env.migrated)
  --apply           写入完整 .env 格式(含 LLM_PROVIDERS=... 一行)
                    默认(无 --apply)只写入纯 JSON 到 --output
  --dry-run         只打印预览,不写任何文件
  --help, -h        显示本帮助
  --backup          自动备份原 .env 到 <input>.bak.<YYYYMMDD_HHMMSS>
                    (同目录,带时间戳;--dry-run 下不生效;文件已存在追加毫秒后缀)
  --strip-flat      删除已迁移的扁平字段(*_API_KEY/*_API_BASE/*_TOKEN)
                    (必须配合 --apply;--dry-run 下预览将删除的行列表)
  --redact          stdout 中脱敏 api_key(空→"(empty)" / ≤8→"***" / >8→前4***后4)
                    (只影响打印,写入文件仍是完整 api_key)

示例:
  # 预览 .env.example 的迁移结果
  node scripts/migrate-llm-providers.mjs --dry-run --input .env.example

  # 迁移 .env → .env.migrated(纯 JSON 格式)
  node scripts/migrate-llm-providers.mjs --input .env --output .env.migrated

  # 迁移 .env → .env.migrated(完整 .env 格式,追加 LLM_PROVIDERS=...)
  node scripts/migrate-llm-providers.mjs --input .env --output .env.migrated --apply

  # 预览 + 脱敏 api_key(推荐,防止终端日志泄露)
  node scripts/migrate-llm-providers.mjs --dry-run --redact --input .env.example

  # 完整迁移:备份 + 删除扁平字段 + 写入完整 .env
  node scripts/migrate-llm-providers.mjs --backup --strip-flat --apply --input .env --output .env.migrated
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const inputIdx = args.indexOf('--input');
const input = inputIdx >= 0 ? args[inputIdx + 1] : '.env';
const outputIdx = args.indexOf('--output');
const output = outputIdx >= 0 ? args[outputIdx + 1] : '.env.migrated';
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');
const backup = args.includes('--backup');
const stripFlat = args.includes('--strip-flat');
const redact = args.includes('--redact');

// --strip-flat 必须配合 --apply(不带 --apply 时不会写文件,strip-flat 无意义)
if (stripFlat && !apply) {
  console.error('❌ --strip-flat 必须配合 --apply 使用');
  process.exit(2);
}

if (!existsSync(input)) {
  console.error(`❌ 输入文件不存在: ${input}`);
  process.exit(1);
}

const envContent = readFileSync(input, 'utf8');
const env = parseEnv(envContent);
const { providers, json, stats } = migrate(env);

console.log(`📖 已解析 ${Object.keys(env).length} 个 env 变量`);
console.log(`🔍 匹配到 ${stats.matched} 个 LLM provider`);

if (Object.keys(providers).length === 0) {
  console.log('⚠️  未发现任何 LLM provider 配置(所有 *_API_KEY / *_API_BASE / *_TOKEN 都为空)');
}

if (dryRun) {
  console.log('\n--- 📋 预览(JSON 格式,写入文件为单行)---');
  if (redact) {
    console.log(JSON.stringify(redactProviders(providers), null, 2));
  } else {
    console.log(JSON.stringify(providers, null, 2));
    console.log('⚠️  api_key 未脱敏,建议加 --redact 参数防止终端日志泄露');
  }

  if (stripFlat) {
    const { removed } = stripFlatFields(envContent);
    console.log('\n--- 🗑  将删除以下扁平字段 ---');
    if (removed.length === 0) {
      console.log('(无匹配的扁平字段)');
    } else {
      removed.forEach((line) => console.log(`  ${line}`));
    }
  }

  if (backup) {
    console.log('\n--- 💾 备份预览(--dry-run 下不实际备份)---');
    console.log(`  将备份 ${input} → ${input}.bak.<timestamp>`);
  }

  console.log(`\n--- 📍 写入目标: ${output} (${apply ? '完整 .env 格式' : '纯 JSON'}) ---`);
  console.log('✅ dry-run 模式,不写任何文件');
  process.exit(0);
}

// --backup: 在写入 output 之前备份 input(--dry-run 已在上面 exit,这里一定非 dry-run)
if (backup) {
  const backupPath = backupEnv(input);
  console.log(`✅ 已备份原 .env → ${backupPath}`);
}

if (apply) {
  let baseContent = envContent;
  if (stripFlat) {
    const { strippedContent, removed } = stripFlatFields(baseContent);
    baseContent = strippedContent;
    console.log(`🗑  已删除 ${removed.length} 行扁平字段`);
  }
  const content = baseContent + `\n\n# ========== 2026-07-26 阶段 2 迁移产物 ==========\n# 由 scripts/migrate-llm-providers.mjs 生成\n# 优先于扁平字段(向后兼容,阶段 3 才删扁平字段)\nLLM_PROVIDERS='${json}'\n`;
  writeFileSync(output, content);
  console.log(`✅ 已写入完整 .env(含 LLM_PROVIDERS=...) → ${output}`);
} else {
  writeFileSync(output, json);
  console.log(`✅ 已写入纯 JSON → ${output}`);
  console.log('   提示:加 --apply 参数会生成完整 .env 格式(追加 LLM_PROVIDERS=... 一行)');
}
