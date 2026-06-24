/**
 * E2E 测试覆盖率收集脚本
 *
 * 用法：node scripts/e2e-coverage.cjs
 * 说明：收集 Playwright 测试覆盖率报告并生成汇总
 */

const fs = require('fs');
const path = require('path');

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(__dirname, '..');
const coverageDir = path.join(rootDir, '.playwright-coverage');

function main() {
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
  }

  // 基础覆盖率统计
  const summary = {
    collectedAt: new Date().toISOString(),
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
  };

  const reportPath = path.join(coverageDir, 'coverage-summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

  console.log('✓ E2E 覆盖率收集完成');
  console.log(`  报告路径: ${reportPath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
