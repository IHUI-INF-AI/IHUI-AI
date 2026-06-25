<template>
  <div class="mcp-use-project">
    <el-container>
      <!-- 页面头部 -->
      <el-header class="project-header">
        <el-card>
          <div class="header-content">
            <div class="header-left">
              <h1 class="project-title">
                <el-icon><Connection /></el-icon>
                {{ t('mcpUseProject.title') }}
              </h1>
              <p class="project-subtitle">{{ t('mcpUseProject.subtitle') }}</p>
            </div>
            <div class="header-actions">
              <el-button type="primary" @click="goToManager">
                <el-icon><Setting /></el-icon>
                {{ t('mcpUseProject.managementInterface') }}
              </el-button>
              <el-button @click="openProjectFolder">
                <el-icon><FolderOpened /></el-icon>
                {{ t('mcpUseProject.openProjectFolder') }}
              </el-button>
            </div>
          </div>
        </el-card>
      </el-header>

      <!-- 主要内容 -->
      <el-main>
        <el-row :gutter="20">
          <!-- 左侧：项目信息 -->
          <el-col :xs="24" :sm="24" :md="16" :lg="16" :xl="16">
            <!-- 项目介绍 -->
            <el-card class="info-card">
              <template #header>
                <div class="card-header">
                  <span>{{ t('mcpUseProject.projectIntro') }}</span>
                </div>
              </template>
              <div class="project-description">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <p v-html="t('mcpUseProject.description')"></p>
              </div>

              <!-- 核心功能 -->
              <el-divider />
              <h3>{{ t('mcpUseProject.coreFeatures') }}</h3>
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-card shadow="hover" class="feature-card">
                    <div class="feature-icon">🤖</div>
                    <h4>{{ t('mcpUseProject.mcpAgents') }}</h4>
                    <p>{{ t('mcpUseProject.mcpAgentsDesc') }}</p>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card shadow="hover" class="feature-card">
                    <div class="feature-icon">🔌</div>
                    <h4>{{ t('mcpUseProject.mcpClients') }}</h4>
                    <p>{{ t('mcpUseProject.mcpClientsDesc') }}</p>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card shadow="hover" class="feature-card">
                    <div class="feature-icon">🛠️</div>
                    <h4>{{ t('mcpUseProject.mcpServers') }}</h4>
                    <p>{{ t('mcpUseProject.mcpServersDesc') }}</p>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card shadow="hover" class="feature-card">
                    <div class="feature-icon">🔍</div>
                    <h4>{{ t('mcpUseProject.mcpInspector') }}</h4>
                    <p>{{ t('mcpUseProject.mcpInspectorDesc') }}</p>
                  </el-card>
                </el-col>
              </el-row>
            </el-card>

            <!-- 快速开始 -->
            <el-card class="quickstart-card">
              <template #header>
                <div class="card-header">
                  <span>{{ t('mcpUseProject.quickStart') }}</span>
                </div>
              </template>

              <el-tabs v-model="activeLanguage">
                <el-tab-pane :label="t('mcpUseProject.typescript')" name="typescript">
                  <div class="code-section">
                    <h4>{{ t('mcpUseProject.install') }}</h4>
                    <el-input :value="npmInstallCommand" readonly class="code-input">
                      <template #append>
                        <el-button @click="copyCode(npmInstallCommand)">
                          <el-icon><DocumentCopy /></el-icon>
                        </el-button>
                      </template>
                    </el-input>

                    <h4>{{ t('mcpUseProject.usageExample') }}</h4>
                    <pre class="code-block"><code>{{ typescriptExample }}</code></pre>
                    <el-button link @click="copyCode(typescriptExample)">
                      <el-icon><DocumentCopy /></el-icon>
                      {{ t('mcpUseProject.copyCode') }}
                    </el-button>
                  </div>
                </el-tab-pane>

                <el-tab-pane :label="t('mcpUseProject.python')" name="python">
                  <div class="code-section">
                    <h4>{{ t('mcpUseProject.install') }}</h4>
                    <el-input :value="pipInstallCommand" readonly class="code-input">
                      <template #append>
                        <el-button @click="copyCode(pipInstallCommand)">
                          <el-icon><DocumentCopy /></el-icon>
                        </el-button>
                      </template>
                    </el-input>

                    <h4>{{ t('mcpUseProject.usageExample') }}</h4>
                    <pre class="code-block"><code>{{ pythonExample }}</code></pre>
                    <el-button link @click="copyCode(pythonExample)">
                      <el-icon><DocumentCopy /></el-icon>
                      {{ t('mcpUseProject.copyCode') }}
                    </el-button>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </el-card>

            <!-- 项目文档 -->
            <el-card class="docs-card">
              <template #header>
                <div class="card-header">
                  <span>{{ t('mcpUseProject.projectDocs') }}</span>
                </div>
              </template>

              <el-row :gutter="16">
                <el-col :span="12">
                  <el-card shadow="hover" class="doc-link-card" @click="openLocalDoc('typescript')">
                    <div class="doc-icon">📘</div>
                    <h4>{{ t('mcpUseProject.typescriptDocs') }}</h4>
                    <p>{{ t('mcpUseProject.typescriptDocsDesc') }}</p>
                    <el-button link type="primary">
                      {{ t('mcpUseProject.viewDocs') }}
                      <el-icon><ArrowRight /></el-icon>
                    </el-button>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card shadow="hover" class="doc-link-card" @click="openLocalDoc('python')">
                    <div class="doc-icon">🐍</div>
                    <h4>{{ t('mcpUseProject.pythonDocs') }}</h4>
                    <p>{{ t('mcpUseProject.pythonDocsDesc') }}</p>
                    <el-button link type="primary">
                      {{ t('mcpUseProject.viewDocs') }}
                      <el-icon><ArrowRight /></el-icon>
                    </el-button>
                  </el-card>
                </el-col>
              </el-row>
            </el-card>
          </el-col>

          <!-- 右侧：项目信息和链接 -->
          <el-col :xs="24" :sm="24" :md="8" :lg="8" :xl="8">
            <!-- 项目统计 -->
            <el-card class="stats-card">
              <template #header>
                <span>{{ t('mcpUseProject.projectInfo') }}</span>
              </template>
              <el-descriptions :column="1" border>
                <el-descriptions-item :label="t('mcpUseProject.projectLocation')">
                  <el-link @click="openProjectFolder">projects/mcp-use</el-link>
                </el-descriptions-item>
                <el-descriptions-item :label="t('mcpUseProject.languageSupport')"
                  >Python, TypeScript</el-descriptions-item
                >
                <el-descriptions-item :label="t('mcpUseProject.license')">MIT</el-descriptions-item>
                <el-descriptions-item :label="t('mcpUseProject.status')">
                  <el-tag type="success">{{ t('mcpUseProject.integrated') }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item :label="t('mcpUseProject.activeServers')">
                  <el-tag :type="activeMCPServers.length > 0 ? 'success' : 'info'">
                    {{ activeMCPServers.length }}
                  </el-tag>
                </el-descriptions-item>
              </el-descriptions>
            </el-card>

            <!-- 快速链接 -->
            <el-card class="links-card">
              <template #header>
                <span>{{ t('mcpUseProject.quickLinks') }}</span>
              </template>
              <el-space direction="vertical" style="width: 100%">
                <el-button type="primary" style="width: 100%" @click="goToManager">
                  <el-icon><Setting /></el-icon>
                  {{ t('mcpUseProject.mcpUseManagement') }}
                </el-button>
                <el-button style="width: 100%" @click="openLocalDoc('readme')">
                  <el-icon><Document /></el-icon>
                  {{ t('mcpUseProject.viewReadme') }}
                </el-button>
                <el-button style="width: 100%" @click="openLocalDoc('typescript')">
                  <el-icon><Document /></el-icon>
                  {{ t('mcpUseProject.typescriptDoc') }}
                </el-button>
                <el-button style="width: 100%" @click="openLocalDoc('python')">
                  <el-icon><Document /></el-icon>
                  {{ t('mcpUseProject.pythonDoc') }}
                </el-button>
              </el-space>
            </el-card>

            <!-- 项目结构 -->
            <el-card class="structure-card">
              <template #header>
                <span>{{ t('mcpUseProject.projectStructure') }}</span>
              </template>
              <el-tree
                :data="projectStructure"
                :props="{ label: 'label', children: 'children' }"
                default-expand-all
              >
                <template #default="{ node, data }">
                  <span class="tree-node">
                    <el-icon v-if="data.type === 'folder'">
                      <Folder />
                    </el-icon>
                    <el-icon v-else>
                      <Document />
                    </el-icon>
                    {{ node.label }}
                  </span>
                </template>
              </el-tree>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>

    <!-- README 查看对话框 -->
    <el-dialog
      v-model="showReadmeDialog"
      :title="t('mcpUseProject.readmeDialogTitle')"
      width="80%"
      :before-close="handleCloseReadme"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="readme-content" v-html="sanitizeHtml(readmeContent)"></div>
      <template #footer>
        <el-button @click="showReadmeDialog = false">{{ t('mcpUseProject.close') }}</el-button>
        <el-button type="primary" @click="openProjectFolder">{{
          t('mcpUseProject.openProjectFolderBtn')
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getMCPServersList, getMCPResource } from '@/api/tools/mcp'
import type { MCPServer } from '@/api/tools/mcp'
import { useApiError } from '@/composables/useApiError'

import {
  Connection,
  Setting,
  DocumentCopy,
  Document,
} from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const { t } = useI18n()
const { showInfo, showWarning, showSuccess } = useOperationFeedback()
const router = useRouter()
const cleanup = useCleanup()

// 状态
const activeLanguage = ref('typescript')
const showReadmeDialog = ref(false)
const readmeContent = ref('')
const { loading: _loadingMCPServers, execute: executeMCPServersApi } = useApiError({ showMessage: false })
const mcpServers = ref<MCPServer[]>([])

// 计算属性
const activeMCPServers = computed(() => mcpServers.value.filter(s => s.status === 'active'))

// 项目结构
const projectStructure = ref([
  {
    label: 'mcp-use',
    type: 'folder',
    children: [
      {
        label: 'libraries',
        type: 'folder',
        children: [
          { label: 'typescript', type: 'folder' },
          { label: 'python', type: 'folder' },
        ],
      },
      {
        label: 'docs',
        type: 'folder',
        children: [
          { label: 'python', type: 'folder' },
          { label: 'typescript', type: 'folder' },
          { label: 'inspector', type: 'folder' },
        ],
      },
      {
        label: 'examples',
        type: 'folder',
        children: [
          { label: 'typescript', type: 'folder' },
          { label: 'python', type: 'folder' },
        ],
      },
      { label: 'README.md', type: 'file' },
      { label: 'LICENSE', type: 'file' },
    ],
  },
])

// 命令
const npmInstallCommand = 'pnpm install mcp-use'
const pipInstallCommand = 'pip install mcp-use langchain-openai'

// 代码示例
const typescriptExample = `import { MCPAgent, MCPClient } from 'mcp-use';
import { ChatOpenAI } from '@langchain/openai';

// 配置MCP服务器
const config = {
  servers: {
    'filesystem': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/directory']
    }
  }
};

// 创建Agent
const agent = new MCPAgent({
  llm: new ChatOpenAI({ modelName: 'gpt-4' }),
  mcpConfig: config
});

// 使用Agent
const response = await agent.run(t('MCPUseProject.listDirFiles'));
logger.info(response);`

const pythonExample = `import asyncio
from langchain_openai import ChatOpenAI
from mcp_use import MCPAgent, MCPClient

async def main():
    # 配置MCP服务器
    config = {
        'servers': {
            'filesystem': {
                'command': 'npx',
                'args': ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/directory']
            }
        }
    }
    
    # 创建Agent
    agent = MCPAgent(
        llm=ChatOpenAI(model_name='gpt-4'),
        mcp_config=config
    )
    
    # 使用Agent
    response = await agent.run(t('MCPUseProject.listDirFiles2'))
    print(response)

asyncio.run(main())`

// 方法
const goToManager = () => {
  router.push('/mcp-use')
}

const openProjectFolder = () => {
  showInfo(t('mcpUseProject.projectLocationInfo'))
}

const loadMCPServers = async () => {
  const data = await executeMCPServersApi(() => getMCPServersList({
    page: 1,
    pageSize: 20,
    status: 'active'
  }))
  
  if (data !== null && typeof data === 'object') {
    const serversData = data as { list?: any[] }
    mcpServers.value = (serversData.list || []) as MCPServer[]
  }
}

const loadMCPResource = async (serverId: string, uri: string) => {
  try {
    const response = await getMCPResource(serverId, uri)
    if (response.code === 200 && response.success && response.data) {
      const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)
      const parsed = marked.parse(text)
      const html = typeof parsed === 'string' ? parsed : String(parsed)
      readmeContent.value = DOMPurify.sanitize(html)
      showReadmeDialog.value = true
    } else {
      showWarning(t('mcpUseProject.cannotLoadResource'))
    }
  } catch (_error) {
    showWarning(t('mcpUseProject.cannotLoadResource'))
  }
}

const openLocalDoc = (type: string) => {
  // 根据类型加载对应文档
  const docPaths: Record<string, string> = {
    readme: '/docs/mcp-use/README.md',
    typescript: '/docs/mcp-use/typescript/README.md',
    python: '/docs/mcp-use/python/README.md',
  }
  
  const filePath = docPaths[type]
  if (filePath) {
    // 尝试从活跃的 MCP 服务器加载资源
    const activeServer = activeMCPServers.value[0]
    if (activeServer) {
      loadMCPResource(String(activeServer.id), filePath)
    } else {
      // 回退到直接加载文件
      loadReadmeFile(filePath)
    }
  } else {
    showInfo(t('mcpUseProject.projectNotAvailable'))
  }
}

const loadReadmeFile = async (filePath: string) => {
  try {
    abortController = new AbortController()
    const response = await fetch(filePath, { signal: abortController.signal })
    if (response.ok) {
      const text = await response.text()
      const parsed = marked.parse(text)
      const html = typeof parsed === 'string' ? parsed : String(parsed)
      readmeContent.value = DOMPurify.sanitize(html)
      showReadmeDialog.value = true
    } else {
      showWarning(t('mcpUseProject.cannotLoadFile'))
      openProjectFolder()
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    showWarning(t('mcpUseProject.cannotLoadFile'))
    openProjectFolder()
  }
}

const copyCode = (code: string) => {
  navigator.clipboard.writeText(code)
  showSuccess(t('mcpUseProject.codeCopied'))
}

const handleCloseReadme = () => {
  showReadmeDialog.value = false
}

// 生命周期
let abortController: AbortController | null = null
cleanup.add(() => abortController?.abort())
onMounted(() => {
  loadMCPServers()
})
</script>

<style scoped lang="scss">
.mcp-use-project {
  padding: 20px;
  width: 100%;
  margin: 0 auto;

  .project-header {
    padding: 0;
    margin-bottom: 20px;

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-left {
        .project-title {
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 28px;
          font-weight: 600;
        }

        .project-subtitle {
          margin: 0;
          color: var(--el-text-color-secondary);
          font-size: 16px;
        }
      }
    }
  }

  .info-card,
  .quickstart-card,
  .docs-card {
    margin-bottom: 20px;

    .project-description {
      p {
        line-height: 1.8;
        margin-bottom: 16px;
      }
    }

    .feature-card {
      text-align: center;
      margin-bottom: 16px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-4px);
      }

      .feature-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      h4 {
        margin: 12px 0 8px;
        font-size: 18px;
      }

      p {
        margin: 0;
        color: var(--el-text-color-regular);
        font-size: 14px;
      }
    }

    .code-section {
      h4 {
        margin: 16px 0 8px;
        font-size: 16px;
      }

      .code-input {
        margin-bottom: 16px;
      }

      .code-block {
        background: var(--el-bg-color);
        padding: 16px;
        border-radius: var(--global-border-radius);
        overflow-x: auto;
        font-size: 13px;
        line-height: 1.6;
        margin: 12px 0;
      }
    }

    .doc-link-card {
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-4px);
      }

      .doc-icon {
        font-size: 48px;
        text-align: center;
        margin-bottom: 12px;
      }

      h4 {
        margin: 12px 0 8px;
        text-align: center;
      }

      p {
        margin: 0 0 12px;
        text-align: center;
        color: var(--el-text-color-regular);
        font-size: 14px;
      }
    }
  }

  .stats-card,
  .links-card,
  .structure-card {
    margin-bottom: 20px;
  }

  .readme-content {
    max-height: 600px;
    overflow-y: auto;
    padding: 16px;

    :deep(h1),
    :deep(h2),
    :deep(h3) {
      margin-top: 24px;
      margin-bottom: 16px;
    }

    :deep(pre) {
      background: var(--el-fill-color-light);
      padding: 16px;
      border-radius: var(--global-border-radius);
      overflow-x: auto;
    }

    :deep(code) {
      background: var(--el-fill-color-light);
      padding: 2px 6px;
      border-radius: var(--global-border-radius);
      font-size: 13px;
    }
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
