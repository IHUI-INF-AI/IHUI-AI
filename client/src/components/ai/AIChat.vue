<template>
  <!-- 悬浮模式：使用 Teleport 到 body -->
  <Teleport to="body" :disabled="mode === 'embedded'">
    <!-- 悬浮触发按钮（仅在 floating 模式下显示） -->
    <Transition name="fade">
      <button v-if="mode === 'floating' && !isVisible && showToggle" class="floating-chat-trigger" @click="openDialog"
        :title="t('floatingChat.openChat')" :aria-label="t('floatingChat.openChat')">
        <el-icon>
          <MessageCircle />
        </el-icon>
        <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </button>
    </Transition>

    <!-- 对话框（悬浮模式需要 visible，内嵌模式始终显示） -->
    <Transition name="dialog-slide" :disabled="mode === 'embedded'" @after-enter="onDialogAfterEnter">
      <div v-if="mode === 'embedded' || isVisible" class="floating-chat-dialog-wrapper"
        :class="{ 'is-minimized': isMinimized, 'is-embedded': mode === 'embedded', 'theme-custom-service': isCustomServiceTheme }">
        <!-- 对话框主体（标题栏移入其内，保证边框包裹、拖拽时一体移动） -->
        <div ref="dialogRef" class="floating-chat-dialog" :class="{
          'is-dragging': isDragging && draggable,
          'is-resizing': isResizing && resizable,
          'is-dark': isDarkMode,
          'is-embedded': mode === 'embedded',
        }" :style="mode === 'floating' ? dialogStyle : undefined" @mousemove="handleDialogMouseMove"
          @mousedown="handleDialogMouseDown">
          <!-- 标题栏（chat-parts 拆分）：见 ChatHeaderBar.vue -->
          <ChatHeaderBar v-if="showHeader" ref="headerBarRef"
            :is-minimized="isMinimized"
            :is-typing="isTyping"
            :is-custom-service-theme="isCustomServiceTheme"
            :cs-connection-status="csConnectionStatus"
            :cs-connection-status-text="csConnectionStatusText"
            :enable-search="enableSearch"
            :show-minimize="showMinimize"
            :show-close="showClose"
            :draggable="draggable"
            :mode="mode"
            :current-a-i-mode="currentAIMode"
            :selected-model="selectedModel"
            :selected-agent="selectedAgent"
            :effective-show-tickets="effectiveShowTickets"
            @toggle-search="toggleSearch"
            @menu-command="handleMenuCommand"
            @toggle-minimize="toggleMinimize"
            @close-dialog="closeDialog"
            @start-drag="startDrag"
            @dblclick="showMinimize ? toggleMinimize() : undefined"
          />
          <!-- 浮窗主体区：主内容（会话历史已统一走 Sidebar.vue 的 SidebarChatHistory，浮窗内不再重复入口） -->
          <div class="dialog-body-wrap">
            <!-- 主内容：搜索栏、消息区、输入区 -->
            <!-- 搜索栏（chat-parts 拆分）：见 ChatSearchBar.vue -->
            <ChatSearchBar
              v-model="searchQuery"
              :show-search-bar="showSearchBar"
              :search-results="searchResults"
              @search="handleSearch"
              @scroll-to-message="scrollToMessage"
            />

            <!-- OpenClaw 功能面板 -->
            <div v-if="showOpenClawPanel && !isMinimized" class="openclaw-panel-wrapper">
              <OpenClawContainer ref="openClawPanelRef">
                <!-- 仪表板（含空状态：返回后显示仪表板） -->
                <div v-if="openClawActivePanel === 'dashboard' || openClawActivePanel === ''" class="openclaw-subpanel" role="region" :aria-label="t('text.ai_toolbox.仪表板')">
                  <div class="openclaw-subpanel__header">
                    <button type="button" class="openclaw-subpanel__back" @click="handleOpenClawBack"
                      :aria-label="t('common.back')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span class="openclaw-subpanel__title">{{ t('text.ai_toolbox.仪表板') }}</span>
                  </div>
                  <div class="openclaw-dashboard">
                    <div class="openclaw-dashboard__overview">
                      <div class="openclaw-dashboard__stat" role="group" :aria-label="t('floatingChat.totalMessages')">
                        <span class="openclaw-dashboard__stat-value">{{ openClawDashboard?.overview?.totalMessages ?? 0 }}</span>
                        <span class="openclaw-dashboard__stat-label">{{ t('floatingChat.totalMessages') }}</span>
                      </div>
                      <div class="openclaw-dashboard__stat" role="group" :aria-label="t('text.ai_toolbox.定时任务')">
                        <span class="openclaw-dashboard__stat-value">{{ openClawDashboard?.overview?.totalTasks ?? 0 }}</span>
                        <span class="openclaw-dashboard__stat-label">{{ t('text.ai_toolbox.定时任务') }}</span>
                      </div>
                      <div class="openclaw-dashboard__stat" role="group" :aria-label="t('common.hours') + ' ' + t('floatingChat.uptime')">
                        <span class="openclaw-dashboard__stat-value">{{ openClawDashboard?.overview?.uptimeHours ?? 0 }}</span>
                        <span class="openclaw-dashboard__stat-label">{{ t('common.hours') }} {{ t('floatingChat.uptime') }}</span>
                      </div>
                    </div>
                    <div v-if="(openClawDashboard?.recentActivity?.length ?? 0) > 0" class="openclaw-dashboard__section" role="region" :aria-label="t('floatingChat.recentActivity')">
                      <h4 class="openclaw-dashboard__section-title" id="openclaw-dashboard-activity-title">{{ t('floatingChat.recentActivity') }}</h4>
                      <ul class="openclaw-dashboard__activity" aria-labelledby="openclaw-dashboard-activity-title">
                        <li v-for="item in (openClawDashboard?.recentActivity ?? []).slice(0, 8)" :key="item.id"
                          class="openclaw-dashboard__activity-item">
                          <span class="openclaw-dashboard__activity-desc">{{ item.description }}</span>
                          <span class="openclaw-dashboard__activity-time">{{ formatDashboardTime(item.timestamp) }}</span>
                        </li>
                      </ul>
                    </div>
                    <div v-else class="openclaw-dashboard__empty">
                      <p>{{ t('floatingChat.noActivityYet') }}</p>
                    </div>
                  </div>
                </div>
                <!-- 设置 -->
                <div v-else-if="openClawActivePanel === 'settings'" class="openclaw-subpanel" role="region" :aria-label="t('text.ai_toolbox.设置')">
                  <div class="openclaw-subpanel__header">
                    <button type="button" class="openclaw-subpanel__back" @click="openClawActivePanel = ''"
                      :aria-label="t('common.back')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span class="openclaw-subpanel__title">{{ t('text.ai_toolbox.设置') }}</span>
                  </div>
                  <div class="openclaw-settings">
                    <p class="openclaw-settings__placeholder">{{ t('floatingChat.settingsComingSoon') }}</p>
                    <el-button type="primary" size="small" class="openclaw-settings__link-btn"
                      @click="handleOpenClawBack(); router.push('/settings').catch(() => { /* NavigationDuplicated 错误，无需处理 */ })">
                      {{ t('floatingChat.goToSystemSettings') }}
                    </el-button>
                  </div>
                </div>
                <!-- 记忆/语音/画布等单功能：完整子面板 UI -->
                <div v-else class="openclaw-subpanel" role="region" :aria-label="openClawToolTitle(openClawActivePanel)">
                  <div class="openclaw-subpanel__header">
                    <button type="button" class="openclaw-subpanel__back" @click="openClawActivePanel = 'dashboard'"
                      :aria-label="t('common.back')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span class="openclaw-subpanel__title">{{ openClawToolTitle(openClawActivePanel) }}</span>
                  </div>
                  <template v-if="openClawPanelComponent(openClawActivePanel)">
                    <component
                      :is="openClawPanelComponent(openClawActivePanel)"
                      v-bind="openClawActivePanel === 'memory' ? { sessionId: currentConversationId } : {}"
                      @use-in-chat="handleBrowserPanelUseInChat"
                    />
                  </template>
                  <div v-else class="openclaw-settings">
                    <p class="openclaw-settings__placeholder">{{ t('floatingChat.featureComingSoon') }}</p>
                  </div>
                </div>
              </OpenClawContainer>
            </div>

            <!-- 消息区域 -->
            <div v-show="!isMinimized && !showOpenClawPanel" ref="messagesContainerRef" class="messages-container"
              @scroll="handleScroll">
              <!-- 空状态 -->
              <div v-if="filteredMessages.length === 0" class="empty-state">
                <div class="welcome-section">
                  <!-- 欢迎文本 -->
                  <div class="welcome-text">
                    <h3 class="welcome-title">{{ t('floatingChat.welcome') }}</h3>
                  </div>

                  <!-- 快速问题建议 -->
                  <div v-if="suggestedQuestions.length > 0" class="suggested-questions">
                    <div class="suggested-questions-header">
                      <el-icon class="suggested-icon">
                        <Sparkles />
                      </el-icon>
                      <span class="suggested-questions-title">{{ t('floatingChat.suggestedQuestions') }}</span>
                    </div>
                    <div class="suggested-questions-list">
                      <button v-for="(question, index) in suggestedQuestions" :key="index" class="question-btn"
                        @click="useSuggestedQuestion(question)">
                        <el-icon class="question-icon">
                          <PenTool v-if="index === 0" />
                          <HelpCircle v-else-if="index === 1" />
                          <Code v-else-if="index === 2" />
                          <Picture v-else-if="index === 3" />
                          <VideoPlay v-else-if="index === 4" />
                          <View v-else />
                        </el-icon>
                        <span class="question-text">{{ question }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 消息列表 -->
              <div v-else class="messages-list">
                <TransitionGroup name="message-fade" tag="div">
                  <div v-for="(message, index) in filteredMessages" :key="message.id"
                    :ref="(el: HTMLElement | null) => setMessageRef(el, message.id)" class="message-item" :class="{
                      'is-user': message.role === 'user',
                      'is-assistant': message.role === 'assistant',
                      'is-streaming': message.isStreaming,
                      'is-failed': message.status === 'failed',
                      'is-selected': selectedMessageId === message.id,
                    }">
                    <!-- 日期分隔符 -->
                    <div v-if="shouldShowDateSeparator(index)" class="date-separator">
                      <span class="date-label">{{ getDateLabelForMessage(message.createTime) }}</span>
                    </div>

                    <!-- 用户消息 -->
                    <div v-if="message.role === 'user'" class="user-message">
                      <div class="message-avatar user-avatar">
                        <img v-if="authStore.avatar" :src="authStore.avatar" alt="User avatar"
                          class="message-avatar-img" loading="lazy" />
                        <el-icon v-else>
                          <User />
                        </el-icon>
                      </div>
                      <div class="message-content-wrapper">
                        <div class="message-content">
                          <!-- 编辑模式 -->
                          <div v-if="editingMessageId === message.id" class="message-edit">
                            <el-input v-model="editContent" type="textarea" :rows="4" autofocus :maxlength="5000"
                              show-word-limit @keydown.ctrl.enter="saveEdit" @keydown.esc="cancelEdit" />
                            <div class="edit-actions">
                              <el-button size="small" @click="cancelEdit">{{ t('common.cancel') }}</el-button>
                              <el-button size="small" type="primary" @click="saveEdit" :disabled="!editContent.trim()">
                                {{ t('common.save') }}
                              </el-button>
                            </div>
                          </div>
                          <!-- 显示模式 -->
                          <div v-else class="message-text">
                            <!-- 引用消息显示 -->
                            <div v-if="message.quotedMessage" class="quoted-message"
                              @click.stop="handleQuoteClick(message)">
                              <div class="quoted-message-header">
                                <el-icon>
                                  <MessageCircle />
                                </el-icon>
                                <span class="quoted-message-role">
                                  {{ message.quotedMessage.role === 'user' ? t('common.user') : 'AI' }}
                                </span>
                              </div>
                              <div class="quoted-message-content" :title="t('floatingChat.clickToViewOriginal')">
                                {{ message.quotedMessage.content.substring(0, 100) }}{{
                                  message.quotedMessage.content.length > 100 ?
                                    '...' : '' }}
                              </div>
                            </div>
                            <div class="message-main-content" @dblclick="handleMessageTextClick">
                              <!-- 如果是Markdown/HTML内容，使用MarkdownStream渲染（例如包含 <audio> 的历史消息） -->
                              <MarkdownStream v-if="checkIsMarkdown(getAssistantDisplayContent(message))"
                                :content="getAssistantDisplayContent(message)" :is-streaming="message.isStreaming" />
                              <!-- 否则直接显示文本（转义HTML） -->
                              <div v-else class="message-text-plain">
                                {{ getAssistantDisplayContent(message) }}
                              </div>
                            </div>
                            <!-- 显示已编辑标记 -->
                            <span v-if="message.edited" class="edited-badge">
                              <el-icon>
                                <Edit />
                              </el-icon>
                              {{ t('floatingChat.edited') }}
                            </span>
                          </div>
                          <!-- 文件附件 -->
                          <div v-if="message.files && message.files.length > 0" class="message-files">
                            <div v-for="(file, fileIndex) in message.files" :key="fileIndex" class="file-item">
                              <!-- 图片文件 -->
                              <el-image v-if="file.type?.startsWith('image/')" :src="file.preview"
                                :preview-src-list="message.files?.filter((f: { type?: string; preview: string }) => f.type?.startsWith('image/')).map((f: { preview: string }) => f.preview) || []"
                                fit="cover" class="file-image" :initial-index="fileIndex" />
                              <!-- 音频文件 -->
                              <div v-else-if="file.type?.startsWith('audio/')" class="file-audio">
                                <audio :src="file.preview" controls class="audio-element">
                                  <source :src="file.preview" :type="file.type" />
                                </audio>
                                <div class="file-name">{{ file.name }}</div>
                              </div>
                              <!-- 视频文件 -->
                              <div v-else-if="file.type?.startsWith('video/')" class="file-video">
                                <video :src="file.preview" controls preload="none" class="video-element">
                                  <source :src="file.preview" :type="file.type" />
                                </video>
                                <div class="file-name">{{ file.name }}</div>
                              </div>
                              <!-- 其他文件 -->
                              <div v-else class="file-info" @click="downloadFile(file)">
                                <el-icon>
                                  <Document />
                                </el-icon>
                                <span class="file-name">{{ file.name }}</span>
                                <el-button link size="small" class="file-download-btn" @click.stop="downloadFile(file)">
                                  <el-icon>
                                    <Download />
                                  </el-icon>
                                </el-button>
                              </div>
                            </div>
                          </div>
                          <!-- 消息状态（仅发送中/失败时显示，不显示时间） -->
                          <div v-if="message.status === 'sending' || message.status === 'failed'"
                            class="message-status">
                            <el-icon v-if="message.status === 'sending'" class="status-icon sending">
                              <Loader2 />
                            </el-icon>
                            <el-icon v-else-if="message.status === 'failed'" class="status-icon failed"
                              @click="retryMessage(message)">
                              <AlertTriangle />
                            </el-icon>
                          </div>
                        </div>
                        <!-- 消息操作 -->
                        <div class="message-actions">
                          <el-button link size="small" @click="copyMessage(message)" :title="t('common.copy')"
                            class="message-action-btn">
                            <el-icon>
                              <Copy />
                            </el-icon>
                          </el-button>
                          <el-button link size="small" @click="editMessage(message)" :title="t('common.edit')"
                            class="message-action-btn">
                            <el-icon>
                              <Edit />
                            </el-icon>
                          </el-button>
                          <el-button link size="small" @click="replyToMessage(message)" :title="t('floatingChat.reply')"
                            class="message-action-btn">
                            <el-icon>
                              <MessageCircle />
                            </el-icon>
                          </el-button>
                          <el-button link size="small" @click="deleteMessage(message)" :title="t('common.delete')"
                            class="message-action-btn">
                            <el-icon>
                              <Trash2 />
                            </el-icon>
                          </el-button>
                        </div>
                      </div>
                    </div>

                    <!-- AI消息 -->
                    <div v-else class="assistant-message">
                      <div class="message-avatar assistant-avatar">
                        <img v-if="getAssistantMessageAvatarUrl(message)" :src="getAssistantMessageAvatarUrl(message)" alt="AI Assistant"
                          class="message-avatar-img" loading="lazy" />
                        <AIStarIcon v-else :size="20" class="assistant-avatar-fallback" />
                      </div>
                      <div class="message-content-wrapper">
                        <div class="message-content">
                          <!-- 内容可见性（与 ai_assistant 一致） -->
                          <template v-if="getAssistantContentVisible(message)">
                            <div class="message-text" @click="handleMessageTextClick($event)">
                              <MarkdownStream v-if="checkIsMarkdown(getAssistantDisplayContent(message))"
                                :content="getAssistantDisplayContent(message)" :enable-mermaid="true"
                                :enable-katex="true" :loading="message.isStreaming" />
                              <!-- eslint-disable-next-line vue/no-v-html -->
                              <div v-else v-html="formatMessage(getAssistantDisplayContent(message))"></div>
                            </div>
                            <!-- 思考过程（与 ai_index2 一致，可展开） -->
                            <div v-if="getAssistantThinkingContent(message)" class="assistant-thinking">
                              <button type="button" class="thinking-toggle" @click="toggleThinkingVisibility(message)">
                                <el-icon>
                                  <Brain />
                                </el-icon>
                                {{ isThinkingVisible(message) ? t('floatingChat.hideThinking') :
                                  t('floatingChat.showThinking') }}
                              </button>
                              <!-- eslint-disable-next-line vue/no-v-html -->
                              <div v-if="isThinkingVisible(message)" class="thinking-content" v-html="formatThinkingContent(getAssistantThinkingContent(message)!)"></div>
                            </div>
                            <!-- 图片列表（与 ai_assistant/imgUrlList 一致） -->
                            <div v-if="getAssistantImages(message).length" class="assistant-images">
                              <el-image v-for="(img, imgIdx) in getAssistantImages(message)" :key="imgIdx" :src="img"
                                :preview-src-list="getAssistantImages(message)" fit="cover" class="assistant-image" />
                            </div>
                            <!-- 视频（videoUrl 或 videoUrlList） -->
                            <div v-if="getAssistantVideos(message).length" class="assistant-videos">
                              <video v-for="(video, videoIdx) in getAssistantVideos(message)" :key="'video-' + videoIdx"
                                :src="video" controls preload="none" class="assistant-video" />
                            </div>
                            <!-- 音频 -->
                            <div v-if="message.metadata?.audioUrl" class="assistant-audio">
                              <audio :src="message.metadata.audioUrl" controls class="assistant-audio-player" />
                            </div>
                          </template>
                          <div v-else class="assistant-content-hidden">
                            {{ t('floatingChat.contentHidden') }}
                          </div>
                          <!-- 流式输入指示器 -->
                          <div v-if="message.isStreaming" class="streaming-indicator">
                            <span class="typing-dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </span>
                          </div>
                          <!-- 消息时间 -->
                          <div class="message-status">
                            <span v-if="message.model" class="message-model">
                              <img v-if="getMessageModelIcon(message)" :src="getMessageModelIcon(message)"
                                alt="Model Icon" class="message-model-icon" loading="lazy" />
                              {{ getMessageModelDisplayName(message) }}
                            </span>
                            <span v-else-if="message.metadata?.agent" class="message-model">
                              <img v-if="getMessageAgentAvatar(message)" :src="getMessageAgentAvatar(message)"
                                alt="" class="message-model-icon message-model-agent-avatar" loading="lazy" />
                              <el-icon v-else>
                                <Bot />
                              </el-icon>
                              {{ message.metadata.agent }}
                            </span>
                            <span v-else-if="message.metadata?.swarm" class="message-model">
                              <el-icon>
                                <Network />
                              </el-icon>
                              Agentic AI
                            </span>
                            <span v-else-if="message.metadata?.tools" class="message-model">
                              <el-icon>
                                <Wrench />
                              </el-icon>
                              {{ t('floatingChat.mcpTools') }}
                            </span>
                            <!-- Token 使用统计（与 ai_index2/ai_assistant 智汇值一致） -->
                            <span v-if="message.metadata?.usage || (message.metadata?.total_tokens != null)"
                              class="token-usage">
                              <el-icon>
                                <BarChart3 />
                              </el-icon>
                              <span class="token-info">
                                <template v-if="message.metadata?.usage">
                                  {{ t('floatingChat.tokensUsed', {
                                    total: message.metadata.usage.totalTokens,
                                    prompt: message.metadata.usage.promptTokens,
                                    completion: message.metadata.usage.completionTokens
                                  }) || `Tokens: ${message.metadata.usage.totalTokens}
                                  (${message.metadata.usage.promptTokens}+${message.metadata.usage.completionTokens})`
                                  }}
                                </template>
                                <template v-else>
                                  {{ t('floatingChat.tokensConsumed', {
                                    count:
                                      formatTokensForMessage(message.metadata!.total_tokens!)
                                  }) }}
                                </template>
                              </span>
                            </span>
                            <!-- 显示错误信息 -->
                            <span v-if="message.error" class="message-error" :title="message.error">
                              <el-icon>
                                <AlertTriangle />
                              </el-icon>
                            </span>
                          </div>
                          <!-- 响应元数据展示 -->
                          <Transition name="fade">
                            <div
                              v-if="message.showMetadata && message.metadata && Object.keys(message.metadata).length > 0 && message.role === 'assistant'"
                              class="response-metadata">
                              <div class="metadata-content">
                                <div v-if="message.metadata.usage" class="metadata-section">
                                  <h4>{{ t('floatingChat.tokenUsage') }}</h4>
                                  <div class="usage-details">
                                    <div class="usage-item">
                                      <span class="usage-label">{{ t('floatingChat.promptTokens') }}:</span>
                                      <span class="usage-value">{{ message.metadata.usage.promptTokens }}</span>
                                    </div>
                                    <div class="usage-item">
                                      <span class="usage-label">{{ t('floatingChat.completionTokens') }}:</span>
                                      <span class="usage-value">{{ message.metadata.usage.completionTokens }}</span>
                                    </div>
                                    <div class="usage-item">
                                      <span class="usage-label">{{ t('floatingChat.totalTokens') }}:</span>
                                      <span class="usage-value">{{ message.metadata.usage.totalTokens }}</span>
                                    </div>
                                  </div>
                                </div>
                                <div v-if="message.metadata.processingTime" class="metadata-section">
                                  <h4>{{ t('floatingChat.processingTime') }}</h4>
                                  <div class="processing-time">{{ message.metadata.processingTime }}ms</div>
                                </div>
                                <div class="metadata-section">
                                  <h4>{{ t('floatingChat.fullMetadata') }}</h4>
                                  <pre class="metadata-json">{{ JSON.stringify(message.metadata, null, 2) }}</pre>
                                </div>
                              </div>
                            </div>
                          </Transition>
                        </div>
                        <!-- 消息操作（与 ai_assistant 一致： visibility / copy / download / share） -->
                        <div class="message-actions">
                          <el-button v-if="message.role === 'assistant'" link size="small"
                            @click="toggleAssistantContentVisibility(message)"
                            :title="getAssistantContentVisible(message) ? t('floatingChat.hideContent') : t('floatingChat.showContent')"
                            class="message-action-btn">
                            <el-icon>
                              <Eye v-if="getAssistantContentVisible(message)" />
                              <EyeOff v-else />
                            </el-icon>
                          </el-button>
                          <el-button link size="small" @click="toggleLike(message)"
                            :class="{ 'is-liked': message.liked }"
                            :title="message.liked ? t('floatingChat.unlike') : t('floatingChat.like')"
                            class="message-action-btn">
                            <el-icon>
                              <Star />
                            </el-icon>
                          </el-button>
                          <el-button link size="small" @click="copyMessage(message)" :title="t('common.copy')"
                            class="message-action-btn">
                            <el-icon>
                              <Copy />
                            </el-icon>
                          </el-button>
                          <el-button v-if="message.role === 'assistant' && getAssistantImages(message).length > 0" link
                            size="small" @click="downloadAssistantImages(message)"
                            :title="t('floatingChat.downloadImages')" class="message-action-btn">
                            <el-icon>
                              <Download />
                            </el-icon>
                          </el-button>
                          <el-button v-if="message.role === 'assistant'" link size="small"
                            @click="shareAssistantMessage(message)" :title="t('floatingChat.share')"
                            class="message-action-btn">
                            <el-icon>
                              <Share />
                            </el-icon>
                          </el-button>
                          <el-button
                            v-if="message.role === 'assistant' && message.metadata && Object.keys(message.metadata).length > 0"
                            link size="small" @click="toggleMetadata(message)"
                            :title="t('floatingChat.viewMetadata')" class="message-action-btn"
                            :class="{ 'is-active': message.showMetadata }">
                            <el-icon><Code /></el-icon>
                          </el-button>
                          <el-button v-if="message.role === 'assistant'" link size="small"
                            @click="regenerateMessage(message)"
                            :disabled="message.isStreaming || message.status === 'sending'"
                            :title="t('floatingChat.regenerate')" class="message-action-btn">
                            <el-icon>
                              <RefreshCw />
                            </el-icon>
                          </el-button>
                          <el-button link size="small" @click="replyToMessage(message)" :title="t('floatingChat.reply')"
                            class="message-action-btn">
                            <svg class="reply-quote-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                              <path d="M68.266667 273.068048 68.266667 273.068048 68.266667 750.931951C68.266667 863.890033 160.053205 955.733333 273.068048 955.733333L750.931951 955.733333C863.890033 955.733333 955.733333 863.946796 955.733333 750.931951L955.733333 273.068048C955.733333 160.109968 863.946796 68.266667 750.931951 68.266667L273.068048 68.266667C160.109968 68.266667 68.266667 160.053205 68.266667 273.068048L68.266667 273.068048ZM0 273.068048C0 122.25673 122.501211 0 273.068048 0L750.931951 0C901.743271 0 1024 122.501211 1024 273.068048L1024 750.931951C1024 901.743271 901.498788 1024 750.931951 1024L273.068048 1024C122.25673 1024 0 901.498788 0 750.931951L0 273.068048 0 273.068048Z" />
                              <path d="M828.461264 498.205327C828.461264 526.867132 821.823775 554.678801 808.548796 581.640332 795.27382 608.601863 777.21985 632.648632 754.386889 653.78064 731.553929 674.912652 705.136722 691.793971 675.135273 704.424598 645.133824 717.055225 613.406624 723.370537 579.953681 723.370537L548.890235 723.370537C536.677257 723.370537 523.535029 723.491987 509.463549 723.734883 495.392075 723.977779 481.453346 724.099226 467.647372 724.099226L430.211932 724.099226C414.812959 724.099226 402.59998 725.556606 393.572997 728.471368 384.54601 731.386129 380.298018 737.701441 380.829017 747.417308 380.829017 754.704208 380.696269 763.084142 380.430766 772.557113 380.16527 782.030083 380.032519 790.652915 380.032519 798.425608 380.032519 811.056234 376.315525 819.193273 368.881538 822.836723 361.44755 826.480173 351.624066 823.929758 339.411087 815.185479 326.667108 806.441198 312.064634 796.118089 295.603661 784.216153 279.142689 772.314216 262.150717 760.047934 244.627746 747.417308 227.104776 734.786679 209.847305 722.398952 192.855334 710.254118 175.863363 698.109283 160.729888 687.178933 147.45491 677.463067 135.241931 668.718787 129.002692 660.460302 128.737192 652.687606 128.471693 644.914913 133.914433 636.656428 145.065414 627.912148 156.747395 619.167867 170.420622 608.844759 186.085096 596.942821 201.749569 585.040886 218.077792 572.774601 235.069763 560.143974 252.061734 547.513351 268.788207 535.12562 285.249178 522.980785 301.710151 510.835954 316.312625 499.905604 329.056605 490.189735 342.862582 479.502281 354.411814 475.373039 363.704296 477.802004 372.996782 480.230973 377.643022 488.003666 377.643022 501.120085 377.643022 505.006432 377.775773 509.742916 378.041272 515.329543 378.306772 520.916166 378.572271 526.867132 378.83777 533.182447 379.10327 539.497759 379.368769 545.570174 379.634268 551.399697 379.899771 557.229216 380.032519 562.330047 380.032519 566.702186 380.032519 575.932259 383.085763 581.640332 389.192253 583.826401 395.298744 586.012471 403.661978 587.105505 414.28196 587.105505 438.176922 586.619713 464.992375 586.376817 494.728325 586.376817L577.564184 586.376817C589.777166 586.376817 601.990144 583.826401 614.203122 578.725571 626.416104 573.62474 637.567085 566.823636 647.656069 558.322251 657.74505 549.820867 665.975538 539.983555 672.347525 528.810308 678.719515 517.637059 681.90551 505.735124 681.90551 493.104497L681.90551 442.096196C681.90551 422.664462 681.772762 403.839969 681.50726 385.622719 681.24176 367.405469 681.109012 351.495738 681.109012 337.893526L681.109012 312.389373C681.109012 301.701922 684.693255 292.836192 691.861743 285.792188 699.030231 278.748187 708.057218 273.404457 718.9427 269.76101 729.828178 266.11756 741.642909 264.295834 754.386889 264.295834 767.130866 264.295834 778.945597 265.996111 789.831079 269.396664 800.716561 272.797218 809.743544 277.776599 816.912032 284.33481 824.080521 290.893018 827.664766 299.030057 827.664766 308.745926L827.664766 328.420553 827.664766 362.668984C827.664766 375.299611 827.797514 388.780377 828.063014 403.111281 828.328513 417.442185 828.461264 431.165846 828.461264 444.282266L828.461264 477.802004 828.461264 498.205327 828.461264 498.205327Z" />
                            </svg>
                          </el-button>
                          <el-button v-if="message.role === 'assistant' && canPublishToCommunity(message)" link
                            size="small" @click="publishToCommunity(message)"
                            :title="t('floatingChat.publishToCommunity')"
                            class="message-action-btn publish-btn">
                            <el-icon>
                              <Promotion />
                            </el-icon>
                          </el-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
              </div>
            </div>

            <!-- 输入区域 -->
            <div v-show="!isMinimized" class="input-area">
              <!-- 引用消息提示 -->
              <div v-if="quotedMessage" class="quoted-preview">
                <div class="quoted-preview-header">
                  <el-icon>
                    <MessageCircle />
                  </el-icon>
                  <span>{{ t('floatingChat.replyingTo', {
                    role: quotedMessage.role === 'user' ? t('common.user') : 'AI'
                  })
                  }}</span>
                  <el-button link size="small" class="cancel-reply-btn" @click="cancelReply">
                    <el-icon>
                      <X />
                    </el-icon>
                  </el-button>
                </div>
                <div class="quoted-preview-content">
                  {{ quotedMessage.content.substring(0, 100) }}{{ quotedMessage.content.length > 100 ? '...' : '' }}
                </div>
              </div>

              <!-- 文件预览 -->
              <div v-if="uploadedFiles.length > 0" class="file-preview">
                <div v-for="file in uploadedFiles" :key="file.id" class="preview-item">
                  <el-image v-if="file.type?.startsWith('image/')" :src="file.preview" fit="cover"
                    class="preview-image" />
                  <div v-else class="preview-file">
                    <el-icon>
                      <Document />
                    </el-icon>
                    <span class="file-name">{{ file.name }}</span>
                    <span v-if="file.size" class="file-size">{{ formatFileSize(file.size) }}</span>
                  </div>
                  <el-button link size="small" class="remove-file-btn" @click="removeFile(index)"
                    :title="t('common.delete')">
                    <el-icon>
                      <X />
                    </el-icon>
                  </el-button>
                </div>
              </div>

              <!-- 快捷工具栏（支持拖拽滚动） -->
              <div v-if="quickTools && quickTools.length > 0" ref="quickToolsBarRef" class="quick-tools-bar"
                @mousedown="handleToolsBarMouseDown" @mousemove="handleToolsBarMouseMove"
                @mouseup="handleToolsBarMouseUp" @mouseleave="handleToolsBarMouseLeave">
                <button v-for="(tool, index) in quickTools" :key="index" class="quick-tool-item"
                  @click="useQuickTool(tool.text)" :title="tool.text" :aria-label="tool.text">
                  {{ tool.text }}
                </button>
              </div>

              <!-- 客服主题：快捷 FAQ -->
              <div v-if="isCustomServiceTheme && effectiveQuickFaq.length > 0" class="cs-quick-faq">
                <label class="cs-quick-faq-label">
                  <span class="cs-quick-faq-label-icon"></span>
                  QUICK_FAQ
                </label>
                <div class="cs-quick-faq-list">
                  <button v-for="(faq, index) in effectiveQuickFaq" :key="faq.id" class="cs-faq-pill btn-ripple-cs"
                    @click="useQuickFaq(faq)">
                    <span class="cs-pill-text">{{ faq.question }}</span>
                    <span class="cs-pill-arrow">→</span>
                  </button>
                </div>
              </div>

              <!-- 客服主题：输入区控制台标签 -->
              <div v-if="isCustomServiceTheme" class="cs-console-header">
                <span class="cs-console-label">MESSAGE_COMPOSER</span>
                <span class="cs-console-indicator"></span>
              </div>

              <!-- 输入框 -->
              <div class="input-wrapper">
                <!-- 语音录制波形动画（录音时显示） -->
                <div v-if="isRecording" class="voice-waveform-container" @click="toggleVoice">
                  <div class="voice-waveform">
                    <span class="waveform-bar" v-for="i in 12" :key="i"
                      :style="{ animationDelay: `${i * 0.05}s` }"></span>
                  </div>
                  <div class="voice-recording-info">
                    <span class="recording-dot"></span>
                    <span class="recording-duration">{{ formatRecordingDuration(recordingDuration) }}</span>
                    <span class="recording-hint">{{ t('floatingChat.clickStopRecord') }}</span>
                  </div>
                </div>

                <!-- trae-work Row 1: 顶层能力选择下拉（+ 选择） -->
                <div class="trae-work-actions-top">
                  <el-dropdown trigger="click" v-model:visible="showCapabilityDropdown"
                    class="ai-capability-selector"
                    placement="top" :hide-on-click="false"
                    :popper-options="{ strategy: 'fixed', modifiers: [{ name: 'offset', options: { offset: [0, 8] } }] }"
                    popper-class="ai-chat-popper ai-capability-popper"
                    @visible-change="onCapabilityDropdownVisibleChange">
                    <!-- Trigger pill: + 选择 -->
                    <el-button link size="small" class="tw-selector-pill"
                      :aria-label="t('aiChatInput.select')"
                      aria-haspopup="menu"
                      :aria-expanded="showCapabilityDropdown"
                      :title="t('aiChatInput.select')"
                      role="button"
                      tabindex="0">
                      <el-icon class="tw-selector-icon-plus"><Plus /></el-icon>
                      <span class="tw-selector-label">{{ t('aiChatInput.select') }}</span>
                      <el-icon class="tw-selector-caret" :class="{ 'is-open': showCapabilityDropdown }"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <div class="ai-capability-popper-inner">
                        <span class="sr-only" aria-live="polite">
                          {{ capabilityDropdownView === 'prompts' ? t('floatingChat.promptTemplates') : t('floatingChat.aiCapability') }}
                        </span>
                        <Transition name="capability-view" mode="out-in">
                          <!-- Main view: 5 capability cards + tools section -->
                          <div v-if="capabilityDropdownView === 'main'" key="main"
                            class="openclaw-quick-menu ai-capability-quick-menu capability-view-pane"
                            role="menu">
                            <div class="menu-header">
                              <span class="menu-title">{{ t('floatingChat.aiCapability') }}</span>
                            </div>
                            <div class="menu-grid">
                              <div class="menu-item" role="menuitem" tabindex="0"
                                :class="{ active: currentAIMode === 'model' }"
                                :aria-label="t('floatingChat.modeModel')"
                                @click="onCapabilityCardClick('select:model')">
                                <div class="item-icon models">
                                  <AIStarIcon :size="20" />
                                </div>
                                <span class="item-label">{{ t('floatingChat.modeModel') }}</span>
                                <span class="item-desc">{{ selectedModel ? getModelDisplayName(selectedModel) : (t('floatingChat.selectModel')) }}</span>
                              </div>
                              <div class="menu-item" role="menuitem" tabindex="0"
                                :class="{ active: currentAIMode === 'agent' }"
                                :aria-label="t('floatingChat.modeAgent')"
                                @click="onCapabilityCardClick('select:agent')">
                                <div class="item-icon memory">
                                  <el-icon><Bot /></el-icon>
                                </div>
                                <span class="item-label">{{ t('floatingChat.modeAgent') }}</span>
                                <span class="item-desc">{{ selectedAgent ? selectedAgent.name : (t('floatingChat.selectAgent')) }}</span>
                              </div>
                              <div class="menu-item" role="menuitem" tabindex="0"
                                :class="{ active: currentAIMode === 'agentic' }"
                                :aria-label="t('floatingChat.modeAgentic')"
                                @click="onCapabilityCardClick('mode:agentic')">
                                <div class="item-icon canvas">
                                  <el-icon><Network /></el-icon>
                                </div>
                                <span class="item-label">{{ t('floatingChat.modeAgentic') }}</span>
                                <span class="item-desc">AgenticAI</span>
                              </div>
                              <div class="menu-item" role="menuitem" tabindex="0"
                                :class="{ active: currentAIMode === 'mcp' }"
                                :aria-label="t('floatingChat.modeMCP')"
                                @click="onCapabilityCardClick('select:mcp')">
                                <div class="item-icon browser">
                                  <el-icon><Wrench /></el-icon>
                                </div>
                                <span class="item-label">{{ t('floatingChat.modeMCP') }}</span>
                                <span class="item-desc">{{ unifiedMCPTools.length }} {{ t('floatingChat.mcpTools') }}</span>
                              </div>
                              <div class="menu-item" role="menuitem" tabindex="0"
                                :class="{ active: currentAIMode === 'auto' }"
                                :aria-label="t('floatingChat.modeAuto')"
                                @click="onCapabilityCardClick('mode:auto')">
                                <div class="item-icon skills">
                                  <el-icon><Zap /></el-icon>
                                </div>
                                <span class="item-label">{{ t('floatingChat.modeAuto') }}</span>
                                <span class="item-desc">{{ t('floatingChat.autoDecision') }}</span>
                              </div>
                            </div>
                            <!-- Tools section: prompt templates + AI toolbox -->
                            <div class="menu-section-divider"></div>
                            <div class="menu-section-header">{{ t('aiChatInput.tools') }}</div>
                            <div class="menu-grid-tools">
                              <div class="menu-item menu-item-tool" role="menuitem" tabindex="0"
                                :aria-label="t('floatingChat.promptTemplates')"
                                @click="goToCapabilityView('prompts')">
                                <div class="item-icon prompt">
                                  <el-icon><FileText /></el-icon>
                                </div>
                                <span class="item-label">{{ t('floatingChat.promptTemplates') }}</span>
                                <span class="item-desc">{{ t('aiChatInput.promptTemplatesDesc') }}</span>
                              </div>
                              <div class="menu-item menu-item-tool" role="menuitem" tabindex="0"
                                :aria-label="t('floatingChat.aiToolbox')"
                                @click="handleOpenClawFromCapability">
                                <div class="item-icon toolbox">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" stroke-linejoin="round" class="openclaw-icon">
                                    <rect x="2" y="2" width="9" height="9" rx="2" />
                                    <rect x="13" y="2" width="9" height="9" rx="2" />
                                    <rect x="2" y="13" width="9" height="9" rx="2" />
                                    <path d="M13 13h9v9h-9z" fill="currentColor" opacity="0.3" />
                                    <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" />
                                  </svg>
                                </div>
                                <span class="item-label">{{ t('floatingChat.aiToolbox') }}</span>
                                <span class="item-desc">{{ t('aiChatInput.aiToolboxDesc') }}</span>
                              </div>
                            </div>
                          </div>
                          <!-- Sub view: prompts list -->
                          <div v-else key="prompts"
                            class="ai-capability-quick-menu ai-capability-subview capability-view-pane"
                            role="menu">
                            <button ref="capabilityBackBtnRef" type="button"
                              class="menu-back-btn" @click="backToCapabilityMain">
                              <el-icon><ArrowLeft /></el-icon>
                              <span>{{ t('aiChatInput.back') }}</span>
                            </button>
                            <div class="menu-header-sub">{{ t('floatingChat.promptTemplates') }}</div>
                            <PromptTemplates @select="handlePromptTemplateSelectFromDropdown" />
                          </div>
                        </Transition>
                      </div>
                    </template>
                  </el-dropdown>
                </div>

                <!-- 正常输入模式（包含语音小卡片） -->
                <div v-show="!isRecording" class="chat-input-container" :class="{ 'has-voice-mini': voiceAudioData }"
                  @click="onChatInputContainerClick">
                  <!-- 语音小卡片（微信风格，录音结束后显示在输入框内） -->
                  <div v-if="voiceAudioData" class="voice-mini-card">
                    <button class="mini-play-btn" @click.stop="toggleAudioPlayback"
                      :title="t('hardcoded.a_i_chat.isAudioP1')" :aria-label="t('hardcoded.a_i_chat.isAudioP1')">
                      <el-icon v-if="!isAudioPlaying">
                        <VideoPlay />
                      </el-icon>
                      <el-icon v-else>
                        <VideoPause />
                      </el-icon>
                    </button>
                    <div class="mini-waveform">
                      <span v-for="i in 8" :key="i" class="mini-wave-bar" :class="{ 'is-playing': isAudioPlaying }"
                        :style="{ animationDelay: `${i * 0.05}s` }"></span>
                    </div>
                    <span class="mini-duration">{{ formatRecordingDuration(voiceAudioData.duration) }}"</span>
                    <button class="mini-delete-btn" @click.stop="clearVoiceAudio" :title="t('hardcoded.a_i_chat.删除2')"
                      :aria-label="t('hardcoded.a_i_chat.删除2')">
                      <el-icon>
                        <X />
                      </el-icon>
                    </button>
                    <audio ref="audioPlayerRef" :src="voiceAudioData.audioUrl" @ended="onAudioEnded"
                      @timeupdate="onAudioTimeUpdate" style="display: none;" />
                  </div>

                  <!-- 输入框（始终显示，可继续输入转换后的文字） -->
                  <div ref="inputRef" class="chat-input" :class="{ 'has-voice-card': voiceAudioData }"
                    contenteditable="true" :data-placeholder="t('hardcoded.a_i_chat.voiceAud')"
                    @keydown.enter.exact.prevent="handleSend" @keydown.enter.shift.exact="handleShiftEnter"
                    @input="handleInputChange" @paste="handlePaste"></div>
                </div>

                <!-- trae-work Row 3: 底部操作栏（文件左 / 语音+发送右） -->
                <div class="trae-work-actions-bottom">
                  <div class="trae-work-left-bottom">
                    <!-- 文件上传 -->
                    <el-tooltip :content="t('floatingChat.uploadFile')" placement="top"
                      popper-class="ai-chat-action-tooltip">
                      <el-button v-if="enableFileUpload" link size="small" class="action-btn"
                        @click="handleFileUpload('file')">
                        <UploadPlusIcon :size="16" />
                      </el-button>
                    </el-tooltip>
                  </div>
                  <div class="trae-work-right-bottom">
                    <!-- 语音输入 -->
                    <el-tooltip :content="isRecording ? t('aiChat.stopRecording') : (voiceAudioData ? t('aiChat.reRecord') : t('floatingChat.voiceInput'))"
                      placement="top" popper-class="ai-chat-action-tooltip">
                      <el-button v-if="enableVoice" link size="small" class="action-btn" @click="toggleVoice"
                        :class="{ 'is-recording': isRecording, 'has-audio': voiceAudioData }">
                        <el-icon v-if="isRecording">
                          <MicrophoneOff />
                        </el-icon>
                        <el-icon v-else>
                          <Microphone />
                        </el-icon>
                      </el-button>
                    </el-tooltip>
                    <!-- 发送按钮 -->
                    <el-button type="primary" size="small" class="send-btn"
                      :class="{ 'is-empty': !canSend && !isSending, 'is-ready': canSend, 'is-sending': isSending }"
                      :disabled="!canSend && !isSending" @click="handleSend"
                      :title="t('floatingChat.send')">
                      <el-icon v-if="!isSending" class="send-btn-icon-send">
                        <Promotion />
                      </el-icon>
                      <el-icon v-else class="send-btn-icon-loading is-loading">
                        <Loader2 />
                      </el-icon>
                      <span class="send-btn-text">{{ isSending ? '发送中...' : t('floatingChat.send') }}</span>
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

          </div>
          <!-- 边缘拖拽区域 - 四个角（最小化时隐藏） -->
          <template v-if="!isMinimized">
            <div class="resize-corner resize-corner-top-left" @mousedown="(e) => startEdgeResize(e, 'top-left')"></div>
            <div class="resize-corner resize-corner-top-right" @mousedown="(e) => startEdgeResize(e, 'top-right')">
            </div>
            <div class="resize-corner resize-corner-bottom-left" @mousedown="(e) => startEdgeResize(e, 'bottom-left')">
            </div>
            <div class="resize-corner resize-corner-bottom-right"
              @mousedown="(e) => startEdgeResize(e, 'bottom-right')"></div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- 统计对话框 -->
    <el-dialog v-if="shouldRenderStatsDialog" v-model="showStatsDialog" :title="t('floatingChat.stats')" width="500px" :close-on-click-modal="false" @closed="shouldRenderStatsDialog = false">
      <div class="stats-content">
        <div class="stat-item">
          <div class="stat-label">{{ t('floatingChat.totalMessages') }}</div>
          <div class="stat-value">{{ getMessageStats.total }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('floatingChat.userMessages') }}</div>
          <div class="stat-value">{{ getMessageStats.user }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('floatingChat.assistantMessages') }}</div>
          <div class="stat-value">{{ getMessageStats.assistant }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('floatingChat.messagesWithFiles') }}</div>
          <div class="stat-value">{{ getMessageStats.withFiles }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('floatingChat.failedMessages') }}</div>
          <div class="stat-value">{{ getMessageStats.failed }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('floatingChat.likedMessages') }}</div>
          <div class="stat-value">{{ getMessageStats.liked }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('floatingChat.editedMessages') }}</div>
          <div class="stat-value">{{ getMessageStats.edited }}</div>
        </div>
        <div v-if="getMessageStats.avgUserMessageLength > 0" class="stat-item">
          <div class="stat-label">{{ t('floatingChat.avgUserMessageLength') }}</div>
          <div class="stat-value">{{ getMessageStats.avgUserMessageLength }} {{ t('floatingChat.characters') }}</div>
        </div>
        <div v-if="getMessageStats.avgAssistantMessageLength > 0" class="stat-item">
          <div class="stat-label">{{ t('floatingChat.avgAssistantMessageLength') }}</div>
          <div class="stat-value">{{ getMessageStats.avgAssistantMessageLength }} {{ t('floatingChat.characters') }}</div>
        </div>
        <div v-if="getMessageStats.earliestMessage" class="stat-item">
          <div class="stat-label">{{ t('floatingChat.timeRange') }}</div>
          <div class="stat-value stat-time-range">
            <div>{{ formatTime(getMessageStats.earliestMessage!) }}</div>
            <div>{{ t('common.to') }}</div>
            <div>{{ formatTime(getMessageStats.latestMessage!) }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showStatsDialog = false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <!-- API接入对话框：z-index 高于「选择AI能力」背板(10001)，避免从能力面板内点击时被遮罩盖住 -->
    <el-dialog v-if="shouldRenderApiAccessDialog" v-model="showApiAccessDialog" width="720px"
      :close-on-click-modal="false" class="api-access-dialog" top="5vh" :z-index="10002" @closed="shouldRenderApiAccessDialog = false">
      <template #header="{ close, titleId, titleClass }">
        <div :id="titleId" :class="titleClass" class="api-access-dialog-header">
          <span class="el-dialog__title">{{ t('floatingChat.apiAccessTitle') }}</span>
          <el-button link type="primary" size="small" class="api-access-doc-btn" @click="openApiAccessDoc">
            {{ t('floatingChat.apiAccessDoc') }}
          </el-button>
          <button type="button" class="el-dialog__headerbtn" aria-label="Close" @click="close">
            <el-icon><X /></el-icon>
          </button>
        </div>
      </template>
      <div class="api-access-content">
        <!-- 基本信息区域 -->
        <div class="api-basic-info">
          <div class="info-grid">
            <div class="api-info-section">
              <div class="api-info-label">
                <el-icon>
                  <Key />
                </el-icon>
                <span>API Key</span>
              </div>
              <div class="api-info-value">
                <el-input v-model="apiAccessInfo.apiKey" readonly :type="showApiKey ? 'text' : 'password'" size="small">
                  <template #suffix>
                    <el-button link size="small" @click="showApiKey = !showApiKey">
                      <el-icon>
                        <Eye v-if="!showApiKey" />
                        <EyeOff v-else />
                      </el-icon>
                    </el-button>
                    <el-button link size="small" @click="copyToClipboard(apiAccessInfo.apiKey, 'API Key')">
                      <el-icon>
                        <Copy />
                      </el-icon>
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>

            <div class="api-info-section">
              <div class="api-info-label">
                <el-icon>
                  <Globe />
                </el-icon>
                <span>Base URL</span>
              </div>
              <div class="api-info-value">
                <el-input v-model="apiAccessInfo.baseUrl" readonly size="small">
                  <template #suffix>
                    <el-button link size="small" @click="copyToClipboard(apiAccessInfo.baseUrl, 'Base URL')">
                      <el-icon>
                        <Copy />
                      </el-icon>
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>

            <div class="api-info-section">
              <div class="api-info-label">
                <el-icon>
                  <Cpu />
                </el-icon>
                <span>{{ t('floatingChat.modelId') }}</span>
              </div>
              <div class="api-info-value">
                <el-input v-model="apiAccessInfo.modelId" readonly size="small">
                  <template #suffix>
                    <el-button link size="small" @click="copyToClipboard(apiAccessInfo.modelId, 'Model ID')">
                      <el-icon>
                        <Copy />
                      </el-icon>
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- 协议/平台选择 -->
        <div class="protocol-section">
          <div class="section-title">
            <el-icon>
              <Layers />
            </el-icon>
            <span>{{ t('floatingChat.supportedProtocols') }}</span>
          </div>

          <el-tabs v-model="selectedProtocol" type="border-card" class="protocol-tabs">
            <!-- OpenAI 协议 -->
            <el-tab-pane name="openai">
              <template #label>
                <div class="tab-label">
                  <img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23412991' d='M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z'/%3E%3C/svg%3E"
                    alt="OpenAI" class="protocol-icon" loading="lazy" />
                  <span>OpenAI</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge python">Python</span>
                  <el-button link size="small" @click="copyProtocolCode('openai-python')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>from openai import OpenAI

                client = OpenAI(
                api_key="{{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}",
                base_url="{{ apiAccessInfo.baseUrl }}/v1"
                )

                response = client.chat.completions.create(
                model="{{ apiAccessInfo.modelId }}",
                messages=[{"role": "user", "content": "Hello!"}]
                )</code></pre>
              </div>
            </el-tab-pane>

            <!-- Claude/Anthropic 协议 -->
            <el-tab-pane name="anthropic">
              <template #label>
                <div class="tab-label">
                  <img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23D97757' d='M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.38-3.636h7.029l1.404 3.636h3.744L10.608 3.541zm-.372 10.656l2.46-6.471 2.46 6.471z'/%3E%3C/svg%3E"
                    alt="Anthropic" class="protocol-icon" loading="lazy" />
                  <span>Claude</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge python">Python</span>
                  <el-button link size="small" @click="copyProtocolCode('anthropic')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>import anthropic

                # 兼容 Anthropic 协议
                client = anthropic.Anthropic(
                api_key="{{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}",
                base_url="{{ apiAccessInfo.baseUrl }}/anthropic"
                )

                message = client.messages.create(
                model="{{ apiAccessInfo.modelId }}",
                max_tokens=1024,
                messages=[{"role": "user", "content": "Hello!"}]
                )</code></pre>
              </div>
            </el-tab-pane>

            <!-- Azure OpenAI -->
            <el-tab-pane name="azure">
              <template #label>
                <div class="tab-label">
                  <img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%230078D4' d='M13.05 4.24L6.56 18.05L2 18l5.09-13.76zM14.5 4.5L22 20h-7l-1.5-3.5h-5z'/%3E%3C/svg%3E"
                    alt="Azure" class="protocol-icon" loading="lazy" />
                  <span>Azure</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge python">Python</span>
                  <el-button link size="small" @click="copyProtocolCode('azure')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>from openai import AzureOpenAI

                # Azure OpenAI 兼容接口
                client = AzureOpenAI(
                api_key="{{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}",
                api_version="2024-02-01",
                azure_endpoint="{{ apiAccessInfo.baseUrl }}/azure"
                )

                response = client.chat.completions.create(
                model="{{ apiAccessInfo.modelId }}",
                messages=[{"role": "user", "content": "Hello!"}]
                )</code></pre>
              </div>
            </el-tab-pane>

            <!-- LangChain -->
            <el-tab-pane name="langchain">
              <template #label>
                <div class="tab-label">
                  <span class="emoji-icon">🦜</span>
                  <span>LangChain</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge python">Python</span>
                  <el-button link size="small" @click="copyProtocolCode('langchain')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>from langchain_openai import ChatOpenAI

                llm = ChatOpenAI(
                model="{{ apiAccessInfo.modelId }}",
                api_key="{{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}",
                base_url="{{ apiAccessInfo.baseUrl }}/v1"
                )

                response = llm.invoke("Hello, how are you?")</code></pre>
              </div>
            </el-tab-pane>

            <!-- LlamaIndex -->
            <el-tab-pane name="llamaindex">
              <template #label>
                <div class="tab-label">
                  <span class="emoji-icon">🦙</span>
                  <span>LlamaIndex</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge python">Python</span>
                  <el-button link size="small" @click="copyProtocolCode('llamaindex')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>from llama_index.llms.openai import OpenAI

                llm = OpenAI(
                model="{{ apiAccessInfo.modelId }}",
                api_key="{{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}",
                api_base="{{ apiAccessInfo.baseUrl }}/v1"
                )

                response = llm.complete("Hello!")</code></pre>
              </div>
            </el-tab-pane>

            <!-- Node.js -->
            <el-tab-pane name="nodejs">
              <template #label>
                <div class="tab-label">
                  <img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23339933' d='M12 21.985c-.275 0-.532-.074-.772-.202l-2.439-1.448c-.365-.203-.182-.277-.072-.314.496-.165.588-.201 1.101-.493.056-.037.129-.02.185.017l1.87 1.12c.074.036.166.036.221 0l7.319-4.237c.074-.036.11-.11.11-.202V7.768c0-.091-.036-.165-.11-.201l-7.319-4.219c-.073-.037-.165-.037-.221 0L4.552 7.566c-.073.036-.11.129-.11.201v8.457c0 .073.037.166.11.202l2 1.157c1.082.548 1.762-.095 1.762-.735V8.502c0-.11.091-.221.22-.221h.936c.108 0 .22.092.22.221v8.347c0 1.449-.788 2.294-2.164 2.294-.422 0-.752 0-1.688-.46l-1.925-1.099a1.55 1.55 0 0 1-.771-1.34V7.786c0-.55.293-1.064.771-1.339l7.316-4.237a1.637 1.637 0 0 1 1.544 0l7.317 4.237c.479.274.771.789.771 1.339v8.458c0 .549-.293 1.063-.771 1.34l-7.317 4.236c-.241.11-.516.165-.773.165zm2.256-5.816c-3.21 0-3.87-1.468-3.87-2.714 0-.11.092-.221.22-.221h.954c.11 0 .201.073.201.184.147.971.568 1.449 2.514 1.449 1.54 0 2.202-.35 2.202-1.175 0-.477-.185-.825-2.587-1.063-1.999-.2-3.246-.643-3.246-2.238 0-1.485 1.247-2.366 3.339-2.366 2.347 0 3.503.809 3.649 2.568a.297.297 0 0 1-.056.165c-.037.036-.091.073-.146.073h-.953a.212.212 0 0 1-.202-.164c-.221-1.012-.789-1.34-2.292-1.34-1.689 0-1.891.587-1.891 1.027 0 .531.237.696 2.514.99 2.256.293 3.32.715 3.32 2.294-.02 1.615-1.339 2.531-3.67 2.531z'/%3E%3C/svg%3E"
                    alt="Node.js" class="protocol-icon" loading="lazy" />
                  <span>Node.js</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge js">JavaScript</span>
                  <el-button link size="small" @click="copyProtocolCode('nodejs')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>import OpenAI from 'openai';

                const client = new OpenAI({
                apiKey: '{{ showApiKey ? apiAccessInfo.apiKey : "sk-***" }}',
                baseURL: '{{ apiAccessInfo.baseUrl }}/v1'
                });

                const response = await client.chat.completions.create({
                model: '{{ apiAccessInfo.modelId }}',
                messages: [{ role: 'user', content: 'Hello!' }]
                });</code></pre>
              </div>
            </el-tab-pane>

            <!-- cURL -->
            <el-tab-pane name="curl">
              <template #label>
                <div class="tab-label">
                  <el-icon>
                    <Terminal />
                  </el-icon>
                  <span>cURL</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge bash">Bash</span>
                  <el-button link size="small" @click="copyProtocolCode('curl')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>curl {{ apiAccessInfo.baseUrl }}/v1/chat/completions \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer {{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}" \
                -d '{
                "model": "{{ apiAccessInfo.modelId }}",
                "messages": [{"role": "user", "content": "Hello!"}],
                "stream": false
                }'</code></pre>
              </div>
            </el-tab-pane>

            <!-- Ollama -->
            <el-tab-pane name="ollama">
              <template #label>
                <div class="tab-label">
                  <span class="emoji-icon">🦙</span>
                  <span>Ollama</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge bash">{{ t('aiChat.configuration') }}</span>
                  <el-button link size="small" @click="copyProtocolCode('ollama')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code># 设置环境变量让 Ollama 客户端使用我们的 API
                export OLLAMA_HOST="{{ apiAccessInfo.baseUrl }}/ollama"
                export OLLAMA_API_KEY="{{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}"

                # 使用 Ollama CLI
                ollama run {{ apiAccessInfo.modelId }} "Hello!"

                # 或使用 Python
                import ollama
                client = ollama.Client(host="{{ apiAccessInfo.baseUrl }}/ollama")
                response = client.chat(model="{{ apiAccessInfo.modelId }}", messages=[
                {"role": "user", "content": "Hello!"}
                ])</code></pre>
              </div>
            </el-tab-pane>

            <!-- HTTP REST -->
            <el-tab-pane name="http">
              <template #label>
                <div class="tab-label">
                  <el-icon>
                    <Globe />
                  </el-icon>
                  <span>HTTP</span>
                </div>
              </template>
              <div class="code-example">
                <div class="example-header">
                  <span class="lang-badge json">REST API</span>
                  <el-button link size="small" @click="copyProtocolCode('http')">
                    <el-icon>
                      <Copy />
                    </el-icon>
                  </el-button>
                </div>
                <pre><code>POST {{ apiAccessInfo.baseUrl }}/v1/chat/completions
                Content-Type: application/json
                Authorization: Bearer {{ showApiKey ? apiAccessInfo.apiKey : 'sk-***' }}

                {
                "model": "{{ apiAccessInfo.modelId }}",
                "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello!"}
                ],
                "temperature": 0.7,
                "max_tokens": 2048,
                "stream": true
                }</code></pre>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 兼容平台列表 -->
        <div class="compatible-platforms">
          <div class="section-title">
            <el-icon>
              <CheckCircle />
            </el-icon>
            <span>{{ t('floatingChat.compatiblePlatforms') }}</span>
          </div>
          <div class="platform-grid">
            <el-tooltip v-for="p in COMPATIBLE_PLATFORMS" :key="p.id" :content="t(p.tooltip)" placement="top">
              <div class="platform-item">
                <span v-if="p.logo" class="platform-icon-wrap">
                  <img :src="p.logo" :alt="p.name" class="platform-logo" />
                </span>
                <span v-else class="platform-emoji">{{ p.emoji }}</span>
                <span class="platform-name">{{ p.name }}</span>
              </div>
            </el-tooltip>
          </div>
        </div>

        <!-- 注意事项 -->
        <div class="api-notes">
          <el-icon>
            <AlertCircle />
          </el-icon>
          <span>{{ t('floatingChat.apiNotes') }}</span>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="regenerateApiKey" :loading="isGeneratingApiKey">
            <el-icon>
              <RefreshCw />
            </el-icon>
            {{ t('floatingChat.regenerateKey') }}
          </el-button>
          <el-button type="primary" @click="showApiAccessDialog = false">{{ t('common.close') }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 历史记录面板 -->
    <el-drawer v-if="shouldRenderHistoryPanel" v-model="showHistoryPanel" :title="t('floatingChat.history')" direction="rtl" size="400px" @closed="shouldRenderHistoryPanel = false">
      <div class="history-content">
        <div v-if="displayedConversationHistory.length === 0 && !modelChatHistoryLoading" class="empty-history">
          <el-empty :description="t('floatingChat.noHistory')" />
        </div>
        <div v-else-if="modelChatHistoryLoading" class="history-loading">
          <el-icon class="is-loading">
            <Loader2 />
          </el-icon>
          <span>{{ t('floatingChat.loadingHistory') }}</span>
        </div>
        <div v-else class="history-list">
          <div v-for="conversation in displayedConversationHistory" :key="conversation.id" class="history-item"
            :class="{ 'is-active': currentConversationId === conversation.id }"
            @click="loadConversation(conversation.id)">
            <div class="history-title">{{ conversation.title }}</div>
            <div class="history-meta">
              <span class="history-time">{{ formatTime(conversation.createTime) }}</span>
            </div>
            <div class="history-actions" @click.stop>
              <el-button link size="small" @click.stop.prevent="deleteConversationHandler(conversation.id)"
                :title="t('common.delete')">
                <el-icon>
                  <Trash2 />
                </el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- AI能力选择面板 - 重构后的独立组件 -->
    <AICapabilitySelector v-model="showAICapabilityPanel" v-model:current-mode="currentAIModeForSelector"
      v-model:model-category="modelCategoryTabForSelector" v-model:generation-type="currentGenerationTypeForSelector"
      v-model:image-provider="currentImageProvider" v-model:video-provider="currentVideoProvider"
      :selected-model="selectedModelForSelector" :selected-agent="selectedAgent"
      :selected-agentic-swarm-id="selectedAgenticSwarmId" :models="modelsForSelector" :agents="agentsForSelector"
      :mcp-tools="mcpToolsForSelector" :generation-task-id="generationTaskId"
      @select-model="handleModelSelectFromSelector" @select-agent="handleAgentSelectFromSelector"
      @select-agentic="handleAgenticSelect" @select-m-c-p-tool="handleMCPToolSelectFromSelector"
      @open-api-access="handleApiAccessFromSelector" />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, type Component, type ComponentPublicInstance } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useCommunityPublish } from '@/composables/useCommunityPublish'
import { useDarkModeStore } from '@/stores/darkMode'
import { useAuthStore } from '@/stores/auth'
import { streamGenerateContent } from '@/api/ai'
import {
  createQwenWebSocket,
  createQwenOmniWebSocket,
  createZhipuWebSocket,
  createDeepSeekWebSocket,
  createDoubaoWebSocket,
  type ChatStreamEvent,
} from '@/api/services/llmChat.service'
import request, { getUserToken } from '@/utils/request'
import { createAuthWebSocket } from '@/utils/websocket'
import { getAvailableModels } from '@/api/models'
import { getAgentsList } from '@/api/agents'
import { createAgenticSwarm, getSwarmStatus } from '@/api/services/agentic.service'
import {
  generateDashScopeImage,
  generateDashScopeImageToImage,
  editDashScopeImage,
  createDashScopeVideoWebSocket,
  createVideoWebSocketByPath,
  type DashScopeVideoSynthesisRequest,
  submitHunyuan3DTask,
  queryHunyuan3DStatus,
  chatDashScopeVision,
  // 多服务商支持
  generateDoubaoImage,
  generateJimeng4Image,
  identifyKlingVideo,
  createKlingVideo,
  startOneClickVideo,
  getOneClickVideoStatus,
} from '@/api/services/aiGeneration.service'
import { uploadFormFile } from '@/api/file-upload'
import {
  getConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  getConversationMessages,
} from '@/api/chat-history'
import {
  queryChatRecords,
  getChatHistoryMessages,
  deleteChatRecord,
  createChatRecord,
  updateChatMark,
  type ChatRecord,
} from '@/api/services/chatHistory.service'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useUnifiedAI, AICapabilityType } from '@/composables/useUnifiedAI'
import { useFloatingChatEnhancement } from '@/composables/useFloatingChatEnhancement'
import { useAICapabilityDiscovery } from '@/composables/useAICapabilityDiscovery'
import { useMCP } from '@/composables/useMCP'
import { useOpenClaw } from '@/composables/useOpenClaw'
import { useSubViewDropdown } from '@/composables/useSubViewDropdown'
import { StorageManager } from '@/utils/storage'
import MarkdownStream from './MarkdownStream.vue'
import PromptTemplates from './PromptTemplates.vue'
// SearchIcon 已迁移至 ChatSearchBar.vue（chat-parts 拆分）
// VoiceRecordingAnimation 已移除，使用内联波形动画替代
// OpenClaw 集成
import { OpenClawContainer } from './openclaw'
// 子组件：标题栏、会话列表、搜索栏（chat-parts 拆分，降低 AIChat.vue 模板复杂度）
import { ChatHeaderBar, ChatSearchBar } from './chat-parts'
import {
  MemoryPanel,
  SkillsPanel,
  AutomationPanel,
  IntegrationsPanel,
  ModelsPanel,
  VoicePanel,
  CanvasPanel,
  BrowserPanel,
} from './openclaw/panels'
// 图标从 @/lib/lucide-fallback 统一导入，避免重复定义
// AI 能力选择器组件
import { AICapabilitySelector } from './AICapabilitySelector'
import type {
  AICapabilityMode,
  ModelCategory,
  GenerationType,
  MCPTool,
} from './AICapabilitySelector'
import { isMarkdown } from '@/utils/markdown'
import { getDateLabel } from '@/utils/messageGrouping'
import {
  startSpeechRecognition,
  stopSpeechRecognition,
  isSpeechRecognitionSupported,
  configureSpeechService,
  speechManager,
  getAccumulatedText,
  SpeechProvider,
  type SpeechRecognitionError,
} from '@/utils/speech'
import { isInMainlandChina } from '@/composables/useSpeechConfig'
import { logger } from '@/utils/logger'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { getUserUuid } from '@/utils/auth'
import type { AICapabilityRequest } from '@/services/unified-ai-orchestrator'
import type { Agent } from '@/api/agents'
import {
  MessageCircle,
  X,
  User,
  Copy,
  Edit,
  Trash2,
  Star,
  RefreshCw,
  Download,
  Microphone,
  Picture,
  Document,
  Loader2,
  AlertTriangle,
  FileText,
  BarChart3,
  Bot,
  Network,
  Wrench,
  Zap,
  VideoPlay,
  View,
  Sparkles,
  PenTool,
  HelpCircle,
  Code,
  Promotion,
  MicrophoneOff,
  VideoPause,
  Share,
  Key,
  Globe,
  Eye,
  EyeOff,
  Layers,
  Terminal,
  CheckCircle,
  AlertCircle,
  Cpu,
  Brain,
  Plus,
  ArrowDown,
  ArrowLeft,
} from '@/lib/lucide-fallback'
// Settings/MoreHorizontal/Ticket/Headset 已迁移至 ChatHeaderBar.vue（chat-parts 拆分）

// 导入自定义图标（替代默认图标，更精致的设计）
import { AIStarIcon, UploadPlusIcon } from '@/components/icons'
import type { Model } from '@/types/api'
import type { ChatMessage, FileAttachment as PlatformFileAttachment, Timestamp } from '@/types/ai-platform.types'
import { DEFAULT_CUSTOMER_SERVICE_FAQ } from '@/data/customer-service-faq'
import type { SpeechRecognitionCallbacks } from '@/utils/speech/types'
import { ClipboardManager } from '@/utils/clipboard'
import { formatFileSize } from '@/utils/format'
// 兼容平台官方 logo（使用 data URI 避免 build 时解析 @lobehub/icons-static-svg 路径）
const openaiLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2310a37f' d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm4.4945-10.0834v-.0752l-2.02-1.1638a.077.077 0 0 0-.071 0l-5.2777 3.0465V9.2848a4.4998 4.4998 0 0 1 7.3684-3.4537zM2.0108 10.229v5.5782a.0804.0804 0 0 0 .038.0555l2.0152 1.1686v-6.7314a.795.795 0 0 0-.3957-.6813L2.0108 10.229zm16.2594 2.9016l-2.02-1.1638a.0757.0757 0 0 0-.071 0l-5.2777 3.0465v2.4814l5.258-3.0335a.0794.0794 0 0 0 .038-.0542v-1.4102zm-12.6402 4.2294l2.02 1.1686v-2.4842l-2.02-1.1686v2.4842zm9.7842-8.4722a4.4998 4.4998 0 0 1-2.3654 5.9382l.0008-.0046-2.0766 1.1982V9.2848a4.4998 4.4998 0 0 1 4.4412 1.1754z'/%3E%3C/svg%3E"
const cursorLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'/%3E%3C/svg%3E"
const clineLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23543DE0' d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z'/%3E%3C/svg%3E"
const openwebuiLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234F46E5' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/%3E%3C/svg%3E"
const lobehubLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2310B981' d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'/%3E%3C/svg%3E"
const difyLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2325B864' d='M12 2L2 7v10l10 5 10-5V7L12 2z'/%3E%3C/svg%3E"
const fastgptLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23FF6B35' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/%3E%3C/svg%3E"

interface SearchResult {
  id: string
  preview: string
  createTime: string
}

interface FileAttachment {
  id: string
  name: string
  type: string
  preview: string
  size?: number
  uploadedAt?: Timestamp
}

interface AudioDataItem {
  audio_url?: string
  title?: string
  prompt?: string
}

interface ApiResponsePayload {
  data?: AudioDataItem[] | ApiResponsePayload
  content?: string
  text?: string
  message?: string
  result?: string
  image_url?: string | string[]
  image_urls?: string[]
}

interface HistoryMessage {
  role?: string
  content?: string
  create_time?: string
  created_at?: string
  createdAt?: string
  timestamp?: string
  metadata?: Record<string, unknown>
  agent_url?: string
  video_url?: string
  videoUrl?: string
  video_url_list?: string[]
  files?: Array<{ id?: string; name?: string; type?: string; preview?: string; size?: number }>
}

interface OpenClawPanelInstance {
  setPanel?: (panelId: string) => void
}

interface AgentWithVariables {
  variables?: AgentVariable[]
  agentVariables?: AgentVariable[]
  agentId?: string
  id?: string
}

interface AgentVariable {
  key?: string
  name?: string
  value?: string | { value?: string }
  type?: string
}

interface ChatRecordResponse {
  data?: ChatRecord[] | { list?: ChatRecord[]; data?: ChatRecord[] }
  list?: ChatRecord[]
}

// VS Code 官方 logo（Microsoft 官方蓝色 （--el-color-primary），无 LobeHub 包内文件故保留 data URI）
const VSCODE_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23007ACC' d='M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352z'/%3E%3C/svg%3E"
// NextChat 无独立官方图标包，使用通用对话气泡形 data URI
const NEXTCHAT_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2310a37f' d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z'/%3E%3C/svg%3E"
// 兼容平台列表：ChatGPT/Cursor/Cline/Open WebUI/LobeChat/Dify/FastGPT 使用 @lobehub/icons-static-svg 官方风格图标
const COMPATIBLE_PLATFORMS: Array<{ id: string; name: string; tooltip: string; logo: string; emoji: string }> = [
  { id: 'chatgpt', name: 'ChatGPT', tooltip: 'aiChat.platformTooltip.chatgpt', logo: openaiLogo, emoji: '' },
  { id: 'cursor', name: 'Cursor', tooltip: 'aiChat.platformTooltip.cursor', logo: cursorLogo, emoji: '' },
  { id: 'vscode', name: 'VS Code', tooltip: 'aiChat.platformTooltip.vscode', logo: VSCODE_LOGO, emoji: '' },
  { id: 'cline', name: 'Cline', tooltip: 'Cline (Claude Dev)', logo: clineLogo, emoji: '🤖' },
  { id: 'openwebui', name: 'Open WebUI', tooltip: 'aiChat.platformTooltip.openwebui', logo: openwebuiLogo, emoji: '🌐' },
  { id: 'lobechat', name: 'LobeChat', tooltip: 'aiChat.platformTooltip.lobechat', logo: lobehubLogo, emoji: '💬' },
  { id: 'chatbox', name: 'ChatBox', tooltip: 'aiChat.platformTooltip.chatbox', logo: '', emoji: '📦' },
  { id: 'botgem', name: 'BotGem', tooltip: 'aiChat.platformTooltip.botgem', logo: '', emoji: '💎' },
  { id: 'nextchat', name: 'NextChat', tooltip: 'NextChat (ChatGPT-Next-Web)', logo: NEXTCHAT_LOGO, emoji: '⚡' },
  { id: 'jan', name: 'Jan', tooltip: 'aiChat.platformTooltip.jan', logo: '', emoji: '🧠' },
  { id: 'dify', name: 'Dify', tooltip: 'aiChat.platformTooltip.dify', logo: difyLogo, emoji: '🔧' },
  { id: 'fastgpt', name: 'FastGPT', tooltip: 'aiChat.platformTooltip.fastgpt', logo: fastgptLogo, emoji: '🚀' },
]

// 组合式函数
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { showSuccess, showError, showWarning, showInfo } = useOperationFeedback()
const { confirm } = useConfirmDialog()
const darkModeStore = useDarkModeStore()
const authStore = useAuthStore()

// Props
const props = withDefaults(
  defineProps<{
    // 显示模式：floating（悬浮窗）、embedded（内嵌模式，用于替代 AIDialog）
    mode?: 'floating' | 'embedded'
    visible?: boolean
    model?: string
    showToggle?: boolean
    enableVoice?: boolean
    enableFileUpload?: boolean
    enableSearch?: boolean
    showModelSelector?: boolean
    inputPlaceholder?: string
    // embedded 模式额外的 props
    showHeader?: boolean  // 是否显示头部
    showMinimize?: boolean  // 是否显示最小化按钮
    showClose?: boolean  // 是否显示关闭按钮
    draggable?: boolean  // 是否可拖拽
    resizable?: boolean  // 是否可调整大小
    /**
     * 面板标题（用于浮窗 dialog-header 标题）
     */
    dialogTitle: string
    // AI 模式相关 props
    aiMode?: 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'auto' | 'generation'  // 初始 AI 模式
    agentId?: string  // 指定的 Agent ID（用于 Agent 模式）
    // 客服页主题与快捷能力（可与 openFloatingChat({ theme, quickFaqList }) 配合）
    theme?: 'default' | 'custom-service'
    quickFaqList?: Array<{ id: number; question: string; answer: string }>
    showTicketsEntry?: boolean
  }>(),
  {
    mode: 'floating',
    visible: false,
    showToggle: true,
    enableVoice: true,
    enableFileUpload: true,
    enableSearch: true,
    showModelSelector: true,
    // 注意：不能在这里使用 t()，因为 defineProps 会被提升到 setup 外部
    // 使用空字符串作为默认值，在组件内部通过计算属性处理国际化
    inputPlaceholder: '',
    dialogTitle: '',
    // embedded 模式默认值
    showHeader: true,
    showMinimize: true,
    showClose: true,
    draggable: true,
    resizable: true,
    // AI 模式默认值
    aiMode: undefined,
    agentId: undefined,
    theme: 'default',
    quickFaqList: () => [],
    showTicketsEntry: false,
  }
)

// Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'message-sent', message: ChatMessage): void
  (e: 'message-received', message: ChatMessage): void
}>()

// 响应式状态
// 在 floating 模式下，默认显示但最小化；在 embedded 模式下，使用 props.visible
const isVisible = ref(props.mode === 'floating' ? true : props.visible)
const isMinimized = ref(props.mode === 'floating' ? true : false)
const isDragging = ref(false)
const isResizing = ref(false)
const isSending = ref(false)
const isRecording = ref(false)
const isTyping = ref(false)

// 语音录音相关状态
const voiceAudioData = ref<{ audioUrl: string; duration: number } | null>(null) // 录制的音频数据
const isAudioPlaying = ref(false) // 音频是否正在播放
const voiceTranscribing = ref(false) // 语音转文字处理中
const audioPlayerRef = ref<HTMLAudioElement | null>(null) // 音频播放器引用
let mediaRecorder: MediaRecorder | null = null // 媒体录制器
let audioChunks: Blob[] = [] // 音频数据块
let audioStream: MediaStream | null = null // 音频流
const showSearchBar = ref(false)
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const selectedMessageId = ref<string | null>(null)
const editingMessageId = ref<string | null>(null)
const editContent = ref('')
const inputText = ref('')
const replyingToMessageId = ref<string | null>(null)
const quotedMessage = ref<ChatMessage | null>(null)
const showSettingsDialog = ref(false)
const showStatsDialog = ref(false)
const showApiAccessDialog = ref(false)
// v-if 控制：el-dialog 关闭后从 DOM 卸载（含 overlay），避免空 overlay 堆积
const shouldRenderStatsDialog = ref(false)
watch(showStatsDialog, (val) => { if (val) shouldRenderStatsDialog.value = true })
const shouldRenderApiAccessDialog = ref(false)
watch(showApiAccessDialog, (val) => { if (val) shouldRenderApiAccessDialog.value = true })
const showApiKey = ref(false)
const isGeneratingApiKey = ref(false)
const selectedProtocol = ref('openai')
const apiAccessInfo = ref({
  apiKey: '',
  baseUrl: '',
  modelId: '',
  modelName: '',
})
const showHistoryPanel = ref(false)
const shouldRenderHistoryPanel = ref(false)
watch(showHistoryPanel, (val) => { if (val) shouldRenderHistoryPanel.value = true })
const showAICapabilityPanel = ref(false) // AI能力选择面板
const showCapabilityDropdown = ref(false) // 输入区 AI 能力下拉（网格卡片）显隐

// trae-work: 能力下拉子视图状态机（主视图 ↔ 提示词模板子视图）
type CapabilityDropdownView = 'main' | 'prompts'
const {
  currentView: capabilityDropdownView,
  goTo: goToCapabilityView,
  backToMain: backToCapabilityMain,
  closeAndReset: closeCapabilityDropdownAndReset,
  backButtonRef: capabilityBackBtnRef,
} = useSubViewDropdown<CapabilityDropdownView>({
  parentVisible: showCapabilityDropdown,
  mainView: 'main',
})

const showOpenClawPanel = ref(false) // OpenClaw 功能面板
const showOpenClawPopover = ref(false) // OpenClaw 弹出菜单
const openClawActivePanel = ref<string>('') // 当前激活的 OpenClaw 面板
const openClawPanelRef = ref<ComponentPublicInstance | null>(null)

// OpenClaw 工具入口配置（带彩色渐变，图标与快捷菜单 menu-grid 统一为 SVG）
const openClawTools = computed(() => [
  { id: 'memory', name: t('floatingChat.openClawTools.memory'), desc: t('floatingChat.openClawTools.memoryDesc'), color: 'purple' },
  { id: 'voice', name: t('floatingChat.openClawTools.voice'), desc: t('floatingChat.openClawTools.voiceDesc'), color: 'amber' },
  { id: 'canvas', name: t('floatingChat.openClawTools.canvas'), desc: t('floatingChat.openClawTools.canvasDesc'), color: 'blue' },
  { id: 'skills', name: t('floatingChat.openClawTools.skills'), desc: t('floatingChat.openClawTools.skillsDesc'), color: 'green' },
  { id: 'browser', name: t('floatingChat.openClawTools.browser'), desc: t('floatingChat.openClawTools.browserDesc'), color: 'cyan' },
  { id: 'automation', name: t('floatingChat.openClawTools.automation'), desc: t('floatingChat.openClawTools.automationDesc'), color: 'violet' },
  { id: 'models', name: t('floatingChat.openClawTools.models'), desc: t('floatingChat.openClawTools.modelsDesc'), color: 'indigo' },
  { id: 'integrations', name: t('floatingChat.openClawTools.integrations'), desc: t('floatingChat.openClawTools.integrationsDesc'), color: 'rose' },
])

/** 根据 OpenClaw 面板 id 返回展示标题（用于占位子面板） */
const openClawToolTitle = (id: string) => openClawTools.value.find(t => t.id === id)?.name ?? id

/** 根据 OpenClaw 面板 id 返回功能描述（用于占位子面板） */
const _openClawToolDesc = (id: string) => openClawTools.value.find(t => t.id === id)?.desc ?? ''

/** 根据 OpenClaw 面板 id 返回子面板组件 */
const openClawPanelComponent = (id: string): Component | null => {
  const map = {
    memory: MemoryPanel,
    voice: VoicePanel,
    canvas: CanvasPanel,
    skills: SkillsPanel,
    browser: BrowserPanel,
    automation: AutomationPanel,
    models: ModelsPanel,
    integrations: IntegrationsPanel,
  } as Record<string, Component>
  return map[id] ?? null
}

// OpenClaw 仪表板数据（仅当面板为 dashboard 时取值）
let openClawGetDashboard: () => {
  overview: { totalMessages: number; totalTasks: number; activeSkills: number; connectedDevices: number; uptimeHours: number }
  recentActivity: Array<{ id: string; description: string; timestamp: number }>
  topModels: unknown[]
  skillUsage: unknown[]
  errors: unknown[]
  timeline: unknown[]
}
try {
  const openClawApi = useOpenClaw()
  openClawGetDashboard = openClawApi.getDashboard
} catch {
  openClawGetDashboard = () => ({
    overview: { totalMessages: 0, totalTasks: 0, activeSkills: 0, connectedDevices: 0, uptimeHours: 0 },
    recentActivity: [],
    topModels: [],
    skillUsage: [],
    errors: [],
    timeline: [],
  })
}
const openClawDashboard = computed(() =>
  (openClawActivePanel.value === 'dashboard' || openClawActivePanel.value === '')
    ? openClawGetDashboard()
    : null
)
function formatDashboardTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return t('common.justNow')
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} ${t('common.minutes')}`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} ${t('common.hours')}`
  return new Date(timestamp).toLocaleDateString()
}

const showPromptTemplates = ref(false) // 提示词模板面板
const currentAIMode = ref<'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'auto' | 'generation'>('model') // 当前AI模式（auto=智能模式自动决策，UI已移除 generation）

// 客服主题：由 openFloatingChat({ theme, quickFaqList, showTicketsEntry }) 或 props 控制
const floatingTheme = ref<'default' | 'custom-service'>('default')
const floatingQuickFaq = ref<Array<{ id: number; question: string; answer: string }>>([])
const floatingShowTickets = ref(false)
const effectiveTheme = computed(() => props.theme ?? floatingTheme.value)
const isCustomServiceTheme = computed(() => effectiveTheme.value === 'custom-service')
const effectiveQuickFaq = computed(() => {
  const fromProps = props.quickFaqList?.length ? props.quickFaqList : floatingQuickFaq.value
  if (fromProps.length) return fromProps
  return isCustomServiceTheme.value ? DEFAULT_CUSTOMER_SERVICE_FAQ : []
})
const effectiveShowTickets = computed(() => props.showTicketsEntry ?? floatingShowTickets.value)
const csConnectionStatus = ref<'connected' | 'connecting' | 'danger'>('connected')
const csConnectionStatusText = computed(() =>
  csConnectionStatus.value === 'connected' ? 'SECURE_UPLINK' : 'RECONNECTING...'
)
function useQuickFaq(faq: { id: number; question: string; answer: string }) {
  setInputText(faq.question)
  inputText.value = faq.question
  nextTick(() => handleSend())
}

/** 在对话框内切换为客服模式（不跳转页面） */
function switchToCustomerServiceInPlace() {
  floatingTheme.value = 'custom-service'
  floatingQuickFaq.value = DEFAULT_CUSTOMER_SERVICE_FAQ
  floatingShowTickets.value = true
  isVisible.value = true
  isMinimized.value = false
  switchAIMode('agent')
  nextTick(() => inputRef.value?.focus())
}

const currentGenerationType = ref<'image' | 'video' | '3d' | 'vision' | 'audio' | 'music' | 'auto'>('auto') // 当前生成类型
const currentImageProvider = ref<'qwen' | 'doubao' | 'jimeng'>('qwen') // 图像生成服务商
const currentVideoProvider = ref<'qwen' | 'kling' | 'one-click'>('qwen') // 视频生成服务商
const modelCategoryTab = ref<string>('talk') // 模型分类标签（与 AICapabilitySelector 一致：talk=对话）
const generationTaskId = ref<string | null>(null) // 生成任务ID（用于轮询状态）
const generationWebSockets = ref<Map<string, WebSocket>>(new Map()) // 生成任务的WebSocket连接（视频生成等）
const currentModelWebSocket = ref<WebSocket | null>(null) // 当前模型对话的WebSocket连接
const suggestedQuestions = ref<string[]>([]) // 快速问题建议列表
// 常用工具列表
const quickTools = computed(() => [
  { text: t('floatingChat.quickPrompts.explain'), icon: 'HelpCircle' },
  { text: t('floatingChat.quickPrompts.summarize'), icon: 'FileText' },
  { text: t('floatingChat.quickPrompts.translateToEnglish'), icon: 'Globe' },
  { text: t('floatingChat.quickPrompts.write'), icon: 'Edit' },
  { text: t('floatingChat.quickPrompts.optimizeCode'), icon: 'Code' },
  { text: t('floatingChat.quickPrompts.checkErrors'), icon: 'AlertTriangle' },
  { text: t('floatingChat.quickPrompts.generateDoc'), icon: 'Document' },
  { text: t('floatingChat.quickPrompts.analyzeData'), icon: 'BarChart3' },
])
const enableBackendSync = ref(true) // 是否启用后端同步（默认启用）
const selectedAgent = ref<Agent | null>(null) // 选中的Agent
const selectedAgenticSwarmId = ref<string | null>(null) // 选中的Agentic Swarm ID
let scrollThrottleTimer: number | null = null // 滚动节流定时器

// 统一AI能力
const {
  availableAgents: unifiedAgents,
  availableMCPTools: unifiedMCPTools,
  smartInvoke,
  invokeCapability,
} = useUnifiedAI()

// AI能力发现
const {
  discoverCapabilities,
} = useAICapabilityDiscovery()

// MCP工具 - 保留composable初始化以便未来扩展
useMCP()
const uploadedFiles = ref<Array<{ id: string; name: string; type: string; preview: string; size?: number; uploadedAt: Timestamp }>>([])
// 从localStorage加载消息（如果存在）
const initialMessages = StorageManager.getItem<ChatMessage[]>('floating-chat-messages') || []
const messages = ref<ChatMessage[]>(initialMessages)
const unreadCount = ref(0)
const conversationHistory = ref<Array<{ id: string; title: string; messages: ChatMessage[]; createTime: string }>>([])
/** 大模型模式下的历史对话（来自 chatHistory.service，按 model_name 查询） */
const modelChatHistory = ref<Array<{ id: string; title: string; messages: ChatMessage[]; createTime: string; _chatId?: string | number }>>([])
const modelChatHistoryLoading = ref(false)
const currentConversationId = ref<string | null>(null)
const isAutoSave = ref(true)
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 10
const recordingDuration = ref(0)
let recordingTimer: number | null = null
let speechRecognitionCallbacks: SpeechRecognitionCallbacks | null = null

// 对话框位置和大小
const dialogPosition = ref({ x: 100, y: 100 })
const dialogSize = ref({ width: 480, height: 600 })
const minSize = { width: 320, height: 400 }
const maxSize = { width: 1200, height: 800 }
// 最小化状态的位置（null 表示使用默认右下角位置）
const minimizedPosition = ref<{ x: number; y: number } | null>(null)

// 模型相关
const availableModels = ref<Model[]>([])
const selectedModel = ref<Model | null>(null)

// Refs
const dialogRef = ref<HTMLElement | null>(null)
// ChatHeaderBar 子组件实例引用（子组件内部持有根元素 headerRef 并通过 defineExpose 暴露）
interface ChatHeaderBarInstance {
  headerRef: { value: HTMLElement | null }
}
const headerBarRef = ref<ChatHeaderBarInstance | null>(null)
// 通过子组件实例访问标题栏根元素，保持原 headerRef.value 的使用方式
const headerRef = computed(() => headerBarRef.value?.headerRef?.value ?? null)
/** 最小化时由标题栏内容撑开的宽度，供 dialogStyle 使用，避免被 width:auto 覆盖 */
const minimizedDialogWidth = ref(0)
const messagesContainerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLDivElement | null>(null)
const messageRefs = ref<Map<string, HTMLElement>>(new Map())
const quickToolsBarRef = ref<HTMLElement | null>(null)

// 使用增强composable - 提供上下文管理、通知、虚拟滚动等功能
const {
  scrollToBottom,
} = useFloatingChatEnhancement({
  messages,
  // 指定消息滚动容器，确保 scrollToBottom 能正确生效
  containerRef: messagesContainerRef,
  // 输入框引用也传入，方便后续快捷键等能力使用
  inputRef,
  maxTokens: 8000,
  enableContextCompression: true,
})

// 快捷工具栏拖拽滚动状态
const isDraggingToolsBar = ref(false)
const toolsBarStartX = ref(0)
const toolsBarScrollLeft = ref(0)

// 计算属性
const isDarkMode = computed(() => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark')

const dialogStyle = computed(() => {
  // 最小化状态
  if (isMinimized.value) {
    const width = minimizedDialogWidth.value > 0 ? `${minimizedDialogWidth.value}px` : 'auto'
    // 如果有用户拖拽的位置，使用 left/top 定位
    if (minimizedPosition.value) {
      return {
        left: `${minimizedPosition.value.x}px`,
        top: `${minimizedPosition.value.y}px`,
        right: 'auto',
        bottom: 'auto',
        width,
        height: 'auto',
      }
    }
    // 默认使用 right/bottom 定位：与底部按钮同高，且右边缘在「上传文档」按钮左侧留出间距，避免重叠（按钮 right:24px + 宽 44px = 占 68px，故聊天条 right: 80px）
    return {
      left: 'auto',
      top: 'auto',
      right: '80px',
      bottom: '24px',
      width,
      height: 'auto',
    }
  }
  // 非最小化状态：使用 left/top 定位
  return {
    left: `${dialogPosition.value.x}px`,
    top: `${dialogPosition.value.y}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${dialogSize.value.width}px`,
    height: `${dialogSize.value.height}px`,
  }
})

const filteredMessages = computed(() => {
  if (!searchQuery.value) return messages.value
  const query = searchQuery.value.toLowerCase()
  return messages.value.filter(
    (msg) => msg.content.toLowerCase().includes(query) || msg.role.toLowerCase().includes(query)
  )
})

/** 当前展示的历史列表：大模型模式下按所选模型拉取 chatHistory.service 的对话，否则用本地/openclaw 历史 */
const displayedConversationHistory = computed(() => {
  if (currentAIMode.value === 'model' && selectedModel.value) {
    return modelChatHistory.value
  }
  return conversationHistory.value
})

// 发送按钮可发送状态：输入框有内容或已上传文件，且未在发送中
const canSend = computed(() => {
  const text = inputText.value.trim()
  return (text.length > 0 || uploadedFiles.value.length > 0) && !isSending.value
})

// 根据分类标签过滤模型列表 - 预留
const _filteredModelsByCategory = computed(() => {
  const category = modelCategoryTab.value
  return availableModels.value.filter((model) => {
    switch (category) {
      case 'image':
        return model.supportsImages === true
      case 'video':
        return model.supportsVideo === true
      case 'text':
      default:
        // 文本分类显示所有模型（所有模型都支持文本对话）
        return true
    }
  })
})

const _inputPlaceholder = computed(() => {
  return props.inputPlaceholder || t('floatingChat.inputPlaceholder')
})

const dialogTitle = computed(() => {
  return props.dialogTitle || t('floatingChat.title')
})

// AI 消息头像：大模型图标或智能体图标（当前选中的）
const assistantAvatarUrl = computed(() => {
  if (currentAIMode.value === 'model' && selectedModel.value?.icon?.trim()) {
    return selectedModel.value.icon
  }
  if (currentAIMode.value === 'agent' && selectedAgent.value) {
    const a = selectedAgent.value
    return (a.avatar || a.icon || '')?.trim() || null
  }
  return null
})

// 方法
const setMessageRef = (el: HTMLElement | null, id: string) => {
  if (el) {
    messageRefs.value.set(id, el)
  }
}

/** 强制把消息容器滚动到底部（多帧校准，避免过渡/渲染导致 scrollHeight 变化） */
const scrollMessagesToBottomHard = (framesLeft = 10) => {
  const el = messagesContainerRef.value
  if (!el) return

  // 触发 reflow 再读 scrollHeight，避免拿到旧布局
  void el.offsetHeight
  el.scrollTop = el.scrollHeight

  if (framesLeft <= 0) return

  const id = requestAnimationFrame(() => {
    chatRafIds.delete(id)
    const container = messagesContainerRef.value
    if (!container) return
    void container.offsetHeight
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight
    if (remaining > 4) {
      container.scrollTop = container.scrollHeight
    }
    scrollMessagesToBottomHard(framesLeft - 1)
  })
  chatRafIds.add(id)
}

/** 通过最后一条消息 scrollIntoView 滚到底（比直接设 scrollTop 更抗布局/容器变化） */
const scrollToLastMessageIntoView = (framesLeft = 6) => {
  const last = filteredMessages.value[filteredMessages.value.length - 1]
  if (!last) return

  // 优先使用记录的 ref，其次退化到 DOM 查询
  const el =
    messageRefs.value.get(last.id) ||
    (messagesContainerRef.value?.querySelector('.messages-list .message-item:last-child') as HTMLElement | null)

  if (el) {
    try {
      el.scrollIntoView({ block: 'end', behavior: 'auto' })
    } catch {
      // ignore
    }
  }

  if (framesLeft <= 0) return
  const id = requestAnimationFrame(() => {
    chatRafIds.delete(id)
    scrollToLastMessageIntoView(framesLeft - 1)
  })
  chatRafIds.add(id)
}

// 打开浮窗后的短时“自动贴底”：2秒内容器高度变化就再滚到底（应对 Markdown/图片/过渡动画）
let autoStickToBottomTimer: number | null = null
let autoStickToBottomEnabled = false
let messagesResizeObserver: ResizeObserver | null = null
const chatRafIds = new Set<number>()

const startAutoStickToBottom = () => {
  autoStickToBottomEnabled = true

  if (autoStickToBottomTimer !== null) {
    clearTimeout(autoStickToBottomTimer)
  }

  // 初次立即贴底 + 多帧校准（双保险：scrollTop + scrollIntoView）
  scrollMessagesToBottomHard()
  scrollToLastMessageIntoView()

  // 2 秒后关闭自动贴底，避免影响用户手动滚动阅读
  autoStickToBottomTimer = window.setTimeout(() => {
    autoStickToBottomEnabled = false
    autoStickToBottomTimer = null
  }, 2000)

  // 监听容器尺寸变化（Markdown 渲染/图片加载会改变高度）
  if (typeof ResizeObserver !== 'undefined') {
    if (!messagesResizeObserver) {
      messagesResizeObserver = new ResizeObserver(() => {
        if (!autoStickToBottomEnabled || !isVisible.value) return
        // 尺寸变化后再贴一次底，帧数少一点即可
        scrollMessagesToBottomHard(4)
        scrollToLastMessageIntoView(3)
      })
    }
    const el = messagesContainerRef.value
    if (el) {
      try {
        messagesResizeObserver.observe(el)
      } catch {
        // ignore
      }
    }
  }
}

/** 弹窗展开动画结束后调用，此时 DOM 已稳定，再滚到底部 */
const onDialogAfterEnter = () => {
  if (props.mode !== 'floating' || !isVisible.value) return
  nextTick(() => {
    startAutoStickToBottom()
    inputRef.value?.focus()
  })
  // 过渡约 300ms，之后多轮校准应对 Markdown/图片等延迟渲染
  setTimeout(() => {
    scrollMessagesToBottomHard()
    scrollToLastMessageIntoView()
  }, 50)
  setTimeout(() => {
    scrollMessagesToBottomHard()
    scrollToLastMessageIntoView()
  }, 400)
  setTimeout(() => {
    scrollMessagesToBottomHard()
    scrollToLastMessageIntoView()
  }, 800)
}

const openDialog = () => {
  isVisible.value = true
  isMinimized.value = false
  unreadCount.value = 0
  emit('update:visible', true)
  nextTick(() => {
    // 立即尝试贴底（内嵌模式或 transition 被禁用时依赖此处）
    startAutoStickToBottom()
    inputRef.value?.focus()
  })
  // 悬浮模式主要依赖 @after-enter；此处延迟作为兜底
  setTimeout(() => {
    scrollMessagesToBottomHard()
    scrollToLastMessageIntoView()
  }, 400)
  setTimeout(() => {
    scrollMessagesToBottomHard()
    scrollToLastMessageIntoView()
  }, 800)
}

const closeDialog = () => {
  isVisible.value = false
  emit('update:visible', false)
  emit('close')
}

// 保存最小化前的位置（用于恢复）
let preMinimizePosition = { x: 0, y: 0 }

const toggleMinimize = () => {
  if (!isMinimized.value) {
    // 最小化：保存当前位置
    preMinimizePosition = { ...dialogPosition.value }

    // 重置最小化位置，让其回到默认右下角
    minimizedPosition.value = null

    // 启用过渡动画
    if (dialogRef.value) {
      dialogRef.value.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }

    isMinimized.value = true

    // 动画结束后移除过渡（最小化位置由 CSS right/bottom 控制）
    setTimeout(() => {
      if (dialogRef.value) {
        dialogRef.value.style.transition = ''
      }
    }, 300)
  } else {
    // 恢复：启用过渡动画，返回原位置
    if (dialogRef.value) {
      dialogRef.value.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      // 如果是从自定义位置恢复，需要先设置当前位置为起点
      if (minimizedPosition.value) {
        dialogRef.value.style.left = `${minimizedPosition.value.x}px`
        dialogRef.value.style.top = `${minimizedPosition.value.y}px`
        dialogRef.value.style.right = 'auto'
        dialogRef.value.style.bottom = 'auto'
      }
    }

    dialogPosition.value = { ...preMinimizePosition }
    isMinimized.value = false

    // 重置最小化位置
    minimizedPosition.value = null

    nextTick(() => {
      // 展开后消息区域变为可见，立即滚到底部（多帧 + 延迟兜底，与打开浮窗逻辑一致）
      scrollMessagesToBottomHard()
      scrollToLastMessageIntoView()
      startAutoStickToBottom()
      inputRef.value?.focus()

      // 动画约 300ms 结束后再校准滚动，并移除过渡
      setTimeout(() => {
        if (dialogRef.value) {
          dialogRef.value.style.transition = ''
        }
        scrollMessagesToBottomHard(6)
        scrollToLastMessageIntoView(3)
      }, 350)
      setTimeout(() => {
        scrollMessagesToBottomHard(4)
        scrollToLastMessageIntoView(2)
      }, 600)
    })
  }
}

// 最小化时对话框无可见子元素会塌成竖线，将对话框宽度同步为标题栏（内容）宽度；用 ref 写入 dialogStyle 避免被 :style 覆盖
let minimizedWidthObserver: ResizeObserver | null = null
function syncMinimizedDialogWidth() {
  if (!isMinimized.value || props.mode !== 'floating' || !headerRef.value) return
  const el = headerRef.value
  // 用 scrollWidth 包含溢出内容，避免图标被裁切；取与 offsetWidth 较大值并加少量余量
  const w = Math.max(el.offsetWidth, el.scrollWidth) + 4
  if (w > 0) minimizedDialogWidth.value = w
}
watch(isMinimized, (minimized) => {
  if (minimized && props.mode === 'floating') {
    minimizedDialogWidth.value = 0
    nextTick(() => {
      syncMinimizedDialogWidth()
      if (headerRef.value) {
        minimizedWidthObserver = new ResizeObserver(() => syncMinimizedDialogWidth())
        minimizedWidthObserver.observe(headerRef.value!)
      }
      // 多帧延迟再同步，确保标题栏 width:max-content 已计算（头像/字体可能晚渲染）
      const id1 = requestAnimationFrame(() => {
        chatRafIds.delete(id1)
        syncMinimizedDialogWidth()
        const id2 = requestAnimationFrame(() => {
          chatRafIds.delete(id2)
          syncMinimizedDialogWidth()
        })
        chatRafIds.add(id2)
      })
      chatRafIds.add(id1)
      setTimeout(syncMinimizedDialogWidth, 100)
    })
  } else {
    minimizedDialogWidth.value = 0
    if (minimizedWidthObserver) {
      minimizedWidthObserver.disconnect()
      minimizedWidthObserver = null
    }
  }
}, { immediate: true })

const toggleSearch = () => {
  showSearchBar.value = !showSearchBar.value
  if (!showSearchBar.value) {
    searchQuery.value = ''
    searchResults.value = []
  }
}

const handleSearch = () => {
  if (!searchQuery.value) {
    searchResults.value = []
    return
  }
  const query = searchQuery.value.toLowerCase()
  searchResults.value = messages.value
    .filter((msg) => msg.content.toLowerCase().includes(query))
    .map((msg) => ({
      id: msg.id,
      preview: msg.content.substring(0, 100),
      createTime: String(msg.createTime),
    }))
}

const scrollToMessage = (messageId: string) => {
  if (!messageId) return

  const element = messageRefs.value.get(messageId)
  if (element && messagesContainerRef.value) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    selectedMessageId.value = messageId
    setTimeout(() => {
      selectedMessageId.value = null
    }, 2000)
  } else {
    showWarning(t('floatingChat.messageNotFound'))
  }
}


// 处理引用消息点击
const handleQuoteClick = (message: ChatMessage) => {
  if (message.replyTo) {
    scrollToMessage(message.replyTo)
  }
}

// 拖拽功能 - 性能优化版本
let dragStartPos = { x: 0, y: 0 }
let dragStartDialogPos = { x: 0, y: 0 }
let rafId: number | null = null
let pendingPosition = { x: 0, y: 0 }

const startDrag = (e: MouseEvent) => {
  // 如果正在调整大小，不启动拖拽
  if (isResizing.value) return

  // 检查点击的目标元素，如果是按钮或按钮的子元素，不启动拖拽
  const target = e.target as HTMLElement
  if (target.closest('.header-btn') || target.closest('.el-button') || target.closest('.el-dropdown')) {
    return
  }

  isDragging.value = true
  dragStartPos = { x: e.clientX, y: e.clientY }

  // 最小化状态下：需要从实际 DOM 位置计算 left/top（因为使用的是 right/bottom 定位）
  if (isMinimized.value && dialogRef.value) {
    const rect = dialogRef.value.getBoundingClientRect()
    dragStartDialogPos = { x: rect.left, y: rect.top }
    // 立即更新 minimizedPosition，这样 Vue 的 dialogStyle 会切换到 left/top 定位
    minimizedPosition.value = { x: rect.left, y: rect.top }
  } else {
    dragStartDialogPos = { ...dialogPosition.value }
  }
  pendingPosition = { ...dragStartDialogPos }

  // 禁用过渡动画以提高拖拽性能
  if (dialogRef.value) {
    dialogRef.value.style.transition = 'none'
  }
  if (isMinimized.value && headerRef.value) {
    headerRef.value.style.transition = 'none'
  }

  document.addEventListener('mousemove', handleDrag, { passive: true })
  document.addEventListener('mouseup', stopDrag, { passive: true })
  e.preventDefault()
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return

  const deltaX = e.clientX - dragStartPos.x
  const deltaY = e.clientY - dragStartPos.y

  // 获取实际的对话框尺寸（最小化时使用实际DOM尺寸）
  const actualWidth = dialogRef.value?.offsetWidth || dialogSize.value.width
  const actualHeight = dialogRef.value?.offsetHeight || dialogSize.value.height

  // 计算新位置
  const newX = Math.max(0, Math.min(window.innerWidth - actualWidth, dragStartDialogPos.x + deltaX))
  const newY = Math.max(0, Math.min(window.innerHeight - actualHeight, dragStartDialogPos.y + deltaY))

  pendingPosition = { x: newX, y: newY }

  // 使用 requestAnimationFrame 优化性能，避免频繁更新
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      if (dialogRef.value && isDragging.value) {
        // 直接操作 DOM 的 left/top
        dialogRef.value.style.left = `${pendingPosition.x}px`
        dialogRef.value.style.top = `${pendingPosition.y}px`
        // 最小化时同步 minimizedPosition，标题栏在 dialog 内会随动
        if (isMinimized.value) {
          minimizedPosition.value = { x: pendingPosition.x, y: pendingPosition.y }
        }
      }
      rafId = null
    })
  }
}

const stopDrag = () => {
  if (!isDragging.value) return

  // 取消待处理的动画帧
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  // 更新响应式数据
  if (isMinimized.value) {
    // 最小化状态：更新最小化位置
    minimizedPosition.value = { ...pendingPosition }
    // 恢复自适应宽高
    if (dialogRef.value) {
      dialogRef.value.style.width = 'auto'
      dialogRef.value.style.height = 'auto'
    }
  } else {
    // 非最小化状态：更新普通位置
    dialogPosition.value = { ...pendingPosition }
  }

  // 恢复过渡动画
  if (dialogRef.value) {
    dialogRef.value.style.transition = ''
    dialogRef.value.style.transform = ''
  }
  if (headerRef.value) {
    headerRef.value.style.transition = ''
  }

  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 边缘调整大小功能 - 性能优化版本
let resizeStartPos = { x: 0, y: 0 }
let resizeStartSize = { width: 0, height: 0 }
let resizeStartPosition = { x: 0, y: 0 }
let resizeDirection = ''
let resizeRafId: number | null = null
let pendingResize = { width: 0, height: 0, x: 0, y: 0 }

// 边缘检测阈值（像素）
const EDGE_THRESHOLD = 6

// 根据鼠标位置获取调整方向
const getResizeDirectionFromPosition = (e: MouseEvent): string | null => {
  if (!dialogRef.value || isMinimized.value || props.mode !== 'floating') return null

  const rect = dialogRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const width = rect.width
  const height = rect.height

  // 检查是否在边缘区域
  const isTop = y < EDGE_THRESHOLD
  const isBottom = y > height - EDGE_THRESHOLD
  const isLeft = x < EDGE_THRESHOLD
  const isRight = x > width - EDGE_THRESHOLD

  if (isTop && isLeft) return 'top-left'
  if (isTop && isRight) return 'top-right'
  if (isBottom && isLeft) return 'bottom-left'
  if (isBottom && isRight) return 'bottom-right'
  if (isTop) return 'top'
  if (isBottom) return 'bottom'
  if (isLeft) return 'left'
  if (isRight) return 'right'

  return null
}

// 处理对话框鼠标移动 - 设置光标样式
const handleDialogMouseMove = (e: MouseEvent) => {
  if (isResizing.value || isDragging.value) return

  const direction = getResizeDirectionFromPosition(e)
  if (!dialogRef.value) return

  const cursorMap: Record<string, string> = {
    'top': 'ns-resize',
    'bottom': 'ns-resize',
    'left': 'ew-resize',
    'right': 'ew-resize',
    'top-left': 'nwse-resize',
    'top-right': 'nesw-resize',
    'bottom-left': 'nesw-resize',
    'bottom-right': 'nwse-resize'
  }

  dialogRef.value.style.cursor = direction ? cursorMap[direction] : ''
}

// 处理对话框鼠标按下 - 最小化时整条可拖拽，非最小化时仅边缘调整大小
const handleDialogMouseDown = (e: MouseEvent) => {
  // 如果点击的是标题栏或其他可交互元素，不处理（标题栏自有 @mousedown 触发 startDrag）
  if ((e.target as HTMLElement).closest('.dialog-header') ||
    (e.target as HTMLElement).closest('.resize-corner') ||
    (e.target as HTMLElement).closest('button') ||
    (e.target as HTMLElement).closest('input') ||
    (e.target as HTMLElement).closest('textarea')) {
    return
  }

  // 最小化时点击白框（未点到标题栏）也启动拖拽，否则只有点到标题栏才能拖
  if (isMinimized.value && props.draggable && props.mode === 'floating') {
    e.preventDefault()
    e.stopPropagation()
    startDrag(e)
    return
  }

  const direction = getResizeDirectionFromPosition(e)
  if (direction) {
    e.preventDefault()
    e.stopPropagation()
    startEdgeResize(e, direction)
  }
}

const startEdgeResize = (e: MouseEvent, direction: string) => {
  if (isMinimized.value) return
  // 阻止拖拽移动事件
  if (isDragging.value) {
    stopDrag()
  }
  isResizing.value = true
  resizeDirection = direction
  resizeStartPos = { x: e.clientX, y: e.clientY }
  resizeStartSize = { ...dialogSize.value }
  resizeStartPosition = { ...dialogPosition.value }
  pendingResize = { width: resizeStartSize.width, height: resizeStartSize.height, x: resizeStartPosition.x, y: resizeStartPosition.y }

  // 禁用过渡动画以提高调整大小性能
  if (dialogRef.value) {
    dialogRef.value.style.transition = 'none'
  }

  document.addEventListener('mousemove', handleEdgeResize, { passive: false })
  document.addEventListener('mouseup', stopEdgeResize, { passive: false })
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
}

const handleEdgeResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  e.preventDefault()
  e.stopPropagation()

  const deltaX = e.clientX - resizeStartPos.x
  const deltaY = e.clientY - resizeStartPos.y

  let newWidth = resizeStartSize.width
  let newHeight = resizeStartSize.height
  let newX = resizeStartPosition.x
  let newY = resizeStartPosition.y

  // 根据拖拽方向调整尺寸和位置
  if (resizeDirection.includes('right')) {
    newWidth = Math.max(minSize.width, Math.min(maxSize.width, resizeStartSize.width + deltaX))
  }
  if (resizeDirection.includes('left')) {
    const widthDelta = resizeStartSize.width - Math.max(minSize.width, Math.min(maxSize.width, resizeStartSize.width - deltaX))
    newWidth = Math.max(minSize.width, Math.min(maxSize.width, resizeStartSize.width - deltaX))
    newX = resizeStartPosition.x + widthDelta
  }
  if (resizeDirection.includes('bottom')) {
    newHeight = Math.max(minSize.height, Math.min(maxSize.height, resizeStartSize.height + deltaY))
  }
  if (resizeDirection.includes('top')) {
    const heightDelta = resizeStartSize.height - Math.max(minSize.height, Math.min(maxSize.height, resizeStartSize.height - deltaY))
    newHeight = Math.max(minSize.height, Math.min(maxSize.height, resizeStartSize.height - deltaY))
    newY = resizeStartPosition.y + heightDelta
  }

  // 确保位置不超出屏幕边界
  newX = Math.max(0, Math.min(window.innerWidth - newWidth, newX))
  newY = Math.max(0, Math.min(window.innerHeight - newHeight, newY))

  pendingResize = { width: newWidth, height: newHeight, x: newX, y: newY }

  // 使用 requestAnimationFrame 优化性能，避免频繁更新
  if (resizeRafId === null) {
    resizeRafId = requestAnimationFrame(() => {
      if (dialogRef.value && isResizing.value) {
        // 直接操作 DOM，避免触发 Vue 响应式更新
        dialogRef.value.style.width = `${pendingResize.width}px`
        dialogRef.value.style.height = `${pendingResize.height}px`
        dialogRef.value.style.left = `${pendingResize.x}px`
        dialogRef.value.style.top = `${pendingResize.y}px`
      }
      resizeRafId = null
    })
  }
}

const stopEdgeResize = (e?: MouseEvent) => {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  // 取消待处理的动画帧
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }

  // 更新响应式数据
  dialogSize.value = { width: pendingResize.width, height: pendingResize.height }
  dialogPosition.value = { x: pendingResize.x, y: pendingResize.y }

  // 恢复过渡动画
  if (dialogRef.value) {
    dialogRef.value.style.transition = ''
  }

  isResizing.value = false
  resizeDirection = ''
  document.removeEventListener('mousemove', handleEdgeResize)
  document.removeEventListener('mouseup', stopEdgeResize)
}

// 消息处理 - 增强功能
const formatTime = (time: string) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('floatingChat.justNow')
  if (minutes < 60) return t('floatingChat.minutesAgo', { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('floatingChat.hoursAgo', { hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('floatingChat.daysAgo', { days })
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const getDateLabelForMessage = (time: string) => {
  return getDateLabel(new Date(time).getTime())
}

const shouldShowDateSeparator = (index: number) => {
  if (index === 0) return true
  const current = new Date(filteredMessages.value[index].createTime)
  const previous = new Date(filteredMessages.value[index - 1].createTime)
  return current.toDateString() !== previous.toDateString()
}

const formatMessage = (content: string) => {
  const html = marked(content) as string
  return DOMPurify.sanitize(html)
}

// 大模型/智能体富内容（与 ai_index2/ai_assistant 一致）
const assistantContentVisibilityMap = ref<Record<string, boolean>>({})
const thinkingVisibilityMap = ref<Record<string, boolean>>({})

const formatTokensForMessage = (tokens: number) => {
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K'
  return String(tokens)
}

const getAssistantContentVisible = (message: ChatMessage) => {
  const key = message.id
  if (assistantContentVisibilityMap.value[key] === undefined) return true
  return assistantContentVisibilityMap.value[key]
}

const toggleAssistantContentVisibility = (message: ChatMessage) => {
  const key = message.id
  const visible = getAssistantContentVisible(message)
  assistantContentVisibilityMap.value = {
    ...assistantContentVisibilityMap.value,
    [key]: !visible
  }
}

const getAssistantThinkingContent = (message: ChatMessage) => message.metadata?.thinkingContent ?? null

const isThinkingVisible = (message: ChatMessage) => thinkingVisibilityMap.value[message.id] ?? false

const toggleThinkingVisibility = (message: ChatMessage) => {
  const key = message.id
  thinkingVisibilityMap.value = {
    ...thinkingVisibilityMap.value,
    [key]: !(thinkingVisibilityMap.value[key] ?? false)
  }
}

const formatThinkingContent = (content: string) => {
  const html = marked(content) as string
  return DOMPurify.sanitize(html)
}

const getAssistantImages = (message: ChatMessage) => {
  const list = message.metadata?.imgUrlList
  return Array.isArray(list) ? list : []
}

const getAssistantVideos = (message: ChatMessage) => {
  const single = message.metadata?.videoUrl
  const list = message.metadata?.videoUrlList
  if (single) return [single]
  return Array.isArray(list) ? list : []
}

const downloadAssistantImages = (message: ChatMessage) => {
  const urls = getAssistantImages(message)
  if (urls.length === 0) return
  urls.forEach((url, idx) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `image_${message.id}_${idx}.png`
    link.target = '_blank'
    link.click()
  })
  showSuccess(t('floatingChat.downloadSuccess'))
}

/** 将 API 响应中的大模型/智能体富内容映射到消息 metadata（与 ai_index2/ai_assistant 一致） */
const mapResponseToAssistantMetadata = (data: Record<string, unknown>, msg: ChatMessage) => {
  if (!msg.metadata) msg.metadata = {}
  const m = msg.metadata as Record<string, unknown>
  if (Array.isArray(data.imgUrlList)) m.imgUrlList = data.imgUrlList as string[]
  if (typeof data.videoUrl === 'string') m.videoUrl = data.videoUrl
  if (Array.isArray(data.videoUrlList)) m.videoUrlList = data.videoUrlList as string[]
  if (typeof data.audioUrl === 'string') m.audioUrl = data.audioUrl
  if (typeof data.thinkingContent === 'string') m.thinkingContent = data.thinkingContent
  if (typeof data.total_tokens === 'number') m.total_tokens = data.total_tokens
  if (typeof data.agent === 'string') m.agent = data.agent
  if (typeof data.agent_avatar === 'string' && data.agent_avatar.trim()) m.agent_avatar = data.agent_avatar.trim()
}

const shareAssistantMessage = (message: ChatMessage) => {
  const content = message.content
  const prevUser = filteredMessages.value.find((m, i) => {
    const next = filteredMessages.value[i + 1]
    return next?.id === message.id && m.role === 'user'
  })
  const question = prevUser?.content ?? ''
  const text = question ? `${question}\n\n${content}` : content
  if (navigator.share) {
    navigator.share({
      title: question || t('floatingChat.aiReply'),
      text
    }).then(() => showSuccess(t('floatingChat.shareSuccess')))
      .catch((err) => { if (err.name !== 'AbortError') logger.warn('Share failed:', err) })
  } else {
    ClipboardManager.copy(text).then((result) => {
      if (result.success) showSuccess(t('floatingChat.copied'))
      else showError(t('floatingChat.copyFailed'))
    }).catch((e) => { console.error(e) })
  }
}

const checkIsMarkdown = (content: string) => {
  // Suno 历史反显等场景会生成带 <audio> 的 HTML，需要按 Markdown/HTML 渲染
  if (typeof content === 'string' && content.includes('<audio')) {
    return true
  }
  return isMarkdown(content)
}

/**
 * 将 vision/多模态 API 返回的结构化内容拆解为可读文本+图片（如 [{"text":"..."},{"image_url":{"url":"..."}}]）
 * 若解析失败或非数组则返回原内容
 */
const normalizeStructuredContent = (content: string): string => {
  if (!content || typeof content !== 'string') return content
  const trimmed = content.trim()

  // 1) Suno / 音乐 JSON：{ code,msg,data:[{ audio_url, title, prompt, ... }] }
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed) as AudioDataItem[] | { data?: AudioDataItem[] }

      const parsedWithData = parsed as { data?: AudioDataItem[] }
      if (parsedWithData && Array.isArray(parsedWithData.data) && parsedWithData.data.length > 0) {
        const first = parsedWithData.data[0]
        if (first && typeof first === 'object' && 'audio_url' in first) {
          const audioUrl = first.audio_url
          const title = first.title || ''
          const prompt = first.prompt || ''
          let result = ''
          if (title) result += `**${title}**\n\n`
          if (audioUrl) result += `<audio controls src="${audioUrl}"></audio>`
          if (prompt) result += `\n\n${prompt}`
          if (result) return result
        }
      }

      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsedWithData.data) ? parsedWithData.data : null
      if (arr && Array.isArray(arr)) {
        const first = arr[0]
        if (first && typeof first === 'object' && 'audio_url' in first) {
          const audioUrl = first.audio_url
          const title = first.title || ''
          const prompt = first.prompt || ''
          let result = ''
          if (title) result += `**${title}**\n\n`
          if (audioUrl) result += `<audio controls src="${audioUrl}"></audio>`
          if (prompt) result += `\n\n${prompt}`
          if (result) return result
        }
      }

      // 2) 视觉/多模态数组结构：[{text}, {image_url}]
      if (Array.isArray(parsed)) {
        const parts: string[] = []
        for (const item of parsed) {
          if (item == null || typeof item !== 'object') continue
          const obj = item as Record<string, unknown>
          const text = (obj.text ?? obj.content) as string | undefined
          if (typeof text === 'string' && text) parts.push(text)
          const imageUrl =
            (obj.image_url as { url?: string } | undefined)?.url ??
            (typeof obj.image_url === 'string' ? obj.image_url : null) ??
            (typeof obj.url === 'string' ? obj.url : null)
          if (imageUrl) parts.push(`\n\n![image](${imageUrl})\n\n`)
        }
        if (parts.length) return parts.join('\n\n')
      }
    } catch {
      // 非完整 JSON（如流式截断），返回原内容由后续按文本/代码显示
      return content
    }
  }

  return content
}

/** 助手消息用于展示的正文：先做结构化拆解，再按 Markdown/纯文本渲染 */
const getAssistantDisplayContent = (message: ChatMessage): string => {
  const raw = message.content != null ? String(message.content) : ''
  const normalized = normalizeStructuredContent(raw)
  return normalized
}

// scrollToBottom 已在上方定义，这里删除重复定义

// 滚动处理 - 增强功能
const handleScroll = () => {
  if (!messagesContainerRef.value) return

  const container = messagesContainerRef.value
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight

  // 检测是否滚动到底部（允许10px误差）
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 10

  // 如果滚动到底部，可以在这里触发自动加载更多消息等功能
  if (isAtBottom) {
    // 可以在这里实现加载历史消息的逻辑
  }
}

// 获取输入框文本内容
const getInputText = (): string => {
  if (inputRef.value) {
    return inputRef.value.innerText || inputRef.value.textContent || ''
  }
  return ''
}

// 获取用于发送的消息内容：排除输入框内智能体标签的显示文本，只保留用户输入
const getInputTextForSend = (): string => {
  if (!inputRef.value) return ''
  const clone = inputRef.value.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.chat-input-agent-tag').forEach(el => el.remove())
  return (clone.innerText || clone.textContent || '').trim()
}

// 设置输入框文本内容
const setInputText = (text: string) => {
  if (inputRef.value) {
    inputRef.value.textContent = text
    handleInputChange()
  }
}

// 在输入框内插入智能体名称标签（带描边、可选头像与可关闭 X，使用全局样式 .chat-input-agent-tag）
const setAgentTagInInput = (agentName: string, avatar?: string) => {
  if (!inputRef.value || !agentName.trim()) return
  inputRef.value.innerHTML = ''
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.className = 'chat-input-agent-tag'
  if (avatar && avatar.trim()) {
    const img = document.createElement('img')
    img.src = avatar.trim()
    img.alt = ''
    img.className = 'chat-input-agent-tag__avatar'
    span.appendChild(img)
  }
  const textSpan = document.createElement('span')
  textSpan.className = 'chat-input-agent-tag__text'
  textSpan.textContent = agentName.trim()
  span.appendChild(textSpan)
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'chat-input-agent-tag__close'
  closeBtn.setAttribute('aria-label', t('common.close'))
  closeBtn.textContent = '×'
  span.appendChild(closeBtn)
  inputRef.value.appendChild(span)
  const trailingSpace = document.createTextNode('\u00A0')
  inputRef.value.appendChild(trailingSpace)
  handleInputChange()
  // 将光标移到标签后面，便于用户直接输入
  nextTick(() => {
    if (!inputRef.value) return
    inputRef.value.focus()
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.setStart(trailingSpace, 0)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  })
}

// 输入区域点击事件：用于智能体标签关闭按钮（事件委托）
const onChatInputContainerClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target?.closest?.('.chat-input-agent-tag__close')) {
    const tag = target.closest('.chat-input-agent-tag')
    if (tag && inputRef.value) {
      tag.remove()
      selectedAgent.value = null
      handleInputChange()
    }
  }
}

// 输入处理
const handleInputChange = () => {
  if (inputRef.value) {
    // 更新 inputText 的值
    inputText.value = getInputText()

    // 自动调整高度
    inputRef.value.style.height = 'auto'
    inputRef.value.style.height = `${Math.min(inputRef.value.scrollHeight, 200)}px`
  }
}

// 处理粘贴事件（移除格式，只保留纯文本）
const handlePaste = (e: ClipboardEvent) => {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') || ''
  if (inputRef.value) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const textNode = document.createTextNode(text)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      inputRef.value.textContent = (inputRef.value.textContent || '') + text
    }
    handleInputChange()
  }
}

const handleShiftEnter = () => {
  // contenteditable div 中 Shift+Enter 会自动插入换行，不需要特殊处理
  handleInputChange()
}

// 文件处理 - 增强功能
const handleFileUpload = async (command: string) => {
  if (uploadedFiles.value.length >= MAX_FILES) {
    showWarning(t('floatingChat.maxFilesReached', { max: MAX_FILES }))
    return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true

  // 根据命令设置接受的文件类型
  switch (command) {
    case 'image':
      input.accept = 'image/*'
      break
    case 'file':
      input.accept = '*/*'
      break
    default:
      input.accept = '*/*'
  }

  input.onchange = (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || [])

    // 检查文件数量
    if (uploadedFiles.value.length + files.length > MAX_FILES) {
      showWarning(t('floatingChat.maxFilesReached', { max: MAX_FILES }))
      return
    }

    // 处理每个文件
    files.forEach((file) => {
      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        showError(t('floatingChat.fileTooLarge', { name: file.name, max: '10MB' }))
        return
      }

      // 检查文件类型
      if (command === 'image' && !file.type.startsWith('image/')) {
        showError(t('floatingChat.invalidFileType', { name: file.name, type: t('common.image') }))
        return
      }

      const reader = new FileReader()
      reader.onerror = () => {
        showError(t('floatingChat.fileReadFailed', { name: file.name }))
      }
      reader.onload = (event) => {
        uploadedFiles.value.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          type: file.type,
          preview: event.target?.result as string,
          size: file.size,
          uploadedAt: Date.now(),
        })
      }
      reader.readAsDataURL(file)
    })
  }
  input.click()
}

const removeFile = (index: number) => {
  const file = uploadedFiles.value[index]
  if (file && file.preview && file.preview.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(file.preview)
    } catch (error) {
      // 忽略错误（可能是URL已被撤销）
      if (import.meta.env.DEV) {
        logger.debug(t('common.errors.operationFailed'), error)
      }
    }
  }
  uploadedFiles.value.splice(index, 1)
}

// 下载文件
const downloadFile = (file: { name: string; preview: string; type?: string }) => {
  try {
    const link = document.createElement('a')
    link.href = file.preview
    link.download = file.name
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showSuccess(t('floatingChat.fileDownloaded', { name: file.name }))
  } catch (error) {
    logger.error(t('common.errors.downloadFailed'), error)
    showError(t('floatingChat.fileDownloadFailed'))
  }
}

// 语音识别服务初始化
const initializeSpeechService = async () => {
  try {
    // 检测网络环境
    const inChina = await isInMainlandChina()
    logger.info('[VoiceInput] Network environment detection:', inChina ? 'Mainland China' : 'Overseas')

    // 强制使用百度语音优先（国内环境更稳定）
    // Web Speech API 依赖 Google 服务，在国内不可用
    const fallbackOrder: SpeechProvider[] = [SpeechProvider.BAIDU, SpeechProvider.WHISPER, SpeechProvider.WEB_SPEECH]

    // Whisper 配置（开源免费，需要后端服务）
    const whisperEndpoint = import.meta.env.VITE_WHISPER_API_ENDPOINT

    configureSpeechService({
      // 百度语音（推荐国内使用）
      // 只需在 .env 中配置 VITE_BAIDU_SPEECH_* 环境变量即可
      // Secret Key 由 Vite 插件在服务端处理，不会暴露到前端
      baidu: {
        appId: import.meta.env.VITE_BAIDU_SPEECH_APP_ID || 'browser',
        apiKey: '', // 由 Vite 插件处理
        secretKey: '', // 由 Vite 插件处理
        endpoint: '/api/speech/baidu/asr/json',
        tokenEndpoint: '/api/speech/baidu/token',
      },
      // Whisper 开源免费语音识别（需要部署后端）
      whisper: whisperEndpoint ? {
        apiKey: 'browser', // 浏览器模式不需要真实API密钥
        mode: 'api',
        modelSize: 'base',
        apiEndpoint: whisperEndpoint,
        language: 'zh',
      } : undefined,
      fallbackOrder,
    })

    logger.info('[VoiceInput] Voice service initialized, fallback order:', fallbackOrder)

    // 预检查百度语音可用性
    setTimeout(async () => {
      try {
        const status = speechManager.getProviderStatus()
        logger.info('[VoiceInput] Voice provider status:', status)
      } catch (e) {
        logger.warn('[VoiceInput] Status check failed:', e)
      }
    }, 1000)
  } catch (error) {
    logger.warn('[VoiceInput] Voice service initialization failed:', error)
  }
}

// 格式化录音时长
const formatRecordingDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 音频播放控制
const toggleAudioPlayback = () => {
  if (!audioPlayerRef.value) return

  if (isAudioPlaying.value) {
    audioPlayerRef.value.pause()
    isAudioPlaying.value = false
  } else {
    audioPlayerRef.value.play()
    isAudioPlaying.value = true
  }
}

const onAudioEnded = () => {
  isAudioPlaying.value = false
}

const onAudioTimeUpdate = () => {
  // 可以用于更新播放进度条
}

// 清除录制的音频
const clearVoiceAudio = () => {
  if (audioPlayerRef.value) {
    audioPlayerRef.value.pause()
  }
  if (voiceAudioData.value?.audioUrl) {
    URL.revokeObjectURL(voiceAudioData.value.audioUrl)
  }
  voiceAudioData.value = null
  isAudioPlaying.value = false
  voiceTranscribing.value = false
}

// 语音输入 - 完整实现
const toggleVoice = async () => {
  if (isRecording.value) {
    stopVoiceRecording()
  } else {
    // 如果有之前的录音，先清除
    if (voiceAudioData.value) {
      clearVoiceAudio()
    }
    await startVoiceRecording()
  }
}

const startVoiceRecording = async () => {
  // 先设置视觉状态，让用户看到反馈
  isRecording.value = true
  recordingDuration.value = 0
  audioChunks = []

  // 检查浏览器支持
  const isSupported = isSpeechRecognitionSupported()

  if (!isSupported) {
    // 延迟一下让用户看到按钮被点击了
    setTimeout(() => {
      isRecording.value = false
      showError(t('floatingChat.voiceNotSupported'))
    }, 300)
    return
  }

  try {
    // 获取麦克风权限并开始录制音频
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(audioStream)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      // 创建音频 Blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      const audioUrl = URL.createObjectURL(audioBlob)

      // 保存录音数据
      voiceAudioData.value = {
        audioUrl,
        duration: recordingDuration.value
      }

      // 清理
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop())
        audioStream = null
      }
    }

    // 开始录制
    mediaRecorder.start()

    // 启动计时器
    recordingTimer = window.setInterval(() => {
      recordingDuration.value++
    }, 1000)

    // 配置语音识别回调（使用新的多源语音识别模块）
    speechRecognitionCallbacks = {
      onStart: () => {
        const providerName = speechManager.getCurrentProvider()
        showInfo(t('floatingChat.voiceStarted') + ` (${providerName})`)
      },
      onResult: (text, isFinal) => {
        if (isFinal && text) {
          // 最终结果追加到输入框
          const currentText = getInputText()
          setInputText((currentText + ' ' + text).trim())
          inputText.value = getInputText() // 保持同步
          handleInputChange()

          // 如果有语音卡片，清除它（因为已经转换为文字）
          if (voiceAudioData.value) {
            clearVoiceAudio()
          }
        }
      },
      onError: (error: SpeechRecognitionError | string) => {
        // 兼容新旧错误格式
        let errorMessage: string
        let suggestion: string | undefined

        if (typeof error === 'string') {
          errorMessage = error
          if (error === 'VOICE_RECOGNITION_ALREADY_STARTED') {
            errorMessage = t('floatingChat.voiceAlreadyStarted')
          } else if (error.includes('not-allowed')) {
            errorMessage = t('floatingChat.voicePermissionDenied')
          } else if (error.includes('no-speech')) {
            errorMessage = t('floatingChat.voiceNoSpeech')
          }
        } else {
          errorMessage = error.message
          suggestion = error.suggestion
        }

        showError(errorMessage)
        if (suggestion) {
          logger.info('[VoiceInput] Suggestion:', suggestion)
        }

        // 延迟停止，让用户看到视觉反馈
        setTimeout(() => {
          stopVoiceRecording()
        }, 500)
      },
      onEnd: (finalText?: string) => {
        if (finalText && finalText.trim()) {
          // 将最终文本添加到输入框
          const currentText = getInputText()
          if (!currentText.includes(finalText)) {
            setInputText((currentText + ' ' + finalText).trim())
            inputText.value = getInputText() // 保持同步
            handleInputChange()
          }
        }
        stopVoiceRecording()
      },
      onVolumeChange: (_volume: number) => {
        // Can be used to display volume indicator
        // logger.debug('[VoiceInput] Volume:', _volume)
      },
      onStatusChange: (status) => {
        logger.info('[VoiceInput] State change:', status)
      },
    }

    // 启动语音识别（自动选择最佳提供商）
    startSpeechRecognition(speechRecognitionCallbacks)

    if (!isSpeechRecognitionSupported()) {
      showError(t('floatingChat.voiceStartFailed'))
      stopVoiceRecording()
    }
  } catch (error) {
    logger.error('[VoiceInput] Failed to start speech recognition:', error)
    showError(t('floatingChat.voiceStartFailed'))
    stopVoiceRecording()
  }
}

const stopVoiceRecording = () => {
  try {
    const duration = recordingDuration.value

    // 停止计时器
    if (recordingTimer !== null) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }

    // 停止媒体录制
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    // 停止语音识别
    stopSpeechRecognition()

    // 获取累积的文本（备用方案）
    setTimeout(() => {
      const accumulatedText = getAccumulatedText()
      const currentText = getInputText()
      if (accumulatedText && accumulatedText.trim() && !currentText.includes(accumulatedText)) {
        setInputText((currentText + ' ' + accumulatedText).trim())
        inputText.value = getInputText() // 保持同步
        handleInputChange()

        // 如果有语音卡片，清除它（因为已经转换为文字）
        if (voiceAudioData.value) {
          clearVoiceAudio()
        }
      }
    }, 500)

    isRecording.value = false

    if (duration > 0) {
      showInfo(t('floatingChat.voiceStopped', { duration }))
    } else {
      showInfo(t('floatingChat.voiceStoppedShort'))
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    isRecording.value = false

    // 清理媒体流
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop())
      audioStream = null
    }
  }
}

// 处理 VoiceRecordingAnimation 组件的停止事件
const _handleVoiceStop = (audioData?: { audioUrl: string; duration: number }): void => {
  logger.debug('🎤 [VoiceInput] _handleVoiceStop called', audioData)
  stopVoiceRecording()

  // 如果有音频数据，可以在这里处理
  if (audioData?.audioUrl) {
    logger.info('[VoiceInput] Received audio data:', audioData)
  }
}

// 消息操作：使用 ClipboardManager 以支持非安全上下文下的降级复制（助手消息用拆解后的可读文本）
const copyMessage = async (message: ChatMessage) => {
  const text = message.role === 'assistant'
    ? getAssistantDisplayContent(message)
    : (typeof message.content === 'string'
      ? message.content
      : message.content != null
        ? String(message.content)
        : '')
  const result = await ClipboardManager.copy(text)
  if (result.success) {
    showSuccess(t('floatingChat.copied'))
  } else {
    showError(t('floatingChat.copyFailed'))
  }
}

const editMessage = (message: ChatMessage) => {
  editingMessageId.value = message.id
  editContent.value = message.content
}

const saveEdit = async () => {
  if (!editContent.value.trim()) {
    showWarning(t('floatingChat.pleaseEnterContent'))
    return
  }

  const message = messages.value.find((m) => m.id === editingMessageId.value)
  if (message && message.role === 'user') {
    const messageIndex = messages.value.findIndex((m) => m.id === editingMessageId.value)

    // 保存编辑
    message.content = editContent.value
    message.edited = true

    // 如果编辑后的消息后面有AI回复，询问是否重新生成
    if (messageIndex !== -1 && messages.value[messageIndex + 1]?.role === 'assistant') {
      const confirmed = await confirm(
        t('floatingChat.regenerateAfterEditConfirm'),
        t('floatingChat.confirmRegenerateAfterEdit')
      )
      if (confirmed) {
        // 删除旧的AI回复
        messages.value.splice(messageIndex + 1, 1)
        // 重新发送
        await sendMessageWithRetry(message)
      }
    }

    editingMessageId.value = null
    editContent.value = ''
    showSuccess(t('floatingChat.editSuccess'))

    // 自动保存
    if (isAutoSave.value) {
      await saveConversation()
    }
  } else {
    editingMessageId.value = null
    editContent.value = ''
  }
}

const cancelEdit = () => {
  editingMessageId.value = null
  editContent.value = ''
}

const deleteMessage = async (message: ChatMessage) => {
  const confirmed = await confirm(
    t('floatingChat.deleteMessageConfirm'),
    t('floatingChat.confirmDelete')
  )
  if (confirmed) {
    const index = messages.value.findIndex((m) => m.id === message.id)
    if (index > -1) {
      // 如果是用户消息，询问是否同时删除AI回复
      if (message.role === 'user' && messages.value[index + 1]?.role === 'assistant') {
        const deleteReply = await confirm(
          t('floatingChat.deleteReplyConfirm'),
          t('floatingChat.confirmDeleteReply')
        )
        if (deleteReply) {
          messages.value.splice(index, 2)
        } else {
          messages.value.splice(index, 1)
        }
      } else {
        messages.value.splice(index, 1)
      }

      showSuccess(t('floatingChat.messageDeleted'))

      // 自动保存
      if (isAutoSave.value) {
        await saveConversation()
      }
    }
  }
}

const toggleLike = (message: ChatMessage) => {
  message.liked = !message.liked
  if (message.liked) {
    showSuccess(t('floatingChat.messageLiked'))
  } else {
    showInfo(t('floatingChat.messageUnliked'))
  }

  // 自动保存
  if (isAutoSave.value) {
    saveConversation()
  }
}

const toggleMetadata = (message: ChatMessage) => {
  message.showMetadata = !message.showMetadata
}

// 重新生成消息 - 统一走 handleSend（与首次发送同链路）
const regenerateMessage = async (message: ChatMessage) => {
  if (message.role !== 'assistant') {
    showWarning(t('floatingChat.canOnlyRegenerateAI'))
    return
  }

  // 找到该消息对应的用户消息
  const messageIndex = messages.value.findIndex((m) => m.id === message.id)
  if (messageIndex === -1 || messageIndex === 0) {
    showError(t('floatingChat.messageNotFound'))
    return
  }

  const userMessage = messages.value[messageIndex - 1]
  if (userMessage.role !== 'user') {
    showError(t('floatingChat.messageNotFound'))
    return
  }

  // 统一行为：把原始用户问题重新填回输入框，再走一次 handleSend
  setInputText(userMessage.content)
  inputText.value = userMessage.content
  await nextTick()
  await handleSend()
}

// 重试失败消息 - 完整实现
const retryMessage = async (message: ChatMessage) => {
  if (message.status !== 'failed') {
    showWarning(t('floatingChat.canOnlyRetryFailed'))
    return
  }

  // 如果是用户消息失败，重新发送
  if (message.role === 'user') {
    message.status = 'sending'

    try {
      // 找到对应的AI消息（如果有）并删除
      const messageIndex = messages.value.findIndex((m) => m.id === message.id)
      if (messageIndex !== -1 && messages.value[messageIndex + 1]?.role === 'assistant') {
        messages.value.splice(messageIndex + 1, 1)
      }

      // 重新发送
      await sendMessageWithRetry(message)
    } catch (error) {
      message.status = 'failed'
      message.error = error instanceof Error ? error.message : String(error)
      showError(t('floatingChat.retryFailed'))
    }
    return
  }

  // 如果是AI消息失败，重新生成
  if (message.role === 'assistant') {
    await regenerateMessage(message)
  }
}

// 带重试的消息发送：同样复用 handleSend，避免走 /ai/generate/stream
const sendMessageWithRetry = async (userMessage: ChatMessage) => {
  isSending.value = true
  isTyping.value = true

  try {
    setInputText(userMessage.content)
    inputText.value = userMessage.content
    await nextTick()
    await handleSend()
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    userMessage.status = 'failed'
    userMessage.error = error instanceof Error ? error.message : String(error)
    const failedMessage = messages.value.find((m) => m.role === 'assistant' && m.status === 'sending')
    if (failedMessage) {
      failedMessage.status = 'failed'
      failedMessage.isStreaming = false
      failedMessage.error = error instanceof Error ? error.message : String(error)
    }
    isTyping.value = false
    throw error
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

// ==================== OpenClaw 功能处理 ====================

/** trae-work 顶层能力下拉中点击 "AI 智能工具箱"：直接展开工具箱 dashboard */
const handleOpenClawFromCapability = () => {
  closeCapabilityDropdownAndReset()
  showOpenClawPopover.value = false
  showOpenClawPanel.value = true
  openClawActivePanel.value = 'dashboard'
  if (openClawPanelRef.value) {
    ;(openClawPanelRef.value as OpenClawPanelInstance).setPanel?.('dashboard')
  }
}

/** trae-work 顶层能力下拉中点击提示词模板：选择后关闭下拉 */
const handlePromptTemplateSelectFromDropdown = (template: { content: string; title?: string }) => {
  handlePromptTemplateSelect(template)
  closeCapabilityDropdownAndReset()
}

const handleOpenClawBack = () => {
  showOpenClawPopover.value = false
  showOpenClawPanel.value = false
  openClawActivePanel.value = ''
}

/** 浏览器面板「在对话中操作」：关闭面板并聚焦输入框，便于用户直接输入网页操作需求 */
const handleBrowserPanelUseInChat = () => {
  handleOpenClawBack()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const _handleOpenClawToolClick = (toolId: string) => {
  openClawActivePanel.value = toolId

  if (openClawPanelRef.value) {
    (openClawPanelRef.value as OpenClawPanelInstance).setPanel?.(toolId)
  }
}

// 发送消息 - 增强功能（支持上下文、文件、引用等）
// WebSocket 流式消息处理函数（兼容多种后端事件格式）
const handleModelStreamEvent = (event: ChatStreamEvent, assistantMessage: ChatMessage, userMessage: ChatMessage) => {
  // 统一事件类型：优先使用 event.type，没有则退回 event.event（后端原始字段）
  const rawEvent = event as ChatStreamEvent & { event?: string }
  const eventType = (rawEvent.type || rawEvent.event || '') as string

  if (eventType === 'error' || event.error) {
    ElMessage.error(event.error || t('common.error'))
    assistantMessage.status = 'failed'
    assistantMessage.error = event.error || t('common.error')
    isTyping.value = false
    return
  }

  if (
    eventType === 'message.delta' ||
    eventType === 'delta' ||
    eventType === 'conversation.message.delta'
  ) {
    // 增量内容（兼容多种后端事件结构）
    let content =
      (event.data as { content?: string } | undefined)?.content ||
      event.content ||
      ''

    // 参考 LLMChatCenter 和其他项目：有些后端会把内容放在 delta/choices 里
    if (!content && event.data && typeof event.data === 'object') {
      const data = event.data as {
        delta?: { content?: string }
        choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
      }
      content =
        data.delta?.content ||
        data.choices?.[0]?.delta?.content ||
        data.choices?.[0]?.message?.content ||
        ''
    }
    if (content) {
      assistantMessage.content += content
      // 优化滚动性能（节流滚动 - 每300ms滚动一次）
      if (!scrollThrottleTimer) {
        scrollThrottleTimer = window.setTimeout(() => {
          scrollToBottom(false) // 使用非平滑滚动以提高性能
          scrollThrottleTimer = null
        }, 300)
      }
    }
  } else if (
    eventType === 'message.complete' ||
    eventType === 'done' ||
    eventType === 'conversation.chat.completed' ||
    eventType === 'completed' ||
    event.done
  ) {
    // 完成（参考 LLMChatCenter：更新对话记录标记为第一条用户消息）
    assistantMessage.status = 'sent'
    assistantMessage.isStreaming = false
    isTyping.value = false
    userMessage.status = 'sent'

    // 若后端的完成事件中返回 agent/agent_avatar 等，合并到消息 metadata
    const completionData = (event as { data?: Record<string, unknown> }).data
    if (completionData && typeof completionData === 'object' && Object.keys(completionData).length > 0) {
      mapResponseToAssistantMetadata(completionData, assistantMessage)
    }

    const convId = currentConversationId.value
    if (convId?.startsWith('model-chat-')) {
      const chatId = parseInt(convId.replace('model-chat-', ''), 10)
      const firstUserMsg = messages.value.find(m => m.role === 'user')
      if (chatId && !isNaN(chatId) && firstUserMsg?.content) {
        updateChatMark(chatId, firstUserMsg.content.slice(0, 30)).catch(e =>
          logger.warn('Failed to update conversation tag', e)
        )
      }
    }

    // 清理滚动定时器
    if (scrollThrottleTimer !== null) {
      clearTimeout(scrollThrottleTimer)
      scrollThrottleTimer = null
    }

    // 保存对话（自动保存）
    if (isAutoSave.value) {
      saveConversation()
    }

    emit('message-received', assistantMessage)
    scrollToBottom(true) // 完成后平滑滚动到底部
  }
}

// WebSocket 错误处理
const handleModelStreamError = (error: Event, assistantMessage: ChatMessage, userMessage: ChatMessage) => {
  logger.error('Model WebSocket error:', error)

  // 更新消息状态，避免一直显示流式动画但没有内容
  assistantMessage.status = 'failed'
  assistantMessage.isStreaming = false
  assistantMessage.error = t('floatingChat.connectionError')
  userMessage.status = 'failed'

  isTyping.value = false
  isSending.value = false

  ElMessage.error(t('floatingChat.connectionError'))
}

// WebSocket 关闭处理
const handleModelStreamClose = (assistantMessage: ChatMessage, userMessage: ChatMessage) => {
  logger.info('Model WebSocket connection closed')

  // 如果正在流式输出，保存内容
  if (assistantMessage.isStreaming && assistantMessage.content) {
    assistantMessage.status = 'sent'
    assistantMessage.isStreaming = false
    isTyping.value = false
    userMessage.status = 'sent'

    // 保存对话（自动保存）
    if (isAutoSave.value) {
      saveConversation()
    }

    emit('message-received', assistantMessage)
    scrollToBottom(true)
  }

  currentModelWebSocket.value = null
}

// 与 ai_index2 一致：将 variables 转为后端要求的 zidingyican，value 为对象时取 value.value（参考 handleSendMessage 中 modelVariables.map）
const normalizeZidingyican = (variables: unknown): Array<{ name: string; desc: string; value: unknown }> => {
  if (!Array.isArray(variables)) return []
  return variables.map((item: unknown) => {
    const it = item as { name?: string; desc?: string; value?: unknown }
    if (!it || typeof it !== 'object') return { name: '', desc: '', value: undefined }
    const raw = it.value
    const value = raw != null && typeof raw === 'object' && 'value' in (raw as object)
      ? (raw as { value?: unknown }).value
      : raw
    return { name: it.name ?? '', desc: (it.desc ?? '') as string, value }
  })
}

const handleSend = async () => {
  // 防止重复发送
  if (isSending.value) return

  // 生成模式已下线：兜底防御（历史状态/缓存/旧参数可能仍残留）
  if ((currentAIMode.value as string) === 'generation') {
    currentAIMode.value = 'model'
  }

  // 检查登录状态
  if (!authStore.isLoggedIn) {
    showWarning(t('aiChat.pleaseLogin'))
    return
  }

  // 检查是否有内容，无内容时弹窗提示（发送内容排除智能体标签的显示文本）
  const textForSend = getInputTextForSend()
  if (!textForSend && uploadedFiles.value.length === 0) {
    showWarning(t('aiChat.pleaseInput'))
    return
  }

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const files = [...uploadedFiles.value]
  const messageContent = textForSend

  // 构建用户消息（包含引用信息）
  // 保存引用信息（在清空前）
  const currentReplyTo = replyingToMessageId.value
  const currentQuotedMessage = quotedMessage.value ? { ...quotedMessage.value } : null

  // 清空输入和引用
  setInputText('')
  inputText.value = '' // 保持同步
  uploadedFiles.value = []
  if (replyingToMessageId.value) {
    cancelReply()
  }

  const userMessage: ChatMessage = {
    id: messageId,
    role: 'user',
    content: messageContent,
    files: files.length > 0 ? files.map(f => ({
      id: `${messageId}-${f.name}`,
      name: f.name,
      type: f.type,
      preview: f.preview,
      size: f.size || 0,
      uploadedAt: Date.now(),
    })) : undefined,
    createTime: new Date().toISOString(),
    status: 'sending',
    replyTo: currentReplyTo || undefined,
    quotedMessage: currentQuotedMessage || undefined,
  }

  messages.value.push(userMessage)
  emit('message-sent', userMessage)

  isSending.value = true
  isTyping.value = true

  // 调整输入框高度
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }

  // 如果当前没有对话ID，创建新的对话
  if (!currentConversationId.value) {
    currentConversationId.value = `conv-${Date.now()}`
  }

  // 滚动到底部
  scrollToBottom()

  // 智能能力发现（在发送前）
  await discoverAICapabilities(messageContent)

  // 生成模式已下线：不再进行 generation 分流，统一走下方对话链路

  try {
    const assistantMessageId = `msg-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createTime: new Date().toISOString(),
      status: 'sending',
      // 模型模式和智能体模式都支持流式
      isStreaming: currentAIMode.value === 'model' || currentAIMode.value === 'agent',
      model: currentAIMode.value === 'model' ? selectedModel.value?.modelCode : undefined,
      metadata: {
        mode: ((currentAIMode.value as string) === 'generation' ? 'model' : currentAIMode.value) as 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid',
        agent: currentAIMode.value === 'agent' && selectedAgent.value ? selectedAgent.value.name : undefined,
        agent_avatar: currentAIMode.value === 'agent' && selectedAgent.value
          ? ((selectedAgent.value as { avatar?: string; icon?: string }).avatar || (selectedAgent.value as { avatar?: string; icon?: string }).icon || '')?.trim() || undefined
          : undefined,
        swarm: currentAIMode.value === 'agentic' && selectedAgenticSwarmId.value ? selectedAgenticSwarmId.value : undefined,
        capabilityType: ((currentAIMode.value as string) === 'generation' ? 'generation' : currentAIMode.value) as 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'generation',
        generationType: (currentAIMode.value as string) === 'generation' ? currentGenerationType.value : undefined,
      } as Record<string, unknown>,
    }

    messages.value.push(assistantMessage)
    scrollToBottom()

    // 根据当前AI模式选择不同的调用方式
    let responseContent = ''

    // 智能体模式但还没真正选中具体智能体时，直接给出提示，避免误走大模型接口
    if (currentAIMode.value === 'agent' && !selectedAgent.value) {
      showWarning(t('floatingChat.selectAgentFirst'))
      assistantMessage.status = 'failed'
      assistantMessage.isStreaming = false
      isTyping.value = false
      userMessage.status = 'failed'
      return
    }

    if (currentAIMode.value === 'agent' && selectedAgent.value) {
      // === 智能体模式：使用统一 LLM WebSocket 接口 ihui-ai-api/llm/ws 进行流式对话 ===
      let wsUrl: string
      // 开发环境：走本地 Vite 代理，路径为 /ihui-ai-api/llm/ws
      // 生产环境：读 VITE_WS_BASE_URL 环境变量, 兜底同源地址
      if ((import.meta as { env?: { DEV?: boolean; VITE_WS_BASE_URL?: string } }).env?.DEV) {
        const _protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        wsUrl = `${_protocol}//${window.location.host}/ihui-ai-api/llm/ws`
      } else {
        const _wsBase = (import.meta as { env?: { VITE_WS_BASE_URL?: string } }).env?.VITE_WS_BASE_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
        wsUrl = `${_wsBase}/ihui-ai-api/llm/ws`
      }

      const userUuid = getUserUuid()

      // JWT 鉴权: 通过 createAuthWebSocket 自动附加 token
      const socket = createAuthWebSocket(wsUrl)
      // 保存到组件级变量，便于 onUnmounted 统一关闭
      currentModelWebSocket.value = socket

      socket.onopen = () => {
        // 复用当前问题文本和首个多媒体地址，按统一 LLM 协议构建参数
        const firstImageUrl =
          files.find(f => f.type?.startsWith('image/'))?.preview || ''
        const firstVideoUrl =
          files.find(f => f.type?.startsWith('video/'))?.preview || ''
        const firstAudioUrl =
          files.find(f => f.type?.startsWith('audio/'))?.preview || ''

        // 智能体自定义参数，转换为后端要求的 zidingyican 结构
        const agentVarsRaw =
          (selectedAgent.value as AgentWithVariables | null)?.variables ||
          (selectedAgent.value as AgentWithVariables | null)?.agentVariables ||
          []
        const zidingyican = normalizeZidingyican(agentVarsRaw)

        // 与统一大模型接口保持一致的参数格式
        const currentAgent = selectedAgent.value as
          | { agentId?: string; id?: string }
          | null
          | undefined

        const payload = {
          prompt: messageContent,
          // 按要求：model_id 传智能体的 agentId，兜底为智能体自身 ID
          // 通过局部变量 + 可选链，避免直接在可能为 null 的 selectedAgent.value 上取属性
          model_id: currentAgent?.agentId ?? String(currentAgent?.id ?? ''),
          user_uuid: userUuid,
          // 目前智能体对话暂不区分 chat_id，留空由后端自行管理会话
          chat_id: '',
          files: [
            { image_url: firstImageUrl },
            { video_url: firstVideoUrl },
            { audio_url: firstAudioUrl },
          ],
          zidingyican,
        }

        socket.send(JSON.stringify(payload))
      }

      socket.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data as string) as ChatStreamEvent
          // 复用现有的 ihui API/WebSocket 流式处理逻辑（会负责拼接 content、完成状态、保存会话等）
          handleModelStreamEvent(data, assistantMessage, userMessage)
        } catch (e) {
          logger.error('Agent WebSocket onmessage parse error:', e)
        }
      }

      socket.onerror = (ev: Event) => {
        handleModelStreamError(ev, assistantMessage, userMessage)
      }

      socket.onclose = () => {
        if (assistantMessage.isStreaming) {
          assistantMessage.isStreaming = false
          isTyping.value = false
        }
      }

      // 智能体路径下，直接返回，不再走后面的统一/模型分支
      return
    } else if (currentAIMode.value === 'agentic') {
      // 使用Agentic AI系统
      const swarmResponse = await createAgenticSwarm({
        task: messageContent,
        options: {
          coordination: 'hierarchical',
          maxIterations: 10,
        },
      })

      if (swarmResponse.code === 200 && swarmResponse.success && swarmResponse.data) {
        const swarmData = swarmResponse.data as { swarmId?: string; status?: string; result?: string }
        const swarmId = swarmData.swarmId

        if (swarmId) {
          selectedAgenticSwarmId.value = swarmId
          assistantMessage.metadata!.swarm = swarmId

          // 如果已经有结果，直接使用
          if (swarmData.status === 'completed' && swarmData.result) {
            responseContent = swarmData.result
          } else {
            // 轮询获取结果（最多轮询30次，60秒）
            let pollCount = 0
            const maxPolls = 30

            const pollResult = async (): Promise<void> => {
              if (pollCount >= maxPolls) {
                responseContent = t('floatingChat.agenticAITaskTimeout')
                return
              }

              pollCount++
              const statusResponse = await getSwarmStatus(swarmId)

              if (statusResponse.code === 200 && statusResponse.success && statusResponse.data) {
                const status = statusResponse.data as { status?: string; result?: string; error?: string }

                if (status.status === 'completed') {
                  if (status.result) {
                    responseContent = status.result
                  } else if (status.error) {
                    throw new Error(status.error)
                  } else {
                    responseContent = t('floatingChat.agenticAITaskCompleted')
                  }
                } else if (status.status === 'running' || status.status === 'pending') {
                  // 更新消息显示状态
                  assistantMessage.content = t('floatingChat.agenticAITaskRunning', { current: pollCount, max: maxPolls })
                  scrollToBottom()
                  // 继续轮询
                  await new Promise(resolve => setTimeout(resolve, 2000))
                  await pollResult()
                } else if (status.status === 'failed' || status.status === 'error') {
                  throw new Error(status.error || t('floatingChat.agenticAITaskFailed'))
                } else {
                  // 未知状态，继续轮询
                  await new Promise(resolve => setTimeout(resolve, 2000))
                  await pollResult()
                }
              } else {
                // 状态查询失败，继续轮询
                await new Promise(resolve => setTimeout(resolve, 2000))
                await pollResult()
              }
            }

            await pollResult()
          }
        } else {
          throw new Error(t('floatingChat.swarmIdNotFound'))
        }
      } else {
        throw new Error(swarmResponse.message || t('floatingChat.agenticAICallFailed'))
      }
    } else if (currentAIMode.value === 'mcp' || currentAIMode.value === 'hybrid' || currentAIMode.value === 'auto') {
      // 使用统一AI编排系统（mcp=仅工具，hybrid=工具+模型，auto=智能模式自动决策）
      await discoverAICapabilities(messageContent)

      const preferredType = currentAIMode.value === 'mcp'
        ? AICapabilityType.MCP
        : currentAIMode.value === 'auto'
          ? AICapabilityType.AUTO
          : AICapabilityType.HYBRID
      const unifiedResponse = await smartInvoke(messageContent, {
        preferredType,
        context: {
          userMessage: messageContent,
          conversationHistory: messages.value
            .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.status === 'sent'))
            .slice(-10)
            .map((m) => ({
              role: m.role,
              content: m.content,
            })),
        },
      })

      if (unifiedResponse && unifiedResponse.success && unifiedResponse.data) {
        // 处理统一AI响应
        const data = unifiedResponse.data
        if (typeof data === 'string') {
          responseContent = data
        } else if (data && typeof data === 'object') {
          // 尝试提取文本内容
          if ('content' in data && typeof data.content === 'string') {
            responseContent = data.content
          } else if ('text' in data && typeof data.text === 'string') {
            responseContent = data.text
          } else if ('result' in data && typeof data.result === 'string') {
            responseContent = data.result
          } else {
            responseContent = JSON.stringify(data, null, 2)
          }
        } else {
          responseContent = String(data)
        }

        // 更新元数据
        if (unifiedResponse.capabilityId) {
          assistantMessage.metadata!.capabilityId = unifiedResponse.capabilityId
        }
        if (unifiedResponse.capabilityType) {
          assistantMessage.metadata!.capabilityType = unifiedResponse.capabilityType
        }
        // 保存 Token 使用统计（如果响应中包含）
        if (unifiedResponse.usage) {
          if (!assistantMessage.metadata) {
            assistantMessage.metadata = {}
          }
          assistantMessage.metadata.usage = {
            promptTokens: unifiedResponse.usage.promptTokens || 0,
            completionTokens: unifiedResponse.usage.completionTokens || 0,
            totalTokens: unifiedResponse.usage.totalTokens || 0,
          }
          assistantMessage.metadata.tokensUsed = unifiedResponse.usage.totalTokens || 0
        }
        // 映射大模型/智能体富内容（与 ai_index2/ai_assistant 一致）
        if (data && typeof data === 'object') {
          mapResponseToAssistantMetadata(data as Record<string, unknown>, assistantMessage)
        }
      } else {
        throw new Error(unifiedResponse?.error || t('floatingChat.unifiedAICallFailed'))
      }
    }

    // 如果有响应内容，更新消息
    if (responseContent) {
      assistantMessage.content = responseContent
      assistantMessage.status = 'sent'
      assistantMessage.isStreaming = false
      isTyping.value = false
      userMessage.status = 'sent'

      // 保存对话（自动保存）
      if (isAutoSave.value) {
        saveConversation()
      }

      emit('message-received', assistantMessage)
      scrollToBottom(true)
    } else if (currentAIMode.value === 'model' && selectedModel.value) {
      // 大模型模式：优先按模型配置调用（HTTP remark + chat_id + zidingyican），否则走 WebSocket（历史实现）
      const userUuid = getUserUuid()
      const modelName = selectedModel.value.name.toLowerCase()
      const modelSource = (
        (selectedModel.value as unknown as { source?: string }).source ||
        selectedModel.value.provider ||
        ''
      ).toLowerCase()

      // 视频类模型统一由 handleVideoGeneration 走 remark 接口，此处不再走通用 HTTP，避免同一接口被调用两次
      const modelType = (selectedModel.value.type || selectedModel.value.category) as 'talk' | 'image' | 'video' | 'audio' | undefined

      // 统一大模型聊天接口：根据 quest_type 字段选择 HTTP 或 WebSocket
      // quest_type = ws/websocket → /ihui-ai-api/llm/ws（由 nginx 代理）
      // 其他（如 http）       → /ihui-ai-api/llm/chat（由 nginx 代理）
      const modelCfg = selectedModel.value as unknown as { remark?: string; quest_type?: string; variables?: unknown }
      const questTypeRaw = modelCfg.quest_type || ''
      const questTypeLower = questTypeRaw.toLowerCase().trim()
      const isQuestWs =
        questTypeLower === 'ws' ||
        questTypeLower === 'websocket' ||
        questTypeLower === 'web_socket'
      const isQuestHttp =
        questTypeLower === 'http' ||
        questTypeLower === 'https' ||
        (!isQuestWs && !!questTypeLower)

      // 仅对非视频/音频类模型启用统一对话接口，其余仍按各自生成链路处理
      if ((isQuestWs || isQuestHttp) && modelType !== 'video' && modelType !== 'audio') {
        // 补齐 chat_id（优先使用大模型历史记录里的 _chatId，其次再从 currentConversationId 中解析）
        let chatIdStr: string | undefined
        const convIdForLlm = currentConversationId.value
        if (convIdForLlm) {
          const modelConv = modelChatHistory.value.find(c => c.id === convIdForLlm)
          if (modelConv && typeof modelConv._chatId === 'number') {
            chatIdStr = String(modelConv._chatId)
          } else if (convIdForLlm.startsWith('model-chat-')) {
            chatIdStr = convIdForLlm.replace('model-chat-', '')
          }
        }

        // 如果当前还没有 chat_id，先从 ihui API user-model-chat/query 获取历史记录的第一条 id
        if (!chatIdStr) {
          try {
            const res = await queryChatRecords({
              user_uuid: userUuid,
              model_name: selectedModel.value.name,
              limit: 50,
            })
            const dataAny = (res as unknown as { data?: unknown })?.data
            const listAny = (dataAny ?? res) as unknown
            const list: ChatRecord[] = Array.isArray(listAny)
              ? (listAny as ChatRecord[])
              : Array.isArray((listAny as { list?: ChatRecord[] }).list)
                ? ((listAny as { list?: ChatRecord[] }).list as ChatRecord[])
                : Array.isArray((listAny as { data?: ChatRecord[] }).data)
                  ? ((listAny as { data?: ChatRecord[] }).data as ChatRecord[])
                  : []
            const first = list[0]
            if (first && first.id != null) {
              const firstId = first.id
              chatIdStr = String(firstId)
              currentConversationId.value = `model-chat-${firstId}`
              if (!modelChatHistory.value.some(c => c.id === currentConversationId.value)) {
                modelChatHistory.value = [
                  {
                    id: `model-chat-${firstId}`,
                    title: first.mark || t('aiChat.chatTitle', { id: firstId }),
                    messages: [],
                    createTime: first.create_time,
                    _chatId: firstId,
                  },
                  ...modelChatHistory.value,
                ]
              }
            }
          } catch (e) {
            logger.warn('Failed to query LLM chat history (unified interface), will try creating new conversation:', e)
          }
        }

        // 如果查询历史后仍然没有 chat_id，则创建新对话记录获取 chat_id
        if (!chatIdStr) {
          try {
            const mark = messageContent.slice(0, 30) || t('floatingChat.newConversation')
            const res = await createChatRecord({
              user_uuid: userUuid,
              model_name: selectedModel.value.name,
              mark,
            })
            if (res.success && res.data && res.data.id != null) {
              const newId = res.data.id
              currentConversationId.value = `model-chat-${newId}`
              chatIdStr = String(newId)
              modelChatHistory.value = [
                {
                  id: `model-chat-${newId}`,
                  title: mark,
                  messages: [],
                  createTime: res.data.create_time,
                  _chatId: newId,
                },
                ...modelChatHistory.value,
              ]
            }
          } catch (e) {
            logger.error('Failed to create LLM conversation record (unified interface):', e)
          }
        }

        // 构建文件参数：仅取首个图片/视频/音频地址
        const firstImageUrl =
          files.find(f => f.type?.startsWith('image/'))?.preview || ''
        const firstVideoUrl =
          files.find(f => f.type?.startsWith('video/'))?.preview || ''
        const firstAudioUrl =
          files.find(f => f.type?.startsWith('audio/'))?.preview || ''

        // 从模型配置中透传自定义参数（与 ai_index2 一致：归一化 value 为对象时的 value.value）
        const zidingyican = normalizeZidingyican(modelCfg.variables ?? [])
        logger.info('selectedModel.value', selectedModel.value)
        const llmPayload = {
          prompt: messageContent,
          // 统一使用大模型列表中的 modelCode 作为 model_id（对应后端的 code 字段）
          model_id: selectedModel.value.code,
          user_uuid: userUuid,
          chat_id: chatIdStr,
          access_key: getUserToken() ?? '',
          files: [
            { image_url: firstImageUrl },
            { video_url: firstVideoUrl },
            { audio_url: firstAudioUrl },
          ],
          zidingyican,
        }

        if (isQuestHttp) {
          try {
            const llmChatUrl = import.meta.env.VITE_LLM_CHAT_URL || '/ihui-ai-api/llm/chat'
            const resp = await request.post(
              llmChatUrl,
              llmPayload
            ) as unknown as ApiResponsePayload

            const payload = (resp.data ?? resp) as ApiResponsePayload

            // 图片大模型：content 为图片 URL 时，按图片结果处理
            if (modelType === 'image') {
              // 兼容两种结构：
              // 1) payload.content = "url"
              // 2) payload.data.content = "url"
              const innerData = (payload && typeof payload === 'object'
                ? (payload as { data?: { content?: string; message?: string } }).data
                : undefined) as { content?: string; message?: string } | undefined

              const rawUrl =
                (typeof payload?.content === 'string' && payload.content) ||
                (innerData && typeof innerData.content === 'string' && innerData.content) ||
                ''

              if (rawUrl) {
                const url = rawUrl as string
                const isImageUrl =
                  /^https?:\/\//i.test(url) &&
                  /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)

                if (isImageUrl) {
                  const title =
                    (typeof payload?.message === 'string' && payload.message) ||
                    (innerData && typeof innerData.message === 'string' && innerData.message) ||
                    t('floatingChat.generatedImage')

                  // Markdown 内嵌图片
                  assistantMessage.content = `**${title}**\n\n![${title}](${url})`
                  assistantMessage.files = [
                    {
                      id: `img-${Date.now()}`,
                      name: 'generated-image-1.png',
                      type: 'image/png',
                      preview: url,
                      size: 0,
                      uploadedAt: Date.now(),
                    },
                  ]

                  assistantMessage.status = 'sent'
                  assistantMessage.isStreaming = false
                  isTyping.value = false
                  userMessage.status = 'sent'

                  if (isAutoSave.value) {
                    saveConversation()
                  }
                  emit('message-received', assistantMessage)
                  scrollToBottom(true)
                  return
                }
              }
            }

            // 非图片/音频结果：优先抽取文本
            const extracted =
              (typeof payload === 'string' ? payload : undefined) ??
              (typeof payload?.content === 'string' ? payload.content : undefined) ??
              (typeof payload?.text === 'string' ? payload.text : undefined) ??
              (typeof payload?.result === 'string' ? payload.result : undefined) ??
              (typeof payload?.message === 'string' ? payload.message : undefined)

            if (extracted && extracted.trim()) {
              assistantMessage.content = extracted
            } else {
              // 若 HTTP 返回结构非文本，作为 JSON 展示，避免“看起来没调用接口”
              assistantMessage.content =
                typeof payload === 'object'
                  ? JSON.stringify(payload, null, 2)
                  : String(payload ?? '')
            }

            assistantMessage.status = 'sent'
            assistantMessage.isStreaming = false
            isTyping.value = false
            userMessage.status = 'sent'

            if (isAutoSave.value) {
              saveConversation()
            }
            emit('message-received', assistantMessage)
            scrollToBottom(true)
            return
          } catch (e) {
            logger.warn('[ModelChat] Unified LLM HTTP call failed, falling back to original logic:', e)
          }
        } else if (isQuestWs) {
          try {
            const _wsBaseProd = (import.meta as { env?: { VITE_WS_BASE_URL?: string } }).env?.VITE_WS_BASE_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
            const wsUrl = import.meta.env.DEV
              ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ihui-ai-api/llm/ws`
              : `${_wsBaseProd}/ihui-ai-api/llm/ws`
            // JWT 鉴权: 通过 createAuthWebSocket 自动附加 token
            const socket = createAuthWebSocket(wsUrl)
            currentModelWebSocket.value = socket

            socket.onopen = () => {
              try {
                socket.send(JSON.stringify(llmPayload))
              } catch (e) {
                logger.error('Unified LLM WebSocket send failed:', e)
              }
            }

            socket.onmessage = (ev: MessageEvent) => {
              try {
                const data = JSON.parse(ev.data as string) as ChatStreamEvent
                // 复用现有的大模型流式事件处理逻辑
                handleModelStreamEvent(data, assistantMessage, userMessage)
              } catch (e) {
                logger.error('Unified LLM WebSocket message parse failed:', e)
              }
            }

            socket.onerror = (ev: Event) => {
              handleModelStreamError(ev, assistantMessage, userMessage)
            }

            socket.onclose = () => {
              handleModelStreamClose(assistantMessage, userMessage)
            }

            return
          } catch (e) {
            logger.warn('[ModelChat] Unified LLM WebSocket creation failed, falling back to original logic:', e)
          }
        }
      }

      // 若模型在列表中配置了 remark + quest_type=http，则优先走 HTTP 接口（避免“明明是 http 还走 websocket”）
      // 排除 video：视频模型由下方 handleVideoGeneration 单独处理
      try {
        const remark = (modelCfg.remark || '').trim()
        if (questTypeLower === 'http' && remark && modelType !== 'video') {
          const httpPath = remark.startsWith('/') ? remark : `/${remark}`
          // 补齐 chat_id（优先使用大模型历史记录里的 _chatId，其次再从 currentConversationId 中解析）
          let chatIdStr: string | undefined
          const convIdForHttp = currentConversationId.value
          if (convIdForHttp) {
            const modelConv = modelChatHistory.value.find(c => c.id === convIdForHttp)
            if (modelConv && typeof modelConv._chatId === 'number') {
              chatIdStr = String(modelConv._chatId)
            } else if (convIdForHttp.startsWith('model-chat-')) {
              chatIdStr = convIdForHttp.replace('model-chat-', '')
            }
          }
          if (!chatIdStr) {
            try {
              const mark = messageContent.slice(0, 30) || t('floatingChat.newConversation')
              const res = await createChatRecord({
                user_uuid: userUuid,
                model_name: selectedModel.value.name,
                mark,
              })
              if (res.success && res.data) {
                currentConversationId.value = `model-chat-${res.data.id}`
                chatIdStr = String(res.data.id)
                modelChatHistory.value = [
                  {
                    id: `model-chat-${res.data.id}`,
                    title: mark,
                    messages: [],
                    createTime: res.data.create_time,
                    _chatId: res.data.id,
                  },
                  ...modelChatHistory.value,
                ]
              }
            } catch (e) {
              logger.error('Failed to create LLM conversation record (HTTP):', e)
            }
          }

          // 从模型配置中透传自定义参数（与 ai_index2 一致：归一化 value 为对象时的 value.value）
          const zidingyican = normalizeZidingyican(modelCfg.variables ?? [])
          const resp = await request.post(httpPath, {
            prompt: messageContent,
            user_uuid: userUuid,
            chat_id: chatIdStr,
            zidingyican,
          }) as unknown as ApiResponsePayload
          const payload = (resp.data ?? resp) as ApiResponsePayload

          // 优先处理图片结果：image_url / image_urls
          const imageUrls: string[] = []
          if (Array.isArray(payload?.image_url)) {
            imageUrls.push(...payload.image_url.filter((u: unknown): u is string => typeof u === 'string'))
          } else if (typeof payload?.image_url === 'string') {
            imageUrls.push(payload.image_url)
          }
          if (Array.isArray(payload?.image_urls)) {
            imageUrls.push(...payload.image_urls.filter((u: unknown): u is string => typeof u === 'string'))
          }

          // 音频/音乐结果（如 Suno）：data[0].audio_url
          let audioUrl: string | undefined
          let audioTitle: string | undefined
          let audioPrompt: string | undefined
          const dataField = payload?.data
          const firstItem =
            Array.isArray(dataField) && dataField.length > 0
              ? dataField[0]
              : Array.isArray(payload) && payload.length > 0
                ? payload[0]
                : undefined
          if (firstItem && typeof firstItem === 'object' && 'audio_url' in firstItem) {
            audioUrl = (firstItem as { audio_url?: string }).audio_url
            audioTitle = (firstItem as { title?: string }).title
            audioPrompt = (firstItem as { prompt?: string }).prompt
          }

          if (imageUrls.length > 0) {
            // 用 Markdown 展示图片列表
            const title = typeof payload?.message === 'string' ? payload.message : t('floatingChat.generatedImage')
            const mdImages = imageUrls
              .map((url: string, index: number) => `![${title} ${imageUrls.length > 1 ? `#${index + 1}` : ''}](${url})`)
              .join('\n\n')

            assistantMessage.content = `**${title}**\n\n${mdImages}`
            assistantMessage.files = imageUrls.map((url: string, index: number) => ({
              id: `img-${Date.now()}-${index}`,
              name: `generated-image-${index + 1}.png`,
              type: 'image/png',
              preview: url,
              size: 0,
              uploadedAt: Date.now(),
            }))

            assistantMessage.status = 'sent'
            assistantMessage.isStreaming = false
            isTyping.value = false
            userMessage.status = 'sent'

            if (isAutoSave.value) {
              saveConversation()
            }
            emit('message-received', assistantMessage)
            scrollToBottom(true)
            return
          }

          // 如果返回的是音乐/音频结果，优先使用 audio_url 回显播放器
          if (audioUrl) {
            const title = audioTitle || t('floatingChat.musicGenerationSuccess')
            const promptForShow = audioPrompt || messageContent
            assistantMessage.content = `**${title}**\n\n<audio controls src="${audioUrl}"></audio>\n\n${promptForShow}`
            assistantMessage.metadata = {
              ...(assistantMessage.metadata || {}),
              audioUrl,
            }
            assistantMessage.files = [
              {
                id: `music-${Date.now()}`,
                name: `${title || 'generated-music'}.mp3`,
                type: 'audio/mpeg',
                preview: audioUrl,
                size: 0,
                uploadedAt: Date.now(),
              },
            ]

            assistantMessage.status = 'sent'
            assistantMessage.isStreaming = false
            isTyping.value = false
            userMessage.status = 'sent'

            if (isAutoSave.value) {
              saveConversation()
            }
            emit('message-received', assistantMessage)
            scrollToBottom(true)
            return
          }

          // 非图片/音频结果：优先抽取文本
          const extracted =
            (typeof payload === 'string' ? payload : undefined) ??
            (typeof payload?.content === 'string' ? payload.content : undefined) ??
            (typeof payload?.text === 'string' ? payload.text : undefined) ??
            (typeof payload?.result === 'string' ? payload.result : undefined) ??
            (typeof payload?.message === 'string' ? payload.message : undefined)

          if (extracted && extracted.trim()) {
            assistantMessage.content = extracted
          } else {
            // 若 HTTP 返回结构非文本，作为 JSON 展示，避免“看起来没调用接口”
            assistantMessage.content = typeof payload === 'object' ? JSON.stringify(payload, null, 2) : String(payload ?? '')
          }

          assistantMessage.status = 'sent'
          assistantMessage.isStreaming = false
          isTyping.value = false
          userMessage.status = 'sent'

          if (isAutoSave.value) {
            saveConversation()
          }
          emit('message-received', assistantMessage)
          scrollToBottom(true)
          return
        }
      } catch (httpError) {
        logger.warn('[ModelChat] HTTP remark call failed, fallback to websocket:', httpError)
        // 失败则继续走 WebSocket 逻辑
      }

      // 参考 LLMChatCenter：若无对话记录 ID 且为首条消息，先创建新对话记录
      let chatIdStr: string | undefined
      const convId = currentConversationId.value
      if (convId && convId.startsWith('model-chat-')) {
        chatIdStr = convId.replace('model-chat-', '')
      }
      if (!chatIdStr && messages.value.length <= 1) {
        // 首条消息，创建新对话记录（参考 LLMChatCenter createNewChatRecord）
        try {
          const mark = messageContent.slice(0, 30) || t('floatingChat.newConversation')
          const res = await createChatRecord({
            user_uuid: userUuid,
            model_name: selectedModel.value.name,
            mark,
          })
          if (res.success && res.data) {
            currentConversationId.value = `model-chat-${res.data.id}`
            chatIdStr = String(res.data.id)
            modelChatHistory.value = [
              { id: `model-chat-${res.data.id}`, title: mark, messages: [], createTime: res.data.create_time, _chatId: res.data.id },
              ...modelChatHistory.value,
            ]
          }
        } catch (e) {
          logger.error('Failed to create LLM conversation record:', e)
          showError(t('floatingChat.createChatFailed'))
          isSending.value = false
          isTyping.value = false
          return
        }
      }

      // 关闭之前的 WebSocket 连接
      if (currentModelWebSocket.value) {
        try {
          currentModelWebSocket.value.close()
        } catch (e) {
          logger.warn('Failed to close previous WebSocket connection:', e)
        }
        currentModelWebSocket.value = null
      }

      // 传参参考 llmChat.service：user_uuid, query, chat_id（后端 user-model-chat 的 id）
      const wsParams = {
        user_uuid: userUuid,
        query: messageContent,
        chat_id: chatIdStr,
      }

      // 如果是“视频类”大模型，走视频生成链路（handleVideoGeneration 内会按 remark/quest_type 调对应接口）
      if (modelType === 'video') {
        await handleVideoGeneration(messageContent, files as unknown as FileAttachment[], assistantMessage)
        return
      }

      // 音频/音乐类模型不走“对话 WebSocket”，否则会误连默认的 /ws/qwen/stream
      if (modelType === 'audio') {
        const looksLikeMusic =
          modelName.includes('suno') ||
          modelSource.includes('suno') ||
          modelName.includes('udio') ||
          modelSource.includes('udio') ||
          modelName.includes('music') ||
          modelSource.includes('music')

        if (looksLikeMusic) {
          await handleMusicGeneration(messageContent, files as unknown as FileAttachment[], assistantMessage)
        } else {
          await handleAudioGeneration(messageContent, files as unknown as FileAttachment[], assistantMessage)
        }
        return
      }

      // 其余仍按模型名称选择对应的对话 WebSocket
      if (modelName.includes('qwen') || modelName.includes('通义')) {
        if (modelName.includes('omni')) {
          // 通义千问Omni
          currentModelWebSocket.value = createQwenOmniWebSocket(
            wsParams,
            (event: ChatStreamEvent) => handleModelStreamEvent(event, assistantMessage, userMessage),
            (e: Event) => handleModelStreamError(e, assistantMessage, userMessage),
            () => handleModelStreamClose(assistantMessage, userMessage)
          )
        } else {
          // 通义千问
          currentModelWebSocket.value = createQwenWebSocket(
            wsParams,
            (event: ChatStreamEvent) => handleModelStreamEvent(event, assistantMessage, userMessage),
            (e: Event) => handleModelStreamError(e, assistantMessage, userMessage),
            () => handleModelStreamClose(assistantMessage, userMessage)
          )
        }
      } else if (modelName.includes('zhipu') || modelName.includes('智谱')) {
        // 智谱AI
        currentModelWebSocket.value = createZhipuWebSocket(
          wsParams,
          (event: ChatStreamEvent) => handleModelStreamEvent(event, assistantMessage, userMessage),
          (e: Event) => handleModelStreamError(e, assistantMessage, userMessage),
          () => handleModelStreamClose(assistantMessage, userMessage)
        )
      } else if (modelName.includes('deepseek') || modelName.includes('deep seek')) {
        // DeepSeek
        currentModelWebSocket.value = createDeepSeekWebSocket(
          wsParams,
          (event: ChatStreamEvent) => handleModelStreamEvent(event, assistantMessage, userMessage),
          (e: Event) => handleModelStreamError(e, assistantMessage, userMessage),
          () => handleModelStreamClose(assistantMessage, userMessage)
        )
      } else if (modelName.includes('doubao') || modelName.includes('豆包')) {
        // 豆包
        currentModelWebSocket.value = createDoubaoWebSocket(
          wsParams,
          (event: ChatStreamEvent) => handleModelStreamEvent(event, assistantMessage, userMessage),
          (e: Event) => handleModelStreamError(e, assistantMessage, userMessage),
          () => handleModelStreamClose(assistantMessage, userMessage)
        )
      } else {
        // 默认使用通义千问
        logger.warn(`Unrecognized model name: ${modelName}, using default Qwen WebSocket`)
        currentModelWebSocket.value = createQwenWebSocket(
          wsParams,
          (event: ChatStreamEvent) => handleModelStreamEvent(event, assistantMessage, userMessage),
          (e: Event) => handleModelStreamError(e, assistantMessage, userMessage),
          () => handleModelStreamClose(assistantMessage, userMessage)
        )
      }
    } else if (currentAIMode.value === 'model') {
      // 大模型模式兜底：使用统一的流式生成接口（ihui API /ai/generate/stream）
      await streamGenerateContent(
        {
          prompt: messageContent,
          modelId: selectedModel.value?.modelCode || 'gpt-4',
          type: 'text',
          parameters: {
            temperature: 0.7,
            maxTokens: 2000,
            topP: 0.9,
          },
        },
        (chunk: string) => {
          assistantMessage.content += chunk
          // 优化滚动性能（节流滚动 - 每300ms滚动一次）
          if (!scrollThrottleTimer) {
            scrollThrottleTimer = window.setTimeout(() => {
              scrollToBottom(false) // 使用非平滑滚动以提高性能
              scrollThrottleTimer = null
            }, 300)
          }
        },
        (response) => {
          assistantMessage.status = 'sent'
          assistantMessage.isStreaming = false
          isTyping.value = false
          userMessage.status = 'sent'

          // 保存 Token 使用统计到元数据
          if (response.usage) {
            if (!assistantMessage.metadata) {
              assistantMessage.metadata = {}
            }
            assistantMessage.metadata.usage = {
              promptTokens: response.usage.promptTokens || 0,
              completionTokens: response.usage.completionTokens || 0,
              totalTokens: response.usage.totalTokens || 0,
            }
            assistantMessage.metadata.tokensUsed = response.usage.totalTokens || 0
          }

          // 清理滚动定时器
          if (scrollThrottleTimer !== null) {
            clearTimeout(scrollThrottleTimer)
            scrollThrottleTimer = null
          }

          // 保存对话（自动保存）
          if (isAutoSave.value) {
            saveConversation()
          }

          emit('message-received', assistantMessage)
          scrollToBottom(true) // 完成后平滑滚动到底部
        },
        (error) => {
          throw error
        }
      )
    } else {
      // 其余模式（如 MCP/hybrid 等）当前不支持直接对话，避免误调用错误接口
      showWarning(t('floatingChat.unsupportedMode'))
      assistantMessage.status = 'failed'
      assistantMessage.isStreaming = false
      isTyping.value = false
      userMessage.status = 'failed'
    }
  } catch (error) {
    logger.error(t('floatingChat.sendFailed'), error)
    userMessage.status = 'failed'
    userMessage.error = error instanceof Error ? error.message : String(error)

    const failedMessage = messages.value.find((m) => m.role === 'assistant' && m.status === 'sending')
    if (failedMessage) {
      failedMessage.status = 'failed'
      failedMessage.isStreaming = false
      failedMessage.error = error instanceof Error ? error.message : String(error)
    }

    // 清理滚动定时器
    if (scrollThrottleTimer !== null) {
      clearTimeout(scrollThrottleTimer)
      scrollThrottleTimer = null
    }

    isTyping.value = false

    // 提供更详细的错误信息
    let errorMessage = t('floatingChat.sendFailed')
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase()
      if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        errorMessage = t('floatingChat.networkError')
      } else if (errorMsg.includes('timeout')) {
        errorMessage = t('floatingChat.timeoutError')
      } else if (errorMsg.includes('403') || errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
        errorMessage = t('floatingChat.authError')
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        errorMessage = t('floatingChat.rateLimitError')
      } else if (errorMsg.includes('500') || errorMsg.includes('server')) {
        errorMessage = t('floatingChat.serverError')
      }
    }

    showError(errorMessage)
  } finally {
    isSending.value = false
    scrollToBottom(true)

    // 聚焦输入框
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}

// 菜单操作 - 增强功能
const handleMenuCommand = async (command: string) => {
  switch (command) {
    case 'export':
      exportChat('txt')
      break
    case 'export-markdown':
      exportChat('markdown')
      break
    case 'export-json':
      exportChat('json')
      break
    case 'clear':
      await clearChat()
      break
    case 'settings':
      // 打开设置对话框
      showSettingsDialog.value = true
      break
    case 'stats':
      // 显示统计信息
      showStatsDialog.value = true
      break
    case 'history':
      // 显示历史记录
      showHistoryPanel.value = true
      break
    case 'tickets':
      // 客服主题：跳转工单
      router.push('/user?tab=tickets').catch(() => { /* NavigationDuplicated 错误，无需处理 */ })
      break
    case 'customer-service':
      // 在对话框内切换为客服模式，不跳转
      switchToCustomerServiceInPlace()
      break
    case 'ai-capabilities':
      // 显示AI能力面板
      showAICapabilityPanel.value = true
      break
  }
}

// 导出对话 - 增强功能（支持多种格式）
const exportChat = async (format: 'txt' | 'markdown' | 'json' = 'txt') => {
  if (messages.value.length === 0) {
    showWarning(t('floatingChat.noMessagesToExport'))
    return
  }

  let content = ''
  let filename = ''
  let mimeType = ''

  try {
    switch (format) {
      case 'markdown': {
        content = `# ${dialogTitle.value}\n\n`
        content += `${t('floatingChat.exportTimeLabel')}: ${new Date().toLocaleString('zh-CN')}\n`
        content += `${t('floatingChat.model')}: ${selectedModel.value ? getModelDisplayName(selectedModel.value) : t('floatingChat.unknown')}\n\n`
        content += '---\n\n'
        messages.value.forEach((msg, index) => {
          const role = msg.role === 'user' ? `**${t('floatingChat.user')}**` : `**${t('floatingChat.aiAssistant')}**`
          const time = formatTime(String(msg.createTime))
          content += `## ${index + 1}. ${role} (${time})\n\n`
          content += `${msg.content}\n\n`
          if (msg.files && msg.files.length > 0) {
            content += `**${t('floatingChat.attachments')}:**\n`
            msg.files.forEach((file) => {
              content += `- ${file.name}\n`
            })
            content += '\n'
          }
          content += '---\n\n'
        })
        filename = `chat-${new Date().toISOString().split('T')[0]}.md`
        mimeType = 'text/markdown'
        break
      }
      case 'json': {
        const exportData = {
          title: dialogTitle.value,
          exportTime: new Date().toISOString(),
          model: selectedModel.value?.name || t('floatingChat.unknown'),
          messageCount: messages.value.length,
          messages: messages.value.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createTime: msg.createTime,
            files: msg.files,
            status: msg.status,
            liked: msg.liked,
            edited: msg.edited,
            model: msg.model,
          })),
        }
        content = JSON.stringify(exportData, null, 2)
        filename = `chat-${new Date().toISOString().split('T')[0]}.json`
        mimeType = 'application/json'
        break
      }
      default: {
        content = `${dialogTitle.value}\n`
        content += `${t('floatingChat.exportTimeLabel')}: ${new Date().toLocaleString('zh-CN')}\n`
        content += `${t('floatingChat.model')}: ${selectedModel.value ? getModelDisplayName(selectedModel.value) : t('floatingChat.unknown')}\n`
        content += `${'='.repeat(50)}\n\n`
        messages.value.forEach((msg) => {
          const role = msg.role === 'user' ? t('floatingChat.user') : t('floatingChat.aiAssistant')
          const time = formatTime(String(msg.createTime))
          content += `[${time}] ${role}:\n${msg.content}\n\n`
          if (msg.files && msg.files.length > 0) {
            content += `${t('floatingChat.attachments')}: ${msg.files.map((f) => f.name).join(', ')}\n\n`
          }
        })
        filename = `chat-${new Date().toISOString().split('T')[0]}.txt`
        mimeType = 'text/plain'
      }
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showSuccess(t('floatingChat.exported'))
  } catch (error) {
    logger.error(t('floatingChat.exportFailed'), error)
    showError(t('floatingChat.exportFailed'))
  }
}

const clearChat = async () => {
  if (messages.value.length === 0) {
    showInfo(t('floatingChat.noMessagesToClear'))
    return
  }

  const confirmed = await confirm(
    t('floatingChat.clearChatConfirm'),
    t('floatingChat.confirmClear')
  )
  if (confirmed) {
    // 如果当前对话有ID，更新历史记录
    if (currentConversationId.value) {
      const history = StorageManager.getItem<Array<{ id: string; title: string; messages: ChatMessage[]; createTime: string }>>('floating-chat-history') || []
      const index = history.findIndex((c) => c.id === currentConversationId.value)
      if (index > -1) {
        history[index].messages = []
        StorageManager.setItem('floating-chat-history', history)
        conversationHistory.value = history
      }
      currentConversationId.value = null
    }

    messages.value = []
    unreadCount.value = 0
    showSuccess(t('floatingChat.cleared'))
  }
}

// 引用消息功能
const replyToMessage = (message: ChatMessage) => {
  replyingToMessageId.value = message.id
  quotedMessage.value = {
    id: message.id,
    content: message.content,
    role: message.role,
    status: 'sent',
    createTime: message.createTime,
  }

  // 聚焦输入框
  nextTick(() => {
    inputRef.value?.focus()
    // 在输入框前添加引用提示
    if (inputRef.value) {
      inputRef.value.setAttribute('data-replying-to', message.id)
    }
  })

  showInfo(t('floatingChat.replyingTo', { role: message.role === 'user' ? t('common.user') : 'AI' }))
}

// 取消引用
const cancelReply = () => {
  replyingToMessageId.value = null
  quotedMessage.value = null
  if (inputRef.value) {
    inputRef.value.removeAttribute('data-replying-to')
  }
}

// ======= 发布到社区功能 =======
const { publishImage, publishArticle, publishCode, publishVideo, publishAudio } = useCommunityPublish()

/**
 * 判断消息是否可以发布到社区
 */
const canPublishToCommunity = (message: ChatMessage): boolean => {
  // 只有AI助手的消息可以发布
  if (message.role !== 'assistant') return false

  // 有内容才能发布
  if (!message.content || message.content.trim().length === 0) return false

  // 正在发送或流式输出中的消息不能发布
  if (message.status === 'sending' || message.isStreaming) return false

  return true
}

/**
 * 发布消息到社区
 */
const publishToCommunity = (message: ChatMessage) => {
  // 检查消息内容类型
  const content = message.content || ''

  // 检查是否包含图片（markdown格式或者HTML img标签）
  const imageMatch = content.match(/!\[.*?\]\((.*?)\)|<img.*?src="(.*?)"/)
  if (imageMatch) {
    const imageUrl = imageMatch[1] || imageMatch[2]
    publishImage({
      imageUrl,
      title: t('title.a_i_chat.来自智汇AI的创'),
      prompt: inputText.value || undefined,
      aiSource: 'ihui-ai',
      aiModelName: selectedModel.value?.name || selectedModel.value?.id,
    })
    return
  }

  // 检查是否是代码块
  const codeMatch = content.match(/```(\w+)?\n([\s\S]*?)```/)
  if (codeMatch) {
    const language = codeMatch[1] || undefined
    const code = codeMatch[2]
    publishCode({
      code,
      title: t('title.a_i_chat.来自智汇AI的代1'),
      language,
      prompt: inputText.value || undefined,
      aiSource: 'ihui-ai',
      aiModelName: selectedModel.value?.name || selectedModel.value?.id,
    })
    return
  }

  // 检查是否包含视频链接
  const videoMatch = content.match(/(https?:\/\/[^\s]+\.(mp4|webm|mov))/i)
  if (videoMatch) {
    publishVideo({
      videoUrl: videoMatch[1],
      title: t('title.a_i_chat.来自智汇AI的视2'),
      prompt: inputText.value || undefined,
      aiSource: 'ihui-ai',
      aiModelName: selectedModel.value?.name || selectedModel.value?.id,
    })
    return
  }

  // 检查是否包含音频链接
  const audioMatch = content.match(/(https?:\/\/[^\s]+\.(mp3|wav|ogg|flac))/i)
  if (audioMatch) {
    publishAudio({
      audioUrl: audioMatch[1],
      title: t('title.a_i_chat.来自智汇AI的音3'),
      prompt: inputText.value || undefined,
      aiSource: 'ihui-ai',
      aiModelName: selectedModel.value?.name || selectedModel.value?.id,
      isMusic: true,
    })
    return
  }

  // 默认作为文章发布
  publishArticle({
    content: content,
    title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
    prompt: inputText.value || undefined,
    aiSource: 'ihui-ai',
    aiModelName: selectedModel.value?.name || selectedModel.value?.id,
  })
}

// 代码块复制处理
const handleMessageTextClick = (event: MouseEvent) => {
  // 检查是否点击的是代码块复制按钮
  const target = event.target as HTMLElement
  if (target.classList.contains('code-copy-btn') || target.closest('.code-copy-btn')) {
    return // 由MarkdownStream组件处理
  }

  // 检查是否点击的是代码块本身
  const codeBlock = target.closest('pre code')
  if (codeBlock) {
    // 双击代码块直接复制
    if (event.detail === 2) {
      copyCodeBlock(codeBlock as HTMLElement)
    }
  }
}

const copyCodeBlock = async (codeElement: HTMLElement) => {
  const codeText = codeElement.textContent || ''
  if (!codeText.trim()) return

  const result = await ClipboardManager.copy(codeText)
  if (result.success) {
    showSuccess(t('floatingChat.codeCopied'))
  } else {
    showError(t('floatingChat.codeCopyFailed'))
  }
}

// 消息统计 - 增强功能
const getMessageStats = computed(() => {
  const userMessages = messages.value.filter((m) => m.role === 'user')
  const assistantMessages = messages.value.filter((m) => m.role === 'assistant')

  const stats = {
    total: messages.value.length,
    user: userMessages.length,
    assistant: assistantMessages.length,
    withFiles: messages.value.filter((m) => m.files && m.files.length > 0).length,
    failed: messages.value.filter((m) => m.status === 'failed').length,
    liked: messages.value.filter((m) => m.liked).length,
    edited: messages.value.filter((m) => m.edited).length,
    streaming: messages.value.filter((m) => m.isStreaming).length,
    // 计算平均消息长度
    avgUserMessageLength: userMessages.length > 0
      ? Math.round(userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length)
      : 0,
    avgAssistantMessageLength: assistantMessages.length > 0
      ? Math.round(assistantMessages.reduce((sum, m) => sum + m.content.length, 0) / assistantMessages.length)
      : 0,
    // 最早和最晚消息时间
    earliestMessage: messages.value.length > 0 ? messages.value[0]?.createTime : null,
    latestMessage: messages.value.length > 0 ? messages.value[messages.value.length - 1]?.createTime : null,
  }
  return stats
})

// 模型选择 - 增强功能：切换模型后消息区展示该模型下的会话（重新拉取历史并自动选最新一条）
const handleModelSelect = (modelCode: string) => {
  const model = availableModels.value.find((m) => m.modelCode === modelCode)
  if (!model) return
  const prevModelCode = selectedModel.value?.modelCode
  selectedModel.value = model
  const modelDisplayName = getModelDisplayName(model)
  showSuccess(t('floatingChat.modelChanged', { model: modelDisplayName }))

  // 大模型模式下切换了模型：清空当前消息并拉取新模型的历史，自动加载最新会话
  if (currentAIMode.value === 'model' && prevModelCode !== modelCode) {
    messages.value = []
    currentConversationId.value = null
    loadModelChatHistory({ autoSelectLatest: true })
  }
}

// ========== API 接入功能 ==========

// 打开API接入对话框
const openApiAccessDialog = async (model: Model) => {
  const modelDisplayName = getModelDisplayName(model)
  apiAccessInfo.value = {
    apiKey: '',
    baseUrl: getApiBaseUrl(),
    modelId: model.modelCode || '',
    modelName: modelDisplayName,
  }

  showApiKey.value = false
  showApiAccessDialog.value = true

  // 获取或生成API Key
  await loadOrGenerateApiKey(model)
}

// 从 API 接入对话框跳转到接入文档（开放平台文档）
const openApiAccessDoc = () => {
  showApiAccessDialog.value = false
  router.push('/open/docs').catch(() => { /* NavigationDuplicated 错误，无需处理 */ })
}

// 获取API基础URL
const getApiBaseUrl = (): string => {
  // 统一使用相对路径，由部署环境的反向代理转发到后端
  return '/api'
}

// 加载或生成API Key
const loadOrGenerateApiKey = async (model: Model) => {
  try {
    isGeneratingApiKey.value = true

    // 尝试从本地存储获取已有的API Key
    const storedKeys = StorageManager.getItem<Record<string, string>>('user-api-keys') || {}
    const userUuid = getUserUuid()
    const keyId = `${userUuid}-${model.modelCode}`

    if (storedKeys[keyId]) {
      apiAccessInfo.value.apiKey = storedKeys[keyId]
    } else {
      // 生成新的API Key
      const newKey = generateApiKey()
      storedKeys[keyId] = newKey
      StorageManager.setItem('user-api-keys', storedKeys)
      apiAccessInfo.value.apiKey = newKey
    }
  } catch (error) {
    logger.error('Failed to load/generate API key:', error)
    showError(t('floatingChat.apiKeyGenerateFailed'))
  } finally {
    isGeneratingApiKey.value = false
  }
}

// 生成API Key
const generateApiKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = 'sk-'
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

// 重新生成API Key
const regenerateApiKey = async () => {
  try {
    isGeneratingApiKey.value = true

    const confirmed = await confirm(
      t('floatingChat.regenerateKeyConfirm'),
      t('floatingChat.regenerateKeyTitle')
    )

    if (!confirmed) {
      return
    }

    const newKey = generateApiKey()
    const userUuid = getUserUuid()
    const keyId = `${userUuid}-${apiAccessInfo.value.modelId}`

    const storedKeys = StorageManager.getItem<Record<string, string>>('user-api-keys') || {}
    storedKeys[keyId] = newKey
    StorageManager.setItem('user-api-keys', storedKeys)

    apiAccessInfo.value.apiKey = newKey
    showSuccess(t('floatingChat.apiKeyRegenerated'))
  } catch (error) {
    logger.error('Failed to regenerate API key:', error)
    showError(t('floatingChat.apiKeyGenerateFailed'))
  } finally {
    isGeneratingApiKey.value = false
  }
}

// 复制到剪贴板（使用 ClipboardManager 支持非安全上下文降级）
const copyToClipboard = async (text: string, label: string) => {
  const result = await ClipboardManager.copy(text)
  if (result.success) {
    showSuccess(t('floatingChat.copied', { label }))
  } else {
    logger.error('Failed to copy:', result.message)
    showError(t('floatingChat.copyFailed'))
  }
}

// 复制代码示例
const _copyCodeExample = async () => {
  const code = `curl ${apiAccessInfo.value.baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiAccessInfo.value.apiKey}" \\
  -d '{
    "model": "${apiAccessInfo.value.modelId}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`
  await copyToClipboard(code, t('floatingChat.codeExample'))
}

// 复制协议代码
const copyProtocolCode = async (protocol: string) => {
  const apiKey = apiAccessInfo.value.apiKey
  const baseUrl = apiAccessInfo.value.baseUrl
  const modelId = apiAccessInfo.value.modelId

  const codeTemplates: Record<string, string> = {
    'openai-python': `from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="${baseUrl}/v1"
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Hello!"}]
)`,
    'anthropic': `import anthropic

# 兼容 Anthropic 协议
client = anthropic.Anthropic(
    api_key="${apiKey}",
    base_url="${baseUrl}/anthropic"
)

message = client.messages.create(
    model="${modelId}",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)`,
    'azure': `from openai import AzureOpenAI

# Azure OpenAI 兼容接口
client = AzureOpenAI(
    api_key="${apiKey}",
    api_version="2024-02-01",
    azure_endpoint="${baseUrl}/azure"
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Hello!"}]
)`,
    'langchain': `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="${modelId}",
    api_key="${apiKey}",
    base_url="${baseUrl}/v1"
)

response = llm.invoke("Hello, how are you?")`,
    'llamaindex': `from llama_index.llms.openai import OpenAI

llm = OpenAI(
    model="${modelId}",
    api_key="${apiKey}",
    api_base="${baseUrl}/v1"
)

response = llm.complete("Hello!")`,
    'nodejs': `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '${apiKey}',
  baseURL: '${baseUrl}/v1'
});

const response = await client.chat.completions.create({
  model: '${modelId}',
  messages: [{ role: 'user', content: 'Hello!' }]
});`,
    'curl': `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${modelId}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'`,
    'ollama': `# 设置环境变量让 Ollama 客户端使用我们的 API
export OLLAMA_HOST="${baseUrl}/ollama"
export OLLAMA_API_KEY="${apiKey}"

# 使用 Ollama CLI
ollama run ${modelId} "Hello!"

# 或使用 Python
import ollama
client = ollama.Client(host="${baseUrl}/ollama")
response = client.chat(model="${modelId}", messages=[
    {"role": "user", "content": "Hello!"}
])`,
    'http': `POST ${baseUrl}/v1/chat/completions
Content-Type: application/json
Authorization: Bearer ${apiKey}

{
  "model": "${modelId}",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": true
}`
  }

  const code = codeTemplates[protocol] || ''
  if (code) {
    await copyToClipboard(code, t('aiChat.protocolCode', { protocol }))
  }
}

// getModelTagType 已迁移至 ChatHeaderBar.vue（chat-parts 拆分）

const getModelDisplayName = (model: Model): string => {
  // 优先使用 modelName（用户友好的显示名称），如果没有则使用 name，最后使用 modelCode
  // modelName 在 loadModels 中被设置为 displayName || name，是用户友好的名称
  // 而 name 可能是 UUID 或其他内部标识符
  return model.modelName || model.name || model.modelCode || t('floatingChat.unknown')
}

// 获取消息对应的模型图标
const getMessageModelIcon = (message: ChatMessage): string | null => {
  // 如果没有模型信息，使用当前选中的模型图标
  if (!message.model) {
    const icon = selectedModel.value?.icon
    return icon && icon.trim() ? icon : null
  }

  // 根据消息中的模型代码查找模型（优先匹配 modelCode，其次匹配 id）
  const model = availableModels.value.find(
    (m) => m.modelCode === message.model || m.id === message.model
  )

  if (model?.icon && model.icon.trim()) {
    return model.icon
  }

  // 如果找不到匹配的模型，使用当前选中的模型图标作为后备
  const fallbackIcon = selectedModel.value?.icon
  return fallbackIcon && fallbackIcon.trim() ? fallbackIcon : null
}

// 获取消息对应的模型显示名称
const getMessageModelDisplayName = (message: ChatMessage): string => {
  if (!message.model) {
    return selectedModel.value ? getModelDisplayName(selectedModel.value) : t('floatingChat.unknown')
  }

  // 根据消息中的模型代码查找模型（优先匹配 modelCode，其次匹配 id）
  const model = availableModels.value.find(
    (m) => m.modelCode === message.model || m.id === message.model
  )

  if (model) {
    return getModelDisplayName(model)
  }

  // 如果找不到匹配的模型，使用当前选中的模型名称作为后备
  return selectedModel.value ? getModelDisplayName(selectedModel.value) : t('floatingChat.unknown')
}

/** 从智能体对象中解析头像 URL（与 AICapabilitySelector getAgentIconUrl 一致，兼容后端多种字段名） */
const getAgentAvatarFromRaw = (agent: Record<string, unknown> | { avatar?: string; icon?: string; metadata?: Record<string, unknown> }): string | null => {
  if (!agent || typeof agent !== 'object') return null
  const a = agent as Record<string, unknown>
  const meta = (a.metadata as Record<string, unknown>) ?? {}
  const keys = [
    'agentAvatar', 'avatar', 'agent_avatar', 'icon_url', 'icon',
    'bot_avatar', 'headImg', 'head_img', 'cover', 'image', 'img', 'picture', 'photo',
    'logo', 'avatarUrl', 'iconUrl', 'portrait', 'thumb', 'thumbnail',
  ]
  for (const key of keys) {
    const v = (a[key] as string) ?? (meta[key] as string)
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** 规范化智能体名称用于匹配（去掉 [分类] 前缀，便于 t('aiChat.allInOneExpert') 与 t('aiChat.allInOneExpert') 匹配） */
const normalizeAgentNameForMatch = (name: string): string => {
  if (!name || typeof name !== 'string') return ''
  return name.replace(/^\s*\[[^\]]*\]\s*/, '').trim()
}

const agentNamesMatch = (a: string, b: string): boolean => {
  if (a === b) return true
  const na = normalizeAgentNameForMatch(a)
  const nb = normalizeAgentNameForMatch(b)
  if (na === nb) return true
  if (na && nb && (na.includes(nb) || nb.includes(na))) return true
  return false
}

// 获取消息对应的智能体头像（用于状态行与左侧头像展示）
// 优先用 agentsForSelector 中已标准化的 avatar，与能力面板展示一致
const getMessageAgentAvatar = (message: ChatMessage): string | null => {
  const meta = message.metadata as { agent_avatar?: string } | undefined
  if (meta?.agent_avatar && meta.agent_avatar.trim()) return meta.agent_avatar
  if (!message.metadata?.agent) return null
  const agentName = message.metadata.agent
  const normalizedMsg = normalizeAgentNameForMatch(agentName)
  const selectorList = agentsForSelector.value
  const fromSelector = selectorList.find((item) => {
    const itemName = item.name ?? (item as { agentName?: string }).agentName ?? ''
    return agentNamesMatch(itemName, agentName) || (normalizedMsg && normalizeAgentNameForMatch(itemName) === normalizedMsg)
  })
  if (fromSelector?.avatar) return fromSelector.avatar
  if (selectedAgent.value && agentNamesMatch(selectedAgent.value.name ?? '', agentName)) {
    const url = getAgentAvatarFromRaw(selectedAgent.value as unknown as Record<string, unknown>)
    if (url) return url
  }
  const fromList = unifiedAgents.value.find((a) => {
    const listName = (a as { name?: string }).name ?? (a as { agentName?: string }).agentName ?? (a as { botName?: string }).botName ?? ''
    return agentNamesMatch(listName, agentName)
  })
  if (fromList) {
    const url = getAgentAvatarFromRaw(fromList as Record<string, unknown>)
    if (url) return url
  }
  return null
}

// 助手消息左侧头像：优先按本条消息的智能体/模型展示，否则用当前选中
const getAssistantMessageAvatarUrl = (message: ChatMessage): string | null => {
  if (message.metadata?.agent) {
    const agentAvatar = getMessageAgentAvatar(message)
    if (agentAvatar) return agentAvatar
  }
  if (message.model) {
    const modelIcon = getMessageModelIcon(message)
    if (modelIcon) return modelIcon
  }
  return assistantAvatarUrl.value
}

// 能力下拉显隐变化：同步 ref（el-dropdown trigger 模式下内部状态不会自动同步回 v-model）
const onCapabilityDropdownVisibleChange = (val: boolean) => {
  showCapabilityDropdown.value = val
}

// 能力网格卡片点击：执行命令并关闭下拉（与工具箱一致交互）
const onCapabilityCardClick = (command: string) => {
  handleAICapabilityCommand(command)
  showCapabilityDropdown.value = false
}

// AI能力命令处理
const handleAICapabilityCommand = (command: string) => {
  logger.debug('[FloatingChatDialog] handleAICapabilityCommand called:', command)

  if (command.startsWith('mode:')) {
    const mode = command.split(':')[1] as 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'auto' | 'generation'
    // 禁止入口：AI生成模式已下线（部分旧页面/缓存可能仍会发出该命令）
    if (mode === 'generation') return
    switchAIMode(mode)
  } else if (command.startsWith('select:')) {
    const type = command.split(':')[1]
    logger.debug('[FloatingChatDialog] select command type:', type)
    // 禁止入口：AI生成模式已下线（部分旧页面/缓存可能仍会发出该命令）
    if (type === 'generation') return

    // 使用 nextTick 确保存下拉菜单关闭后再显示弹窗
    nextTick(() => {
      if (type === 'model') {
        showAICapabilityPanel.value = true
        currentAIMode.value = 'model'
        modelCategoryTab.value = 'talk' // 打开大模型面板时默认展示对话分类
        logger.debug('[FloatingChatDialog] Model panel opened, showAICapabilityPanel:', showAICapabilityPanel.value)
      } else if (type === 'agent') {
        showAICapabilityPanel.value = true
        currentAIMode.value = 'agent'
        logger.debug('[FloatingChatDialog] Agent panel opened, showAICapabilityPanel:', showAICapabilityPanel.value)
      } else if (type === 'mcp') {
        showAICapabilityPanel.value = true
        currentAIMode.value = 'mcp'
        logger.debug('[FloatingChatDialog] MCP panel opened, showAICapabilityPanel:', showAICapabilityPanel.value)
      }

      // 再次使用 nextTick 确保 DOM 完全更新
      nextTick(() => {
        logger.debug('[FloatingChatDialog] After double nextTick - showAICapabilityPanel:', showAICapabilityPanel.value)
        logger.debug('[FloatingChatDialog] After double nextTick - currentAIMode:', currentAIMode.value)

        // 验证弹窗元素是否存在
        const maskElement = document.querySelector('.service-mask')
        const popupElement = document.querySelector('.ai-capability-popup')
        logger.debug('[FloatingChatDialog] Mask element exists:', !!maskElement)
        logger.debug('[FloatingChatDialog] Popup element exists:', !!popupElement)
      })
    })
  }
}

// 加载模型列表 - 增强功能（同时加载统一AI能力）
const loadModels = async () => {
  try {
    const response = await getAvailableModels()
    logger.info('response', response)
    // 将 AIModelInfo 映射到 Model（保留 remark / quest_type / variables / category / type，用于按模型配置选择接口）
    availableModels.value = (response.data || []).map(
      (model): Model & { remark?: string; quest_type?: string; variables?: unknown } => ({
        modelCode: model.id,
        name: model.name,
        modelName: model.displayName || model.name,
        modelDesc: model.description,
        provider: model.provider,
        id: model.id,
        code: model.code,
        // 保留分类信息（从后端 AIModelInfo 类型推断）：用于区分对话/图片/视频/音频模型
        category: (model as { category?: 'talk' | 'image' | 'video' | 'audio' }).category,
        supportsStreaming: model.supportsStreaming,
        supportsImages: model.supportsImages,
        supportsAudio: model.supportsAudio,
        supportsVideo: model.supportsVideo,
        tags: model.tags,
        icon: model.icon,
        remark: (model as { remark?: string }).remark,
        quest_type: (model as { quest_type?: string }).quest_type,
        // 透传后端配置的 variables，用于 HTTP/WS 调用中的 zidingyican
        variables: (model as { variables?: unknown }).variables,
      })
    )
    if (availableModels.value.length > 0 && !selectedModel.value) {
      selectedModel.value = availableModels.value[0]
    }

    // 同时加载统一AI能力（模型会自动加载）
    // unifiedModels 会自动从 useUnifiedAI 获取
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    showError(t('floatingChat.loadModelsFailed'))
  }
}

// 加载Agent列表（同时加载快速问题建议）
const loadAgents = async () => {
  try {
    const response = await getAgentsList({
      page: 1,
      pageSize: 100,
      platform: 'all',
    })

    if (response && response.code === 200 && response.success && response.data?.list) {
      // unifiedAgents 会自动从 useUnifiedAI 获取
      logger.info(t('common.messages.loadSuccess'), response.data.list.length)

      // 加载快速问题建议（从当前选中的Agent或第一个Agent）
      if (response.data.list && response.data.list.length > 0) {
        const agent = selectedAgent.value
          ? response.data.list.find(a => a.id === selectedAgent.value?.id)
          : response.data.list[0]

        if (agent && agent.suggestedQuestions && Array.isArray(agent.suggestedQuestions) && agent.suggestedQuestions.length > 0) {
          suggestedQuestions.value = agent.suggestedQuestions.slice(0, 6) // 最多显示6个
        } else {
          suggestedQuestions.value = [
            t('floatingChat.defaultQuestion1'),
            t('floatingChat.defaultQuestion2'),
            t('floatingChat.defaultQuestion3'),
            t('floatingChat.defaultQuestion4'),
            t('floatingChat.defaultQuestion5'),
            t('floatingChat.defaultQuestion6'),
          ]
        }
      } else {
        suggestedQuestions.value = [
          t('floatingChat.defaultQuestion1'),
          t('floatingChat.defaultQuestion2'),
          t('floatingChat.defaultQuestion3'),
          t('floatingChat.defaultQuestion4'),
          t('floatingChat.defaultQuestion5'),
          t('floatingChat.defaultQuestion6'),
        ]
      }
    } else {
      // 使用默认问题
      suggestedQuestions.value = [
        t('floatingChat.defaultQuestion1'),
        t('floatingChat.defaultQuestion2'),
        t('floatingChat.defaultQuestion3'),
      ]
    }
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    suggestedQuestions.value = [
      t('floatingChat.defaultQuestion1'),
      t('floatingChat.defaultQuestion2'),
      t('floatingChat.defaultQuestion3'),
    ]
  }
}

// 使用快速问题建议
const useSuggestedQuestion = (question: string) => {
  inputText.value = question
  inputRef.value?.focus()

  // 生成模式已下线：不做任何生成意图识别/提示/切换

  // 光标移到末尾（contenteditable div 使用 Selection API）
  nextTick(() => {
    if (inputRef.value) {
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(inputRef.value)
      range.collapse(false) // collapse to end
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  })
}

// 使用常用工具
const useQuickTool = (toolText: string) => {
  // 优先从 DOM 获取当前文本，兜底用 inputText
  const domText = getInputText().trim()
  const currentText = domText || inputText.value.trim()

  // 计算新的文本
  const newText = currentText ? `${currentText} ${toolText}` : toolText

  // 同步到 DOM 和响应式状态
  setInputText(newText)
  inputText.value = newText

  inputRef.value?.focus()

  // 光标移到末尾
  nextTick(() => {
    if (inputRef.value) {
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(inputRef.value)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  })
}

// 快捷工具栏拖拽滚动事件处理
const handleToolsBarMouseDown = (e: MouseEvent) => {
  if (!quickToolsBarRef.value) return
  isDraggingToolsBar.value = true
  toolsBarStartX.value = e.pageX - quickToolsBarRef.value.offsetLeft
  toolsBarScrollLeft.value = quickToolsBarRef.value.scrollLeft
  quickToolsBarRef.value.style.cursor = 'grabbing'
  quickToolsBarRef.value.style.userSelect = 'none'
}

const handleToolsBarMouseMove = (e: MouseEvent) => {
  if (!isDraggingToolsBar.value || !quickToolsBarRef.value) return
  e.preventDefault()
  const x = e.pageX - quickToolsBarRef.value.offsetLeft
  const walk = (x - toolsBarStartX.value) * 1.5 // 滚动速度倍数
  quickToolsBarRef.value.scrollLeft = toolsBarScrollLeft.value - walk
}

const handleToolsBarMouseUp = () => {
  isDraggingToolsBar.value = false
  if (quickToolsBarRef.value) {
    quickToolsBarRef.value.style.cursor = 'grab'
    quickToolsBarRef.value.style.userSelect = ''
  }
}

const handleToolsBarMouseLeave = () => {
  if (isDraggingToolsBar.value) {
    handleToolsBarMouseUp()
  }
}

const switchAIMode = (mode: 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'auto' | 'generation') => {
  // 禁止切到 AI生成模式：统一回退到模型模式
  if (mode === 'generation') {
    currentAIMode.value = 'model'
    currentGenerationType.value = 'auto'
    return
  }
  currentAIMode.value = mode
  currentGenerationType.value = 'auto'
}

const handleAgentSelect = (agent: Agent) => {
  selectedAgent.value = agent
  currentAIMode.value = 'agent'
}

// 暴露方法供外部调用
defineExpose({
  openDialog,
  closeDialog,
  focusInput: () => {
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus()
        // 将光标移到末尾
        const range = document.createRange()
        const selection = window.getSelection()
        if (selection && inputRef.value.childNodes.length > 0) {
          range.selectNodeContents(inputRef.value)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    })
  },
  setInitialText: (text: string) => {
    setInputText(text)
    inputText.value = text // 保持同步
    nextTick(() => {
      handleInputChange()
    })
  },
  setInitialAgentTag: (agentName: string, avatar?: string) => {
    setAgentTagInInput(agentName, avatar)
    inputText.value = getInputText()
    nextTick(() => handleInputChange())
  },
  switchMode: switchAIMode,
  selectAgent: handleAgentSelect,
  selectModel: handleModelSelect,
  // 打开 AI 能力选择器面板（model/agent/mcp），供外部 CTA 按钮调用
  openCapabilityPanel: (mode?: 'model' | 'agent' | 'mcp') => {
    if (mode) {
      handleAICapabilityCommand(`select:${mode}`)
    } else {
      showAICapabilityPanel.value = true
    }
  },
  // streaming 前端准备：供 useGlobalChat.open({ autoSend: true }) 自动发送预填 prompt
  // 包装 handleSend（无参，从 inputText.value 读取已预填内容）
  sendMessage: handleSend,
})

// 对话框展示时，内容区域滚动到底部
watch(isVisible, (visible) => {
  if (visible) {
    nextTick(() => {
      if (isMinimized.value && props.mode === 'floating') {
        syncMinimizedDialogWidth()
        const id = requestAnimationFrame(() => {
          chatRafIds.delete(id)
          syncMinimizedDialogWidth()
        })
        chatRafIds.add(id)
        setTimeout(syncMinimizedDialogWidth, 80)
      }
      startAutoStickToBottom()
      setTimeout(() => {
        scrollMessagesToBottomHard()
        scrollToLastMessageIntoView()
      }, 120)
      setTimeout(() => {
        scrollMessagesToBottomHard()
        scrollToLastMessageIntoView()
      }, 320)
    })
  } else {
    // 隐藏时停止自动贴底并解除观察，避免不必要的开销
    autoStickToBottomEnabled = false
    if (autoStickToBottomTimer !== null) {
      clearTimeout(autoStickToBottomTimer)
      autoStickToBottomTimer = null
    }
    if (messagesResizeObserver && messagesContainerRef.value) {
      try {
        messagesResizeObserver.unobserve(messagesContainerRef.value)
      } catch {
        // ignore
      }
    }
  }
})

// 监听props变化
watch(() => props.visible, (newVal) => {
  isVisible.value = newVal
  if (newVal) {
    openDialog()
  }
})

watch(() => props.model, (newVal) => {
  if (newVal) {
    const model = availableModels.value.find((m) => m.modelCode === newVal)
    if (model) {
      selectedModel.value = model
      currentAIMode.value = 'model'
    }
  }
})

// 对话历史管理 - 增强功能（支持后端同步）
const saveConversation = async () => {
  if (!isAutoSave.value || messages.value.length === 0) return

  try {
    const conversationId = currentConversationId.value || `conv-${Date.now()}`

    // 生成对话标题（使用第一条用户消息）
    const firstUserMessage = messages.value.find((m) => m.role === 'user')
    const title = firstUserMessage?.content?.substring(0, 50).replace(/\n/g, ' ') || t('floatingChat.newConversation')

    const conversation = {
      id: conversationId,
      title: title,
      messages: messages.value.map(msg => ({ ...msg })), // 深拷贝
      createTime: currentConversationId.value
        ? (conversationHistory.value.find(c => c.id === conversationId)?.createTime || new Date().toISOString())
        : new Date().toISOString(),
    }

    // 1. 保存到localStorage（优先，快速）
    const history = StorageManager.getItem<Array<typeof conversation>>('floating-chat-history') || []
    const existingIndex = history.findIndex((c) => c.id === conversationId)
    if (existingIndex > -1) {
      history[existingIndex] = { ...history[existingIndex], ...conversation }
    } else {
      history.unshift(conversation)
      currentConversationId.value = conversationId
      if (history.length > 50) {
        history.splice(50)
      }
    }
    StorageManager.setItem('floating-chat-history', history)
    conversationHistory.value = history

    // 2. 同步到后端（可选，异步进行，不阻塞）
    if (enableBackendSync.value) {
      try {
        interface ConversationWithBackendId {
          id: string
          title: string
          messages: ChatMessage[]
          createTime: string
          backendId?: string
          backendSynced?: boolean
        }
        const existingConversation = conversationHistory.value.find(c => c.id === conversationId && 'backendId' in c && (c as ConversationWithBackendId).backendId) as ConversationWithBackendId | undefined

        if (existingConversation && existingConversation.backendId) {
          // 更新现有对话标题（如果需要）
          await updateConversationTitle(existingConversation.backendId, title)
        } else {
          // 创建新对话
          const backendResponse = await createConversation({
            title: title,
            model: currentAIMode.value === 'model' ? selectedModel.value?.modelCode : undefined,
            botId: currentAIMode.value === 'agent' && selectedAgent.value ? String(selectedAgent.value.id) : undefined,
          })

          if (backendResponse.success && backendResponse.data) {
            // 保存后端ID，用于后续同步
            const updatedHistory = conversationHistory.value.map(c =>
              c.id === conversationId
                ? { ...c, backendId: backendResponse.data?.id, backendSynced: true }
                : c
            )
            StorageManager.setItem('floating-chat-history', updatedHistory)
            conversationHistory.value = updatedHistory
          }
        }
      } catch (backendError) {
        // 后端同步失败不影响本地保存，静默失败
        logger.warn(t('common.errors.operationFailed'), backendError)
      }
    }
  } catch (error) {
    logger.error(t('common.errors.saveFailed'), error)
    // 不显示错误，避免打扰用户
  }
}

// 加载对话（支持从后端加载 + 大模型 chatHistory.service）
const loadConversation = async (
  conversationId: string,
  options?: {
    /** 自动加载/静默加载时不弹成功提示 */
    silentToast?: boolean
  }
) => {
  // 大模型模式：从 chatHistory.service 拉取消息
  if (conversationId.startsWith('model-chat-') && selectedModel.value) {
    const chatId = conversationId.replace(/^model-chat-/, '')
    const userUuid = getUserUuid()
    if (!userUuid) {
      showError(t('floatingChat.pleaseLogin'))
      return
    }
    try {
      const res = await getChatHistoryMessages({
        user_uuid: userUuid,
        // model_name 传大模型列表的 name 值（与 user-model-chat/query 一致）
        model_name: selectedModel.value.name || getModelDisplayName(selectedModel.value),
        chat_id: chatId,
        limit: 100,
      })

      // 兼容不同返回形态：ApiResponse<{messages}> / 直接 {messages} / {data:{messages}}
      const raw = (res as unknown as { data?: unknown })?.data ?? res
      const msgs = (raw as { messages?: Array<{ role?: string; content?: string }> })?.messages
        ?? (raw as { data?: { messages?: Array<{ role?: string; content?: string }> } })?.data?.messages

      // 辅助函数：将历史消息内容中的 Suno 等音乐返回结构转成可播放的音频 HTML
      const normalizeHistoryContent = (raw: unknown): string => {
        if (!raw) return ''
        if (typeof raw === 'string') {
          const trimmed = raw.trim()
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
              const parsed = JSON.parse(trimmed)
              return normalizeHistoryContent(parsed)
            } catch {
              return raw
            }
          }
          return raw
        }
        if (Array.isArray(raw) && raw.length > 0) {
          const first = raw[0] as AudioDataItem
          if (first && typeof first === 'object' && 'audio_url' in first) {
            const audioUrl = first.audio_url
            if (!audioUrl) return ''
            const title = first.title || ''
            const prompt = first.prompt || ''
            let content = ''
            if (title) content += `**${title}**\n\n`
            content += `<audio controls src="${audioUrl}"></audio>`
            if (prompt) content += `\n\n${prompt}`
            return content
          }
        }
        if (raw && typeof raw === 'object') {
          const obj = raw as { data?: unknown[] }
          if (Array.isArray(obj.data) && obj.data.length > 0) {
            const fromData = normalizeHistoryContent(obj.data)
            if (fromData) return fromData
          }
        }
        if (raw && typeof raw === 'object' && 'audio_url' in (raw as AudioDataItem)) {
          const obj = raw as AudioDataItem
          const audioUrl = obj.audio_url
          if (!audioUrl) return ''
          const title = obj.title || ''
          const prompt = obj.prompt || ''
          let content = ''
          if (title) content += `**${title}**\n\n`
          content += `<audio controls src="${audioUrl}"></audio>`
          if (prompt) content += `\n\n${prompt}`
          return content
        }
        return String(raw)
      }

      if (Array.isArray(msgs)) {
        messages.value = msgs.map((msg: HistoryMessage, idx: number) => {
          const rawTime =
            msg.create_time ||
            msg.created_at ||
            msg.createdAt ||
            msg.timestamp
          const createTime = rawTime ? new Date(rawTime).toISOString() : new Date().toISOString()

          const meta = (msg.metadata as Record<string, unknown>) || {}
          let videoUrl =
            (msg.agent_url as string) ||
            (meta.videoUrl as string) ||
            (msg.video_url as string) ||
            (msg.videoUrl as string)
          let videoUrlList = Array.isArray(meta.videoUrlList)
            ? meta.videoUrlList as string[]
            : Array.isArray(msg.video_url_list)
              ? msg.video_url_list
              : undefined
          const rawFiles = Array.isArray(msg.files) ? msg.files : undefined
          if (!videoUrl && !videoUrlList?.length && rawFiles?.length) {
            const videoPreviews = rawFiles
              .filter(f => (f.type && f.type.startsWith('video/')) || (f.preview && /\.(mp4|webm|mov)(\?|$)/i.test(f.preview || '')))
              .map(f => f.preview)
              .filter((p): p is string => typeof p === 'string')
            if (videoPreviews.length === 1) videoUrl = videoPreviews[0]
            else if (videoPreviews.length > 1) videoUrlList = videoPreviews
          }
          const metadata: Record<string, unknown> = { ...meta }
          if (videoUrl) metadata.videoUrl = videoUrl
          if (videoUrlList?.length) metadata.videoUrlList = videoUrlList

          const files: PlatformFileAttachment[] | undefined = rawFiles?.length
            ? rawFiles.map((f): PlatformFileAttachment => ({
              id: f.id ?? `file-${idx}-${Date.now()}`,
              name: f.name ?? 'video.mp4',
              type: f.type ?? 'video/mp4',
              preview: f.preview ?? '',
              size: typeof f.size === 'number' ? f.size : 0,
              uploadedAt: (f as { uploadedAt?: number }).uploadedAt ?? new Date(createTime).getTime(),
            }))
            : undefined

          const normalizedContent = normalizeHistoryContent(msg.content)

          return {
            id: `model-msg-${chatId}-${idx}`,
            role: (msg.role || 'user') as 'user' | 'assistant',
            content: normalizedContent || (msg.content || ''),
            status: 'sent' as const,
            createTime,
            ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
            ...(files?.length ? { files } : {}),
          } as ChatMessage
        })
        currentConversationId.value = conversationId
        showHistoryPanel.value = false
        nextTick(() => {
          scrollToBottom(true)
          inputRef.value?.focus()
        })
        if (!options?.silentToast) {
          showSuccess(t('floatingChat.conversationLoaded'))
        }
      } else {
        showError(t('floatingChat.conversationNotFound'))
      }
    } catch (e) {
      logger.error('Failed to load LLM conversation', e)
      showError(t('common.errors.fetchFailed'))
    }
    return
  }

  // 先尝试从本地加载
  let conversation = conversationHistory.value.find((c) => c.id === conversationId)

  // 如果本地没有，尝试从后端加载（如果有backendId）
  if (!conversation && enableBackendSync.value) {
    try {
      // 查找是否有backendId
      interface ConversationWithBackendId {
        id: string
        title: string
        messages: ChatMessage[]
        createTime: string
        backendId?: string
        backendSynced?: boolean
      }
      const localWithBackendId = conversationHistory.value.find(c => (c as ConversationWithBackendId).backendId === conversationId) as ConversationWithBackendId | undefined
      if (localWithBackendId && localWithBackendId.backendId) {
        const backendResponse = await getConversationMessages(localWithBackendId.backendId, { limit: 100 })

        if (backendResponse.success && backendResponse.data?.messages) {
          // 转换后端消息格式为前端格式
          const convertedMessages: ChatMessage[] = backendResponse.data.messages.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            createTime: msg.createdAt,
            status: 'sent',
            model: msg.model,
            metadata: msg.metadata as Record<string, unknown> | undefined,
          }))

          conversation = {
            id: conversationId,
            title: localWithBackendId.title,
            messages: convertedMessages,
            createTime: localWithBackendId.createTime,
          }

          // 保存到本地历史
          const history = [...conversationHistory.value]
          const index = history.findIndex(c => c.id === conversationId)
          if (index > -1) {
            history[index] = conversation
          } else {
            history.unshift(conversation)
          }
          StorageManager.setItem('floating-chat-history', history)
          conversationHistory.value = history
        }
      }
    } catch (error) {
      logger.warn(t('common.errors.fetchFailed'), error)
    }
  }

  if (conversation) {
    // 如果当前有未保存的对话，先保存
    if (messages.value.length > 0 && isAutoSave.value) {
      await saveConversation()
    }

    messages.value = conversation.messages.map(msg => ({ ...msg })) // 深拷贝
    currentConversationId.value = conversationId
    showHistoryPanel.value = false
    nextTick(() => {
      scrollToBottom(true)
      inputRef.value?.focus()
    })
    showSuccess(t('floatingChat.conversationLoaded'))
  } else {
    showError(t('floatingChat.conversationNotFound'))
  }
}

// 删除对话（支持后端同步删除 + 大模型 chatHistory 删除）
const deleteConversationHandler = async (conversationId: string) => {
  const confirmed = await confirm(
    t('floatingChat.deleteConversationConfirm'),
    t('floatingChat.confirmDeleteConversation')
  )

  if (!confirmed) return

  // 大模型模式：调用 chatHistory.service 删除（user-model-chat 接口）
  if (conversationId.startsWith('model-chat-')) {
    const modelConv = modelChatHistory.value.find(c => c.id === conversationId) as
      | (ChatRecord & { _chatId?: number | string })
      | undefined
    const chatIdRaw = modelConv?._chatId ?? conversationId.replace(/^model-chat-/, '')
    try {
      const res = await deleteChatRecord(chatIdRaw)
      if (res.success) {
        modelChatHistory.value = modelChatHistory.value.filter(c => c.id !== conversationId)
        if (currentConversationId.value === conversationId) {
          currentConversationId.value = null
          messages.value = []
        }
        showSuccess(t('floatingChat.conversationDeleted'))
      } else {
        showError(res.message || t('common.errors.deleteFailed'))
      }
    } catch (e) {
      logger.warn('Failed to delete LLM conversation', e)
      showError(t('common.errors.deleteFailed'))
    }
    return
  }

  // 如果启用了后端同步，先尝试从后端删除
  if (enableBackendSync.value) {
    interface ConversationWithBackendId {
      id: string
      title: string
      messages: ChatMessage[]
      createTime: string
      backendId?: string
      backendSynced?: boolean
    }
    const conversation = conversationHistory.value.find(c => c.id === conversationId) as ConversationWithBackendId | undefined
    if (conversation && conversation.backendId) {
      try {
        await deleteConversation(conversation.backendId) // 调用API函数
      } catch (error) {
        logger.warn(t('common.errors.deleteFailed'), error)
      }
    }
  }

  // 从本地删除
  conversationHistory.value = conversationHistory.value.filter((c) => c.id !== conversationId)
  StorageManager.setItem('floating-chat-history', conversationHistory.value)

  if (currentConversationId.value === conversationId) {
    currentConversationId.value = null
    messages.value = []
  }

  showSuccess(t('floatingChat.conversationDeleted'))
}

// 自动保存对话（当消息变化时） - 防抖保存
let saveTimer: number | null = null
// 视频生成轮询定时器
let videoPollTimer: ReturnType<typeof setTimeout> | null = null
// 3D模型生成轮询定时器
let model3DPollTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => messages.value,
  () => {
    if (isAutoSave.value && messages.value.length > 0) {
      // 清除之前的定时器
      if (saveTimer !== null) {
        clearTimeout(saveTimer)
      }
      // 防抖保存（2秒后保存）
      saveTimer = window.setTimeout(async () => {
        await saveConversation()
        saveTimer = null
      }, 2000)
    }
  },
  { deep: true }
)

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null } })
cleanup.add(() => { if (videoPollTimer !== null) { clearTimeout(videoPollTimer); videoPollTimer = null } })
cleanup.add(() => { if (model3DPollTimer !== null) { clearTimeout(model3DPollTimer); model3DPollTimer = null } })


// 图像生成处理
const _handleImageGeneration = async (
  prompt: string,
  files: FileAttachment[],
  assistantMessage: ChatMessage
) => {
  const userUuid = getUserUuid()
  const hasImage = files.some(f => f.type?.startsWith('image/'))
  // 从当前会话 ID 派生 chat_id（与 user-model-chat 一致）
  let chatIdForGeneration: string | undefined
  const convIdForGeneration = currentConversationId.value
  if (convIdForGeneration && convIdForGeneration.startsWith('model-chat-')) {
    chatIdForGeneration = convIdForGeneration.replace('model-chat-', '')
  }
  // 尝试从当前选中的图片模型中获取 variables，透传为 zidingyican
  // 优先使用用户实际选择的图片模型（如 wan2.5-i2i-preview），否则再从列表中兜底找一个通义图片模型
  let qwenImageVariables: unknown
  try {
    const selectedImageModelForVars =
      currentAIMode.value === 'generation' &&
        selectedModel.value &&
        (selectedModel.value as Model).supportsImages
        ? (selectedModel.value as Model & { variables?: unknown })
        : undefined

    if (selectedImageModelForVars?.variables) {
      qwenImageVariables = selectedImageModelForVars.variables
    } else {
      const fallbackImageModel = availableModels.value.find((m) => {
        const provider = (m.provider || '').toLowerCase()
        const name = (m.name || '').toLowerCase()
        return m.supportsImages && (provider.includes('dashscope') || name.includes('qwen') || name.includes('wan'))
      }) as (Model & { variables?: unknown }) | undefined

      if (fallbackImageModel?.variables) {
        qwenImageVariables = fallbackImageModel.variables
      }
    }
  } catch (e) {
      logger.warn('[ImageGeneration] Failed to get Qwen image generation variables:', e)
  }
  // 与 ai_index2 一致：归一化后透传 zidingyican
  const imageZidingyican = normalizeZidingyican(Array.isArray(qwenImageVariables) ? qwenImageVariables : [])
  const fallbackTextToImage = async (): Promise<string> => {
    // 降级策略：当配置为 WebSocket 但前端不支持时，回退到 HTTP 的通义万相默认接口
    const qwenResponse = await generateDashScopeImage('Qwen-Image', {
      prompt,
      user_uuid: userUuid,
      chat_id: chatIdForGeneration,
      images: [],
      // 若有通义图片模型的 variables，则透传；否则传空数组保证参数存在
      zidingyican: imageZidingyican,
    })
    if (qwenResponse.success && qwenResponse.data?.image_url) {
      return qwenResponse.data.image_url
    }
    throw new Error(qwenResponse.message || t('floatingChat.imageGenerationFailed'))
  }
  const tryRemarkHttpFirst = async (remark: string): Promise<string> => {
    const httpPath = remark.startsWith('/') ? remark : `/${remark}`
    try {
      const resp = await request.post(httpPath, {
        prompt,
        user_uuid: userUuid,
        chat_id: chatIdForGeneration,
        // 通义图像接口要求 images 为数组类型字段：文生图传 []，图生图时由专用接口传 [url]
        images: [],
        zidingyican: imageZidingyican,
      }) as unknown as {
        data?: { image_url?: string; image_urls?: string[]; message?: string }
        image_url?: string
        image_urls?: string[]
        message?: string
      }
      const payload = resp.data ?? resp
      const url =
        payload.image_url ||
        (Array.isArray(payload.image_urls) && payload.image_urls.length > 0 ? payload.image_urls[0] : undefined)
      if (!url) throw new Error(payload.message || t('floatingChat.imageGenerationFailed'))
      return url
    } catch (e) {
      // remark 的 HTTP 调用失败时，再兜底到通义默认接口，避免彻底不可用
      logger.warn('[ImageGeneration] remark http failed, fallback to default:', e)
      return await fallbackTextToImage()
    }
  }

  // 如果有图片，判断是图生图还是图像编辑
  if (hasImage) {
    const imageFile = files.find(f => f.type?.startsWith('image/'))
    if (!imageFile) {
      throw new Error(t('floatingChat.imageFileNotFound'))
    }

    // 上传图片获取URL
    const imageBlob = await fetch(imageFile.preview).then(r => r.blob())
    if (!isMounted) return
    const file = new File([imageBlob], imageFile.name || 'image.png', { type: imageFile.type || 'image/png' })
    const uploadResponse = await uploadFormFile(file)

    if (!uploadResponse.success || !uploadResponse.data?.url) {
      throw new Error(t('floatingChat.imageUploadFailed'))
    }

    const imageUrl = uploadResponse.data.url

    // 判断是编辑还是图生图（根据提示词关键词）
    const editKeywords = [t('floatingChat.editKeyword1'), t('floatingChat.editKeyword2'), t('floatingChat.editKeyword3'), t('floatingChat.editKeyword4')]
    const isEdit = editKeywords.some(keyword => prompt.includes(keyword))

    if (isEdit) {
      // 图像编辑
      const response = await editDashScopeImage({
        messages: [{
          role: 'user',
          content: [
            { image: imageUrl },
            { text: prompt || t('floatingChat.pleaseEditThisImage') },
          ],
        }],
        user_uuid: userUuid,
      })

      if (response.success && response.data?.image_url) {
        assistantMessage.content = `![${t('floatingChat.editedImage')}](${response.data.image_url})`
        assistantMessage.files = [{
          id: `img-${Date.now()}`,
          name: 'generated-image.png',
          type: 'image/png',
          preview: response.data.image_url,
          size: 0,
          uploadedAt: Date.now(),
        }]
      } else {
        throw new Error(response.message || t('floatingChat.imageEditFailed'))
      }
    } else {
      // 图生图：统一走 ihui API dashscope/image-to-image/generate；万象2.6图片创作等需传 model
      const modelForI2I = currentAIMode.value === 'generation' && selectedModel.value
        ? (selectedModel.value.name || selectedModel.value.modelCode)
        : undefined
      const response = await generateDashScopeImageToImage({
        images: Array.isArray(imageUrl) ? imageUrl : [imageUrl],
        prompt: prompt || t('floatingChat.generateNewImageFromImage'),
        user_uuid: userUuid,
        chat_id: chatIdForGeneration,
        ...(modelForI2I ? { model: modelForI2I } : {}),
        ...(imageZidingyican.length > 0 ? { zidingyican: imageZidingyican } : {}),
      })

      if (response.success && response.data?.image_urls && response.data.image_urls.length > 0) {
        const generatedImageUrl = response.data.image_urls[0]
        assistantMessage.content = `![${t('floatingChat.generatedImage')}](${generatedImageUrl})`
        assistantMessage.files = [{
          id: `img-${Date.now()}`,
          name: 'generated-image.png',
          type: 'image/png',
          preview: generatedImageUrl,
          size: 0,
          uploadedAt: Date.now(),
        }]
      } else {
        throw new Error(response.message || t('floatingChat.imageToImageFailed'))
      }
    }
  } else {
    // 文生图 - 根据选择的服务商调用不同的 API
    let generatedImageUrl: string | undefined

    // 生成模式下：优先使用用户当前选中的「图片模型」的 remark + quest_type
    // 避免 provider 默认值导致“选了即梦却打到通义”的问题
    const selectedImageModel = (currentAIMode.value === 'generation' && selectedModel.value?.supportsImages)
      ? (selectedModel.value as unknown as { remark?: string; quest_type?: string })
      : undefined
    const selectedRemark = selectedImageModel?.remark?.trim()
    const selectedQuestType = selectedImageModel?.quest_type?.toLowerCase().trim()
    if (selectedRemark) {
      if (selectedQuestType === 'ws' || selectedQuestType === 'websocket' || selectedQuestType === 'web_socket') {
        // 该模型配置为 WebSocket，但当前前端不支持 WS 生图：
        // 优先仍用 HTTP 尝试调用 remark（即梦/自定义模型会走这里），失败再兜底默认接口
        generatedImageUrl = await tryRemarkHttpFirst(selectedRemark)
      } else {
        const httpPath = selectedRemark.startsWith('/') ? selectedRemark : `/${selectedRemark}`
        const resp = await request.post(httpPath, {
          prompt,
          user_uuid: userUuid,
          chat_id: chatIdForGeneration,
          images: [],
          zidingyican: imageZidingyican,
        }) as unknown as {
          data?: { image_url?: string; image_urls?: string[]; message?: string }
          image_url?: string
          image_urls?: string[]
          message?: string
        }
        const payload = resp.data ?? resp
        const url =
          payload.image_url ||
          (Array.isArray(payload.image_urls) && payload.image_urls.length > 0 ? payload.image_urls[0] : undefined)
        if (!url) throw new Error(payload.message || t('floatingChat.imageGenerationFailed'))
        generatedImageUrl = url
      }
    } else {

      switch (currentImageProvider.value) {
        case 'doubao': {
          // 豆包图像生成
          const doubaoResponse = await generateDoubaoImage({
            prompt: prompt,
            chat_id: chatIdForGeneration,
            user_uuid: userUuid,
          })
          if (doubaoResponse.success && doubaoResponse.data?.image_url) {
            generatedImageUrl = doubaoResponse.data.image_url
          } else {
            throw new Error(doubaoResponse.message || t('floatingChat.imageGenerationFailed'))
          }
          break
        }
        case 'jimeng': {
          // 即梦图像生成
          const jimengResponse = await generateJimeng4Image({
            prompt: prompt,
            chat_id: chatIdForGeneration,
            user_uuid: userUuid,
          })
          if (jimengResponse.success && jimengResponse.data?.image_urls && jimengResponse.data.image_urls.length > 0) {
            generatedImageUrl = jimengResponse.data.image_urls[0]
          } else {
            throw new Error(jimengResponse.message || t('floatingChat.imageGenerationFailed'))
          }
          break
        }
        case 'qwen':
        default: {
          // 通义万相（默认）——优先使用「当前选中图片模型」的 remark + quest_type
          // 说明：availableModels 可能未加载完成，直接用它找会导致“直接报错”。
          // 在生成模式下优先使用 selectedModel（用户当前选中的图片模型），否则再动态拉取模型列表兜底。
          const selectedImageModel = (currentAIMode.value === 'generation' && selectedModel.value?.supportsImages)
            ? (selectedModel.value as unknown as { remark?: string; quest_type?: string })
            : undefined

          const remarkPath = selectedImageModel?.remark?.trim()
          const questType = selectedImageModel?.quest_type?.toLowerCase().trim()

          if (remarkPath) {
            if (questType === 'ws' || questType === 'websocket' || questType === 'web_socket') {
              // 该模型配置为 WebSocket，但当前前端不支持 WS 生图：
              // 优先仍用 HTTP 尝试调用 remark（即梦/自定义模型会走这里），失败再兜底默认接口
              generatedImageUrl = await tryRemarkHttpFirst(remarkPath)
              break
            }

            const httpPath = remarkPath.startsWith('/') ? remarkPath : `/${remarkPath}`
            const resp = await request.post(httpPath, {
              prompt,
              user_uuid: userUuid,
              chat_id: chatIdForGeneration,
              images: [],
              zidingyican: imageZidingyican,
            }) as unknown as {
              data?: { image_url?: string; image_urls?: string[]; message?: string }
              image_url?: string
              image_urls?: string[]
              message?: string
            }

            const payload = resp.data ?? resp
            const url =
              payload.image_url ||
              (Array.isArray(payload.image_urls) && payload.image_urls.length > 0 ? payload.image_urls[0] : undefined)

            if (!url) throw new Error(payload.message || t('floatingChat.imageGenerationFailed'))
            generatedImageUrl = url
            break
          }

          // 兜底：动态拉取一次模型列表，避免页面刚开 availableModels 为空就直接报错
          const modelsResp = await getAvailableModels()
          const models = modelsResp.success && Array.isArray(modelsResp.data) ? modelsResp.data : []
          const modelFromList = models.find((m) => {
            const provider = (m.provider || '').toLowerCase()
            const name = (m.name || '').toLowerCase()
            const displayName = (m.displayName || '').toLowerCase()
            return m.supportsImages === true && (
              provider.includes('qwen') ||
              provider.includes('dashscope') ||
              name.includes('qwen') ||
              displayName.includes('通义') ||
              displayName.includes('万相')
            )
          }) as (import('@/api/models').AIModelInfo & { remark?: string; quest_type?: string }) | undefined

          if (!modelFromList?.remark) {
            // 最后兜底：不再报错中断体验，回退到原通义默认接口（仅当列表没配置时）
            const qwenResponse = await generateDashScopeImage('Qwen-Image', {
              prompt,
              user_uuid: userUuid,
              chat_id: chatIdForGeneration,
              images: [],
              zidingyican: imageZidingyican,
            })
            if (qwenResponse.success && qwenResponse.data?.image_url) {
              generatedImageUrl = qwenResponse.data.image_url
            } else {
              throw new Error(qwenResponse.message || t('floatingChat.imageGenerationFailed'))
            }
            break
          }

          if (['ws', 'websocket', 'web_socket'].includes((modelFromList.quest_type || '').toLowerCase().trim())) {
            // 兜底模型配置为 WebSocket，但当前前端不支持 WS 生图：
            // 优先仍用 HTTP 尝试调用 remark（即梦/自定义模型会走这里），失败再兜底默认接口
            generatedImageUrl = await tryRemarkHttpFirst(modelFromList.remark)
            break
          }

          const httpPath = modelFromList.remark.startsWith('/') ? modelFromList.remark : `/${modelFromList.remark}`
          const resp = await request.post(httpPath, {
            prompt,
            user_uuid: userUuid,
            chat_id: chatIdForGeneration,
            images: [],
            zidingyican: imageZidingyican,
          }) as unknown as {
            data?: { image_url?: string; image_urls?: string[]; message?: string }
            image_url?: string
            image_urls?: string[]
            message?: string
          }
          const payload = resp.data ?? resp
          const url =
            payload.image_url ||
            (Array.isArray(payload.image_urls) && payload.image_urls.length > 0 ? payload.image_urls[0] : undefined)
          if (!url) throw new Error(payload.message || t('floatingChat.imageGenerationFailed'))
          generatedImageUrl = url
          break
        }
      }
    }

    if (generatedImageUrl) {
      assistantMessage.content = `![${t('floatingChat.generatedImage')}](${generatedImageUrl})`
      assistantMessage.files = [{
        id: `img-${Date.now()}`,
        name: 'generated-image.png',
        type: 'image/png',
        preview: generatedImageUrl,
        size: 0,
        uploadedAt: Date.now(),
      }]
    }
  }

  assistantMessage.status = 'sent'
  assistantMessage.isStreaming = false
  isTyping.value = false

  if (isAutoSave.value) {
    await saveConversation()
  }

  emit('message-received', assistantMessage)
  scrollToBottom(true)

  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 一键视频状态轮询
const pollOneClickVideoStatus = async (taskId: string, assistantMessage: ChatMessage) => {
  const maxAttempts = 60 // 最多轮询60次（5分钟）
  const interval = 5000 // 每5秒轮询一次
  let attempts = 0

  const poll = async () => {
    if (attempts >= maxAttempts) {
      assistantMessage.content += '\n\n' + (t('floatingChat.oneClickVideoTimeout'))
      generationTaskId.value = null
      return
    }

    try {
      const response = await getOneClickVideoStatus(taskId)
      if (response.success && response.data) {
        const status = response.data.status

        if (status === 'completed' || status === 'success') {
          const result = response.data.result as { video_url?: string } | undefined
          if (result?.video_url) {
            assistantMessage.content = `${t('floatingChat.oneClickVideoComplete')}\n\n${t('aiChat.videoLink', { url: result.video_url })}`
            assistantMessage.files = [{
              id: `video-${Date.now()}`,
              name: 'one-click-video.mp4',
              type: 'video/mp4',
              preview: result.video_url,
              size: 0,
              uploadedAt: Date.now(),
            }]
          }
          generationTaskId.value = null
          if (isAutoSave.value) {
            await saveConversation()
          }
          return
        } else if (status === 'failed' || status === 'error') {
          assistantMessage.content += '\n\n' + (t('floatingChat.oneClickVideoFailed')) + (response.data.message || t('common.unknown'))
          assistantMessage.status = 'failed'
          generationTaskId.value = null
          return
        } else {
          // 继续轮询
          assistantMessage.content = (t('floatingChat.oneClickVideoProgress')) + `\n${t('aiChat.statusLabel', { status })}\n${response.data.message || ''}`
          attempts++
          if (videoPollTimer !== null) clearTimeout(videoPollTimer)
          videoPollTimer = setTimeout(poll, interval)
        }
      }
    } catch (error) {
      logger.error('Polling one-click video status failed:', error)
      attempts++
      if (videoPollTimer !== null) clearTimeout(videoPollTimer)
      videoPollTimer = setTimeout(poll, interval)
    }
  }

  // 开始轮询
  if (videoPollTimer !== null) clearTimeout(videoPollTimer)
  videoPollTimer = setTimeout(poll, interval)
}

// 视频生成处理
const handleVideoGeneration = async (
  prompt: string,
  files: FileAttachment[],
  assistantMessage: ChatMessage
) => {
  const userUuid = getUserUuid()
  const hasImage = files.some(f => f.type?.startsWith('image/'))
  const hasVideo = files.some(f => f.type?.startsWith('video/'))

  try {
    let imageUrl: string | undefined
    let videoUrl: string | undefined

    // 如果有图片，先上传
    if (hasImage) {
      const imageFile = files.find(f => f.type?.startsWith('image/'))
      if (imageFile) {
        const imageBlob = await fetch(imageFile.preview).then(r => r.blob())
        if (!isMounted) return
        const file = new File([imageBlob], imageFile.name || 'image.png', { type: imageFile.type || 'image/png' })
        const uploadResponse = await uploadFormFile(file)
        if (uploadResponse.success && uploadResponse.data?.url) {
          imageUrl = uploadResponse.data.url
        }
      }
    }

    // 如果有视频，先上传（用于可灵AI）
    if (hasVideo) {
      const videoFile = files.find(f => f.type?.startsWith('video/'))
      if (videoFile) {
        const videoBlob = await fetch(videoFile.preview).then(r => r.blob())
        if (!isMounted) return
        const file = new File([videoBlob], videoFile.name || 'video.mp4', { type: videoFile.type || 'video/mp4' })
        const uploadResponse = await uploadFormFile(file)
        if (uploadResponse.success && uploadResponse.data?.url) {
          videoUrl = uploadResponse.data.url
        }
      }
    }

    // 根据选择的服务商调用不同的 API
    if (currentVideoProvider.value === 'kling') {
      // 可灵AI视频生成（需要先识别人脸）
      assistantMessage.content = t('floatingChat.klingVideoIdentifying')
      assistantMessage.status = 'sending'

      if (!videoUrl) {
        throw new Error(t('floatingChat.klingVideoNeedUpload'))
      }

      // 识别人脸
      const identifyResponse = await identifyKlingVideo({
        user_uuid: userUuid,
        video_url: videoUrl,
      })

      if (!identifyResponse.success || !identifyResponse.data?.face_data?.length) {
        throw new Error(identifyResponse.message || t('floatingChat.klingNoFaceFound'))
      }

      // 使用第一个人脸
      const faceId = identifyResponse.data.face_data[0].face_id
      assistantMessage.content = t('floatingChat.klingVideoGenerating')

      // 创建视频任务
      const createResponse = await createKlingVideo({
        user_uuid: userUuid,
        video_url: videoUrl,
        face_id: faceId,
        prompt: prompt,
      })

      if (createResponse.success && createResponse.data?.task_id) {
        generationTaskId.value = createResponse.data.task_id
        assistantMessage.content = t('floatingChat.klingVideoTaskCreated', { taskId: createResponse.data.task_id })
        assistantMessage.status = 'sent'
        assistantMessage.isStreaming = false
        isTyping.value = false
      } else {
        throw new Error(createResponse.message || t('floatingChat.klingVideoFailed'))
      }

      if (isAutoSave.value) {
        await saveConversation()
      }
      emit('message-received', assistantMessage)
      scrollToBottom(true)
      return
    }

    if (currentVideoProvider.value === 'one-click') {
      // 一键视频生成
      assistantMessage.content = t('floatingChat.oneClickVideoGenerating')
      assistantMessage.status = 'sending'

      const oneClickResponse = await startOneClickVideo({
        topic: prompt,
        user_uuid: userUuid,
      })

      if (oneClickResponse.success && oneClickResponse.data?.task_id) {
        generationTaskId.value = oneClickResponse.data.task_id
        assistantMessage.content = t('floatingChat.oneClickVideoTaskCreated', { taskId: oneClickResponse.data.task_id })
        assistantMessage.status = 'sent'
        assistantMessage.isStreaming = false
        isTyping.value = false

        // 开始轮询任务状态
        pollOneClickVideoStatus(oneClickResponse.data.task_id, assistantMessage)
      } else {
        throw new Error(oneClickResponse.message || t('floatingChat.oneClickVideoFailed'))
      }

      if (isAutoSave.value) {
        await saveConversation()
      }
      emit('message-received', assistantMessage)
      scrollToBottom(true)
      return
    }

    // 视频生成：按当前模型的 remark + quest_type 选择接口（即梦等用各自接口，通义用 dashscope/video-synthesis/ws）
    assistantMessage.content = t('floatingChat.videoGenerating')
    assistantMessage.status = 'sending'

    let chatIdForVideo: string | undefined
    const convIdVideo = currentConversationId.value
    if (convIdVideo && convIdVideo.startsWith('model-chat-')) {
      chatIdForVideo = convIdVideo.replace('model-chat-', '')
    }
    const videoModelCfg = selectedModel.value as (Model & { variables?: unknown; remark?: string; quest_type?: string }) | null
    const videoModelName = videoModelCfg?.name || 'wan2.5-i2v-preview'
    // 与 ai_index2 一致：zidingyican 从当前模型 variables 归一化（value 为对象时取 value.value）
    const videoZidingyican = normalizeZidingyican(videoModelCfg?.variables ?? [])
    const videoRemark = (videoModelCfg?.remark || '').trim()
    const videoQuestType = (videoModelCfg?.quest_type || '').toLowerCase().trim()
    // 从 variables 抽出后端要求的顶层参数（duration、orientation、movement、frames、scale、enhance_clarity）
    const varsMap = videoZidingyican.reduce((acc, item) => {
      acc[item.name] = item.value
      return acc
    }, {} as Record<string, unknown>)

    // images：即梦生视频等接口要求必传数组，有首帧图时传 [imageUrl]，无图时传 []
    const videoImages = imageUrl ? [imageUrl] : []
    const videoPayload = {
      prompt: prompt,
      img_url: imageUrl,
      images: videoImages,
      user_uuid: userUuid,
      chat_id: chatIdForVideo,
      model: videoModelName,
      prompt_extend: true,
      watermark: false,
      zidingyican: videoZidingyican.length > 0 ? videoZidingyican : undefined,
      duration: varsMap.duration != null ? String(varsMap.duration) : '5',
      orientation: typeof varsMap.orientation === 'number' ? varsMap.orientation : 0,
      movement: typeof varsMap.movement === 'string' ? varsMap.movement : t('aiChat.pan'),
      frames: typeof varsMap.frames === 'number' ? varsMap.frames : 121,
      scale: typeof varsMap.scale === 'number' ? varsMap.scale : 0,
      enhance_clarity: varsMap.enhance_clarity === true,
    }

    const handleVideoWsMessage = async (message: unknown) => {
      const msg = message as {
        type?: string
        code?: number
        data?: {
          video_url?: string
          status?: string
          progress?: number
          message?: string
          type?: string
          event?: string
        }
      }
      const data = msg.data
      const resolvedVideoUrl = data?.video_url

      if (msg.type === 'progress' || (typeof data?.progress === 'number')) {
        const progress = data?.progress ?? 0
        const status = data?.status || data?.message || ''
        const progressText = progress > 0 ? ` (${progress}%)` : ''
        assistantMessage.content = t('floatingChat.videoGeneratingProgress', { status, progress: progressText })
        scrollToBottom(false)
        return
      }

      const isSuccess =
        (msg.type === 'complete' && resolvedVideoUrl) ||
        (msg.code === 200 && resolvedVideoUrl) ||
        (data && (data.type === 'success' || data.event === 'video_synthesis.success') && resolvedVideoUrl)

      if (isSuccess && resolvedVideoUrl) {
        assistantMessage.content = `${t('floatingChat.videoGenerationComplete')}\n\n`
        assistantMessage.files = [{
          id: `video-${Date.now()}`,
          name: 'generated-video.mp4',
          type: 'video/mp4',
          preview: resolvedVideoUrl,
          size: 0,
          uploadedAt: Date.now(),
        }]
        if (!assistantMessage.metadata) assistantMessage.metadata = {}
        assistantMessage.metadata.videoUrl = resolvedVideoUrl
        assistantMessage.status = 'sent'
        assistantMessage.isStreaming = false
        isTyping.value = false

        if (generationWebSockets.value.has(assistantMessage.id)) {
          generationWebSockets.value.get(assistantMessage.id)?.close()
          generationWebSockets.value.delete(assistantMessage.id)
        }
        generationTaskId.value = null

        if (isAutoSave.value) await saveConversation()
        emit('message-received', assistantMessage)
        scrollToBottom(true)
        nextTick(() => inputRef.value?.focus())
        return
      }

      if (data?.message === t('aiChat.streamComplete')) return

      if (msg.type === 'error' || (msg.code && msg.code !== 200)) {
        assistantMessage.status = 'failed'
        assistantMessage.isStreaming = false
        isTyping.value = false
        const errMsg = data?.message || (message as { message?: string }).message || t('floatingChat.videoGenerationFailed')
        assistantMessage.content = `${t('floatingChat.videoGenerationFailed')}: ${errMsg}`
        assistantMessage.error = errMsg
        showError(errMsg)
        if (generationWebSockets.value.has(assistantMessage.id)) {
          generationWebSockets.value.get(assistantMessage.id)?.close()
          generationWebSockets.value.delete(assistantMessage.id)
        }
      }
    }

    const handleVideoWsError = (error: Event) => {
      logger.error(t('common.errors.networkError'), error)
      assistantMessage.status = 'failed'
      assistantMessage.isStreaming = false
      isTyping.value = false
      const errorMsg = t('common.errors.networkError')
      assistantMessage.content = t('floatingChat.videoGenerationFailed', { error: errorMsg })
      assistantMessage.error = errorMsg
      showError(t('floatingChat.videoGenerationFailed', { error: errorMsg }))
      if (generationWebSockets.value.has(assistantMessage.id)) {
        generationWebSockets.value.get(assistantMessage.id)?.close()
        generationWebSockets.value.delete(assistantMessage.id)
      }
    }

    const handleVideoWsClose = () => {
      logger.info(t('common.messages.operationSuccess'))
      if (generationWebSockets.value.has(assistantMessage.id)) {
        generationWebSockets.value.delete(assistantMessage.id)
      }
    }

    // 1) 模型配置为 HTTP 且存在 remark：走该模型的 HTTP 接口（即梦生视频等，与后端 proxy/video-generation 约定一致）
    if (videoQuestType === 'http' && videoRemark) {
      const httpPath = videoRemark.startsWith('/') ? videoRemark : `/${videoRemark}`
      try {
        // 构建与 ihui API proxy/video-generation 一致的请求体（与 ai_index2 传参对齐）
        const videoHttpBody: Record<string, unknown> = {
          prompt: prompt,
          user_uuid: userUuid,
          images: videoImages,
          zidingyican: videoZidingyican,
          model: videoModelName,
          model_name: videoModelName,
          prompt_extend: true,
          watermark: false,
          duration: varsMap.duration != null ? String(varsMap.duration) : '5',
          orientation: typeof varsMap.orientation === 'number' ? varsMap.orientation : 0,
          movement: typeof varsMap.movement === 'string' ? varsMap.movement : t('aiChat.pan'),
          frames: typeof varsMap.frames === 'number' ? varsMap.frames : 121,
          scale: typeof varsMap.scale === 'number' ? varsMap.scale : 0,
          enhance_clarity: varsMap.enhance_clarity === true,
        }
        if (chatIdForVideo) videoHttpBody.chat_id = chatIdForVideo
        if (imageUrl) videoHttpBody.img_url = imageUrl
        const resp = await request.post<{ success?: boolean; data?: { video_url?: string; task_id?: string }; message?: string }>(httpPath, videoHttpBody)
        const normalized = (resp as { data?: unknown })?.data ?? resp
        const data = typeof normalized === 'object' && normalized !== null ? normalized as { success?: boolean; data?: { video_url?: string; task_id?: string }; video_url?: string } : {}
        const inner = (data.data ?? data) as { video_url?: string; task_id?: string }
        const videoUrlFromHttp = inner?.video_url ?? (data as { video_url?: string }).video_url
        if (videoUrlFromHttp) {
          assistantMessage.content = `${t('floatingChat.videoGenerationComplete')}\n\n`
          assistantMessage.files = [{ id: `video-${Date.now()}`, name: 'generated-video.mp4', type: 'video/mp4', preview: videoUrlFromHttp, size: 0, uploadedAt: Date.now() }]
          if (!assistantMessage.metadata) assistantMessage.metadata = {}
          assistantMessage.metadata.videoUrl = videoUrlFromHttp
          assistantMessage.status = 'sent'
          assistantMessage.isStreaming = false
          isTyping.value = false
          if (isAutoSave.value) await saveConversation()
          emit('message-received', assistantMessage)
          scrollToBottom(true)
          nextTick(() => inputRef.value?.focus())
          return
        }
        const taskId = inner?.task_id
        if (taskId) {
          assistantMessage.content = t('floatingChat.videoTaskCreated', { taskId })
          assistantMessage.status = 'sent'
          assistantMessage.isStreaming = false
          isTyping.value = false
          if (isAutoSave.value) await saveConversation()
          emit('message-received', assistantMessage)
          scrollToBottom(true)
          return
        }
        assistantMessage.status = 'failed'
        assistantMessage.isStreaming = false
        isTyping.value = false
        assistantMessage.content = t('floatingChat.videoGenerationFailed')
        return
      } catch (httpErr) {
        logger.warn('[VideoGeneration] HTTP remark failed, fallback to default:', httpErr)
        showError(httpErr instanceof Error ? httpErr.message : String(httpErr))
        assistantMessage.status = 'failed'
        assistantMessage.isStreaming = false
        isTyping.value = false
        assistantMessage.content = t('floatingChat.videoGenerationFailed')
        return
      }
    }

    // 2) 模型配置为 WebSocket 且 remark 为非通义路径：使用 remark 对应的 WS（即梦视频 WS 等）
    const isDashScopeVideoPath = videoRemark.includes('dashscope') && videoRemark.includes('video-synthesis')
    if (
      videoRemark &&
      ['ws', 'websocket', 'web_socket'].includes(videoQuestType) &&
      !isDashScopeVideoPath
    ) {
      const ws = createVideoWebSocketByPath(
        videoRemark.startsWith('/') ? videoRemark : `/${videoRemark}`,
        videoPayload as DashScopeVideoSynthesisRequest,
        handleVideoWsMessage,
        handleVideoWsError,
        handleVideoWsClose
      )
      if (!generationWebSockets.value) generationWebSockets.value = new Map()
      generationWebSockets.value.set(assistantMessage.id, ws)
      assistantMessage.isStreaming = true
      generationTaskId.value = assistantMessage.id
      return
    }

    // 3) 通义万相视频：使用 dashscope/video-synthesis/ws
    const ws = createDashScopeVideoWebSocket(
      videoPayload as DashScopeVideoSynthesisRequest,
      handleVideoWsMessage,
      handleVideoWsError,
      handleVideoWsClose
    )

    // 保存WebSocket引用以便清理（使用Map存储）
    if (!generationWebSockets.value) {
      generationWebSockets.value = new Map()
    }
    generationWebSockets.value.set(assistantMessage.id, ws)

    generationTaskId.value = assistantMessage.id
  } catch (error) {
    assistantMessage.status = 'failed'
    assistantMessage.isStreaming = false
    isTyping.value = false

    const errorMessage = error instanceof Error ? error.message : String(error)
    assistantMessage.content = t('floatingChat.videoGenerationStartFailed', { error: errorMessage })
    assistantMessage.error = errorMessage

    showError(errorMessage || t('floatingChat.videoGenerationStartFailed'))
    throw error
  }
}

// 3D模型生成处理
const _handle3DGeneration = async (
  prompt: string,
  files: FileAttachment[],
  assistantMessage: ChatMessage
) => {
  const userUuid = getUserUuid()

  try {
    let imageUrl: string | undefined
    let imageBase64: string | undefined

    // 如果有图片，转换为base64或上传获取URL
    if (files.some(f => f.type?.startsWith('image/'))) {
      const imageFile = files.find(f => f.type?.startsWith('image/'))
      if (imageFile) {
        // 尝试直接使用base64
        if (imageFile.preview.startsWith('data:')) {
          imageBase64 = imageFile.preview.split(',')[1]
        } else {
          // 上传获取URL
          const imageBlob = await fetch(imageFile.preview).then(r => r.blob())
          if (!isMounted) return
          const file = new File([imageBlob], imageFile.name || 'image.png', { type: imageFile.type || 'image/png' })
          const uploadResponse = await uploadFormFile(file)
          if (uploadResponse.success && uploadResponse.data?.url) {
            imageUrl = uploadResponse.data.url
          }
        }
      }
    }

    // 提交3D生成任务
    const response = await submitHunyuan3DTask({
      Prompt: prompt,
      ImageUrl: imageUrl,
      ImageBase64: imageBase64,
      user_uuid: userUuid,
    })

    if (response.success && response.data?.job_id) {
      const jobId = response.data.job_id
      generationTaskId.value = jobId

      assistantMessage.content = t('floatingChat.model3DGenerationTaskSubmitted', { jobId }) + '\n' + t('floatingChat.model3DGenerating')
      assistantMessage.status = 'sending'

      // 轮询任务状态
      const poll3DStatus = async (): Promise<void> => {
        try {
          const statusResponse = await queryHunyuan3DStatus(jobId)

          if (statusResponse.success && statusResponse.data) {
            const status = statusResponse.data.status

            if (status === 'completed' && statusResponse.data.result_url) {
              assistantMessage.content = t('floatingChat.model3DGenerationComplete') + '\n\n' + t('floatingChat.downloadLink') + ': ' + statusResponse.data.result_url
              assistantMessage.status = 'sent'
              assistantMessage.isStreaming = false
              isTyping.value = false

              if (isAutoSave.value) {
                await saveConversation()
              }

              emit('message-received', assistantMessage)
              scrollToBottom(true)

              nextTick(() => {
                inputRef.value?.focus()
              })
            } else if (status === 'failed' || status === 'error') {
              assistantMessage.status = 'failed'
              assistantMessage.isStreaming = false
              isTyping.value = false
              const errorMsg = statusResponse.data.message || t('floatingChat.model3DGenerationFailed')
              assistantMessage.content = t('floatingChat.model3DGenerationFailedWithError', { error: errorMsg })
              assistantMessage.error = errorMsg
              showError(errorMsg)
            } else {
              // 继续轮询（显示进度信息）
              const progressInfo = statusResponse.data?.progress ? ` (${statusResponse.data.progress}%)` : ''
              assistantMessage.content = t('floatingChat.model3DGeneratingProgress', { status, progress: progressInfo })
              scrollToBottom(false) // 非平滑滚动，提高性能
              if (model3DPollTimer !== null) clearTimeout(model3DPollTimer)
              model3DPollTimer = setTimeout(poll3DStatus, 3000)
            }
          } else {
            // 继续轮询（无状态信息）
            if (model3DPollTimer !== null) clearTimeout(model3DPollTimer)
            model3DPollTimer = setTimeout(poll3DStatus, 3000)
          }
        } catch (error) {
          assistantMessage.status = 'failed'
          assistantMessage.isStreaming = false
          isTyping.value = false
          const errorMessage = error instanceof Error ? error.message : String(error)
          assistantMessage.content = t('floatingChat.model3DGenerationStatusQueryFailed', { error: errorMessage })
          assistantMessage.error = errorMessage
          showError(errorMessage || t('floatingChat.model3DGenerationStatusQueryFailed', { error: '' }))
        }
      }

      // 开始轮询（2秒后开始）
      if (model3DPollTimer !== null) clearTimeout(model3DPollTimer)
      model3DPollTimer = setTimeout(poll3DStatus, 2000)
    } else {
      throw new Error(response.message || t('floatingChat.model3DGenerationTaskSubmissionFailed'))
    }
  } catch (error) {
    assistantMessage.status = 'failed'
    assistantMessage.isStreaming = false
    isTyping.value = false

    const errorMessage = error instanceof Error ? error.message : String(error)
    assistantMessage.content = t('floatingChat.model3DGenerationTaskSubmissionFailedWithError', { error: errorMessage })
    assistantMessage.error = errorMessage

    showError(errorMessage || t('floatingChat.model3DGenerationTaskSubmissionFailed'))
    throw error
  }
}

// 视觉分析处理
const _handleVisionAnalysis = async (
  prompt: string,
  files: FileAttachment[],
  assistantMessage: ChatMessage
) => {
  const userUuid = getUserUuid()

  try {
    // 必须有图片
    const imageFile = files.find(f => f.type?.startsWith('image/'))
    if (!imageFile) {
      throw new Error(t('floatingChat.visionAnalysisRequiresImage'))
    }

    // 上传图片获取URL
    const imageBlob = await fetch(imageFile.preview).then(r => r.blob())
    if (!isMounted) return
    const file = new File([imageBlob], imageFile.name || 'image.png', { type: imageFile.type || 'image/png' })
    const uploadResponse = await uploadFormFile(file)

    if (!uploadResponse.success || !uploadResponse.data?.url) {
      throw new Error(t('floatingChat.imageUploadFailed'))
    }

    const imageUrl = uploadResponse.data.url

    // 调用视觉分析API
    const response = await chatDashScopeVision({
      images: imageUrl,
      prompt: prompt || t('floatingChat.pleaseAnalyzeThisImage'),
      user_uuid: userUuid,
    })

    if (response.success && response.data) {
      let analysisContent = ''

      if (response.data.reasoning) {
        analysisContent += `**${t('floatingChat.thinkingProcess')}**\n${response.data.reasoning}\n\n`
      }

      if (response.data.answer) {
        analysisContent += `**${t('floatingChat.analysisResult')}**\n${response.data.answer}`
      } else if (response.data.message) {
        analysisContent += response.data.message
      }

      // 如果有生成的图片，也显示
      if (response.data.images) {
        analysisContent += `\n\n![${t('floatingChat.analysisResultImage')}](${response.data.images})`
        assistantMessage.files = [{
          id: `analysis-${Date.now()}`,
          name: 'analysis-result.png',
          type: 'image/png',
          preview: response.data.images,
          size: 0,
          uploadedAt: Date.now(),
        }]
      }

      assistantMessage.content = analysisContent
      assistantMessage.status = 'sent'
      assistantMessage.isStreaming = false
      isTyping.value = false

      if (isAutoSave.value) {
        await saveConversation()
      }

      emit('message-received', assistantMessage)
      scrollToBottom(true)

      nextTick(() => {
        inputRef.value?.focus()
      })
    } else {
      throw new Error(response.message || t('floatingChat.visionAnalysisFailed'))
    }
  } catch (error) {
    assistantMessage.status = 'failed'
    assistantMessage.isStreaming = false
    isTyping.value = false

    const errorMessage = error instanceof Error ? error.message : String(error)
    assistantMessage.content = `${t('floatingChat.visionAnalysisFailed')}: ${errorMessage}`
    assistantMessage.error = errorMessage

    showError(errorMessage || t('floatingChat.visionAnalysisFailed'))
    throw error
  }
}

// 音频生成处理（语音合成）
const handleAudioGeneration = async (
  prompt: string,
  _files: FileAttachment[],
  assistantMessage: ChatMessage
) => {
  const userUuid = getUserUuid()

  try {
    // 导入音频生成API
    const { aliGenerateTimbre } = await import('@/api/ai-models')

    // 调用阿里语音合成API
    const response = await aliGenerateTimbre({
      prompt: prompt,
      user_uuid: userUuid,
    }) as { data?: string | { url?: string }; message?: string }

    if (response && response.data) {
      const audioUrl = typeof response.data === 'string' ? response.data : response.data.url

      if (audioUrl) {
        assistantMessage.content = `**${t('floatingChat.audioGenerationSuccess')}**\n\n<audio controls src="${audioUrl}"></audio>\n\n${t('aiChat.originalText', { prompt })}`
        assistantMessage.files = [{
          id: `audio-${Date.now()}`,
          name: 'generated-audio.mp3',
          type: 'audio/mpeg',
          preview: audioUrl,
          size: 0,
          uploadedAt: Date.now(),
        }]
        assistantMessage.status = 'sent'
      } else {
        throw new Error(t('floatingChat.audioUrlNotFound'))
      }
    } else {
      throw new Error((response as { message?: string })?.message || t('floatingChat.audioGenerationFailed'))
    }

    assistantMessage.isStreaming = false
    isTyping.value = false

    if (isAutoSave.value) {
      await saveConversation()
    }

    emit('message-received', assistantMessage)
    scrollToBottom(true)

    nextTick(() => {
      inputRef.value?.focus()
    })
  } catch (error) {
    assistantMessage.status = 'failed'
    assistantMessage.isStreaming = false
    isTyping.value = false

    const errorMessage = error instanceof Error ? error.message : String(error)
    assistantMessage.content = `${t('floatingChat.audioGenerationFailed')}: ${errorMessage}`
    assistantMessage.error = errorMessage

    showError(errorMessage || t('floatingChat.audioGenerationFailed'))
    throw error
  }
}

// 音乐生成处理
const handleMusicGeneration = async (
  prompt: string,
  _files: FileAttachment[],
  assistantMessage: ChatMessage
) => {
  const userUuid = getUserUuid()

  try {
    // 使用统一生成服务
    const { generateContent } = await import('@/api/services/unified-generation.service')

    // 调用音乐生成API
    const response = await generateContent({
      type: 'music' as const,
      prompt: prompt,
      userUuid: userUuid,
      metadata: {
        style: 'auto', // 可以从prompt中解析风格
      },
    })

    if (response.success && response.data) {
      const musicUrl = response.data.url || response.data.urls?.[0]

      if (musicUrl) {
        assistantMessage.content = `**${t('floatingChat.musicGenerationSuccess')}**\n\n<audio controls src="${musicUrl}"></audio>\n\n${t('aiChat.descriptionLabel', { prompt })}`
        assistantMessage.files = [{
          id: `music-${Date.now()}`,
          name: 'generated-music.mp3',
          type: 'audio/mpeg',
          preview: musicUrl,
          size: 0,
          uploadedAt: Date.now(),
        }]
        assistantMessage.status = 'sent'
      } else {
        throw new Error(t('floatingChat.musicUrlNotFound'))
      }
    } else {
      throw new Error(response.message || t('floatingChat.musicGenerationFailed'))
    }

    assistantMessage.isStreaming = false
    isTyping.value = false

    if (isAutoSave.value) {
      await saveConversation()
    }

    emit('message-received', assistantMessage)
    scrollToBottom(true)

    nextTick(() => {
      inputRef.value?.focus()
    })
  } catch (error) {
    assistantMessage.status = 'failed'
    assistantMessage.isStreaming = false
    isTyping.value = false

    const errorMessage = error instanceof Error ? error.message : String(error)
    assistantMessage.content = `${t('floatingChat.musicGenerationFailed')}: ${errorMessage}`
    assistantMessage.error = errorMessage

    showError(errorMessage || t('floatingChat.musicGenerationFailed'))
    throw error
  }
}

// 智能能力推荐（增强：包含生成能力推荐）
const discoverAICapabilities = async (userMessage: string) => {
  if (!userMessage.trim()) return

  try {
    // 生成模式已下线：不做生成意图识别/提示/分流
    // 其他能力发现（Agent、MCP等）
    try {
      const recs = await discoverCapabilities(userMessage, {
        currentPage: route.path,
        userHistory: messages.value
          .filter(m => m.role === 'user')
          .slice(-5)
          .map(m => m.content),
      })

      if (recs.length > 0) {
        const topRec = recs[0]
        // 降低自动切换阈值，让用户有更多选择权
        if (topRec.confidence > 0.8) {
          const capabilityName = getCapabilityName(topRec.capabilityType)
          showInfo(t('floatingChat.recommended', { capability: capabilityName }))

          if (topRec.confidence > 0.9) {
            if (topRec.capabilityType === AICapabilityType.AGENT) {
              currentAIMode.value = 'agent'
            } else if (topRec.capabilityType === AICapabilityType.AGENTIC) {
              currentAIMode.value = 'agentic'
            } else if (topRec.capabilityType === AICapabilityType.MCP) {
              currentAIMode.value = 'mcp'
            }
          }
        }
      }
    } catch (discoveryError) {
      logger.warn(t('common.errors.operationFailed'), discoveryError)
      // 静默失败，继续使用当前模式
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    // 静默失败，不影响正常使用
  }
}

const getCapabilityName = (type: AICapabilityType): string => {
  const names: Record<AICapabilityType, string> = {
    [AICapabilityType.MODEL]: t('floatingChat.capabilityModel'),
    [AICapabilityType.AGENT]: t('floatingChat.capabilityAgent'),
    [AICapabilityType.AGENTIC]: t('floatingChat.capabilityAgentic'),
    [AICapabilityType.MCP]: t('floatingChat.capabilityMCP'),
    [AICapabilityType.HYBRID]: t('floatingChat.capabilityHybrid'),
    [AICapabilityType.AUTO]: t('floatingChat.modeAuto'),
  }
  return names[type] || type
}

const getGenerationTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    image: t('floatingChat.generationTypeImage'),
    video: t('floatingChat.generationTypeVideo'),
    '3d': t('floatingChat.generationType3D'),
    vision: t('floatingChat.generationTypeVision'),
    audio: t('floatingChat.generationTypeAudio'),
    music: t('floatingChat.generationTypeMusic'),
  }
  return labels[type] || type
}

// getModeTagType 已迁移至 ChatHeaderBar.vue（chat-parts 拆分）

// 获取生成类型描述 - 预留供将来使用
const _getGenerationTypeDescription = (type: 'image' | 'video' | '3d' | 'vision' | 'audio' | 'music' | 'auto'): string => {
  const descriptions: Record<string, string> = {
    image: t('floatingChat.generationTypeImageDesc'),
    video: t('floatingChat.generationTypeVideoDesc'),
    '3d': t('floatingChat.generationType3DDesc'),
    vision: t('floatingChat.generationTypeVisionDesc'),
    audio: t('floatingChat.generationTypeAudioDesc'),
    music: t('floatingChat.generationTypeMusicDesc'),
    auto: t('floatingChat.generationTypeAutoDesc'),
  }
  return descriptions[type] || type
}

// 处理Agentic选择
const handleAgenticSelect = () => {
  showAICapabilityPanel.value = false
  currentAIMode.value = 'agentic'
  // 可以在这里添加创建Agentic Swarm的逻辑
  showInfo(t('floatingChat.agenticModeSelected'))
}

// 处理MCP工具选择
const handleMCPToolSelect = (request: AICapabilityRequest) => {
  showAICapabilityPanel.value = false
  currentAIMode.value = 'mcp'
  // 调用MCP工具
  invokeCapability(request)
    .then((result) => {
      if (result && result.success) {
        showSuccess(t('floatingChat.mcpToolSuccess'))
      }
    })
    .catch((error) => {
      logger.error('MCP tool invocation failed:', error)
      showError(t('floatingChat.mcpToolFailed'))
    })
}

// ========== AI 能力选择器适配器 ==========

/** 为新组件适配的 AI 模式 */
const currentAIModeForSelector = computed({
  get: () => currentAIMode.value as AICapabilityMode,
  set: (val: AICapabilityMode) => {
    currentAIMode.value = val as typeof currentAIMode.value
  },
})

/** 为新组件适配的模型分类 */
const modelCategoryTabForSelector = computed({
  get: () => modelCategoryTab.value as ModelCategory,
  set: (val: ModelCategory) => {
    modelCategoryTab.value = val
  },
})

/** 为新组件适配的生成类型 */
const currentGenerationTypeForSelector = computed({
  get: () => currentGenerationType.value as GenerationType,
  set: (val: GenerationType) => {
    currentGenerationType.value = val as typeof currentGenerationType.value
  },
})

/** 为新组件适配的选中模型 */
const selectedModelForSelector = computed(() => {
  if (!selectedModel.value) return null
  return {
    id: selectedModel.value.id || selectedModel.value.modelCode || '',
    modelCode: selectedModel.value.modelCode || '',
    name: selectedModel.value.name || '',
    displayName: selectedModel.value.modelName || selectedModel.value.name || '',
    description: selectedModel.value.modelDesc || '',
    provider: selectedModel.value.provider || '',
    category: selectedModel.value.category as 'talk' | 'image' | 'video' | 'audio' | undefined,
    type: selectedModel.value.type as 'talk' | 'image' | 'video' | 'audio' | undefined,
  }
})

/** 为新组件适配的模型列表（含后端图标 icon/img 供能力面板展示） */
const modelsForSelector = computed(() => {
  return availableModels.value.map(model => ({
    id: model.id || model.modelCode || '',
    modelCode: model.modelCode || '',
    name: model.name || '',
    displayName: model.modelName || model.name || '',
    description: model.modelDesc || '',
    provider: model.provider || '',
    category: model.category as 'talk' | 'image' | 'video' | 'audio' | undefined,
    type: model.type as 'talk' | 'image' | 'video' | 'audio' | undefined,
    supportsImages: model.supportsImages,
    supportsVideo: model.supportsVideo,
    supportsAudio: model.supportsAudio,
    img: (model as { icon?: string }).icon ?? (model as { img?: string }).img,
    icon: (model as { icon?: string }).icon ?? (model as { img?: string }).img,
  }))
})

/** 为新组件适配的智能体列表（头像与 getAgentAvatarFromRaw 一致，便于能力选择器与消息气泡显示真实头像） */
const agentsForSelector = computed(() => {
  return unifiedAgents.value.map(agent => {
    const a = agent as Record<string, unknown>
    const meta = (a.metadata as Record<string, unknown>) ?? {}
    const avatar = getAgentAvatarFromRaw(a) ?? ''
    return {
      id: String(agent.id),
      name: agent.name ?? (a.agentName as string) ?? (meta.agentName as string) ?? (a.botName as string) ?? (meta.botName as string) ?? '',
      description: agent.description ?? (a.prologue as string) ?? (meta.prologue as string) ?? '',
      avatar: avatar || undefined,
      icon: (a.icon as string) ?? (meta.icon_url as string) ?? (meta.icon as string) ?? undefined,
      agentAvatar: (a.agentAvatar as string) ?? (meta.agentAvatar as string) ?? undefined,
      agent_avatar: (meta.agent_avatar as string) ?? undefined,
      icon_url: (meta.icon_url as string) ?? undefined,
    }
  }) as Agent[]
})

/** 为新组件适配的 MCP 工具列表（含服务器名称与简介，便于列表展示） */
const mcpToolsForSelector = computed<MCPTool[]>(() => {
  return unifiedMCPTools.value.map((cap: { id: string; name: string; description?: string; metadata?: { server?: { name?: string; description?: string } } }) => {
    const server = cap.metadata?.server
    return {
      id: cap.id,
      name: cap.name,
      description: cap.description || '',
      serverName: server?.name,
      serverDescription: server?.description,
    }
  })
})

/** 从新组件选择模型 */
const handleModelSelectFromSelector = (modelCode: string) => {
  handleModelSelect(modelCode)
  showAICapabilityPanel.value = false
}

/** 从新组件选择智能体（透传后端头像 avatar/agent_avatar/icon_url 等） */
const handleAgentSelectFromSelector = (agentId: string) => {
  const agent = unifiedAgents.value.find(a => a.id === agentId)
  if (agent) {
    const a = agent as Record<string, unknown>
    const avatar = getAgentAvatarFromRaw(a)
    handleAgentSelect({
      id: String(agent.id),
      name: agent.name ?? (a.agentName as string) ?? '',
      description: agent.description ?? '',
      avatar: avatar ?? undefined,
      icon: (a.icon as string) ?? ((a.metadata as Record<string, unknown>)?.icon_url as string) ?? undefined,
    } as Agent)
  }
  showAICapabilityPanel.value = false
}

/** 从新组件选择 MCP 工具 */
const handleMCPToolSelectFromSelector = (tool: MCPTool) => {
  handleMCPToolSelect({
    type: AICapabilityType.MCP,
    capabilityId: tool.id,
    input: {},
  })
}

/** 从新组件打开 API 接入对话框 */
const handleApiAccessFromSelector = (model: { modelCode?: string; id?: string }) => {
  const fullModel = availableModels.value.find(
    m => m.modelCode === model.modelCode || m.id === model.id
  )
  if (fullModel) {
    openApiAccessDialog(fullModel)
  }
}

// ========== 适配器结束 ==========

// 处理生成类型变化 - 预留供将来使用
const _handleGenerationTypeChange = (type: 'image' | 'video' | '3d' | 'vision' | 'auto') => {
  currentGenerationType.value = type
  showInfo(t('floatingChat.generationTypeChanged', { type: getGenerationTypeLabel(type) }))
}

// 处理提示词模板选择
const handlePromptTemplateSelect = (template: { content: string; title?: string }) => {
  showPromptTemplates.value = false
  setInputText(template.content)
  inputText.value = template.content // 保持同步
  nextTick(() => {
    inputRef.value?.focus()
    // 光标移到末尾
    const range = document.createRange()
    const selection = window.getSelection()
    if (selection && inputRef.value && inputRef.value.childNodes.length > 0) {
      range.selectNodeContents(inputRef.value)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  })
  showInfo(t('floatingChat.templateSelected'))
}

interface FileWithType {
  type?: string
  name?: string
  [key: string]: unknown
}

const _detectGenerationIntent = (message: string, files: FileWithType[] = []): 'image' | 'video' | '3d' | 'vision' | 'audio' | 'music' | null => {
  const lowerMessage = message.toLowerCase()

  const hasImage = files.some(f => f.type?.startsWith('image/'))
  const hasVideo = files.some(f => f.type?.startsWith('video/'))

  const videoKeywords = [t('data.a_i_chat.视频'), 'video', '动画', 'animation', '动态', 'motion', '生成视频', '视频生成']
  const imageKeywords = [t('data.a_i_chat.图片1'), '图像', 'image', 'photo', '画', 'draw', '生成图片', '图像生成', '绘图']
  const threeDKeywords = ['3d', '三维', '模型', 'model', '3d模型', '三维模型', '建模']
  const visionKeywords = [t('data.a_i_chat.识别2'), '分析', 'analyze', 'detect', 'vision', '视觉', '看图', '图片分析']
  const audioKeywords = [t('data.a_i_chat.语音3'), 'speech', 'voice', '朗读', '播报', '配音', 'tts', '文字转语音', '语音合成']
  const musicKeywords = [t('data.a_i_chat.音乐4'), 'music', '歌曲', 'song', '旋律', 'melody', '作曲', 'compose', '生成音乐', '音乐生成', '节奏']

  // 音乐生成优先级较高
  if (musicKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'music'
  }

  // 语音合成
  if (audioKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'audio'
  }

  if (hasVideo || videoKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'video'
  }

  if (threeDKeywords.some(kw => lowerMessage.includes(kw))) {
    return '3d'
  }

  if (hasImage && visionKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'vision'
  }

  if (imageKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'image'
  }

  return null
}

// 加载大模型历史对话（chatHistory.service，按 model_name 查询，参考 LLMChatCenter）
const loadModelChatHistory = async (options?: { autoSelectLatest?: boolean }) => {
  if (currentAIMode.value !== 'model' || !selectedModel.value) return
  const userUuid = getUserUuid()
  if (!userUuid) return
  const autoSelectLatest = options?.autoSelectLatest !== false

  modelChatHistoryLoading.value = true
  try {
    const res = await queryChatRecords({
      user_uuid: userUuid,
      model_name: selectedModel.value.name || getModelDisplayName(selectedModel.value),
      limit: 50,
    })
    const rawRes = (res as unknown as ChatRecordResponse)
    const dataAny = rawRes.data
    const rawAny = (dataAny ?? res) as ChatRecord[] | { list?: ChatRecord[]; data?: ChatRecord[] }
    const list: ChatRecord[] = Array.isArray(rawAny)
      ? rawAny
      : Array.isArray(rawAny?.list)
        ? rawAny.list
        : Array.isArray(rawAny?.data)
          ? rawAny.data
          : []
    const sorted = [...list].reverse() // 最新的在前
    modelChatHistory.value = sorted.map(chat => ({
      id: `model-chat-${chat.id}`,
      title: chat.mark || t('aiChat.chatTitle', { id: chat.id }),
      messages: [],
      createTime: chat.create_time,
      _chatId: chat.id,
    }))

    // 如果没有任何历史对话，则为当前模型创建一条默认「新对话」记录
    if (modelChatHistory.value.length === 0) {
      try {
        const mark = t('llmChatCenter.newConversation')
        const createRes = await createChatRecord({
          user_uuid: userUuid,
          model_name: selectedModel.value.name || getModelDisplayName(selectedModel.value),
          mark,
        })
        if (createRes.success && createRes.data && typeof createRes.data.id === 'number') {
          const recId = createRes.data.id
          const record = {
            id: `model-chat-${recId}`,
            title: createRes.data.mark || mark,
            messages: [] as ChatMessage[],
            createTime:
              createRes.data.create_time ||
              new Date().toISOString().replace('T', ' ').slice(0, 19),
            _chatId: recId,
          }
          modelChatHistory.value = [record]
          currentConversationId.value = record.id
          // 注意：真正传给后端的 chat_id 使用 _chatId（数字），逻辑上游 send 函数里
        }
      } catch (e) {
        logger.warn('Failed to create default model conversation record (loadModelChatHistory):', e)
      }
    }

    // 如果当前没有任何消息，且存在历史对话，则自动加载最新一条会话的内容
    if (autoSelectLatest && messages.value.length === 0 && modelChatHistory.value.length > 0) {
      const latestConversationId = modelChatHistory.value[0].id
      // 自动加载不打扰用户：不弹 “已加载历史会话”
      await loadConversation(latestConversationId, { silentToast: true })
    }
  } catch (e) {
    logger.warn('Failed to load LLM chat history', e)
    modelChatHistory.value = []
  } finally {
    modelChatHistoryLoading.value = false
  }
}

// 加载后端对话历史（可选）
const loadBackendConversations = async () => {
  if (!enableBackendSync.value) return
  // 修复无限刷新循环: 未登录时不调用需要 token 的 API
  // 原因: request.ts 拦截器检测到无 token 会 setTimeout 1.5s 后跳 /login,
  // 路由守卫又把 /login 重定向回 /, App.vue 重新挂载, AIChat 再次调用本方法, 形成死循环
  if (!getUserUuid()) return

  try {
    const response = await getConversations({ page: 1, pageSize: 50 })
    if (response.success && response.data?.conversations) {
      // 合并后端对话和本地对话
      const backendConversations = response.data.conversations.map(conv => ({
        id: `backend-${conv.id}`,
        backendId: conv.id,
        title: conv.title,
        messages: [], // 延迟加载消息
        createTime: conv.createdAt,
        backendSynced: true,
      }))

      // 合并到本地历史（避免重复）
      const localHistory = conversationHistory.value || []
      const mergedHistory = [...localHistory]

      interface ConversationWithBackendId {
        id: string
        title: string
        messages: ChatMessage[]
        createTime: string
        backendId?: string
        backendSynced?: boolean
      }
      backendConversations.forEach(backendConv => {
        const convWithId = backendConv as ConversationWithBackendId
        const exists = mergedHistory.find(c => (c as ConversationWithBackendId).backendId === convWithId.backendId)
        if (!exists) {
          mergedHistory.push(convWithId)
        }
      })

      // 按时间排序
      mergedHistory.sort((a, b) =>
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      )

      // 限制数量
      if (mergedHistory.length > 50) {
        mergedHistory.splice(50)
      }

      conversationHistory.value = mergedHistory
      StorageManager.setItem('floating-chat-history', mergedHistory)
    }
  } catch (error: unknown) {
    // 静默处理 404 错误（后端可能未实现该功能）
    // 也静默处理 500 错误中的t('aiChat.unlogged')情况（用户未登录时调用此 API 是正常的）
    // 检查多种可能的错误格式：
    // 1. Axios 错误：error.response?.status === 404
    // 2. 业务错误：error.code === 404 或 error.code === 500 且消息包含 "404"/"NOT_FOUND"
    // 3. 业务错误：error.code === 500 且消息包含 "未登录"/t('aiChat.unauthorized')/"UNAUTHORIZED"
    const axiosError = error as { response?: { status?: number }; code?: number; msg?: string; message?: string }
    const errorMessage = axiosError.msg || axiosError.message || ''
    const is404Error =
      axiosError.response?.status === 404 ||
      axiosError.code === 404 ||
      (axiosError.code === 500 && (
        errorMessage.includes('404') ||
        errorMessage.includes('NOT_FOUND')
      ))

    const isUnauthorizedError =
      axiosError.response?.status === 401 ||
      axiosError.code === 401 ||
      (axiosError.code === 500 && (
        errorMessage.includes(t('aiChat.unlogged')) ||
        errorMessage.includes(t('aiChat.unauthorized')) ||
        errorMessage.includes('UNAUTHORIZED') ||
        errorMessage.includes('unauthorized')
      ))

    if (is404Error) {
      // 后端会话接口暂不可用（如未部署或路径变更）时静默降级为本地存储
      if (import.meta.env.DEV) {
        logger.debug('Chat history backend unavailable, using local record', { error })
      }
    } else if (isUnauthorizedError) {
      // 未登录时跳过后端同步属正常行为
      if (import.meta.env.DEV) {
        logger.debug('User not logged in, skipping backend chat history sync', { error })
      }
    } else {
      logger.warn(t('common.errors.fetchFailed'), error)
    }
  }
}

// 大模型切换时加载对应历史，并将消息区域滚动到底部
watch(
  [selectedModel, currentAIMode],
  () => {
    if (currentAIMode.value === 'model' && selectedModel.value) {
      loadModelChatHistory().finally(() => {
        // 切换模型后，确保消息区域自动滚动到底部，方便查看最新消息
        scrollToBottom(true)
      })
    } else {
      modelChatHistory.value = []
      // 退出大模型模式时，同样将当前消息视图滚到底部，避免停留在旧位置
      scrollToBottom(true)
    }
  },
  { immediate: false }
)

// 打开历史面板时刷新大模型历史（user-model-chat/query）
watch(showHistoryPanel, (visible) => {
  if (visible && currentAIMode.value === 'model' && selectedModel.value) {
    // 打开面板仅刷新列表，不要自动切换/加载会话
    loadModelChatHistory({ autoSelectLatest: false })
  }
})

// 原 showSessionList watch 已随 ChatSessionPanel 一起移除（会话历史入口已统一走 SidebarChatHistory）

// 统一处理通过 props.agentId 选中智能体的情况（等 unifiedAgents 加载完再匹配）
watch(
  () => [props.agentId, currentAIMode.value, unifiedAgents.value],
  () => {
    if (!props.agentId) return
    if (currentAIMode.value !== 'agent') return
    if (selectedAgent.value) return

    const agent = unifiedAgents.value.find(a => a.id === props.agentId)
    if (agent) {
      const a = agent as Record<string, unknown>
      const avatar = getAgentAvatarFromRaw(a)
      selectedAgent.value = {
        id: String(agent.id),
        name: agent.name ?? (a.agentName as string) ?? '',
        description: agent.description ?? '',
        avatar: avatar ?? undefined,
        icon: (a.icon as string) ?? ((a.metadata as Record<string, unknown>)?.icon_url as string) ?? undefined,
        ...(agent.metadata as Partial<Agent> || {}),
      } as Agent
    }
  },
  { deep: true }
)

// 生命周期
onMounted(async () => {
  loadModels()
  // 修复无限刷新循环: 未登录时不调用 loadAgents (内部会调用 getAgentList 需要 token)
  // 原因同 loadBackendConversations: request.ts 拦截器无 token 会 setTimeout 1.5s 跳 /login
  if (getUserUuid()) {
    try { await loadAgents() } catch (e) { console.error(e) }
  }

  // 初始化语音识别服务（根据网络环境自动配置）
  initializeSpeechService()

  // 处理初始 AI 模式
  if (props.aiMode) {
    currentAIMode.value = props.aiMode
  }

  // 大模型模式下加载所选模型的历史
  if (currentAIMode.value === 'model' && selectedModel.value) {
    loadModelChatHistory()
  }

  // 加载对话历史（先加载本地，再同步后端）
  const history = StorageManager.getItem<Array<{ id: string; title: string; messages: ChatMessage[]; createTime: string }>>('floating-chat-history') || []
  conversationHistory.value = history

  // 异步加载后端对话历史
  if (enableBackendSync.value) {
    loadBackendConversations()
  }

  // 初始化位置（仅在 floating 模式下）
  if (props.mode === 'floating') {
    // 恢复窗口大小（如果有保存）
    const savedSize = StorageManager.getItem<{ width: number; height: number }>('floating-chat-size')
    if (savedSize) {
      dialogSize.value = {
        width: Math.max(minSize.width, Math.min(maxSize.width, savedSize.width)),
        height: Math.max(minSize.height, Math.min(maxSize.height, savedSize.height)),
      }
    }

    // 设置展开状态的默认位置（最小化状态下通过 CSS right/bottom 定位，不需要计算）
    const defaultPosition = {
      x: Math.max(0, window.innerWidth - dialogSize.value.width - 20),
      y: Math.max(0, window.innerHeight - dialogSize.value.height - 20),
    }

    // 检查是否有保存的位置
    const savedPosition = StorageManager.getItem<{ x: number; y: number }>('floating-chat-position')
    if (savedPosition) {
      const maxX = window.innerWidth - dialogSize.value.width
      const maxY = window.innerHeight - dialogSize.value.height
      defaultPosition.x = Math.max(0, Math.min(maxX, savedPosition.x))
      defaultPosition.y = Math.max(0, Math.min(maxY, savedPosition.y))
    }

    // 保存位置供展开时使用
    dialogPosition.value = defaultPosition
    preMinimizePosition = { ...defaultPosition }
  } else {
    // embedded 模式不需要定位
    dialogPosition.value = { x: 0, y: 0 }
  }

  // 注册全局打开函数
  if (typeof window !== 'undefined') {
    ; (window as typeof window & {
      openFloatingChat?: (options?: {
        initialText?: string
        mode?: string
        theme?: 'default' | 'custom-service'
        quickFaqList?: Array<{ id: number; question: string; answer: string }>
        showTicketsEntry?: boolean
      }) => void
    }).openFloatingChat = (options?: {
      initialText?: string
      mode?: string
      theme?: 'default' | 'custom-service'
      quickFaqList?: Array<{ id: number; question: string; answer: string }>
      showTicketsEntry?: boolean
    }) => {
        isVisible.value = true
        isMinimized.value = false
        if (options?.theme !== undefined) floatingTheme.value = options.theme
        if (options?.theme === 'custom-service') {
          floatingQuickFaq.value = options.quickFaqList?.length ? options.quickFaqList : DEFAULT_CUSTOMER_SERVICE_FAQ
          if (options?.showTicketsEntry !== undefined) floatingShowTickets.value = options.showTicketsEntry
          else floatingShowTickets.value = true
          if (options?.mode === undefined) switchAIMode('agent')
        }
        if (options?.quickFaqList?.length && options?.theme !== 'custom-service') floatingQuickFaq.value = options.quickFaqList
        if (options?.showTicketsEntry !== undefined && options?.theme !== 'custom-service') floatingShowTickets.value = options.showTicketsEntry
        if (options?.initialText) {
          setInputText(options.initialText)
          inputText.value = options.initialText
        }
        if (options?.mode && options?.theme !== 'custom-service') {
          switchAIMode(options.mode as 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'auto' | 'generation')
        }
        nextTick(() => inputRef.value?.focus())
      }
  }
})

// 组件挂载状态标志位
let isMounted = true

// 继续注册组件级清理
cleanup.add(() => { isMounted = false })
cleanup.add(() => { if (minimizedWidthObserver) { minimizedWidthObserver.disconnect(); minimizedWidthObserver = null } })
cleanup.add(() => { if (messagesResizeObserver) { messagesResizeObserver.disconnect(); messagesResizeObserver = null } })
cleanup.add(() => { if (isDragging.value) { stopDrag() } })
cleanup.add(() => { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null } })
cleanup.add(() => { chatRafIds.forEach(id => cancelAnimationFrame(id)); chatRafIds.clear() })
cleanup.add(() => { if (isResizing.value) { stopEdgeResize() } })
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
cleanup.add(() => { if (isRecording.value) { stopVoiceRecording() } })
cleanup.add(() => { if (recordingTimer !== null) { clearInterval(recordingTimer); recordingTimer = null } })
cleanup.add(() => { if (scrollThrottleTimer !== null) { clearTimeout(scrollThrottleTimer); scrollThrottleTimer = null } })
cleanup.add(() => {
  if (generationWebSockets.value) {
    generationWebSockets.value.forEach((ws, messageId) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
        logger.info(`Closing generation task WebSocket: ${messageId}`)
      }
    })
    generationWebSockets.value.clear()
  }
  if (currentModelWebSocket.value) {
    currentModelWebSocket.value.close()
    currentModelWebSocket.value = null
  }
})
// 最终保存窗口位置、大小和消息
cleanup.add(() => {
  try {
    StorageManager.setItem('floating-chat-position', dialogPosition.value)
    StorageManager.setItem('floating-chat-size', dialogSize.value)
    if (isAutoSave.value && messages.value.length > 0) {
      saveConversation()
    }
    StorageManager.setItem('floating-chat-messages', messages.value)
  } catch (error) {
    logger.error(t('common.errors.saveFailed'), error)
  }
})
</script>

<style lang="scss" scoped>
// 导入 AI 对话框设计令牌
@use '@/styles/ai-chat-variables' as *;
// CTA 主色 SCSS 桥接变量 (单一来源 _global-tokens.scss, 避免硬编码 #2563eb 等红线色值)
@use '@/styles/_global-tokens.scss' as gt;
// SCSS 模块化迁移：标题栏 / 消息列表 / 输入区域 / 会话列表
@use '@/styles/ai-chat/header' as *;
@use '@/styles/ai-chat/message-list' as *;
@use '@/styles/ai-chat/input-area' as *;
@use '@/styles/ai-chat/session-list' as *;

// ============================================
// 组件级 CSS 变量定义
// ============================================
.floating-chat-dialog-wrapper {

  // 扁平化设计：阴影和滤镜
  --fcd-box-shadow: none;
  --fcd-filter: none;

  // 边框和轮廓
  --fcd-border: none;
  --fcd-outline: none;

  // 圆角系统
  --fcd-radius-lg: 15px;
  --fcd-radius-md: 12px;
  --fcd-radius-sm: 8px;
  --fcd-radius-xs: 6px;
  --fcd-radius-round: 50%;

  // 按钮尺寸（统一标准：普通28px，最小化24px）
  --fcd-btn-size: 28px;
  --fcd-btn-size-min: 24px;
  --fcd-btn-icon-size: 16px;
  --fcd-btn-icon-size-min: 14px;
  --fcd-btn-radius: 6px;

  // 按钮颜色（统一标准）；描边用全局变量，hover 时加深
  --fcd-btn-color: var(--el-text-color-regular);
  --fcd-btn-bg: var(--el-fill-color-light);
  --fcd-btn-border: var(--border-unified-color);
  --fcd-btn-hover-color: var(--el-color-primary);
  --fcd-btn-hover-bg: var(--el-fill-color);
  --fcd-btn-hover-border: var(--border-unified-color-hover);
  --fcd-btn-active-color: var(--el-color-primary);
  --fcd-btn-active-bg: var(--el-color-primary-light-9);
  --fcd-btn-active-border: var(--border-unified-color-hover);

  // 搜索栏背景色（亮色模式）
  --fcd-search-bg: var(--el-fill-color-light);
  --fcd-search-bg-hover: var(--el-fill-color);
  --fcd-search-bg-focus: var(--el-bg-color-page);

  // 输入区域
  --fcd-input-bg: transparent;
  --fcd-input-border: none;

  // 发送按钮（亮色：主色底、背景色字，hover 用全局 token）
  --fcd-send-btn-bg: var(--el-text-color-primary);
  --fcd-send-btn-color: var(--el-bg-color);
  --fcd-send-btn-hover-bg: var(--fcd-send-btn-hover-bg);

  // 发送按钮 is-ready 蓝色状态（trae work 主色蓝）— 引用 SCSS 桥接变量避免硬编码红线色值
  --color-ai-send-btn-bg: #{gt.$color-cta-blue};
  --color-ai-send-btn-active: #{gt.$color-cta-blue-hover};
  --color-cta-blue-active: #{gt.$color-cta-blue-active};
  --color-cta-blue-hover: #{gt.$color-cta-blue-hover};

  // 消息气泡背景（亮色：天蓝色；暗色在下方覆盖为深蓝色）
  --fcd-message-bubble-bg: var(--el-color-primary-light-5);

  // 容器查询网格列数
  --fcd-grid-cols-default: 1fr;
  --fcd-grid-cols-2: repeat(2, 1fr);
  --fcd-grid-cols-3: repeat(3, 1fr);
}

// 暗色模式变量覆盖
:where(html.dark) .floating-chat-dialog-wrapper {
  // 按钮颜色（与亮色语义一致：默认浅底，hover 略深）
  --fcd-btn-color: var(--el-text-color-secondary);
  --fcd-btn-bg: var(--color-white-4);
  --fcd-btn-border: var(--border-unified-color);
  --fcd-btn-hover-color: var(--el-text-color-primary);
  --fcd-btn-hover-bg: var(--color-white-8);
  --fcd-btn-hover-border: var(--border-unified-color-hover);
  --fcd-btn-active-color: var(--el-text-color-primary);
  --fcd-btn-active-bg: var(--color-white-6);
  --fcd-btn-active-border: var(--border-unified-color-hover);

  // 搜索栏背景色（暗色模式）
  --fcd-search-bg: var(--color-white-5);
  --fcd-search-bg-hover: var(--color-white-8);
  --fcd-search-bg-focus: var(--color-white-10);

  // 发送按钮（暗色：背景底、主色字，hover 用全局 token）
  --fcd-send-btn-bg: var(--el-bg-color);
  --fcd-send-btn-color: var(--el-text-color-primary);
  --fcd-send-btn-hover-bg: var(--fcd-send-btn-hover-bg);

  // 发送按钮 is-ready 蓝色状态（暗色更亮一点的蓝）
  --color-ai-send-btn-bg: #3b82f6;
  --color-ai-send-btn-active: #{gt.$color-cta-blue};
  --color-cta-blue-active: #{gt.$color-cta-blue-active};
  --color-cta-blue-hover: #{gt.$color-cta-blue-hover};

  // 消息气泡背景（暗色模式：深蓝色）
  --fcd-message-bubble-bg: var(--el-color-primary-light-9);
}

// 悬浮窗发送按钮：颜色与单行布局（使用 :where() 包裹祖先层级，特异性恒为 0）
:where(.floating-chat-dialog-wrapper .input-actions) .el-button.send-btn {
  padding: 0 12px;
  background: var(--fcd-send-btn-bg);
  border-color: var(--fcd-send-btn-bg);
  color: var(--fcd-send-btn-color);
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;

  :deep(> span) {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: nowrap;
  }

  :deep(.el-icon),
  .send-btn-text {
    color: var(--fcd-send-btn-color);
  }

  &:hover:not(:disabled) {
    background: var(--fcd-send-btn-hover-bg);
    border-color: var(--fcd-send-btn-hover-bg);
    :deep(.el-icon),
    .send-btn-text {
      color: var(--fcd-send-btn-color);
    }
  }

  &:disabled {
    background: var(--fcd-send-btn-bg);
    border-color: var(--fcd-send-btn-bg);
    :deep(.el-icon),
    .send-btn-text {
      color: var(--fcd-send-btn-color);
    }
  }
}

// 悬浮触发按钮 - 与教育文档页「上传文档」等浮动按钮统一样式（46×46px），避免重叠时需与彼侧留出间距
.floating-chat-trigger {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 46px;
  height: 46px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
  z-index: var(--z-dropdown);
  border: var(--unified-border); // 低对比色描边
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  box-shadow: var(--fcd-box-shadow); // 扁平化设计：移除所有投影
  filter: var(--fcd-filter);

  .el-icon {
    font-size: 18px;
  }

  .unread-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--el-color-danger);
    color: var(--el-bg-color-page);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
}

// 对话框包装器
.floating-chat-dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: var(--z-modal);

  // 最小化状态 - 现代紧凑胶囊设计（直接样式覆盖）
  &.is-minimized {

    .floating-chat-dialog {
      width: auto; /* 实际宽度由 JS 同步为标题栏宽度，见 syncMinimizedDialogWidth */
      min-width: 120px; /* 避免无可见子元素时 flex 收缩成竖线；下限保证可读 */
      max-width: min(360px, 100vw); /* 防止首帧或同步异常时被拉成全屏宽 */
      height: 46px;
      min-height: 46px;
      resize: none;
      padding: 0;
      box-sizing: border-box;
      border-radius: var(--global-border-radius);
      backdrop-filter: blur(12px);
      background: var(--el-bg-color-page);
      border: var(--unified-border);
      z-index: var(--z-0); /* 让标题栏叠在上层以显示图标/名称/按钮 */

      &.is-dark {
        background: var(--el-bg-color-page);
        border-color: var(--el-border-color);
      }
    }

    /* 标题栏已在 dialog 内，最小化时仅调整尺寸与背景，取消负外边距（dialog 此时 padding 为 0） */
    /* 使用 width: max-content 避免标题栏被父级撑满（否则首帧可能 100% 继承全屏宽，导致整条被拉长） */
    .dialog-header {
      margin: 0;
      width: max-content;
      min-width: 120px;
      max-width: min(360px, 100vw);
      height: 46px;
      min-height: 46px;
      box-sizing: border-box;
      padding: 6px 8px 6px 12px;
      background: transparent;
      box-shadow: none;
      gap: 8px;
      overflow: visible;
      border-radius: 0;

      &::after {
        display: none;
      }
    }

    .header-left {
      flex: 0 0 auto;
    }

    .header-right {
      gap: 2px;
      margin-left: 8px;
    }

    // 最小化状态按钮样式已在统一按钮系统中处理

    .minimized-model-info {
      gap: 12px; // 进一步增大间距

      .minimized-model-icon {
        width: 32px; // 大幅放大图标
        height: 32px;
        border-radius: var(--global-border-radius);
      }

      .minimized-model-icon-fallback {
        width: 32px; // 大幅放大图标
        height: 32px;
        font-size: 20px; // 放大字体
      }

      .minimized-model-name {
        font-size: 16px; // 进一步放大文字
        font-weight: 500;
        max-width: none;
        white-space: nowrap;
        color: var(--el-text-color-primary);
      }
    }

    // 最小化时隐藏主体区，避免 1px 高分隔线露出
    .dialog-body-wrap {
      display: none;
    }
  }

  // 内嵌模式：不使用固定定位
  &.is-embedded {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    bottom: auto;
    pointer-events: all;
    z-index: auto;
    width: 100%;
    height: 100%;

    // 使用双重类选择器增加特异性
    .floating-chat-dialog {
      position: relative;
      width: 100%;
      height: 100%;
      top: auto;
      left: auto;
      right: auto;
      bottom: auto;
      border-radius: var(--ai-chat-border-radius-md);
    }
  }
}

// 对话框主体 - 使用全站唯一描边设定
.floating-chat-dialog {
  position: absolute;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: none;
  filter: none;
  display: flex;
  flex-direction: column;
  overflow: visible;
  pointer-events: all;
  border: var(--unified-border);
  transition: border-color 0.3s ease;
  /* ── 设计意图 ──
   * 浮窗 .floating-chat-dialog 自身有 8px padding 维持内容到边框的内边距。
   * 标题栏 .dialog-header 故意"贴边"伸出 padding 范围以呈现浮窗边框整体感，
   * 通过 width = 100% + 2*fcd-padding 与 margin = -1*fcd-padding 反向补偿。
   * embedded 模式下父容器 padding 已被 sidebar-layout 设为 0，
   * 因此 --fcd-padding 也必须同步为 0，让标题栏自动恢复 100% 宽贴齐 ai-side-panel。
   * 不要硬编码 8px/16px 数字 — 改 padding 时只需改 --fcd-padding，标题栏自动跟随。 */
  --fcd-padding: 8px;
  padding: var(--fcd-padding);
  box-sizing: border-box;
  resize: none;

  &.is-dragging {
    cursor: move;
    /* 拖拽时保持与常态一致的描边，不改为纯黑或主题色 */
  }

  &.is-resizing {
    user-select: none;
  }

  &.is-dark {
    background: var(--el-bg-color-page);
    border-color: var(--el-border-color);
  }

  /* embedded 模式：父容器 padding 已被 _sidebar-layout.scss 设为 0，
   * 同步把 --fcd-padding 设为 0 让标题栏自动恢复 100% 宽贴齐父容器。
   * 不必再手动重置 .dialog-header 的 width/margin，CSS 变量系统自动处理。 */
  &.is-embedded {
    --fcd-padding: 0;
  }

  /* 标题栏在 dialog 内：通过 --fcd-padding 反向贴边，露出 dialog 顶部描边 */
  .dialog-header {
    width: calc(100% + var(--fcd-padding) * 2);
    margin: calc(-1 * var(--fcd-padding)) calc(-1 * var(--fcd-padding)) 0;
    box-sizing: border-box;
    border-radius: var(--global-border-radius) var(--global-border-radius) 0 0;
    box-shadow: none;
  }

  /* 防御性兜底：如果未来有人改动 --fcd-padding 的级联路径（比如提到 wrapper 上），
   * 这条规则确保 embedded 模式仍能强制重置标题栏。Playwright 测试会同时守门
   * (1) --fcd-padding 重置 (2) 这条 fallback 规则 存在。 */
  &.is-embedded .dialog-header {
    width: 100%;
    margin: 0;
    border-radius: 0;
  }
}

// ========================================
// 统一按钮样式系统（一处定义，全局复用）
// ========================================
// 所有按钮（header-btn, action-btn, message-action-btn）使用统一样式
// 通过 CSS 变量控制尺寸，避免重复定义
.floating-chat-dialog-wrapper {

  // 统一按钮基础样式（应用于所有 .el-button--small）
  :deep(.el-button.el-button--small) {
    // 尺寸
    width: var(--fcd-btn-size);
    height: var(--fcd-btn-size);
    min-width: var(--fcd-btn-size);
    min-height: var(--fcd-btn-size);
    max-width: var(--fcd-btn-size);
    max-height: var(--fcd-btn-size);
    padding: 0;
    margin: 0;

    // 外观
    background: var(--fcd-btn-bg);
    border: var(--unified-border);
    border-radius: var(--fcd-btn-radius);
    color: var(--fcd-btn-color);
    box-shadow: none;

    // 布局
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;

    // 图标
    .el-icon {
      font-size: var(--fcd-btn-icon-size);
      width: var(--fcd-btn-icon-size);
      height: var(--fcd-btn-icon-size);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
    }

    // SVG 图标
    svg {
      display: inline-block;
      width: var(--fcd-btn-icon-size);
      height: var(--fcd-btn-icon-size);
      flex-shrink: 0;
    }

    // 回复按钮：全角双引号 ＂＂（正常字重）
    .reply-quote-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--fcd-btn-icon-size);
      line-height: 1;
      color: inherit;
      font-family: inherit;
      font-weight: 400;
    }

    // 隐藏按钮内的文字 span（保留图标用 span，如回复双引号）
    .el-button__inner > span:not(.el-icon):not(.reply-quote-icon) {
      display: none;
    }

    // 悬停：统一使用 fcd 变量
    &:hover:not(:disabled) {
      background: var(--fcd-btn-hover-bg);
      border-color: var(--fcd-btn-hover-border);
      color: var(--fcd-btn-hover-color);
    }

    // 按下
    &:active:not(:disabled) {
      background: var(--fcd-btn-active-bg);
      border-color: var(--fcd-btn-active-border);
      color: var(--fcd-btn-active-color);
    }

    // 激活状态
    &.is-active {
      color: var(--fcd-btn-active-color);
      background: var(--fcd-btn-active-bg);
      border-color: var(--fcd-btn-active-border);
    }
  }

  // 「+ 选择」能力下拉触发按钮 - 覆盖上方通用 icon-button 方形尺寸
  // 该按钮是「图标 + 文字 + 箭头」的文本按钮，不是纯图标按钮：
  //   - 需要按内容自适应宽度（不能用 28px 方形 max-width 钳制）
  //   - 需要 padding: 0 10px（通用规则强制 padding:0 会导致内容贴边、溢出）
  //   - 透明背景 + 白色描边 + 项目统一 8px 圆角 (跟随 --app-button-radius)
  // 使用更高特异性（带 .tw-selector-pill，0,5,0 > 通用 0,4,0）确保覆盖
  // 历史教训(2026-07-03): 不加此覆盖时，按钮被钳成 28×28 方块，60px 内容溢出，
  //   Plus 图标被推到 input-wrapper(overflow:hidden) 左边界外被裁成"点"，
  //   且背景方块装不下「图标+选择+箭头」内容
  // 圆角约束 (2026-07-03 更新): 改用 var(--app-button-radius) (8px) 跟随项目统一规范,
  //   旧值 14px 胶囊形违反"禁止彻底圆角/胶囊形"硬约束 (见 project_memory.md)
  :deep(.el-button.el-button--small.tw-selector-pill) {
    // 尺寸 - 按内容自适应，不强制方形
    width: auto;
    min-width: 0;
    max-width: none;
    height: 28px;
    min-height: 0;
    max-height: none;
    padding: 0 10px;
    margin: 0;

    // 外观 - 透明背景 + 白色描边 + 项目统一圆角 (8px)
    background: transparent;
    border: 1px solid var(--color-white-30);
    border-radius: var(--app-button-radius);
    color: var(--el-text-color-regular);
    box-shadow: none;

    // 布局
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
    outline: none;

    // 图标尺寸（Plus / ArrowDown）
    .el-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin: 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    // 文字标签
    .tw-selector-label {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 1;
    }

    // 箭头图标稍弱
    .tw-selector-caret {
      font-size: 12px;
      opacity: 0.6;
    }

    // 悬停
    &:hover:not(:disabled) {
      border-color: var(--color-white-50);
      background: var(--el-fill-color-light);
      color: var(--el-text-color-regular);
    }

    // 按下
    &:active:not(:disabled) {
      border-color: var(--color-white-60);
    }
  }

  // 发送按钮特殊样式 - 覆盖上方通用 icon-button 样式
  // 发送按钮需要更宽（图标+文字同行），并提供三状态颜色
  // 使用更高特异性（带 el-button--primary）确保覆盖通用规则
  :deep(.el-button.el-button--primary.el-button--small.send-btn) {
    // 尺寸 - 自适应内容宽度，但有最小宽度确保文字完整显示
    width: auto;
    min-width: 92px;
    height: 32px;
    min-height: 32px;
    max-width: none;
    max-height: none;
    padding: 0 16px;
    margin: 0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.25s ease;

    // 内部内容容器
    > span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    // 图标
    .el-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      margin: 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    // SVG 图标
    svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    // 文字
    .send-btn-text {
      display: inline;
      font-size: 13px;
      line-height: 1;
      font-weight: 500;
      white-space: nowrap;
    }

    // ============================
    // 状态 1: 空状态（无内容）— 浅灰禁用态
    // 与 trae work 一致：禁用灰 + 弱对比
    // ============================
    &.is-empty,
    &.is-empty.is-disabled,
    &.is-empty:disabled {
      // 显式提高特异性，覆盖 Element Plus disabled 默认样式
      background: var(--el-fill-color-light);
      border: 1px solid var(--el-border-color-lighter);
      color: var(--el-text-color-placeholder);
      box-shadow: none;
      cursor: not-allowed;
      opacity: 1;
      // Element Plus disabled 会降低不透明度，强制还原
      -webkit-opacity: 1;
      --el-button-disabled-bg-color: var(--el-fill-color-light);
      --el-button-disabled-border-color: var(--el-border-color-lighter);
      --el-button-disabled-text-color: var(--el-text-color-placeholder);
    }

    // 暗色模式：使用深色背景 + 清晰可见的浅色文字，保证对比度
    // 使用 html.dark 直接匹配（不用 :where()），确保特异性可正确覆盖
    html.dark &.is-empty,
    html.dark &.is-empty.is-disabled,
    html.dark &.is-empty:disabled {
      background: rgba(255, 255, 255, 0.18) !important; /* no-important-exempt: 覆盖 Element Plus el-button :disabled 自动降低不透明度的默认行为 */
      border-color: rgba(255, 255, 255, 0.25) !important; /* no-important-exempt: 覆盖 Element Plus el-button :disabled 默认边框色 */
      color: rgba(255, 255, 255, 0.95) !important; /* no-important-exempt: 覆盖 Element Plus el-button :disabled 默认文字色 */
      --el-button-disabled-bg-color: rgba(255, 255, 255, 0.18) !important; /* no-important-exempt: 覆盖 Element Plus 内部 disabled 颜色变量 */
      --el-button-disabled-border-color: rgba(255, 255, 255, 0.25) !important; /* no-important-exempt: 覆盖 Element Plus 内部 disabled 边框变量 */
      --el-button-disabled-text-color: rgba(255, 255, 255, 0.95) !important; /* no-important-exempt: 覆盖 Element Plus 内部 disabled 文字变量 */

      .el-icon,
      .send-btn-text {
        color: rgba(255, 255, 255, 0.95) !important; /* no-important-exempt: 暗色模式强制 send-btn-text 浅色保持可读 */
      }

      svg {
        fill: currentColor !important; /* no-important-exempt: 暗色模式 SVG fill 跟随 currentColor */
      }

      // 直接锁定 > span 内的所有元素
      > span {
        color: rgba(255, 255, 255, 0.95) !important; /* no-important-exempt: 暗色模式 > span 文字保持浅色 */
      }

      // 直接锁定 SVG path（避免 fill 继承问题）
      svg path {
        fill: rgba(255, 255, 255, 0.95) !important; /* no-important-exempt: 暗色模式 SVG path 强制浅色填充 */
      }
    }

    &.is-empty,
    &.is-empty.is-disabled,
    &.is-empty:disabled {
      // 显式设灰色，不能用 inherit —— .send-btn-text 的父元素是 Element Plus
      // 内部包裹 span（被 :where(.el-button--primary) span 设为白色），inherit 会
      // 继承到白色，导致浅灰背景上白字不可见。暗色模式由下方 !important 块覆盖为白色。
      .el-icon,
      .send-btn-text {
        color: var(--el-text-color-placeholder);
      }

      svg {
        fill: currentColor;
      }

      &:hover,
      &:hover.is-disabled,
      &:hover:disabled {
        background: var(--el-fill-color-light);
        color: var(--el-text-color-placeholder);
        transform: none;
        box-shadow: none;
      }
    }

    // 暗色模式 hover 态 - 提升对比度
    html.dark &.is-empty:hover,
    html.dark &.is-empty.is-disabled:hover,
    html.dark &.is-empty:disabled:hover {
      background: rgba(255, 255, 255, 0.24) !important; /* no-important-exempt: 暗色模式 hover 提升对比度 */
      border-color: rgba(255, 255, 255, 0.32) !important; /* no-important-exempt: 暗色模式 hover 边框提升 */
      color: #ffffff !important; /* no-important-exempt: 暗色模式 hover 文字纯白 */

      .el-icon,
      .send-btn-text {
        color: #ffffff !important; /* no-important-exempt: 暗色模式 hover send-btn-text 纯白 */
      }
    }

    // ============================
    // 状态 2: 可发送（有内容）— 蓝色（trae work 主色）
    // 不再跟随 --el-color-primary（被覆盖为黑色），改用固定品牌蓝
    // ============================
    &.is-ready {
      background: var(--color-ai-send-btn-bg); // trae work 风格的蓝色
      border: none;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);

      :where(html.dark) & {
        background: var(--color-ai-send-btn-bg); // 暗色模式更亮一点的蓝
        box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
      }

      .el-icon,
      .send-btn-text {
        color: #ffffff;
      }

      svg {
        fill: currentColor;
      }

      &:hover:not(:disabled) {
        background: var(--color-ai-send-btn-active);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
        transform: translateY(-1px);

        :where(html.dark) & {
          background: var(--color-ai-send-btn-bg);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
      }

      &:active:not(:disabled) {
        background: var(--color-cta-blue-active);
        transform: translateY(0);
        box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);

        :where(html.dark) & {
          background: var(--color-cta-blue-hover);
        }
      }
    }

    // ============================
    // 状态 3: 发送中 — 橙色（trae work 的"工作中"警示色）
    // 与可发送状态的蓝色形成明显对比
    // ============================
    &.is-sending {
      background: #f59e0b; // trae work 风格的橙色
      border: none;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);
      cursor: wait;
      animation: send-btn-pulse 1.4s ease-in-out infinite;

      :where(html.dark) & {
        background: #fbbf24; // 暗色模式更亮一点的橙
        box-shadow: 0 2px 6px rgba(251, 191, 36, 0.3);
      }

      .el-icon,
      .send-btn-text {
        color: #ffffff;
      }

      svg {
        fill: currentColor;
        animation: send-btn-spin 1s linear infinite;
      }

      &:hover {
        background: #f59e0b;
        transform: none;
        box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);

        :where(html.dark) & {
          background: #fbbf24;
        }
      }
    }
  }

  // 发送按钮 loading 旋转动画
  @keyframes send-btn-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  // 发送按钮 pulse 动画（发送中状态）— 橙色光晕
  @keyframes send-btn-pulse {
    0%, 100% {
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25), 0 0 0 0 rgba(245, 158, 11, 0.5);
    }
    50% {
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25), 0 0 0 6px rgba(245, 158, 11, 0);
    }
  }

  // 点赞激活状态
  :deep(.is-liked.el-button) {
    color: var(--el-color-warning);
  }

  // 最小化状态：按钮使用更小尺寸，hover 使用全局填充色
  &.is-minimized :deep(.el-button.el-button--small) {
    --fcd-btn-size: var(--fcd-btn-size-min);
    --fcd-btn-icon-size: var(--fcd-btn-icon-size-min);
    opacity: 0.6;
    background: transparent;
    border: none;

    &:hover {
      opacity: 1;
      background: var(--el-fill-color);
    }
  }
}

// 标题栏 - 在 dialog 内第一项，参与拖拽
/* .dialog-header 样式：已迁移至 styles/ai-chat/_header.scss */


// 搜索栏：无外层 search-bar 容器，输入框与搜索结果为 dialog-body-wrap 直接子级
.floating-chat-search-input {
  flex-shrink: 0;
  width: 100%;
  padding: 12px 20px;

  :deep(.el-input__wrapper) {
    background: var(--unified-search-bg);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: var(--unified-search-shadow, none);
    padding: 6px 16px;
    height: 44px;

    &:hover {
      background: var(--color-black-3);
    }

    :where(html.dark) & {
      &:hover {
        background: var(--color-white-5);
      }
    }

    &.is-focus {
      border-color: var(--unified-search-focus-color);
      box-shadow: var(--unified-search-shadow, none);
    }
  }
}

.dialog-body-wrap > .search-results {
  margin: 0 20px 8px;
  max-height: 200px;
  overflow-y: auto;
  flex-shrink: 0;

  .search-result-item {
    padding: 8px;
    cursor: pointer;
    border-radius: var(--global-border-radius);

    .result-preview {
      font-size: 12px;
      color: var(--el-text-color-regular);
      margin-bottom: 4px;
    }

    .result-time {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }
}

// OpenClaw 功能面板 - 约束宽度防止内容撑破
.openclaw-panel-wrapper {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 0 0 var(--global-border-radius) var(--global-border-radius);

  :deep(.openclaw-container) {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

// OpenClaw 子面板（仪表板/设置）头部与内容
.openclaw-subpanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.openclaw-subpanel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
}

.openclaw-subpanel__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--global-border-radius);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
  }
  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }
}

.openclaw-subpanel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.openclaw-dashboard {
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: var(--global-border-radius);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }
}

.openclaw-dashboard__overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 28px;
  min-width: 0;
}

.openclaw-dashboard__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
  border: var(--unified-border);
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  overflow: hidden;
  &:hover {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
  }
}

.openclaw-dashboard__stat-value {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  letter-spacing: -0.02em;
}

.openclaw-dashboard__stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  text-align: center;
}

.openclaw-dashboard__section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 14px 0;
  letter-spacing: 0.02em;
}

.openclaw-dashboard__activity {
  list-style: none;
  padding: 0;
  margin: 0;
}

.openclaw-dashboard__activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: var(--unified-border-bottom);
  font-size: 12px;
  min-width: 0;
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  margin: 0 -4px;
  padding-left: 4px;
  padding-right: 4px;
  border-radius: var(--global-border-radius);
  &:hover {
    background: var(--el-fill-color-lighter);
  }
  &:last-child {
    border-bottom: none;
  }
}

.openclaw-dashboard__activity-desc {
  color: var(--el-text-color-regular);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.openclaw-dashboard__activity-time {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.openclaw-dashboard__empty {
  padding: 28px 20px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  letter-spacing: 0.01em;
  line-height: 1.5;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
}

.openclaw-settings {
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 20px;
  letter-spacing: 0.01em;
}

.openclaw-settings__desc {
  margin: 0 0 12px 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  overflow-wrap: break-word;
  word-break: break-word;
}

.openclaw-settings__placeholder {
  margin: 0;
  padding: 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  letter-spacing: 0.01em;
  overflow-wrap: break-word;
  word-break: break-word;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
  border: var(--unified-border);
}

.openclaw-settings__link-btn {
  margin-top: 16px;
  min-width: 140px;
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover {
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }
}

// OpenClaw 工具入口网格 - 彩色版，防止卡片内文字溢出
.openclaw-tools-grid--colorful {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 20px;
  height: 100%;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  align-content: start;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: var(--global-border-radius);
  }
}

// V2 彩色工具卡片
.tool-card-v2 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 12px;
  cursor: pointer;
  border-radius: var(--global-border-radius);
  background: transparent;
  border: var(--unified-border);
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--el-fill-color-lighter);
    border-color: var(--el-border-color-lighter);
    transform: scale(1.02);
  }

  &:active {
    background-color: var(--el-fill-color-light);
    transform: scale(0.98);
  }

  // 图标容器 - 彩色渐变
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: var(--global-border-radius);
    color: var(--el-bg-color-page);
    flex-shrink: 0;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
    min-width: 0;
    overflow: hidden;
    width: 100%;
  }

  &__name {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  &__desc {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  // 颜色变体
  &--purple {
    --tool-shadow-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);

    .tool-card-v2__icon {
      background: var(--tool-color-purple);
    }
  }

  &--amber {
    --tool-shadow-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);

    .tool-card-v2__icon {
      background: var(--tool-color-amber);
    }
  }

  &--blue {
    --tool-shadow-color: var(--color-blue-glow);

    .tool-card-v2__icon {
      background: var(--tool-color-blue);
    }
  }

  &--green {
    --tool-shadow-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);

    .tool-card-v2__icon {
      background: var(--tool-color-green);
    }
  }

  &--cyan {
    --tool-shadow-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);

    .tool-card-v2__icon {
      background: var(--tool-color-cyan);
    }
  }

  &--violet {
    --tool-shadow-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);

    .tool-card-v2__icon {
      background: var(--tool-color-violet);
    }
  }

  &--indigo {
    --tool-shadow-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);

    .tool-card-v2__icon {
      background: var(--tool-color-indigo);
    }
  }

  &--rose {
    --tool-shadow-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);

    .tool-card-v2__icon {
      background: var(--tool-color-rose);
    }
  }
}

// OpenClaw 按钮 - 继承统一按钮样式
.openclaw-btn {
  .openclaw-icon {
    width: 16px;
    height: 16px;
  }

  &.active {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-5);

    .openclaw-icon {
      transform: rotate(0deg);
    }
  }
}

// 消息容器 - 复用项目消息容器样式；禁止投影，避免在标题栏底部形成叠加粗线
/* .messages-container 样式：已迁移至 styles/ai-chat/_message-list.scss */

.empty-state {
  display: flex;
  align-items: flex-start; // 改为顶部对齐，减少顶部空白
  justify-content: center;
  min-height: auto; // 取消最小高度限制
  padding: 16px 24px; // 大幅减少顶部内边距
  width: 100%;
  box-sizing: border-box;
  // 启用容器查询，让子元素可以根据容器宽度响应
  container-type: inline-size;
  container-name: empty-state;
}

.welcome-section {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  animation: fadeInUp 0.6s ease-out;

  .welcome-text {
    margin-bottom: 16px; // 减少欢迎文字与快速开始的间距

    .welcome-title {
      font-size: 18px; // 稍微减小字号
      font-weight: 600;
      color: var(--el-text-color-primary);
      line-height: 1.4;
      margin: 0;
      letter-spacing: -0.02em;
    }
  }
}

// 快速问题建议样式 - 容器无样式，按钮响应式布局
.suggested-questions {
  // 容器不需要任何样式设定
  margin-top: 24px;
  width: 100%;

  .suggested-questions-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;

    .suggested-icon {
      font-size: 16px;
      color: var(--el-text-color-secondary);
      animation: sparkle 2s ease-in-out infinite;
    }

    .suggested-questions-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--el-text-color-secondary);
      letter-spacing: 0.01em;
    }
  }

  .suggested-questions-list {
    display: grid;
    gap: 10px;
    width: 100%;
    // 默认一列（最窄情况）
    grid-template-columns: 1fr;

    .question-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 500;
      border-radius: var(--global-border-radius);
      background: var(--fcd-btn-bg);
      border: var(--unified-border);
      color: var(--fcd-btn-color);
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      white-space: nowrap;
      cursor: pointer;
      position: relative;
      overflow: hidden;

      .question-icon {
        font-size: 15px;
        color: inherit;
        transition: color 0.2s ease;
        flex-shrink: 0;
      }

      .question-text {
        transition: color 0.2s ease;
      }

      &:hover {
        background: var(--fcd-btn-hover-bg);
        border-color: var(--fcd-btn-hover-border);
        color: var(--fcd-btn-hover-color);

        .question-icon {
          color: inherit;
        }
      }

      &:active {
        background: var(--fcd-btn-active-bg);
        border-color: var(--fcd-btn-active-border);
        color: var(--fcd-btn-active-color);
      }
    }
  }
}

// 快捷工具栏样式（输入框上方，支持拖拽滚动）
.quick-tools-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  overflow-x: auto;
  scrollbar-width: none; // Firefox
  -ms-overflow-style: none; // IE/Edge
  cursor: grab; // 拖拽光标
  -webkit-overflow-scrolling: touch; // iOS 平滑滚动

  &::-webkit-scrollbar {
    display: none; // Chrome/Safari
  }

  &:active {
    cursor: grabbing;
  }

  .quick-tool-item {
    flex-shrink: 0;
    padding: 0 10px;
    height: 22px;
    min-height: 22px;
    max-height: 22px;
    font-size: 12px;
    font-weight: 400;
    border-radius: var(--global-border-radius-sm); // 2026-07-03 由 8px 缩为 4px（用小圆角档），降低 pill 感，与全局 8px 形成层级
    line-height: 20px;
    background: var(--fcd-btn-bg);
    border: var(--unified-border);
    color: var(--fcd-btn-color);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;

    &:hover {
      background: var(--fcd-btn-hover-bg);
      border-color: var(--fcd-btn-hover-border);
      color: var(--fcd-btn-hover-color);
    }

    &:active {
      background: var(--fcd-btn-active-bg);
      border-color: var(--fcd-btn-active-border);
      color: var(--fcd-btn-active-color);
      transform: scale(0.98);
    }
  }
}

// 容器查询：根据 empty-state 容器宽度响应式显示按钮列数
// 使用单类 / :where()，禁止高特异性
@container empty-state (min-width: 360px) {
  .suggested-questions .suggested-questions-list {
    grid-template-columns: var(--fcd-grid-cols-2);
  }
}

@container empty-state (min-width: 520px) {
  .suggested-questions .suggested-questions-list {
    grid-template-columns: var(--fcd-grid-cols-3);
  }
}

// 动画
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes sparkle {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

/* .messages-list / .date-separator / .message-item 样式：已迁移至 styles/ai-chat/_message-list.scss */

/* .user-message / .assistant-message 样式：已迁移至 styles/ai-chat/_message-list.scss */

/* .assistant-message 样式：已迁移至 styles/ai-chat/_message-list.scss */

/* .input-area / .input-wrapper / .chat-input 样式：已迁移至 styles/ai-chat/_input-area.scss */

/* .voice-waveform-container / .voice-waveform / @keyframes waveform-bounce / .voice-recording-info / @keyframes recording-pulse 样式：已迁移至 styles/ai-chat/_input-area.scss */

/* .chat-input-container / .has-voice-mini / .has-voice-card 样式：已迁移至 styles/ai-chat/_input-area.scss */

/* .input-actions / .send-btn 样式：已迁移至 styles/ai-chat/_input-area.scss */

// 按钮图标居中样式已在统一按钮系统中定义


// AI 能力选择器下拉菜单 - 单类 / :where()，禁止高特异性
.ai-capability-selector {
  position: relative;
  z-index: calc(var(--z-base) + 9); // 提高 z-index，确保按钮可以点击

  // 确保按钮可以接收点击事件
  .el-button {
    position: relative;
    z-index: var(--z-base);
    pointer-events: auto;
  }

  :deep(.el-dropdown__popper) {
    z-index: var(--z-max); // 确保下拉菜单在所有元素上方（高于弹窗的 10001）
    margin-top: 8px;

    // 确保下拉菜单可以显示
    &[data-popper-placement^="top"] {
      margin-bottom: 8px;
      margin-top: 0;
    }
  }
}

// 引用消息预览
.quoted-preview {
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-left: var(--el-border-width-primary) solid var(--el-color-primary);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;

  .quoted-preview-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--el-color-primary);

    // 取消回复按钮（按钮基础样式已在统一按钮系统中定义）
    .cancel-reply-btn {
      margin-left: auto;
      color: var(--el-text-color-placeholder);

      &:hover {
        color: var(--el-color-danger);
      }
    }
  }

  .quoted-preview-content {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

// 消息中的引用显示
.quoted-message {
  margin-bottom: 8px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-left: 3px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
    border-left-color: var(--el-color-primary);
  }

  .quoted-message-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);

    .el-icon {
      font-size: 12px;
    }

    .quoted-message-role {
      font-weight: 500;
    }
  }

  .quoted-message-content {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    transition: color 0.2s;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.message-main-content {
  word-wrap: break-word;
}


// 调整大小手柄 - 扁平化设计
// 边缘拖拽区域 - 四个边
.resize-edge {
  position: absolute;
  z-index: var(--z-dropdown); // 提高 z-index，确保存最上层
  background: transparent;
  pointer-events: auto; // 确保可以接收鼠标事件
  user-select: none; // 防止文本选择
  font-size: 0; // 防止显示任何文本
  overflow: hidden; // 隐藏任何溢出内容
  color: transparent; // 确保文本透明

  &.resize-edge-top {
    top: 0;
    left: 0;
    right: 0;
    height: 3px; // 更细的线条
    cursor: ns-resize; // 上下调整
  }

  &.resize-edge-bottom {
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px; // 更细的线条
    cursor: ns-resize; // 上下调整
  }

  &.resize-edge-left {
    top: 0;
    left: 0;
    bottom: 0;
    width: 3px; // 更细的线条
    cursor: ew-resize; // 左右调整
  }

  &.resize-edge-right {
    top: 0;
    right: 0;
    bottom: 0;
    width: 3px; // 更细的线条
    cursor: ew-resize; // 左右调整
  }

  &:hover {
    background: var(--el-color-primary-light-9); // 主题色浅色背景
  }

  &:active {
    background: var(--el-color-primary-light-8); // 点击时更明显的背景
  }
}

// 边缘拖拽区域 - 四个角
.resize-corner {
  position: absolute;
  z-index: var(--z-dropdown); // 提高 z-index，确保存边上之上
  width: 8px; // 更小巧的尺寸
  height: 8px; // 更小巧的尺寸
  background: transparent;
  pointer-events: auto; // 确保可以接收鼠标事件
  user-select: none; // 防止文本选择

  &.resize-corner-top-left {
    top: 0;
    left: 0;
    cursor: nwse-resize; // 左上-右下调整
  }

  &.resize-corner-top-right {
    top: 0;
    right: 0;
    cursor: nesw-resize; // 右上-左下调整
  }

  &.resize-corner-bottom-left {
    bottom: 0;
    left: 0;
    cursor: nesw-resize; // 左下-右上调整
  }

  &.resize-corner-bottom-right {
    bottom: 0;
    right: 0;
    cursor: nwse-resize; // 右下-左上调整
  }

  &:hover {
    background: var(--el-color-primary-light-8); // 主题色浅色背景
  }

  &:active {
    background: var(--el-color-primary-light-7); // 点击时更明显的背景
  }
}

// 动画
@keyframes messageFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes messageHighlight {

  0%,
  100% {
    background: transparent;
  }

  50% {
    background: var(--el-color-primary-light-9);
  }
}

// @keyframes typing 已迁移至 chatheaderbar.vue style scoped (2026-07-03)

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

// 麦克风录音动画 - 更明显的视觉反馈
@keyframes recording-pulse {
  0% {
    transform: scale(1);
    box-shadow: var(--global-box-shadow);
  }

  50% {
    transform: scale(1.1);
    box-shadow: var(--global-box-shadow);
  }

  100% {
    transform: scale(1);
    box-shadow: var(--global-box-shadow);
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dialog-slide-enter-active,
.dialog-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dialog-slide-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.dialog-slide-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.message-fade-enter-active,
.message-fade-leave-active {
  transition: all 0.3s ease;
}

.message-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.message-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

// 统计对话框样式
.stats-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 0;

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color);
    }

    .stat-label {
      font-size: 14px;
      color: var(--el-text-color-regular);
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--el-color-primary);
      text-align: right;

      &.stat-time-range {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        font-weight: 400;
        color: var(--el-text-color-regular);
        text-align: left;
      }
    }
  }
}

// 浮窗主体区：包含左侧滑出会话列表与主内容
.dialog-body-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: none;
}

// 浮窗左侧滑出的会话列表面板（扁平化：四边描边，内缩 1px 避免被容器裁切）
/* .session-list-panel / .session-list-header / .session-list-title / .session-list-close / .session-list-content / .session-list-slide / .history-content 样式：已迁移至 styles/ai-chat/_session-list.scss */

// 文件预览样式增强
.message-files {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .file-item {
    position: relative;

    .file-image {
      max-width: 200px;
      max-height: 200px;
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: transform 0.2s;

      &:hover {
        transform: scale(1.02);
      }
    }

    .file-audio,
    .file-video {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);

      .audio-element,
      .video-element {
        width: 100%;
        max-width: 300px;
        border-radius: var(--global-border-radius);
      }

      .file-name {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: var(--el-fill-color);
      }

      .file-name {
        flex: 1;
        font-size: 12px;
        color: var(--el-text-color-regular);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      // 文件下载按钮（按钮基础样式已在统一按钮系统中定义）
      .file-download-btn {
        flex-shrink: 0;
      }
    }
  }
}

// 消息编辑样式增强
.message-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    // 按钮样式已在统一按钮系统中定义
  }
}

// 快捷操作动画
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

// 暗色模式适配 - 使用 :where(html.dark) 降低特异性
:where(html.dark) {
  .floating-chat-trigger {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    border-color: var(--el-border-color-darker); // 暗色模式低对比色描边

    &:hover {
      background: var(--el-fill-color-light);
      border-color: var(--el-border-color);
    }
  }

  .floating-chat-dialog {
    background: var(--el-bg-color-page);
    border-color: var(--el-border-color);
    box-shadow: var(--fcd-box-shadow);

    &:hover {
      border-color: var(--el-border-color-lighter);
      box-shadow: var(--global-box-shadow);
    }
  }

  .dialog-header {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    color: var(--el-text-color-primary);
  }

  // 用户消息在暗色模式下使用消息气泡全局背景（深蓝色）+ 浅色文字
  .user-message .message-content {
    background: var(--fcd-message-bubble-bg);
    color: var(--el-text-color-primary);

    &,
    & *:not(.el-icon):not(.el-button):not(button) {
      color: var(--el-text-color-primary);
    }

    .message-text-plain {
      color: var(--el-text-color-primary);
    }

    .message-time {
      color: var(--el-text-color-secondary);
    }

    .message-status {
      color: var(--el-text-color-secondary);

      .status-icon {
        color: inherit;
      }
    }
  }

  .assistant-message .message-content {
    background: var(--fcd-message-bubble-bg);
    // 助手消息在暗色模式下使用浅色文字（由 Element Plus 变量自动处理）

    // Markdown 图片宽度自适应消息气泡，避免超出 message-content / markdown 容器
    .markdown-renderer img {
      width: 100%;
      max-width: 100%;
      height: auto;
      display: block;
    }
  }

  .messages-container {
    background: var(--el-bg-color-page); // 暗色模式：使用暗色背景
  }

  .input-area {
    background: var(--el-bg-color); // 暗色模式：使用暗色背景
  }

  // 暗色模式按钮样式（通过统一按钮系统的 CSS 变量自动处理）


  .stats-content .stat-item {
    background: var(--el-fill-color-light);
  }

  .history-item {
    background: var(--el-bg-color); // 暗色模式：使用暗色背景
    border-color: var(--el-border-color);

    &.is-active {
      background: var(--el-color-primary-light-9);
    }
  }

  // Token 使用统计样式
  .token-usage {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-left: 8px;

    .token-info {
      font-weight: 500;
    }
  }

  // 响应元数据样式
  .response-metadata {
    margin-top: 8px;
    border-top: var(--unified-border);
    padding-top: 8px;

    .metadata-content {
      .metadata-section {
        margin-bottom: 16px;

        &:last-child {
          margin-bottom: 0;
        }

        h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .usage-details {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .usage-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            background: var(--el-fill-color-light);
            border-radius: var(--global-border-radius);

            .usage-label {
              font-size: 12px;
              color: var(--el-text-color-secondary);
            }

            .usage-value {
              font-size: 12px;
              font-weight: 600;
              color: var(--el-text-color-primary);
            }
          }
        }

        .processing-time {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          padding: 4px 8px;
          background: var(--el-fill-color-light);
          border-radius: var(--global-border-radius-sm, 4px);
        }

        .metadata-json {
          font-size: 12px;
          line-height: 1.5;
          padding: 12px;
          background: var(--el-fill-color-light);
          border-radius: var(--global-border-radius);
          overflow-x: auto;
          margin: 0;
          color: var(--el-text-color-primary);
          max-height: 300px;
          overflow-y: auto;
        }
      }
    }
  }

  // 暗色模式下的欢迎区域优化
  .welcome-section {
    .welcome-text {
      .welcome-title {
        color: var(--el-text-color-primary);
      }
    }
  }

  // 暗色模式下快速问题/快捷工具栏使用 .floating-chat-dialog-wrapper 的 --fcd-btn-* 变量，无需重复定义
  .suggested-questions .suggested-questions-header {
    .suggested-icon {
      color: var(--el-text-color-secondary);
    }

    .suggested-questions-title {
      color: var(--el-text-color-secondary);
    }
  }
}

/* 悬浮弹窗卡片样式已移动到全局样式块（用于 Teleport 组件） */

// OpenClaw 快捷菜单样式
.openclaw-quick-menu {
  .menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: var(--unified-border-bottom);
    margin-bottom: 12px;

    .menu-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 6px;

      &::before {
        content: '';
        width: 4px;
        height: 16px;
        background: var(--el-color-primary);
        border-radius: var(--global-border-radius);
      }
    }
  }

  .menu-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    min-width: 0;
  }

  .menu-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px 8px;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    min-width: 0;
    overflow: hidden;

    &:hover {
      background: var(--el-fill-color-light);

      .item-icon {
        box-shadow: var(--global-box-shadow);
      }

      .item-desc {
        opacity: 1;
      }
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 2px;
    }

    &.active {
      background: var(--el-color-primary-light-9);

      .item-icon {
        transform: scale(1.05);
        box-shadow: var(--global-box-shadow);
      }

      .item-label {
        color: var(--el-color-primary);
        font-weight: 500;
      }
    }

    .item-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: var(--global-box-shadow);

      svg {
        width: 20px;
        height: 20px;
        color: var(--el-color-white);
      }

      // 仪表板 - 主色（总览入口）
      &.dashboard {
        background: var(--el-color-primary);
      }

      // 记忆系统 - 紫色（代表知识和智慧）
      &.memory {
        background: var(--tool-color-purple);
      }

      // 语音助手 - 粉色（代表对话和交流）
      &.voice {
        background: var(--tool-color-pink);
      }

      // 画布 - 蓝色（代表创意和设计）
      &.canvas {
        background: var(--tool-color-blue);
      }

      // 技能 - 黄色（代表能量和能力）
      &.skills {
        background: var(--tool-color-amber);
      }

      // 浏览器 - 青色（代表网络和世界）
      &.browser {
        background: var(--tool-color-cyan);
      }

      // 自动化 - 绿色（代表循环和效率）
      &.automation {
        background: var(--tool-color-success);
      }

      // 模型 - 靛蓝（代表AI和智能）
      &.models {
        background: var(--tool-color-indigo);
      }

      // 集成 - 橙色（代表连接和融合）
      &.integrations {
        background: var(--tool-color-orange);
      }

      // 设置 - 灰/银（代表系统与配置）
      &.settings {
        background: var(--el-text-color-regular);
      }
    }

    .item-label {
      font-size: 12px;
      color: var(--el-text-color-primary);
      text-align: center;
      line-height: 1.25;
      font-weight: 500;
      letter-spacing: 0.02em;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .item-desc {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      text-align: center;
      line-height: 1.2;
      letter-spacing: 0.01em;
      opacity: 0.85;
      transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    // 工具区图标颜色 - 与主能力卡片一致，统一用 --el-text-color-primary
    .item-icon.prompt {
      background: var(--el-text-color-primary);
    }

    .item-icon.toolbox {
      background: var(--el-text-color-primary);
    }
  }

  // 工具区：与主能力卡片保持一致（同一套 .menu-item 样式）
  .menu-grid-tools {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    min-width: 0;
  }

  .menu-section-divider {
    height: 1px;
    background: var(--border-unified-color);
    margin: 6px 4px;
  }

  .menu-section-header {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    padding: 2px 8px 4px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .menu-footer {
    display: flex;
    justify-content: center;
    gap: 20px;
    padding-top: 12px;
    margin-top: 12px;
    border-top: var(--unified-border);

    .el-button {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      display: flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: var(--global-border-radius);
      transition: all 0.2s;

      svg {
        flex-shrink: 0;
      }

      &:hover {
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }
    }
  }
}

// 语音小卡片 - 极简样式，与输入框同一行、不换行，右侧与输入框留隙
.voice-mini-card {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin-right: 4px; // 与输入框留隙（与容器 gap 一致）
  padding: 6px 12px;
  background: var(--tool-color-voice);
  border-radius: var(--global-border-radius);
  height: 40px;

  :where(html.dark) & {
    background: var(--tool-color-voice-dark);
  }
}

// 按钮样式 - 使用单类，禁止高特异性
button.mini-play-btn,
button.mini-delete-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--color-white-30);
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  line-height: 1;
  font-size: 14px;

  .el-icon {
    font-size: 14px;
  }
}

button.mini-delete-btn {
  background: transparent;
}

.mini-waveform {
  display: flex;
  align-items: center;
  gap: 1px;
  height: 12px;
}

.mini-wave-bar {
  width: 2px;
  height: 60%;
  background: var(--ai-green-bg);
  border-radius: var(--global-border-radius);

  &.is-playing {
    animation: mini-wave-bounce 0.5s ease-in-out infinite;
  }
}

.mini-duration {
  font-size: 12px;
  color: var(--el-color-success);
}

@keyframes mini-wave-bounce {

  0%,
  100% {
    transform: scaleY(0.6);
  }

  50% {
    transform: scaleY(1.2);
  }
}
</style>

<!-- 非 scoped 样式：仅保留必要的全局样式 -->
<style lang="scss">
// SCSS 模块化迁移：API 接入对话框 + 客服页主题
@use '@/styles/ai-chat/api-access' as *;
@use '@/styles/ai-chat/customer-service-theme' as *;

/* 按钮样式已在 scoped 样式的统一按钮系统中定义 */
/* 这里只保留必须的全局覆盖 */

/* 输入区域圆角 - 使用 :where(:root, body)，禁止高特异性 */
:where(:root, body) :where(.floating-chat-dialog-wrapper) :where(.floating-chat-dialog) :where(div.input-area) {
  border-bottom-left-radius: var(--global-border-radius);
  border-bottom-right-radius: var(--global-border-radius);
}

/* 输入包装器圆角 */
:where(:root, body) :where(.floating-chat-dialog-wrapper) :where(.floating-chat-dialog) div.input-area div.input-wrapper {
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

/* 聊天输入框圆角和左内边距 */
:where(:root, body) :where(.floating-chat-dialog-wrapper) :where(.floating-chat-dialog) div.input-area div.input-wrapper div.chat-input {
  border-radius: var(--global-border-radius);
  padding-left: 12px;

  &:focus,
  &:hover,
  &:active,
  &:focus-visible,
  &:focus-within {
    border-radius: var(--global-border-radius);
  }
}

/* AI 对话框专属弹窗样式 (全局样式块 - 遵循 ITCSS + 设计语言) */
/* 亮色模式用浅色背景，暗色模式用主色半透明；仅一层描边，避免与 ::before 重复 */
.el-popper.ai-chat-popper {
  --ai-popper-blur: 24px;
  --ai-popper-border: var(--el-border-color-lighter);
  --ai-popper-shadow: none;
  --ai-item-hover-bg: var(--color-black-5);
  --ai-item-gap: 12px;
  --ai-motion: cubic-bezier(0.4, 0, 0.2, 1);
  /* 亮色模式：与 is-light 一致，使用浅色 overlay，避免主色在亮色下为黑导致黑底 */
  --ai-popper-bg: var(--el-bg-color);

  max-width: min(380px, 90vw);
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;

  background: var(--ai-popper-bg);
  backdrop-filter: blur(var(--ai-popper-blur)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--ai-popper-blur)) saturate(160%);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--ai-popper-shadow);
  padding: 10px;
  margin-top: 8px;
  transition: opacity 0.2s var(--ai-motion), transform 0.2s var(--ai-motion);

  .el-popper__arrow {
    display: none;
  }

  .el-dropdown-menu {
    background: transparent;
    border: none;
    padding: 0;
    position: relative;
    z-index: calc(var(--z-base) + 1);
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .el-dropdown-menu__item {
    margin: 2px 0;
    padding: 10px 14px;
    border-radius: var(--global-border-radius);
    color: var(--color-gray-111);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: background 0.15s var(--ai-motion), color 0.15s var(--ai-motion);
    display: flex;
    align-items: center;
    gap: var(--ai-item-gap);
    background: transparent;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    max-width: 100%;

    .el-icon {
      font-size: 16px;
      color: var(--el-text-color-secondary);
      transition: color 0.15s var(--ai-motion);
      margin: 0;
      flex-shrink: 0;
    }

    > span {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &:hover:not(.is-disabled) {
      background: var(--ai-item-hover-bg);
      color: var(--color-gray-111);

      .el-icon {
        color: var(--color-gray-666);
      }
    }

    &.is-disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.divided {
      margin-top: 8px;
      margin-bottom: 4px;
      border-top: var(--unified-border);

      &::before {
        display: none;
      }
    }
  }

  :where(html.dark) & {
    --ai-popper-bg: color-mix(in srgb, var(--el-color-primary) 92%, transparent);
    --ai-popper-border: var(--color-gray-1f1f1f);
    --ai-popper-shadow: none;
    --ai-item-hover-bg: var(--color-white-6);

    .el-dropdown-menu__item {
      color: var(--color-gray-ededed);

      &:hover:not(.is-disabled) {
        color: var(--color-gray-ededed);

        .el-icon {
          color: var(--color-gray-a1a1a1);
        }
      }
    }
  }

  // 提示词模板库下拉：链同宽无背景色，用单类 / :where()，禁止
  &:has(.prompt-templates-container) {
    padding-left: 0;
    padding-right: 0;

    .el-scrollbar,
    .el-scrollbar__wrap,
    .el-scrollbar__view,
    .el-dropdown__list,
    .el-dropdown-menu,
    ul.el-dropdown-menu,
    .el-dropdown-menu > li {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
      background: transparent;
    }
    .el-scrollbar__wrap {
      overflow-x: hidden;
    }
    .el-scrollbar__view,
    .el-dropdown__list {
      padding-left: 0;
      padding-right: 0;
    }
    .el-dropdown-menu > li {
      padding-left: 0;
      padding-right: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
    .prompt-templates-container,
    .prompt-templates-container .templates-header,
    .prompt-templates-container .templates-list {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .prompt-templates-container .templates-list {
      background: transparent;
    }
    .prompt-templates-container .card-header,
    .prompt-templates-container .card-header .card-title,
    .prompt-templates-container .card-body {
      background: transparent;
      border: none;
      border-radius: 0;
    }
  }
}

/* 提示词模板库 popper 专用：左右无内边距、整条链无左偏，内容与 popper 左对齐 */
:where(body) .el-popper.ai-chat-popper.ai-chat-prompt-templates-popper {
  padding: 8px 0;
  overflow-x: hidden;

  .el-scrollbar,
  .el-scrollbar__wrap,
  .el-scrollbar__view,
  .el-dropdown__list,
  .el-dropdown-menu,
  .el-dropdown-menu > li {
    margin-left: 0;
    margin-right: 0;
    padding-left: 0;
    padding-right: 0;
    box-sizing: border-box;
  }
  .el-scrollbar {
    width: 100%;
    min-width: 0;
  }
  .el-scrollbar__wrap,
  .el-scrollbar__view,
  .el-dropdown__list {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .el-scrollbar__view > * {
    padding-left: 0;
    padding-right: 0;
    box-sizing: border-box;
  }
  .el-scrollbar__wrap {
    overflow-x: hidden;
  }
  .prompt-templates-container {
    box-sizing: border-box;
    margin-left: 0;
    margin-right: 0;
    width: 100%;
    min-width: 0;
  }
  .prompt-templates-container .templates-header,
  .prompt-templates-container .templates-list {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
}

/* ========== API 接入对话框样式：已迁移至 styles/ai-chat/_api-access.scss ========== */

// OpenClaw Popover 全局样式 - 1px 描边、12px 圆角，内容不溢出
:where(:root, body) .el-popper.openclaw-popover {
  padding: 18px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  background: var(--el-bg-color);
  min-width: 0;
  overflow: hidden;
  .openclaw-quick-menu {
    min-width: 0;
    overflow: hidden;
  }
  .openclaw-quick-menu .menu-grid {
    gap: 8px;
  }
  .openclaw-quick-menu .menu-item {
    padding: 12px 8px 10px;
    border-radius: var(--global-border-radius);
    transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    &:hover {
      background: var(--el-fill-color-light);
      transform: scale(1.02);
    }
    &.active {
      background: var(--el-fill-color-light);
    }
  }
}

/* ========== AI 能力选择器 - 与 OpenClaw 智能工具箱样式统一 ========== */
:where(body) .el-popper.ai-chat-popper.ai-capability-popper {
  padding: 16px;
  margin-top: 10px;
  max-width: 340px;
  min-width: 300px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  overflow: hidden;
  transition: opacity 0.2s ease, transform 0.2s ease;

  &::before {
    display: none;
  }

  .el-popper__arrow {
    display: none;
  }

  .el-dropdown-menu {
    padding: 0;
    border: none;
    background: transparent;
  }

  :where(html.dark) & {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    box-shadow: var(--global-box-shadow);
  }
}

/* AI 能力下拉复用 .openclaw-quick-menu 网格卡片样式，仅补丁图标为白色 */
:where(body) :where(.el-popper.ai-chat-popper.ai-capability-popper) .openclaw-quick-menu {
  .item-icon .el-icon,
  .item-icon .ai-star-icon {
    color: var(--el-color-white);
  }

  .item-icon .ai-star-icon svg path {
    fill: var(--el-color-white);
  }

  .item-icon .el-icon svg {
    color: var(--el-color-white);
  }
}

// ========================================
// AI能力选择面板样式 (Teleport 组件全局样式)
// ========================================

// 遮罩层样式
.service-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--color-black-50);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-max);
  animation: fadeIn 0.3s ease;
  pointer-events: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

// 弹窗卡片样式 - 在 Teleport 中需要手动设置 CSS 变量
.ai-capability-popup {
  // 在 Teleport 元素中手动定义 Element Plus CSS 变量（亮色模式）
  // 使用全局 CSS 变量，保持一致性
  --el-bg-color: var(--el-bg-color-page);
  --el-bg-color-page: var(--el-fill-color-light);
  --el-text-color-primary: var(--el-text-color-primary);
  --el-text-color-regular: var(--el-text-color-regular);
  --el-text-color-secondary: var(--el-text-color-secondary);
  --el-border-color: var(--border-unified-color);
  --el-border-color-light: var(--border-unified-color);
  --el-border-color-lighter: var(--border-unified-color);
  --el-fill-color: var(--el-fill-color);
  --el-fill-color-light: var(--el-fill-color-light);
  --el-fill-color-lighter: var(--el-fill-color-lighter);
  --el-color-primary: var(--el-color-primary);
  --el-color-primary-light-9: var(--color-primary-light-9);

  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 0;
  max-width: 480px;
  width: auto;
  max-height: 70vh;
  overflow: hidden;
  animation: slideUp 0.3s ease;
  border: var(--unified-border);
  display: flex;
  flex-direction: column;
  box-shadow: var(--global-box-shadow);
  position: relative;
  z-index: var(--z-max);
  pointer-events: auto;
  color: var(--el-text-color-primary);
}

// 暗色模式下覆盖 CSS 变量
:where(html.dark) .ai-capability-popup {
  --el-bg-color: var(--color-dark-bg-2);
  --el-bg-color-page: var(--color-dark-bg-1);
  --el-text-color-primary: var(--color-gray-303133);
  --el-text-color-regular: var(--color-gray-cfd3dc);
  --el-text-color-secondary: var(--color-gray-a3a6ad);
  --el-border-color: var(--border-unified-color);
  --el-border-color-light: var(--border-unified-color);
  --el-border-color-lighter: var(--border-unified-color);
  --el-fill-color: var(--color-dark-bg-7);
  --el-fill-color-light: var(--color-dark-bg-5);
  --el-fill-color-lighter: var(--color-dark-bg-4);
  --el-color-primary: var(--color-primary);
  --el-color-primary-light-9: var(--color-gray-18222c);
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

// 弹窗头部样式
.ai-capability-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);

  .ai-capability-popup-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .ai-capability-popup-close {
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-text-color-primary);
    }
  }
}

// 弹窗内容区样式
.ai-capability-popup-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;

  .capability-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }

  .capability-item {
    padding: 12px 16px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    background: var(--el-fill-color-light);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: var(--el-fill-color);
      border-color: var(--el-border-color-lighter);
    }

    &.is-selected {
      background: var(--el-color-primary-light-9);
      border: var(--el-border-width-primary) solid var(--el-color-primary);
    }

    .capability-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;

      .capability-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--el-text-color-primary);
      }

      .capability-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .api-access-btn {
          padding: 2px 6px;
          color: var(--el-color-primary);
          opacity: 0;
          transition: opacity 0.2s ease;

          &:hover {
            background: var(--el-color-primary-light-9);
          }
        }
      }
    }

    &:hover .capability-actions .api-access-btn {
      opacity: 1;
    }

    .capability-desc {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .empty-capabilities {
    padding: 30px 20px;
    text-align: center;
  }

  .generation-type-selector {
    margin-bottom: 16px;

    .el-radio-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  }

  .provider-selector {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);

    .provider-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--el-text-color-secondary);
      margin-bottom: 8px;
    }

    .el-radio-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .el-radio-button {
      .el-radio-button__inner {
        padding: 6px 12px;
        font-size: 12px;
      }
    }
  }

  .generation-info {
    margin-bottom: 12px;
  }

  .generation-task-info {
    margin-top: 12px;
  }

  // 模型分类标签样式
  .model-category-tabs {
    width: 100%;
    margin-top: 0;
    margin-bottom: 12px;
    padding: 0;
    box-sizing: border-box;
    flex-shrink: 0;

    .el-tabs__header {
      margin: 0;
      padding: 0;
      border-bottom: none;

      &::after {
        display: none;
      }
    }

    .el-tabs__nav-wrap {
      padding: 0;
      overflow: visible;

      &::after {
        display: none;
        content: none;
        width: 0;
        height: 0;
        border: none;
      }
    }

    .el-tabs__nav-scroll {
      overflow: visible;
    }

    .el-tabs__nav {
      display: flex;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
      flex-wrap: wrap;
      padding: 0;
    }

    .el-tabs__item {
      padding: 6px 12px;
      font-size: 12px;
      color: var(--el-text-color-regular);
      background: var(--el-fill-color-light);
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      margin-right: 0;
      transition: all 0.2s ease;
      cursor: pointer;
      height: 28px;
      line-height: 16px;
      box-sizing: border-box;
      flex-shrink: 0;
      font-weight: 400;

      &:hover {
        background: var(--el-fill-color);
        color: var(--el-text-color-primary);
      }

      &.is-active {
        background: var(--el-bg-color-page);
        color: var(--el-text-color-primary);
        font-weight: 500;
        border: var(--el-border-width-primary) solid var(--el-color-primary);
      }
    }

    .el-tabs__active-bar {
      display: none;
    }
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* AI 对话框工具栏按钮 Tooltip 样式 - 使用 CSS 变量 */
// 亮色模式 - 使用高优先级选择器覆盖 is-dark 默认样式
.el-popper.ai-chat-action-tooltip.el-popper,
.el-popper.is-dark.ai-chat-action-tooltip,
.el-popper.is-light.ai-chat-action-tooltip {
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  max-width: 120px;
  min-width: auto;
  width: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .el-popper__arrow::before {
    background: var(--el-bg-color-page);
    border-color: var(--border-unified-color);
  }
}

/* 工具栏按钮自定义 Tooltip 样式 - 使用 data-tooltip 属性 */
.action-btn.has-custom-tooltip {
  position: relative;
}

.action-btn.has-custom-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  max-width: 120px;
  min-width: auto;
  width: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  z-index: var(--z-loading);
}

.action-btn.has-custom-tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-3px);
  border: 6px solid transparent;
  border-top-color: var(--border-unified-color);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  z-index: var(--z-loading);
}

.action-btn.has-custom-tooltip:hover::after,
.action-btn.has-custom-tooltip:hover::before {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(-4px);
}

/* 暗色模式适配 */
:where(html.dark) .action-btn.has-custom-tooltip::after {
  background: var(--el-text-color-primary);
  color: var(--el-bg-color-page);
}

:where(html.dark) .action-btn.has-custom-tooltip::before {
  border-top-color: var(--border-unified-color);
}


// 暗色模式 - 使用高优先级选择器
:where(html.dark) .el-popper.ai-chat-action-tooltip.el-popper,
:where(html.dark) .el-popper.is-dark.ai-chat-action-tooltip,
:where(html.dark) .el-popper.is-light.ai-chat-action-tooltip {
  background: var(--el-text-color-primary);
  border: var(--unified-border);
  color: var(--el-bg-color-page);

  .el-popper__arrow::before {
    background: var(--el-text-color-primary);
    border-color: var(--border-unified-color);
  }
}

/* ========== 客服页主题 (theme-custom-service)：已迁移至 styles/ai-chat/_customer-service-theme.scss ========== */
</style>

<style lang="scss" rel="stylesheet/scss">
/* 删除确认框显示在浮窗之上，避免被遮挡 */
// 使用 :where(body) 降特异性，禁止 与高特异性
:where(body) .el-overlay:has(.ai-chat-delete-confirm) {
  z-index: var(--z-max);
}

/* API 接入对话框显示在「选择AI能力」面板之上，避免从能力面板内点击 API 接入时弹窗被遮罩盖住 */
:where(body) .el-overlay:has(.api-access-dialog) {
  z-index: var(--z-max);
}

/* API 接入弹窗内协议 tabs：左对齐导航（选择器已足够具体） */
:where(body) .api-access-dialog .protocol-tabs.el-tabs {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
:where(body) :where(.api-access-dialog) .protocol-tabs .el-tabs__header {
  justify-content: flex-start;
  width: 100%;
  max-width: 100%;
  margin: 0;
}
:where(body) :where(.api-access-dialog) .protocol-tabs .el-tabs__content {
  width: 100%;
}
:where(body) :where(.api-access-dialog) .protocol-tabs .el-tabs__nav-wrap {
  display: flex;
  justify-content: flex-start;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
:where(body) :where(.api-access-dialog) .protocol-tabs .el-tabs__nav-scroll {
  display: flex;
  justify-content: flex-start;
  min-width: 0;
}
:where(body) :where(.api-access-dialog) .protocol-tabs .el-tabs__nav {
  float: none;
  display: inline-flex;
  margin: 0;
  flex-shrink: 0;
}
:where(body) :where(.api-access-dialog) .protocol-tabs .el-tabs__item {
  justify-content: center;
}
</style>
