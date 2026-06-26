<template>
  <div class="open-platform-docs page-container">
    <div class="docs-layout">
      <!-- 左侧目录 -->
      <div 
        ref="sidebarRef"
        class="docs-sidebar" 
        :class="{ collapsed: sidebarCollapsed, resizing: isResizing }"
        :style="{ width: sidebarCollapsed ? '60px' : `${sidebarWidth}px` }"
      >
        <div class="sidebar-header">
          <h3>{{ t('openPlatformDocs.title') }}</h3>
          <el-button
            text
            :icon="sidebarCollapsed ? ArrowRight : ArrowLeft"
            @click="toggleSidebar"
            class="collapse-btn"
          />
        </div>
        
        <!-- 拖拽调整宽度手柄 -->
        <div 
          v-if="!sidebarCollapsed"
          class="resize-handle"
          @mousedown="startResize"
        ></div>
        
        <div class="sidebar-content" v-show="!sidebarCollapsed">
          <!-- 搜索框 - 使用全局统一样式 -->
          <div class="search-box unified-search-bar">
            <el-input
              v-model="searchKeyword"
              :placeholder="t('openPlatformDocs.searchPlaceholder')"
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <SearchIcon />
              </template>
            </el-input>
          </div>
          
          <!-- 文档类型切换 -->
          <el-tabs v-model="activeDocType" class="doc-type-tabs">
            <el-tab-pane :label="t('openPlatformDocs.userDocs')" name="user">
              <el-tree
                ref="userTreeRef"
                :data="filteredUserDocTree"
                :props="treeProps"
                :default-expand-all="false"
                :expand-on-click-node="false"
                node-key="id"
                :highlight-current="true"
                @node-click="handleNodeClick"
                class="doc-tree"
              >
                <template #default="{ node, data }">
                  <div class="tree-node">
                    <el-icon v-if="!node.isLeaf" class="node-icon">
                      <Folder v-if="!node.expanded" />
                      <FolderOpened v-else />
                    </el-icon>
                    <el-icon v-else class="node-icon">
                      <Document />
                    </el-icon>
                    <span class="node-label">{{ data.label }}</span>
                  </div>
                </template>
              </el-tree>
            </el-tab-pane>
            <el-tab-pane :label="t('openPlatformDocs.developerDocs')" name="developer">
              <el-tree
                ref="developerTreeRef"
                :data="filteredDeveloperDocTree"
                :props="treeProps"
                :default-expand-all="false"
                :expand-on-click-node="false"
                node-key="id"
                :highlight-current="true"
                @node-click="handleNodeClick"
                class="doc-tree"
              >
                <template #default="{ node, data }">
                  <div class="tree-node">
                    <el-icon v-if="!node.isLeaf" class="node-icon">
                      <Folder v-if="!node.expanded" />
                      <FolderOpened v-else />
                    </el-icon>
                    <el-icon v-else class="node-icon">
                      <Document />
                    </el-icon>
                    <span class="node-label">{{ data.label }}</span>
                  </div>
                </template>
              </el-tree>
            </el-tab-pane>
            <el-tab-pane :label="t('openPlatformDocs.enterpriseService')" name="enterpriseService">
              <el-tree
                ref="enterpriseServiceTreeRef"
                :data="filteredEnterpriseServiceDocTree"
                :props="treeProps"
                :default-expand-all="false"
                :expand-on-click-node="false"
                node-key="id"
                :highlight-current="true"
                @node-click="handleNodeClick"
                class="doc-tree"
              >
                <template #default="{ node, data }">
                  <div class="tree-node">
                    <el-icon v-if="!node.isLeaf" class="node-icon">
                      <Folder v-if="!node.expanded" />
                      <FolderOpened v-else />
                    </el-icon>
                    <el-icon v-else class="node-icon">
                      <Document />
                    </el-icon>
                    <span class="node-label">{{ data.label }}</span>
                  </div>
                </template>
              </el-tree>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- 右侧内容 -->
      <div 
        class="docs-content"
        :style="{ marginLeft: sidebarCollapsed ? '60px' : `${sidebarWidth}px` }"
      >
        <div v-if="loading" class="loading-container">
          <el-skeleton :rows="10" animated />
        </div>

        <div v-else-if="error" class="error-container">
          <el-alert :title="error" type="error" :closable="false" />
        </div>

        <div v-else-if="currentDoc" class="doc-viewer">
          <div class="doc-header">
            <h1 class="doc-title">{{ currentDoc.label }}</h1>
            <div class="doc-actions">
              <el-button text :icon="Share" @click="handleShare">
                {{ t('common.share') }}
              </el-button>
              <el-button text :icon="Printer" @click="handlePrint">
                {{ t('common.print') }}
              </el-button>
              <el-button text :icon="Refresh" @click="loadCurrentDoc">
                {{ t('common.refresh') }}
              </el-button>
            </div>
          </div>
          
          <div class="doc-body">
            <div class="doc-main-content">
              <MarkdownStream
                :content="currentDocContent"
                :enable-mermaid="true"
                :enable-katex="true"
                class="markdown-content"
                @content-update="handleContentUpdate"
              />
            </div>
            
            <!-- 文档目录（右侧） -->
            <div v-if="docToc.length > 0" class="doc-toc">
              <div class="toc-header">
                <el-icon><List /></el-icon>
                <span>{{ t('openPlatformDocs.toc') }}</span>
              </div>
              <div class="toc-content">
                <ul class="toc-list">
                  <li
                    v-for="item in docToc"
                    :key="item.id"
                    :class="['toc-item', `toc-level-${item.level}`, { active: item.id === activeTocId }]"
                    @click="scrollToHeading(item.id)"
                  >
                    <a :href="`#${item.id}`" @click.prevent="scrollToHeading(item.id)">
                      {{ item.text }}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-container">
          <el-empty :description="t('openPlatformDocs.selectDoc')">
            <template #image>
              <el-icon :size="64" style="color: var(--el-text-color-placeholder)">
                <Document />
              </el-icon>
            </template>
          </el-empty>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  Folder,
  FolderOpened,
  Document,
  Refresh,
  List,
  Share,
  Printer,
} from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import MarkdownStream from '@/components/ai/MarkdownStream.vue'
import { logger } from '@/utils/logger'
import { docTreeData, type DocNode, loadDocContent } from '@/data/documentation'
import { useApiError } from '@/composables/useApiError'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// 状态
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(300) // 侧边栏宽度（默认300px）
const isResizing = ref(false) // 是否正在调整大小
const activeDocType = ref<'user' | 'developer' | 'enterpriseService'>('user')
const { loading, execute: _executeApi } = useApiError({ showMessage: false })
const error = ref<string | null>(null)
const currentDocId = ref<string | null>(null)
const currentDocContent = ref('')
const userTreeRef = ref<{ setExpandedKeys: (keys: string[]) => void } | null>(null)
const developerTreeRef = ref<{ setExpandedKeys: (keys: string[]) => void } | null>(null)
const searchKeyword = ref('')
const docToc = ref<Array<{ id: string; text: string; level: number }>>([])
const activeTocId = ref<string>('')
const sidebarRef = ref<HTMLElement | null>(null)

