<template>
  <li v-show="visible">
    <div
      class="flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm select-none"
      :class="currentKey === node.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'"
      @click="onClick(node)"
    >
      <button
        v-if="hasChildren"
        type="button"
        class="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
        @click.stop="toggleExpand"
      >
        <svg :class="['h-3 w-3 transition-transform', expanded ? 'rotate-90' : '']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <span v-else class="inline-block w-4"></span>
      <span class="flex-1 truncate">{{ node[defaultProps.label] }}</span>
      <span v-if="countKey && node[countKey] !== undefined" class="text-xs text-primary ml-1">({{ node[countKey] }})</span>
    </div>
    <ul v-if="hasChildren && expanded" class="ml-2 border-l border-border pl-1 space-y-0.5">
      <CategoryTreeNode
        v-for="child in node[defaultProps.children]"
        :key="child.id"
        :node="child"
        :default-props="defaultProps"
        :current-key="currentKey"
        :filter-text="filterText"
        :count-key="countKey"
        :default-expanded="defaultExpanded"
        @node-click="onClick"
      />
    </ul>
  </li>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  defaultProps: { type: Object, default: () => ({ children: 'children', label: 'name' }) },
  currentKey: { type: [Number, String], default: null },
  filterText: { type: String, default: '' },
  countKey: { type: String, default: '' },
  defaultExpanded: { type: Boolean, default: false },
})

const emit = defineEmits(['node-click'])

const expanded = ref(props.defaultExpanded)

const hasChildren = computed(() => {
  const children = props.node[props.defaultProps.children]
  return Array.isArray(children) && children.length > 0
})

const nodeMatches = (n) => {
  const label = n[props.defaultProps.label] || ''
  if (label.indexOf(props.filterText) !== -1) return true
  const children = n[props.defaultProps.children]
  if (Array.isArray(children) && children.some(nodeMatches)) return true
  return false
}

const visible = computed(() => nodeMatches(props.node))

watch(() => props.filterText, (val) => {
  if (val) expanded.value = true
})

const toggleExpand = () => {
  expanded.value = !expanded.value
}

const onClick = (node) => {
  emit('node-click', node)
}
</script>
