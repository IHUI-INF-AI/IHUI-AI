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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

  const json = JSON.stringify(providers, null, 2);
  return { providers, json, stats };
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

示例:
  # 预览 .env.example 的迁移结果
  node scripts/migrate-llm-providers.mjs --dry-run --input .env.example

  # 迁移 .env → .env.migrated(纯 JSON 格式)
  node scripts/migrate-llm-providers.mjs --input .env --output .env.migrated

  # 迁移 .env → .env.migrated(完整 .env 格式,追加 LLM_PROVIDERS=...)
  node scripts/migrate-llm-providers.mjs --input .env --output .env.migrated --apply
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
  console.log('\n--- 📋 预览(JSON 格式)---');
  console.log(json);
  console.log(`\n--- 📍 写入目标: ${output} (${apply ? '完整 .env 格式' : '纯 JSON'}) ---`);
  console.log('✅ dry-run 模式,不写任何文件');
  process.exit(0);
}

if (apply) {
  const content = envContent + `\n\n# ========== 2026-07-26 阶段 2 迁移产物 ==========\n# 由 scripts/migrate-llm-providers.mjs 生成\n# 优先于扁平字段(向后兼容,阶段 3 才删扁平字段)\nLLM_PROVIDERS='${json}'\n`;
  writeFileSync(output, content);
  console.log(`✅ 已写入完整 .env(含 LLM_PROVIDERS=...) → ${output}`);
} else {
  writeFileSync(output, json);
  console.log(`✅ 已写入纯 JSON → ${output}`);
  console.log('   提示:加 --apply 参数会生成完整 .env 格式(追加 LLM_PROVIDERS=... 一行)');
}