// 树形数据
const userDocTree = computed(() => docTreeData.user)
const developerDocTree = computed(() => docTreeData.developer)
const enterpriseServiceDocTree = computed(() => docTreeData.enterpriseService)

// 过滤文档树
const filterDocTree = (tree: DocNode[], keyword: string): DocNode[] => {
  if (!keyword) return tree
  
  const filtered: DocNode[] = []
  for (const node of tree) {
    const matchesKeyword = node.label.toLowerCase().includes(keyword.toLowerCase())
    const filteredChildren = node.children ? filterDocTree(node.children, keyword) : []
    
    if (matchesKeyword || filteredChildren.length > 0) {
      filtered.push({
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : node.children,
      })
    }
  }
  return filtered
}

const filteredUserDocTree = computed(() => filterDocTree(userDocTree.value, searchKeyword.value))
const filteredDeveloperDocTree = computed(() => filterDocTree(developerDocTree.value, searchKeyword.value))
const filteredEnterpriseServiceDocTree = computed(() => filterDocTree(enterpriseServiceDocTree.value, searchKeyword.value))

// 处理搜索
const handleSearch = () => {
  // 搜索时自动展开所有匹配的节点
  if (searchKeyword.value) {
    nextTick(() => {
      const expandAllMatchingNodes = (tree: DocNode[], expandedKeys: string[]) => {
        for (const node of tree) {
          if (node.label.toLowerCase().includes(searchKeyword.value.toLowerCase())) {
            expandedKeys.push(node.id)
          }
          if (node.children) {
            expandAllMatchingNodes(node.children, expandedKeys)
          }
        }
      }
      
      if (activeDocType.value === 'user' && userTreeRef.value) {
        const expandedKeys: string[] = []
        expandAllMatchingNodes(filteredUserDocTree.value, expandedKeys)
        userTreeRef.value.setExpandedKeys(expandedKeys)
      }
      if (activeDocType.value === 'developer' && developerTreeRef.value) {
        const expandedKeys: string[] = []
        expandAllMatchingNodes(filteredDeveloperDocTree.value, expandedKeys)
        developerTreeRef.value.setExpandedKeys(expandedKeys)
      }
    })
  } else {
    // 清空搜索时收起所有节点
    if (userTreeRef.value) {
      userTreeRef.value.setExpandedKeys([])
    }
    if (developerTreeRef.value) {
      developerTreeRef.value.setExpandedKeys([])
    }
  }
}

