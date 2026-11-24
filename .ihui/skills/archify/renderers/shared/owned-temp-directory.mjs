import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { sameEntry } from './path-semantics.mjs';

const retryable = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY']);

function directoryIdentity(directory) {
  const stat = fs.lstatSync(directory, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.ino === 0n) {
    throw new Error(`Temporary directory identity is unavailable or changed: ${directory}`);
  }
  return { directory, dev: stat.dev, ino: stat.ino, birthtimeNs: stat.birthtimeNs };
}

function verifyIdentity(expected) {
  const current = directoryIdentity(expected.directory);
  if (current.dev !== expected.dev || current.ino !== expected.ino
    || current.birthtimeNs !== expected.birthtimeNs) {
    throw new Error(`Temporary directory identity changed: ${expected.directory}`);
  }
}

// Bind cleanup to this creation, never to a caller-supplied deletion path.
// This detects substitution between creation and cleanup (including junctions)
// and between retries. Path-based Node APIs cannot eliminate a hostile mutation
// racing the final check and rm; this is not a filesystem sandbox.
export function createOwnedTempDirectory(prefix, { parent = os.tmpdir() } = {}) {
  if (!/^[a-zA-Z0-9-]+-$/.test(prefix)) throw new Error('Invalid temporary directory prefix');
  const canonicalParent = fs.realpathSync.native(path.resolve(parent));
  const ancestors = [];
  let verifiedParent;
  for (let current = canonicalParent; ; current = path.dirname(current)) {
    const childIdentity = verifiedParent ?? directoryIdentity(current);
    if (verifiedParent) verifyIdentity(childIdentity);
    verifiedParent = undefined;
    ancestors.push(childIdentity);
    let parentRelation = sameEntry(current, path.dirname(current));
    if (process.platform === 'win32' && parentRelation.status === 'unknown'
      && parentRelation.reason.code === 'path-resolution-failed'
      && parentRelation.reason.systemCode === 'EPERM') {
      const parentIdentity = directoryIdentity(path.dirname(current));
      verifyIdentity(childIdentity);
      verifyIdentity(parentIdentity);
      // Carry the checked parent into the next iteration instead of recapturing it.
      verifiedParent = parentIdentity;
      parentRelation = { status: childIdentity.dev === parentIdentity.dev
        && childIdentity.ino === parentIdentity.ino
        && childIdentity.birthtimeNs === parentIdentity.birthtimeNs ? 'match' : 'different' };
    }
    if (parentRelation.status === 'match') break;
    if (parentRelation.status !== 'different') {
      throw new Error(`Temporary directory ancestor identity is unavailable: ${current}`);
    }
  }
  const verifyAncestors = () => {
    // Check from the filesystem root down, before traversing a replaced parent.
    for (const ancestor of [...ancestors].reverse()) verifyIdentity(ancestor);
  };
  verifyAncestors();
  const directory = fs.mkdtempSync(path.join(canonicalParent, prefix));
  verifyAncestors();
  const identity = directoryIdentity(directory);

  function remove() {
    verifyAncestors();
    try {
      verifyIdentity(identity);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    // No internal retry: each new attempt must revalidate the entire binding.
    fs.rmSync(directory, { recursive: true, force: false, maxRetries: 0 });
  }

  return Object.freeze({
    path: directory,
    // 补丁(IHUI-AI 2026-11-24):参数化重试窗口。
    // 3.3.0 把重试写死成 `attempt < 3`,总等待 ~600ms;Windows 上 Chrome 子进程
    // 释放 profile 目录句柄常要 1-3 秒,固定窗口必然 `EBUSY/EPERM` ⇒ 抛
    // ARCHIFY_TEMP_CLEANUP ⇒ browser-check 全红。调用方(visual-check)在 win32 上
    // 传 retries:20 + 递增 delay,等价于 3.2.0 的行为。
    async cleanup({ retries = 3, delayMs } = {}) {
      for (let attempt = 0; ; attempt++) {
        try {
          remove();
          return;
        } catch (cause) {
          if (retryable.has(cause.code) && attempt < retries) {
            const wait = typeof delayMs === 'function'
              ? delayMs(attempt)
              : (delayMs ?? 100 * (attempt + 1));
            await delay(wait);
            continue;
          }
          const error = new Error(`Temporary directory cleanup failed; retained path "${directory}": ${cause.message}`, { cause });
          error.code = 'ARCHIFY_TEMP_CLEANUP';
          error.directory = directory;
          throw error;
        }
      }
    },
  });
}
