<template>
  <Teleport to="body">
    <!-- 悬浮触发按钮 -->
    <Transition name="fade">
      <button
        v-if="!isVisible && showToggle"
        class="drama-script-excel-trigger"
        @click="openDialog"
        :title="t('dramaScript.openExcel')"
        :aria-label="t('dramaScript.openExcel')"
      >
        <el-icon class="trigger-icon"><Document /></el-icon>
      </button>
    </Transition>

    <!-- 悬浮Excel对话框 -->
    <Transition name="dialog-slide">
      <div v-if="isVisible" class="drama-script-excel-wrapper" :class="{ 'is-minimized': isMinimized }">
        <div
          ref="dialogRef"
          class="drama-script-excel-dialog"
          :class="{
            'is-dragging': isDragging,
            'is-resizing': isResizing,
            'is-dark': isDarkMode,
          }"
          :style="dialogStyle"
        >
          <!-- 标题栏（可拖拽） -->
          <div
            ref="headerRef"
            class="dialog-header"
            @mousedown="startDrag"
            @dblclick="toggleMinimize"
          >
            <div class="header-left">
              <el-icon class="header-icon"><Document /></el-icon>
              <span class="header-title">{{ t('dramaScript.title') }}</span>
              <el-tag size="small" type="info" style="margin-left: 8px;">
                {{ fragments.length }} {{ t('dramaScript.fragments') }}
              </el-tag>
              <el-tag 
                v-if="isSaving" 
                size="small" 
                type="info" 
                style="margin-left: 8px;"
              >
                <el-icon class="is-loading"><Refresh /></el-icon>
                {{ t('dramaScript.autoSaving') }}
              </el-tag>
              <el-tag 
                v-if="!isSaving && lastSavedTime" 
                size="small" 
                type="success" 
                style="margin-left: 8px;"
              >
                {{ t('dramaScript.lastSaved', { time: formatTime(lastSavedTime, 'HH:mm:ss') }) }}
              </el-tag>
              <el-button
                v-if="fragments.length > 0"
                link
                size="small"
                type="danger"
                @click.stop="clearAllData"
                style="margin-left: 8px;"
                :title="t('dramaScript.clearAllTooltip')"
              >
                <el-icon><Delete /></el-icon>
                {{ t('dramaScript.clearAll') }}
              </el-button>
            </div>
            <div class="header-right">
              <el-button link circle size="small" class="header-btn" @click="toggleMinimize">
                <el-icon><Minus v-if="!isMinimized" /><FullScreen v-else /></el-icon>
              </el-button>
              <el-button link circle size="small" class="header-btn" @click="closeDialog">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>

          <!-- 内容区域 -->
          <div v-show="!isMinimized" class="dialog-content">
            <!-- 工具栏 -->
            <div class="toolbar">
              <div class="toolbar-left">
                <el-button size="small" @click="addFragment">
                  <el-icon><Plus /></el-icon>
                  {{ t('dramaScript.addFragment') }}
                </el-button>
                <el-button size="small" @click="deleteSelectedFragments" :disabled="selectedFragments.length === 0">
                  <el-icon><Delete /></el-icon>
                  {{ t('dramaScript.delete') }}
                </el-button>
                <el-button size="small" @click="duplicateSelectedFragments" :disabled="selectedFragments.length === 0">
                  <el-icon><Copy /></el-icon>
                  {{ t('dramaScript.duplicate') }}
                </el-button>
                <el-button size="small" @click="showCharacterManager = true">
                  <el-icon><User /></el-icon>
                  {{ t('dramaScript.characterManager') }}
                </el-button>
                <el-divider direction="vertical" />
                <el-button size="small" @click="batchGeneratePrompts" :disabled="selectedFragments.length === 0">
                  <el-icon><Sparkles /></el-icon>
                  {{ t('dramaScript.batchGeneratePrompts') }}
                </el-button>
                <el-button size="small" @click="batchGenerateVideos" :disabled="selectedFragments.length === 0">
                  <el-icon><VideoPlay /></el-icon>
                  {{ t('dramaScript.batchGenerateVideos') }}
                </el-button>
                <el-button 
                  size="small" 
                  @click="retrySelectedFragments" 
                  :disabled="fragments.filter((f: SceneFragment) => selectedFragments.includes(f.id) && f.status === 'failed').length === 0"
                  type="warning"
                >
                  <el-icon><Refresh /></el-icon>
                  {{ t('dramaScript.retryFailed') }}
                </el-button>
                <el-divider direction="vertical" />
                <el-tooltip :content="useEnhancedMode ? (t('dramaScript.enhancedModeOn')) : (t('dramaScript.enhancedModeOff'))" placement="top">
                  <el-switch
                    v-model="useEnhancedMode"
                    :active-text="t('dramaScript.enhancedMode')"
                    inactive-text=""
                    size="small"
                    style="margin-left: 8px;"
                    @change="saveEnhancedModeSetting"
                  />
                </el-tooltip>
              </div>
              <div class="toolbar-right">
                <el-button size="small" @click="showWorkflowManager = true">
                  <el-icon><VideoPlay /></el-icon>
                  {{ t('dramaScript.workflows') }}
                </el-button>
                <el-button size="small" @click="showPlotAdvisor = true">
                  <el-icon><Sparkles /></el-icon>
                  {{ t('dramaScript.plotAdvisor') }}
                </el-button>
                <el-button size="small" @click="checkContinuity">
                  <SearchIcon />
                  {{ t('dramaScript.continuityCheck') }}
                </el-button>
                <el-button size="small" @click="calculateCharacterStats">
                  <el-icon><User /></el-icon>
                  {{ t('dramaScript.characterStats') }}
                </el-button>
                <el-button size="small" @click="openAnalyticsDashboard">
                  <el-icon><Rank /></el-icon>
                  {{ t('dramaScript.analytics') }}
                </el-button>
                <el-button size="small" @click="openAICreation">
                  <el-icon><Sparkles /></el-icon>
                  {{ t('dramaScript.aiCreation.title') }}
                </el-button>
                <el-button size="small" @click="openVideoProcessing">
                  <el-icon><VideoPlay /></el-icon>
                  {{ t('dramaScript.videoProcessing.title') }}
                </el-button>
                <el-button size="small" @click="openVersionManager">
                  <el-icon><Document /></el-icon>
                  {{ t('dramaScript.versionManager') }}
                </el-button>
                <el-button size="small" @click="openComments()">
                  <el-icon><Edit /></el-icon>
                  {{ t('dramaScript.comments') }}
                </el-button>
                <el-button size="small" @click="showTemplateManager = true">
                  <el-icon><Document /></el-icon>
                  {{ t('dramaScript.templates') }}
                </el-button>
                <el-button size="small" @click="openScriptImport">
                  <el-icon><Document /></el-icon>
                  {{ t('dramaScript.importScript') }}
                </el-button>
                <el-button size="small" @click="showShortcutsDialog = true">
                  <el-icon><Rank /></el-icon>
                  {{ t('dramaScript.shortcuts') }}
                </el-button>
                <el-button 
                  size="small" 
                  @click="openBatchStatusDialog"
                  :disabled="selectedFragments.length === 0"
                >
                  <el-icon><Edit /></el-icon>
                  {{ t('dramaScript.batchStatus') }}
                </el-button>
                <el-divider direction="vertical" />
                <el-button size="small" @click="showExportDialog = true">
                  <el-icon><Download /></el-icon>
                  {{ t('dramaScript.export') }}
                </el-button>
                <el-button size="small" @click="generateExportPreview('markdown')">
                  <el-icon><Document /></el-icon>
                  {{ t('dramaScript.exportPreview') }}
                </el-button>
                <el-button size="small" @click="importFromExcel">
                  <el-icon><Upload /></el-icon>
                  {{ t('dramaScript.import') }}
                </el-button>
                <el-button size="small" @click="mergeAndExportVideos" :disabled="completedCount === 0">
                  <el-icon><VideoPlay /></el-icon>
                  {{ t('dramaScript.mergeVideos') }}
                </el-button>
                <el-divider direction="vertical" />
                <el-button size="small" type="primary" @click="generateNextFragment" :disabled="fragments.length === 0">
                  <el-icon><VideoPlay /></el-icon>
                  {{ t('dramaScript.generateNext') }}
                </el-button>
              </div>
            </div>

            <!-- 搜索和筛选栏 -->
            <div class="filter-bar">
              <div class="unified-search-input-wrap" style="width: 250px; margin-right: 12px;">
                <el-input
                  v-model="searchKeyword"
                  size="small"
                  :placeholder="t('dramaScript.searchPlaceholder')"
                  clearable
                >
                  <template #prefix>
                    <SearchIcon />
                  </template>
                </el-input>
              </div>
              <el-select
                v-model="filterCharacter"
                size="small"
                :placeholder="t('dramaScript.filterByCharacter')"
                clearable
                style="width: 150px; margin-right: 12px;"
              >
                <el-option
                  v-for="char in uniqueCharacters"
                  :key="char"
                  :label="char"
                  :value="char"
                />
              </el-select>
              <el-select
                v-model="filterStatus"
                size="small"
                :placeholder="t('dramaScript.filterByStatus')"
                clearable
                style="width: 150px; margin-right: 12px;"
              >
                <el-option
                  :label="t('dramaScript.statusPending')"
                  value="pending"
                />
                <el-option
                  :label="t('dramaScript.statusGenerating')"
                  value="generating"
                />
                <el-option
                  :label="t('dramaScript.statusCompleted')"
                  value="completed"
                />
                <el-option
                  :label="t('dramaScript.statusFailed')"
                  value="failed"
                />
              </el-select>
              <div class="statistics">
                <el-tag size="small" type="info">
                  {{ t('dramaScript.total') }}: {{ fragments.length }}
                </el-tag>
                <el-tag size="small" type="success" style="margin-left: 8px;">
                  {{ t('dramaScript.completed') }}: {{ completedCount }}
                </el-tag>
                <el-tag size="small" type="warning" style="margin-left: 8px;">
                  {{ t('dramaScript.generating') }}: {{ generatingCount }}
                </el-tag>
                <el-tag size="small" type="info" style="margin-left: 8px;">
                  {{ t('dramaScript.pending') }}: {{ pendingCount }}
                </el-tag>
                
                <!-- 搜索结果导航 -->
                <div v-if="searchKeyword && searchMatchFragments.length > 0" class="search-nav">
                  <span class="search-count">{{ searchResultIndex + 1 }} / {{ searchMatchFragments.length }}</span>
                  <el-button-group size="small">
                    <el-button @click="navigateSearchResults('prev')" :disabled="searchMatchFragments.length <= 1">
                      <el-icon><ArrowUp /></el-icon>
                    </el-button>
                    <el-button @click="navigateSearchResults('next')" :disabled="searchMatchFragments.length <= 1">
                      <el-icon><ArrowDown /></el-icon>
                    </el-button>
                  </el-button-group>
                </div>
                
                <!-- 自动保存状态 -->
                <div v-if="autoSaveStatus !== 'idle'" class="auto-save-indicator" :class="autoSaveStatus">
                  <el-icon v-if="autoSaveStatus === 'saving'" class="is-loading"><Loading /></el-icon>
                  <el-icon v-else-if="autoSaveStatus === 'saved'"><CircleCheck /></el-icon>
                  <el-icon v-else-if="autoSaveStatus === 'error'"><CircleClose /></el-icon>
                  <span>{{ autoSaveStatusText }}</span>
                </div>
                
                <!-- 网络状态 -->
                <el-tag v-if="!isOnline" size="small" type="warning" class="network-status">
                  <el-icon><WarningFilled /></el-icon>
                  {{ t('dramaScript.offline') }}
                </el-tag>
              </div>
            </div>

            <!-- Excel表格区域 -->
            <div class="excel-container" ref="excelContainerRef">
              <!-- 空状态 -->
              <div v-if="filteredFragments.length === 0" class="empty-state">
                <el-empty
                  :description="searchKeyword || filterCharacter || filterStatus 
                    ? (t('dramaScript.noSearchResults'))
                    : (t('dramaScript.emptyState'))"
                >
                  <template #image>
                    <el-icon :size="80" style="color: var(--el-color-info-light-5);">
                      <Document />
                    </el-icon>
                  </template>
                  <template #description>
                    <div>
                      <p>{{ searchKeyword || filterCharacter || filterStatus 
                        ? (t('dramaScript.noSearchResults'))
                        : (t('dramaScript.emptyState')) }}</p>
                      <div v-if="!searchKeyword && !filterCharacter && !filterStatus" class="empty-state-tips">
                        <el-text size="small" type="info">
                          <el-icon><Rank /></el-icon>
                          {{ t('dramaScript.emptyStateTip1') }}
                        </el-text>
                        <br />
                        <el-text size="small" type="info" style="margin-top: 8px; display: inline-block;">
                          <el-icon><Document /></el-icon>
                          {{ t('dramaScript.emptyStateTip2') }}
                        </el-text>
                      </div>
                    </div>
                  </template>
                  <el-button v-if="!searchKeyword && !filterCharacter && !filterStatus" type="primary" @click="addFragment">
                    {{ t('dramaScript.addFragment') }}
                  </el-button>
                </el-empty>
              </div>
              
              <!-- 表格 -->
              <div v-else class="excel-table-wrapper">
                <div class="table-hint" v-if="fragments.length > 0">
                  <el-text size="small" type="info">
                    <el-icon><Rank /></el-icon>
                    {{ t('dramaScript.dragToReorder') }}
                  </el-text>
                </div>
                <table class="excel-table">
                  <!-- 表头 -->
                  <thead>
                    <tr>
                      <th class="col-checkbox">
                        <el-checkbox
                          :model-value="allSelected"
                          @change="toggleSelectAll"
                        />
                      </th>
                      <th class="col-sequence">{{ t('dramaScript.sequence') }}</th>
                      <th class="col-character">{{ t('dramaScript.character') }}</th>
                      <th class="col-scene">{{ t('dramaScript.scene') }}</th>
                      <th class="col-description">{{ t('dramaScript.description') }}</th>
                      <th class="col-first-frame">{{ t('dramaScript.firstFramePrompt') }}</th>
                      <th class="col-video-prompt">{{ t('dramaScript.videoPrompt') }}</th>
                      <th class="col-appearance">{{ t('dramaScript.characterAppearance') }}</th>
                      <th class="col-voice">{{ t('dramaScript.voice') }}</th>
                      <th class="col-video">{{ t('dramaScript.video') }}</th>
                      <th class="col-last-frame">{{ t('dramaScript.lastFrame') }}</th>
                      <th class="col-reference">{{ t('dramaScript.referencePrevious') }}</th>
                      <th class="col-status">{{ t('dramaScript.status') }}</th>
                      <th class="col-actions">{{ t('common.actions') }}</th>
                    </tr>
                  </thead>
                  <!-- 表体 -->
                  <tbody>
                    <tr
                      v-for="(fragment, index) in filteredFragments"
                      :key="fragment.id"
                      :data-fragment-id="fragment.id"
                      :class="{ 
                        'is-selected': selectedFragments.includes(fragment.id),
                        'is-generating': fragment.status === 'generating',
                        'is-completed': fragment.status === 'completed',
                        'is-failed': fragment.status === 'failed',
                        'is-highlighted': highlightedFragmentId === fragment.id,
                        'is-search-match': searchKeyword && searchMatchFragments.includes(fragment.id)
                      }"
                      draggable="true"
                      @dragstart="handleDragStart($event, fragment, index)"
                      @dragover.prevent="handleDragOver($event)"
                      @drop="handleDrop($event, fragment, index)"
                      @dragend="handleDragEnd"
                      @contextmenu.prevent="showContextMenu($event, fragment)"
                    >
                      <!-- 复选框 -->
                      <td class="col-checkbox">
                        <el-checkbox
                          :model-value="selectedFragments.includes(fragment.id)"
                          @change="toggleSelectFragment(fragment.id)"
                        />
                      </td>
                      <!-- 序号 -->
                      <td class="col-sequence">{{ fragment.sequence }}</td>
                      <!-- 人物 -->
                      <td class="col-character">
                        <el-input
                          v-model="fragment.character"
                          size="small"
                          @blur="onFragmentChange(fragment)"
                          @keydown.enter.stop="(e: KeyboardEvent) => (e.target as HTMLElement).blur()"
                        />
                      </td>
                      <!-- 场景 -->
                      <td class="col-scene">
                        <el-input
                          v-model="fragment.scene"
                          size="small"
                          @blur="onFragmentChange(fragment)"
                          @keydown.enter.stop="(e: KeyboardEvent) => (e.target as HTMLElement).blur()"
                        />
                      </td>
                      <!-- 描述 -->
                      <td class="col-description">
                        <el-input
                          v-model="fragment.description"
                          type="textarea"
                          :rows="2"
                          size="small"
                          @blur="onFragmentChange(fragment)"
                        />
                      </td>
                      <!-- 首帧图示词 -->
                      <td class="col-first-frame">
                        <el-input
                          v-model="fragment.firstFramePrompt"
                          type="textarea"
                          :rows="2"
                          size="small"
                          @blur="onFragmentChange(fragment)"
                        />
                        <el-button
                          v-if="fragment.character && fragment.scene && fragment.description"
                          link
                          size="small"
                          @click="generateFirstFramePrompt(fragment)"
                        >
                          <el-icon><Sparkles /></el-icon>
                        </el-button>
                      </td>
                      <!-- 视频生成提示词 -->
                      <td class="col-video-prompt">
                        <el-input
                          v-model="fragment.videoPrompt"
                          type="textarea"
                          :rows="3"
                          size="small"
                          @blur="onFragmentChange(fragment)"
                        />
                        <el-button
                          v-if="fragment.character && fragment.scene && fragment.description"
                          link
                          size="small"
                          @click="generateVideoPrompt(fragment)"
                        >
                          <el-icon><Sparkles /></el-icon>
                        </el-button>
                      </td>
                      <!-- 人物形象 -->
                      <td class="col-appearance">
                        <div class="appearance-cell">
                          <el-image
                            v-if="fragment.characterAppearance?.imageUrl"
                            :src="fragment.characterAppearance.imageUrl"
                            :preview-src-list="[fragment.characterAppearance.imageUrl]"
                            fit="cover"
                            class="appearance-image"
                          />
                          <el-input
                            v-model="fragment.characterAppearance.description"
                            type="textarea"
                            :rows="2"
                            size="small"
                            :placeholder="t('dramaScript.appearancePlaceholder')"
                            @blur="onFragmentChange(fragment)"
                          />
                          <el-button
                            v-if="fragment.character"
                            link
                            size="small"
                            @click="loadCharacterAppearance(fragment)"
                          >
                            <el-icon><Refresh /></el-icon>
                          </el-button>
                        </div>
                      </td>
                      <!-- 声音 -->
                      <td class="col-voice">
                        <el-input
                          v-model="fragment.voice.description"
                          type="textarea"
                          :rows="2"
                          size="small"
                          :placeholder="t('dramaScript.voicePlaceholder')"
                          @blur="onFragmentChange(fragment)"
                        />
                        <el-button
                          v-if="fragment.character"
                          link
                          size="small"
                          @click="loadCharacterVoice(fragment)"
                        >
                          <el-icon><Refresh /></el-icon>
                        </el-button>
                      </td>
                      <!-- 视频 -->
                      <td class="col-video">
                        <div v-if="fragment.videoUrl" class="video-cell">
                          <div class="video-wrapper">
                            <video
                              :src="fragment.videoUrl"
                              controls
                              preload="none"
                              class="video-preview"
                              @loadedmetadata="onVideoLoaded(fragment)"
                              @click.stop
                            />
                            <div class="video-actions">
                              <el-button
                                circle
                                size="small"
                                @click="openVideoPreview(fragment)"
                                :title="t('dramaScript.videoPreview')"
                              >
                                <el-icon><VideoPlay /></el-icon>
                              </el-button>
                              <el-button
                                circle
                                size="small"
                                @click="openVideoFullscreen(fragment)"
                                :title="t('dramaScript.fullscreen')"
                              >
                                <el-icon><FullScreen /></el-icon>
                              </el-button>
                              <el-button
                                circle
                                size="small"
                                @click="downloadVideo(fragment)"
                                :title="t('dramaScript.downloadVideo')"
                              >
                                <el-icon><Download /></el-icon>
                              </el-button>
                            </div>
                          </div>
                          <div class="video-info">
                            <el-button
                              link
                              size="small"
                              @click="extractLastFrame(fragment)"
                              :loading="fragment.extractingFrame"
                            >
                              <el-icon><Image /></el-icon>
                              {{ t('dramaScript.extractFrame') }}
                            </el-button>
                            <el-tag size="small" type="info" style="margin-left: 8px;" v-if="fragment.videoDuration">
                              {{ formatVideoDuration(fragment.videoDuration) }}
                            </el-tag>
                            <el-tag 
                              v-if="fragment.qualityScore !== undefined" 
                              size="small" 
                              :type="fragment.qualityScore >= 80 ? 'success' : fragment.qualityScore >= 60 ? 'warning' : 'danger'"
                              style="margin-left: 8px;"
                              :title="fragment.qualityReport ? `${t('dramaScript.qualityScoreLabel')}：${fragment.qualityScore}/100\n${t('dramaScript.clarityLabel')}：${fragment.qualityReport.clarity}\n${t('dramaScript.motionSmoothnessLabel')}：${fragment.qualityReport.motionSmoothness}` : ''"
                            >
                              {{ t('dramaScript.qualityScore') }}: {{ fragment.qualityScore }}/100
                            </el-tag>
                          </div>
                        </div>
                        <el-button
                          v-else
                          size="small"
                          type="primary"
                          @click="generateVideo(fragment)"
                          :loading="fragment.status === 'generating'"
                          :disabled="!canGenerateVideo(fragment)"
                        >
                          <el-icon><VideoPlay /></el-icon>
                          {{ t('dramaScript.generateVideo') }}
                        </el-button>
                      </td>
                      <!-- 尾帧 -->
                      <td class="col-last-frame">
                        <el-image
                          v-if="fragment.lastFrameImage"
                          :src="fragment.lastFrameImage"
                          :preview-src-list="[fragment.lastFrameImage]"
                          fit="cover"
                          class="last-frame-image"
                        />
                        <span v-else class="text-placeholder">-</span>
                      </td>
                      <!-- 参考上段 -->
                      <td class="col-reference">
                        <el-checkbox
                          v-model="fragment.usePreviousLastFrame"
                          @change="onFragmentChange(fragment)"
                        />
                      </td>
                      <!-- 状态 -->
                      <td class="col-status">
                        <div class="status-cell">
                          <el-tag
                            :type="getStatusTagType(fragment.status)"
                            size="small"
                          >
                            {{ getStatusLabel(fragment.status) }}
                          </el-tag>
                          <el-progress
                            v-if="fragment.status === 'generating' && fragment.progress"
                            :percentage="fragment.progress"
                            :stroke-width="4"
                            :show-text="false"
                            style="width: 80px; margin-left: 8px;"
                          />
                        </div>
                      </td>
                      <!-- 操作 -->
                      <td class="col-actions">
                        <div class="action-buttons">
                          <el-button
                            link
                            size="small"
                            @click="toggleQuickPreview(fragment)"
                            :title="t('dramaScript.quickPreview')"
                          >
                            <SearchIcon />
                          </el-button>
                          <el-button
                            link
                            size="small"
                            @click="duplicateFragment(fragment)"
                            :title="t('dramaScript.duplicate')"
                          >
                            <el-icon><Copy /></el-icon>
                          </el-button>
                          <el-button
                            link
                            size="small"
                            type="danger"
                            @click="deleteFragment(fragment.id)"
                            :title="t('common.delete')"
                          >
                            <el-icon><Delete /></el-icon>
                          </el-button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 调整大小手柄 -->
          <div
            ref="resizeHandleRef"
            class="resize-handle"
            @mousedown="startResize"
          >
            <el-icon><Rank /></el-icon>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 角色管理器抽屉 -->
    <el-drawer
      v-model="showCharacterManager"
      :title="t('dramaScript.characterManager')"
      direction="rtl"
      size="500px"
    >
      <CharacterManager
        :characters="characters"
        @update:characters="characters = $event"
        @select="handleCharacterSelect"
      />
    </el-drawer>

    <!-- 工作流管理器抽屉 -->
    <el-drawer
      v-model="showWorkflowManager"
      :title="t('dramaScript.workflowManager')"
      direction="rtl"
      size="600px"
    >
      <div class="workflow-manager">
        <div class="workflow-actions">
          <el-button type="primary" @click="executeSelectedWorkflow" :disabled="!selectedWorkflow">
            <el-icon><VideoPlay /></el-icon>
            {{ t('dramaScript.executeWorkflow') }}
          </el-button>
        </div>
        
        <el-divider />
        
        <div class="workflow-list">
          <div v-if="workflowTemplates.length === 0" class="empty-workflows">
            <el-empty :description="t('dramaScript.noWorkflows')" />
          </div>
          
          <div v-else class="workflow-items">
            <div
              v-for="workflow in workflowTemplates"
              :key="workflow.id"
              class="workflow-item"
              :class="{ 'is-selected': selectedWorkflow?.id === workflow.id }"
              @click="selectedWorkflow = workflow"
            >
              <div class="workflow-info">
                <div class="workflow-name">{{ workflow.name }}</div>
                <div class="workflow-description">{{ workflow.description }}</div>
                <div class="workflow-steps">
                  <el-text size="small" type="info">
                    {{ workflow.steps.filter((s: WorkflowStep) => s.enabled).length }} {{ t('dramaScript.steps') }}
                  </el-text>
                </div>
              </div>
              <div class="workflow-actions-item">
                <el-checkbox
                  :model-value="selectedWorkflow?.id === workflow.id"
                  @change="selectedWorkflow = selectedWorkflow?.id === workflow.id ? null : workflow"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 剧情建议器抽屉 -->
    <el-drawer
      v-model="showPlotAdvisor"
      :title="t('dramaScript.plotAdvisor')"
      direction="rtl"
      size="700px"
    >
      <div class="plot-advisor">
        <el-tabs v-model="plotAdvisorTab">
          <el-tab-pane :label="t('dramaScript.sceneRecommendations')" name="scenes">
            <div class="advisor-section">
              <el-button type="primary" @click="loadSceneRecommendations" :loading="loadingRecommendations">
                <el-icon><Sparkles /></el-icon>
                {{ t('dramaScript.getRecommendations') }}
              </el-button>
              
              <div v-if="sceneRecommendations.length > 0" class="recommendations-list" style="margin-top: 16px;">
                <div
                  v-for="(rec, index) in sceneRecommendations"
                  :key="index"
                  class="recommendation-item"
                >
                  <div class="recommendation-header">
                    <el-tag :type="rec.confidence >= 0.8 ? 'success' : rec.confidence >= 0.6 ? 'warning' : 'info'" size="small">
                      {{ Math.round(rec.confidence * 100) }}% {{ t('dramaScript.confidence') }}
                    </el-tag>
                    <el-button size="small" type="primary" @click="applyRecommendation(rec)">
                      {{ t('dramaScript.apply') }}
                    </el-button>
                  </div>
                  <div class="recommendation-content">
                    <div class="recommendation-title">{{ rec.scene }}</div>
                    <div class="recommendation-description">{{ rec.description }}</div>
                    <div class="recommendation-reason">
                      <strong>{{ t('dramaScript.recommendationReason') }}：</strong>
                      {{ rec.reason }}
                    </div>
                    <div class="recommendation-effect">
                      <strong>{{ t('dramaScript.expectedEffect') }}：</strong>
                      {{ rec.expectedEffect }}
                    </div>
                  </div>
                </div>
              </div>
              
              <el-empty
                v-else
                :description="t('dramaScript.noRecommendations')"
                style="margin-top: 40px;"
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane :label="t('dramaScript.conflictDetection')" name="conflicts">
            <div class="advisor-section">
              <el-button type="primary" @click="detectPlotConflicts">
                <SearchIcon />
                {{ t('dramaScript.detectConflicts') }}
              </el-button>
              
              <div v-if="detectedConflicts.length > 0" class="conflicts-list" style="margin-top: 16px;">
                <div
                  v-for="(conflict, index) in detectedConflicts"
                  :key="index"
                  class="conflict-item"
                  :class="`severity-${conflict.severity}`"
                >
                  <div class="conflict-header">
                    <el-tag :type="conflict.severity === 'high' ? 'danger' : conflict.severity === 'medium' ? 'warning' : 'info'" size="small">
                      {{ t(`dramaScript.conflictType.${conflict.type}`) || conflict.type }}
                    </el-tag>
                    <el-tag size="small" type="info">
                      {{ conflict.fragmentIds.length }} {{ t('dramaScript.fragments') }}
                    </el-tag>
                  </div>
                  <div class="conflict-description">{{ conflict.description }}</div>
                  <div class="conflict-suggestion">
                    <strong>{{ t('dramaScript.suggestion') }}：</strong>
                    {{ conflict.suggestion }}
                  </div>
                </div>
              </div>
              
              <el-empty
                v-else
                :description="t('dramaScript.noConflicts')"
                style="margin-top: 40px;"
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane :label="t('dramaScript.characterRelations')" name="relations">
            <div class="advisor-section">
              <el-button type="primary" @click="analyzeRelations">
                <el-icon><User /></el-icon>
                {{ t('dramaScript.analyzeRelations') }}
              </el-button>
              
              <div v-if="characterRelations" class="relations-view" style="margin-top: 16px;">
                <div class="relations-summary">
                  <el-text size="small">
                    {{ t('dramaScript.totalCharacters') }}: {{ characterRelations.characters.length }}
                  </el-text>
                  <el-text size="small" style="margin-left: 16px;">
                    {{ t('dramaScript.totalRelations') }}: {{ characterRelations.relations.length }}
                  </el-text>
                </div>
                
                <div class="character-frequency" style="margin-top: 16px;">
                  <h4>{{ t('dramaScript.characterFrequency') }}</h4>
                  <div class="frequency-list">
                    <el-tag
                      v-for="(count, char) in characterRelations.characterFrequency"
                      :key="char"
                      size="small"
                      style="margin: 4px;"
                    >
                      {{ char }}: {{ count }} {{ t('dramaScript.times') }}
                    </el-tag>
                  </div>
                </div>
                
                <div class="relations-list" style="margin-top: 16px;">
                  <h4>{{ t('dramaScript.characterInteractions') }}</h4>
                  <div
                    v-for="(relation, index) in characterRelations.relations"
                    :key="index"
                    class="relation-item"
                  >
                    <el-text>
                      {{ relation.character1 }} ↔ {{ relation.character2 }}
                    </el-text>
                    <el-text size="small" type="info" style="margin-left: 8px;">
                      ({{ relation.interactionCount }} {{ t('dramaScript.interactions') }})
                    </el-text>
                  </div>
                </div>
              </div>
              
              <el-empty
                v-else
                :description="t('dramaScript.noRelationsData')"
                style="margin-top: 40px;"
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane :label="t('dramaScript.pacingAnalysis')" name="pacing">
            <div class="advisor-section">
              <el-button type="primary" @click="analyzePacingRythm">
                <el-icon><Rank /></el-icon>
                {{ t('dramaScript.analyzePacing') }}
              </el-button>
              
              <div v-if="pacingAnalysis" class="pacing-view" style="margin-top: 16px;">
                <div class="pacing-summary">
                  <el-tag :type="pacingAnalysis.overallPacing === 'fast' ? 'success' : pacingAnalysis.overallPacing === 'slow' ? 'warning' : 'info'">
                    {{ t(`dramaScript.pacing.${pacingAnalysis.overallPacing}`) || pacingAnalysis.overallPacing }}
                  </el-tag>
                  <el-text size="small" style="margin-left: 16px;">
                    {{ t('dramaScript.averageSceneLength') }}: {{ pacingAnalysis.averageSceneLength.toFixed(1) }} {{ t('dramaScript.seconds') }}
                  </el-text>
                </div>
                
                <div v-if="pacingAnalysis.pacingIssues.length > 0" class="pacing-issues" style="margin-top: 16px;">
                  <h4>{{ t('dramaScript.pacingIssues') }}</h4>
                  <div
                    v-for="(issue, index) in pacingAnalysis.pacingIssues"
                    :key="index"
                    class="pacing-issue-item"
                  >
                    <el-text size="small">{{ issue.issue }}</el-text>
                    <el-text size="small" type="info" style="margin-left: 8px;">
                      {{ issue.suggestion }}
                    </el-text>
                  </div>
                </div>
                
                <el-empty
                  v-else
                  :description="t('dramaScript.noPacingIssues')"
                  style="margin-top: 40px;"
                />
              </div>
              
              <el-empty
                v-else
                :description="t('dramaScript.noPacingData')"
                style="margin-top: 40px;"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <!-- 视频预览对话框 -->
    <el-dialog
      v-model="showVideoPreview"
      :title="t('dramaScript.videoPreview')"
      width="900px"
      destroy-on-close
      @close="closeVideoPreview"
    >
      <div class="video-preview-container" v-if="previewFragment">
        <!-- 视频播放器 -->
        <div class="video-player-section">
          <video
            ref="previewVideoRef"
            :src="previewFragment.videoUrl"
            class="preview-video"
            preload="none"
            @loadedmetadata="(e) => initPreviewController(e.target as HTMLVideoElement)"
            crossorigin="anonymous"
          ></video>
          
          <!-- 播放控制 -->
          <div class="video-controls">
            <el-button @click="togglePreviewPlayback" :icon="previewIsPlaying ? 'Pause' : 'VideoPlay'">
              {{ previewIsPlaying ? (t('dramaScript.pause')) : (t('dramaScript.play')) }}
            </el-button>
            <el-button @click="seekPreviewTo(0)">
              <el-icon><Refresh /></el-icon>
              {{ t('dramaScript.restart') }}
            </el-button>
            <el-button @click="capturePreviewFrame" type="primary">
              <el-icon><Image /></el-icon>
              {{ t('dramaScript.captureFrame') }}
            </el-button>
          </div>
          
          <!-- 时间进度 -->
          <div class="video-timeline">
            <span class="time-display">{{ formatPreviewTime(previewCurrentTime) }}</span>
            <el-slider
              v-model="previewCurrentTime"
              :max="previewController?.getDuration() || 0"
              :step="0.01"
              :show-tooltip="false"
              @change="seekPreviewTo"
              style="flex: 1; margin: 0 12px;"
            />
            <span class="time-display">{{ formatPreviewTime(previewController?.getDuration() || 0) }}</span>
          </div>
        </div>
        
        <!-- 关键帧缩略图 -->
        <div class="keyframes-section" v-if="previewFrames.length > 0">
          <h4>{{ t('dramaScript.keyframes') }}</h4>
          <div class="keyframes-grid">
            <div
              v-for="(frame, index) in previewFrames"
              :key="index"
              class="keyframe-item"
              @click="jumpToFrame(frame)"
            >
              <img :src="frame.imageDataUrl" :alt="`${t('dramaScript.frameLabel')} ${Number(index) + 1}`" loading="lazy" />
              <span class="keyframe-time">{{ formatPreviewTime(frame.timestamp) }}</span>
            </div>
          </div>
        </div>
        
        <!-- 转场效果选择 -->
        <div class="transition-section">
          <h4>{{ t('dramaScript.transitionEffect') }}</h4>
          <div class="transition-presets">
            <el-tag
              v-for="preset in transitionPresets"
              :key="`${preset.type}-${preset.direction || ''}-${preset.duration}`"
              :type="selectedTransition.type === preset.type && selectedTransition.duration === preset.duration ? 'primary' : 'info'"
              class="transition-tag"
              @click="selectedTransition = preset"
            >
              {{ getTransitionName(preset) }}
            </el-tag>
          </div>
        </div>
        
        <!-- 片段信息 -->
        <div class="fragment-info-section">
          <h4>{{ t('dramaScript.fragmentInfo') }}</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">{{ t('dramaScript.sequence') }}：</span>
              <span class="info-value">{{ previewFragment.sequence }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('dramaScript.character') }}：</span>
              <span class="info-value">{{ previewFragment.character || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('dramaScript.scene') }}：</span>
              <span class="info-value">{{ previewFragment.scene || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('dramaScript.duration') }}：</span>
              <span class="info-value">{{ (previewFragment.videoDuration || 0).toFixed(1) }}s</span>
            </div>
            <div class="info-item" v-if="previewFragment.qualityScore !== undefined">
              <span class="info-label">{{ t('dramaScript.qualityScore') }}：</span>
              <el-tag :type="previewFragment.qualityScore >= 80 ? 'success' : previewFragment.qualityScore >= 60 ? 'warning' : 'danger'" size="small">
                {{ previewFragment.qualityScore }}/100
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- AI辅助创作抽屉 -->
    <el-drawer
      v-model="showAICreation"
      :title="t('dramaScript.aiCreation.title')"
      direction="rtl"
      size="700px"
    >
      <div class="ai-creation-panel" v-loading="loadingAICreation">
        <!-- 故事弧分析 -->
        <div class="creation-section" v-if="storyArc">
          <h4>{{ t('dramaScript.storyArc') }}</h4>
          <div class="arc-progress">
            <el-progress :percentage="storyArc.currentPosition" :status="storyArc.phase === 'climax' ? 'exception' : ''">
              <span>{{ storyArc.phase === 'setup' ? t('dramaScript.phases.setup') : storyArc.phase === 'rising' ? t('dramaScript.phases.rising') : storyArc.phase === 'climax' ? t('dramaScript.phases.climax') : storyArc.phase === 'falling' ? t('dramaScript.phases.falling') : t('dramaScript.phases.resolution') }}</span>
            </el-progress>
          </div>
          <div class="arc-suggestions">
            <el-tag v-for="(sug, i) in storyArc.suggestions" :key="i" size="small" type="info" class="sug-tag">
              {{ sug }}
            </el-tag>
          </div>
        </div>
        
        <!-- 续写建议 -->
        <div class="creation-section" v-if="continuationSuggestion">
          <h4>{{ t('dramaScript.continuation') }}</h4>
          <div class="continuation-card">
            <div class="cont-item"><strong>{{ t('dramaScript.scene') }}：</strong>{{ continuationSuggestion.nextScene }}</div>
            <div class="cont-item"><strong>{{ t('dramaScript.description') }}：</strong>{{ continuationSuggestion.nextDescription }}</div>
            <div class="cont-item"><strong>{{ t('dramaScript.character') }}：</strong>{{ continuationSuggestion.suggestedCharacter }}</div>
            <div class="cont-item"><strong>{{ t('dramaScript.reasoning') }}：</strong>{{ continuationSuggestion.reasoning }}</div>
            <el-button type="primary" size="small" @click="applyContinuationSuggestion">
              {{ t('dramaScript.applySuggestion') }}
            </el-button>
          </div>
        </div>
        
        <!-- 剧情建议 -->
        <div class="creation-section" v-if="plotSuggestions.length > 0">
          <h4>{{ t('dramaScript.plotSuggestions') }}</h4>
          <div class="plot-suggestions">
            <div v-for="sug in plotSuggestions" :key="sug.id" class="plot-card">
              <div class="plot-header">
                <el-tag :type="sug.impact === 'high' ? 'danger' : sug.impact === 'medium' ? 'warning' : 'info'" size="small">
                  {{ sug.type === 'twist' ? t('dramaScript.plotTypes.twist') : sug.type === 'conflict' ? t('dramaScript.plotTypes.conflict') : sug.type === 'resolution' ? t('dramaScript.plotTypes.resolution') : sug.type === 'climax' ? t('dramaScript.plotTypes.climax') : t('dramaScript.plotTypes.transition') }}
                </el-tag>
                <span class="plot-title">{{ sug.title }}</span>
              </div>
              <p class="plot-desc">{{ sug.description }}</p>
              <div class="plot-meta">
                <span>{{ t('dramaScript.emotion') }}：{{ sug.emotionalTone }}</span>
                <span>{{ t('dramaScript.confidence') }}：{{ (sug.confidence * 100).toFixed(0) }}%</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 角色弧线 -->
        <div class="creation-section" v-if="characterArcs.length > 0">
          <h4>{{ t('dramaScript.characterArcs') }}</h4>
          <div v-for="arc in characterArcs" :key="arc.characterId" class="char-arc-card">
            <div class="char-name">{{ arc.characterName }}</div>
            <div class="char-overall">{{ arc.overallArc }}</div>
            <div class="char-suggestions" v-if="arc.suggestions.length > 0">
              <el-tag v-for="(s, i) in arc.suggestions" :key="i" size="small" type="warning">{{ s }}</el-tag>
            </div>
          </div>
        </div>
        
        <!-- 情感分析按钮 -->
        <div class="creation-actions">
          <el-button @click="analyzeFragmentEmotions" :loading="loadingAICreation">
            {{ t('dramaScript.analyzeEmotions') }}
          </el-button>
        </div>
      </div>
    </el-drawer>

    <!-- 视频处理抽屉 -->
    <el-drawer
      v-model="showVideoProcessing"
      :title="t('dramaScript.videoProcessing.title')"
      direction="rtl"
      size="600px"
    >
      <div class="video-processing-panel">
        <!-- 字幕生成 -->
        <div class="processing-section">
          <h4>{{ t('dramaScript.subtitleGeneration') }}</h4>
          <div class="subtitle-actions">
            <el-button @click="batchGenerateAllSubtitles" type="primary">
              {{ t('dramaScript.batchGenerateSubtitles') }}
            </el-button>
            <el-button @click="exportAllSubtitles('srt')">
              {{ t('dramaScript.exportSRT') }}
            </el-button>
            <el-button @click="exportAllSubtitles('ass')">
              {{ t('dramaScript.exportASS') }}
            </el-button>
          </div>
          <div class="subtitle-stats">
            <span>{{ t('dramaScript.subtitlesGenerated') }}: {{ projectSubtitles.size }} / {{ fragments.filter((f: SceneFragment) => f.videoUrl).length }} {{ t('dramaScript.fragments') }}</span>
          </div>
        </div>
        
        <!-- 字幕样式 -->
        <div class="processing-section">
          <h4>{{ t('dramaScript.subtitleStyle') }}</h4>
          <div class="style-presets">
            <el-tag
              v-for="preset in subtitleStylePresets"
              :key="preset.id"
              class="style-tag"
            >
              {{ preset.name }}
            </el-tag>
          </div>
        </div>
        
        <!-- 背景音乐 -->
        <div class="processing-section">
          <h4>{{ t('dramaScript.bgm') }}</h4>
          <div class="bgm-presets">
            <div v-for="bgm in bgmPresets" :key="bgm.id" class="bgm-item">
              <span class="bgm-name">{{ bgm.name }}</span>
              <el-tag size="small">{{ bgm.mood }}</el-tag>
            </div>
          </div>
        </div>
        
        <!-- 音效 -->
        <div class="processing-section">
          <h4>{{ t('dramaScript.sfx') }}</h4>
          <div class="sfx-categories">
            <div v-for="sfx in sfxPresets.slice(0, 8)" :key="sfx.id" class="sfx-item">
              <span>{{ sfx.name }}</span>
              <el-tag size="small" type="info">{{ sfx.category }}</el-tag>
            </div>
          </div>
        </div>
        
        <!-- 导出设置 -->
        <div class="processing-section">
          <h4>{{ t('dramaScript.exportSettings') }}</h4>
          <div class="export-presets">
            <el-tag
              v-for="preset in getExportPresets()"
              :key="preset.id"
              :type="exportSettings.resolution === preset.settings.resolution ? 'primary' : 'info'"
              class="export-tag"
              @click="exportSettings = preset.settings"
            >
              {{ preset.name }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 版本管理抽屉 -->
    <el-drawer
      v-model="showVersionManager"
      :title="t('dramaScript.versionManager')"
      direction="rtl"
      size="600px"
    >
      <div class="version-manager-panel">
        <div class="version-actions">
          <el-button type="primary" @click="createNewVersion()">
            {{ t('dramaScript.createVersion') }}
          </el-button>
        </div>
        
        <div class="version-list">
          <div
            v-for="version in versions"
            :key="version.id"
            class="version-item"
            :class="{ 'is-auto': version.isAutoSave }"
          >
            <div class="version-header">
              <span class="version-number">v{{ version.version }}</span>
              <span class="version-name">{{ version.name }}</span>
              <el-tag v-if="version.isAutoSave" size="small" type="info">{{ t('dramaScript.auto') }}</el-tag>
            </div>
            <div class="version-meta">
              <span>{{ new Date(version.createdAt).toLocaleString() }}</span>
              <span>{{ t('dramaScript.fragmentsCount', { count: version.fragments.length }) }}</span>
            </div>
            <div class="version-desc" v-if="version.description">
              {{ version.description }}
            </div>
            <div class="version-buttons">
              <el-button size="small" @click="handleRestoreVersion(version.id)">
                {{ t('dramaScript.restore') }}
              </el-button>
              <el-button size="small" type="danger" @click="handleDeleteVersion(version.id)">
                {{ t('common.delete') }}
              </el-button>
            </div>
          </div>
        </div>
        
        <el-empty v-if="versions.length === 0" :description="t('dramaScript.noVersions')" />
      </div>
    </el-drawer>

    <!-- 快捷键对话框 -->
    <el-dialog
      v-model="showShortcutsDialog"
      :title="t('dramaScript.keyboardShortcuts')"
      width="600px"
      destroy-on-close
    >
      <div class="shortcuts-dialog">
        <div class="shortcuts-section">
          <h4>{{ t('dramaScript.fileOperations') }}</h4>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + S</span>
            <span class="shortcut-desc">{{ t('dramaScript.save') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + E</span>
            <span class="shortcut-desc">{{ t('dramaScript.export') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + N</span>
            <span class="shortcut-desc">{{ t('dramaScript.newFragment') }}</span>
          </div>
        </div>
        
        <div class="shortcuts-section">
          <h4>{{ t('dramaScript.editOperations') }}</h4>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + Z</span>
            <span class="shortcut-desc">{{ t('dramaScript.undo') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + Y</span>
            <span class="shortcut-desc">{{ t('dramaScript.redo') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + A</span>
            <span class="shortcut-desc">{{ t('dramaScript.selectAll') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + D</span>
            <span class="shortcut-desc">{{ t('dramaScript.duplicate') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Delete</span>
            <span class="shortcut-desc">{{ t('dramaScript.deleteSelected') }}</span>
          </div>
        </div>
        
        <div class="shortcuts-section">
          <h4>{{ t('dramaScript.generationOperations') }}</h4>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + Enter</span>
            <span class="shortcut-desc">{{ t('dramaScript.generatePrompt') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + Shift + Enter</span>
            <span class="shortcut-desc">{{ t('dramaScript.generateVideo') }}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl + /</span>
            <span class="shortcut-desc">{{ t('dramaScript.showShortcuts') }}</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 剧本导入对话框 -->
    <el-dialog
      v-model="showScriptImport"
      :title="t('dramaScript.importScript')"
      width="800px"
      destroy-on-close
    >
      <div class="script-import-dialog">
        <div class="import-input-section">
          <el-input
            v-model="scriptImportText"
            type="textarea"
            :rows="12"
            :placeholder="t('dramaScript.enterScriptContent')"
          />
          <div class="import-actions">
            <el-button @click="parseScript" :loading="parsingScript" type="primary">
              {{ t('dramaScript.parseScript') }}
            </el-button>
          </div>
        </div>
        
        <div class="parsed-scenes-section" v-if="parsedScenes.length > 0">
          <h4>{{ t('dramaScript.parsedScenes') }} ({{ parsedScenes.length }} {{ t('dramaScript.scenes') }})</h4>
          <div class="parsed-scene-list">
            <div v-for="(scene, index) in parsedScenes" :key="index" class="parsed-scene-item">
              <div class="scene-header">
                <el-tag type="primary" size="small">{{ t('dramaScript.scene') }} {{ scene.sceneNumber }}</el-tag>
                <span class="scene-title">{{ scene.title }}</span>
              </div>
              <div class="scene-info">
                <span>📍 {{ scene.location }}</span>
                <span>🕐 {{ scene.timeOfDay }}</span>
                <span>😊 {{ scene.mood }}</span>
              </div>
              <div class="scene-desc">{{ scene.description }}</div>
              <div class="scene-characters" v-if="scene.characters?.length">
                <el-tag v-for="char in scene.characters" :key="char" size="small" type="info">
                  {{ char }}
                </el-tag>
              </div>
            </div>
          </div>
          <div class="import-confirm">
            <el-button @click="applyParsedScenes" type="success" size="large">
              {{ t('dramaScript.applyScenes') }}
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 导出对话框 -->
    <el-dialog
      v-model="showExportDialog"
      :title="t('dramaScript.exportProject')"
      width="500px"
      destroy-on-close
    >
      <div class="export-dialog">
        <div class="export-format-section">
          <h4>{{ t('dramaScript.selectFormat') }}</h4>
          <div class="format-list">
            <div
              v-for="format in exportFormats"
              :key="format.id"
              class="format-item"
              :class="{ active: selectedExportFormat === format.id }"
              @click="selectedExportFormat = format.id"
            >
              <div class="format-name">{{ format.name }}</div>
              <div class="format-ext">.{{ format.extension }}</div>
              <div class="format-desc">{{ format.description }}</div>
            </div>
          </div>
        </div>
        
        <div class="export-preview">
          <div class="preview-stats">
            <span>📄 {{ t('dramaScript.fragmentsCount', { count: fragments.length }) }}</span>
            <span>👥 {{ t('dramaScript.charactersCount', { count: characters.length }) }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showExportDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleExport">{{ t('dramaScript.export') }}</el-button>
      </template>
    </el-dialog>

    <!-- 批量状态更新对话框 -->
    <el-dialog
      v-model="showBatchStatusDialog"
      :title="t('dramaScript.batchStatusTitle')"
      width="400px"
      destroy-on-close
    >
      <div class="batch-status-dialog">
        <p class="batch-hint">
          {{ t('dramaScript.batchStatusHint', { count: selectedFragments.length }) }}
        </p>
        <el-radio-group v-model="batchStatusTarget" class="status-radio-group">
          <el-radio label="pending">
            <el-tag type="info" size="small">{{ t('dramaScript.statusPending') }}</el-tag>
          </el-radio>
          <el-radio label="generating">
            <el-tag type="warning" size="small">{{ t('dramaScript.statusGenerating') }}</el-tag>
          </el-radio>
          <el-radio label="completed">
            <el-tag type="success" size="small">{{ t('dramaScript.statusCompleted') }}</el-tag>
          </el-radio>
          <el-radio label="failed">
            <el-tag type="danger" size="small">{{ t('dramaScript.statusFailed') }}</el-tag>
          </el-radio>
        </el-radio-group>
      </div>
      <template #footer>
        <el-button @click="showBatchStatusDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="applyBatchStatus">{{ t('common.apply') }}</el-button>
      </template>
    </el-dialog>

    <!-- 连续性检查对话框 -->
    <el-dialog
      v-model="showContinuityCheck"
      :title="t('dramaScript.continuityCheckTitle')"
      width="650px"
      destroy-on-close
    >
      <div class="continuity-check-dialog">
        <div v-if="continuityIssues.length === 0" class="no-issues">
          <el-empty :description="t('dramaScript.noContinuityIssues')" />
        </div>
        <div v-else class="issues-list">
          <div 
            v-for="(issue, index) in continuityIssues" 
            :key="index" 
            class="issue-item"
            :class="issue.severity"
          >
            <div class="issue-header">
              <el-tag :type="issue.severity === 'error' ? 'danger' : 'warning'" size="small">
                {{ issue.type === 'character' ? t('dramaScript.issueTypes.character') : issue.type === 'scene' ? t('dramaScript.issueTypes.scene') : issue.type === 'timeline' ? t('dramaScript.issueTypes.timeline') : t('dramaScript.issueTypes.logic') }}
              </el-tag>
              <span class="issue-severity">{{ issue.severity === 'error' ? t('dramaScript.severity.error') : t('dramaScript.severity.warning') }}</span>
            </div>
            <div class="issue-desc">{{ issue.description }}</div>
            <div class="issue-suggestion">
              <el-icon><Sparkles /></el-icon>
              {{ issue.suggestion }}
            </div>
            <el-button size="small" type="primary" link @click="jumpToIssue(issue.fragmentId)">
              {{ t('dramaScript.jumpToFragment') }}
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 角色统计对话框 -->
    <el-dialog
      v-model="showCharacterStats"
      :title="t('dramaScript.characterStatsTitle')"
      width="700px"
      destroy-on-close
    >
      <div class="character-stats-dialog">
        <div v-if="characterStatsData.length === 0" class="no-stats">
          <el-empty :description="t('dramaScript.noCharacterData')" />
        </div>
        <div v-else class="stats-list">
          <div v-for="stat in characterStatsData" :key="stat.name" class="stat-card">
            <div class="stat-header">
              <span class="stat-name">{{ stat.name }}</span>
              <el-tag type="primary" size="small">{{ stat.appearances }} {{ t('dramaScript.appearances') }}</el-tag>
            </div>
            <div class="stat-details">
              <div class="stat-row">
                <span class="stat-label">{{ t('dramaScript.firstAppearance') }}:</span>
                <span class="stat-value">{{ t('dramaScript.scene') }} {{ stat.firstAppearance }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('dramaScript.lastAppearance') }}:</span>
                <span class="stat-value">{{ t('dramaScript.scene') }} {{ stat.lastAppearance }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('dramaScript.scenesInvolved') }}:</span>
                <span class="stat-value">{{ stat.scenes.join(', ') }}</span>
              </div>
              <div v-if="stat.totalDuration > 0" class="stat-row">
                <span class="stat-label">{{ t('dramaScript.totalDuration') }}:</span>
                <span class="stat-value">{{ formatVideoDuration(stat.totalDuration) }}</span>
              </div>
            </div>
            <div class="stat-bar">
              <div 
                class="stat-bar-fill" 
                :style="{ width: `${(stat.appearances / Math.max(...characterStatsData.map((s: { appearances: number }) => s.appearances))) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 导出预览对话框 -->
    <el-dialog
      v-model="showExportPreview"
      :title="t('dramaScript.exportPreviewTitle')"
      width="900px"
      destroy-on-close
    >
      <div class="export-preview-dialog">
        <div class="preview-tabs">
          <el-radio-group v-model="exportPreviewFormat" size="small" @change="generateExportPreview(exportPreviewFormat)">
            <el-radio-button value="markdown">Markdown</el-radio-button>
            <el-radio-button value="txt">{{ t('dramaScript.plainText') }}</el-radio-button>
            <el-radio-button value="html">HTML</el-radio-button>
          </el-radio-group>
        </div>
        <div class="preview-content">
          <pre v-if="exportPreviewFormat !== 'html'">{{ exportPreviewContent }}</pre>
          <iframe 
            v-else
            :srcdoc="exportPreviewContent"
            class="html-preview-frame"
          ></iframe>
        </div>
      </div>
      <template #footer>
        <el-button @click="copyExportPreview">
          <el-icon><Copy /></el-icon>
          {{ t('dramaScript.copyToClipboard') }}
        </el-button>
        <el-button type="primary" @click="downloadExportPreview">
          <el-icon><Download /></el-icon>
          {{ t('dramaScript.download') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 快速预览弹窗 -->
    <el-dialog
      v-model="quickPreviewMode"
      :title="quickPreviewFragment ? `${t('dramaScript.quickPreview')} - ${t('dramaScript.scene')} ${quickPreviewFragment.sequence}` : ''"
      width="800px"
      destroy-on-close
      class="quick-preview-dialog"
      @close="toggleQuickPreview()"
    >
      <div v-if="quickPreviewFragment" class="quick-preview-content">
        <div class="preview-info">
          <div class="info-row">
            <span class="label">{{ t('dramaScript.character') }}:</span>
            <span class="value">{{ quickPreviewFragment.character || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('dramaScript.scene') }}:</span>
            <span class="value">{{ quickPreviewFragment.scene || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('dramaScript.description') }}:</span>
            <span class="value">{{ quickPreviewFragment.description || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('dramaScript.status') }}:</span>
            <el-tag 
              :type="quickPreviewFragment.status === 'completed' ? 'success' : 
                     quickPreviewFragment.status === 'generating' ? 'warning' : 
                     quickPreviewFragment.status === 'failed' ? 'danger' : 'info'"
              size="small"
            >
              {{ getStatusLabel(quickPreviewFragment.status) }}
            </el-tag>
          </div>
        </div>
        
        <div class="preview-media">
          <!-- 视频预览 -->
          <div v-if="quickPreviewFragment.videoUrl" class="video-preview">
            <video
              :src="quickPreviewFragment.videoUrl"
              controls
              preload="none"
              class="preview-video"
            ></video>
          </div>
          
          <!-- 首帧图片 -->
          <div v-else-if="quickPreviewFragment.characterAppearance?.imageUrl" class="image-preview">
            <el-image 
              :src="quickPreviewFragment.characterAppearance.imageUrl"
              fit="contain"
              class="preview-image"
            />
          </div>
          
          <!-- 无媒体 -->
          <div v-else class="no-media">
            <el-empty :description="t('dramaScript.noMediaYet')" />
          </div>
        </div>
        
        <div class="preview-prompts">
          <div class="prompt-section">
            <h4>{{ t('dramaScript.firstFramePrompt') }}</h4>
            <p>{{ quickPreviewFragment.firstFramePrompt || '-' }}</p>
          </div>
          <div class="prompt-section">
            <h4>{{ t('dramaScript.videoPrompt') }}</h4>
            <p>{{ quickPreviewFragment.videoPrompt || '-' }}</p>
          </div>
        </div>
        
        <div class="preview-nav">
          <el-button 
            @click="navigateQuickPreview('prev')"
            :disabled="filteredFragments.findIndex((f: SceneFragment) => f.id === quickPreviewFragment?.id) === 0"
          >
            <el-icon><ArrowLeft /></el-icon>
            {{ t('dramaScript.prevFragment') }}
          </el-button>
          <span class="nav-index">
            {{ filteredFragments.findIndex((f: SceneFragment) => f.id === quickPreviewFragment?.id) + 1 }} / {{ filteredFragments.length }}
          </span>
          <el-button 
            @click="navigateQuickPreview('next')"
            :disabled="filteredFragments.findIndex((f: SceneFragment) => f.id === quickPreviewFragment?.id) === filteredFragments.length - 1"
          >
            {{ t('dramaScript.nextFragment') }}
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 评论抽屉 -->
    <el-drawer
      v-model="showComments"
      :title="t('dramaScript.comments')"
      direction="rtl"
      size="400px"
    >
      <div class="comments-panel">
        <!-- 添加评论 -->
        <div class="comment-input">
          <el-input
            v-model="newCommentText"
            type="textarea"
            :rows="3"
            :placeholder="t('dramaScript.enterComment')"
          />
          <el-button type="primary" @click="submitComment" :disabled="!newCommentText.trim()">
            {{ t('dramaScript.addComment') }}
          </el-button>
        </div>
        
        <!-- 评论列表 -->
        <div class="comment-list">
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-user">{{ comment.userName }}</span>
              <span class="comment-time">{{ new Date(comment.createdAt).toLocaleString() }}</span>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
            <div class="comment-actions">
              <el-button
                v-if="!comment.resolved"
                size="small"
                type="success"
                @click="handleResolveComment(comment.id)"
              >
                {{ t('dramaScript.resolve') }}
              </el-button>
              <el-tag v-else size="small" type="success">{{ t('dramaScript.resolved') }}</el-tag>
            </div>
          </div>
        </div>
        
        <el-empty v-if="comments.length === 0" :description="t('dramaScript.noComments')" />
      </div>
    </el-drawer>

    <!-- 数据分析仪表板抽屉 -->
    <el-drawer
      v-model="showAnalyticsDashboard"
      :title="t('dramaScript.analyticsDashboard')"
      direction="rtl"
      size="800px"
    >
      <div class="analytics-dashboard">
        <div class="analytics-header">
          <el-button type="primary" @click="refreshAnalytics" size="small">
            <el-icon><Refresh /></el-icon>
            {{ t('dramaScript.refreshAnalytics') }}
          </el-button>
          <el-button @click="exportAnalyticsReport" size="small">
            <el-icon><Download /></el-icon>
            {{ t('dramaScript.exportAnalytics') }}
          </el-button>
        </div>
        
        <el-divider />
        
        <!-- 概览卡片 -->
        <div v-if="analyticsSummary" class="analytics-overview">
          <div class="overview-cards">
            <div class="overview-card">
              <div class="card-value">{{ analyticsSummary.totalFragments }}</div>
              <div class="card-label">{{ t('dramaScript.totalFragments') }}</div>
            </div>
            <div class="overview-card success">
              <div class="card-value">{{ analyticsSummary.completedFragments }}</div>
              <div class="card-label">{{ t('dramaScript.completedFragments') }}</div>
            </div>
            <div class="overview-card danger">
              <div class="card-value">{{ analyticsSummary.failedFragments }}</div>
              <div class="card-label">{{ t('dramaScript.failedFragments') }}</div>
            </div>
            <div class="overview-card info">
              <div class="card-value">{{ Math.round(analyticsSummary.successRate) }}%</div>
              <div class="card-label">{{ t('dramaScript.successRate') }}</div>
            </div>
          </div>
        </div>
        
        <!-- 质量分析 -->
        <div v-if="analyticsSummary" class="analytics-section">
          <h4>{{ t('dramaScript.qualityAnalysis') }}</h4>
          <div class="quality-stats">
            <div class="stat-item">
              <span class="stat-label">{{ t('dramaScript.averageQuality') }}：</span>
              <el-tag :type="analyticsSummary.averageQualityScore >= 80 ? 'success' : analyticsSummary.averageQualityScore >= 60 ? 'warning' : 'danger'">
                {{ analyticsSummary.averageQualityScore }}/100
              </el-tag>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('dramaScript.qualityRange') }}：</span>
              <span>{{ analyticsSummary.minQualityScore }} - {{ analyticsSummary.maxQualityScore }}</span>
            </div>
          </div>
          
          <!-- 质量分布 -->
          <div class="quality-distribution">
            <div class="distribution-item excellent">
              <span class="dist-label">{{ t('dramaScript.qualityExcellent') }} (90-100)</span>
              <span class="dist-value">{{ analyticsSummary.qualityDistribution.excellent }}</span>
            </div>
            <div class="distribution-item good">
              <span class="dist-label">{{ t('dramaScript.qualityGood') }} (70-89)</span>
              <span class="dist-value">{{ analyticsSummary.qualityDistribution.good }}</span>
            </div>
            <div class="distribution-item average">
              <span class="dist-label">{{ t('dramaScript.qualityAverage') }} (50-69)</span>
              <span class="dist-value">{{ analyticsSummary.qualityDistribution.average }}</span>
            </div>
            <div class="distribution-item poor">
              <span class="dist-label">{{ t('dramaScript.qualityPoor') }} (0-49)</span>
              <span class="dist-value">{{ analyticsSummary.qualityDistribution.poor }}</span>
            </div>
          </div>
        </div>
        
        <!-- 质量细分 -->
        <div v-if="qualityBreakdown" class="analytics-section">
          <h4>{{ t('dramaScript.qualityBreakdown') }}</h4>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">{{ t('dramaScript.clarity') }}</span>
              <div class="breakdown-value">
                {{ qualityBreakdown.clarity.average }}/100
                <el-icon :class="qualityBreakdown.clarity.trend">
                  <template v-if="qualityBreakdown.clarity.trend === 'up'">📈</template>
                  <template v-else-if="qualityBreakdown.clarity.trend === 'down'">📉</template>
                  <template v-else>➡️</template>
                </el-icon>
              </div>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">{{ t('dramaScript.colorSaturation') }}</span>
              <div class="breakdown-value">
                {{ qualityBreakdown.colorSaturation.average }}/100
                <el-icon :class="qualityBreakdown.colorSaturation.trend">
                  <template v-if="qualityBreakdown.colorSaturation.trend === 'up'">📈</template>
                  <template v-else-if="qualityBreakdown.colorSaturation.trend === 'down'">📉</template>
                  <template v-else>➡️</template>
                </el-icon>
              </div>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">{{ t('dramaScript.motionSmoothness') }}</span>
              <div class="breakdown-value">
                {{ qualityBreakdown.motionSmoothness.average }}/100
                <el-icon :class="qualityBreakdown.motionSmoothness.trend">
                  <template v-if="qualityBreakdown.motionSmoothness.trend === 'up'">📈</template>
                  <template v-else-if="qualityBreakdown.motionSmoothness.trend === 'down'">📉</template>
                  <template v-else>➡️</template>
                </el-icon>
              </div>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">{{ t('dramaScript.characterConsistency') }}</span>
              <div class="breakdown-value">
                {{ qualityBreakdown.characterConsistency.average }}/100
                <el-icon :class="qualityBreakdown.characterConsistency.trend">
                  <template v-if="qualityBreakdown.characterConsistency.trend === 'up'">📈</template>
                  <template v-else-if="qualityBreakdown.characterConsistency.trend === 'down'">📉</template>
                  <template v-else>➡️</template>
                </el-icon>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 效率指标 -->
        <div v-if="efficiencyMetrics" class="analytics-section">
          <h4>{{ t('dramaScript.efficiencyMetrics') }}</h4>
          <div class="efficiency-grid">
            <div class="efficiency-item">
              <span class="efficiency-label">{{ t('dramaScript.fragmentsPerHour') }}</span>
              <span class="efficiency-value">{{ efficiencyMetrics.fragmentsPerHour }} {{ t('dramaScript.fragments') }}</span>
            </div>
            <div class="efficiency-item">
              <span class="efficiency-label">{{ t('dramaScript.firstAttemptSuccess') }}</span>
              <span class="efficiency-value">{{ Math.round(efficiencyMetrics.firstAttemptSuccessRate) }}%</span>
            </div>
            <div class="efficiency-item">
              <span class="efficiency-label">{{ t('dramaScript.retryEfficiency') }}</span>
              <span class="efficiency-value">{{ Math.round(efficiencyMetrics.retryEfficiency) }}%</span>
            </div>
            <div class="efficiency-item">
              <span class="efficiency-label">{{ t('dramaScript.avgPromptLength') }}</span>
              <span class="efficiency-value">{{ efficiencyMetrics.averagePromptLength }} {{ t('dramaScript.characters') }}</span>
            </div>
          </div>
        </div>
        
        <!-- 成本估算 -->
        <div v-if="analyticsSummary" class="analytics-section">
          <h4>{{ t('dramaScript.costEstimate') }}</h4>
          <div class="cost-grid">
            <div class="cost-item">
              <span class="cost-label">{{ t('dramaScript.videoGenerations') }}</span>
              <span class="cost-value">{{ analyticsSummary.estimatedCost.videoGenerations }}</span>
            </div>
            <div class="cost-item">
              <span class="cost-label">{{ t('dramaScript.imageGenerations') }}</span>
              <span class="cost-value">{{ analyticsSummary.estimatedCost.imageGenerations }}</span>
            </div>
            <div class="cost-item">
              <span class="cost-label">{{ t('dramaScript.totalTokens') }}</span>
              <span class="cost-value">{{ analyticsSummary.estimatedCost.totalTokens.toLocaleString() }}</span>
            </div>
            <div class="cost-item highlight">
              <span class="cost-label">{{ t('dramaScript.estimatedCost') }}</span>
              <span class="cost-value">
                ¥{{ analyticsSummary.estimatedCost.estimatedCostCNY }}
                <span class="cost-usd">(~${{ analyticsSummary.estimatedCost.estimatedCostUSD }})</span>
              </span>
            </div>
          </div>
        </div>
        
        <!-- 角色统计 -->
        <div v-if="analyticsSummary && analyticsSummary.characterStats.length > 0" class="analytics-section">
          <h4>{{ t('dramaScript.characterStats') }}</h4>
          <div class="character-stats-table">
            <div class="stats-table-header">
              <span>{{ t('dramaScript.characterName') }}</span>
              <span>{{ t('dramaScript.fragmentCount') }}</span>
              <span>{{ t('dramaScript.avgQuality') }}</span>
              <span>{{ t('dramaScript.totalDuration') }}</span>
            </div>
            <div 
              v-for="stat in analyticsSummary.characterStats.slice(0, 5)" 
              :key="stat.character" 
              class="stats-table-row"
            >
              <span>{{ stat.character }}</span>
              <span>{{ stat.fragmentCount }}</span>
              <span>
                <el-tag size="small" :type="stat.averageQuality >= 80 ? 'success' : stat.averageQuality >= 60 ? 'warning' : 'danger'">
                  {{ stat.averageQuality }}
                </el-tag>
              </span>
              <span>{{ stat.totalDuration.toFixed(1) }}s</span>
            </div>
          </div>
        </div>
        
        <!-- 时间趋势 -->
        <div v-if="analyticsSummary && analyticsSummary.timeTrend.length > 0" class="analytics-section">
          <h4>{{ t('dramaScript.timeTrend') }}</h4>
          <div class="time-trend-table">
            <div class="trend-table-header">
              <span>{{ t('dramaScript.date') }}</span>
              <span>{{ t('dramaScript.created') }}</span>
              <span>{{ t('dramaScript.completed') }}</span>
              <span>{{ t('dramaScript.avgQuality') }}</span>
            </div>
            <div 
              v-for="trend in analyticsSummary.timeTrend.slice(-7)" 
              :key="trend.date" 
              class="trend-table-row"
            >
              <span>{{ trend.date }}</span>
              <span>{{ trend.fragmentsCreated }}</span>
              <span>{{ trend.fragmentsCompleted }}</span>
              <span>
                <el-tag size="small" :type="trend.averageQuality >= 80 ? 'success' : trend.averageQuality >= 60 ? 'warning' : 'info'">
                  {{ trend.averageQuality || '-' }}
                </el-tag>
              </span>
            </div>
          </div>
        </div>
        
        <el-empty 
          v-if="!analyticsSummary" 
          :description="t('dramaScript.noAnalyticsData')"
        />
      </div>
    </el-drawer>

    <!-- 模板管理器抽屉 -->
    <el-drawer
      v-model="showTemplateManager"
      :title="t('dramaScript.templateManager')"
      direction="rtl"
      size="500px"
    >
      <div class="template-manager">
        <div class="template-actions">
          <el-button type="primary" @click="saveAsTemplate">
            <el-icon><Plus /></el-icon>
            {{ t('dramaScript.saveAsTemplate') }}
          </el-button>
        </div>
        
        <el-divider />
        
        <div class="template-list">
          <div v-if="templates.length === 0" class="empty-templates">
            <el-empty :description="t('dramaScript.noTemplates')" />
          </div>
          <div v-else class="template-items">
            <div
              v-for="template in templates"
              :key="template.id"
              class="template-item"
            >
              <div class="template-info">
                <div class="template-name">{{ template.name }}</div>
                <div class="template-meta">
                  <el-text size="small" type="info">
                    {{ template.fragmentCount }} {{ t('dramaScript.fragments') }} · 
                    {{ formatTime(template.createdAt) }}
                  </el-text>
                </div>
                <div class="template-description" v-if="template.description">
                  {{ template.description }}
                </div>
              </div>
              <div class="template-actions-item">
                <el-button link size="small" @click="loadTemplate(template)">
                  <el-icon><Download /></el-icon>
                  {{ t('dramaScript.loadTemplate') }}
                </el-button>
                <el-button link size="small" type="danger" @click="deleteTemplate(template.id)">
                  <el-icon><Delete /></el-icon>
                  {{ t('common.delete') }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Delete,
  User,
  Download,
  Upload,
  VideoPlay,
  Close,
  Minus,
  FullScreen,
  MagicStick as Sparkles,
  Refresh,
  Picture as Image,
  CopyDocument as Copy,
  Rank,
  Edit,
  Microphone as _Microphone,
  Document,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Loading,
  CircleCheck,
  CircleClose,
  WarningFilled,
} from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useDarkModeStore } from '@/stores/darkMode'
import { createDashScopeVideoWebSocket } from '@/api/services/aiGeneration.service'
import request from '@/utils/request'
import { getAvailableModels } from '@/api/models'
import { streamGenerateContent } from '@/api/ai'
import { getUserUuid } from '@/utils/auth'
import { uploadFormFile } from '@/api/file-upload'
import { logger } from '@/utils/logger'
import { useDramaScriptEnhancement } from '@/composables/useDramaScriptEnhancement'
import CharacterManager from './DramaScriptExcel.CharacterManager.vue'
import ExcelJS from 'exceljs'
import { formatTime } from '@/utils/format'
import {
  analyzeFailure,
  analyzeVideoQuality,
  shouldRetry,
  calculateRetryDelay,
  createRetryRecord,
  updateFragmentRetryInfo,
  getDefaultRetryStrategy as _getDefaultRetryStrategy,
} from './DramaScriptExcel.QualitySystem'
import {
  BatchProcessor,
  executeWorkflow,
  getWorkflowTemplates,
  recommendNextScenes,
  detectConflicts,
  analyzeCharacterRelations,
  analyzePacing,
  type Workflow,
  type WorkflowStep,
  type WorkflowResult as _WorkflowResult,
} from './DramaScriptExcel.WorkflowEngine'
import type {
  SceneFragment,
  Character,
  CharacterAppearance as _CharacterAppearance,
  Voice as _Voice,
  FailureReason,
} from './DramaScriptExcel.types'
import {
  generateAnalyticsSummary,
  calculateEfficiencyMetrics,
  calculateQualityBreakdown,
  getIssuesSummary as _getIssuesSummary,
  generateChartData,
  type AnalyticsSummary,
  type EfficiencyMetrics,
  type QualityBreakdown,
} from './DramaScriptExcel.Analytics'
import {
  VideoPreviewController,
  extractFrameAtTime as _extractFrameAtTime,
  extractMultipleFrames,
  getVideoDuration as _getVideoDuration,
  getVideoMetadata as _getVideoMetadata,
  getTransitionPresets,
  getTransitionName,
  type VideoFrame,
  type TransitionEffect,
} from './DramaScriptExcel.VideoPreview'
import {
  generatePlotSuggestions,
  generateDialogue as _generateDialogue,
  analyzeEmotions,
  analyzeStoryArc,
  analyzeCharacterArcs as analyzeCharacterArcsAI,
  generateSceneAtmosphere as _generateSceneAtmosphere,
  generateContinuation,
  type PlotSuggestion,
  type DialogueSuggestion as _DialogueSuggestion,
  type EmotionAnalysis,
  type StoryArc,
  type CharacterArc,
} from './DramaScriptExcel.AICreation'
import {
  generateSubtitles,
  getSubtitleStylePresets,
  getSFXPresets,
  getBGMPresets,
  getExportPresets,
  exportSRT,
  exportASS,
  type Subtitle,
  type SubtitleStyle as _SubtitleStyle,
  type AudioTrack,
  type ExportSettings,
} from './DramaScriptExcel.VideoProcessing'
import {
  createVersion,
  getVersions,
  getVersionById as _getVersionById,
  restoreVersion,
  deleteVersion,
  compareVersions,
  recordChange,
  getChanges as _getChanges,
  addComment,
  getComments,
  resolveComment,
  getFragmentCommentCount as _getFragmentCommentCount,
  startAutoSave as _startAutoSave,
  stopAutoSave as _stopAutoSave,
  type Version,
  type ChangeRecord as _ChangeRecord,
  type Comment as CollabComment,
} from './DramaScriptExcel.Collaboration'
import {
  ShortcutManager,
  HistoryManager,
  parseScriptToScenes,
  createFragmentsFromScenes,
  getExportFormats,
  exportToMarkdown,
  exportToHTML,
  debounce as _debounce,
  throttle as _throttle,
  CacheManager as _CacheManager,
  type KeyboardShortcut as _KeyboardShortcut,
  type HistoryState as _HistoryState,
  type SceneBreakdown,
  type ExportFormat,
} from './DramaScriptExcel.Enhancements'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const isDarkMode = computed(() => darkModeStore.isDarkMode.value)

// Props
const props = withDefaults(
  defineProps<{
    visible?: boolean
    showToggle?: boolean
  }>(),
  {
    visible: false,
    showToggle: true,
  }
)

// Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

// 状态管理
const isVisible = ref(props.visible)
const isMinimized = ref(false)
const isDragging = ref(false)
const isResizing = ref(false)
const showCharacterManager = ref(false)
const showTemplateManager = ref(false)
const isSaving = ref(false) // 保存状态
const lastSavedTime = ref<Date | null>(null) // 最后保存时间

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuFragment = ref<SceneFragment | null>(null)

// 全屏视频和右键菜单的清理引用（用于 onUnmounted 清理）
let fullscreenWrapper: HTMLDivElement | null = null
let fullscreenEscHandler: ((e: KeyboardEvent) => void) | null = null
let contextMenuCloseHandler: (() => void) | null = null

// 所有活跃的视频生成 WebSocket，用于 onUnmounted 统一关闭
const activeVideoSockets = new Set<WebSocket>()

// 视频生成重试定时器
let videoRetryTimer: ReturnType<typeof setTimeout> | null = null

// 模板数据结构
interface ScriptTemplate {
  id: string
  name: string
  description?: string
  fragmentCount: number
  fragments: SceneFragment[]
  characters: Character[]
  createdAt: string
  updatedAt: string
}

const templates = ref<ScriptTemplate[]>([])

// 对话框位置和大小
const dialogRef = ref<HTMLElement | null>(null)
const headerRef = ref<HTMLElement | null>(null)
const resizeHandleRef = ref<HTMLElement | null>(null)
const excelContainerRef = ref<HTMLElement | null>(null)

const dialogStyle = ref({
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90vw',
  height: '80vh',
  minWidth: '800px',
  minHeight: '500px',
})

// 拖拽相关
let dragStartX = 0
let dragStartY = 0
let initialLeft = 0
let initialTop = 0

// 调整大小相关
let resizeStartX = 0
let resizeStartY = 0
let initialWidth = 0
let initialHeight = 0

// 数据
const fragments = ref<SceneFragment[]>([])
const characters = ref<Character[]>([])
const selectedFragments = ref<string[]>([])
const searchKeyword = ref('')
const filterCharacter = ref<string>('')
const filterStatus = ref<string>('')
const draggedFragment = ref<SceneFragment | null>(null)
const draggedIndex = ref<number>(-1)

const useEnhancedMode = ref<boolean>(true)

// 使用增强composable - 提供队列管理、提示词优化、视频质量分析、剧情助手等功能
const {
  queueStats: _queueStats,
  isQueuePaused: _isQueuePaused,
  addToQueue: _addToQueue,
  pauseQueue: _pauseQueue,
  resumeQueue: _resumeQueue,
  optimizePrompt: _optimizePrompt,
  analyzeVideoQualityEnhanced: _analyzeVideoQualityEnhanced,
  getSceneRecommendations: _getSceneRecommendations,
  analyzeCharacterArcs: _analyzeCharacterArcs,
  registerDramaShortcuts: _registerDramaShortcuts,
  unregisterDramaShortcuts: _unregisterDramaShortcuts,
} = useDramaScriptEnhancement({
  fragments,
  characters,
  enableQueueManagement: true,
  enablePromptOptimization: true,
  enableVideoQualityAnalysis: true,
  enablePlotAdvisor: true,
})

// 重试队列
const retryQueue = ref<SceneFragment[]>([])
const isProcessingRetryQueue = ref(false)

// 重试策略设置
const retryStrategy = ref({
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  optimizePromptOnRetry: true,
  autoRetry: true,  // 是否自动重试
})

// 工作流引擎
const batchProcessor = new BatchProcessor({
  maxConcurrent: 2,  // 最大并发2，避免API限流
  delayBetweenTasks: 2000,  // 任务间延迟2秒
  autoRetryOnFailure: true,
  saveProgress: true,
})

// 工作流模板
const workflowTemplates = ref<Workflow[]>(getWorkflowTemplates())
const selectedWorkflow = ref<Workflow | null>(null)
const showWorkflowManager = ref(false)

// AI辅助剧情建议
const showPlotAdvisor = ref(false)
const plotAdvisorTab = ref('scenes')
const loadingRecommendations = ref(false)
const sceneRecommendations = ref<Array<{
  scene: string
  description: string
  reason: string
  expectedEffect: string
  confidence: number
}>>([])
const detectedConflicts = ref<Array<{
  type: string
  severity: string
  fragmentIds: string[]
  description: string
  suggestion: string
}>>([])
const characterRelations = ref<{
  characters: string[]
  relations: Array<{
    character1: string
    character2: string
    interactionCount: number
    lastInteraction: number
  }>
  characterFrequency: Record<string, number>
} | null>(null)
const pacingAnalysis = ref<{
  overallPacing: string
  fragmentCount: number
  averageSceneLength: number
  pacingIssues: Array<{
    fragmentId: string
    issue: string
    suggestion: string
  }>
} | null>(null)

// 数据分析仪表板
const showAnalyticsDashboard = ref(false)
const analyticsSummary = ref<AnalyticsSummary | null>(null)
const efficiencyMetrics = ref<EfficiencyMetrics | null>(null)
const qualityBreakdown = ref<QualityBreakdown | null>(null)
const chartData = ref<{
  qualityPieChart: { name: string; value: number }[]
  statusPieChart: { name: string; value: number }[]
  qualityLineChart: { date: string; value: number }[]
  characterBarChart: { name: string; fragments: number; quality: number }[]
  durationHistogram: { range: string; count: number }[]
} | null>(null)

// 视频预览
const showVideoPreview = ref(false)
const previewFragment = ref<SceneFragment | null>(null)
const previewFrames = ref<VideoFrame[]>([])
const previewCurrentTime = ref(0)
const previewIsPlaying = ref(false)
const previewController = ref<VideoPreviewController | null>(null)
const selectedTransition = ref<TransitionEffect>({ type: 'fade', duration: 0.5 })
const transitionPresets = ref<TransitionEffect[]>(getTransitionPresets())

// AI辅助创作
const showAICreation = ref(false)
const plotSuggestions = ref<PlotSuggestion[]>([])
const storyArc = ref<StoryArc | null>(null)
const characterArcs = ref<CharacterArc[]>([])
const emotionAnalyses = ref<EmotionAnalysis[]>([])
const continuationSuggestion = ref<{
  nextScene: string
  nextDescription: string
  suggestedCharacter: string
  reasoning: string
} | null>(null)
const loadingAICreation = ref(false)

// 高级视频处理
const showVideoProcessing = ref(false)
const projectSubtitles = ref<Map<string, Subtitle[]>>(new Map())
const _audioTracks = ref<AudioTrack[]>([])
const exportSettings = ref<ExportSettings>(getExportPresets()[0].settings)
const subtitleStylePresets = ref(getSubtitleStylePresets())
const sfxPresets = ref(getSFXPresets())
const bgmPresets = ref(getBGMPresets())

// 版本管理
const showVersionManager = ref(false)
const versions = ref<Version[]>([])
const _selectedVersionId = ref<string | null>(null)
const versionCompareResult = ref<{
  added: SceneFragment[]
  removed: SceneFragment[]
  modified: Array<{ before: SceneFragment; after: SceneFragment }>
} | null>(null)

// 评论系统
const showComments = ref(false)
const comments = ref<CollabComment[]>([])
const newCommentText = ref('')
const selectedCommentFragment = ref<string | null>(null)

// 增强功能
const shortcutManager = ref<ShortcutManager | null>(null)
const historyManager = ref<HistoryManager>(new HistoryManager())
const showShortcutsDialog = ref(false)
const showScriptImport = ref(false)
const scriptImportText = ref('')
const parsedScenes = ref<SceneBreakdown[]>([])
const parsingScript = ref(false)
const exportFormats = ref<ExportFormat[]>(getExportFormats())
const showExportDialog = ref(false)
const selectedExportFormat = ref<string>('json')
const clipboardData = ref<SceneFragment[] | null>(null)

// 虚拟滚动
const virtualScrollEnabled = ref(true)
const visibleRowCount = ref(20)
const scrollTop = ref(0)
const rowHeight = 120 // 每行高度（像素）
const containerHeight = ref(600)

// 自动保存状态指示
const autoSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const lastSaveTime = ref<Date | null>(null)
const autoSaveTimer = ref<number | null>(null)

// 搜索高亮
const highlightedFragmentId = ref<string | null>(null)
const searchResultIndex = ref(0)
const _searchResults = ref<string[]>([])

// 网络状态
const isOnline = ref(navigator.onLine)
const pendingOfflineChanges = ref<SceneFragment[]>([])

// 快速预览模式
const quickPreviewMode = ref(false)
const quickPreviewFragment = ref<SceneFragment | null>(null)

// 批量状态更新
const showBatchStatusDialog = ref(false)
const batchStatusTarget = ref<'pending' | 'generating' | 'completed' | 'failed'>('pending')

// 连续性检查
const showContinuityCheck = ref(false)
const continuityIssues = ref<Array<{
  type: 'character' | 'scene' | 'timeline' | 'logic'
  severity: 'warning' | 'error'
  fragmentId: string
  description: string
  suggestion: string
}>>([])

// 角色统计
const showCharacterStats = ref(false)
const characterStatsData = ref<Array<{
  name: string
  appearances: number
  firstAppearance: number
  lastAppearance: number
  scenes: string[]
  totalDuration: number
}>>([])

// 导出预览
const showExportPreview = ref(false)
const exportPreviewContent = ref('')
const exportPreviewFormat = ref<'markdown' | 'txt' | 'html'>('markdown')

// 快捷操作
const _showQuickActions = ref(false)

// 片段模板
const showFragmentTemplateDialog = ref(false)
const _fragmentTemplates = ref<Array<{
  id: string
  name: string
  description: string
  template: Partial<SceneFragment>
}>>([
  {
    id: 'dialogue',
    name: t('dramaScript.templateDialogueName'),
    description: t('dramaScript.templateDialogueDesc'),
    template: {
      scene: t('dramaScript.templateDialogueScene'),
      description: t('dramaScript.templateDialogueDescription'),
      videoPrompt: t('dramaScript.templateDialogueVideoPrompt')
    }
  },
  {
    id: 'action',
    name: t('dramaScript.templateActionName'),
    description: t('dramaScript.templateActionDesc'),
    template: {
      scene: t('dramaScript.templateActionScene'),
      description: t('dramaScript.templateActionDescription'),
      videoPrompt: t('dramaScript.templateActionVideoPrompt')
    }
  },
  {
    id: 'emotion',
    name: t('dramaScript.templateEmotionName'),
    description: t('dramaScript.templateEmotionDesc'),
    template: {
      scene: t('dramaScript.templateEmotionScene'),
      description: t('dramaScript.templateEmotionDescription'),
      videoPrompt: t('dramaScript.templateEmotionVideoPrompt')
    }
  },
  {
    id: 'transition',
    name: t('dramaScript.templateTransitionName'),
    description: t('dramaScript.templateTransitionDesc'),
    template: {
      scene: t('drama.sceneTransition'),
      description: t('dramaScript.templateTransitionDescription'),
      videoPrompt: t('dramaScript.templateTransitionVideoPrompt')
    }
  }
])

// 批量编辑
const showBatchEditDialog = ref(false)
const batchEditFields = ref<{
  character?: string
  scene?: string
  status?: 'pending' | 'generating' | 'completed' | 'failed'
}>({})

// 数据验证提示
const validationTips = ref<Map<string, string>>(new Map())

// 快捷键提示浮窗
const showShortcutHint = ref(false)
const shortcutHintText = ref('')
const shortcutHintTimer = ref<number | null>(null)

// 计算属性
const allSelected = computed(() => {
  return filteredFragments.value.length > 0 && 
         selectedFragments.value.length === filteredFragments.value.length &&
         selectedFragments.value.every(id => filteredFragments.value.some(f => f.id === id))
})

// 唯一人物列表
const uniqueCharacters = computed(() => {
  const chars = new Set<string>()
  fragments.value.forEach(f => {
    if (f.character) chars.add(f.character)
  })
  return Array.from(chars).sort()
})

// 过滤后的片段
const filteredFragments = computed(() => {
  let result = [...fragments.value]
  
  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(f => 
      f.character?.toLowerCase().includes(keyword) ||
      f.scene?.toLowerCase().includes(keyword) ||
      f.description?.toLowerCase().includes(keyword) ||
      f.firstFramePrompt?.toLowerCase().includes(keyword) ||
      f.videoPrompt?.toLowerCase().includes(keyword)
    )
  }
  
  // 人物过滤
  if (filterCharacter.value) {
    result = result.filter(f => f.character === filterCharacter.value)
  }
  
  // 状态过滤
  if (filterStatus.value) {
    result = result.filter(f => f.status === filterStatus.value)
  }
  
  return result
})

// 统计信息
const completedCount = computed(() => 
  fragments.value.filter(f => f.status === 'completed').length
)
const generatingCount = computed(() => 
  fragments.value.filter(f => f.status === 'generating').length
)
const pendingCount = computed(() => 
  fragments.value.filter(f => f.status === 'pending').length
)

// 虚拟滚动计算属性
const _virtualScrollData = computed(() => {
  if (!virtualScrollEnabled.value || filteredFragments.value.length < 50) {
    return {
      enabled: false,
      items: filteredFragments.value,
      startIndex: 0,
      endIndex: filteredFragments.value.length,
      totalHeight: 0,
      offsetY: 0,
    }
  }
  
  const totalItems = filteredFragments.value.length
  const totalHeight = totalItems * rowHeight
  const startIndex = Math.floor(scrollTop.value / rowHeight)
  const endIndex = Math.min(startIndex + visibleRowCount.value + 2, totalItems)
  const offsetY = startIndex * rowHeight
  
  return {
    enabled: true,
    items: filteredFragments.value.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
  }
})

// 搜索结果相关
const searchMatchFragments = computed(() => {
  if (!searchKeyword.value) return []
  const keyword = searchKeyword.value.toLowerCase()
  return filteredFragments.value.filter(f => 
    f.character?.toLowerCase().includes(keyword) ||
    f.scene?.toLowerCase().includes(keyword) ||
    f.description?.toLowerCase().includes(keyword) ||
    f.firstFramePrompt?.toLowerCase().includes(keyword) ||
    f.videoPrompt?.toLowerCase().includes(keyword)
  ).map(f => f.id)
})

// 自动保存状态文本
const autoSaveStatusText = computed(() => {
  switch (autoSaveStatus.value) {
    case 'saving': return t('dramaScript.autoSaving')
    case 'saved': 
      if (lastSaveTime.value) {
        const seconds = Math.floor((Date.now() - lastSaveTime.value.getTime()) / 1000)
        if (seconds < 60) return t('dramaScript.savedJustNow')
        const minutes = Math.floor(seconds / 60)
        return t('dramaScript.savedMinutesAgo', { minutes })
      }
      return t('dramaScript.saved')
    case 'error': return t('dramaScript.saveError')
    default: return ''
  }
})

// 方法
const openDialog = async () => {
  isVisible.value = true
  isMinimized.value = false
  await loadData()
}

const closeDialog = () => {
  isVisible.value = false
  emit('update:visible', false)
  emit('close')
  saveData()
}

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value
}

const startDrag = (e: MouseEvent) => {
  if (!dialogRef.value) return
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  
  const rect = dialogRef.value.getBoundingClientRect()
  initialLeft = rect.left
  initialTop = rect.top
  
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

// mousemove 节流 rAF ID（handleDrag 和 handleResize 共用）
let dialogDragRafId: number | null = null

const handleDrag = (e: MouseEvent) => {
  if (dialogDragRafId !== null) return
  // rAF 是异步的，先把 clientX/clientY 存起来
  const clientX = e.clientX
  const clientY = e.clientY
  dialogDragRafId = requestAnimationFrame(() => {
    dialogDragRafId = null
    if (!isDragging.value) return

    const deltaX = clientX - dragStartX
    const deltaY = clientY - dragStartY

    dialogStyle.value.left = `${initialLeft + deltaX}px`
    dialogStyle.value.top = `${initialTop + deltaY}px`
    dialogStyle.value.transform = 'none'
  })
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const startResize = (e: MouseEvent) => {
  if (!dialogRef.value) return
  isResizing.value = true
  resizeStartX = e.clientX
  resizeStartY = e.clientY
  
  const rect = dialogRef.value.getBoundingClientRect()
  initialWidth = rect.width
  initialHeight = rect.height
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const handleResize = (e: MouseEvent) => {
  if (dialogDragRafId !== null) return
  // rAF 是异步的，先把 clientX/clientY 存起来
  const clientX = e.clientX
  const clientY = e.clientY
  dialogDragRafId = requestAnimationFrame(() => {
    dialogDragRafId = null
    if (!isResizing.value) return

    const deltaX = clientX - resizeStartX
    const deltaY = clientY - resizeStartY

    dialogStyle.value.width = `${Math.max(800, initialWidth + deltaX)}px`
    dialogStyle.value.height = `${Math.max(500, initialHeight + deltaY)}px`
  })
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// 片段管理
const addFragment = (): SceneFragment => {
  const newFragment: SceneFragment = {
    id: `fragment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sequence: fragments.value.length + 1,
    character: '',
    scene: '',
    description: '',
    firstFramePrompt: '',
    videoPrompt: '',
    characterAppearance: {
      description: '',
    },
    voice: {
      description: '',
    },
    usePreviousLastFrame: false,
    status: 'pending',
    progress: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  fragments.value.push(newFragment)
  saveData()
  
  // 自动滚动到新添加的行并聚焦到描述字段
  nextTick(() => {
    const rowElement = excelContainerRef.value?.querySelector(`[data-fragment-id="${newFragment.id}"]`)
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 尝试聚焦到描述输入框，方便用户直接输入
      const descriptionInput = rowElement.querySelector('.col-description textarea') as HTMLTextAreaElement
      if (descriptionInput) {
        setTimeout(() => {
          descriptionInput.focus()
        }, 300)
      }
    }
  })
  
  ElMessage.success(t('dramaScript.fragmentAdded'))
  
  return newFragment
}

const deleteFragment = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      t('dramaScript.confirmDelete'),
      t('common.confirm'),
      {
        type: 'warning',
      }
    )
    const index = fragments.value.findIndex(f => f.id === id)
    if (index > -1) {
      fragments.value.splice(index, 1)
      // 重新排序
      fragments.value.forEach((f, i) => {
        f.sequence = i + 1
      })
      saveData()
    }
  } catch (error) {
    // 用户取消删除操作
    logger.debug('User cancelled fragment deletion:', { fragmentId: id, error })
  }
}

const duplicateFragment = (fragment: SceneFragment) => {
  const newFragment: SceneFragment = {
    ...JSON.parse(JSON.stringify(fragment)),
    id: `fragment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sequence: fragments.value.length + 1,
    videoUrl: undefined,
    videoDuration: undefined,
    lastFrameImage: undefined,
    progress: undefined,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  fragments.value.push(newFragment)
  saveData()
  
  ElMessage.success(t('dramaScript.duplicateSuccess', { count: 1 }))
  
  // 自动滚动到新复制的行
  nextTick(() => {
    const rowElement = excelContainerRef.value?.querySelector(`[data-fragment-id="${newFragment.id}"]`)
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

// 批量生成提示词（使用工作流引擎优化）
const batchGeneratePrompts = async () => {
  if (selectedFragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.selectFragmentsFirst'))
    return
  }
  
  const selected = fragments.value.filter(f => selectedFragments.value.includes(f.id))
  const validFragments = selected.filter(f => f.character && f.scene && f.description)
  
  if (validFragments.length === 0) {
    ElMessage.warning(t('dramaScript.fillRequiredFields'))
    return
  }
  
  try {
    ElMessage.info(t('dramaScript.batchGeneratingPrompts', { count: validFragments.length }))
    
    // 使用工作流引擎处理
    batchProcessor.clearQueue()
    batchProcessor.addTasks(validFragments, 'generate-prompt', 0)
    
    // 创建进度提示
    let progressMessage: ReturnType<typeof ElMessage> | null = null
    let _completedCount = 0
    
    await batchProcessor.processQueue(
      {
        generatePrompt: async (fragment: SceneFragment, enhanced?: boolean) => {
          try {
            // 生成首帧提示词
            if (!fragment.firstFramePrompt) {
              await generateFirstFramePrompt(fragment)
            }
            // 生成视频提示词
            if (!fragment.videoPrompt) {
              await generateVideoPrompt(fragment, enhanced ?? useEnhancedMode.value)
            }
          } catch (error) {
            logger.error(`Failed to generate prompt for fragment ${fragment.sequence}:`, error)
            throw error
          }
        },
      },
      (completed, total) => {
        _completedCount = completed
        if (progressMessage) {
          progressMessage.close()
        }
        progressMessage = ElMessage({
          message: t('dramaScript.batchProgress', { completed, total }),
          type: 'info',
          duration: 0,
          showClose: false,
        })
      }
    )
    
    if (progressMessage) {
      progressMessage.close()
    }
    
    saveData()
    ElMessage.success(t('dramaScript.batchGeneratePromptsSuccess', { count: validFragments.length }))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.batchGeneratePromptsFailed'))
  }
}

// 批量生成视频（使用工作流引擎优化）
const batchGenerateVideos = async () => {
  if (selectedFragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.selectFragmentsFirst'))
    return
  }
  
  const selected = fragments.value.filter(f => selectedFragments.value.includes(f.id))
  const validFragments = selected.filter(f => 
    f.character && 
    f.scene && 
    f.description && 
    f.videoPrompt && 
    f.status !== 'generating' &&
    f.status !== 'completed'
  )
  
  if (validFragments.length === 0) {
    ElMessage.warning(t('dramaScript.noValidFragments'))
    return
  }
  
  try {
    await ElMessageBox.confirm(
      t('dramaScript.batchGenerateVideosConfirm', { count: validFragments.length }),
      t('common.confirm'),
      {
        type: 'warning',
      }
    )
    
    ElMessage.info(t('dramaScript.batchGeneratingVideos', { count: validFragments.length }))
    
    // 使用工作流引擎处理（逐个生成，避免并发过多）
    batchProcessor.clearQueue()
    batchProcessor.addTasks(validFragments, 'generate-video', 0)
    
    // 创建进度提示
    let progressMessage: ReturnType<typeof ElMessage> | null = null
    let _completedCount = 0
    
    await batchProcessor.processQueue(
      {
        generateVideo: async (fragment: SceneFragment) => {
          await generateVideo(fragment)
          // 等待视频生成完成（通过检查状态）
          let waitCount = 0
          while (fragment.status === 'generating' && waitCount < 300) {  // 最多等待5分钟
            await new Promise(resolve => setTimeout(resolve, 1000))
            waitCount++
          }
        },
      },
      (completed, total) => {
        _completedCount = completed
        if (progressMessage) {
          progressMessage.close()
        }
        progressMessage = ElMessage({
          message: t('dramaScript.batchVideoProgress', { completed, total }),
          type: 'info',
          duration: 0,
          showClose: false,
        })
      }
    )
    
    if (progressMessage) {
      progressMessage.close()
    }
    
    saveData()
    ElMessage.success(t('dramaScript.batchGenerateVideosSuccess', { count: validFragments.length }))
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error(t('common.errors.operationFailed'), error)
      ElMessage.error(t('dramaScript.batchGenerateVideosFailed'))
    }
  }
}

// 拖拽排序
const handleDragStart = (e: DragEvent, fragment: SceneFragment, index: number) => {
  draggedFragment.value = fragment
  draggedIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
  }
  const target = e.target as HTMLElement
  if (target) {
    target.style.opacity = '0.5'
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

const handleDrop = (e: DragEvent, targetFragment: SceneFragment, _targetIndex: number) => {
  e.preventDefault()
  
  if (!draggedFragment.value || draggedIndex.value === -1) return
  
  const sourceIndex = fragments.value.findIndex(f => f.id === draggedFragment.value!.id)
  const targetIdx = fragments.value.findIndex(f => f.id === targetFragment.id)
  
  if (sourceIndex === -1 || targetIdx === -1 || sourceIndex === targetIdx) return
  
  // 移动片段
  const [moved] = fragments.value.splice(sourceIndex, 1)
  fragments.value.splice(targetIdx, 0, moved)
  
  // 重新排序序号
  fragments.value.forEach((f, i) => {
    f.sequence = i + 1
  })
  
  saveData()
  ElMessage.success(t('dramaScript.reorderSuccess'))
}

const handleDragEnd = (e: DragEvent) => {
  const target = e.target as HTMLElement
  if (target) {
    target.style.opacity = '1'
  }
  draggedFragment.value = null
  draggedIndex.value = -1
}

// 右键菜单
const showContextMenu = (e: MouseEvent, fragment: SceneFragment) => {
  e.preventDefault()
  // 如果已有菜单打开，先清理旧的监听器
  if (contextMenuCloseHandler) {
    document.removeEventListener('click', contextMenuCloseHandler)
    document.removeEventListener('contextmenu', contextMenuCloseHandler)
    contextMenuCloseHandler = null
  }
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuFragment.value = fragment
  contextMenuVisible.value = true

  // 点击其他地方关闭菜单
  const closeMenu = () => {
    contextMenuVisible.value = false
    document.removeEventListener('click', closeMenu)
    document.removeEventListener('contextmenu', closeMenu)
    contextMenuCloseHandler = null
  }
  contextMenuCloseHandler = closeMenu

  setTimeout(() => {
    document.addEventListener('click', closeMenu)
    document.addEventListener('contextmenu', closeMenu)
  }, 100)
}

const _handleContextMenuAction = async (action: string) => {
  if (!contextMenuFragment.value) return
  
  const fragment = contextMenuFragment.value
  contextMenuVisible.value = false
  
  try {
    switch (action) {
      case 'duplicate':
        duplicateFragment(fragment)
        break
      case 'delete':
        await deleteFragment(fragment.id)
        break
      case 'generatePrompt':
        if (fragment.character && fragment.scene && fragment.description) {
          await generateFirstFramePrompt(fragment)
          await generateVideoPrompt(fragment)
        } else {
          ElMessage.warning(t('dramaScript.fillRequiredFields'))
        }
        break
      case 'generateVideo':
        if (canGenerateVideo(fragment)) {
          await generateVideo(fragment)
        } else {
          ElMessage.warning(t('dramaScript.fillRequiredFields'))
        }
        break
      case 'extractFrame':
        if (fragment.videoUrl) {
          await extractLastFrame(fragment)
        } else {
          ElMessage.warning(t('dramaScript.noVideo'))
        }
        break
      case 'downloadVideo':
        if (fragment.videoUrl) {
          downloadVideo(fragment)
        } else {
          ElMessage.warning(t('dramaScript.noVideo'))
        }
        break
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
  }
}

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    // 只选择当前过滤后的片段
    selectedFragments.value = filteredFragments.value.map(f => f.id)
  } else {
    // 只取消选择当前过滤后的片段
    const filteredIds = new Set(filteredFragments.value.map(f => f.id))
    selectedFragments.value = selectedFragments.value.filter(id => !filteredIds.has(id))
  }
}

const toggleSelectFragment = (id: string) => {
  const index = selectedFragments.value.indexOf(id)
  if (index > -1) {
    selectedFragments.value.splice(index, 1)
  } else {
    selectedFragments.value.push(id)
  }
}

// 角色管理
const loadCharacterAppearance = (fragment: SceneFragment) => {
  if (!fragment.character) {
    ElMessage.warning(t('dramaScript.characterRequired'))
    return
  }
  
  // 查找或创建角色
  let character = characters.value.find(c => c.name === fragment.character)
  if (!character) {
    // 创建新角色
    character = {
      id: `character-${Date.now()}`,
      name: fragment.character,
      appearance: {
        description: fragment.characterAppearance.description || '',
        imageUrl: fragment.characterAppearance.imageUrl,
      },
      voice: {
        description: fragment.voice.description || '',
        voiceId: fragment.voice.voiceId,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    characters.value.push(character)
    saveCharacters()
  }
  
  // 加载角色形象（从角色库加载，确保一致性）
  fragment.characterAppearance = {
    characterId: character.id,
    imageUrl: character.appearance.imageUrl || fragment.characterAppearance.imageUrl,
    description: character.appearance.description || fragment.characterAppearance.description,
  }
  
  // 如果角色库有形象但片段没有，使用角色库的
  if (character.appearance.imageUrl && !fragment.characterAppearance.imageUrl) {
    fragment.characterAppearance.imageUrl = character.appearance.imageUrl
  }
  if (character.appearance.description && !fragment.characterAppearance.description) {
    fragment.characterAppearance.description = character.appearance.description
  }
  
  onFragmentChange(fragment)
  ElMessage.success(t('dramaScript.appearanceLoaded'))
}

const loadCharacterVoice = (fragment: SceneFragment) => {
  if (!fragment.character) {
    ElMessage.warning(t('dramaScript.characterRequired'))
    return
  }
  
  // 查找或创建角色
  let character = characters.value.find(c => c.name === fragment.character)
  if (!character) {
    // 创建新角色
    character = {
      id: `character-${Date.now()}`,
      name: fragment.character,
      appearance: {
        description: fragment.characterAppearance.description || '',
        imageUrl: fragment.characterAppearance.imageUrl,
      },
      voice: {
        description: fragment.voice.description || '',
        voiceId: fragment.voice.voiceId,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    characters.value.push(character)
    saveCharacters()
  }
  
  // 加载声音（从角色库加载，确保一致性）
  fragment.voice = {
    characterId: character.id,
    voiceId: character.voice.voiceId || fragment.voice.voiceId,
    description: character.voice.description || fragment.voice.description,
  }
  
  // 如果角色库有声音但片段没有，使用角色库的
  if (character.voice.voiceId && !fragment.voice.voiceId) {
    fragment.voice.voiceId = character.voice.voiceId
  }
  if (character.voice.description && !fragment.voice.description) {
    fragment.voice.description = character.voice.description
  }
  
  onFragmentChange(fragment)
  ElMessage.success(t('dramaScript.voiceLoaded'))
}

const handleCharacterSelect = (_character: Character) => {
  // 当从角色管理器选择角色时，更新当前片段
  // 这个功能可以在后续完善
}

// AI生成提示词
const generateFirstFramePrompt = async (fragment: SceneFragment) => {
  if (!fragment.character || !fragment.scene || !fragment.description) {
    ElMessage.warning(t('dramaScript.fillRequiredFields'))
    return
  }
  
  try {
    const prompt = `${t('dramaScript.promptGenerateFirstFrame')}

${t('dramaScript.character')}：${fragment.character}
${t('dramaScript.scene')}：${fragment.scene}
${t('dramaScript.description')}：${fragment.description}
${fragment.characterAppearance.description ? `${t('dramaScript.appearance')}：${fragment.characterAppearance.description}` : ''}

${t('dramaScript.promptRequirements')}
${t('dramaScript.promptFirstFrameReq1')}
${t('dramaScript.promptFirstFrameReq2')}
${t('dramaScript.promptFirstFrameReq3')}
${t('dramaScript.promptFirstFrameReq4')}

${t('dramaScript.promptDirectOutput')}`
    
    const _userUuid = getUserUuid()
    let generatedPrompt = ''
    
    await streamGenerateContent(
      {
        prompt: prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: {
          temperature: 0.7,
          maxTokens: 200,
        },
      },
      (chunk: string) => {
        generatedPrompt += chunk
      },
      () => {
        fragment.firstFramePrompt = generatedPrompt.trim()
        onFragmentChange(fragment)
        ElMessage.success(t('dramaScript.promptGenerated'))
      },
      (error) => {
        logger.error(t('common.errors.operationFailed'), error)
        ElMessage.error(t('dramaScript.promptGenerateFailed'))
      }
    )
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.promptGenerateFailed'))
  }
}

// 保存增强模式设置
const saveEnhancedModeSetting = () => {
  try {
    localStorage.setItem('drama-script-enhanced-mode', String(useEnhancedMode.value))
  } catch (error) {
    logger.warn(t('common.errors.saveFailed'), error)
  }
}

const generateVideoPrompt = async (fragment: SceneFragment, useEnhanced?: boolean) => {
  // 如果没有指定，使用全局设置
  const _shouldUseEnhanced = useEnhanced !== undefined ? useEnhanced : useEnhancedMode.value
  if (!fragment.character || !fragment.scene || !fragment.description) {
    ElMessage.warning(t('dramaScript.fillRequiredFields'))
    return
  }
  
  try {
    // 导入AI增强模块
    const { generateEnhancedPrompt, analyzeContext, checkStyleConsistency } = await import('./DramaScriptExcel.AIEnhancement')
    
    if (useEnhanced) {
      // 使用增强模式：上下文感知 + 自动优化
      ElMessage.info(t('dramaScript.enhancedPromptGenerating'))
      
      // 分析上下文
      const currentIndex = fragments.value.findIndex(f => f.id === fragment.id)
      const context = analyzeContext(fragments.value, currentIndex, 5)
      
      // 生成增强提示词
      const enhancedResult = await generateEnhancedPrompt(
        fragment,
        context,
        characters.value,
        {
          useContext: true,
          optimize: true,
          maxIterations: 2,
        }
      )
      
      // 应用生成的提示词
      fragment.videoPrompt = enhancedResult.prompt
      
      // 检查一致性
      const consistencyCheck = checkStyleConsistency(
        enhancedResult.prompt,
        fragment,
        characters.value
      )
      
      // 显示结果
      if (enhancedResult.score.overall >= 80) {
        ElMessage.success(
          t('dramaScript.enhancedPromptGenerated', { 
            score: enhancedResult.score.overall 
          })
        )
      } else {
        ElMessage.warning(
          t('dramaScript.enhancedPromptGeneratedWithIssues', {
            score: enhancedResult.score.overall,
            issues: enhancedResult.score.issues.length
          })
        )
        
        // 如果有问题，显示详细提示
        if (enhancedResult.score.issues.length > 0) {
          logger.warn('Prompt quality issues:', enhancedResult.score.issues)
        }
      }
      
      // 如果有一致性问题，显示警告
      if (!consistencyCheck.consistent && consistencyCheck.issues.length > 0) {
        ElMessage.warning(
          t('dramaScript.consistencyWarning', { 
            message: consistencyCheck.issues[0] 
          })
        )
      }
      
      onFragmentChange(fragment)
    } else {
      // 使用基础模式（保持原有逻辑）
      const previousFragment = fragments.value.find(f => f.sequence === fragment.sequence - 1)
      const appearanceInfo = fragment.characterAppearance.description || t('drama.addCharDesc')
      const voiceInfo = fragment.voice.description || t('dramaScript.voiceOptional')
      const previousInfo = previousFragment && fragment.usePreviousLastFrame
        ? `${t('dramaScript.promptPreviousCoherent')}${previousFragment.description}`
        : ''

      const prompt = `${t('dramaScript.promptGenerateVideoPrompt')}

${t('dramaScript.character')}：${fragment.character}
${t('dramaScript.scene')}：${fragment.scene}
${t('dramaScript.description')}：${fragment.description}
${t('dramaScript.appearance')}：${appearanceInfo}
${t('dramaScript.promptVoiceStyle')}：${voiceInfo}
${previousInfo}

${t('dramaScript.promptRequirements')}
${t('dramaScript.promptVideoReq1')}${appearanceInfo}
2. ${fragment.voice.description ? `${t('dramaScript.promptVideoReq2MustInclude')}${fragment.voice.description}` : t('dramaScript.promptVideoReq2Optional')}
${t('dramaScript.promptVideoReq3')}${fragment.scene}
4. ${previousFragment && fragment.usePreviousLastFrame ? t('drama.coherent') : ''}
${t('dramaScript.promptVideoReq5')}
${t('dramaScript.promptVideoReq6')}
${t('dramaScript.promptVideoReq7')}

${t('dramaScript.promptDirectOutputVideo')}`
      
      let generatedPrompt = ''
      
      await streamGenerateContent(
        {
          prompt: prompt,
          modelId: 'gpt-4',
          type: 'text',
          parameters: {
            temperature: 0.7,
            maxTokens: 400,
          },
        },
        (chunk: string) => {
          generatedPrompt += chunk
        },
        () => {
          fragment.videoPrompt = generatedPrompt.trim()
          onFragmentChange(fragment)
          ElMessage.success(t('dramaScript.promptGenerated'))
        },
        (error) => {
          logger.error(t('common.errors.operationFailed'), error)
          ElMessage.error(t('dramaScript.promptGenerateFailed'))
        }
      )
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.promptGenerateFailed'))
  }
}

// 视频生成
const canGenerateVideo = (fragment: SceneFragment): boolean => {
  return !!(
    fragment.videoPrompt &&
    fragment.character &&
    fragment.scene &&
    fragment.description
  )
}

const generateVideo = async (fragment: SceneFragment) => {
  if (!canGenerateVideo(fragment)) {
    ElMessage.warning(t('dramaScript.fillRequiredFields'))
    return
  }
  
  fragment.status = 'generating'
  fragment.progress = 0
  onFragmentChange(fragment)
  
  // 显示生成进度提示
  let progressMessage: ReturnType<typeof ElMessage> | null = null
  
  try {
    // 初始进度提示
    progressMessage = ElMessage({
      message: t('dramaScript.videoGenerating', { sequence: fragment.sequence }),
      type: 'info',
      duration: 0, // 不自动关闭
      showClose: false,
    })
    
    const userUuid = getUserUuid()
    let imageUrl: string | undefined
    
    // 如果勾选了参考上一段尾帧，使用上一段的尾帧作为首帧
    if (fragment.usePreviousLastFrame) {
      const previousFragment = fragments.value.find(f => f.sequence === fragment.sequence - 1)
      if (previousFragment?.lastFrameImage) {
        // 上传尾帧图片（如果已经是URL则直接使用，否则需要上传）
        if (previousFragment.lastFrameImage.startsWith('http://') || previousFragment.lastFrameImage.startsWith('https://')) {
          // 已经是URL，直接使用
          imageUrl = previousFragment.lastFrameImage
        } else if (previousFragment.lastFrameImage.startsWith('data:')) {
          // Base64格式，需要转换为Blob并上传
          const imageBlob = dataURLtoBlob(previousFragment.lastFrameImage)
          const file = new File([imageBlob], 'last-frame.png', { type: 'image/png' })
          const uploadResponse = await uploadFormFile(file)
          if (uploadResponse.success && uploadResponse.data?.url) {
            imageUrl = uploadResponse.data.url
          }
        } else {
          // 尝试作为URL使用
          imageUrl = previousFragment.lastFrameImage
        }
      } else {
        ElMessage.warning(t('dramaScript.noPreviousFrame'))
      }
    } else if (fragment.firstFramePrompt) {
      // 如果有首帧提示词，生成首帧图片（带重试机制）
      const MAX_RETRIES = 2
      let retryCount = 0
      let imageGenerated = false
      
      while (retryCount <= MAX_RETRIES && !imageGenerated) {
        try {
          if (retryCount > 0) {
            logger.info(`Fragment ${fragment.sequence} first frame retry (${retryCount}/${MAX_RETRIES})...`)
            // 等待一段时间后重试（指数退避）
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)))
          } else {
            logger.info(`Generating first frame for fragment ${fragment.sequence}...`)
          }
          
          // 通义首帧生图：优先从大模型列表中读取 remark + quest_type
          const modelsResp = await getAvailableModels()
          const models = modelsResp.success && Array.isArray(modelsResp.data) ? modelsResp.data : []
          const imageModel = models.find((m) => {
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

          if (!imageModel?.remark) {
            throw new Error(t('dramaScript.firstFrameModelRemarkMissing'))
          }

          const questType = (imageModel.quest_type || '').toLowerCase().trim()
          if (questType === 'ws' || questType === 'websocket' || questType === 'web_socket') {
            throw new Error(t('dramaScript.firstFrameWsNotSupported'))
          }

          const path = imageModel.remark.startsWith('/') ? imageModel.remark : `/${imageModel.remark}`
          const resp = await request.post(path, {
            prompt: fragment.firstFramePrompt,
            user_uuid: userUuid,
          }) as unknown as {
            data?: { image_url?: string; image_urls?: string[]; message?: string }
            image_url?: string
            image_urls?: string[]
            message?: string
          }

          const payload = resp.data ?? resp
          const firstImageUrl =
            payload.image_url ||
            (Array.isArray(payload.image_urls) && payload.image_urls.length > 0
              ? payload.image_urls[0]
              : undefined)

          if (firstImageUrl) {
            imageUrl = firstImageUrl
            imageGenerated = true
            logger.info(`Fragment ${fragment.sequence} first frame generated: ${imageUrl}`)
            if (retryCount === 0) {
              ElMessage.success(t('dramaScript.firstFrameGenerated', { sequence: fragment.sequence }))
            } else {
              ElMessage.success(t('dramaScript.firstFrameGeneratedRetry', { sequence: fragment.sequence, count: retryCount }))
            }
          } else {
            const errorMsg = payload.message || t('dramaScript.unknownError')
            logger.warn(`Fragment ${fragment.sequence} first frame failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, errorMsg)
            
            if (retryCount < MAX_RETRIES) {
              // 继续重试
              retryCount++
            } else {
              // 达到最大重试次数，放弃首帧图片
              ElMessage.warning(t('dramaScript.firstFrameGenerateFailed', { maxRetries: MAX_RETRIES, error: errorMsg }))
              break
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.error(`Fragment ${fragment.sequence} first frame error (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error)
          
          if (retryCount < MAX_RETRIES) {
            // 继续重试
            retryCount++
          } else {
            // 达到最大重试次数，放弃首帧图片
            ElMessage.warning(t('dramaScript.firstFrameGenerateError', { maxRetries: MAX_RETRIES, error: errorMsg }))
            break
          }
        }
      }
      
      // 如果最终没有生成成功，记录警告但继续视频生成流程
      if (!imageGenerated) {
        logger.warn(`Fragment ${fragment.sequence} first frame ultimately failed, will generate video without first frame`)
      }
    }
    
    // 构建完整的视频生成提示词（包含角色形象和声音信息）
    const fullPrompt = buildFullVideoPrompt(fragment)
    
    // 使用通义万相视频生成（WebSocket流式）
    const _ws = createDashScopeVideoWebSocket(
      {
        prompt: fullPrompt,
        images: imageUrl,
        user_uuid: userUuid,
      },
      (message: unknown) => {
        const msg = message as { 
          event?: string
          type?: string
          data?: { 
            video_url?: string
            status?: string
            progress?: number
            message?: string
          }
        }
        
        if (msg.event === 'video.progress' || msg.type === 'progress') {
          // 更新进度提示
          const progressValue = msg.data?.progress || 0
          const statusText = msg.data?.status || msg.data?.message || ''
          logger.info(`Video generation progress: ${progressValue}% - ${statusText}`)
          
          // 更新片段进度（实时显示在表格中）
          fragment.progress = Math.min(100, Math.max(0, progressValue))
          onFragmentChange(fragment)
          
          // 更新进度消息（每10%更新一次，避免过于频繁）
          if (progressValue % 10 === 0 || progressValue === 0 || !progressMessage) {
            if (progressMessage) {
              progressMessage.close()
              progressMessage = null
            }
            progressMessage = ElMessage({
              message: t('dramaScript.videoGeneratingProgress', { 
                sequence: fragment.sequence, 
                progress: progressValue,
                status: statusText || t('dramaScript.generatingStatus')
              }),
              type: 'info',
              duration: 0,
              showClose: false,
            })
          }
        } else if (msg.event === 'video.completed' || (msg.type === 'complete' && msg.data?.video_url)) {
          // 关闭进度消息
          if (progressMessage) {
            progressMessage.close()
          }
          
          // 生成完成
          fragment.videoUrl = msg.data?.video_url
          fragment.status = 'completed'
          fragment.progress = 100
          onFragmentChange(fragment)
          
          ElMessage.success(t('dramaScript.videoGenerated', { sequence: fragment.sequence }))
          
          // 自动检测视频质量
          nextTick(async () => {
            await checkVideoQuality(fragment)
            // 自动提取尾帧
            extractLastFrame(fragment)
          })
        } else if (msg.event === 'error' || msg.type === 'error') {
          // 关闭进度消息
          if (progressMessage) {
            progressMessage.close()
          }
          
          // 处理生成失败（集成智能重试）
          handleVideoGenerationFailure(
            fragment,
            new Error(msg.data?.message || t('dramaScript.videoGenerationFailed'))
          )
        }
      },
      (error) => {
        // 关闭进度消息
        if (progressMessage) {
          progressMessage.close()
        }
        
        logger.error(t('common.errors.networkError'), error)
        
        // 处理生成失败（集成智能重试）
        handleVideoGenerationFailure(
          fragment,
          error instanceof Error ? error : new Error(String(error))
        )
      },
      () => {
        activeVideoSockets.delete(_ws)
        logger.info('Video generation WebSocket closed')
      }
    )
    activeVideoSockets.add(_ws)
  } catch (error) {
    // 关闭进度消息
    if (progressMessage) {
      progressMessage.close()
    }
    
    logger.error(t('common.errors.operationFailed'), error)
    
    // 处理生成失败（集成智能重试）
    handleVideoGenerationFailure(
      fragment,
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

// ========== 视频质量检测与智能重试 ==========

// 检查视频质量
const checkVideoQuality = async (fragment: SceneFragment) => {
  if (!fragment.videoUrl) return

  try {
    const qualityReport = await analyzeVideoQuality(fragment.videoUrl, fragment)
    fragment.qualityScore = qualityReport.overallScore
    fragment.qualityReport = qualityReport
    onFragmentChange(fragment)

    // 如果质量分数较低，显示警告
    if (qualityReport.overallScore < 60) {
      ElMessage.warning(
        t('dramaScript.lowQualityWarning', {
          sequence: fragment.sequence,
          score: qualityReport.overallScore,
        })
      )
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
  }
}

// 处理视频生成失败
const handleVideoGenerationFailure = async (
  fragment: SceneFragment,
  error: Error
) => {
  // 分析失败原因
  const failureReason = analyzeFailure(error, fragment)
  
  // 更新片段状态
  fragment.status = 'failed'
  fragment.progress = undefined
  onFragmentChange(fragment)

  // 显示错误消息
  ElMessage.error(
    t('dramaScript.videoGenerateFailed', {
      sequence: fragment.sequence,
      reason: failureReason.message,
    })
  )

  // 创建重试记录
  const retryRecord = createRetryRecord(
    (fragment.retryCount || 0) + 1,
    failureReason,
    false,
    error.message
  )
  updateFragmentRetryInfo(fragment, retryRecord)

  // 检查是否应该自动重试
  const strategy = retryStrategy.value
  if (
    strategy.autoRetry &&
    shouldRetry(fragment, failureReason, strategy)
  ) {
    // 计算重试延迟
    const delay = failureReason.retryDelay || 
      calculateRetryDelay(fragment.retryCount || 0, strategy)

    ElMessage.info(
      t('dramaScript.autoRetryScheduled', {
        sequence: fragment.sequence,
        delay: Math.round(delay / 1000),
      })
    )

    // 延迟后自动重试
    if (videoRetryTimer !== null) clearTimeout(videoRetryTimer)
    videoRetryTimer = setTimeout(() => {
      retryVideoGeneration(fragment, failureReason)
    }, delay)
  } else {
    // 如果不自动重试，添加到重试队列（供手动重试）
    if (!retryQueue.value.find(f => f.id === fragment.id)) {
      retryQueue.value.push(fragment)
    }
  }
}

// 重试视频生成
const retryVideoGeneration = async (
  fragment: SceneFragment,
  reason?: FailureReason
) => {
  // 如果需要优化提示词，先优化
  if (reason?.shouldOptimizePrompt && useEnhancedMode.value) {
    try {
      ElMessage.info(t('dramaScript.optimizingPromptForRetry'))
      
      // 重新生成提示词
      await generateVideoPrompt(fragment, true)
      
      // 等待一下再生成视频
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      logger.warn('Prompt optimization failed, retrying with original prompt:', error)
    }
  }

  // 重置状态
  fragment.status = 'pending'
  fragment.progress = undefined
  
  // 开始生成
  await generateVideo(fragment)
}

// 手动重试选中的片段
const retrySelectedFragments = async () => {
  const failedFragments = fragments.value.filter(
    f => selectedFragments.value.includes(f.id) && f.status === 'failed'
  )

  if (failedFragments.length === 0) {
    ElMessage.warning(
      t('dramaScript.noFailedFragments')
    )
    return
  }

  ElMessage.info(t('dramaScript.retryingFragments', { count: failedFragments.length }))

  // 逐个重试（避免并发过多）
  for (const fragment of failedFragments) {
    const reason = fragment.retryHistory?.[fragment.retryHistory.length - 1]?.reason
    await retryVideoGeneration(fragment, reason)
    
    // 添加延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

// 处理重试队列
const _processRetryQueue = async () => {
  if (isProcessingRetryQueue.value || retryQueue.value.length === 0) {
    return
  }

  isProcessingRetryQueue.value = true

  try {
    while (retryQueue.value.length > 0) {
      const fragment = retryQueue.value.shift()
      if (fragment && fragment.status === 'failed') {
        const reason = fragment.retryHistory?.[fragment.retryHistory.length - 1]?.reason
        await retryVideoGeneration(fragment, reason)
        
        // 添加延迟
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
  } finally {
    isProcessingRetryQueue.value = false
  }
}

// ========== 工作流引擎 ==========

// 执行选中的工作流
const executeSelectedWorkflow = async () => {
  if (!selectedWorkflow.value) {
    ElMessage.warning(t('dramaScript.selectWorkflowFirst'))
    return
  }

  const targetFragments = selectedFragments.value.length > 0
    ? fragments.value.filter(f => selectedFragments.value.includes(f.id))
    : fragments.value.filter(f => f.status === 'pending' || f.status === 'failed')

  if (targetFragments.length === 0) {
    ElMessage.warning(t('dramaScript.noFragmentsForWorkflow'))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('dramaScript.executeWorkflowConfirm', {
        workflow: selectedWorkflow.value.name,
        count: targetFragments.length,
      }),
      t('common.confirm'),
      {
        type: 'warning',
      }
    )

    ElMessage.info(t('dramaScript.executingWorkflow', { workflow: selectedWorkflow.value.name }))

    // 执行工作流
    const results = await executeWorkflow(
      selectedWorkflow.value,
      targetFragments,
      characters.value,
      {
        generatePrompt: async (fragment: SceneFragment, enhanced?: boolean) => {
          await generateVideoPrompt(fragment, enhanced ?? useEnhancedMode.value)
        },
        generateVideo: async (fragment: SceneFragment) => {
          await generateVideo(fragment)
          // 等待视频生成完成
          let waitCount = 0
          while (fragment.status === 'generating' && waitCount < 300) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            waitCount++
          }
        },
        extractFrame: async (fragment: SceneFragment) => {
          if (fragment.videoUrl) {
            await extractLastFrame(fragment)
          }
        },
        checkQuality: async (fragment: SceneFragment) => {
          if (fragment.videoUrl) {
            await checkVideoQuality(fragment)
          }
        },
      }
    )

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    saveData()

    if (failedCount === 0) {
      ElMessage.success(
        t('dramaScript.workflowCompleted', { count: successCount })
      )
    } else {
      ElMessage.warning(
        t('dramaScript.workflowCompletedWithErrors', {
          success: successCount,
          failed: failedCount,
        })
      )
    }
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error(t('common.errors.operationFailed'), error)
      ElMessage.error(t('dramaScript.workflowFailed'))
    }
  }
}

// ========== AI辅助剧情建议 ==========

// 加载场景推荐
const loadSceneRecommendations = async () => {
  if (fragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noFragments'))
    return
  }

  loadingRecommendations.value = true
  try {
    const recommendations = await recommendNextScenes(
      fragments.value,
      characters.value,
      5
    )
    sceneRecommendations.value = recommendations

    if (recommendations.length > 0) {
      ElMessage.success(
        t('dramaScript.recommendationsLoaded', { count: recommendations.length })
      )
    } else {
      ElMessage.warning(t('dramaScript.noRecommendations'))
    }
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    ElMessage.error(t('dramaScript.recommendationsFailed'))
  } finally {
    loadingRecommendations.value = false
  }
}

// 应用推荐
const applyRecommendation = (recommendation: typeof sceneRecommendations.value[0]) => {
  // 创建新片段
  const newFragment: SceneFragment = {
    id: `fragment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sequence: fragments.value.length + 1,
    character: fragments.value[fragments.value.length - 1]?.character || '',
    scene: recommendation.scene,
    description: recommendation.description,
    firstFramePrompt: '',
    videoPrompt: '',
    characterAppearance: {
      characterId: fragments.value[fragments.value.length - 1]?.characterAppearance.characterId,
      imageUrl: fragments.value[fragments.value.length - 1]?.characterAppearance.imageUrl,
      description: fragments.value[fragments.value.length - 1]?.characterAppearance.description || '',
    },
    voice: {
      characterId: fragments.value[fragments.value.length - 1]?.voice.characterId,
      voiceId: fragments.value[fragments.value.length - 1]?.voice.voiceId,
      description: fragments.value[fragments.value.length - 1]?.voice.description || '',
    },
    usePreviousLastFrame: true,
    status: 'pending',
    progress: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  fragments.value.push(newFragment)
  saveData()

  ElMessage.success(t('dramaScript.recommendationApplied'))
  
  // 自动滚动到新行
  nextTick(() => {
    const newRow = excelContainerRef.value?.querySelector(`[data-fragment-id="${newFragment.id}"]`)
    if (newRow) {
      newRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 聚焦到描述字段
      const textarea = newRow.querySelector('textarea')
      if (textarea) {
        (textarea as HTMLTextAreaElement).focus()
      }
    }
  })
}

// 检测剧情冲突
const detectPlotConflicts = () => {
  if (fragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noFragments'))
    return
  }

  try {
    const conflicts = detectConflicts(fragments.value)
    detectedConflicts.value = conflicts

    if (conflicts.length > 0) {
      const highSeverityCount = conflicts.filter(c => c.severity === 'high').length
      if (highSeverityCount > 0) {
        ElMessage.warning(
          t('dramaScript.conflictsDetected', {
            total: conflicts.length,
            high: highSeverityCount,
          })
        )
      } else {
        ElMessage.info(
          t('dramaScript.conflictsDetected', { total: conflicts.length, high: 0 })
        )
      }
    } else {
      ElMessage.success(t('dramaScript.noConflictsDetected'))
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.conflictDetectionFailed'))
  }
}

// 分析角色关系
const analyzeRelations = () => {
  if (fragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noFragments'))
    return
  }

  try {
    const relations = analyzeCharacterRelations(fragments.value)
    characterRelations.value = relations

    ElMessage.success(
      t('dramaScript.relationsAnalyzed', {
        characters: relations.characters.length,
        relations: relations.relations.length,
      })
    )
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.relationAnalysisFailed'))
  }
}

// 分析节奏
const analyzePacingRythm = () => {
  if (fragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noFragments'))
    return
  }

  try {
    const pacing = analyzePacing(fragments.value)
    pacingAnalysis.value = pacing

    if (pacing.pacingIssues.length > 0) {
      ElMessage.warning(
        t('dramaScript.pacingAnalyzedWithIssues', {
          issues: pacing.pacingIssues.length,
        })
      )
    } else {
      ElMessage.success(
        t('dramaScript.pacingAnalyzed', { pacing: t(`dramaScript.pacing.${pacing.overallPacing}`) })
      )
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.pacingAnalysisFailed'))
  }
}

// ========== 数据分析仪表板 ==========

// 打开数据分析仪表板
const openAnalyticsDashboard = () => {
  if (fragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noFragments'))
    return
  }

  try {
    // 生成分析数据
    analyticsSummary.value = generateAnalyticsSummary(fragments.value, characters.value)
    efficiencyMetrics.value = calculateEfficiencyMetrics(fragments.value)
    qualityBreakdown.value = calculateQualityBreakdown(fragments.value)
    chartData.value = generateChartData(fragments.value)
    
    showAnalyticsDashboard.value = true
    
    ElMessage.success(t('dramaScript.analyticsGenerated'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.analyticsGenerationFailed'))
  }
}

// 刷新分析数据
const refreshAnalytics = () => {
  try {
    analyticsSummary.value = generateAnalyticsSummary(fragments.value, characters.value)
    efficiencyMetrics.value = calculateEfficiencyMetrics(fragments.value)
    qualityBreakdown.value = calculateQualityBreakdown(fragments.value)
    chartData.value = generateChartData(fragments.value)
    
    ElMessage.success(t('dramaScript.analyticsRefreshed'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.analyticsRefreshFailed'))
  }
}

// 导出分析报告
const exportAnalyticsReport = () => {
  try {
    const report = {
      summary: analyticsSummary.value,
      efficiency: efficiencyMetrics.value,
      qualityBreakdown: qualityBreakdown.value,
      chartData: chartData.value,
      generatedAt: new Date().toISOString(),
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `drama-analytics-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success(t('dramaScript.analyticsExported'))
  } catch (error) {
    logger.error(t('common.errors.exportFailed'), error)
    ElMessage.error(t('dramaScript.analyticsExportFailed'))
  }
}

// ========== 视频预览与编辑 ==========

// 打开视频预览
const openVideoPreview = async (fragment: SceneFragment) => {
  if (!fragment.videoUrl) {
    ElMessage.warning(t('dramaScript.noVideo'))
    return
  }

  previewFragment.value = fragment
  previewCurrentTime.value = 0
  previewIsPlaying.value = false
  previewFrames.value = []
  
  showVideoPreview.value = true

  // 提取关键帧
  try {
    const frames = await extractMultipleFrames(fragment.videoUrl, { count: 8 })
    previewFrames.value = frames
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
  }
}

// 关闭视频预览
const closeVideoPreview = () => {
  showVideoPreview.value = false
  previewFragment.value = null
  previewFrames.value = []
  
  if (previewController.value) {
    previewController.value.stop()
    previewController.value.detach()
    previewController.value = null
  }
}

// 初始化视频预览控制器
const initPreviewController = (videoEl: HTMLVideoElement) => {
  if (previewController.value) {
    previewController.value.detach()
  }
  
  previewController.value = new VideoPreviewController(videoEl)
  previewController.value.onTimeUpdate((time) => {
    previewCurrentTime.value = time
  })
  previewController.value.onEnded(() => {
    previewIsPlaying.value = false
  })
}

// 播放/暂停切换
const togglePreviewPlayback = () => {
  if (!previewController.value) return
  
  if (previewIsPlaying.value) {
    previewController.value.pause()
  } else {
    previewController.value.play()
  }
  previewIsPlaying.value = !previewIsPlaying.value
}

// 跳转到指定时间
const seekPreviewTo = (time: number) => {
  if (previewController.value) {
    previewController.value.seekTo(time)
    previewCurrentTime.value = time
  }
}

// 截取当前帧
const capturePreviewFrame = () => {
  if (!previewController.value || !previewFragment.value) return
  
  const frameData = previewController.value.captureCurrentFrame()
  if (frameData) {
    // 设置为尾帧
    previewFragment.value.lastFrameImage = frameData
    onFragmentChange(previewFragment.value)
    ElMessage.success(t('dramaScript.frameCaptured'))
  } else {
    ElMessage.error(t('dramaScript.frameCapturedFailed'))
  }
}

// 跳转到帧
const jumpToFrame = (frame: VideoFrame) => {
  seekPreviewTo(frame.timestamp)
}

// 格式化时间显示
const formatPreviewTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

// ========== AI辅助创作 ==========

// 打开AI辅助创作
const openAICreation = async () => {
  showAICreation.value = true
  loadingAICreation.value = true
  
  try {
    // 并行加载数据
    const [plotRes, arcRes, charArcsRes, contRes] = await Promise.all([
      generatePlotSuggestions(fragments.value, characters.value, 5),
      Promise.resolve(analyzeStoryArc(fragments.value)),
      Promise.resolve(analyzeCharacterArcsAI(fragments.value, characters.value)),
      generateContinuation(fragments.value, characters.value),
    ])
    
    plotSuggestions.value = plotRes
    storyArc.value = arcRes
    characterArcs.value = charArcsRes
    continuationSuggestion.value = contRes
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    ElMessage.error(t('dramaScript.aiCreationLoadFailed'))
  } finally {
    loadingAICreation.value = false
  }
}

// 应用续写建议
const applyContinuationSuggestion = () => {
  if (!continuationSuggestion.value) return
  
  const newFragment = addFragment()
  newFragment.scene = continuationSuggestion.value.nextScene
  newFragment.description = continuationSuggestion.value.nextDescription
  newFragment.character = continuationSuggestion.value.suggestedCharacter
  
  onFragmentChange(newFragment)
  ElMessage.success(t('dramaScript.suggestionApplied'))
}

// 分析情感
const analyzeFragmentEmotions = async () => {
  loadingAICreation.value = true
  try {
    emotionAnalyses.value = await analyzeEmotions(fragments.value)
    ElMessage.success(t('dramaScript.emotionAnalyzed'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
  } finally {
    loadingAICreation.value = false
  }
}

// ========== 高级视频处理 ==========

// 打开视频处理
const openVideoProcessing = () => {
  showVideoProcessing.value = true
}

// 生成片段字幕
const _generateFragmentSubtitles = async (fragment: SceneFragment) => {
  try {
    const subtitles = await generateSubtitles(fragment)
    projectSubtitles.value.set(fragment.id, subtitles)
    ElMessage.success(t('dramaScript.subtitlesGenerated'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.subtitlesGenerateFailed'))
  }
}

// 批量生成字幕
const batchGenerateAllSubtitles = async () => {
  const fragmentsWithVideo = fragments.value.filter(f => f.videoUrl)
  let completed = 0
  
  for (const fragment of fragmentsWithVideo) {
    try {
      const subtitles = await generateSubtitles(fragment)
      projectSubtitles.value.set(fragment.id, subtitles)
      completed++
      ElMessage.info(`${t('dramaScript.subtitleProgress')}: ${completed}/${fragmentsWithVideo.length}`)
    } catch (error) {
      logger.error(`Subtitle generation failed (${fragment.id}):`, error)
    }
  }
  
  ElMessage.success(t('dramaScript.allSubtitlesGenerated'))
}

// 导出字幕
const exportAllSubtitles = (format: 'srt' | 'ass') => {
  const allSubtitles: Subtitle[] = []
  let offset = 0
  
  for (const fragment of fragments.value) {
    const subs = projectSubtitles.value.get(fragment.id) || []
    subs.forEach(sub => {
      allSubtitles.push({
        ...sub,
        startTime: sub.startTime + offset,
        endTime: sub.endTime + offset,
      })
    })
    offset += fragment.videoDuration || 0
  }
  
  const content = format === 'srt' 
    ? exportSRT(allSubtitles)
    : exportASS(allSubtitles, t('dramaScript.subtitleTitle'))
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `subtitles.${format}`
  link.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success(t('dramaScript.subtitlesExported'))
}

// ========== 版本管理 ==========

// 打开版本管理
const openVersionManager = () => {
  versions.value = getVersions()
  showVersionManager.value = true
}

// 创建新版本
const createNewVersion = (name?: string, description?: string) => {
  const version = createVersion(fragments.value, characters.value, {
    name,
    description,
    isAutoSave: false,
  })
  
  versions.value = getVersions()
  ElMessage.success(t('dramaScript.versionCreated', { version: version.version }))
  
  // 记录变更
  recordChange({
    versionId: version.id,
    userId: 'current-user',
    userName: t('dramaScript.currentUser'),
    changeType: 'create',
    entityType: 'project',
    entityId: version.id,
    summary: t('dramaScript.versionCreatedSummary', { version: version.version }),
  })
}

// 恢复版本
const handleRestoreVersion = (versionId: string) => {
  ElMessageBox.confirm(
    t('dramaScript.confirmRestoreVersion'),
    t('common.confirm'),
    { type: 'warning' }
  ).then(() => {
    const restored = restoreVersion(versionId)
    if (restored) {
      fragments.value = restored.fragments
      characters.value = restored.characters
      saveData()
      ElMessage.success(t('dramaScript.versionRestored'))
    }
  }).catch((error: unknown) => {
    // 用户取消操作，不需要处理
    if (error !== 'cancel') {
      logger.warn('Version restore operation failed:', error)
    }
  })
}

// 比较版本
const _handleCompareVersions = (versionIdA: string, versionIdB: string) => {
  versionCompareResult.value = compareVersions(versionIdA, versionIdB)
}

// 删除版本
const handleDeleteVersion = (versionId: string) => {
  ElMessageBox.confirm(
    t('dramaScript.confirmDeleteVersion'),
    t('common.confirm'),
    { type: 'warning' }
  ).then(() => {
    if (deleteVersion(versionId)) {
      versions.value = getVersions()
      ElMessage.success(t('dramaScript.versionDeleted'))
    }
  }).catch((error: unknown) => {
    // 用户取消操作，不需要处理
    if (error !== 'cancel') {
      logger.warn('Version deletion operation failed:', error)
    }
  })
}

// ========== 评论系统 ==========

// 打开评论
const openComments = (fragmentId?: string) => {
  selectedCommentFragment.value = fragmentId || null
  comments.value = getComments(fragmentId ? { fragmentId } : undefined)
  showComments.value = true
}

// 添加评论
const submitComment = () => {
  if (!newCommentText.value.trim()) return
  
  const comment = addComment({
    fragmentId: selectedCommentFragment.value || undefined,
    projectLevel: !selectedCommentFragment.value,
    userId: 'current-user',
    userName: t('dramaScript.currentUser'),
    content: newCommentText.value,
    mentions: [],
  })
  
  comments.value.push(comment)
  newCommentText.value = ''
  ElMessage.success(t('dramaScript.commentAdded'))
}

// 解决评论
const handleResolveComment = (commentId: string) => {
  if (resolveComment(commentId, 'current-user')) {
    comments.value = getComments(selectedCommentFragment.value ? { fragmentId: selectedCommentFragment.value } : undefined)
    ElMessage.success(t('dramaScript.commentResolved'))
  }
}

// ========== 增强功能 ==========

// 初始化快捷键
const initShortcuts = () => {
  shortcutManager.value = new ShortcutManager()
  
  shortcutManager.value.registerHandlers({
    save: () => saveData(),
    undo: () => handleUndo(),
    redo: () => handleRedo(),
    selectAll: () => selectAllFragments(),
    delete: () => deleteSelectedFragments(),
    newFragment: () => addFragment(),
    duplicate: () => duplicateSelectedFragments(),
    copy: () => copySelectedFragments(),
    paste: () => pasteFragments(),
    search: () => { /* 聚焦搜索框 */ },
    generatePrompt: () => batchGeneratePrompts(),
    generateVideo: () => batchGenerateVideos(),
    showShortcuts: () => { showShortcutsDialog.value = true },
    export: () => { showExportDialog.value = true },
  })
  
  shortcutManager.value.mount()
}

// 撤销
const handleUndo = () => {
  const state = historyManager.value.undo()
  if (state) {
    fragments.value = state.fragments
    characters.value = state.characters
    selectedFragments.value = state.selectedIds
    ElMessage.info(t('dramaScript.undone', { description: state.description }))
  } else {
    ElMessage.warning(t('dramaScript.nothingToUndo'))
  }
}

// 重做
const handleRedo = () => {
  const state = historyManager.value.redo()
  if (state) {
    fragments.value = state.fragments
    characters.value = state.characters
    selectedFragments.value = state.selectedIds
    ElMessage.info(t('dramaScript.redone', { description: state.description }))
  } else {
    ElMessage.warning(t('dramaScript.nothingToRedo'))
  }
}

// 记录历史状态
const recordHistory = (action: string, description: string) => {
  historyManager.value.pushState(
    action,
    description,
    fragments.value,
    characters.value,
    selectedFragments.value
  )
}

// 重新排序片段序号
const reorderSequences = () => {
  fragments.value.forEach((f, i) => {
    f.sequence = i + 1
  })
}

// 全选
const selectAllFragments = () => {
  selectedFragments.value = filteredFragments.value.map(f => f.id)
}

// 复制选中片段
const copySelectedFragments = () => {
  const selected = fragments.value.filter(f => selectedFragments.value.includes(f.id))
  if (selected.length === 0) {
    ElMessage.warning(t('dramaScript.noSelection'))
    return
  }
  clipboardData.value = JSON.parse(JSON.stringify(selected))
  ElMessage.success(t('dramaScript.copied', { count: selected.length }))
}

// 粘贴片段
const pasteFragments = () => {
  if (!clipboardData.value || clipboardData.value.length === 0) {
    ElMessage.warning(t('dramaScript.nothingToPaste'))
    return
  }
  
  recordHistory('paste', t('dramaScript.pasteHistoryDesc', { count: clipboardData.value.length }))
  
  const maxSequence = Math.max(...fragments.value.map(f => f.sequence), 0)
  const newFragments = clipboardData.value.map((f, i) => ({
    ...f,
    id: `fragment-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
    sequence: maxSequence + i + 1,
    status: 'pending' as const,
    videoUrl: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  
  fragments.value.push(...newFragments)
  saveData()
  ElMessage.success(t('dramaScript.pasted', { count: newFragments.length }))
}

// 复制选中片段
const duplicateSelectedFragments = () => {
  const selected = fragments.value.filter(f => selectedFragments.value.includes(f.id))
  if (selected.length === 0) {
    ElMessage.warning(t('dramaScript.noSelection'))
    return
  }
  
  recordHistory('duplicate', t('dramaScript.duplicateHistoryDesc', { count: selected.length }))
  
  const maxSequence = Math.max(...fragments.value.map(f => f.sequence), 0)
  const newFragments = selected.map((f, i) => ({
    ...f,
    id: `fragment-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
    sequence: maxSequence + i + 1,
    status: 'pending' as const,
    videoUrl: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  
  fragments.value.push(...newFragments)
  selectedFragments.value = newFragments.map(f => f.id)
  saveData()
  ElMessage.success(t('dramaScript.duplicated', { count: newFragments.length }))
}

// 删除选中片段
const deleteSelectedFragments = () => {
  if (selectedFragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noSelection'))
    return
  }
  
  ElMessageBox.confirm(
    t('dramaScript.confirmDeleteSelected', { count: selectedFragments.value.length }),
    t('common.confirm'),
    { type: 'warning' }
  ).then(() => {
    recordHistory('delete', t('dramaScript.deleteHistoryDesc', { count: selectedFragments.value.length }))
    fragments.value = fragments.value.filter(f => !selectedFragments.value.includes(f.id))
    selectedFragments.value = []
    reorderSequences()
    saveData()
    ElMessage.success(t('dramaScript.deleted'))
  }).catch((error: unknown) => {
    // 用户取消操作，不需要处理
    if (error !== 'cancel') {
      logger.warn(t('common.errors.deleteFailed'), error)
    }
  })
}

// 打开剧本导入
const openScriptImport = () => {
  scriptImportText.value = ''
  parsedScenes.value = []
  showScriptImport.value = true
}

// 解析剧本
const parseScript = async () => {
  if (!scriptImportText.value.trim()) {
    ElMessage.warning(t('dramaScript.enterScript'))
    return
  }
  
  parsingScript.value = true
  try {
    parsedScenes.value = await parseScriptToScenes(scriptImportText.value, characters.value)
    if (parsedScenes.value.length === 0) {
      ElMessage.warning(t('dramaScript.noScenesFound'))
    } else {
      ElMessage.success(t('dramaScript.scenesParsed', { count: parsedScenes.value.length }))
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.parseFailed'))
  } finally {
    parsingScript.value = false
  }
}

// 应用解析的场景
const applyParsedScenes = () => {
  if (parsedScenes.value.length === 0) return
  
  recordHistory('import', t('dramaScript.importHistoryDesc', { count: parsedScenes.value.length }))
  
  const newFragments = createFragmentsFromScenes(parsedScenes.value, characters.value)
  const maxSequence = Math.max(...fragments.value.map(f => f.sequence), 0)
  
  newFragments.forEach((f, i) => {
    f.sequence = maxSequence + i + 1
  })
  
  fragments.value.push(...newFragments)
  saveData()
  showScriptImport.value = false
  ElMessage.success(t('dramaScript.scenesImported', { count: newFragments.length }))
}

// 导出项目
const handleExport = () => {
  const format = exportFormats.value.find(f => f.id === selectedExportFormat.value)
  if (!format) return
  
  let content: string
  let filename = `drama-script-${new Date().toISOString().split('T')[0]}.${format.extension}`
  
  switch (format.id) {
    case 'json':
      content = JSON.stringify({
        fragments: fragments.value,
        characters: characters.value,
        exportedAt: new Date().toISOString(),
      }, null, 2)
      break
    case 'markdown':
      content = exportToMarkdown(fragments.value, characters.value)
      break
    case 'html':
      content = exportToHTML(fragments.value, characters.value)
      break
    case 'txt':
      content = fragments.value.map(f =>
        `[${t('dramaScript.txtExportScene')}${f.sequence}] ${f.scene}\n${t('dramaScript.txtExportCharacter')}: ${f.character}\n${f.description}\n`
      ).join('\n---\n\n')
      break
    default:
      content = JSON.stringify(fragments.value, null, 2)
  }
  
  const blob = new Blob([content], { type: format.mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  
  showExportDialog.value = false
  ElMessage.success(t('dramaScript.exported'))
}

// ================== 虚拟滚动功能 ==================
const _handleVirtualScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (target) {
    scrollTop.value = target.scrollTop
  }
}

const scrollToFragment = (fragmentId: string) => {
  const index = filteredFragments.value.findIndex(f => f.id === fragmentId)
  if (index >= 0) {
    scrollTop.value = index * rowHeight
    highlightedFragmentId.value = fragmentId
    // 3秒后取消高亮
    setTimeout(() => {
      if (highlightedFragmentId.value === fragmentId) {
        highlightedFragmentId.value = null
      }
    }, 3000)
  }
}

// ================== 自动保存功能 ==================
const triggerAutoSave = () => {
  // 清除之前的定时器
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
  }
  
  // 设置新的定时器（延迟1秒保存）
  autoSaveTimer.value = window.setTimeout(async () => {
    await performAutoSave()
  }, 1000)
}

const performAutoSave = async () => {
  try {
    autoSaveStatus.value = 'saving'
    await saveData()
    autoSaveStatus.value = 'saved'
    lastSaveTime.value = new Date()
    
    // 5秒后重置状态
    setTimeout(() => {
      if (autoSaveStatus.value === 'saved') {
        autoSaveStatus.value = 'idle'
      }
    }, 5000)
  } catch (error) {
    logger.error(t('common.errors.saveFailed'), error)
    autoSaveStatus.value = 'error'
  }
}

// ================== 搜索结果导航 ==================
const navigateSearchResults = (direction: 'prev' | 'next') => {
  if (searchMatchFragments.value.length === 0) return
  
  if (direction === 'next') {
    searchResultIndex.value = (searchResultIndex.value + 1) % searchMatchFragments.value.length
  } else {
    searchResultIndex.value = (searchResultIndex.value - 1 + searchMatchFragments.value.length) % searchMatchFragments.value.length
  }
  
  const targetId = searchMatchFragments.value[searchResultIndex.value]
  scrollToFragment(targetId)
}

const _highlightSearchText = (text: string | undefined): string => {
  if (!text || !searchKeyword.value) return text || ''
  const keyword = searchKeyword.value
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

// ================== 网络状态检测 ==================
const handleOnline = () => {
  isOnline.value = true
  ElMessage.success(t('dramaScript.networkOnline'))
  
  // 同步离线期间的更改
  if (pendingOfflineChanges.value.length > 0) {
    syncOfflineChanges()
  }
}

const handleOffline = () => {
  isOnline.value = false
  ElMessage.warning(t('dramaScript.networkOffline'))
}

const syncOfflineChanges = async () => {
  try {
    // 保存所有待同步的更改
    await saveData()
    pendingOfflineChanges.value = []
    ElMessage.success(t('dramaScript.syncCompleted'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
  }
}

// ================== 快速预览功能 ==================
const toggleQuickPreview = (fragment: SceneFragment | null = null) => {
  if (fragment) {
    quickPreviewFragment.value = fragment
    quickPreviewMode.value = true
  } else {
    quickPreviewMode.value = false
    quickPreviewFragment.value = null
  }
}

const handleQuickPreviewKeyboard = (e: KeyboardEvent) => {
  if (!quickPreviewMode.value) return
  
  const currentIndex = filteredFragments.value.findIndex(f => f.id === quickPreviewFragment.value?.id)
  
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      if (currentIndex > 0) {
        quickPreviewFragment.value = filteredFragments.value[currentIndex - 1]
      }
      e.preventDefault()
      break
    case 'ArrowRight':
    case 'ArrowDown':
      if (currentIndex < filteredFragments.value.length - 1) {
        quickPreviewFragment.value = filteredFragments.value[currentIndex + 1]
      }
      e.preventDefault()
      break
    case 'Escape':
      toggleQuickPreview()
      e.preventDefault()
      break
  }
}

const navigateQuickPreview = (direction: 'prev' | 'next') => {
  if (!quickPreviewFragment.value) return
  
  const currentIndex = filteredFragments.value.findIndex(f => f.id === quickPreviewFragment.value?.id)
  
  if (direction === 'prev' && currentIndex > 0) {
    quickPreviewFragment.value = filteredFragments.value[currentIndex - 1]
  } else if (direction === 'next' && currentIndex < filteredFragments.value.length - 1) {
    quickPreviewFragment.value = filteredFragments.value[currentIndex + 1]
  }
}

// ================== 批量状态更新 ==================
const openBatchStatusDialog = () => {
  if (selectedFragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noSelection'))
    return
  }
  showBatchStatusDialog.value = true
}

const applyBatchStatus = () => {
  selectedFragments.value.forEach(id => {
    const fragment = fragments.value.find(f => f.id === id)
    if (fragment) {
      fragment.status = batchStatusTarget.value
      fragment.updatedAt = new Date().toISOString()
    }
  })
  
  showBatchStatusDialog.value = false
  triggerAutoSave()
  
  ElMessage.success(t('dramaScript.batchStatusUpdated', { count: selectedFragments.value.length }))
}

// ================== 容器尺寸监听 ==================
let resizeRafId: number | null = null
const updateContainerHeight = () => {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    const container = document.querySelector('.excel-container') as HTMLElement
    if (container) {
      containerHeight.value = container.clientHeight
      visibleRowCount.value = Math.ceil(containerHeight.value / rowHeight) + 2
    }
  })
}

// ================== 连续性检查 ==================
const checkContinuity = () => {
  const issues: typeof continuityIssues.value = []
  
  fragments.value.forEach((fragment, index) => {
    // 检查角色连续性
    if (index > 0) {
      const prevFragment = fragments.value[index - 1]
      
      // 检查场景跳跃
      if (fragment.scene !== prevFragment.scene && !fragment.description?.includes(t('drama.transition')) && !fragment.description?.includes('转场')) {
        issues.push({
          type: 'scene',
          severity: 'warning',
          fragmentId: fragment.id,
          description: t('dramaScript.continuitySceneJump', { prevScene: prevFragment.scene, currentScene: fragment.scene }),
          suggestion: t('dramaScript.suggestionTransition')
        })
      }
      
      // 检查角色突然消失
      if (prevFragment.character && prevFragment.character !== fragment.character) {
        const characterReappears = fragments.value.slice(index + 1).some(f => f.character === prevFragment.character)
        if (!characterReappears && index < fragments.value.length - 1) {
          issues.push({
            type: 'character',
            severity: 'warning',
            fragmentId: fragment.id,
            description: t('dramaScript.continuityCharacterDisappear', { character: prevFragment.character }),
            suggestion: t('drama.confirmCharContinue')
          })
        }
      }
    }
    
    // 检查空白信息
    if (!fragment.character || fragment.character.trim() === '') {
      issues.push({
        type: 'logic',
        severity: 'error',
        fragmentId: fragment.id,
        description: t('dramaScript.continuityMissingCharacter', { sequence: fragment.sequence }),
        suggestion: t('dramaScript.suggestionSpecifyCharacter')
      })
    }
    
    if (!fragment.description || fragment.description.trim() === '') {
      issues.push({
        type: 'logic',
        severity: 'error',
        fragmentId: fragment.id,
        description: t('dramaScript.continuityMissingDescription', { sequence: fragment.sequence }),
        suggestion: t('dramaScript.suggestionAddDescription')
      })
    }
  })
  
  continuityIssues.value = issues
  showContinuityCheck.value = true
  
  if (issues.length === 0) {
    ElMessage.success(t('dramaScript.noContinuityIssues'))
  } else {
    ElMessage.warning(t('dramaScript.continuityIssuesFound', { count: issues.length }))
  }
}

const jumpToIssue = (fragmentId: string) => {
  scrollToFragment(fragmentId)
  showContinuityCheck.value = false
}

// ================== 角色统计 ==================
const calculateCharacterStats = () => {
  const statsMap = new Map<string, typeof characterStatsData.value[0]>()
  
  fragments.value.forEach(fragment => {
    if (!fragment.character) return
    
    const name = fragment.character
    const existing = statsMap.get(name)
    
    if (existing) {
      existing.appearances++
      existing.lastAppearance = Math.max(existing.lastAppearance, fragment.sequence)
      if (!existing.scenes.includes(fragment.scene)) {
        existing.scenes.push(fragment.scene)
      }
      existing.totalDuration += fragment.videoDuration || 0
    } else {
      statsMap.set(name, {
        name,
        appearances: 1,
        firstAppearance: fragment.sequence,
        lastAppearance: fragment.sequence,
        scenes: fragment.scene ? [fragment.scene] : [],
        totalDuration: fragment.videoDuration || 0
      })
    }
  })
  
  characterStatsData.value = Array.from(statsMap.values()).sort((a, b) => b.appearances - a.appearances)
  showCharacterStats.value = true
}

// ================== 导出预览 ==================
const generateExportPreview = (format: 'markdown' | 'txt' | 'html') => {
  exportPreviewFormat.value = format
  
  switch (format) {
    case 'markdown':
      exportPreviewContent.value = generateMarkdownPreview()
      break
    case 'txt':
      exportPreviewContent.value = generateTextPreview()
      break
    case 'html':
      exportPreviewContent.value = generateHtmlPreview()
      break
  }
  
  showExportPreview.value = true
}

const generateMarkdownPreview = (): string => {
  let content = `# ${t('dramaScript.title')}\n\n`
  content += `> ${t('dramaScript.exportTime')}: ${new Date().toLocaleString('zh-CN')}\n\n`
  content += `## ${t('dramaScript.overview')}\n\n`
  content += `- ${t('dramaScript.total')}: ${fragments.value.length} ${t('dramaScript.fragments')}\n`
  content += `- ${t('dramaScript.completed')}: ${completedCount.value} ${t('dramaScript.fragments')}\n`
  content += `- ${t('dramaScript.characters')}: ${characters.value.length}\n\n`
  
  content += `## ${t('dramaScript.characterList')}\n\n`
  characters.value.forEach(char => {
    content += `### ${char.name}\n`
    if (char.appearance?.description) {
      content += `- ${t('dramaScript.appearance')}: ${char.appearance.description}\n`
    }
    if (char.voice?.description) {
      content += `- ${t('dramaScript.voice')}: ${char.voice.description}\n`
    }
    content += '\n'
  })
  
  content += `## ${t('dramaScript.sceneList')}\n\n`
  fragments.value.forEach(f => {
    content += `### ${t('dramaScript.scene')} ${f.sequence}: ${f.scene || '-'}\n\n`
    content += `**${t('dramaScript.character')}**: ${f.character || '-'}\n\n`
    content += `**${t('dramaScript.description')}**: ${f.description || '-'}\n\n`
    if (f.videoPrompt) {
      content += `**${t('dramaScript.videoPrompt')}**: ${f.videoPrompt}\n\n`
    }
    content += `**${t('dramaScript.status')}**: ${getStatusLabel(f.status)}\n\n`
    content += '---\n\n'
  })
  
  return content
}

const generateTextPreview = (): string => {
  let content = `${t('dramaScript.title')}\n`
  content += `${'='.repeat(40)}\n\n`
  content += `${t('dramaScript.exportTime')}: ${new Date().toLocaleString('zh-CN')}\n`
  content += `${t('dramaScript.total')}: ${fragments.value.length} ${t('dramaScript.fragments')}\n\n`
  
  fragments.value.forEach(f => {
    content += `[${t('dramaScript.scene')} ${f.sequence}] ${f.scene || '-'}\n`
    content += `${t('dramaScript.character')}: ${f.character || '-'}\n`
    content += `${f.description || '-'}\n`
    content += `${'-'.repeat(40)}\n\n`
  })
  
  return content
}

const generateHtmlPreview = (): string => {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${t('dramaScript.title')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .scene { border: var(--unified-border); padding: 15px; margin-bottom: 15px; border-radius: var(--global-border-radius); }
    .scene-title { font-size: 18px; font-weight: bold; color: var(--el-text-color-primary); }
    .scene-meta { color: var(--el-text-color-regular); margin: 10px 0; }
    .scene-desc { line-height: 1.6; }
    .status { display: inline-block; padding: 2px 8px; border-radius: var(--global-border-radius); font-size: 12px; }
    .status-completed { background: var(--color-success-10); color: var(--color-green-389e0d); }
    .status-pending { background: var(--color-primary-10); color: var(--color-blue-1890ff); }
    .status-generating { background: var(--color-orange-fa8c16-10); color: var(--color-orange-fa8c16); }
    .status-failed { background: var(--color-red-transparent-10-alt); color: var(--color-red-f5222d); }
  </style>
</head>
<body>
  <div class="header">
    <h1>${t('dramaScript.title')}</h1>
    <p>${t('dramaScript.exportTime')}: ${new Date().toLocaleString('zh-CN')}</p>
  </div>
  ${fragments.value.map(f => `
  <div class="scene">
    <div class="scene-title">${t('dramaScript.scene')} ${f.sequence}: ${f.scene || '-'}</div>
    <div class="scene-meta">${t('dramaScript.character')}: ${f.character || '-'} | <span class="status status-${f.status}">${getStatusLabel(f.status)}</span></div>
    <div class="scene-desc">${f.description || '-'}</div>
  </div>
  `).join('')}
</body>
</html>`
}

const copyExportPreview = async () => {
  try {
    await navigator.clipboard.writeText(exportPreviewContent.value)
    ElMessage.success(t('dramaScript.copied'))
  } catch (error) {
    logger.warn('Failed to copy export preview content:', error)
    ElMessage.error(t('dramaScript.copyFailed'))
  }
}

const downloadExportPreview = () => {
  const ext = exportPreviewFormat.value === 'html' ? 'html' : exportPreviewFormat.value === 'markdown' ? 'md' : 'txt'
  const mimeType = exportPreviewFormat.value === 'html' ? 'text/html' : 'text/plain'
  const blob = new Blob([exportPreviewContent.value], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `drama-script-${new Date().toISOString().split('T')[0]}.${ext}`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success(t('dramaScript.downloaded'))
}

// ================== 片段模板功能 ==================
const _openFragmentTemplateDialog = () => {
  showFragmentTemplateDialog.value = true
}

const _insertFragmentTemplate = (template: typeof _fragmentTemplates.value[0]) => {
  const newFragment = addFragment()
  
  // 应用模板内容
  if (template.template.scene) {
    newFragment.scene = template.template.scene
  }
  if (template.template.description) {
    newFragment.description = template.template.description as string
  }
  if (template.template.videoPrompt) {
    newFragment.videoPrompt = template.template.videoPrompt as string
  }
  
  showFragmentTemplateDialog.value = false
  triggerAutoSave()
  recordHistory('insertTemplate', t('dramaScript.insertTemplateHistory'))
  
  // 滚动到新添加的片段
  nextTick(() => {
    scrollToFragment(newFragment.id)
  })
  
  ElMessage.success(t('dramaScript.templateApplied'))
}

// ================== 批量编辑功能 ==================
const _openBatchEditDialog = () => {
  if (selectedFragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noSelection'))
    return
  }
  batchEditFields.value = {}
  showBatchEditDialog.value = true
}

const _applyBatchEdit = () => {
  selectedFragments.value.forEach(id => {
    const fragment = fragments.value.find(f => f.id === id)
    if (fragment) {
      if (batchEditFields.value.character !== undefined && batchEditFields.value.character.trim() !== '') {
        fragment.character = batchEditFields.value.character
      }
      if (batchEditFields.value.scene !== undefined && batchEditFields.value.scene.trim() !== '') {
        fragment.scene = batchEditFields.value.scene
      }
      if (batchEditFields.value.status) {
        fragment.status = batchEditFields.value.status
      }
      fragment.updatedAt = new Date().toISOString()
    }
  })
  
  showBatchEditDialog.value = false
  triggerAutoSave()
  recordHistory('batchEdit', t('dramaScript.batchEditHistory'))
  
  ElMessage.success(t('dramaScript.batchEditSuccess', { count: selectedFragments.value.length }))
}

// ================== 数据验证和实时提示 ==================
const validateFragment = (fragment: SceneFragment): string[] => {
  const tips: string[] = []
  
  if (!fragment.character || fragment.character.trim() === '') {
    tips.push(t('dramaScript.validationNoCharacter'))
  }
  
  if (!fragment.scene || fragment.scene.trim() === '') {
    tips.push(t('dramaScript.validationNoScene'))
  }
  
  if (!fragment.description || fragment.description.trim() === '') {
    tips.push(t('dramaScript.validationNoDescription'))
  }
  
  if (fragment.description && fragment.description.length < 10) {
    tips.push(t('dramaScript.validationDescriptionTooShort'))
  }
  
  if (!fragment.videoPrompt || fragment.videoPrompt.trim() === '') {
    tips.push(t('dramaScript.validationNoPrompt'))
  }
  
  return tips
}

const updateValidationTips = (fragmentId: string, tips: string[]) => {
  if (tips.length > 0) {
    validationTips.value.set(fragmentId, tips.join('；'))
  } else {
    validationTips.value.delete(fragmentId)
  }
}

// 监听片段变化，实时验证
watch(() => fragments.value, (newFragments) => {
  newFragments.forEach(fragment => {
    const tips = validateFragment(fragment)
    updateValidationTips(fragment.id, tips)
  })
}, { deep: true })

// ================== 快捷键提示浮窗 ==================
const _showShortcutHintMessage = (text: string, duration: number = 2000) => {
  shortcutHintText.value = text
  showShortcutHint.value = true
  
  if (shortcutHintTimer.value) {
    clearTimeout(shortcutHintTimer.value)
  }
  
  shortcutHintTimer.value = window.setTimeout(() => {
    showShortcutHint.value = false
    shortcutHintText.value = ''
  }, duration)
}

// 构建完整的视频生成提示词
const buildFullVideoPrompt = (fragment: SceneFragment): string => {
  let prompt = fragment.videoPrompt
  
  // 确保包含角色形象
  if (fragment.characterAppearance.description) {
    if (!prompt.includes(fragment.characterAppearance.description)) {
      prompt = `${t('dramaScript.promptBuildCharacterAppearance')}${fragment.characterAppearance.description}。${prompt}`
    }
  }
  
  // 确保包含声音信息
  if (fragment.voice.description) {
    if (!prompt.includes(fragment.voice.description)) {
      prompt = `${prompt} ${t('dramaScript.promptBuildVoiceStyle')}${fragment.voice.description}。`
    }
  }
  
  // 确保包含场景信息
  if (fragment.scene && !prompt.includes(fragment.scene)) {
    prompt = `${t('dramaScript.promptBuildScene')}${fragment.scene}。${prompt}`
  }
  
  return prompt
}

// 视频帧提取
const onVideoLoaded = (fragment: SceneFragment) => {
  // 视频加载完成，保存时长
  const video = document.querySelector(`video[src="${fragment.videoUrl}"]`) as HTMLVideoElement
  if (video) {
    fragment.videoDuration = video.duration
    onFragmentChange(fragment)
  }
}

// 格式化视频时长
const formatVideoDuration = (duration: number): string => {
  if (!duration || isNaN(duration)) return ''
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = Math.floor(duration % 60)
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// 解析视频时长（从格式化的字符串解析回秒数）
const parseVideoDuration = (durationStr: string): number | undefined => {
  if (!durationStr || !durationStr.trim()) return undefined
  
  // 格式：HH:MM:SS 或 MM:SS
  const parts = durationStr.trim().split(':').map(p => parseInt(p))
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  
  return undefined
}

// 打开视频全屏
const openVideoFullscreen = (fragment: SceneFragment) => {
  if (!fragment.videoUrl) return

  // 如果已有全屏视频打开，先关闭
  if (fullscreenWrapper) closeVideoFullscreen()

  // 创建全屏视频播放器
  const fullscreenDiv = document.createElement('div')
  fullscreenDiv.className = 'video-fullscreen-wrapper'
  fullscreenDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: var(--color-black-95);
    z-index: var(--z-loading);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `

  const video = document.createElement('video')
  video.src = fragment.videoUrl
  video.controls = true
  video.autoplay = true
  video.style.cssText = 'max-width: 100%; max-height: 100%;'

  fullscreenDiv.appendChild(video)
  document.body.appendChild(fullscreenDiv)
  fullscreenWrapper = fullscreenDiv

  // 关闭全屏视频：移除 DOM + 移除所有监听器
  const closeFullscreen = () => {
    video.pause()
    if (fullscreenDiv.parentNode) document.body.removeChild(fullscreenDiv)
    if (fullscreenEscHandler) {
      document.removeEventListener('keydown', fullscreenEscHandler)
      fullscreenEscHandler = null
    }
    fullscreenWrapper = null
  }

  // 点击背景关闭
  const handleClick = (e: MouseEvent) => {
    if (e.target === fullscreenDiv) closeFullscreen()
  }
  fullscreenDiv.addEventListener('click', handleClick)

  // ESC键关闭
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeFullscreen()
  }
  fullscreenEscHandler = handleEsc
  document.addEventListener('keydown', handleEsc)

  // 视频播放完成后清理
  const handleEnded = () => {
    setTimeout(() => {
      if (document.body.contains(fullscreenDiv)) closeFullscreen()
    }, 2000)
  }
  video.addEventListener('ended', handleEnded)
}

// 关闭全屏视频（供 onUnmounted 调用）
const closeVideoFullscreen = () => {
  if (!fullscreenWrapper) return
  const video = fullscreenWrapper.querySelector('video')
  if (video) video.pause()
  if (fullscreenWrapper.parentNode) document.body.removeChild(fullscreenWrapper)
  if (fullscreenEscHandler) {
    document.removeEventListener('keydown', fullscreenEscHandler)
    fullscreenEscHandler = null
  }
  fullscreenWrapper = null
}

// 下载视频
const downloadVideo = (fragment: SceneFragment) => {
  if (!fragment.videoUrl) {
    ElMessage.warning(t('dramaScript.noVideo'))
    return
  }
  
  try {
    const link = document.createElement('a')
    link.href = fragment.videoUrl
    link.download = `${t('dramaScript.downloadFragmentPrefix')}_${fragment.sequence}_${fragment.character || t('dramaScript.unknownCharacter')}_${new Date().getTime()}.mp4`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success(t('dramaScript.downloadStarted'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.downloadFailed'))
  }
}

const extractLastFrame = async (fragment: SceneFragment) => {
  if (!fragment.videoUrl) {
    ElMessage.warning(t('dramaScript.noVideo'))
    return
  }
  
  fragment.extractingFrame = true
  onFragmentChange(fragment)
  
  try {
    // 使用Canvas提取视频最后一帧
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = fragment.videoUrl
    
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        // 保存视频时长
        if (!fragment.videoDuration) {
          fragment.videoDuration = video.duration
        }
        // 跳转到最后一帧
        video.currentTime = Math.max(0, video.duration - 0.1)
      }
      
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            reject(new Error(t('dramaScript.canvasContextError')))
            return
          }
          
          ctx.drawImage(video, 0, 0)
          const imageDataUrl = canvas.toDataURL('image/png')
          
          // 上传图片到服务器
          const blob = dataURLtoBlob(imageDataUrl)
          const file = new File([blob], 'last-frame.png', { type: 'image/png' })
          uploadFormFile(file).then(uploadResponse => {
            if (uploadResponse.success && uploadResponse.data?.url) {
              fragment.lastFrameImage = uploadResponse.data.url
              onFragmentChange(fragment)
              
              // 更新角色库中的形象（如果有）
              if (fragment.characterAppearance.characterId) {
                const character = characters.value.find(c => c.id === fragment.characterAppearance.characterId)
                if (character && !character.appearance.imageUrl) {
                  character.appearance.imageUrl = uploadResponse.data.url
                  saveCharacters()
                }
              }
              
              ElMessage.success(t('dramaScript.frameExtracted'))
              resolve()
            } else {
              reject(new Error(t('dramaScript.imageUploadFailedError')))
            }
          }).catch(reject)
        } catch (error) {
          reject(error)
        }
      }
      
      video.onerror = () => {
        reject(new Error(t('dramaScript.videoLoadFailedError')))
      }
    })
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    ElMessage.error(t('dramaScript.frameExtractFailed'))
  } finally {
    fragment.extractingFrame = false
    onFragmentChange(fragment)
  }
}

// 工具函数：DataURL转Blob
const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1] || '')
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

// 一键生成下段视频（自动生成并开始）
const generateNextFragment = async () => {
  if (fragments.value.length === 0) {
    ElMessage.warning(t('dramaScript.noFragments'))
    return
  }
  
  // 获取最后一段
  const lastFragment = fragments.value[fragments.value.length - 1]
  
  // 检查上一段是否已完成
  if (lastFragment.status !== 'completed') {
    ElMessage.warning(t('dramaScript.previousNotCompleted'))
    return
  }
  
  // 创建新片段
  const newFragment: SceneFragment = {
    id: `fragment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sequence: fragments.value.length + 1,
    character: lastFragment.character || '', // 继承人物
    scene: lastFragment.scene || '', // 可以继承场景或留空
    description: '', // 需要用户填写
    firstFramePrompt: '',
    videoPrompt: '',
    characterAppearance: {
      characterId: lastFragment.characterAppearance.characterId,
      imageUrl: lastFragment.characterAppearance.imageUrl,
      description: lastFragment.characterAppearance.description,
    },
    voice: {
      characterId: lastFragment.voice.characterId,
      voiceId: lastFragment.voice.voiceId,
      description: lastFragment.voice.description,
    },
    usePreviousLastFrame: true, // 默认勾选参考上一段
    status: 'pending',
    progress: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  fragments.value.push(newFragment)
  saveData()
  
  // 提示用户填写信息
  ElMessage.success(t('dramaScript.nextFragmentCreated'))
  
  // 自动滚动到新行并聚焦到描述字段
  nextTick(() => {
    const newRow = excelContainerRef.value?.querySelector(`[data-fragment-id="${newFragment.id}"]`)
    if (newRow) {
      newRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 尝试聚焦到描述输入框，方便用户直接输入
      const descriptionInput = newRow.querySelector('.col-description textarea') as HTMLTextAreaElement
      if (descriptionInput) {
        setTimeout(() => {
          descriptionInput.focus()
        }, 300)
      }
    }
  })
}

// 数据持久化
const onFragmentChange = (fragment: SceneFragment) => {
  fragment.updatedAt = new Date().toISOString()
  // 使用节流保存，避免频繁保存
  throttledSaveData()
  
  // 自动保存/更新角色信息（确保角色一致性）
  if (fragment.character) {
    // 查找或创建角色
    let character = characters.value.find(c => c.name === fragment.character)
    
    if (!character) {
      // 创建新角色
      character = {
        id: `character-${Date.now()}`,
        name: fragment.character,
        appearance: {
          imageUrl: fragment.characterAppearance.imageUrl,
          description: fragment.characterAppearance.description,
        },
        voice: {
          voiceId: fragment.voice.voiceId,
          description: fragment.voice.description,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      characters.value.push(character)
    } else {
      // 更新现有角色（合并信息，保留已有数据）
      if (fragment.characterAppearance.imageUrl && !character.appearance.imageUrl) {
        character.appearance.imageUrl = fragment.characterAppearance.imageUrl
      }
      if (fragment.characterAppearance.description && !character.appearance.description) {
        character.appearance.description = fragment.characterAppearance.description
      }
      if (fragment.voice.voiceId && !character.voice.voiceId) {
        character.voice.voiceId = fragment.voice.voiceId
      }
      if (fragment.voice.description && !character.voice.description) {
        character.voice.description = fragment.voice.description
      }
      character.updatedAt = new Date().toISOString()
    }
    
    // 更新片段中的角色ID引用
    fragment.characterAppearance.characterId = character.id
    fragment.voice.characterId = character.id
    
    saveCharacters()
  }
  
  // 使用节流保存，避免频繁保存
  throttledSaveData()
}

// 节流保存（必须在saveData之前定义，使用组件作用域的saveTimer和isSaving）
let saveTimer: ReturnType<typeof setTimeout> | null = null
const throttledSaveData = () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  isSaving.value = true
  saveTimer = setTimeout(() => {
    try {
      saveData()
      saveCharacters()
    } catch (error) {
      logger.error(t('common.errors.saveFailed'), error)
      ElMessage.error(t('dramaScript.saveFailed'))
    } finally {
      isSaving.value = false
      saveTimer = null
    }
  }, 1000) // 1秒后保存
}

const saveData = () => {
  try {
    // 验证数据完整性
    const validFragments = fragments.value.filter(f => f.id && f.sequence)
    if (validFragments.length !== fragments.value.length) {
      logger.warn('Invalid fragments detected and filtered')
    }
    
    localStorage.setItem('drama-script-fragments', JSON.stringify(validFragments))
    lastSavedTime.value = new Date()
    
    // 更新fragments，移除无效数据
    if (validFragments.length !== fragments.value.length) {
      fragments.value = validFragments
      // 重新排序
      fragments.value.forEach((f, i) => {
        f.sequence = i + 1
      })
    }
  } catch (error: unknown) {
    logger.error(t('common.errors.saveFailed'), error)
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      ElMessage.error(t('dramaScript.storageQuotaExceeded'))
    } else {
      ElMessage.error(t('dramaScript.saveFailed'))
    }
  }
}

// 清空所有数据
const clearAllData = async () => {
  try {
    await ElMessageBox.confirm(
      t('dramaScript.clearAllConfirm'),
      t('dramaScript.clearAll'),
      {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        dangerouslyUseHTMLString: false,
      }
    )
    
    fragments.value = []
    selectedFragments.value = []
    searchKeyword.value = ''
    filterCharacter.value = ''
    filterStatus.value = ''
    saveData()
    
    ElMessage.success(t('dramaScript.clearAllSuccess'))
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error(t('common.errors.operationFailed'), error)
    }
  }
}

const loadData = async () => {
  try {
    const saved = localStorage.getItem('drama-script-fragments')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        throw new Error(t('dramaScript.dataFormatError'))
      }
      
      // 验证和修复数据格式，添加缺失字段
      interface FragmentData {
        id?: string
        sequence?: number
        character?: string
        scene?: string
        description?: string
        firstFramePrompt?: string
        videoPrompt?: string
        characterAppearance?: {
          characterId?: unknown
          imageUrl?: unknown
          description?: unknown
        }
        voice?: {
          characterId?: unknown
          voiceId?: unknown
          description?: unknown
        }
        videoUrl?: unknown
        videoDuration?: unknown
        lastFrameImage?: unknown
        usePreviousLastFrame?: unknown
        status?: unknown
        progress?: unknown
        extractingFrame?: unknown
        createdAt?: unknown
        updatedAt?: unknown
        [key: string]: unknown
      }
      fragments.value = parsed
        .filter((f: unknown): f is FragmentData => f !== null && typeof f === 'object' && 'id' in f) // 过滤无效数据
        .map((f: FragmentData): SceneFragment => ({
          id: f.id || `fragment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sequence: typeof f.sequence === 'number' ? f.sequence : 0,
          character: String(f.character || ''),
          scene: String(f.scene || ''),
          description: String(f.description || ''),
          firstFramePrompt: String(f.firstFramePrompt || ''),
          videoPrompt: String(f.videoPrompt || ''),
          characterAppearance: {
            characterId: typeof f.characterAppearance?.characterId === 'string' ? f.characterAppearance.characterId : undefined,
            imageUrl: typeof f.characterAppearance?.imageUrl === 'string' ? f.characterAppearance.imageUrl : undefined,
            description: String(f.characterAppearance?.description || ''),
          },
          voice: {
            characterId: typeof f.voice?.characterId === 'string' ? f.voice.characterId : undefined,
            voiceId: typeof f.voice?.voiceId === 'string' ? f.voice.voiceId : undefined,
            description: String(f.voice?.description || ''),
          },
          videoUrl: typeof f.videoUrl === 'string' ? f.videoUrl : undefined,
          videoDuration: typeof f.videoDuration === 'number' ? f.videoDuration : undefined,
          lastFrameImage: typeof f.lastFrameImage === 'string' ? f.lastFrameImage : undefined,
          usePreviousLastFrame: f.usePreviousLastFrame === true,
          status: (['pending', 'generating', 'completed', 'failed'].includes(String(f.status)) ? String(f.status) : 'pending') as 'pending' | 'generating' | 'completed' | 'failed',
          progress: typeof f.progress === 'number' ? Math.min(100, Math.max(0, f.progress)) : undefined,
          extractingFrame: f.extractingFrame === true,
          createdAt: String(f.createdAt || new Date().toISOString()),
          updatedAt: String(f.updatedAt || new Date().toISOString()),
        }))
      
      // 按序号排序
      fragments.value.sort((a, b) => a.sequence - b.sequence)
      
      // 重新分配序号，确保连续
      fragments.value.forEach((f, i) => {
        f.sequence = i + 1
      })
      
      if (fragments.value.length > 0) {
        logger.info(`Successfully loaded ${fragments.value.length} fragments`)
        // 静默加载，不在每次打开时都显示提示（避免干扰）
        // 只在首次加载或手动刷新时显示
      } else {
        logger.info('No saved fragment data')
      }
    } else {
      logger.info('No fragment data in local storage')
    }
  } catch (error: unknown) {
    logger.error(t('common.errors.fetchFailed'), error)
    ElMessage.error(t('dramaScript.loadFailed'))
    fragments.value = []
    
    // 询问是否清除损坏的数据
    try {
      await ElMessageBox.confirm(
        t('dramaScript.dataCorrupted'),
        t('common.confirm'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        }
      )
      localStorage.removeItem('drama-script-fragments')
      fragments.value = []
      ElMessage.success(t('dramaScript.dataCleared'))
    } catch (confirmError: unknown) {
      // 用户取消，保持当前状态（空数组）
      if (confirmError !== 'cancel') {
        logger.error(t('common.errors.operationFailed'), confirmError)
      }
    }
  }
  
  loadCharacters()
}

const saveCharacters = () => {
  try {
    localStorage.setItem('drama-script-characters', JSON.stringify(characters.value))
  } catch (error) {
    logger.error(t('common.errors.saveFailed'), error)
  }
}

const loadCharacters = () => {
  try {
    const saved = localStorage.getItem('drama-script-characters')
    if (saved) {
      characters.value = JSON.parse(saved)
    }
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
  }
}

// 导入导出
const exportToExcel = async () => {
  try {
    // 构建Excel数据
    type ExcelCellValue = string | number | boolean | null | undefined
    const excelData: ExcelCellValue[][] = []
    
    // 表头（15列）
    excelData.push([
      t('dramaScript.excelHeader'),
      t('dramaScript.excelHeaderCharacter'),
      t('dramaScript.excelHeaderScene'),
      t('dramaScript.excelHeaderDescription'),
      t('dramaScript.excelHeaderFirstFramePrompt'),
      t('dramaScript.excelHeaderVideoPrompt'),
      t('dramaScript.excelHeaderCharAppearance'),
      t('dramaScript.excelHeaderCharImage'),
      t('dramaScript.excelHeaderVoiceDescription'),
      t('dramaScript.excelHeaderVoiceId'),
      t('dramaScript.excelHeaderVideoUrl'),
      t('dramaScript.excelHeaderVideoDuration'),
      t('dramaScript.excelHeaderLastFrame'),
      t('dramaScript.excelHeaderRefLastFrame'),
      t('dramaScript.excelHeaderStatus'),
    ])
    
    // 数据行
    fragments.value.forEach(fragment => {
      excelData.push([
        fragment.sequence,
        fragment.character,
        fragment.scene,
        fragment.description,
        fragment.firstFramePrompt,
        fragment.videoPrompt,
        fragment.characterAppearance.description,
        fragment.characterAppearance.imageUrl || '',
        fragment.voice.description,
        fragment.voice.voiceId || '',
        fragment.videoUrl || '',
        fragment.videoDuration ? formatVideoDuration(fragment.videoDuration) : '',
        fragment.lastFrameImage || '',
        fragment.usePreviousLastFrame ? '是' : '否',
        getStatusLabel(fragment.status),
      ])
    })
    
    // 使用 exceljs 创建 Excel 工作簿
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(t('dramaScript.fileNamePrefix'))
    
    // 添加数据
    excelData.forEach(row => {
      ws.addRow(row)
    })
    
    // 设置列宽（15列）
    const colWidths = [8, 12, 15, 30, 40, 50, 30, 50, 20, 15, 50, 12, 50, 18, 12]
    ws.columns.forEach((col, index) => {
      if (colWidths[index]) {
        col.width = colWidths[index]
      }
    })
    
    // 冻结首行
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    
    // 设置表头样式
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    
    // 导出为Excel文件
    const fileName = `${t('dramaScript.fileNamePrefix')}_${new Date().toISOString().split('T')[0]}.xlsx`
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success(t('dramaScript.exportSuccess'))
  } catch (error) {
    logger.error(t('common.errors.exportFailed'), error)
    ElMessage.error(t('dramaScript.exportFailed'))
  }
}

const importFromExcel = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv,.xlsx,.xls'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      type ExcelCellValue = string | number | boolean | null | undefined
      let data: ExcelCellValue[][]
      
      if (fileExtension === 'csv') {
        // CSV文件处理
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          ElMessage.warning(t('dramaScript.importFileInvalid'))
          return
        }
        
        data = lines.map(line => {
          // 简单的CSV解析（处理引号内的逗号）
          const cells: string[] = []
          let currentCell = ''
          let inQuotes = false
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                currentCell += '"'
                i++ // 跳过下一个引号
              } else {
                inQuotes = !inQuotes
              }
            } else if (char === ',' && !inQuotes) {
              cells.push(currentCell)
              currentCell = ''
            } else {
              currentCell += char
            }
          }
          cells.push(currentCell) // 最后一个单元格
          return cells
        })
      } else {
        // Excel文件处理（.xlsx, .xls）- 使用 exceljs
        const arrayBuffer = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(arrayBuffer)
        
        // 读取第一个工作表
        const worksheet = workbook.worksheets[0]
        
        // 转换为数组格式
        data = []
        worksheet.eachRow((row, _rowNumber) => {
          const rowData: ExcelCellValue[] = []
          row.eachCell({ includeEmpty: true }, (cell, _colNumber) => {
            // 获取单元格值，处理不同类型
            const value = cell.value
            if (value === null || value === undefined) {
              rowData.push('')
            } else if (typeof value === 'object' && 'text' in value) {
              // 富文本
              rowData.push(value.text || '')
            } else if (typeof value === 'object' && 'result' in value) {
              // 公式
              rowData.push(value.result?.toString())
            } else {
              rowData.push(value.toString())
            }
          })
          data.push(rowData)
        })
      }
      
      if (data.length < 2) {
        ElMessage.warning(t('dramaScript.importFileInvalid'))
        return
      }
      
      // 跳过表头
      const dataRows = data.slice(1)
      const importedFragments: SceneFragment[] = []
      
      dataRows.forEach((row, index) => {
        // 兼容旧格式（14列）和新格式（15列，包含视频时长）
        if (row.length >= 14) {
          const fragment: SceneFragment = {
            id: `fragment-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            sequence: parseInt(String(row[0] || index + 1)) || index + 1,
            character: String(row[1] || ''),
            scene: String(row[2] || ''),
            description: String(row[3] || ''),
            firstFramePrompt: String(row[4] || ''),
            videoPrompt: String(row[5] || ''),
            characterAppearance: {
              description: String(row[6] || ''),
              imageUrl: row[7] ? String(row[7]) : undefined,
            },
            voice: {
              description: String(row[8] || ''),
              voiceId: row[9] ? String(row[9]) : undefined,
            },
            videoUrl: row[10] ? String(row[10]) : undefined,
            videoDuration: row.length >= 15 && row[11] ? parseVideoDuration(String(row[11])) : undefined,
            lastFrameImage: row.length >= 15 ? (row[12] ? String(row[12]) : undefined) : (row[11] ? String(row[11]) : undefined),
            usePreviousLastFrame: (row.length >= 15 ? String(row[13] || '') : String(row[12] || '')).trim() === '是' || 
                                  (row.length >= 15 ? String(row[13] || '') : String(row[12] || '')).trim() === 'true' || 
                                  (row.length >= 15 ? String(row[13] || '') : String(row[12] || '')).trim() === '1',
            status: (['pending', 'generating', 'completed', 'failed'].includes(
              (row.length >= 15 ? String(row[14] || 'pending') : String(row[13] || 'pending')).trim()
            ) 
              ? (row.length >= 15 ? String(row[14] || 'pending') : String(row[13] || 'pending')).trim() as 'pending' | 'generating' | 'completed' | 'failed'
              : 'pending'),
            progress: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          importedFragments.push(fragment)
        }
      })
      
      if (importedFragments.length > 0) {
        // 询问是替换还是追加
        ElMessageBox.confirm(
          t('dramaScript.importConfirm', { count: importedFragments.length }),
          t('common.confirm'),
          {
            type: 'info',
            distinguishCancelAndClose: true,
            confirmButtonText: t('dramaScript.replace'),
            cancelButtonText: t('dramaScript.append'),
          }
        ).then(() => {
          // 替换
          fragments.value = importedFragments
          saveData()
          ElMessage.success(t('dramaScript.importSuccess', { count: importedFragments.length }))
        }).catch((action: string) => {
          if (action === 'cancel') {
            // 追加
            const maxSequence = fragments.value.length > 0 
              ? Math.max(...fragments.value.map(f => f.sequence))
              : 0
            importedFragments.forEach((f, i) => {
              f.sequence = maxSequence + i + 1
            })
            fragments.value.push(...importedFragments)
            saveData()
            ElMessage.success(t('dramaScript.importSuccess', { count: importedFragments.length }))
          }
        })
      } else {
        ElMessage.warning(t('dramaScript.importNoData'))
      }
    } catch (error) {
      logger.error(t('common.errors.importFailed'), error)
      ElMessage.error(t('dramaScript.importFailed'))
    }
  }
  input.click()
}

// 状态标签
const getStatusTagType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    completed: 'success',
    generating: 'warning',
    failed: 'danger',
    pending: 'info',
  }
  return map[status] || 'info'
}

const getStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    completed: t('dramaScript.statusCompleted'),
    generating: t('dramaScript.statusGenerating'),
    failed: t('dramaScript.statusFailed'),
    pending: t('dramaScript.statusPending'),
  }
  return map[status] || status
}

// 监听props变化
watch(() => props.visible, async (newVal) => {
  isVisible.value = newVal
  if (newVal) {
    await openDialog()
  }
})

// 键盘快捷键
const handleKeyboardShortcuts = (e: KeyboardEvent) => {
  // 只在对话框可见且未在输入框中时响应
  if (!isVisible.value || isMinimized.value) return
  if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
    return
  }
  
  // Ctrl/Cmd + N: 新增片段
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    addFragment()
    return
  }
  
  // Ctrl/Cmd + D: 删除选中
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault()
    if (selectedFragments.value.length > 0) {
      deleteSelectedFragments()
    }
    return
  }
  
  // Ctrl/Cmd + S: 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveData()
    saveCharacters()
    ElMessage.success(t('dramaScript.saved'))
    return
  }
  
  // Ctrl/Cmd + E: 导出Excel
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault()
    exportToExcel()
    return
  }
  
  // Ctrl/Cmd + I: 导入Excel
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault()
    importFromExcel()
    return
  }
  
  // Delete: 删除选中
  if (e.key === 'Delete' && selectedFragments.value.length > 0) {
    e.preventDefault()
    deleteSelectedFragments()
    return
  }
  
  // Ctrl/Cmd + A: 全选/取消全选
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    toggleSelectAll(!allSelected.value)
    return
  }
  
  // Ctrl/Cmd + /: 显示快捷键提示
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault()
    showKeyboardShortcuts()
    return
  }
}

// 显示快捷键提示
const showKeyboardShortcuts = () => {
  ElMessageBox.alert(
    `<div style="text-align: left; line-height: 2;">
      <div><strong>Ctrl/Cmd + N</strong>: ${t('dramaScript.newFragment')}</div>
      <div><strong>Ctrl/Cmd + D</strong>: ${t('dramaScript.deleteSelected')}</div>
      <div><strong>Ctrl/Cmd + S</strong>: ${t('dramaScript.save')}</div>
      <div><strong>Ctrl/Cmd + E</strong>: ${t('dramaScript.export')}</div>
      <div><strong>Ctrl/Cmd + I</strong>: ${t('dramaScript.import')}</div>
      <div><strong>Ctrl/Cmd + A</strong>: ${t('dramaScript.selectAllToggle')}</div>
      <div><strong>Delete</strong>: ${t('dramaScript.deleteSelected')}</div>
      <div><strong>Ctrl/Cmd + /</strong>: ${t('dramaScript.showShortcuts')}</div>
    </div>`,
    t('dramaScript.keyboardShortcuts'),
    {
      dangerouslyUseHTMLString: true,
      type: 'info',
    }
  )
}

// 显示操作指南
const _showOperationGuide = () => {
  ElMessageBox.alert(
    `<div style="text-align: left; line-height: 2;">
      <div>${t('dramaScript.guideStep1')}</div>
      <div>${t('dramaScript.guideStep2')}</div>
      <div>${t('dramaScript.guideStep3')}</div>
      <div>${t('dramaScript.guideStep4')}</div>
      <div>${t('dramaScript.guideStep5')}</div>
      <div>${t('dramaScript.guideStep6')}</div>
      <div>${t('dramaScript.guideStep7')}</div>
      <div>${t('dramaScript.guideStep8')}</div>
    </div>`,
    t('dramaScript.operationGuide'),
    {
      dangerouslyUseHTMLString: true,
      type: 'info',
      width: '500px',
    }
  )
}

// 生命周期
onMounted(async () => {
  try {
    const saved = localStorage.getItem('drama-script-enhanced-mode')
    useEnhancedMode.value = saved !== null ? saved === 'true' : true
  } catch {
    useEnhancedMode.value = true
  }
  
  // 初始化快捷键管理器
  initShortcuts()
  
  // 注册键盘快捷键（保留原有的）
  document.addEventListener('keydown', handleKeyboardShortcuts)
  
  // 注册快速预览键盘事件
  document.addEventListener('keydown', handleQuickPreviewKeyboard)
  
  // 注册网络状态监听
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  // 监听容器尺寸变化
  window.addEventListener('resize', updateContainerHeight)
  nextTick(() => updateContainerHeight())
  
  // 初始化历史记录（保存初始状态）
  historyManager.value.pushState('init', t('dramaScript.initialState'), fragments.value, characters.value, [])
  // 如果初始可见，加载数据
  if (props.visible) {
    await openDialog()
  }
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { stopDrag(); stopResize() })
cleanup.add(() => {
  document.removeEventListener('keydown', handleKeyboardShortcuts)
  document.removeEventListener('keydown', handleQuickPreviewKeyboard)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  window.removeEventListener('resize', updateContainerHeight)
})
cleanup.add(() => { if (videoRetryTimer !== null) { clearTimeout(videoRetryTimer); videoRetryTimer = null } })
cleanup.add(() => closeVideoFullscreen())
cleanup.add(() => {
  activeVideoSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
  })
  activeVideoSockets.clear()
})
cleanup.add(() => {
  if (contextMenuCloseHandler) {
    document.removeEventListener('click', contextMenuCloseHandler)
    document.removeEventListener('contextmenu', contextMenuCloseHandler)
    contextMenuCloseHandler = null
  }
})
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
cleanup.add(() => { if (dialogDragRafId !== null) { cancelAnimationFrame(dialogDragRafId); dialogDragRafId = null } })
cleanup.add(() => { if (shortcutManager.value) { shortcutManager.value.unmount() } })
cleanup.add(() => { if (autoSaveTimer.value) { clearTimeout(autoSaveTimer.value) } })
cleanup.add(() => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null } })
// 最终保存
cleanup.add(() => { saveData(); saveCharacters() })

// 暴露方法
defineExpose({
  openDialog,
  closeDialog,
  addFragment,
  generateNextFragment,
})
</script>

<style scoped lang="scss">
.drama-script-excel-trigger {
  position: fixed;
  bottom: 100px;
  right: 30px;
  width: 56px;
  height: 56px;
  border-radius: var(--global-border-radius);
  background: var(--el-color-primary);
  color: var(--el-bg-color-page);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--global-box-shadow);
  z-index: var(--z-modal);
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: var(--global-box-shadow);
  }
  
  .trigger-icon {
    font-size: 24px;
  }
}

.drama-script-excel-wrapper {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-popover);
  
  &.is-minimized {
    .drama-script-excel-dialog {
      height: auto;
      min-height: 60px;
    }
  }
}

.drama-script-excel-dialog {
  position: absolute;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: all;
  border: var(--unified-border);
  
  &.is-dragging {
    cursor: move;
  }
  
  &.is-resizing {
    cursor: nwse-resize;
  }
}

:where(.dialog-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);
  background: var(--el-bg-color);
  cursor: move;
  user-select: none;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .header-icon {
      font-size: 20px;
      color: var(--el-color-primary);
      
      .el-icon {
        font-size: 20px;
      }
    }
    
    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .header-btn {
    color: var(--el-text-color-regular);
    
    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.dialog-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);
  background: var(--el-fill-color-lighter);
  flex-wrap: wrap;
  
  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);
  background: var(--el-bg-color);
  flex-wrap: wrap;
  gap: 8px;
  
  .statistics {
    display: flex;
    align-items: center;
    margin-left: auto;
    gap: 8px;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px;
  
  .empty-state-tips {
    margin-top: 16px;
    text-align: left;
    line-height: 1.8;
    
    .el-icon {
      margin-right: 4px;
      vertical-align: middle;
    }
  }
}

.table-hint {
  padding: 8px 16px;
  background: var(--el-fill-color-lighter);
  border-bottom: var(--unified-border-bottom);
  display: flex;
  align-items: center;
  gap: 4px;
}

.excel-container {
  flex: 1;
  overflow: auto;
  background: var(--el-bg-color);
}

.excel-table-wrapper {
  width: 100%;
  overflow: auto;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 2000px; // 确保所有列都能显示
  
  thead {
    position: sticky;
    top: 0;
    z-index: calc(var(--z-base) + 9);
    background: var(--el-bg-color);
    
    th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      color: var(--el-text-color-primary);
      border-bottom: 2px solid var(--el-border-color);
      background: var(--el-fill-color-light);
      white-space: nowrap;
    }
  }
  
  tbody {
    tr {
      border-bottom: var(--unified-border-bottom);
      transition: background 0.2s, opacity 0.2s;
      cursor: move;
      
      &:hover {
        background: var(--el-fill-color-lighter);
      }
      
      &.is-selected {
        background: var(--el-color-primary-light-9);
        border-left: var(--el-border-width-primary) solid var(--el-color-primary);
      }
      
      &.is-generating {
        background: var(--el-color-warning-light-9);
        border-left: 3px solid var(--el-color-warning);
        animation: pulse 2s infinite;
      }
      
      &.is-completed {
        background: var(--el-color-success-light-9);
        border-left: 3px solid var(--el-color-success);
      }
      
      &.is-failed {
        background: var(--el-color-danger-light-9);
        border-left: 3px solid var(--el-color-danger);
      }
      
      &[draggable="true"] {
        cursor: move;
        
        &:active {
          opacity: 0.6;
        }
      }
      
      td {
        padding: 8px;
        font-size: 13px;
        color: var(--el-text-color-regular);
        vertical-align: top;
        
        .el-input,
        .el-textarea {
          width: 100%;
        }
      }
    }
  }
  
  // 列宽定义
  .col-checkbox {
    width: 50px;
    text-align: center;
  }
  
  .col-sequence {
    width: 60px;
    text-align: center;
  }
  
  .col-character {
    width: 120px;
  }
  
  .col-scene {
    width: 150px;
  }
  
  .col-description {
    width: 200px;
    min-width: 150px;
    
    textarea {
      min-height: 60px;
    }
  }
  
  .col-first-frame {
    width: 200px;
  }
  
  .col-video-prompt {
    width: 300px;
  }
  
  .col-appearance {
    width: 200px;
  }
  
  .col-voice {
    width: 150px;
  }
  
  .col-video {
    width: 200px;
  }
  
  .col-last-frame {
    width: 120px;
  }
  
  .col-reference {
    width: 80px;
    text-align: center;
  }
  
  .col-status {
    width: 100px;
    text-align: center;
  }
  
  .col-actions {
    width: 120px;
    text-align: center;
    
    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
  }
}

.appearance-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .appearance-image {
    width: 100%;
    height: 60px;
    border-radius: var(--global-border-radius);
    object-fit: cover;
  }
}

.video-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 300px;
  
  .video-wrapper {
    position: relative;
    display: inline-block;
    
    &:hover .video-actions {
      opacity: 1;
    }
    
    .video-preview {
      width: 100%;
      max-width: 300px;
      max-height: 200px;
      border-radius: var(--global-border-radius);
      cursor: pointer;
      display: block;
      background: var(--el-fill-color-light);
    }
    
    .video-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
      background: var(--color-black-60);
      border-radius: var(--global-border-radius);
      padding: 4px;
      
      .el-button {
        color: white;
        
        &:hover {
          background: var(--color-white-20);
        }
      }
    }
  }
  
  .video-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
}

.video-fullscreen-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--color-black-95);
  z-index: var(--z-loading);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  video {
    max-width: 100%;
    max-height: 100%;
    cursor: pointer;
  }
}

.template-manager {
  .template-actions {
    margin-bottom: 16px;
  }
  
  .template-list {
    .empty-templates {
      padding: 40px 0;
    }
    
    .template-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .template-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      background: var(--el-bg-color);
      transition: all 0.2s;
      
      &:hover {
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        box-shadow: var(--global-box-shadow);
      }
      
      .template-info {
        flex: 1;
        
        .template-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--el-text-color-primary);
          margin-bottom: 8px;
        }
        
        .template-meta {
          margin-bottom: 8px;
        }
        
        .template-description {
          font-size: 14px;
          color: var(--el-text-color-regular);
          line-height: 1.5;
        }
      }
      
      .template-actions-item {
        display: flex;
        gap: 8px;
        margin-left: 16px;
      }
    }
  }
}

// 工作流管理器
.workflow-manager {
  .workflow-actions {
    margin-bottom: 16px;
  }
  
  .workflow-list {
    .empty-workflows {
      padding: 40px 0;
    }
    
    .workflow-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .workflow-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      background: var(--el-bg-color);
      transition: all 0.2s;
      cursor: pointer;
      
      &:hover {
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        box-shadow: var(--global-box-shadow);
      }
      
      &.is-selected {
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }
      
      .workflow-info {
        flex: 1;
        
        .workflow-name {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--el-text-color-primary);
        }
        
        .workflow-description {
          font-size: 14px;
          color: var(--el-text-color-regular);
          margin-bottom: 8px;
        }
        
        .workflow-steps {
          margin-top: 8px;
        }
      }
      
      .workflow-actions-item {
        display: flex;
        align-items: center;
      }
    }
  }
}

// 剧情建议器
.plot-advisor {
  .advisor-section {
    padding: 16px 0;
  }
  
  .recommendations-list,
  .conflicts-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .recommendation-item,
  .conflict-item {
    padding: 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    
    .recommendation-header,
    .conflict-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .recommendation-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--el-text-color-primary);
    }
    
    .recommendation-description,
    .conflict-description {
      font-size: 14px;
      color: var(--el-text-color-regular);
      margin-bottom: 8px;
      line-height: 1.6;
    }
    
    .recommendation-reason,
    .recommendation-effect,
    .conflict-suggestion {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      margin-top: 8px;
      line-height: 1.5;
      
      strong {
        color: var(--el-text-color-primary);
      }
    }
    
    &.severity-high {
      border-left: 4px solid var(--el-color-danger);
    }
    
    &.severity-medium {
      border-left: 4px solid var(--el-color-warning);
    }
    
    &.severity-low {
      border-left: 4px solid var(--el-color-info);
    }
  }
  
  .relations-view,
  .pacing-view {
    padding: 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    
    .relations-summary,
    .pacing-summary {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    
    h4 {
      font-size: 14px;
      font-weight: 600;
      margin: 16px 0 8px;
      color: var(--el-text-color-primary);
    }
    
    .frequency-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .relation-item,
    .pacing-issue-item {
      padding: 8px 12px;
      margin: 4px 0;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      background: var(--el-fill-color-light);
    }
  }
}

// 视频预览
.video-preview-container {
  .video-player-section {
    margin-bottom: 28px;
    
    .preview-video {
      width: 100%;
      max-height: 420px;
      background: var(--el-fill-color-darker);
      border-radius: var(--global-border-radius);
      box-shadow: var(--global-box-shadow);
    }
    
    .video-controls {
      display: flex;
      gap: 16px;
      margin-top: 16px;
      justify-content: center;
      padding: 16px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      
      .el-button {
        border-radius: var(--global-border-radius);
        padding: 10px 20px;
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: var(--global-box-shadow);
        }
      }
    }
    
    .video-timeline {
      display: flex;
      align-items: center;
      margin-top: 16px;
      padding: 12px 16px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      
      .time-display {
        font-family: var(--font-family-mono);
        font-size: 13px;
        color: var(--el-text-color-secondary);
        min-width: 80px;
        text-align: center;
        background: var(--el-bg-color);
        padding: 6px 12px;
        border-radius: var(--global-border-radius);
      }
      
      .el-slider {
        margin: 0 16px;
        
        .el-slider__runway {
          height: 8px;
          border-radius: var(--global-border-radius);
        }
        
        .el-slider__bar {
          height: 8px;
          border-radius: var(--global-border-radius);
          background: var(--el-color-primary);
        }
        
        .el-slider__button-wrapper {
          .el-slider__button {
            width: 18px;
            height: 18px;
            border-width: 3px;
          }
        }
      }
    }
  }
  
  .keyframes-section {
    margin-bottom: 28px;
    padding: 20px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      
      &::before {
        content: "\1F3AC";
      }
    }
    
    .keyframes-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      
      .keyframe-item {
        position: relative;
        cursor: pointer;
        border-radius: var(--global-border-radius);
        overflow: hidden;
        transition: all 0.3s ease;
        box-shadow: var(--global-box-shadow);
        
        &:hover {
          transform: scale(1.08) translateY(-4px);
          box-shadow: var(--global-box-shadow);
          
          .keyframe-time {
            background: var(--el-color-primary);
          }
        }
        
        img {
          width: 100%;
          height: 90px;
          object-fit: cover;
          display: block;
        }
        
        .keyframe-time {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 6px 8px;
          background: var(--color-black-75);
          color: white;
          font-size: 12px;
          text-align: center;
          font-family: var(--font-family-mono);
          transition: background 0.2s;
        }
      }
    }
  }
  
  .transition-section {
    margin-bottom: 28px;
    padding: 20px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      
      &::before {
        content: "\2728";
      }
    }
    
    .transition-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      
      .transition-tag {
        cursor: pointer;
        padding: 8px 16px;
        border-radius: var(--global-border-radius);
        font-size: 13px;
        transition: all 0.2s;
        
        &:hover {
          transform: scale(1.08);
          box-shadow: var(--global-box-shadow);
        }
        
        &.el-tag--primary {
          background: var(--el-color-primary);
          color: var(--el-bg-color-page);
          border: none;
        }
      }
    }
  }
  
  .fragment-info-section {
    padding: 20px;
    background: var(--el-color-primary-light-9);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    
    h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      
      &::before {
        content: "\1F4CB";
      }
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      
      .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        background: var(--el-bg-color);
        border-radius: var(--global-border-radius);
        
        .info-label {
          color: var(--el-text-color-secondary);
          font-size: 12px;
        }
        
        .info-value {
          color: var(--el-text-color-primary);
          font-weight: 600;
          font-size: 15px;
        }
      }
    }
  }
}

// AI辅助创作
.ai-creation-panel {
  .creation-section {
    margin-bottom: 24px;
    padding: 20px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    transition: all 0.3s ease;
    
    &:hover {
      border-color: var(--el-color-primary-light-7);
      box-shadow: var(--global-box-shadow);
    }
    
    h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      
      &::before {
        content: "";
        width: 4px;
        height: 16px;
        background: var(--el-color-primary);
        border-radius: var(--global-border-radius);
      }
    }
  }
  
  .arc-progress {
    margin-bottom: 16px;
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    
    .el-progress {
      .el-progress-bar__outer {
        height: 10px ;
        border-radius: var(--global-border-radius);
      }
      
      .el-progress-bar__inner {
        background: var(--el-color-primary);
        border-radius: var(--global-border-radius);
      }
    }
  }
  
  .arc-suggestions, .char-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
    
    .sug-tag {
      margin: 0;
      padding: 6px 14px;
      border-radius: var(--global-border-radius);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--global-box-shadow);
      }
    }
  }
  
  .continuation-card {
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    border-left: var(--el-border-width-primary) solid var(--el-color-primary);
    
    .cont-item {
      margin-bottom: 12px;
      font-size: 14px;
      line-height: 1.6;
      
      strong {
        color: var(--el-color-primary);
        margin-right: 4px;
      }
      
      &:last-of-type {
        margin-bottom: 16px;
      }
    }
    
    .el-button {
      width: 100%;
    }
  }
  
  .plot-suggestions {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .plot-card {
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-2px);
      border-color: var(--el-color-primary-light-5);
      box-shadow: var(--global-box-shadow);
    }
    
    .plot-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      
      .plot-title {
        font-weight: 600;
        font-size: 15px;
        flex: 1;
      }
    }
    
    .plot-desc {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-bottom: 12px;
      line-height: 1.6;
    }
    
    .plot-meta {
      display: flex;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px dashed var(--el-border-color-lighter);
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
  
  .char-arc-card {
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    margin-bottom: 12px;
    border: var(--unified-border);
    transition: all 0.2s;
    
    &:hover {
      border-color: var(--el-color-primary-light-7);
    }
    
    .char-name {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 8px;
      color: var(--el-color-primary);
    }
    
    .char-overall {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-bottom: 12px;
      line-height: 1.5;
    }
  }
  
  .creation-actions {
    display: flex;
    gap: 16px;
    justify-content: center;
    padding-top: 16px;
    border-top: var(--unified-border);
    margin-top: 8px;
    
    .el-button {
      min-width: 140px;
    }
  }
}

// 视频处理
.video-processing-panel {
  .processing-section {
    margin-bottom: 28px;
    padding: 20px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    
    h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      
      &::before {
        content: "";
        width: 4px;
        height: 16px;
        background: var(--el-color-success);
        border-radius: var(--global-border-radius);
      }
    }
  }
  
  .subtitle-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    
    .el-button {
      border-radius: var(--global-border-radius);
      
      &:hover {
        transform: translateY(-1px);
      }
    }
  }
  
  .subtitle-stats {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    padding: 12px 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    border-left: var(--el-border-width-primary) solid var(--el-color-primary);
  }
  
  .style-presets, .export-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    
    .style-tag, .export-tag {
      cursor: pointer;
      padding: 8px 16px;
      border-radius: var(--global-border-radius);
      font-size: 13px;
      transition: all 0.2s;
      
      &:hover {
        transform: scale(1.05);
        box-shadow: var(--global-box-shadow);
      }
    }
  }
  
  .bgm-presets, .sfx-categories {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .bgm-item, .sfx-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    font-size: 14px;
    border: var(--unified-border);
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      border-color: var(--el-color-primary-light-5);
      background: var(--el-color-primary-light-9);
      
      .bgm-name, .sfx-name {
        color: var(--el-color-primary);
      }
    }
    
    .bgm-name {
      font-weight: 500;
    }
  }
}

// 版本管理
.version-manager-panel {
  .version-actions {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: var(--unified-border-bottom);
    
    .el-button {
      border-radius: var(--global-border-radius);
      
      &--primary {
        background: var(--el-color-primary);
        border: none;
        
        &:hover {
          transform: translateY(-1px);
          box-shadow: var(--global-box-shadow);
        }
      }
    }
  }
  
  .version-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
    padding-right: 8px;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--el-border-color);
      border-radius: var(--global-border-radius);
    }
  }
  
  .version-item {
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    transition: all 0.3s ease;
    
    &:hover {
      border-color: var(--el-color-primary-light-5);
      box-shadow: var(--global-box-shadow);
    }
    
    &.is-auto {
      opacity: 0.85;
      border-style: dashed;
      
      .version-header .version-number {
        color: var(--el-text-color-secondary);
      }
    }
    
    .version-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      
      .version-number {
        font-weight: 700;
        font-size: 16px;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        padding: 4px 10px;
        border-radius: var(--global-border-radius);
      }
      
      .version-name {
        font-weight: 600;
        font-size: 15px;
        flex: 1;
      }
    }
    
    .version-meta {
      display: flex;
      gap: 20px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
      margin-bottom: 12px;
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
        
        &::before {
          content: "\2022";
          color: var(--el-border-color);
        }
        
        &:first-child::before {
          display: none;
        }
      }
    }
    
    .version-desc {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-bottom: 12px;
      padding: 10px 14px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      line-height: 1.5;
    }
    
    .version-buttons {
      display: flex;
      gap: 10px;
      padding-top: 12px;
      border-top: var(--unified-border);
      
      .el-button {
        flex: 1;
        border-radius: var(--global-border-radius);
      }
    }
  }
}

// 评论系统
:where(.comments-panel) {
  .comment-input {
    margin-bottom: 20px;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    .el-textarea {
      margin-bottom: 12px;
      
      .el-textarea__inner {
        border-radius: var(--global-border-radius);
        resize: none;
        
        &:focus {
          box-shadow: var(--global-box-shadow);
        }
      }
    }
    
    .el-button {
      width: 100%;
      border-radius: var(--global-border-radius);
    }
  }
  
  .comment-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: calc(100vh - 300px);
    overflow-y: auto;
    padding-right: 8px;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--el-border-color);
      border-radius: var(--global-border-radius);
    }
  }
  
  .comment-item {
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    transition: all 0.2s;
    
    &:hover {
      border-color: var(--el-border-color);
    }
    
    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      
      .comment-user {
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        
        &::before {
          content: "";
          width: 8px;
          height: 8px;
          background: var(--el-color-primary);
          border-radius: var(--global-border-radius);
        }
      }
      
      .comment-time {
        font-size: 12px;
        color: var(--el-text-color-placeholder);
      }
    }
    
    .comment-content {
      font-size: 14px;
      margin-bottom: 12px;
      white-space: pre-wrap;
      line-height: 1.6;
      color: var(--el-text-color-regular);
      padding: 12px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
    }
    
    .comment-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      
      .el-button {
        border-radius: var(--global-border-radius);
      }
      
      .el-tag {
        border-radius: var(--global-border-radius);
      }
    }
  }
}

// 数据分析仪表板
.analytics-dashboard {
  .analytics-header {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .analytics-section {
    margin-bottom: 24px;
    padding: 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    
    h4 {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 16px;
      color: var(--el-text-color-primary);
    }
  }
  
  .analytics-overview {
    margin-bottom: 24px;
  }
  
  .overview-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    
    @media (width <= 768px) {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .overview-card {
    padding: 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    text-align: center;
    
    .card-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--el-text-color-primary);
    }
    
    .card-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }
    
    &.success {
      border-color: var(--el-color-success);
      .card-value { color: var(--el-color-success); }
    }
    
    &.danger {
      border-color: var(--el-color-danger);
      .card-value { color: var(--el-color-danger); }
    }
    
    &.info {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      .card-value { color: var(--el-color-primary); }
    }
  }
  
  .quality-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    
    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .stat-label {
        color: var(--el-text-color-regular);
      }
    }
  }
  
  .quality-distribution {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    
    @media (width <= 768px) {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .distribution-item {
      padding: 12px;
      border-radius: var(--global-border-radius);
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .dist-label {
        font-size: 13px;
        color: var(--el-text-color-regular);
      }
      
      .dist-value {
        font-size: 18px;
        font-weight: 600;
      }
      
      &.excellent {
        background: var(--color-success-10);
        .dist-value { color: var(--el-color-success); }
      }
      
      &.good {
        background: var(--color-primary-10);
        .dist-value { color: var(--el-color-primary); }
      }
      
      &.average {
        background: var(--color-warning-10);
        .dist-value { color: var(--el-color-warning); }
      }
      
      &.poor {
        background: var(--color-danger-10);
        .dist-value { color: var(--el-color-danger); }
      }
    }
  }
  
  .breakdown-grid,
  .efficiency-grid,
  .cost-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    
    @media (width <= 768px) {
      grid-template-columns: 1fr;
    }
  }
  
  .breakdown-item,
  .efficiency-item,
  .cost-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color-lighter);
    
    .breakdown-label,
    .efficiency-label,
    .cost-label {
      font-size: 13px;
      color: var(--el-text-color-regular);
    }
    
    .breakdown-value,
    .efficiency-value,
    .cost-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .cost-usd {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      font-weight: normal;
    }
    
    &.highlight {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-5);
      
      .cost-value {
        color: var(--el-color-primary);
        font-size: 16px;
      }
    }
  }
  
  .character-stats-table,
  .time-trend-table {
    .stats-table-header,
    .trend-table-header {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr 1fr;
      gap: 8px;
      padding: 12px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      font-weight: 600;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
    
    .stats-table-row,
    .trend-table-row {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr 1fr;
      gap: 8px;
      padding: 12px;
      border-bottom: var(--unified-border-bottom);
      font-size: 14px;
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background: var(--el-fill-color-lighter);
      }
    }
  }
}

// 右键菜单
.context-menu {
  position: fixed;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  z-index: var(--z-loading);
  min-width: 180px;
  padding: 4px 0;
  backdrop-filter: blur(10px);
  
  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 14px;
    color: var(--el-text-color-primary);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    
    &:hover:not(.is-disabled) {
      background: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }
    
    &.is-disabled {
      color: var(--el-text-color-disabled);
      cursor: not-allowed;
      opacity: 0.5;
    }
    
    .el-icon {
      font-size: 16px;
    }
  }
}

.last-frame-image {
  width: 100%;
  height: 60px;
  border-radius: var(--global-border-radius);
  object-fit: cover;
}

.text-placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: nwse-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
  border-top-left-radius: var(--global-border-radius);
  color: var(--el-text-color-secondary);
  
  &:hover {
    background: var(--el-fill-color);
    color: var(--el-color-primary);
  }
}

// 右键菜单
.context-menu {
  position: fixed;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  z-index: var(--z-loading);
  min-width: 180px;
  padding: 4px 0;
  backdrop-filter: blur(10px);
  
  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 14px;
    color: var(--el-text-color-primary);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    
    &:hover:not(.is-disabled) {
      background: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }
    
    &.is-disabled {
      color: var(--el-text-color-disabled);
      cursor: not-allowed;
      opacity: 0.5;
    }
    
    .el-icon {
      font-size: 16px;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }

  50% {
    opacity: 0.8;
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
  transition: all 0.3s ease;
}

.dialog-slide-enter-from,
.dialog-slide-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

// ========== 增强样式 ==========

// 工具栏增强
.toolbar-section {
  .el-button {
    transition: all 0.2s ease;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: var(--global-box-shadow);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
}

// 卡片悬浮效果
.hover-card {
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--global-box-shadow);
  }
}

// 渐变背景卡片
.gradient-card {
  background: var(--el-color-primary-light-9);
  border: var(--unified-border);
}

// 进度条增强
.progress-enhanced {
  .el-progress-bar__outer {
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }
  
  .el-progress-bar__inner {
    background: var(--el-color-primary);
  }
}

// 统计卡片
.stat-card {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: all 0.3s ease;
  
  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--global-box-shadow);
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--el-color-primary);
    line-height: 1.2;
  }
  
  .stat-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }
  
  .stat-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-size: 12px;
    
    &.up {
      color: var(--el-color-success);
    }
    
    &.down {
      color: var(--el-color-danger);
    }
  }
}

// 时间线样式
.timeline-item {
  position: relative;
  padding-left: 24px;
  padding-bottom: 20px;
  
  &::before {
    content: "";
    position: absolute;
    left: 6px;
    top: 8px;
    width: 12px;
    height: 12px;
    border-radius: var(--global-border-radius);
    background: var(--el-color-primary);
    border: 2px solid var(--el-bg-color);
    box-shadow: var(--global-box-shadow);
  }
  
  &::after {
    content: "";
    position: absolute;
    left: 11px;
    top: 20px;
    width: 2px;
    height: calc(100% - 20px);
    background: var(--el-border-color-light);
  }
  
  &:last-child::after {
    display: none;
  }
  
  .timeline-content {
    padding: 12px 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    .timeline-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .timeline-desc {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
    
    .timeline-time {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      margin-top: 8px;
    }
  }
}

// 标签增强
.tag-enhanced {
  padding: 4px 12px;
  border-radius: var(--global-border-radius);
  font-size: 12px;
  font-weight: 500;
  
  &.tag-success {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
    border: var(--unified-border);
  }
  
  &.tag-warning {
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
    border: var(--unified-border);
  }
  
  &.tag-danger {
    background: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
    border: var(--unified-border);
  }
  
  &.tag-info {
    background: var(--el-color-info-light-9);
    color: var(--el-color-info);
    border: var(--unified-border);
  }
}

// 空状态增强
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  
  .empty-icon {
    font-size: 64px;
    color: var(--el-text-color-placeholder);
    margin-bottom: 16px;
  }
  
  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
  }
  
  .empty-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin-bottom: 24px;
    max-width: 300px;
  }
}

// 加载骨架屏
.skeleton-item {
  background: linear-gradient(90deg, 
    var(--el-fill-color-lighter) 25%, 
    var(--el-fill-color-light) 50%, 
    var(--el-fill-color-lighter) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: var(--global-border-radius);
  will-change: background-position;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

// 徽章增强
.badge-wrapper {
  position: relative;
  display: inline-flex;
  
  .badge {
    position: absolute;
    top: -8px;
    right: -8px;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    text-align: center;
    border-radius: var(--global-border-radius);
    background: var(--el-color-danger);
    color: var(--el-bg-color-page);
    
    &.badge-dot {
      min-width: 8px;
      width: 8px;
      height: 8px;
      padding: 0;
      top: -4px;
      right: -4px;
    }
  }
}

// 分割线增强
.divider-fancy {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
  
  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--el-border-color);
  }
  
  .divider-text {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }
}

// 抽屉增强样式
.el-drawer {
  .el-drawer__header {
    padding: 16px 20px;
    margin-bottom: 0;
    border-bottom: var(--unified-border-bottom);
    
    .el-drawer__title {
      font-size: 16px;
      font-weight: 600;
    }
  }
  
  .el-drawer__body {
    padding: 20px;
  }
}

// 对话框增强样式
.el-dialog {
  border-radius: var(--global-border-radius);
  overflow: hidden;
  
  .el-dialog__header {
    padding: 16px 20px;
    margin-right: 0;
    border-bottom: var(--unified-border-bottom);
    
    .el-dialog__title {
      font-size: 16px;
      font-weight: 600;
    }
  }
  
  .el-dialog__body {
    padding: 20px;
  }
  
  .el-dialog__footer {
    padding: 12px 20px 16px;
    border-top: var(--unified-border);
  }
}

// 表单增强
.form-section {
  margin-bottom: 24px;
  
  .form-section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: var(--el-border-width-primary) solid var(--el-color-primary);
    display: inline-block;
  }
}

// 响应式适配
@media (width <= 768px) {
  .ai-creation-panel,
  .video-processing-panel,
  .version-manager-panel,
  .comments-panel,
  .analytics-dashboard {
    .el-drawer__body {
      padding: 12px;
    }
  }
  
  .stat-card {
    padding: 16px;
    
    .stat-value {
      font-size: 24px;
    }
  }
  
  .creation-section,
  .processing-section {
    padding: 12px;
    margin-bottom: 16px;
  }
}

// 暗色模式适配
.dark {
  .gradient-card {
    background: var(--el-color-primary-dark-2);
  }
  
  .stat-card:hover {
    box-shadow: var(--global-box-shadow);
  }
  
  .timeline-item::before {
    box-shadow: var(--global-box-shadow);
  }
  
  .skeleton-item {
    background: linear-gradient(90deg, 
      var(--el-fill-color-darker) 25%, 
      var(--el-fill-color-dark) 50%, 
      var(--el-fill-color-darker) 75%
    );
    background-size: 200% 100%;
  }
}

// 滚动条美化
.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: var(--global-border-radius);
    
    &:hover {
      background: var(--el-border-color-darker);
    }
  }
}

// 动画效果
.animate-bounce {
  animation: bounce 0.5s ease;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

.animate-shake {
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-5px);
  }

  75% {
    transform: translateX(5px);
  }
}

.animate-pulse {
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: var(--global-box-shadow);
  }

  50% {
    box-shadow: var(--global-box-shadow);
  }
}

// 工具提示增强
.tooltip-content {
  max-width: 300px;
  line-height: 1.5;
  
  .tooltip-title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .tooltip-desc {
    font-size: 12px;
    opacity: 0.9;
  }
}

// 图标按钮组
.icon-button-group {
  display: flex;
  gap: 4px;
  
  .icon-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: all 0.2s;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-regular);
    
    &:hover {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
    
    &.active {
      background: var(--el-color-primary);
      color: var(--el-bg-color-page);
    }
  }
}

// 状态指示器
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--global-border-radius);
    background: var(--el-text-color-placeholder);

    &.status-success {
      background: var(--el-color-success);
      box-shadow: var(--global-box-shadow);
    }
    
    &.status-warning {
      background: var(--el-color-warning);
      box-shadow: var(--global-box-shadow);
    }
    
    &.status-danger {
      background: var(--el-color-danger);
      box-shadow: var(--global-box-shadow);
    }
    
    &.status-info {
      background: var(--el-color-info);
      box-shadow: var(--global-box-shadow);
    }
    
    &.status-processing {
      background: var(--el-color-primary);
      animation: status-pulse 1.5s infinite;
    }
  }
  
  .status-text {
    font-size: 13px;
  }
}

@keyframes status-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

// 快捷键对话框样式
.shortcuts-dialog {
  display: flex;
  flex-direction: column;
  gap: 24px;
  
  .shortcuts-section {
    h4 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      padding-bottom: 8px;
      border-bottom: var(--unified-border-bottom);
    }
    
    .shortcut-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed var(--el-border-color-lighter);
      
      &:last-child {
        border-bottom: none;
      }
      
      .shortcut-key {
        font-family: var(--font-family-mono);
        font-size: 12px;
        padding: 4px 8px;
        background: var(--el-fill-color-light);
        border: var(--unified-border);
        border-radius: var(--global-border-radius);
        color: var(--el-text-color-primary);
        box-shadow: var(--global-box-shadow);
      }
      
      .shortcut-desc {
        color: var(--el-text-color-regular);
        font-size: 13px;
      }
    }
  }
}

// 剧本导入对话框样式
.script-import-dialog {
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .import-input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    
    :deep(.el-textarea__inner) {
      font-family: var(--font-family-mono);
      font-size: 13px;
      line-height: 1.6;
      min-height: 200px;
    }
    
    .import-actions {
      display: flex;
      justify-content: flex-end;
    }
  }
  
  .parsed-scenes-section {
    h4 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
    
    .parsed-scene-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 300px;
      overflow-y: auto;
      padding-right: 8px;
      
      &::-webkit-scrollbar {
        width: 6px;
      }
      
      &::-webkit-scrollbar-track {
        background: var(--el-fill-color-lighter);
        border-radius: var(--global-border-radius);
      }
      
      &::-webkit-scrollbar-thumb {
        background: var(--el-border-color);
        border-radius: var(--global-border-radius);
        
        &:hover {
          background: var(--el-border-color-darker);
        }
      }
    }
    
    .parsed-scene-item {
      padding: 12px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      transition: all 0.2s;
      
      &:hover {
        border-color: var(--el-color-primary-light-5);
        box-shadow: var(--global-box-shadow);
      }
      
      .scene-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        
        .scene-title {
          font-weight: 600;
          color: var(--el-text-color-primary);
        }
      }
      
      .scene-info {
        display: flex;
        gap: 12px;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        
        span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
      
      .scene-desc {
        font-size: 13px;
        color: var(--el-text-color-regular);
        line-height: 1.5;
        margin-bottom: 8px;
      }
      
      .scene-characters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
    }
    
    .import-confirm {
      margin-top: 16px;
      display: flex;
      justify-content: center;
    }
  }
}

// 导出对话框样式
:where(.export-dialog) {
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .export-format-section {
    h4 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
    
    .format-list {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      
      .format-item {
        padding: 16px;
        background: var(--el-fill-color-lighter);
        border: 2px solid var(--el-border-color-lighter);
        border-radius: var(--global-border-radius);
        cursor: pointer;
        transition: all 0.25s;
        text-align: center;
        
        &:hover {
          border-color: var(--el-color-primary-light-5);
          background: var(--el-color-primary-light-9);
          transform: translateY(-2px);
        }
        
        &.active {
          border: var(--el-border-width-primary) solid var(--el-color-primary);
          background: var(--el-color-primary-light-9);
          box-shadow: var(--global-box-shadow);
          
          .format-name {
            color: var(--el-color-primary);
          }
        }
        
        .format-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--el-text-color-primary);
          margin-bottom: 4px;
        }
        
        .format-ext {
          font-size: 12px;
          font-family: var(--font-family-mono);
          color: var(--el-text-color-secondary);
          background: var(--el-fill-color);
          padding: 2px 8px;
          border-radius: var(--global-border-radius);
          display: inline-block;
          margin-bottom: 8px;
        }
        
        .format-desc {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          line-height: 1.4;
        }
      }
    }
  }
  
  .export-preview {
    padding: 12px 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    .preview-stats {
      display: flex;
      gap: 24px;
      justify-content: center;
      
      span {
        font-size: 14px;
        color: var(--el-text-color-regular);
      }
    }
  }
}

// 撤销/重做按钮样式
.undo-redo-group {
  display: flex;
  gap: 4px;
  
  .el-button {
    padding: 6px 8px;
    
    &:disabled {
      opacity: 0.4;
    }
  }
}

// 片段选择高亮动画
@keyframes selection-highlight {
  0% {
    background: var(--el-color-primary-light-8);
  }

  50% {
    background: var(--el-color-primary-light-6);
  }

  100% {
    background: var(--el-color-primary-light-8);
  }
}

.fragment-row.just-selected {
  animation: selection-highlight 0.5s ease;
}

// 复制/粘贴提示样式
.copy-paste-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 24px;
  background: var(--color-black-80);
  color: white;
  border-radius: var(--global-border-radius);
  font-size: 14px;
  z-index: var(--z-notification);
  animation: toast-appear 0.3s ease;
}

@keyframes toast-appear {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }

  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

// ================== 新增功能样式 ==================

// 搜索导航
.search-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: var(--unified-border);
  
  .search-count {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    min-width: 50px;
    text-align: center;
  }
}

// 自动保存状态指示器
.auto-save-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  font-size: 12px;
  margin-left: 12px;
  
  &.saving {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
  
  &.saved {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }
  
  &.error {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
  
  .is-loading {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// 网络状态
.network-status {
  margin-left: 12px;
  
  .el-icon {
    margin-right: 4px;
  }
}

// 搜索高亮
:deep(.search-highlight) {
  background: var(--el-color-warning-light-7);
  color: var(--el-color-warning-dark-2);
  padding: 0 2px;
  border-radius: var(--global-border-radius);
  font-weight: 600;
}

// 高亮的片段行
.excel-table tbody tr.is-highlighted {
  animation: highlight-pulse 1s ease-in-out 3;
  
  @keyframes highlight-pulse {
    0%, 100% {
      background: var(--el-color-warning-light-9);
    }

    50% {
      background: var(--el-color-warning-light-7);
    }
  }
}

// 搜索匹配的行
.excel-table tbody tr.is-search-match {
  background: var(--el-color-primary-light-9);
  border-left: var(--el-border-width-primary) solid var(--el-color-primary);
  
  &:hover {
    background: var(--el-color-primary-light-8);
  }
}

// 批量状态对话框
.batch-status-dialog {
  .batch-hint {
    margin-bottom: 16px;
    color: var(--el-text-color-regular);
    font-size: 14px;
  }
  
  .status-radio-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    
    .el-radio {
      height: auto;
      padding: 8px 12px;
      border-radius: var(--global-border-radius);
      transition: background 0.2s;
      
      &:hover {
        background: var(--el-fill-color-lighter);
      }
      
      .el-tag {
        margin-left: 8px;
      }
    }
  }
}

// 快速预览对话框
.quick-preview-dialog {
  :deep(.el-dialog__body) {
    padding: 16px 20px;
  }
}

:where(.quick-preview-content) {
  .preview-info {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      
      .label {
        font-size: 13px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
      
      .value {
        font-size: 13px;
        color: var(--el-text-color-primary);
        word-break: break-word;
      }
    }
  }
  
  .preview-media {
    margin-bottom: 20px;
    min-height: 300px;
    background: var(--el-fill-color);
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    
    .video-preview, .image-preview {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .preview-video {
      max-width: 100%;
      max-height: 400px;
      border-radius: var(--global-border-radius);
    }
    
    .preview-image {
      max-width: 100%;
      max-height: 400px;
      border-radius: var(--global-border-radius);
    }
    
    .no-media {
      padding: 40px;
    }
  }
  
  .preview-prompts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
    
    .prompt-section {
      padding: 12px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      
      h4 {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
      
      p {
        margin: 0;
        font-size: 12px;
        color: var(--el-text-color-regular);
        line-height: 1.6;
        max-height: 100px;
        overflow-y: auto;
      }
    }
  }
  
  .preview-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding-top: 12px;
    border-top: var(--unified-border);
    
    .nav-index {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      min-width: 60px;
      text-align: center;
    }
  }
}

// 连续性检查对话框
.continuity-check-dialog {
  max-height: 500px;
  overflow-y: auto;
  
  .no-issues {
    padding: 40px 20px;
  }
  
  .issues-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .issue-item {
    padding: 12px 16px;
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color-lighter);
    border-left: 4px solid var(--el-color-warning);
    
    &.error {
      border-left-color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
    }
    
    .issue-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      
      .issue-severity {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
    
    .issue-desc {
      font-size: 14px;
      color: var(--el-text-color-primary);
      margin-bottom: 8px;
    }
    
    .issue-suggestion {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--el-color-primary);
      margin-bottom: 8px;
    }
  }
}

// 角色统计对话框
.character-stats-dialog {
  max-height: 500px;
  overflow-y: auto;
  
  .no-stats {
    padding: 40px 20px;
  }
  
  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .stat-card {
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    .stat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      
      .stat-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }
    
    .stat-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
      
      .stat-row {
        display: flex;
        gap: 8px;
        
        .stat-label {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
        
        .stat-value {
          font-size: 12px;
          color: var(--el-text-color-primary);
        }
      }
    }
    
    .stat-bar {
      height: 8px;
      background: var(--el-fill-color);
      border-radius: var(--global-border-radius);
      overflow: hidden;
      
      .stat-bar-fill {
        height: 100%;
        background: var(--el-color-primary);
        border-radius: var(--global-border-radius);
        transition: width 0.3s ease;
      }
    }
  }
}

// 导出预览对话框
.export-preview-dialog {
  .preview-tabs {
    margin-bottom: 16px;
  }
  
  .preview-content {
    min-height: 400px;
    max-height: 500px;
    overflow: auto;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    
    pre {
      margin: 0;
      padding: 16px;
      font-family: var(--font-family-mono);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .html-preview-frame {
      width: 100%;
      height: 500px;
      border: none;
      background: var(--el-bg-color);
    }
  }
}

// 虚拟滚动容器
.virtual-scroll-container {
  position: relative;
  overflow: auto;
  
  .virtual-scroll-spacer {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    pointer-events: none;
  }
  
  .virtual-scroll-content {
    position: relative;
  }
}
</style>
