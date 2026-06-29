<!-- 对话聊天页面，聊天页面主要由输入框、消息列表、输入框组成 -->

<template>
    <div class="conversation-container">
        <!-- 消息列表组件 -->
        <ChatMessageList class="chat-message-list" 
        :conversationList="conversationList">
        </ChatMessageList>

        <!-- 对话展示组件 -->
         <ChatContent class="chat-content">
         </ChatContent>

        <!-- 输入框组件 -->
        <ChatInput class="chat-input">
        </ChatInput>
    </div>


</template>

<script setup lang="ts">
import { ref } from 'vue';
import ChatMessageList from '@/components/chat/components/MessageList.vue';
import ChatContent from '@/components/chat/components/Content.vue';
import ChatInput from '@/components/chat/components/Input1.vue';

// 对话列表数据
const conversationList = ref<Array<{ id: string; title: string; messages: unknown[]; createTime: string }>>([])
</script>

<style scoped>
.conversation-container {
    width: 100%;
    height: 100vh;
    max-width: 1400px;
    margin: 0 auto;
    display: grid;
    grid-template: "list content" 1fr "list input" 80px / 280px 1fr;
    gap: 16px;
    padding: 20px;
    box-sizing: border-box;
}

.chat-list {
  grid-area: list;
}

.chat-content {
  grid-area: content;
}

.chat-input {
  grid-area: input;
  width: 100%;
  padding-bottom: 30px;
  box-sizing: border-box;
}
</style>