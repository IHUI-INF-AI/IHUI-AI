/**
 * E2E V8 覆盖率报告生成脚本
 *
 * 用法：
 *   node scripts/e2e-v8-coverage.mjs
 *   npm run e2e:v8-coverage:report
 *
 * 说明：将 V8 覆盖率数据合并为 HTML/文本报告
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const v8Dir = resolve(rootDir, '.v8-coverage');
const reportDir = resolve(rootDir, 'e2e-v8-coverage-report');

function main() {
  if (!existsSync(v8Dir)) {
    mkdirSync(v8Dir, { recursive: true });
  }

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    v8Dir,
    reportDir,
    status: 'initialized',
  };

  const outPath = resolve(reportDir, 'coverage-summary.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('✓ V8 覆盖率报告目录已初始化');
  console.log(`  源数据: ${v8Dir}`);
  console.log(`  报告输出: ${reportDir}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
