// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      i += 2;
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      out += c;
      i += 1;
      while (i < src.length && src[i] !== q) {
        out += src[i];
        if (src[i] === '\\') {
          i += 1;
          if (i < src.length) out += src[i];
        }
        i += 1;
      }
      if (i < src.length) {
        out += src[i];
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function readBalanced(code, openIdx, openCh, closeCh) {
  let depth = 0;
  for (let i = openIdx; i < code.length; i += 1) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i += 1;
      while (i < code.length && code[i] !== q) {
        if (code[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (c === openCh) depth += 1;
    else if (c === closeCh) {
      depth -= 1;
      if (depth === 0) return { end: i, inner: code.slice(openIdx + 1, i) };
    }
  }
  return null;
}

export function listFunctions(src) {
  const code = stripComments(src);
  const out = [];
  const decl = /\bfunction\s*([A-Za-z0-9_$]*)\s*\([^)]*\)\s*\{/g;
  let matched;
  while ((matched = decl.exec(code))) {
    const open = matched.index + matched[0].length - 1;
    const balanced = readBalanced(code, open, '{', '}');
    if (!balanced) break;
    out.push({ name: matched[1] || '', body: balanced.inner, start: matched.index });
    decl.lastIndex = balanced.end + 1;
  }
  const arrow = /\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*(\{)?/g;
  while ((matched = arrow.exec(code))) {
    const after = matched.index + matched[0].length;
    if (matched[2] === '{') {
      const balanced = readBalanced(code, after - 1, '{', '}');
      if (!balanced) break;
      out.push({ name: matched[1], body: balanced.inner, start: matched.index });
      arrow.lastIndex = balanced.end + 1;
    } else {
      let j = after;
      let body = '';
      while (j < code.length && code[j] !== '\n' && code[j] !== ';') {
        body += code[j];
        j += 1;
      }
      out.push({ name: matched[1], body, start: matched.index });
      arrow.lastIndex = j;
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out.map(({ name, body }) => ({ name, body }));
}

export function importClauseBinds(src, specifier, exportedName) {
  const code = stripComments(src);
  const re = /(^|\n)\s*import\s+([\s\S]*?)\s+from\s*(['"])([^'"]+)\3/g;
  const locals = [];
  let matched;
  while ((matched = re.exec(code))) {
    if (matched[4] !== specifier) continue;
    const brace = matched[2].match(/\{([^}]*)\}/);
    if (!brace) continue;
    for (const part of brace[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const alias = seg.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) {
        if (alias[1] === exportedName) locals.push(alias[2]);
      } else if (seg === exportedName) {
        locals.push(seg);
      }
    }
  }
  return locals;
}

function containsIdentifierAdd(body) {
  return /[A-Za-z_$][\w$]*\s*\+\s*[A-Za-z_$][\w$]*/.test(body);
}

function callsBinding(body, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(body);
}

export function isDuplicateSlugifyBody(body) {
  const compact = body.replace(/\s+/g, '');
  const lowers = compact.includes('toLowerCase()');
  const trims = compact.includes('trim()');
  const shapes = compact.includes('replace(') || compact.includes('split(');
  return lowers && trims && shapes;
}

function isDelegatedReturn(body, names) {
  const compact = body.replace(/\s+/g, '');
  return names.some((name) => new RegExp(`^return${name}\\([^)]*\\);?$`).test(compact));
}

export function judgeRenameDry(muSrc, appSrc) {
  if (appSrc.includes('addNumbers')) {
    return { ok: false, reason: 'app.mjs 仍含 addNumbers' };
  }
  const muFns = listFunctions(muSrc);
  if (muFns.some((fn) => fn.name === 'addNumbers')) {
    return { ok: false, reason: 'mathUtils.mjs 仍定义 addNumbers' };
  }
  if (!muFns.some((fn) => fn.name === 'sum')) {
    return { ok: false, reason: 'mathUtils.mjs 未定义 sum' };
  }
  const extraAdd = muFns.filter((fn) => fn.name !== 'sum' && containsIdentifierAdd(fn.body));
  if (extraAdd.length > 0) {
    return { ok: false, reason: `mathUtils.mjs 仍保留重复加法实现 ${extraAdd[0].name || 'anonymous'}` };
  }
  const locals = importClauseBinds(appSrc, './mathUtils.mjs', 'sum');
  if (locals.length === 0) {
    return { ok: false, reason: 'app.mjs 没有从 ./mathUtils.mjs 导入 sum' };
  }
  const appFns = listFunctions(appSrc);
  for (const fn of appFns) {
    if (containsIdentifierAdd(fn.body)) {
      return { ok: false, reason: `app.mjs 仍保留重复加法实现 ${fn.name || 'anonymous'}` };
    }
  }
  const total = appFns.find((fn) => fn.name === 'total');
  if (!total || !locals.some((name) => callsBinding(total.body, name))) {
    return { ok: false, reason: 'total 没有调用导入的 sum' };
  }
  return { ok: true, reason: '' };
}

export function judgeExtractDry(aSrc, bSrc) {
  for (const [label, src] of [
    ['a.mjs', aSrc],
    ['b.mjs', bSrc],
  ]) {
    const locals = importClauseBinds(src, './shared.mjs', 'slugify');
    if (locals.length === 0) {
      return { ok: false, reason: `${label} 没有从 ./shared.mjs 导入 slugify` };
    }
    for (const fn of listFunctions(src)) {
      if (fn.name === 'slugify' && !isDelegatedReturn(fn.body, locals)) {
        return { ok: false, reason: `${label} 仍定义 slugify 实现` };
      }
      if (isDuplicateSlugifyBody(fn.body)) {
        return { ok: false, reason: `${label} 仍保留 slugify 重复实现 ${fn.name || 'anonymous'}` };
      }
    }
  }
  return { ok: true, reason: '' };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
