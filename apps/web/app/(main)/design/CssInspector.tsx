// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { CssGroup, CssProperty, TranslationFn } from './design-types'
import { normalizeColorHex, extractNumber } from './design-utils'

/** 单行 CSS 属性编辑控件:按 type 渲染 select/number/text/color。 */
function CssPropRow({
  prop,
  value,
  onChange,
  t,
}: {
  prop: CssProperty
  value: string
  onChange: (v: string) => void
  t: TranslationFn
}) {
  const labelEl = (
    <label style={{ flex: '0 0 92px', fontSize: 12, color: 'var(--muted)' }}>{t(prop.label)}</label>
  )
  let inputEl: ReactNode
  if (prop.type === 'select' && prop.options) {
    inputEl = (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, fontSize: 12, minWidth: 0 }}
      >
        <option value="">—</option>
        {prop.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  } else if (prop.type === 'color') {
    const hex = normalizeColorHex(value)
    inputEl = (
      <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0 }}>
        <input
          type="color"
          value={hex || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 32,
            height: 24,
            padding: 0,
            border: '1px solid var(--border)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('design.css.placeholder')}
          style={{ flex: 1, fontSize: 12, minWidth: 0 }}
        />
      </div>
    )
  } else if (prop.type === 'number') {
    inputEl = (
      <input
        type="number"
        value={extractNumber(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('design.css.placeholder')}
        style={{ flex: 1, fontSize: 12, minWidth: 0 }}
      />
    )
  } else {
    inputEl = (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('design.css.placeholder')}
        style={{ flex: 1, fontSize: 12, minWidth: 0 }}
      />
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {labelEl}
      {inputEl}
    </div>
  )
}

/** 可折叠 CSS 分组面板(Accordion 风格)。 */
export function CssGroupSection({
  group,
  values,
  onChange,
  t,
}: {
  group: CssGroup
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  t: TranslationFn
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '4px 6px',
          border: 'none',
          background: 'transparent',
          borderRadius: 4,
          textAlign: 'left',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--text, inherit)',
        }}
      >
        <span style={{ width: 10, fontSize: 10, color: 'var(--muted)' }}>
          {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
        </span>
        <span>{t(group.label)}</span>
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8 }}>
          {group.props.map((prop) => (
            <CssPropRow
              key={prop.key}
              prop={prop}
              value={values[prop.key] ?? ''}
              onChange={(v) => onChange(prop.key, v)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
