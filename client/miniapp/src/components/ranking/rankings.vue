<template>
	<view class="outContainer">
		<!-- 统一侧边栏：历史对话（DrawerComponentall）- 菜单按钮控制 -->
		<DrawerComponent
			ref="drawerComponent"
			:showTabbar="false"
			:tagWrapShow="historyDrawerVisible"
			:statusBarHeight="localStatusBarHeight"
			:groupedData="groupedData"
			:active_date="chat_active_date"
			:active_menu="chat_active_menu"
			:userinfo="userinfo"
			:modelList="modelList"
			@close-drawer="close_drawer"
			@go-page="gopage"
			@go-company="gotocompany"
			@lingqu="lingqu"
			@add-new-chat="addNewChat"
			@show-full-list="handleShowChatFullList"
			@touch-start="handleTouchStart"
			@touch-move="handleTouchMove"
			@touch-end="handleTouchEnd"
			@remove-chat="removeChat"
		/>
		<!-- 排行榜分类侧边栏（drawer）- 分类按钮控制 -->
		<view class="drawer-overlay" v-if="drawerVisible" @click="closeDrawer"></view>
		
		<!-- Drawer content -->
		<view class="drawer" :class="{ 'drawer-open': drawerVisible }" :style="{paddingTop:localStatusBarHeight + 'px'}">
			<!-- Drawer header with image -->
			<view class="drawer-header">
                <view class="logobox">
                <image class="logo" style="height: 66rpx;" src="/static/images/choutilogo_h.png" mode="heightFix" />
                </view>
            </view>
			
			<!-- Menu list -->
			<view class="drawer-menu">
				<view 
					v-for="(item, index) in alldataarr"
					:key="index" 
					class="menu-item"
					@click="handleShowFullList(item,index)"
				>
					<text class="menu-text" :class="index == active_menu ? 'menu_text':''">{{ item.title }}</text>
				</view>
			</view>
		</view>
		<view class="container" style="padding: 0 0">
			<!-- 引入外部 顶部导航栏 -->
			<navigation-bars ref="navbar" :showMenu="true" :showFenLei="true" :viscosity="true" :showBack="false" color="#171717" font-size-30 :title="labeltitle" @pack="backPage" @nav-click="handleNavClick" @menu-click="handleMenuClick"
				:tagWrapShow="drawerVisible" :image="showFullList ? '/static/images/back.svg' : ''" @active_nav="activeNav" />

			<!-- 内容区域（可滚动） -->
			<scroll-view class="content-scroll" scroll-y lower-threshold="130" @scrolltolower="scrolltolower">
				<!-- 切换显示 CardWithList 或 FullRankingList -->
				<template v-if="!showFullList">
					<CardWithList 
						v-for="(item, index) in items" 
						:key="index" 
						:title="item.title" 
						:items="item.items" 
						@item-click="handleItemClick"
						@more-click="handleShowFullList(item,index)"
					/>
				</template>
				<FullRankingList v-else :items="fullListItems" @item-click="handleItemClick" />
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import NavigationBars from "@/components/navigation-bars/indexb.vue";
import { getTokenCount, getTokenReturn, getAgenttokens, postContext, getUserContext } from "@/service/pay.js";
import CardWithList from "@/components/CardWithList.vue";
import FullRankingList from "@/components/FullRankingList.vue";
import { getGroupList } from "@/service/rankings.js";
import DrawerComponent from '@/components/DrawerComponentall.vue';
import { getCozeApiList } from '@/service/aiModels.js';
import { getModelChat, removeModelChat } from '@/service/ai_index.js';

const props = defineProps({
    statusBarHeight: String,
});

const emit = defineEmits(['active_nav']);

const drawerComponent = ref(null);
const navbar = ref(null);

const timer = ref(null);
const intelliReveal = ref(true);
const prompt = ref('');
const loading = ref(false);
const completedResponses = ref([]);
const checkStatusInterval = ref(null);
const savedPrompt = ref('');
const conversationMessages = ref([]);
const userAvatar = ref('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/user-avatar.png');
const botAvatar = ref('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/jiqiren-big.png');
const initialBotMessage = ref('嗨，你好！我是你的差旅助手，可以为你提供火车票、机票的预定信息哦～请输入人数、职级、出发地、目的地、起始日期，助手会根据你的职级（公司制度）自动选择交通方式。');
const currentResponse = ref(null);
const lastProcessedTimestamp = ref(0);
const scrollTop = ref(0);
const scrollTimer = ref(null);

const token = ref('');
const botId = ref('7496005323237621779');
const userId = ref('user_' + Math.random().toString(36).substring(2, 10));
const conversationId = ref('');
const chatId = ref('');
const flowId = ref('');
const tokenReturnExecuted = ref(false);
const hasPostContext = ref(false);
const userContextId = ref("");
const title = ref("排行榜");
const labeltitle = ref("排行榜");
const items = ref([]);
const drawerVisible = ref(false);
const historyDrawerVisible = ref(false);
const showFullList = ref(false);
const fullListItems = ref([]);
const datas = ref({});
const windowHeight = ref(0);
const localStatusBarHeight = ref(0);
const num = ref(0);
const alldataarr = ref([]);
const active_menu = ref(-1);