// 树形组件配置
const treeProps = {
  children: 'children',
  label: 'label',
}

// 当前文档
const currentDoc = computed<DocNode | null>(() => {
  if (!currentDocId.value) return null
  const allDocs = [...docTreeData.user, ...docTreeData.developer, ...docTreeData.enterpriseService]
  const findDoc = (nodes: DocNode[]): DocNode | null => {
    for (const node of nodes) {
      if (node.id === currentDocId.value) return node
      if (node.children) {
        const found = findDoc(node.children)
        if (found) return found
      }
    }
    return null
  }
  return findDoc(allDocs)
})

// 处理节点点击
const handleNodeClick = async (data: DocNode) => {
  if (!data.path && !data.content) {
    // 文件夹节点，展开/收起
    return
  }

  // 更新路由
  const query = {
    type: activeDocType.value,
    doc: data.id,
  }
   
  router.replace({ path: route.path!, query } as any)

  // 加载文档内容
  currentDocId.value = data.id
  await loadCurrentDoc()
}

// 提取文档目录
const extractToc = (content: string): Array<{ id: string; text: string; level: number }> => {
  const toc: Array<{ id: string; text: string; level: number }> = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      
      toc.push({ id, text, level })
    }
  }
  
  return toc
}

// 为标题添加ID
const addHeadingIds = () => {
  nextTick(() => {
    const headings = document.querySelectorAll('.markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4, .markdown-content h5, .markdown-content h6')
    headings.forEach((heading) => {
      if (!heading.id) {
        const text = heading.textContent || ''
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
        heading.id = id
      }
    })
  })
}

// 处理内容更新
const handleContentUpdate = () => {
  nextTick(() => {
    // 提取目录
    docToc.value = extractToc(currentDocContent.value)
    // 为标题添加ID
    addHeadingIds()
    // 更新活动目录项
    setTimeout(() => {
      updateActiveToc()
    }, 100)
  })
}

// 更新活动目录项
const updateActiveToc = () => {
  if (docToc.value.length === 0) return
  
  const headings = docToc.value.map(item => {
    const element = document.getElementById(item.id)
    return { id: item.id, element, top: element?.offsetTop || 0 }
  }).filter(h => h.element)
  
  if (headings.length === 0) return
  
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  
  // 找到当前视口中的第一个标题
  let activeId = headings[0].id
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].top <= scrollTop + 100) {
      activeId = headings[i].id
      break
    }
  }
  
  activeTocId.value = activeId
}

// 滚动到指定标题
const scrollToHeading = (id: string) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeTocId.value = id
  }
}

// 加载当前文档
const loadCurrentDoc = async () => {
  if (!currentDoc.value) return

  error.value = null
  docToc.value = []
  activeTocId.value = ''

  try {
    const content = await loadDocContent(currentDoc.value)
    currentDocContent.value = content
    
    // 等待内容渲染后提取目录
    await nextTick()
    setTimeout(() => {
      docToc.value = extractToc(content)
      // 为标题添加ID
      addHeadingIds()
      // 更新活动目录项
      updateActiveToc()
    }, 200)
  } catch (err) {
    logger.error(t('common.errors.fetchFailed'), err)
    error.value = err instanceof Error ? err.message : String(err)
    ElMessage.error(t('openPlatformDocs.loadFailed'))
  }
}

// 分享文档
const handleShare = () => {
  if (!currentDoc.value) return
  
  const url = `${window.location.origin}${route.path}?type=${activeDocType.value}&doc=${currentDoc.value.id}`
  
  if (navigator.share) {
    navigator.share({
      title: currentDoc.value.label,
      text: `${currentDoc.value.label} - ${t('openPlatformDocs.title')}`,
      url: url,
    }).catch(() => {
      // 用户取消分享
    })
  } else {
    // 复制链接
    navigator.clipboard.writeText(url).then(() => {
      ElMessage.success(t('common.copySuccess'))
    }).catch(() => {
      ElMessage.error(t('common.copyFailed'))
    })
  }
}

