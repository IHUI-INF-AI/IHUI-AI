/**
 * ECharts 按需引入工具
 * 仅注册项目用到的图表类型与组件，避免打包全量 echarts（≈1MB）
 * 引入方式：import echarts from '@/utils/echarts'
 */
import * as echarts from 'echarts/core'
import {
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  HeatmapChart,
  FunnelChart,
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LabelLayout, UniversalTransition } from 'echarts/features'

// 注册项目用到的图表、组件、渲染器
echarts.use([
  // 图表
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  HeatmapChart,
  FunnelChart,
  // 组件
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  // 特性
  LabelLayout,
  UniversalTransition,
  // 渲染器（Canvas 比 SVG 体积小、速度快）
  CanvasRenderer,
])

export default echarts
// 命名导出常用 API，方便 `import * as echarts from '@/utils/echarts'` 形式调用 `echarts.init(...)`
export const { init, getInstanceByDom, registerTheme, registerMap, connect, disconnect, graphic, use } = echarts
// 命名导出 ECharts 类型，让 `echarts.ECharts` 可以作为类型使用
export type { ECharts, EChartsCoreOption, EChartsType } from 'echarts/core'