const groupedData = ref([]);
const chatAlldataarr = ref([]);
const chat_active_date = ref("0");
const chat_active_menu = ref(0);
const userinfo = reactive({
    avatar: '',
    nickname: ''
});
const modelList = ref([]);

function activeNav(index) {
    if (index == 0) {
        emit('active_nav', 0);
    }
}

function scrolltolower(event) {
    let length = items.value.length;
    if (length < alldataarr.value.length) {
        if ((items.value.length + length) > alldataarr.value.length) {
            items.value = items.value.concat(alldataarr.value.slice(length, alldataarr.value.length));
        } else {
            items.value = items.value.concat(alldataarr.value.slice(length, length + num.value));
        }
    }
}

function handleItemClick(item) {
    uni.navigateTo({
        url: `/pages/tools/ranking-detail?data=${encodeURIComponent(JSON.stringify(item))}`,
    });
}

function intelliShow() {
    intelliReveal.value = !intelliReveal.value;
    setupTimer();
}

function setupTimer() {
    timer.value = setTimeout(() => {
        intelliReveal.value = false;
    }, 3000);
}

function handleMenuClick() {
    historyDrawerVisible.value = !historyDrawerVisible.value;
}

function handleNavClick(item) {
    drawerVisible.value = !drawerVisible.value;
}

function closeDrawer() {
    drawerVisible.value = false;
}

function close_drawer() {
    historyDrawerVisible.value = false;
}

function gopage(url) {
    historyDrawerVisible.value = false;
    uni.navigateTo({
        url,
        fail: () => {
            uni.reLaunch({ url });
        }
    });
}

function gotocompany() {
    uni.navigateTo({ url: '/pages/distribution/index' });
}

function lingqu() {
    uni.setClipboardData({
        data: "https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink",
        success: () => uni.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' }),
        fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
    });
}

function addNewChat() {
    uni.navigateTo({ url: '/pages/table/aiIndex/ai_index' });
}

function handleShowChatFullList(item, index, modelIndex, dateGroupIndex) {
    historyDrawerVisible.value = false;

    chat_active_menu.value = index;
    chat_active_date.value = item && item.id ? item.id : chat_active_date.value;

    const modelName = (item && (item.source || item.model_name || item.modelName)) || '';
    const foundModel = (modelList.value || []).find(m => m && (m.name === modelName || m.source === modelName));
    const modelNameEN = (foundModel && foundModel.name) || '';
    const modelId = (foundModel && foundModel.id) || '';
    const remark = (foundModel && foundModel.remark) || '';
    const isSpecialModel = (foundModel && foundModel.source) === '智汇AI数字人' || modelName === '智汇AI数字人';
    const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2';

    let dateStr = '';
    try {
        dateStr = drawerComponent.value?.sortedGroupedData?.[modelIndex]?.dateGroups?.[dateGroupIndex]?.date || '';
    } catch (e) {}
    if (!dateStr && item && item.create_time) dateStr = String(item.create_time).split(' ')[0];

    uni.navigateTo({
        url: `/pages/tools/${targetPage}?prompt=` +
            '' +
            '&remark=' + encodeURIComponent(remark || '') +
            '&modelName=' + encodeURIComponent((foundModel && foundModel.source) || modelName || '') +
            '&modelNameEN=' + encodeURIComponent(modelNameEN || '') +
            '&modelId=' + encodeURIComponent(modelId || '') +
            '&mccd=' + encodeURIComponent(JSON.stringify({})) +
            '&modelType=' + encodeURIComponent('') +
            '&pitch=' + ((foundModel && (modelList.value || []).indexOf(foundModel)) ?? 0) +
            '&imgUrl=' + encodeURIComponent(JSON.stringify([])) +
            '&noSend=' + true +
            '&isfulllist=' + true +
            '&item=' + encodeURIComponent(item && item.field1 ? item.field1 : '') +
            '&index=' + index +
            '&date=' + encodeURIComponent(dateStr || '') +
            '&chat_id=' + encodeURIComponent(item && item.id ? item.id : '')
    });
}

function handleTouchStart() {}
function handleTouchMove() {}
function handleTouchEnd() {}

function removeChat(id) {
    let userData = uni.getStorageSync('data');
    if (!userData) userData = uni.getStorageSync('userInfo');
    removeModelChat(id).then(() => {
        loadHistoryChat();
        uni.showToast({ title: '删除成功', icon: 'success' });
    }).catch(() => {
        uni.showToast({ title: '删除失败', icon: 'error' });
    });
}

function loadHistoryChat() {
    let userData = uni.getStorageSync('data');
    if (!userData) userData = uni.getStorageSync('userInfo');
    if (!userData || !userData.uuid || !userData.thirdPartyAccounts || !userData.thirdPartyAccounts.accessToken) return;
    getModelChat({ user_uuid: userData.uuid }).then(res => {
        chatAlldataarr.value = res.data || [];
        groupDataByDate();
    }).catch(() => {
        chatAlldataarr.value = [];
        groupedData.value = [];
    });
}

function groupDataByDate() {
    groupedData.value = [];
    const dateMap = {};
    (chatAlldataarr.value || []).forEach(item => {
        const createTime = item.create_time || '';
        const date = createTime ? String(createTime).split(' ')[0] : '未知日期';
        if (!dateMap[date]) {
            dateMap[date] = { name: date, list: [] };
            groupedData.value.push(dateMap[date]);
        }
        dateMap[date].list.push({ ...item, isShow: false });
    });
}

