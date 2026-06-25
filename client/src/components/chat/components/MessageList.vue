<template>
    <div class="chat-message-list">
      <div 
        class="conversation-item"
        :class="{ active: item.id === activeId }"
        v-for="item in conversationList" 
        :key="item.id"
        @click="handleClickItem(item.id)"
      >
        <div class="title">{{ item.title }}</div>
        <div class="last-msg">{{ item.lastMsg }}</div>
        <div class="time">{{ item.time }}</div>
      </div>
    </div>
  </template>

<script setup lang="ts">
import {ref}from 'vue';

interface ConversationItem {
  id: string
  title: string
  lastMsg: string
  time: string
}

const _props = defineProps<{
  conversationList: ConversationItem[]
}>()

const emit=defineEmits<{
  'change-conversation': [id:string];
}>();

const activeId=ref<string>('');


const handleClickItem=(id:string)=>{
  activeId.value=id;
  emit('change-conversation',id);
}

</script>

<style scoped>
    .chat-message-list {
      grid-area: list;
      width: 250px;
      min-height: 500px;
      height: calc(100vh - 120px);
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      overflow-y: auto;
      background-color: var(--el-fill-color-light);
    }

    .conversation-item {
      padding: 16px;
      border-bottom: var(--unified-border-bottom);
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .conversation-item:hover {
      background-color: var(--el-fill-color);
    }

    .conversation-item.active {
      background-color: var(--el-color-primary-light-9);
      border-left: 4px solid var(--border-unified-color);
    }

    .title {
      font-size: 16px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
    }

    .last-msg {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .time {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      text-align: right;
      margin-top: 4px;
    }
    </style>