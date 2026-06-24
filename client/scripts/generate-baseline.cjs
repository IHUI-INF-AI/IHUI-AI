/**
 * 生成样式基线（用于视觉回归对比）
 *
 * 用法：node scripts/generate-baseline.cjs
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const baselineDir = path.join(rootDir, 'client', 'e2e', 'visual-regression.spec.ts-snapshots');

function main() {
  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  const baseline = {
    generatedAt: new Date().toISOString(),
    snapshots: fs.readdirSync(baselineDir).filter(f => /\.png$/.test(f)),
  };

  const outPath = path.join(__dirname, 'baseline-manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2));
  console.log(`✓ 基线清单已生成: ${outPath}`);
  console.log(`  快照数量: ${baseline.snapshots.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
