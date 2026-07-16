/* eslint-disable no-console */
/**
 * 真实 LLM 联调验证 — 验证 stepfun/agnes plan 套餐 key 在 CLI 场景下连通
 * 真实 key 严禁硬编码,从 .env 读取
 *   1. API key 有效(非 401)
 *   2. step-3.7-flash 模型可用
 *   3. Chat completions 返回正常
 *
 * 验证后自动清理敏感数据,只在 stdout 打印脱敏后的统计。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd(), '..', '..');
const envPath = resolve(repoRoot, '.env');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const provider = env.STEPFUN_API_KEY ? 'stepfun' : env.AGNES_API_KEY ? 'agnes' : null;
if (!provider) {
  console.error('✗ .env 未配置 STEPFUN_API_KEY 或 AGNES_API_KEY');
  process.exit(1);
}

const apiKey = provider === 'stepfun' ? env.STEPFUN_API_KEY : env.AGNES_API_KEY;
const apiBase =
  provider === 'stepfun' ? env.STEPFUN_API_BASE ?? 'https://api.stepfun.com/step_plan/v1' : env.AGNES_API_BASE;
const rawModel = env.LITELLM_MODEL ?? 'stepfun/step-3.7-flash';
const model = rawModel.replace(/^(stepfun|agnes)\//, '');

const maskKey = (k) => (k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '***');

console.log('--- 真实 LLM 联调验证 ---');
console.log('1. Provider:', provider);
console.log('2. API base:', apiBase);
console.log('3. Model:', model);
console.log('4. API key:', maskKey(apiKey));

const body = {
  model,
  messages: [
    { role: 'system', content: '你是一个简洁的助手,用中文一句话回答。' },
    { role: 'user', content: '用一句话介绍 TypeScript。' },
  ],
  max_tokens: 200,
  temperature: 0.3,
};

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);

const start = Date.now();
let resp;
try {
  resp = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
} catch (err) {
  clearTimeout(timer);
  console.error('✗ 网络请求失败:', err.message);
  process.exit(1);
}
clearTimeout(timer);

const elapsed = Date.now() - start;
console.log(`5. HTTP ${resp.status} (${elapsed}ms)`);

if (resp.status === 401) {
  console.error('✗ API key 无效 (401 Unauthorized)');
  process.exit(1);
}
if (resp.status === 403) {
  console.error('✗ API key 权限不足 (403 Forbidden)');
  process.exit(1);
}
if (!resp.ok) {
  const text = await resp.text();
  console.error(`✗ HTTP ${resp.status}:`, text.slice(0, 300));
  process.exit(1);
}

const data = await resp.json();
const text = data.choices?.[0]?.message?.content ?? '';
const usage = data.usage ?? {};

console.log('6. 回复:', text.slice(0, 200));
console.log('7. Token 用量:', JSON.stringify(usage));

if (!text) {
  console.error('✗ 模型返回内容为空');
  process.exit(1);
}

if (!usage.total_tokens) {
  console.error('✗ Token 用量为 0,可能响应异常');
  process.exit(1);
}

console.log('\n✅ 真实 LLM 联调验证通过');
console.log(`   ✓ ${provider} ${model} 模型可用`);
console.log(`   ✓ API key 有效(非 401/403)`);
console.log(`   ✓ Chat completions 返回正常 (${elapsed}ms)`);
console.log(`   ✓ Token 用量记录完整 (${usage.total_tokens} tokens)`);