function handleMenuItemClick(item) {
    close_drawer();
    uni.navigateTo({
        url: item.path
    });
}

function clearTimer() {
    if (timer.value) {
        clearTimeout(timer.value);
        timer.value = null;
    }
}

function backPage() {
    showFullList.value = false;
    labeltitle.value = "排行榜";
}

async function handleSendMessage() {
    hasPostContext.value = false;
    const userData = uni.getStorageSync('data');

    tokenReturnExecuted.value = false;

    const message = prompt.value;
    if (!message || !message.trim()) {
        uni.showToast({
            title: '请输入描述',
            icon: 'none'
        });
        return;
    }

    if (loading.value) {
        uni.showToast({
            title: '请等待当前请求完成',
            icon: 'none'
        });
        return;
    }

    try {
        const tokenRes = await getAgenttokens("4c797294-4d9f-11f0-8b7f-d843aeb8c23e", userData.uuid, message);
        if (tokenRes && tokenRes.code == "200") {
            token.value = tokenRes.accessToken;
            if (tokenRes.data && tokenRes.data.flowId) {
                flowId.value = tokenRes.data.flowId;
            }
            userContextId.value = tokenRes.userContextId;

            uni.setStorageSync("data", tokenRes.data);
            uni.$emit('updateTokenQuantity', tokenRes.data);
        } else {
            uni.showToast({
                title: tokenRes.msg || 'token扣除失败',
                icon: 'none'
            });
            return;
        }
    } catch (tokenError) {
        uni.showToast({
            title: tokenError.msg || 'token请求失败，请重试',
            icon: 'none'
        });
        return;
    }

    savedPrompt.value = message;
    loading.value = true;

    prompt.value = '';

    conversationMessages.value.push({
        type: 'user',
        content: message,
        timestamp: Date.now()
    });

    conversationMessages.value.push({
        type: 'loading',
        content: '正在努力生成中，请耐心等待不要退出页面哦...'
    });

    setTimeout(() => {
        scrollToBottom();
    }, 100);

    try {
        let additionalMessages = conversationMessages.value
            .filter(msg => msg.type !== 'loading')
            .map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content,
                content_type: 'text',
                type: msg.type === 'user' ? 'question' : 'answer'
            }));

        const callParams = {
            token: token.value,
            bot_id: botId.value,
            user_id: userId.value,
            additional_messages: additionalMessages,
            stream: false,
            auto_save_history: true
        };

        const result = await wx.cloud.callFunction({
            name: 'coze_chatv3_request',
            data: callParams
        });

        if (result && result.result && result.result.code === 0) {
            chatId.value = result.result.data.chat_id;

            if (result.result.data.conversation_id) {
                conversationId.value = result.result.data.conversation_id;

                try {
                    uni.setStorageSync('last_conversation_id', conversationId.value);
                } catch (e) {}
            }

            startCheckingStatus();
        } else {
            throw new Error(result && result.result ? (result.result.msg || '创建任务失败') : '创建任务失败: 返回结果格式异常');
        }
    } catch (error) {
        removeLoadingMessage();

        conversationMessages.value.push({
            type: 'bot',
            content: `生成回复失败，请稍后重试: ${error.message || '未知错误'}`,
            timestamp: Date.now()
        });

        loading.value = false;
    }
}

function resetConversation() {
    conversationId.value = '';
    chatId.value = '';

    try {
        uni.removeStorageSync('last_conversation_id');
    } catch (e) {}

    conversationMessages.value = [];

    uni.showToast({
        title: '会话已重置',
        icon: 'success'
    });
}

function removeLoadingMessage() {
    conversationMessages.value = conversationMessages.value.filter(msg => msg.type !== 'loading');
}

function startCheckingStatus() {
    if (checkStatusInterval.value) {
        clearInterval(checkStatusInterval.value);
    }

    let checkCount = 0;
    const MAX_CHECKS = 30;

    const currentChatId = chatId.value;

    checkStatusInterval.value = setInterval(async () => {
        try {
            if (checkCount >= MAX_CHECKS) {
                throw new Error('回复生成超时，请重试');
            }

            checkCount++;

            if (!currentChatId) {
                throw new Error('聊天ID不能为空');
            }

            const result = await wx.cloud.callFunction({
                name: 'coze_chatv3_is_reply_complete',
                data: {
                    token: token.value,
                    chat_id: currentChatId,
                    conversation_id: conversationId.value || 'temp_conversation_id'
                }
            });

            if (result && result.result && result.result.code === 0) {
                const status = result.result.data;

                if (status.token) {
                    const tokenUsage = {
                        total: status.token.token_count || 0
                    };
                }

                if (status.is_completed) {
                    clearInterval(checkStatusInterval.value);
                    getReply();
                }
            } else {
                throw new Error(result?.result?.msg || '获取回复状态失败');
            }
        } catch (error) {
            clearInterval(checkStatusInterval.value);
            loading.value = false;

            removeLoadingMessage();

            conversationMessages.value.push({
                type: 'bot',
                content: '检查回复状态失败，请重新发送消息: ' + (error.message || '未知错误'),
                timestamp: Date.now()
            });

            handleTokenReturn();
        }
    }, 2000);
}

