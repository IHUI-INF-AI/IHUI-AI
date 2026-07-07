<template>
  <div class="slash-command-palette">
    <div class="slash-command-palette__input-wrapper">
      <span class="slash-command-palette__prompt">/</span>
      <input
        ref="inputRef"
        v-model="filter"
        type="text"
        class="slash-command-palette__input"
        :placeholder="t('floatingChat.workspaceAgent.slashPalette.searchPlaceholder')"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
        @keydown.enter.prevent="commitSelection"
        @keydown.esc.prevent="cancel"
      />
    </div>

    <ul v-if="filteredCommands.length > 0" class="slash-command-palette__list" role="listbox">
      <li
        v-for="(cmd, idx) in filteredCommands"
        :key="cmd.name"
        class="slash-command-palette__item"
        :class="{ 'is-selected': idx === selectedIndex }"
        role="option"
        :aria-selected="idx === selectedIndex"
        @click="selectCommand(cmd)"
        @mouseenter="selectedIndex = idx"
      >
        <div class="slash-command-palette__item-main">
          <span class="slash-command-palette__item-name">{{ cmd.name }}</span>
          <span class="slash-command-palette__item-category">
            {{ categoryLabel(cmd.category) }}
          </span>
        </div>
        <div class="slash-command-palette__item-desc">{{ cmd.description }}</div>
      </li>
    </ul>

    <div v-else class="slash-command-palette__empty">
      {{ t('floatingChat.workspaceAgent.slashPalette.noResults') }}
    </div>

    <div class="slash-command-palette__hint">
      <kbd>↑↓</kbd> {{ t('floatingChat.workspaceAgent.slashPalette.navigate') }}
      <kbd>Enter</kbd> {{ t('floatingChat.workspaceAgent.slashPalette.select') }}
      <kbd>Esc</kbd> {{ t('floatingChat.workspaceAgent.slashPalette.cancel') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export interface SlashCommand {
  name: string
  description: string
  category: string
}

interface Props {
  /** 6 个内置命令列表 (与后端 SLASH_COMMANDS 同步) */
  commands: SlashCommand[]
  /** 默认值: 触发时的初始 filter (来自用户已输入的 /xxx) */
  initialFilter?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialFilter: '',
})

const emit = defineEmits<{
  (e: 'select', command: SlashCommand): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const filter = ref(props.initialFilter)
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const filteredCommands = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return props.commands
  return props.commands.filter(
    (c: SlashCommand) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  )
})

watch(filteredCommands, () => {
  selectedIndex.value = 0
})

onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()
})

function moveSelection(delta: number) {
  const max = filteredCommands.value.length - 1
  if (max < 0) return
  selectedIndex.value = (selectedIndex.value + delta + max + 1) % (max + 1)
}

function commitSelection() {
  const cmd = filteredCommands.value[selectedIndex.value]
  if (cmd) {
    emit('select', cmd)
  }
}

function selectCommand(cmd: SlashCommand) {
  emit('select', cmd)
}

function cancel() {
  emit('cancel')
}

function categoryLabel(cat: string): string {
  return t(`floatingChat.workspaceAgent.slashPalette.category.${cat}`)
}
</script>

<style lang="scss" scoped>
.slash-command-palette {
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  font-size: 13px;
  min-width: 360px;
  max-width: 480px;

  &__input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__prompt {
    color: var(--el-color-primary);
    font-weight: 700;
    font-size: 16px;
    line-height: 1;
  }

  &__input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-family: inherit;

    &::placeholder {
      color: var(--el-text-color-placeholder);
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    max-height: 280px;
    overflow-y: auto;
  }

  &__item {
    padding: 8px 14px;
    cursor: pointer;
    transition: background-color 0.12s ease;

    &.is-selected {
      background-color: var(--el-color-primary-light-9);
    }

    &:not(.is-selected):hover {
      background-color: var(--el-fill-color-light);
    }
  }

  &__item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  &__item-name {
    font-weight: 600;
    color: var(--el-color-primary);
    font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  }

  &__item-category {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    background-color: var(--el-fill-color);
    padding: 1px 6px;
    border-radius: 4px;
  }

  &__item-desc {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  &__empty {
    padding: 20px 14px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-top: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-secondary);
    font-size: 11px;
    background-color: var(--el-fill-color-light);

    kbd {
      display: inline-block;
      padding: 1px 5px;
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 10px;
      background-color: var(--el-bg-color);
      border: 1px solid var(--el-border-color);
      border-radius: 3px;
      color: var(--el-text-color-primary);
    }
  }
}

:where(html.dark) {
  .slash-command-palette {
    &__item.is-selected {
      background-color: var(--color-white-8);
    }
  }
}
</style>
