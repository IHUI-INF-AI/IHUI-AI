#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-11 守门:冷恢复/resume 必须沿用 create 的权限与工具面(参数面三站同现)。
 *
 * 被审面:apps/ai-service/app/routers/agents.py(execute / execute_stream / resume
 * 三站共用的唯一构造入口 `_new_v2_loop`)。
 *
 * 判据(票面 b76-11 验收草案):
 * 1. 键表**现读推导**——先从 `_new_v2_loop` 的形参读出参数名单,不在本测试里抄第二份;
 *    权限类键(permission_mode / tools / max_iterations)必须真的在形参里,名单过期即红。
 * 2. 三站同现——execute / execute_stream / resume 三处调用 `_new_v2_loop` 的实参键
 *    集合里,权限类键必须三站同现;resume 站如若缺席,必须显式写
 *    `# resume-inherits: <持久化字段名>` 注明继承来源,否则红并点名 agents.py 行号。
 * 3. 正反成对——把 resume 站的 permission_mode 删掉(内存改写)必须转红并点名该行;
 *    与原面(绿)结果不同,证明判据真的在跑(同形 ⇒ 判据没跑)。
 *
 * 注:票面写"从 git show HEAD:... 解析";本实现读工作树同一文件 —— 本仓约定
 * "不 commit、不 push"(提交由主会话统一做),HEAD 上尚无本票改动,工作树文件
 * 就是即将成为 HEAD 的同一份字节,不是平行导出。
 *
 * 跑法:node --test scripts/tests/agent-resume-param-parity.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS_PY = path.join(REPO_ROOT, "apps", "ai-service", "app", "routers", "agents.py");

// 三站 → 宿主函数名(execute / execute_stream / resume 的封闭函数)
const SITE_HOSTS = {
  execute: "execute_agent",
  execute_stream: "execute_agent_stream",
  resume: "_resume_run_from_checkpoint",
};
// 权限类键(判据的主角;是否真的存在于形参表由现读推导校验)
const PERMISSION_KEYS = ["permission_mode", "tools", "max_iterations"];

