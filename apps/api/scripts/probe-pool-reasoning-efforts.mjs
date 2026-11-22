// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池模型「推理强度」实测器(2026-11-21 立)。
 *
 * 为什么需要:号池模型(如 WorkBuddy 的 hy4std)是各平台私有别名,上游不公布档位枚举,
 * 只能实际发请求逐档核对:能跑通 = 这一档被接受;明确报错 = 该档不接受;超时/无渠道
 * = 未判定。结果按「provider + model」记住,下一次不再重测。
 *
 * 用法:
 *   node apps/api/scripts/probe-pool-reasoning-efforts.mjs --only=workbuddy
 *   node apps/api/scripts/probe-pool-reasoning-efforts.mjs --models=workbuddy/hy4std,workbuddy/hy4flash
 *   node apps/api/scripts/probe-pool-reasoning-efforts.mjs --all --concurrency=2
 *   选项:--reprobe 忽略已有结果;--dry 只打印候选;--base http://127.0.0.1:8802
 *
 * 输出:`.ihui-agent/state/pool-reasoning-efforts.json`(键 = "<provider>/<model>")。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TIERS = ['minimal', 'low', 'medium', 'high', 'max'];
const OUT = '.ihui-agent/state/pool-reasoning-efforts.json';

function arg(name, fallback = undefined) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  return eq > -1 ? hit.slice(eq + 1) : true;
}

const base = arg('base', process.env.IHUI_API_BASE || 'http://127.0.0.1:8802');
const dry = !!arg('dry', false);
const reprobe = !!arg('reprobe', false);
const only = arg('only');
const modelsArg = arg('models');
const all = !!arg('all', false);
const concurrency = Number(arg('concurrency', 2)) || 1;

function loadStore() {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    return { version: 1, models: {} };
  }
}

function saveStore(store) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

async function login() {
  const password = readFileSync('D:/DevEnv/secrets/admin-password.txt', 'utf8').trim();
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account: 'admin', password, turnstileToken: 'none' }),
  });
  const json = await res.json();
  const token = json?.data?.accessToken ?? json?.data?.token;
  if (!token) throw new Error(`登录失败:${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  return token;
}

async function listModels(token) {
  const res = await fetch(`${base}/api/account-pool/models?refresh=true`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json?.data?.list ?? [];
}

/** 单档实测:发一条 1 token 的最小对话,按帧结论判接受/拒绝/未判定。 */
function probeOne(ws, model, effort, timeoutMs) {
  return new Promise((resolve) => {
    const id = `probe-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const finish = (verdict, detail) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ effort, verdict, ...detail });
    };
    const timer = setTimeout(() => {
      try {
        ws.send(JSON.stringify({ type: 'cancel', id }));
      } catch {
        /* 已断 */
      }
      finish('timeout', { message: `单档 ${effort} 超过 ${timeoutMs}ms 无收束` });
    }, timeoutMs);

    const onMessage = (ev) => {
      const text = typeof ev.data === 'string' ? ev.data : '';
      if (!text) return;
      let frame;
      try {
        frame = JSON.parse(text);
      } catch {
        return;
      }
      if (frame.type === 'ready') return;
      if (frame.id !== id) return;
      if (frame.type === 'start') return;
      if (frame.type === 'chunk') return;
      if (frame.type === 'done') {
        ws.removeEventListener('message', onMessage);
        finish('accepted', { status: 200 });
        return;
      }
      if (frame.type === 'error') {
        ws.removeEventListener('message', onMessage);
        const msg = String(frame.message ?? '');
        const status = typeof frame.status === 'number' ? frame.status : undefined;
        const explicit =
          (status !== undefined && status >= 400) ||
          /reasoning|effort|invalid|不支持|参数|档位/i.test(msg);
        finish(explicit ? 'rejected' : 'error', { status, message: msg.slice(0, 300) });
      }
    };
    ws.addEventListener('message', onMessage);
    try {
      ws.send(
        JSON.stringify({
          type: 'chat',
          id,
          model,
          messages: [{ role: 'user', content: 'ping' }],
          stream: true,
          max_tokens: 1,
          reasoning_effort: effort,
        }),
      );
    } catch (err) {
      finish('error', { message: `发送失败:${String(err)}` });
    }
  });
}