// 打印文档
const handlePrint = () => {
  window.print()
}

// 从路由参数初始化
const initFromRoute = () => {
  const { type, doc } = route.query

  if (type === 'user' || type === 'developer' || type === 'enterpriseService') {
    activeDocType.value = type
  }

  if (doc && typeof doc === 'string') {
    currentDocId.value = doc
    loadCurrentDoc()
  }
}

// 监听路由变化
watch(
  () => route.query,
  () => {
    initFromRoute()
  },
  { immediate: true }
)

// 清理滚动监听
let scrollHandler: (() => void) | null = null
let scrollRafId: number | null = null

onMounted(() => {
  scrollHandler = () => {
    if (scrollRafId !== null) return
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null
      updateActiveToc()
    })
  }
  window.addEventListener('scroll', scrollHandler, { passive: true })
  initFromRoute()
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (scrollHandler) { window.removeEventListener('scroll', scrollHandler) } })
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })
cleanup.add(() => { if (sidebarResizeRafId !== null) { cancelAnimationFrame(sidebarResizeRafId); sidebarResizeRafId = null } })
cleanup.add(() => {
  if (isResizing.value) {
    if (resizeMoveHandler) document.removeEventListener('mousemove', resizeMoveHandler)
    if (resizeUpHandler) document.removeEventListener('mouseup', resizeUpHandler)
  }
})

// 监听文档类型变化，重置选中
watch(activeDocType, () => {
  currentDocId.value = null
  currentDocContent.value = ''
  docToc.value = []
  activeTocId.value = ''
  router.replace({ path: route.path, query: { type: activeDocType.value } } as { path: string; query?: Record<string, string> })
})

// 切换侧边栏折叠状态
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  if (!sidebarCollapsed.value && sidebarWidth.value < 200) {
    sidebarWidth.value = 300 // 展开时恢复默认宽度（300px）
  }
}

// mousemove 节流 rAF ID
let sidebarResizeRafId: number | null = null

// 开始调整侧边栏宽度
let resizeMoveHandler: ((e: MouseEvent) => void) | null = null
let resizeUpHandler: (() => void) | null = null

const startResize = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true

  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (sidebarResizeRafId !== null) return
    // rAF 是异步的，先把 clientX 存起来
    const clientX = moveEvent.clientX
    sidebarResizeRafId = requestAnimationFrame(() => {
      sidebarResizeRafId = null
      if (!isResizing.value) return

      const diff = clientX - startX
      const newWidth = Math.max(200, Math.min(600, startWidth + diff)) // 限制在200-600px之间
      sidebarWidth.value = newWidth
    })
  }

  const handleMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (sidebarResizeRafId !== null) {
      cancelAnimationFrame(sidebarResizeRafId)
      sidebarResizeRafId = null
    }
    resizeMoveHandler = null
    resizeUpHandler = null
  }

  resizeMoveHandler = handleMouseMove
  resizeUpHandler = handleMouseUp
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.open-platform-docs {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  padding: 0;
}

.docs-layout {
  display: flex;
  height: calc(100vh - var(--global-header-height));
  overflow: hidden;
  position: relative;
}

.docs-sidebar {
  position: fixed;
  left: 0;
  top: var(--global-header-height);
  bottom: 0;
  min-width: 60px; // 最小宽度，显示折叠按钮
  max-width: 600px; // 最大宽度
  background-color: var(--el-bg-color);
  border-right: var(--unified-border);
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  z-index: var(--z-header); // 低于顶部菜单栏（z-index: 2000）
  &.collapsed {
    // 使用选择器特异性替代 
    &.docs-sidebar {
      width: 60px;
    }

    min-width: 60px;
    
    .sidebar-content {
      opacity: 0;
      pointer-events: none;
    }
    
    .resize-handle {
      display: none;
    }
  }

  // 调整大小时的样式
  &.resizing {
    user-select: none;
    transition: none; // 拖拽时禁用过渡动画
  }

  @media (width <= $desktop-breakpoint-sm) {
    position: fixed;
    z-index: var(--z-dropdown);
    // 使用选择器特异性替代 
    &.docs-sidebar {
      width: 300px;
    }

    &.collapsed {
      transform: translateX(-100%);

      &.docs-sidebar {
        width: 300px;
      }
    }
    
    .resize-handle {
      display: none; // 移动端隐藏拖拽手柄
    }
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);
  background-color: var(--el-bg-color);
  flex-shrink: 0;
  min-height: 60px;
  position: relative;
  z-index: calc(var(--z-base) + 4);

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    transition: opacity 0.3s ease;
  }

  .collapse-btn {
    padding: 6px;
    flex-shrink: 0;
    margin-left: 12px;
    border-radius: var(--global-border-radius);
    transition: background-color 0.2s ease, color 0.2s ease;
    color: var(--el-text-color-regular);

    &:hover {
      background-color: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }
  }
}

