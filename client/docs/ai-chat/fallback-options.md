# AIChat.vue 能力选择器 — 旧版「底部两个按钮」回退方案

> 来源：原 `src/components/ai/AIChat.vue` 第 661-714 行的 HTML 注释块（2026-07-02 因 Vue 编译器无法解析 `<!-- <el-popover>...</el-popover> -->` 内的尖括号标签导致 500 错误，已将注释迁出到本文档）。

## 当前能力选择器结构

主视图 (`capabilityDropdownView === 'main'`)：
- 标题「AI 能力」
- 5 个能力卡片（4 列网格：模型/智能体/Agentic/MCP/自动）
- 分割线 + 「工具」小标题
- 2 个工具卡片（2 列网格：提示词模板/OpenClaw 工具箱）

子视图 (`capabilityDropdownView === 'prompts'`)：
- 返回按钮 + 标题「提示词模板」
- `<PromptTemplates />` 组件内联渲染

**状态：** `showCapabilityDropdown`（下拉窗显隐） + `capabilityDropdownView`（主/子）
**处理函数：** `handleOpenClawFromCapability` / `handlePromptTemplateSelectFromDropdown` / `handleCapabilityDropdownEsc`
**键盘：** Enter/Space 触发、Esc 关闭、Tab 导航、focus-visible 蓝色环

## 回退方案（如需恢复旧版「底部两个按钮」）

### 1. 在 `trae-work-actions-bottom` 内的 `trae-work-left-bottom` 中加入「提示词模板」按钮

```vue
<el-dropdown
  v-model:visible="showPromptTemplates"
  trigger="click"
  class="prompt-templates-dropdown"
  popper-class="ai-chat-popper ai-chat-prompt-templates-popper"
  placement="top"
>
  <el-tooltip
    :content="t('floatingChat.promptTemplates')"
    placement="top"
    popper-class="ai-chat-action-tooltip"
  >
    <button
      type="button"
      class="tw-icon-btn tw-icon-btn-sm"
      :title="t('floatingChat.promptTemplates')"
    >
      <el-icon><FileText /></el-icon>
    </button>
  </el-tooltip>
  <template #dropdown>
    <PromptTemplates @select="handlePromptTemplateSelect" />
  </template>
</el-dropdown>
```

### 2. 在 `trae-work-actions-bottom` 内的 `trae-work-left-bottom` 中加入「OpenClaw 工具箱」按钮

```vue
<el-popover
  placement="top"
  :width="320"
  trigger="click"
  :visible="showOpenClawPopover"
  popper-class="openclaw-popover"
  @update:visible="showOpenClawPopover = $event"
>
  <template #reference>
    <el-tooltip
      :content="t('floatingChat.aiToolbox')"
      placement="top"
      popper-class="ai-chat-action-tooltip"
    >
      <button
        type="button"
        class="tw-icon-btn tw-icon-btn-sm openclaw-btn"
        :title="t('floatingChat.aiToolbox')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="openclaw-icon"
        >
          <rect x="2" y="2" width="9" height="9" rx="2" />
          <rect x="13" y="2" width="9" height="9" rx="2" />
          <rect x="2" y="13" width="9" height="9" rx="2" />
          <path d="M13 13h9v9h-9z" fill="currentColor" opacity="0.3" />
          <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" />
        </svg>
      </button>
    </el-tooltip>
  </template>
  <!-- 9 项工具菜单（dashboard / memory / voice / canvas / skills / browser / automation / models / integrations / settings） -->
</el-popover>
```

### 3. 顶部「+ 选择」下拉窗中移除「工具」区段

删除以下三类 DOM 节点：
- `menu-section-divider`
- `menu-section-header`
- `menu-grid-tools`

### 4. 删除新结构相关状态与函数

- 删除 `capabilityDropdownView` ref
- 删除 `handleOpenClawFromCapability` 函数
- 删除 `handlePromptTemplateSelectFromDropdown` 函数
- 删除 `handleCapabilityDropdownEsc` 函数

### 5. 恢复旧结构相关状态与样式

- 恢复 `showOpenClawPopover` ref
- 恢复 `.openclaw-btn` SCSS
- 恢复 `.openclaw-popover` SCSS

---

**维护提醒：** Vue 模板注释 `<!-- ... -->` 内部禁止包含尖括号 `<` `>` 字符，编译器会尝试解析这些"被注释"的标签并报 `Invalid end tag` 错误。回退方案文档统一放在 `docs/ai-chat/` 目录，禁止再写回模板注释。