function openSocket(token) {
  const url = `${base.replace(/^http/, 'ws')}/ws/relay/chat?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS 握手超时')), 15_000);
    ws.addEventListener('message', function onReady(ev) {
      const text = typeof ev.data === 'string' ? ev.data : '';
      let frame;
      try {
        frame = JSON.parse(text);
      } catch {
        return;
      }
      if (frame.type === 'ready') {
        clearTimeout(timer);
        ws.removeEventListener('message', onReady);
        resolve();
      }
    });
    ws.addEventListener('error', () => reject(new Error('WS 连接失败')));
  });
  return { ws, ready };
}

async function probeModel(token, id, store) {
  const cacheKey = id;
  if (!reprobe && store.models[cacheKey]?.efforts) {
    return { cached: true, id };
  }
  const { ws, ready } = openSocket(token);
  await ready;
  const samples = [];
  for (const effort of TIERS) {
    const r = await probeOne(ws, id, effort, 120_000);
    samples.push(r);
    // 明确拒绝时不早停:某些平台只拒高/低两端,继续测其余档
  }
  try {
    ws.close();
  } catch {
    /* 已断 */
  }
  const accepted = samples.filter((s) => s.verdict === 'accepted').map((s) => s.effort);
  const rejected = samples.filter((s) => s.verdict === 'rejected').map((s) => s.effort);
  const unknown = samples.filter((s) => s.verdict === 'timeout' || s.verdict === 'error');
  store.models[cacheKey] = {
    model: id,
    efforts: accepted,
    rejected,
    unknown: unknown.map((s) => ({ effort: s.effort, status: s.status, message: s.message })),
    source: 'probed:/ws/relay/chat',
    probedAt: new Date().toISOString(),
  };
  saveStore(store);
  return { cached: false, id, accepted, rejected, unknown: unknown.length };
}

async function main() {
  const store = loadStore();
  if (dry) {
    const token = await login();
    const list = await listModels(token);
    const pick = modelsArg
      ? modelsArg.split(',').map((s) => s.trim()).filter(Boolean)
      : only
        ? list.filter((m) => (m.provider ?? '') === only).map((m) => m.id)
        : all
          ? list.map((m) => m.id)
          : [];
    console.log(`候选 ${pick.length} 个:\n${pick.join('\n')}`);
    return;
  }
  const token = await login();
  const list = await listModels(token);
  let targets;
  if (modelsArg) {
    targets = modelsArg.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (only) {
    targets = list.filter((m) => (m.provider ?? '') === only).map((m) => m.id);
  } else if (all) {
    targets = list.map((m) => m.id);
  } else {
    targets = list.filter((m) => (m.provider ?? '') === 'workbuddy').map((m) => m.id);
  }
  if (targets.length === 0) {
    console.log('没有候选模型');
    return;
  }
  console.log(`开始逐档实测 ${targets.length} 个模型 × ${TIERS.length} 档`);
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
    while (cursor < targets.length) {
      const id = targets[cursor++];
      try {
        const r = await probeModel(token, id, store);
        results.push(r);
        console.log(r.cached ? `= ${id}(已有结果,跳过)` : `✓ ${id} → ${JSON.stringify(r.accepted)}${r.unknown ? ` 未判定 ${r.unknown}` : ''}`);
      } catch (err) {
        console.log(`✗ ${id} 失败:${String(err)}`);
        results.push({ id, error: String(err) });
      }
    }
  });
  await Promise.all(workers);
  console.log(`完成 ${results.length} 个,结果写入 ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