// 折叠状态下只显示按钮
.docs-sidebar.collapsed .sidebar-header {
  padding: 16px;
  justify-content: center;
  
  h3 {
    display: none;
  }
  
  .collapse-btn {
    margin-left: 0;
  }
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: opacity 0.3s ease;
  opacity: 1;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  z-index: calc(var(--z-base) + 19);
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: var(--el-color-primary-light-7);
    width: 6px;
  }
  
  &:active {
    background-color: var(--el-color-primary);
    width: 6px;
  }
}

.search-box {
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);
  flex-shrink: 0;
  
  :deep(.el-input__wrapper) {
    border-radius: var(--global-border-radius); // 使用项目标准圆角
    // 扁平化设计：Element Plus 默认无阴影
  }
}

.doc-type-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;

  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 16px;
    border-bottom: var(--unified-border-bottom);
    flex-shrink: 0;
    background-color: var(--el-bg-color);
  }
  
  :deep(.el-tabs__nav-wrap) {
    &::after {
      display: none; // 移除默认的底部边框
    }
  }
  
  :deep(.el-tabs__item) {
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    transition: color 0.2s ease;

    &:hover {
      color: var(--el-color-primary);
    }

    &.is-active {
      color: var(--el-color-primary);
      font-weight: 600;
    }
  }

  :deep(.el-tabs__content) {
    flex: 1;
    overflow: hidden;
    padding: 0;
    min-height: 0;
  }

  :deep(.el-tab-pane) {
    height: 100%;
    overflow: hidden auto;
    padding: 12px 8px;
    
    // 自定义滚动条样式
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background-color: var(--el-border-color);
      border-radius: var(--global-border-radius);
      
      &:hover {
        background-color: var(--el-text-color-placeholder);
      }
    }
  }
}

.doc-tree {
  background: transparent;
  font-size: 14px;
  padding: 4px 0;

  :deep(.el-tree-node) {
    margin-bottom: 2px;
    
    .el-tree-node__content {
      height: 36px;
      padding: 0 12px;
      border-radius: var(--global-border-radius);
      margin-bottom: 2px;
      transition: background-color 0.2s ease, color 0.2s ease;
      cursor: pointer;

      &:hover {
        background-color: var(--el-fill-color-light);
      }

      &.is-current {
        background-color: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
        font-weight: 500;
      }
    }

    .el-tree-node__expand-icon {
      color: var(--el-text-color-secondary);
      font-size: 16px;
      transition: transform 0.2s ease;
      
      &.is-leaf {
        display: none;
      }
    }
    
    &.is-expanded > .el-tree-node__content .el-tree-node__expand-icon {
      transform: rotate(90deg);
    }
  }
  
  :deep(.el-tree-node__children) {
    padding-left: 16px;
  }
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  overflow: hidden;
  min-width: 0;

  .node-icon {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--el-text-color-secondary);
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .node-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }
}

.docs-content {
  flex: 1;
  overflow: auto;
  background-color: var(--el-bg-color-page);
  padding: 16px 24px 24px;
  min-width: 0;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (width <= $desktop-breakpoint-sm) {
    padding: 16px;

    // 使用 CSS 变量和选择器特异性替代 
    &.docs-content {
      margin-left: 0;
    }
  }
}

.loading-container,
.error-container,
.empty-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.doc-viewer {
  max-width: 1200px;
  margin: 0 auto;
}

.doc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: var(--unified-border-bottom);

  .doc-title {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: var(--el-text-color-primary);

    @media (width <= $desktop-breakpoint-sm) {
      font-size: 24px;
    }
  }

  .doc-actions {
    display: flex;
    gap: 8px;
  }
}

.doc-body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.doc-main-content {
  flex: 1;
  min-width: 0;
}