async function getReply() {
    try {
        if (!chatId.value) {
            throw new Error('聊天ID不能为空');
        }

        const result = await wx.cloud.callFunction({
            name: 'coze_chatv3_get_reply',
            data: {
                token: token.value,
                chat_id: chatId.value,
                conversation_id: conversationId.value || 'temp_conversation_id'
            }
        });

        if (result && result.result && result.result.code === 0) {
            const reply = result.result.data.final_answer;

            removeLoadingMessage();

            currentResponse.value = reply;

            saveToHistory(reply);

            nextTick(() => {
                if (drawerComponent.value?.$refs?.responseFormatter) {
                    drawerComponent.value.$refs.responseFormatter.processResponse(reply);

                    uni.showToast({
                        title: '回复生成成功',
                        icon: 'success'
                    });

                    handleTokenReturn();
                } else {
                    conversationMessages.value.push({
                        type: 'bot',
                        content: reply,
                        timestamp: Date.now(),
                        showCopyButton: true
                    });
                }
            });
        } else {
            const errorMsg = result?.result?.msg || '获取回复失败';
            throw new Error(errorMsg);
        }
    } catch (error) {
        removeLoadingMessage();

        conversationMessages.value.push({
            type: 'bot',
            content: `获取回复失败，请重新发送消息: ${error.message || '未知错误'}`,
            timestamp: Date.now()
        });

        handleTokenReturn();
    } finally {
        loading.value = false;
    }
}

function processCozeBotResponse(data) {
    currentResponse.value = data;

    nextTick(() => {
        if (drawerComponent.value?.$refs?.responseFormatter) {
            drawerComponent.value.$refs.responseFormatter.processResponse(data);
        } else {
            conversationMessages.value.push({
                type: 'bot',
                content: typeof data === 'string' ? data : JSON.stringify(data),
                timestamp: Date.now(),
                showCopyButton: true
            });
        }
    });

    return {
        title: '',
        text: '',
        imageUrls: []
    };
}

function isImageUrl(url) {
    if (typeof url !== 'string') return false;
    return url.includes('http') &&
        (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i) !== null ||
            url.includes('image') ||
            url.includes('coze.cn/t-') ||
            url.includes('s.coze.cn/'));
}

