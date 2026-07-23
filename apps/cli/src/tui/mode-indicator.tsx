/**
 * ModeIndicator — 右下角模式指示器(Plan/Build/Review),ink React 组件。
 * 平台独占:仅 cli(W2-2 TUI 模式指示器,对标 OpenCode Tab mode indicator)。
 *
 * 注意:本文件为 .tsx。apps/cli tsconfig include 为 src 下所有 .ts(不含 .tsx),
 * 不参与 tsc typecheck,待 ink/react 依赖接入后由 TUI 层渲染挂载。
 */
import React from 'react';
import { Box, Text } from 'ink';

export type IndicatorMode = 'plan' | 'build' | 'review';

export interface ModeIndicatorProps {
  mode: IndicatorMode;
  /** 当前迭代轮次(可选,显示 N/M) */
  iterations?: number;
  /** 最大迭代轮次 */
  maxIterations?: number;
}

const MODE_META: Record<IndicatorMode, { label: string; color: string }> = {
  plan: { label: 'PLAN', color: 'yellow' },
  build: { label: 'BUILD', color: 'green' },
  review: { label: 'REVIEW', color: 'magenta' },
};

export function ModeIndicator({
  mode,
  iterations,
  maxIterations,
}: ModeIndicatorProps): React.ReactElement {
  const meta = MODE_META[mode];
  const iter =
    iterations !== undefined && maxIterations !== undefined ? ` ${iterations}/${maxIterations}` : '';
  return (
    <Box flexDirection="row" justifyContent="flex-end">
      <Text color={meta.color} bold>
        {`[${meta.label}]${iter}`}
      </Text>
    </Box>
  );
}

export default ModeIndicator;