.doc-toc {
  width: 240px;
  flex-shrink: 0;
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius); // 使用项目标准圆角
  padding: 16px;

  // 扁平化设计：无阴影
  
  @media (width <= $desktop-breakpoint-md) {
    display: none;
  }
}

.toc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  padding-bottom: 8px;
  border-bottom: var(--unified-border-bottom);

  // 扁平化设计：无背景色，仅使用边框分隔
}

.toc-content {
  .toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .toc-item {
    margin: 4px 0;
    line-height: 1.6;
    
    a {
      color: var(--el-text-color-regular);
      text-decoration: none;
      display: block;
      padding: 4px 8px;
      border-radius: var(--global-border-radius); // 使用项目标准圆角
      transition: color 0.2s ease, background-color 0.2s ease;

      // 扁平化设计：无阴影

      &:hover {
        color: var(--el-color-primary);
        background-color: var(--el-fill-color-light);
      }
    }
    
    &.active a {
      color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
      font-weight: 500;

      // 扁平化设计：无边框，仅背景色变化
    }
    
    &.toc-level-1 {
      font-size: 14px;
      font-weight: 600;
    }
    
    &.toc-level-2 {
      font-size: 13px;
      padding-left: 12px;
    }
    
    &.toc-level-3 {
      font-size: 12px;
      padding-left: 24px;
    }
    
    &.toc-level-4,
    &.toc-level-5,
    &.toc-level-6 {
      font-size: 12px;
      padding-left: 36px;
      color: var(--el-text-color-secondary);
    }
  }
}

.markdown-content {
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin-top: 32px;
    margin-bottom: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    line-height: 1.5;
    scroll-margin-top: 80px; // 为固定头部留出空间
  }

  :deep(h1) {
    font-size: 28px;
    border-bottom: 2px solid var(--el-border-color);
    padding-bottom: 8px;
  }

  :deep(h2) {
    font-size: 24px;
    border-bottom: var(--unified-border-bottom);
    padding-bottom: 8px;
  }

  :deep(h3) {
    font-size: 20px;
  }

  :deep(h4) {
    font-size: 18px;
  }

  :deep(p) {
    margin: 16px 0;
    line-height: 1.8;
    color: var(--el-text-color-regular);
  }

  :deep(ul),
  :deep(ol) {
    margin: 16px 0;
    padding-left: 24px;

    li {
      margin: 8px 0;
      line-height: 1.8;
      color: var(--el-text-color-regular);
    }
  }

  :deep(code) {
    background-color: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: var(--global-border-radius); // 使用项目标准圆角
    font-family: var(--font-family-mono);
    font-size: 0.9em;
    color: var(--el-color-danger);

    // 扁平化设计：无边框
  }

  :deep(pre) {
    background-color: var(--el-fill-color-darker);
    padding: 16px;
    border-radius: var(--global-border-radius); // 使用项目标准圆角
    overflow-x: auto;
    margin: 16px 0;
    border: var(--unified-border); // 扁平化设计：使用边框而非阴影
    // 扁平化设计：无阴影

    code {
      background: transparent;
      padding: 0;
      color: var(--el-text-color-primary);
    }
  }

  :deep(blockquote) {
    border-left: var(--el-border-width-primary) solid var(--el-color-primary); // 扁平化设计：更细的边框
    padding-left: 16px;
    margin: 16px 0;
    color: var(--el-text-color-secondary);
    font-style: italic;
    background-color: transparent; // 扁平化设计：无背景色
    // 扁平化设计：无阴影
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    border-radius: var(--global-border-radius); // 使用项目标准圆角
    overflow: hidden;

    // 扁平化设计：无阴影

    th,
    td {
      border: var(--unified-border);
      padding: 12px;
      text-align: left;
    }

    th {
      background-color: var(--el-fill-color-light);
      font-weight: 600;

      // 扁平化设计：无渐变背景
    }
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: var(--global-border-radius); // 使用项目标准圆角
    margin: 16px 0;
    border: var(--unified-border); // 扁平化设计：使用边框
    // 扁平化设计：无阴影
  }

  :deep(a) {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

// 打印样式 - 使用选择器特异性替代 
@media print {
  .open-platform-docs .docs-sidebar,
  .open-platform-docs .doc-toc,
  .open-platform-docs .doc-actions {
    display: none;
  }
  
  .doc-body {
    flex-direction: column;
  }
  
  .docs-content {
    padding: 0;
  }
}
</style>