function handleResponseProcessed(result) {
    if (!hasPostContext.value && userContextId.value && result.originalData) {
        postContext(userContextId.value, result.originalData, "");
        hasPostContext.value = true;
    }

    const currentTimestamp = Date.now();
    if (currentTimestamp - lastProcessedTimestamp.value < 500) {
        return;
    }
    lastProcessedTimestamp.value = currentTimestamp;

    nextTick(() => {
        removeLoadingMessage();

        const timestamp = Date.now();
        const title = result.title || '';
        const textContent = result.text || '';

        if (result.videoUrl) {
            let videoUrl = result.videoUrl;

            if (typeof videoUrl === 'object') {
                videoUrl = JSON.stringify(videoUrl);
            }

            const videoUrlPattern = /(https?:\/\/[^\s"']+\.(mp4|webm|ogg|mov|m3u8)(\?[^&\s]*)?)/i;
            const match = videoUrl.match(videoUrlPattern);
            if (match && match[0]) {
                videoUrl = match[0];
            }

            videoUrl = videoUrl.replace(/^\[+|\]+$/g, '');
            videoUrl = videoUrl.replace(/^["']+|["']+$/g, '');

            const videoContent = textContent ? textContent.replace(videoUrl, '').replace(/\[\]/, '').trim() : '';

            let cleanContent = videoContent || '';
            cleanContent = cleanContent.replace(/\[".*?"\]/g, '').replace(/\['.*?'\]/g, '').replace(/\[\s*\]/g, '');
            cleanContent = cleanContent.replace(/["'].*?["']/g, '');
            cleanContent = cleanContent.replace(/\[|\]/g, '');
            cleanContent = cleanContent.replace(/[,;:]/g, '');
            cleanContent = cleanContent.trim();
            conversationMessages.value.push({
                type: 'bot',
                content: cleanContent,
                mediaType: 'video',
                mediaUrl: videoUrl,
                timestamp: timestamp,
                showCopyButton: !!cleanContent,
                videoLoading: true,
                initialized: false,
                useSimplePlayer: true
            });

        } else if (result.imageUrls && result.imageUrls.length > 0) {
            const newMessages = result.imageUrls
                .filter(imageUrl => imageUrl && typeof imageUrl === 'string' && imageUrl.includes('http'))
                .map((imageUrl, index) => ({
                    type: 'bot',
                    mediaType: 'image',
                    mediaUrl: imageUrl,
                    timestamp: timestamp,
                    content: index === 0 && textContent ? textContent : '',
                    showCopyButton: index === 0 && !!textContent
                }));

            conversationMessages.value.push(...newMessages);
        } else if (textContent) {
            conversationMessages.value.push({
                type: 'bot',
                content: textContent,
                timestamp: timestamp,
                showCopyButton: true
            });
        } else {
            conversationMessages.value.push({
                type: 'bot',
                content: '未能获取到有效内容，请重试',
                timestamp: timestamp
            });
        }

        setTimeout(() => {
            scrollToBottom();
        }, 100);
    });
}

function handleJsonProcessed(processedData) {}

function copyText(text) {
    if (!text) return;

    uni.setClipboardData({
        data: text,
        success: function () {
            uni.showToast({
                title: '已复制',
                icon: 'success'
            });
        }
    });
}

function clearHistory() {
    uni.showModal({
        title: '确认清除',
        content: '确定要清除所有历史记录吗？',
        success: (res) => {
            if (res.confirm) {
                completedResponses.value = [];
                conversationMessages.value = [];
                conversationId.value = '';
                chatId.value = '';
                uni.showToast({
                    title: '已清除历史记录',
                    icon: 'success'
                });
            }
        }
    });
}

function scrollToBottom() {
    if (scrollTimer.value) {
        clearTimeout(scrollTimer.value);
    }
    
    scrollTop.value = 100000;
    
    scrollTimer.value = setTimeout(() => {
        scrollTop.value = Math.random() * 1000000 + 100000;
    }, 500);
}

function handleMessagesUpdated() {
    scrollToBottom();
}

function handleLinksDetected(links) {}

function saveToHistory(responseData) {
    const responseItem = {
        prompt: savedPrompt.value,
        timestamp: Date.now(),
        text: responseData
    };

    if (!completedResponses.value) {
        completedResponses.value = [];
    }
    completedResponses.value.unshift(responseItem);
}

function handleSaveMedia(media) {
    if (!media || !media.url) return;

    if (media.type === 'video') {
        // #ifdef H5
        uni.setClipboardData({
            data: media.url,
            success: () => {
                uni.showToast({
                    title: '视频链接已复制，请手动下载',
                    icon: 'none',
                    duration: 2000
                });
            }
        });
        // #endif

        // #ifdef APP-PLUS || MP-WEIXIN
        uni.showLoading({
            title: '准备下载...'
        });

        uni.downloadFile({
            url: media.url,
            success: (res) => {
                uni.hideLoading();
                if (res.statusCode === 200) {
                    // #ifdef APP-PLUS
                    plus.io.resolveLocalFileSystemURL('_doc', (entry) => {
                        const fileName = 'video_' + new Date().getTime() + '.mp4';
                        entry.getDirectory('downloads', {
                            create: true
                        }, (dirEntry) => {
                            dirEntry.getFile(fileName, {
                                create: true
                            }, (fileEntry) => {
                                fileEntry.createWriter((writer) => {
                                    writer.write(res.tempFilePath);
                                    uni.showToast({
                                        title: '视频已保存到 Downloads 文件夹',
                                        icon: 'success'
                                    });
                                }, (error) => {
                                    uni.showToast({
                                        title: '保存失败',
                                        icon: 'none'
                                    });
                                });
                            });
                        });
                    });
                    // #endif

                    // #ifdef MP-WEIXIN
                    uni.saveVideoToPhotosAlbum({
                        filePath: res.tempFilePath,
                        success: () => {
                            uni.showToast({
                                title: '视频已保存到相册',
                                icon: 'success'
                            });
                        },
                        fail: (err) => {
                            uni.showToast({
                                title: '保存失败',
                                icon: 'none'
                            });
                        }
                    });
                    // #endif
                }
            },
            fail: (err) => {
                uni.hideLoading();
                uni.showToast({
                    title: '下载失败',
                    icon: 'none'
                });
            }
        });
        // #endif
    } else if (media.type === 'image') {
        // #ifdef H5
        uni.showModal({
            title: '提示',
            content: 'H5环境下请长按图片保存',
            showCancel: false
        });
        // #endif

        // #ifdef APP-PLUS || MP-WEIXIN
        uni.downloadFile({
            url: media.url,
            success: (res) => {
                if (res.statusCode === 200) {
                    uni.saveImageToPhotosAlbum({
                        filePath: res.tempFilePath,
                        success: () => {
                            uni.showToast({
                                title: '图片已保存到相册',
                                icon: 'success'
                            });
                        },
                        fail: (err) => {
                            uni.showToast({
                                title: '保存失败',
                                icon: 'none'
                            });
                        }
                    });
                }
            },
            fail: () => {
                uni.showToast({
                    title: '下载失败',
                    icon: 'none'
                });
            }
        });
        // #endif
    }
}

async function handleTokenReturn() {
    if (tokenReturnExecuted.value || !flowId.value) {
        return;
    }

    try {
        tokenReturnExecuted.value = true;

        const returnRes = await getTokenReturn(userContextId.value);
        if (returnRes && returnRes.code == "200" && returnRes.data) {
            uni.setStorageSync("data", returnRes.data);
            uni.$emit('updateTokenQuantity', returnRes.data);
        }
    } catch (tokenErr) {}
}

function handleShowFullList(item, index) {
    showFullList.value = true;
    drawerVisible.value = false;
    labeltitle.value = item.title;
    active_menu.value = index;
    fullListItems.value = datas.value[item.title];
}

function generateFullListData(index) {
    let fullList = [];
    switch (index) {
        case 0:
            labeltitle.value = "关注度总排行";
            fullList = [
                { rank: 1, change: 0, icon: "/static/images/logo/deepseek.png", name: "DeepSeek", company: "深度求索", attention: "28,377,105", hot: -2057000 },
                { rank: 2, change: 0, icon: "/static/images/logo/doubaologo.png", name: "豆包", company: "抖音", attention: "21,532,455", hot: -1873000 },
                { rank: 3, change: 1, icon: "/static/images/logo/kuake.png", name: "夸克", company: "夸克", attention: "10,508,926", hot: 1590000 },
                { rank: 4, change: 1, icon: "/static/images/logo/tengxun.png", name: "腾讯元宝", company: "腾讯", attention: "8,147,012", hot: -1088000 },
                { rank: 5, change: 0, icon: "/static/images/logo/kimi.png", name: "Kimi", company: "月之暗面", attention: "7,674,852", hot: 183000 },
                { rank: 6, change: 0, icon: "/static/images/logo/GPT.png", name: "ChatGPT", company: "OpenAI", attention: "4,170,375", hot: -256000 },
                { rank: 7, change: 1, icon: "/static/images/logo/wenxin.png", name: "文心一言", company: "百度", attention: "3,827,356", hot: -497000 },
                { rank: 8, change: -1, icon: "/static/images/logo/jimeng.png", name: "即梦AI", company: "剪映", attention: "2,293,085", hot: -42000 },
                { rank: 9, change: 2, icon: "/static/images/logo/tongyiqianwen.png", name: "通义千问", company: "阿里云", attention: "1,150,834", hot: -75000 },
                { rank: 10, change: 1, icon: "/static/images/logo/kehua.png", name: "Canva可画", company: "北京咖瓦信息技术有限公司", attention: "1,021,860", hot: -290000 },
                { rank: 11, change: 1, icon: "/static/images/logo/fanyi.png", name: "百度翻译", company: "百度", attention: "939,843", hot: -60000 },
                { rank: 12, change: 73, icon: "/static/images/logo/gaoding.png", name: "稿定设计", company: "稿定（厦门）科技有限公司", attention: "766,863", hot: -5682 },
                { rank: 13, change: 3, icon: "/static/images/logo/coze.png", name: "扣子Coze", company: "火山引擎", attention: "716,696", hot: -290000 },
                { rank: 14, change: 0, icon: "/static/images/logo/guge.png", name: "Google翻译", company: "Google", attention: "689,883", hot: 3010 },
                { rank: 15, change: 2, icon: "/static/images/logo/manus.png", name: "Manus", company: "BUTTERFLY EFFECT", attention: "685,745", hot: -260000 },
                { rank: 16, change: 1, icon: "/static/images/logo/deepl.png", name: "DeepL", company: "DeepL", attention: "536,748", hot: -56000 },
                { rank: 17, change: 1, icon: "/static/images/logo/xingye.png", name: "星野", company: "上海稀宇科技有限公司", attention: "536,404", hot: 54000 },
                { rank: 18, change: 0, icon: "/static/images/logo/cursor.png", name: "Cursor", company: "Cursor", attention: "450,678", hot: 95000 },
                { rank: 19, change: 2, icon: "/static/images/logo/chuangke.png", name: "创客贴", company: "北京艺源酷科技有限公司", attention: "404,841", hot: -19000 },
                { rank: 20, change: 0, icon: "/static/images/logo/kelingai.png", name: "可灵AI", company: "快手", attention: "326,875", hot: -9395 },
            ];
            break;
        case 1:
            labeltitle.value = "关注上升排行";
            fullList = [
                { rank: 1, change: 5, icon: "/static/images/logo/deepseek.png", name: "王五", company: "腾讯", attention: "1000", hot: 1000 },
                { rank: 2, change: 3, icon: "/static/images/logo/doubaologo.png", name: "李四", company: "阿里", attention: "900", hot: 900 },
                { rank: 3, change: 2, icon: "/static/images/logo/kuake.png", name: "王五", company: "百度", attention: "800", hot: 800 },
                { rank: 4, change: 1, icon: "/static/images/logo/tengxun.png", name: "赵六", company: "字节跳动", attention: "700", hot: 700 },
                { rank: 5, change: 0, icon: "/static/images/logo/kimi.png", name: "钱七", company: "美团", attention: "600", hot: 600 },
                { rank: 6, change: -1, icon: "/static/images/logo/GPT.png", name: "孙八", company: "滴滴", attention: "500", hot: 500 },
                { rank: 7, change: -2, icon: "/static/images/logo/wenxin.png", name: "周九", company: "腾讯", attention: "400", hot: 400 },
                { rank: 8, change: -3, icon: "/static/images/logo/jimeng.png", name: "吴十", company: "阿里", attention: "300", hot: 300 },
                { rank: 9, change: -4, icon: "/static/images/logo/tongyiqianwen.png", name: "郑十一", company: "百度", attention: "200", hot: 200 },
                { rank: 10, change: -5, icon: "/static/images/logo/kehua.png", name: "冯十二", company: "字节跳动", attention: "100", hot: 100 },
            ];
            break;
        case 2:
            labeltitle.value = "关注下降排行";
            fullList = [
                { rank: 1, change: -5, icon: "/static/images/logo/deepseek.png", name: "冯十二", company: "腾讯", attention: "1000", hot: 1000 },
                { rank: 2, change: -3, icon: "/static/images/logo/doubaologo.png", name: "李四", company: "阿里", attention: "900", hot: 900 },
                { rank: 3, change: -2, icon: "/static/images/logo/kuake.png", name: "王五", company: "百度", attention: "800", hot: 800 },
                { rank: 4, change: -1, icon: "/static/images/logo/tengxun.png", name: "赵六", company: "字节跳动", attention: "700", hot: 700 },
                { rank: 5, change: 0, icon: "/static/images/logo/kimi.png", name: "钱七", company: "美团", attention: "600", hot: 600 },
                { rank: 6, change: 1, icon: "/static/images/logo/GPT.png", name: "孙八", company: "滴滴", attention: "500", hot: 500 },
                { rank: 7, change: 2, icon: "/static/images/logo/wenxin.png", name: "周九", company: "腾讯", attention: "400", hot: 400 },
                { rank: 8, change: 3, icon: "/static/images/logo/jimeng.png", name: "吴十", company: "阿里", attention: "300", hot: 300 },
                { rank: 9, change: 4, icon: "/static/images/logo/tongyiqianwen.png", name: "郑十一", company: "百度", attention: "200", hot: 200 },
                { rank: 10, change: 5, icon: "/static/images/logo/kehua.png", name: "冯十二", company: "字节跳动", attention: "100", hot: 100 },
            ];
            break;
    }
    return fullList;
}

// created hook equivalent
const userData = uni.getStorageSync('data');
let hasHistory = false;

getUserContext("4c797294-4d9f-11f0-8b7f-d843aeb8c23e", userData.uuid).then(res => {
    if (res.code === "200" && Array.isArray(res.data) && res.data.length > 0) {
        hasHistory = true;
        const sortedData = res.data;
        
        conversationMessages.value = [];
        
        sortedData.forEach(item => {
            conversationMessages.value.push({
                type: 'user',
                content: item.problem,
                timestamp: item.sendTime * 1000
            });
            
            if (item.agentUrl) {
                conversationMessages.value.push({
                    type: 'bot',
                    content: item.answer || '',
                    timestamp: item.sendTime * 1000,
                    mediaType: 'image',
                    mediaUrl: item.agentUrl,
                    showCopyButton: !!item.answer
                });
            } else if (item.answer) {
                conversationMessages.value.push({
                    type: 'bot',
                    content: item.answer,
                    timestamp: item.sendTime * 1000,
                    showCopyButton: true
                });
            }
        });
    }
}).finally(() => {
    if (hasHistory) {
        nextTick(() => {
            scrollToBottom();
        });
    }
});

uni.$on('updateTokenQuantity', (data) => {});

watch(conversationMessages, handleMessagesUpdated);

onMounted(async () => {
    getGroupList().then(res => {
        datas.value = res.data;
        let arr = [];

        for (let key in datas.value) {
            let attr = {};
            attr.title = key;
            attr.items = datas.value[key];
            arr.push(attr);
        }
        alldataarr.value = arr;

        uni.getSystemInfo({
            success: res => {
                windowHeight.value = res.windowHeight;
                localStatusBarHeight.value = res.statusBarHeight;
                num.value = parseInt((windowHeight.value - 50) / 130) + 1;
                items.value = alldataarr.value.slice(0, num.value);
            }
        });
    }).catch(error => {
        alldataarr.value = [
            {
                title: "AI助手排行榜",
                items: [
                    { rank: 1, change: 0, icon: "/static/images/logo/ChatGPT.png", name: "ChatGPT", company: "OpenAI", attention: "10000", hot: 10000 },
                    { rank: 2, change: -1, icon: "/static/images/logo/Copilot.png", name: "Copilot", company: "Microsoft", attention: "8000", hot: 8000 },
                    { rank: 3, change: 1, icon: "/static/images/logo/Claude.png", name: "Claude", company: "Anthropic", attention: "6000", hot: 6000 }
                ]
            },
            {
                title: "热门工具",
                items: [
                    { rank: 1, change: 0, icon: "/static/images/logo/kehua.png", name: "可画", company: "可画科技", attention: "5000", hot: 5000 },
                    { rank: 2, change: 2, icon: "/static/images/logo/tongyiqianwen.png", name: "通义千问", company: "阿里巴巴", attention: "4000", hot: 4000 }
                ]
            }
        ];
        
        uni.getSystemInfo({
            success: res => {
                windowHeight.value = res.windowHeight;
                localStatusBarHeight.value = res.statusBarHeight;
                num.value = parseInt((windowHeight.value - 50) / 130) + 1;
                items.value = alldataarr.value.slice(0, num.value);
            }
        });
    });

    const dataInfo = uni.getStorageSync('data') || {};
    userinfo.avatar = dataInfo.avatar || '';
    userinfo.nickname = dataInfo.nickname || '';
    getCozeApiList().then(res => {
        modelList.value = res.data || [];
    }).catch(() => {
        modelList.value = [];
    });
    loadHistoryChat();

    setupTimer();
    if (conversationMessages.value.length > 0) {
        nextTick(() => {
            scrollToBottom();
        });
    }

    // #ifdef H5
    document.body.style.overflow = 'hidden';
    // #endif

    // #ifdef MP-WEIXIN
    if (!wx.cloud) {
        uni.showToast({
            title: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。',
            icon: 'none',
            duration: 3000
        });
        return;
    }

    wx.cloud.init({
        env: 'cloud1-5gszljn762dc4719',
        traceUser: true
    });
    // #endif

    conversationMessages.value = [];

    try {
        const savedId = uni.getStorageSync('last_conversation_id');
        if (savedId) {
            conversationId.value = savedId;
        } else {
            conversationId.value = '';
        }
    } catch (storageError) {
        conversationId.value = '';
    }

    setTimeout(() => {
        scrollToBottom();
    }, 800);

    setTimeout(() => {
        if (conversationMessages.value.length === 0) {
            // handleInitialMessage if needed
        }
    }, 1000);
});

onBeforeUnmount(() => {
    clearTimer();
    if (scrollTimer.value) {
        clearTimeout(scrollTimer.value);
    }
    if (checkStatusInterval.value) {
        clearInterval(checkStatusInterval.value);
    }
    
    // #ifdef H5
    document.body.style.overflow = '';
    // #endif
    
    uni.$off('updateTokenQuantity');
});
</script>

<style lang="scss">
.container {
	height: 100vh;
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	overflow: hidden;

	.chat-container {
		flex: 1;
		padding: 20rpx 0;
		margin-bottom: 120rpx;
		box-sizing: border-box;
		position: relative;
		z-index: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		height: calc(100vh - 240rpx);
	}

	.input-area {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 20rpx;
		display: flex;
		align-items: center;
		gap: 20rpx;
		border-top: 1px solid rgba(0, 242, 255, 0.15);
		box-shadow: 0 0 10rpx rgba(0, 0, 0, 0.05);
		background-color: rgba(255, 255, 255, 0.9);
		z-index: 2;
		height: 120rpx;

		input {
			flex: 1;
			height: 80rpx;
			padding: 0 30rpx;
			background-color: #E6F3FA;
			border-radius: 30rpx;
			font-size: 28rpx;
			color: #333333;
			transition: all 0.3s ease;

			&:focus {
				background-color: #ffffff;
				box-shadow: 0 0 10rpx rgba(0, 242, 255, 0.2);
			}
		}

		.placeholder-style {
			color: #999999;
			font-size: 28rpx;
		}

		.send-btn {
			width: 100rpx;
			height: 100rpx;
			padding: 0;
			margin: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background-color: transparent;
			border-radius: 30rpx;
			border: none;
			transition: all 0.3s ease;

			&::after {
				border: none;
			}

			.send-icon {
				width: 200rpx;
				height: 200rpx;
				transition: transform 0.3s ease;
			}

			&:active {
				transform: scale(0.95);

				.send-icon {
					transform: scale(0.95);
				}
			}

			&:disabled {
				opacity: 0.6;
			}
		}
	}
}
.conceal {
		width: 100%;
		height: 0rpx;
		display: flex;
		justify-content: center;

		.conceal-img {
			height: 15rpx;
			width: 40rpx;
			position: fixed;
			z-index: 1000;
			margin-top: 10rpx;
		}
}

.drawer-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(0, 0, 0, 0.4);
	z-index: 998;
}

.drawer {
	position: fixed;
	top: 0;
	bottom: 0;
	left: -300rpx;
	width: 300rpx;
	height: calc(100%);
	background-color: #fff;
	z-index: 999;
	transition: transform 0.3s ease;
	border-radius: 0 30rpx 30rpx 0;
	box-sizing: border-box;
	
	&.drawer-open {
		transform: translateX(300rpx);
	}
}

.drawer-header {
	position: relative;
	height: 100rpx;
	
	.drawer-image {
		width: 100rpx;
		height: 100rpx;
		margin: 54rpx auto 0;
		display: block;
	}
	.drawer-image1 {
		width: 100rpx;
		height: 100rpx;
		margin: 10rpx auto 0;
		display: block;
	}
	.drawer-image2 {
		width: 100rpx;
		height: 100rpx;
		margin: 10rpx auto 0;
		display: block;
	}
	
	.drawer-close {
		position: absolute;
		top: 40rpx;
		right: 40rpx;
		width: 40rpx;
		height: 40rpx;
		
		image {
			width: 100%;
			height: 100%;
		}
	}
}

.drawer-menu {
	margin-top: 0;
	padding: 0 40rpx;
	height: calc(100vh - 180rpx);
	overflow-y: scroll;

	.menu-item {
		display: flex;
		align-items: center;
		padding: 20rpx 0;
		border-bottom: 1rpx solid #f5f5f5;
		
		.menu-icon {
			width: 40rpx;
			height: 40rpx;
			margin-right: 10rpx;
		}
		
		.menu-text {
			font-size: 30rpx;
			color: #333;
		}

		.menu_text{
			color: #0d11fc;
			font-weight: bold;
		}
	}
}

.content-scroll {
	flex: 1;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}
.tabbar_back{
	height: 150rpx;
  background-color: rgba(255,255,255,0);
}

.logobox {
  padding-top: 40rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo {
  width: 217rpx;
  height: 66rpx;
}

.input-wbox {
  width: 100%;
  display: flex;
  justify-content: center;
}

.titlebox {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
}

.titlebox-image {
  margin-top: 0;
  width: 110rpx;
  height: 37rpx;
}

.titlebox-image1 {
  margin-top: 18rpx;
  width: 112rpx;
  height: 66rpx;
}

.top_box {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 30%;
}

.drawer-header{
  .logobox {
    padding: 9rpx 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .logo {
    width: 66rpx;
    height: 66rpx;
    margin-right: 12rpx;
  }

  .input-wbox {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .titlebox {
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
  }

  .titlebox-image {
    margin-top: 0;
    width: 160rpx;
    height: 37rpx;
  }

  .titlebox-image1 {
    margin-top: 8rpx;
    width: 162rpx;
    height: 66rpx;
  }

  .top_box {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 30%;
  }

}
</style>
