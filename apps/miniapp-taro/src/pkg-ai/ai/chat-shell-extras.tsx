// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序聊天页「端内壳」——把页内视觉节点装配进共享 ChatScreen。
 *
 * 分工(§3 共享层优先):
 * - 布局/槽位顺序/消息列表宿主 = `packages/app/src/features/chat/ChatScreen.tsx`(共享层,不判端);
 * - 本文件只做「端侧节点注入」:权限档行、上下文归因条、快捷问题、任务/MCP/goal/审批、
 *   队列条、输入区、抽屉与弹层。共享层不认识这些节点,也不做 if(端) 分支;
 * - 页内状态/回调以 `ctx` shorthand 传入(键名即页内局部名,零第二份改名)。
 *
 * 负向纪律:本文件不得出现 SSE/接口/持久化逻辑;行为一律来自页内回调或端内子件。
 */

import { Text, View, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'
import { rnRadius, taroSpacing } from '@ihui/design-tokens'
import { rpx } from '@/utils/rpx'
import { getModelContextCapacity } from '@ihui/api-client'
import { onToast } from '@/host/on-toast'
import LineIcon from '@/components/LineIcon'
import { InputArea, SkillsPopup, MaterialPopup } from '@/components'
import ChatMessageItem from './ChatMessageItem'
import MessageVersionMenu from './message-version-menu'
import ContextUsageStrip from './context-usage-strip'
import CompactionBoundaryStrip from './compaction-boundary-strip'
import { budgetStopReasonText } from '@ihui/shared/chat/budget-stop-note'
import { describeBudgetStopMeta } from './chat-cap-text'
import type { BudgetStopView } from '@/lib/chat-budget-ledger-frames'
import McpStatusStrip from './mcp-status-strip'
import TaskStatusBar from './task-status-bar'
import ToolApprovalCard from './tool-approval-card'
import QueueInteractionBar from './queue-interaction-bar'
import { ChatListHeader, ChatThinkingPlaceholder } from './chat-list-extras'
import { ModelDrawer, AgentDrawer, HistoryDrawer } from './ChatDrawers'
import AgentTipDialog from './AgentTipDialog'
import type { ChatScreenMessage, ChatScreenProps } from '@ihui/rn-app/features/chat/ChatScreen'

// 端内壳上下文:页级状态/回调按页内局部名 shorthand 传入。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChatShellCtx = Record<string, any>

/**
 * 装配共享屏 props:所有节点在共享层槽位上挂载,顺序由共享层固定
 * (header → top → list → status → queue → input → overlay)。
 */
export function buildChatShellProps(ctx: ChatShellCtx): ChatScreenProps {
  const {
    t,
    tt,
    messages,
    messageRows,
    versionList,
    businessFormTails,
    currentModelName,
    currentModel,
    models,
    modelsLoading,
    modelDrawerVisible,
    setModelDrawerVisible,
    openModelDrawer,
    selectModel,
    agent,
    chatHistories,
    historyDrawerVisible,
    setHistoryDrawerVisible,
    setAgentDrawerVisible,
    setAgentTipVisible,
    agentTipVisible,
    closeAgentTip,
    agentDrawerVisible,
    handleClearHistory,
    handleSelectHistory,
    clearChat,
    workspaceTier,
    tierText,
    latestCacheTokens,
    // 批次 3:七类上下文账本 / 压缩边界 / 预算停止终态(均由页内 SSE 或进入会话查询落 state)
    contextLedger,
    compactionBoundary,
    budgetStop,
    scrollTop,
    scrollToBottom,
    earlierHasMore,
    loadingEarlier,
    handleLoadEarlier,
    tishiShow,
    setTishiShow,
    suggestions,
    handleSuggestion,
    user,
    handleRecharge,
    favoritedMsgs,
    toggleFavorite,
    thinking,
    thinkingProgress,
    streamActivities,
    streamActivityExpanded,
    setStreamActivityExpanded,
    lastAssistantCards,
    goalNotice,
    approvalQueue,
    approvalRecords,
    approvalSending,
    handleApprovalDecision,
    sideQueue,
    terminateStream,
    handleReuse,
    handleRegenerate,
    handleLongPress,
    handleEdit,
    handleSpeak,
    setReasoningPopupContent,
    setReasoningPopupVisible,
    reasoningPopupVisible,
    reasoningPopupContent,
    selectedMaterial,
    setSelectedMaterial,
    materialDrawerVisible,
    setMaterialDrawerVisible,
    materialTab,
    setMaterialTab,
    openSkillsPopup,
    materials,
    materialsLoading,
    materialHasMore,
    handleLoadMore,
    openMaterialDrawer,
    handleMaterialUpload,
    selectMaterial,
    skillsPopupVisible,
    setSkillsPopupVisible,
    agents,
    agentsLoading,
    activeAgentId,
    selectSkill,
    inputValue,
    setInputValue,
    imgsList,
    sendMessage,
    handleImageAdd,
    handleRemoveImage,
    handleVoicePress,
    handleVoiceRelease,
    stopGeneration,
    handleSwitchMessageVersion,
    floderInputIcon,
    fileIcon,
  } = ctx

  const renderMessage = (_item: ChatScreenMessage, index: number): ReactNode => {
    const entry = versionList.items[index]
    if (!entry) return null
    const { msg, idx } = entry
    return (
      <>
        <ChatMessageItem
          msg={msg}
          onReuse={handleReuse}
          // 票59:把"点的是哪一条"传下去 —— 不给 target 时 handleRegenerate 只会
          // 落到最后一条助手消息上,给旧回答重生成就会挂错版本族。
          onRegenerate={msg.role === 'assistant' ? () => handleRegenerate(msg) : undefined}
          onLongPress={() => handleLongPress(msg, idx)}
          onEdit={msg.role === 'user' ? () => handleEdit(msg, idx) : undefined}
          isFavorited={
            msg.role === 'assistant' && !msg.error && msg.timestamp
              ? favoritedMsgs.has(String(msg.timestamp))
              : undefined
          }
          onToggleFavorite={
            msg.role === 'assistant' && !msg.error && msg.timestamp
              ? () => toggleFavorite(msg)
              : undefined
          }
          onSpeak={msg.role === 'assistant' && !msg.error ? handleSpeak : undefined}
          onOpenReasoning={
            msg.role === 'assistant' && msg.reasoning
              ? () => {
                  setReasoningPopupContent(msg.reasoning || '')
                  setReasoningPopupVisible(true)
                }
              : undefined
          }
          /* 票59:版本切换器锚在当前激活的 assistant 消息之后(与 web 气泡尾同一位置语义)。
             判族/位置读数唯一源 = @ihui/shared/chat/message-version-family,端内零第二份实现;
             节点经注入位进共享件,共享件不认识端也不判族。 */
          versionMenuSlot={
            msg.role === 'assistant' && msg.id ? (
              <MessageVersionMenu
                messages={versionList.familyRows}
                messageId={msg.id}
                onSwitch={handleSwitchMessageVersion}
              />
            ) : null
          }
        />
      </>
    )
  }

  const headerNode = (
    <View className="nav-bar safe-area-bottom" style={{ background: 'transparent' }}>
      <View className="nav-left" onClick={openModelDrawer} hoverClass="opacity-60">
        {/* 对齐 RN ChatScreen modelBar 的「{模型}: {当前模型}」:选择器此前没有字段名,只有值 */}
        <Text
          style={{
            fontSize: '22rpx',
            color: 'var(--color-muted-foreground)',
            marginRight: 'var(--spacing-xs)',
          }}
        >
          {t('chat.modelLabel')}:
        </Text>
        <Text className="nav-title">{currentModelName || t('ai.title')}</Text>
        <LineIcon
          name="chevron-down"
          size={24}
          color="var(--color-muted-foreground)"
          className="nav-arrow"
        />
      </View>
      {/* 顶栏标题位(共享屏 header 第一行是产品名,本端此前整块缺失):
          与共享屏同一视觉层级——标题居左组与入口组之间、弱化字号。
          取共享屏同一个键,端内不再自立标题文案。 */}
      <Text className="min-w-0 flex-1 truncate px-[8rpx] text-center text-body font-semibold text-foreground">
        {t('chat.title')}
      </Text>
      <View className="nav-right">
        {agent ? (
          <Text className="nav-agent" onClick={() => setAgentDrawerVisible(true)}>
            {agent.name}
          </Text>
        ) : null}
        <Text
          className="nav-history"
          style={{ fontSize: '30rpx', fontWeight: '600' }}
          onClick={() => setAgentTipVisible(true)}
        >
          ?
        </Text>
        <Image
          src={fileIcon}
          className="nav-history w-[30rpx] h-[30rpx]"
          mode="aspectFit"
          onClick={() => setHistoryDrawerVisible(true)}
        />
        {messages.length ? (
          <Text className="nav-clear" onClick={clearChat}>
            {t('ai.clear')}
          </Text>
        ) : null}
      </View>
    </View>
  )

  const topSlot = (
    <>
      {/* D111:权限档交代行(取数失败整行隐藏,不假装知道档位;缺键用端内中文兜底) */}
      {workspaceTier !== null ? (
        <View
          className="permission-tier"
          style={{ padding: `${rpx(taroSpacing.xs)} ${rpx(taroSpacing.md)}` }}
        >
          <Text style={{ fontSize: '22rpx', color: 'var(--color-muted-foreground)' }}>
            {tierText.label}: {tierText.title} · {tierText.desc}
          </Text>
        </View>
      ) : null}

      {/* 上下文占用归因条(消费共享引擎,tailPreview 语义与 web 端一致)。
          G-403:缓存两维由 onUsage 帧落到页级 state 后传入 —— 没采到时组件收 null,
          归因条显示"不可得"而非 0(与 web 端同一口径)。 */}
      {messages.length ? (
        <ContextUsageStrip
          messages={messages}
          maxTokens={currentModel ? getModelContextCapacity(currentModel) : 0}
          cacheReadTokens={latestCacheTokens.cacheReadTokens}
          cacheWriteTokens={latestCacheTokens.cacheWriteTokens}
          contextLedger={contextLedger?.ledger ?? null}
          contextLedgerTurn={contextLedger?.turnIndex ?? null}
        />
      ) : null}
      {/* 批次 3:压缩边界回看。boundary 缺席/旧会话无此能力时组件返回 null,不占位。 */}
      <CompactionBoundaryStrip boundary={compactionBoundary} />
    </>
  )

  const statusSlot = (
    <>
      {selectedMaterial ? (
        <View className="material-tag">
          <Text className="material-tag-text">{selectedMaterial.title}</Text>
          <LineIcon
            name="x"
            size={32}
            color="var(--color-muted-foreground)"
            className="material-tag-close"
            onClick={() => setSelectedMaterial(null)}
          />
        </View>
      ) : null}

      {/* 快捷按钮区(对标原 ai_assistant.vue .quick-actions-container,suggestedQuestions 横向滚动)
          仅无消息或当前 Agent 提供 suggestedQuestions 时显示 */}
      {messages.length === 0 && suggestions.length > 0 ? (
        <View className="quick-actions-container">
          <ScrollView scrollX showScrollbar={false} className="quick-actions-scroll">
            <View className="quick-actions-wrapper">
              {suggestions.map((q: string, i: number) => (
                <View
                  key={`qa-${i}`}
                  className="quick-action-btn"
                  onClick={() => handleSuggestion(q)}
                  hoverClass="opacity-60"
                >
                  <Text>{q}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* 任务进度状态条(plan_updated 驱动;共享派生层返回 null 时整体不挂载,零占位) */}
      <TaskStatusBar cards={lastAssistantCards} isStreaming={thinking} />

      {/*
        D154(2026-10-01 收口渲染面):MCP 连接状态行。数据源是共享层那一份 `mcpStatusLedger`
        (帧怎么进表由 `src/lib/user-broadcast.ts` 那条唯一接线负责,本端渲染侧只读表 ⇒ 无第二条连接)。
        空表 ⇒ 组件返回 null、零占位(连上不是要提示的事,与 TaskStatusBar 同一纪律)。
      */}
      <McpStatusStrip />

      {/*
        D152(2026-09-29 立):会话目标(goal)的服务端主副本经下行帧 `goal_updated` 到达后,
        本端以一行胶囊呈现「目标原文 + 状态档」——票面要求的是**看得见状态**这一档,
        刻意不给输入口/操作按钮(本端没有 /goal 的发起面,"看得见却改不了"是假 affordance)。
        `status:'cleared'` ⇒ describeGoalNotice 返回 null ⇒ 整行消失(幂等)。
      */}
      {goalNotice ? (
        <View
          data-testid="goal-notice-strip"
          className="mx-[20rpx] mt-[8rpx] flex flex-row items-center rounded-md bg-muted px-[16rpx] py-[8rpx]"
        >
          <Text className="text-caption font-semibold text-muted-foreground">
            {goalNotice.label}
          </Text>
          {goalNotice.objective ? (
            <Text className="ml-[12rpx] flex-1 text-caption text-foreground">
              {goalNotice.objective}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/*
        D136(2026-10-01 立,承 V4 #94/D84):高危工具审批确认卡(渲染位)。
        卡上没有"关闭"出口(审批不能被关掉绕过)。已处理记录渲染在卡体外(records),
        被拒/未生效的条目留人工放行出口(§30)。队列空且无记录 ⇒ 组件返回 null、零占位。
      */}
      <ToolApprovalCard
        request={approvalQueue[0] ?? null}
        queueCount={Math.max(0, approvalQueue.length - 1)}
        records={approvalRecords}
        sending={approvalSending}
        tt={tt}
        onDecision={(payload) => void handleApprovalDecision(payload)}
      />
    </>
  )

  const queueSlot = (
    /* D38:队列交互条(空队列返回 null,零占位);打断只停流,出队交给流结束 effect */
    <QueueInteractionBar
      items={sideQueue.items}
      streaming={thinking}
      mode={sideQueue.mode}
      // G-171a:待决审批事实喂入许可门(真实来源 = approvalQueue 非空)
      awaitingApproval={approvalQueue.length > 0}
      onReorder={sideQueue.reorder}
      onUndo={(itemId) => {
        const removed = sideQueue.remove(itemId)
        if (removed) setInputValue(removed)
      }}
      onEdit={sideQueue.edit}
      onInterruptAndRun={(plan) => {
        if (plan.stopFirst) terminateStream()
      }}
      onModeChange={sideQueue.setMode}
    />
  )

  const inputSlot = (
    <View className="input-box-content safe-area-bottom">
      <View className="tool-icons">
        <Image
          src={floderInputIcon}
          className="tool-icon w-[40rpx] h-[40rpx]"
          mode="aspectFit"
          onClick={openMaterialDrawer}
        />
        <LineIcon
          name="brain"
          size={40}
          color="var(--color-muted-foreground)"
          className="tool-icon w-[40rpx] h-[40rpx]"
          onClick={openSkillsPopup}
        />
      </View>
      <InputArea
        variant="ai-home"
        value={inputValue}
        onInput={(text: string) => setInputValue(text)}
        placeholder={t('ai.inputPlaceholder')}
        imgsList={imgsList}
        onSend={(text: string) => sendMessage(text)}
        onImageAdd={handleImageAdd}
        onRemoveImage={handleRemoveImage}
        onVoicePress={handleVoicePress}
        onVoiceRelease={handleVoiceRelease}
        onKeyboardHeightChange={(h: number) => {
          if (h > 0) {
            // 键盘弹起时滚动到底部
            setTimeout(() => scrollToBottom(), 100)
          }
        }}
      />
      {thinking ? (
        <View className="send-btn" onClick={stopGeneration} hoverClass="opacity-60">
          <Text>{t('ai.stop')}</Text>
        </View>
      ) : null}
    </View>
  )

  const overlaySlot = (
    <>
      <ModelDrawer
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
        models={models}
        selectedId={currentModel}
        loading={modelsLoading}
        onSelect={selectModel}
      />
      <MaterialPopup
        visible={materialDrawerVisible}
        tab={materialTab}
        items={materials.map(
          (m: {
            id: string
            title: string
            coverUrl?: string
            content?: string
            createdAt?: string
          }) => ({
            id: m.id,
            title: m.title,
            thumbnail: m.coverUrl,
            content: m.content,
            createdAt: m.createdAt,
            tab: materialTab,
          }),
        )}
        loading={materialsLoading}
        hasMore={materialHasMore}
        selectedId={selectedMaterial?.id}
        onTabChange={setMaterialTab}
        onSelect={(item: {
          id: string
          title: string
          thumbnail?: string
          content?: string
          createdAt?: string
        }) =>
          selectMaterial({
            id: item.id,
            title: item.title,
            coverUrl: item.thumbnail,
            content: item.content,
            createdAt: item.createdAt,
          })
        }
        onClose={() => setMaterialDrawerVisible(false)}
        onUpload={handleMaterialUpload}
        onLoadMore={handleLoadMore}
      />
      <SkillsPopup
        visible={skillsPopupVisible}
        agents={agents}
        loading={agentsLoading}
        selectedId={activeAgentId}
        onSelect={selectSkill}
        onClose={() => setSkillsPopupVisible(false)}
      />
      <AgentDrawer
        visible={agentDrawerVisible}
        onClose={() => setAgentDrawerVisible(false)}
        agent={agent}
      />
      <HistoryDrawer
        visible={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
        histories={chatHistories}
        onSelect={handleSelectHistory}
        onClear={handleClearHistory}
      />
      <AgentTipDialog visible={agentTipVisible} onClose={closeAgentTip} />
      {reasoningPopupVisible ? (
        <View
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-black-50)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setReasoningPopupVisible(false)}
          hoverClass="opacity-60"
        >
          <View
            style={{
              width: 'calc(100% - 80rpx)',
              maxHeight: '50vh',
              background: 'var(--color-card)',
              borderRadius: rnRadius.lg,
              padding: 'var(--spacing-sm-loose)',
              overflow: 'auto',
            }}
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
            hoverClass="opacity-60"
          >
            <View
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-xs-loose)',
              }}
            >
              <Text
                style={{ fontSize: '28rpx', fontWeight: '600', color: 'var(--color-foreground)' }}
              >
                {t('ai.chatMessageItem.thinkingProcess')}
              </Text>
              <LineIcon
                name="x"
                size={32}
                color="var(--color-muted-foreground)"
                onClick={() => setReasoningPopupVisible(false)}
              />
            </View>
            <Text
              style={{
                fontSize: '24rpx',
                color: 'var(--color-foreground)',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}
            >
              {reasoningPopupContent}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  )

  return {
    t,
    messages: messageRows,
    inputText: inputValue,
    isStreaming: thinking,
    error: '',
    models,
    model: currentModel,
    pickerOpen: false,
    navItems: [],
    onInputTextChange: (v: string) => setInputValue(v),
    onSend: () => sendMessage(inputValue),
    onStop: stopGeneration,
    onModelChange: selectModel,
    onPickerOpenChange: () => undefined,
    onLongPressMessage: () => undefined,
    onNavigate: (target: string) => {
      void Taro.navigateTo({ url: target })
    },
    onToast,
    showHeader: false,
    showModelBar: false,
    showInput: false,
    renderMessage,
    renderListHeader: (
      <ChatListHeader
        t={t}
        earlierHasMore={earlierHasMore}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={handleLoadEarlier}
        agent={agent}
        tishiShow={tishiShow}
        onToggleTishi={() => setTishiShow((v: boolean) => !v)}
        suggestions={suggestions}
        onSuggestion={handleSuggestion}
        showWelcome={!messages.length}
        tokenBalance={(user as Record<string, unknown>)?.tokenBalance as number | undefined}
        isLoggedIn={!!user}
        onRecharge={handleRecharge}
      />
    ),
    renderListFooter: (
      <>
        {/* 批次 3:预算硬停止 = 会话终态的内联提示(非失败卡)。只消费 level='stopped' 的
            BudgetStopView;其后即使再来 warning 帧也不会改写该 state,提示因此不被覆盖。 */}
        {budgetStop ? (
          <View className="budget-stop-inline">
            <Text className="budget-stop-main">
              {budgetStopReasonText((budgetStop as BudgetStopView).reasonCode)}
            </Text>
            <Text className="budget-stop-meta">
              {describeBudgetStopMeta(budgetStop as BudgetStopView)}
            </Text>
          </View>
        ) : null}
        {/* W5:流式执行事件最小可视化(工具调用 / subagent / 计划 / 终端等),简化列表 + 可折叠 */}
        {streamActivities.length > 0 ? (
          <View className="msg-item assistant">
            <View className="avatar assistant">{t('ai.chatMessageItem.ai')}</View>
            <View className="bubble">
              <Text
                className="bubble-text"
                style={{ fontSize: '24rpx', color: 'var(--color-muted-foreground)' }}
                onClick={() => setStreamActivityExpanded((v: boolean) => !v)}
              >
                {t('ai.stream.title')} ({streamActivities.length}){' '}
                {streamActivityExpanded ? t('ai.chatMessageItem.collapse') : t('ai.tishi.view')}
              </Text>
              {streamActivityExpanded ? (
                <View style={{ marginTop: 'var(--spacing-xs)' }}>
                  {streamActivities.map((a: { id: string; text: string }) => (
                    <Text
                      key={a.id}
                      className="bubble-text"
                      style={{ display: 'block', fontSize: '22rpx', lineHeight: '1.6' }}
                    >
                      · {a.text}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </>
    ),
    messageListSlots: {
      className: 'msg-list',
      scrollTop,
      scrollWithAnimation: true,
      showThinkingPlaceholder: true,
      thinkingNode: <ChatThinkingPlaceholder t={t} progress={thinkingProgress} />,
      tailNodes: businessFormTails.tailNodes,
      orphanTailNode: businessFormTails.orphanTailNode,
    },
    headerNode,
    topSlot,
    statusSlot,
    queueSlot,
    inputSlot,
    overlaySlot,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