/** 从源码里读 `_new_v2_loop` 的形参名单(现读推导,不抄第二份)。 */
function deriveFormalParams(source) {
  const defRe = /async\s+def\s+_new_v2_loop\s*\(/;
  const m = defRe.exec(source);
  if (!m) throw new Error("agents.py 里找不到 `async def _new_v2_loop(` —— 构造入口没了?");
  // 取签名段:从开括号到与之配平的闭括号
  let i = m.index + m[0].length - 1; // 指向 "("
  let depth = 0;
  let sig = "";
  for (; i < source.length; i++) {
    const ch = source[i];
    sig += ch;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  const params = [];
  for (const raw of sig.slice(1, -1).split(",")) {
    const seg = raw.trim();
    if (!seg || seg === "*") continue;
    const name = /^\*{0,2}([A-Za-z_]\w*)/.exec(seg);
    if (name && name[1] !== "self") params.push(name[1]);
  }
  return params;
}

/** 调用站行号 → 封闭函数链(沿缩进上溯;链首 = 最近闭包,链尾 = 顶层函数)。 */
function enclosingHostChain(lines, callLineIdx) {
  const indentOf = (s) => s.length - s.trimStart().length;
  const chain = [];
  let limit = indentOf(lines[callLineIdx]);
  for (let up = callLineIdx - 1; up >= 0; up--) {
    const m = /^(\s*)async\s+def\s+([A-Za-z_]\w*)\s*\(/.exec(lines[up]);
    if (!m) continue;
    const ind = m[1].length;
    if (ind < limit) {
      chain.push(m[2]);
      limit = ind;
      if (ind === 0) break; // 顶层函数:再往上就不是包含关系了
    }
  }
  return chain;
}

/** 找出所有 `_new_v2_loop(` 调用站:返回 [{host, line, keys, text}]。 */
function findCallSites(source) {
  const lines = source.split("\n");
  const hosts = new Set(Object.values(SITE_HOSTS));
  const sites = [];
  let lineStart = 0; // 本行在 source 里的绝对偏移(行内 indexOf 必须换算成 source 偏移)
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const nextStart = lineStart + line.length + 1;
    if (/_new_v2_loop\s*\(/.test(line) && !/async\s+def\s+_new_v2_loop/.test(line)) {
      // 封装端点:闭包链上第一个命中宿主名的(如 stream 站的调用住在
      // event_generator 闭包里,归属仍算 execute_agent_stream)。
      const chain = enclosingHostChain(lines, li);
      const host = chain.find((n) => hosts.has(n)) || chain[0] || null;
      // 实参键:配平括号内顶层 `\w+ =`(排除 ==)
      const local = line.indexOf("_new_v2_loop");
      let depth = 0;
      let call = "";
      for (let i = lineStart + local + "_new_v2_loop".length; i < source.length; i++) {
        const ch = source[i];
        call += ch;
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      const keys = [];
      const kwRe = /([A-Za-z_]\w*)\s*=(?!=)/g;
      let km;
      while ((km = kwRe.exec(call)) !== null) keys.push(km[1]);
      sites.push({ host, line: li + 1, keys, text: call });
    }
    lineStart = nextStart;
  }
  return sites;
}

/** 判据本体:返回 [] = 绿;非空 = 每条红的点名文案。 */
function judge(source) {
  const failures = [];
  const formal = deriveFormalParams(source);
  const sites = findCallSites(source);

  const byHost = new Map();
  for (const [site, host] of Object.entries(SITE_HOSTS)) {
    const hit = sites.filter((s) => s.host === host);
    if (hit.length !== 1) {
      failures.push(
        `agents.py: 站 ${site} 应恰好有 1 处 _new_v2_loop 调用(宿主 ${host}),现得 ${hit.length} 处 —— 结构漂移,判据失效`
      );
      continue;
    }
    byHost.set(site, hit[0]);
  }
  if (failures.length > 0) return failures;

  // 权限类键必须真的在形参表里(名单现读推导:形参没了 = 名单过期,不是放行理由)
  for (const key of PERMISSION_KEYS) {
    if (!formal.includes(key)) {
      failures.push(`agents.py: _new_v2_loop 形参表里已无 ${key} —— 权限类键名单过期,本判据需随签名同枚更新`);
    }
  }

  const resumeSite = byHost.get("resume");
  const hasInheritNote = /#\s*resume-inherits:\s*\S+/.test(source);
  for (const key of PERMISSION_KEYS) {
    if (!formal.includes(key)) continue;
    for (const [site, s] of byHost) {
      if (s.keys.includes(key)) continue;
      if (site === "resume" && hasInheritNote) continue; // 显式继承来源:允许缺席
      failures.push(
        `agents.py:${s.line} 站 ${site} 的 _new_v2_loop 调用缺权限类键 \`${key}\`` +
          (site === "resume"
            ? " —— resume 须沿用 create 的权限/工具面(或显式写 `# resume-inherits: <持久化字段名>`)"
            : "")
      );
    }
  }
  return failures;
}

/** 删掉 resume 站某个实参键所在行(内存改写,供反面用例)。 */
function removeResumeKey(source, key) {
  const sites = findCallSites(source);
  const site = sites.find((s) => s.host === SITE_HOSTS.resume && s.keys.includes(key));
  if (!site) return null;
  const lines = source.split("\n");
  // 从调用站行向下找含该键的行(调用是多行的)
  for (let li = site.line - 1; li < lines.length; li++) {
    const re = new RegExp(`^\\s*${key}\\s*=`);
    if (re.test(lines[li])) {
      const removedAtLine = li + 1;
      lines.splice(li, 1);
      return { mutated: lines.join("\n"), removedAtLine };
    }
    if (/\)\s*$/.test(lines[li]) && li > site.line - 1) break; // 调用结束还没见键
  }
  return null;
}

function readSource() {
  return readFileSync(AGENTS_PY, "utf8");
}

test("判据现读:_new_v2_loop 形参表可推导,权限类键在列", () => {
  const formal = deriveFormalParams(readSource());
  for (const key of PERMISSION_KEYS) {
    assert.ok(
      formal.includes(key),
      `_new_v2_loop 形参表缺 ${key}:现读得到 [${formal.join(", ")}]`
    );
  }
});

test("三站同现 ⇒ 绿(execute / execute_stream / resume 都带权限类键)", () => {
  const failures = judge(readSource());
  assert.deepEqual(
    failures,
    [],
    `参数面三站未同现:\n${failures.map((f) => `  - ${f}`).join("\n")}`
  );
});

test("反面:删掉 resume 站的 permission_mode ⇒ 必红并点名 agents.py 行号", () => {
  const source = readSource();
  const removed = removeResumeKey(source, "permission_mode");
  assert.ok(removed, "判据自身失效:在 resume 站找不到 permission_mode 实参行可删");
  const failures = judge(removed.mutated);
  assert.ok(failures.length > 0, "删掉 resume 站 permission_mode 后判据仍绿 ⇒ 判据没牙");
  assert.ok(
    failures.some((f) => f.includes("agents.py:") && f.includes("permission_mode") && f.includes("resume")),
    `红点必须点名 agents.py + permission_mode + resume,实际:${JSON.stringify(failures)}`
  );
});

test("正反不同形:原面绿、改面红 ⇒ 判据真的在跑", () => {
  const source = readSource();
  const green = judge(source);
  const removed = removeResumeKey(source, "permission_mode");
  assert.ok(removed, "反面夹具构造失败");
  const red = judge(removed.mutated);
  assert.deepEqual(green, [], "原面应当绿(否则先修产品面)");
  assert.ok(red.length > 0, "改面应当红;与原面同形 ⇒ 判据根本没跑");
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
