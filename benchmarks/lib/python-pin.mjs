// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 与 apps/ai-service 的 python_version 对齐：只接受 3.12，不把别的大版本当成可用解释器。 */
export const REQUIRED_PYTHON_MAJOR = 3;
export const REQUIRED_PYTHON_MINOR = 12;

export function requiredPythonLabel() {
  return `${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR}`;
}

export function parsePythonVersion(text) {
  const matched = /(\d+)\.(\d+)\.(\d+)/.exec(String(text || ''));
  if (!matched) return null;
  return {
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
    raw: `${matched[1]}.${matched[2]}.${matched[3]}`,
  };
}

export function pythonVersionMatches(version) {
  return Boolean(
    version && version.major === REQUIRED_PYTHON_MAJOR && version.minor === REQUIRED_PYTHON_MINOR,
  );
}

/**
 * verify.mjs 位于 benchmarks/tasks/<id>/。
 * BENCH_PYTHON 一旦设置就只认这一个，版本不符直接失败，不回落到 PATH 上的另一个大版本。
 */
export function pythonCandidatesFrom(importMetaUrl, env = process.env) {
  const pinned = env.BENCH_PYTHON && String(env.BENCH_PYTHON).trim();
  if (pinned) return [pinned];
  const dir = dirname(fileURLToPath(importMetaUrl));
  const repoRoot = resolve(dir, '..', '..', '..');
  return [
    'python',
    'python3',
    resolve(repoRoot, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe'),
    resolve(repoRoot, 'apps', 'ai-service', '.venv', 'bin', 'python'),
  ];
}

export function probePython(bin) {
  return spawnSync(bin, ['-c', 'import sys; print("%d.%d.%d" % sys.version_info[:3])'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  });
}

export function resolvePinnedPython(candidates, probe, exists = existsSync) {
  const notes = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if ((candidate.includes('/') || candidate.includes('\\')) && !exists(candidate)) {
      notes.push(`${candidate}: 不存在`);
      continue;
    }
    const probed = probe(candidate);
    if (!probed || probed.status !== 0) {
      notes.push(`${candidate}: 无法执行`);
      continue;
    }
    const version = parsePythonVersion(`${probed.stdout || ''}\n${probed.stderr || ''}`);
    if (!pythonVersionMatches(version)) {
      const found = version ? version.raw : '无法解析';
      return {
        ok: false,
        message: `Python 大版本不符: ${candidate} 实际 ${found}，需要 ${requiredPythonLabel()}，拒绝改用其他大版本`,
      };
    }
    return { ok: true, python: candidate, version: version.raw };
  }
  const detail = notes.length ? ` ${notes.join('; ')}` : '';
  return {
    ok: false,
    message: `未找到 Python ${requiredPythonLabel()}。${detail}`.trim(),
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
