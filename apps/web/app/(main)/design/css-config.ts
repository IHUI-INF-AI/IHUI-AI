// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { DesignTemplateCategory } from '@/lib/design/design-templates'
import type { CssGroup } from './design-types'

const CSS_GROUPS: CssGroup[] = [
  {
    id: 'layout',
    label: 'design.cssGroup.layout',
    props: [
      {
        key: 'display',
        label: 'design.css.display',
        type: 'select',
        group: 'layout',
        options: [
          'block',
          'inline',
          'inline-block',
          'flex',
          'inline-flex',
          'grid',
          'inline-grid',
          'none',
        ],
      },
      {
        key: 'flexDirection',
        label: 'design.css.flexDirection',
        type: 'select',
        group: 'layout',
        options: ['row', 'row-reverse', 'column', 'column-reverse'],
      },
      {
        key: 'justifyContent',
        label: 'design.css.justifyContent',
        type: 'select',
        group: 'layout',
        options: [
          'flex-start',
          'flex-end',
          'center',
          'space-between',
          'space-around',
          'space-evenly',
        ],
      },
      {
        key: 'alignItems',
        label: 'design.css.alignItems',
        type: 'select',
        group: 'layout',
        options: ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'],
      },
      { key: 'gap', label: 'design.css.gap', type: 'text', group: 'layout' },
      {
        key: 'flexWrap',
        label: 'design.css.flexWrap',
        type: 'select',
        group: 'layout',
        options: ['nowrap', 'wrap', 'wrap-reverse'],
      },
      {
        key: 'position',
        label: 'design.css.position',
        type: 'select',
        group: 'layout',
        options: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
      },
      { key: 'top', label: 'design.css.top', type: 'text', group: 'layout' },
      { key: 'right', label: 'design.css.right', type: 'text', group: 'layout' },
      { key: 'bottom', label: 'design.css.bottom', type: 'text', group: 'layout' },
      { key: 'left', label: 'design.css.left', type: 'text', group: 'layout' },
      { key: 'zIndex', label: 'design.css.zIndex', type: 'number', group: 'layout' },
    ],
  },
  {
    id: 'boxModel',
    label: 'design.cssGroup.boxModel',
    props: [
      { key: 'width', label: 'design.css.width', type: 'text', group: 'boxModel' },
      { key: 'height', label: 'design.css.height', type: 'text', group: 'boxModel' },
      { key: 'padding', label: 'design.css.padding', type: 'text', group: 'boxModel' },
      { key: 'margin', label: 'design.css.margin', type: 'text', group: 'boxModel' },
      { key: 'border', label: 'design.css.border', type: 'text', group: 'boxModel' },
      { key: 'borderRadius', label: 'design.css.borderRadius', type: 'text', group: 'boxModel' },
      {
        key: 'boxSizing',
        label: 'design.css.boxSizing',
        type: 'select',
        group: 'boxModel',
        options: ['content-box', 'border-box'],
      },
    ],
  },
  {
    id: 'typography',
    label: 'design.cssGroup.typography',
    props: [
      { key: 'color', label: 'design.css.color', type: 'color', group: 'typography' },
      { key: 'fontSize', label: 'design.css.fontSize', type: 'text', group: 'typography' },
      {
        key: 'fontWeight',
        label: 'design.css.fontWeight',
        type: 'select',
        group: 'typography',
        options: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      },
      { key: 'lineHeight', label: 'design.css.lineHeight', type: 'text', group: 'typography' },
      {
        key: 'textAlign',
        label: 'design.css.textAlign',
        type: 'select',
        group: 'typography',
        options: ['left', 'right', 'center', 'justify'],
      },
      {
        key: 'letterSpacing',
        label: 'design.css.letterSpacing',
        type: 'text',
        group: 'typography',
      },
    ],
  },
  {
    id: 'background',
    label: 'design.cssGroup.background',
    props: [
      { key: 'background', label: 'design.css.background', type: 'text', group: 'background' },
      {
        key: 'backgroundColor',
        label: 'design.css.backgroundColor',
        type: 'color',
        group: 'background',
      },
      {
        key: 'backgroundImage',
        label: 'design.css.backgroundImage',
        type: 'text',
        group: 'background',
      },
    ],
  },
  {
    id: 'effects',
    label: 'design.cssGroup.effects',
    props: [
      { key: 'opacity', label: 'design.css.opacity', type: 'number', group: 'effects' },
      { key: 'boxShadow', label: 'design.css.boxShadow', type: 'text', group: 'effects' },
      { key: 'transform', label: 'design.css.transform', type: 'text', group: 'effects' },
      { key: 'transition', label: 'design.css.transition', type: 'text', group: 'effects' },
      {
        key: 'cursor',
        label: 'design.css.cursor',
        type: 'select',
        group: 'effects',
        options: ['auto', 'default', 'pointer', 'text', 'wait', 'move', 'not-allowed'],
      },
      {
        key: 'overflow',
        label: 'design.css.overflow',
        type: 'select',
        group: 'effects',
        options: ['visible', 'hidden', 'scroll', 'auto'],
      },
    ],
  },
  {
    id: 'responsive',
    label: 'design.cssGroup.responsive',
    props: [
      { key: 'minWidth', label: 'design.css.minWidth', type: 'text', group: 'responsive' },
      { key: 'maxWidth', label: 'design.css.maxWidth', type: 'text', group: 'responsive' },
    ],
  },
]

const ALL_CSS_KEYS = CSS_GROUPS.flatMap((g) => g.props.map((p) => p.key))

const DEFAULT_HTML = `<div style="padding:24px;font-family:sans-serif">
  <h1>Hello Design</h1>
  <button id="cta">Click me</button>
  <p>点我选中元素</p>
</div>`

/** i18n 静态映射表 — 用于消除 `t(\`design.templates.categories.${var}\`)` 动态拼接 */
const TEMPLATE_CATEGORY_KEY: Record<DesignTemplateCategory, string> = {
  blank: 'design.templates.categories.blank',
  marketing: 'design.templates.categories.marketing',
  app: 'design.templates.categories.app',
  content: 'design.templates.categories.content',
  commerce: 'design.templates.categories.commerce',
}

export { CSS_GROUPS, ALL_CSS_KEYS, DEFAULT_HTML, TEMPLATE_CATEGORY_KEY }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
