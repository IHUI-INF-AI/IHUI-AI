export default {
    data() {
        return {
            talking: false,
            socketTask: null,
            textIndex: 0
        }
    },

    beforeDestroy() {
        if (this.socketTask) {
            this.socketTask.close();
        }
    },

    methods: {
        requestByWebSocket(name, idstring, zidingyican) {
            this.loading = true;
            let imageUrl;
            if (this.imgsList.length > 0) {
                imageUrl = this.imgsList[0].imgUrl;
            }

            if (name == 'wan2.5-i2v-previe' && this.imgsList.length > 1) {
                uni.showToast({
                    title: '视频生成只支持上传一张图片',
                    icon: 'none'
                });
            }

            let param = this.buildWebSocketParams(name, idstring, zidingyican, imageUrl);
            const newIndex = this.agent_content_list.length;
            this.textIndex = JSON.parse(JSON.stringify(this.displayedTexts.length));

            if (this.talking) {
                this.sendTask(param);
            } else {
                this.setImgsList([]);
                this.connectWebSocket(param, newIndex, name);
            }
        },

        buildWebSocketParams(name, idstring, zidingyican, imageUrl) {
            let param;

            if (name == 'wan2.5-i2v-preview') {
                param = JSON.stringify({
                    ...this.modelConfigChangeData,
                    prompt: this.prompt,
                    model: 'wan2.5-i2v-preview',
                    img_url: imageUrl,
                    prompt_extend: true,
                    watermark: false,
                    user_uuid: this.userinfo.uuid,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                });
            } else if (name == 'wan2.5-i2v-previe') {
                param = JSON.stringify({
                    ...this.modelConfigChangeData,
                    prompt: this.prompt,
                    model: 'wan2.5-i2v-previe',
                    img_url: imageUrl,
                    prompt_extend: true,
                    watermark: false,
                    user_uuid: this.userinfo.uuid,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                });
            } else if (name == 'qwen-plus') {
                param = JSON.stringify({
                    type: "chat",
                    data: {
                        messages: [
                            {
                                role: "user",
                                content: this.prompt
                            }
                        ],
                        user_uuid: this.userinfo.uuid,
                        model: 'qwen-plus',
                        chat_id: idstring,
                        ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                    }
                });
            } else if (name == 'Doubao-1.6') {
                param = JSON.stringify({
                    type: "chat",
                    data: {
                        messages: [
                            {
                                role: "user",
                                content: this.prompt
                            }
                        ],
                        user_uuid: this.userinfo.uuid,
                        chat_id: idstring,
                        ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                    }
                });
            } else if (name == 'GLM-4.5') {
                param = JSON.stringify({
                    messages: [
                        {
                            role: "user",
                            content: this.prompt
                        }
                    ],
                    user_uuid: this.userinfo.uuid,
                    thinking: {
                        type: 'auto'
                    },
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                });
            } else if (name == 'qwen-omni') {
                param = JSON.stringify({
                    prompt: this.prompt,
                    user_uuid: this.userinfo.uuid,
                    model: 'qwen-omni',
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                });
            } else {
                param = JSON.stringify({
                    messages: [
                        {
                            role: "user",
                            content: this.prompt
                        }
                    ],
                    prompt: this.prompt,
                    images: this.imgsList,
                    user_uuid: this.userinfo.uuid,
                    thinking: {
                        type: 'auto'
                    },
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                });
            }

            return param;
        },

        connectWebSocket(param, newIndex, name) {
            const baseUrl = 'wss://zca.aizhs.top';
            const socketUrl = `${baseUrl}${this.remark}`;

            this.socketTask = uni.connectSocket({
                url: socketUrl,
                success: () => {},
                fail: (err) => {
                    this.loading = false;
                    this.agent_content_list.push({
                        content: '连接失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.agent_con1 = -1;
                    uni.showToast({
                        title: '连接失败',
                        icon: 'none'
                    });
                }
            });

            this.socketTask.onOpen(() => {
                this.sendTask(param);
            });

            this.socketTask.onMessage((res) => {
                this.handleWebSocketMessage(res, newIndex, name);
            });

            this.socketTask.onError((err) => {
                this.talking = false;
                this.loading = false;
                this.agent_content_list.push({
                    content: '连接错误，请重试',
                    content1: '',
                    imgUrlList: [],
                    total_tokens: 0,
                    isHaveSikao: false
                });
                this.clearThinkingProcessLogic();
                this.socketTask.close();
            });

            this.socketTask.onClose((res) => {
                this.talking = false;
                this.loading = false;
            });
        },

        handleWebSocketMessage(res, newIndex, name) {
            let obj;
            try {
                obj = JSON.parse(res.data);
            } catch (e) {
                console.error('解析WebSocket消息失败:', e, res.data);
                return;
            }
            
            if (!obj) {
                console.warn('WebSocket消息为空');
                return;
            }

            if (this.checkTokenBalance(obj)) {
                this.clearThinkingProcessLogic();
                this.loading = false;
                this.talking = false;

                if (this.socketTask) {
                    this.socketTask.close();
                }

                uni.showModal({
                    title: '智汇值不足',
                    content: '您的智汇值余额小于50000，无法使用大模型，是否前往充值？',
                    confirmText: '立即充值',
                    cancelText: '取消',
                    success: (res) => {
                        if (res.confirm) {
                            uni.navigateTo({
                                url: '/pagesA/top-up/index'
                            });
                        }
                    }
                });

                return;
            }

            if (name == 'wan2.5-i2v-preview' || name == 'wan2.5-i2v-previe') {
                this.handleWanVideoResponse(obj, newIndex);
            } else {
                this.handleChatResponse(obj, newIndex);
            }

            if (obj && obj.total_tokens && newIndex > 0 && this.agent_content_list[newIndex - 1]) {
                this.$set(this.agent_content_list[newIndex - 1], 'total_tokens', obj.total_tokens);
                this.$set(this.agent_content_list[newIndex - 1], 'isHaveSikao', true);
            }
        },

        handleWanVideoResponse(obj, newIndex) {
            if (obj && obj.message && obj.message === '流式响应完成') {
                return;
            }

            const isSuccess = obj && (
                (obj.code === 200 && obj.data) ||
                (obj.data && (obj.data.type === 'success' || obj.data.event === 'video_synthesis.success'))
            );

            if (isSuccess && obj.data) {
                this.clearThinkingProcessLogic();
                this.thinkingProgress = 100;
                const datas = obj.data;

                const contentText = datas.content || datas.message || '视频生成完成';
                this.agent_content = contentText;
                this.agent_content1 = contentText;

                const videoUrl = datas.video_url || '';
                const totalTokens = datas.total_tokens || 0;
                const videoRatio = datas.video_ratio || '16:9';

                const currentIndex = newIndex > 0 ? newIndex - 1 : 0;

                if (this.agent_content_list[currentIndex]) {
                    this.$set(this.agent_content_list, currentIndex, {
                        ...this.agent_content_list[currentIndex],
                        content: this.agent_content,
                        content1: this.agent_content1,
                        videoUrl: videoUrl,
                        video_ratio: videoRatio,
                        total_tokens: totalTokens,
                        isHaveSikao: true
                    });
                    this.$forceUpdate();
                } else {
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [],
                        videoUrl: videoUrl,
                        video_ratio: videoRatio,
                        total_tokens: totalTokens,
                        isHaveSikao: true
                    });
                }

                if (!this.displayedTexts[currentIndex]) {
                    this.$set(this.displayedTexts, currentIndex, '');
                }

                if (videoUrl) {
                    this.$set(this.displayedTexts, currentIndex, '');
                    this.$nextTick(() => {
                        this.scrollToBottom();
                    });
                } else {
                    this.typeWriterAgentContent1(this.agent_content1, this.agent_content, currentIndex, false);
                }
                this.clearInput();
            } else {
                this.clearThinkingProcessLogic();
                this.thinkingProgress = 100;

                const currentIndex = newIndex > 0 ? newIndex - 1 : 0;
                if (this.agent_content_list[currentIndex]) {
                    this.$set(this.agent_content_list, currentIndex, {
                        ...this.agent_content_list[currentIndex],
                        content: '视频生成失败，请重试',
                        content1: '',
                        videoUrl: '',
                        video_ratio: '16:9',
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.$forceUpdate();
                } else {
                    this.agent_content_list.push({
                        content: '视频生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        videoUrl: '',
                        video_ratio: '16:9',
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                }

                if (!this.displayedTexts[currentIndex]) {
                    this.$set(this.displayedTexts, currentIndex, '');
                }
                this.clearInput();
            }
        },

        handleChatResponse(obj, newIndex) {
            if (obj.data && obj.data.content) {
                if (obj.event && obj.event == "conversation.message.delta") {
                    if (!this.isThinkingGeneration) {
                        this.isThinkingGeneration = true;
                    }
                    const filteredContent = obj.data.content.replace(/[*#]+/g, '');
                    this.displayedAgentContent1 += filteredContent;
                    // 同步更新内容区域的思考过程显示
                    const targetIndex = newIndex >= 0 ? newIndex : (this.textIndex >= 0 ? this.textIndex : newIndex);
                    if (targetIndex >= 0 && this.displayedThinkingTexts) {
                        // 初始化思考过程显示内容
                        if (this.displayedThinkingTexts[targetIndex] === undefined) {
                            this.$set(this.displayedThinkingTexts, targetIndex, '');
                        }
                        // 同步更新思考过程的流式输出
                        this.$set(this.displayedThinkingTexts, targetIndex, this.displayedAgentContent1);
                        // 在开始接收思考内容时，立即设置 isHaveSikao 为 true，以便内容区域显示思考过程
                        if (this.agent_content_list && this.agent_content_list[targetIndex]) {
                            this.$set(this.agent_content_list[targetIndex], 'isHaveSikao', true);
                        }
                    }
                } else if (obj.event && obj.event == "conversation.chat.completed") {
                    this.clearThinkingProcessLogic();
                    if (this.displayedTexts[this.textIndex] == undefined) {
                        this.displayedTexts[this.textIndex] = '';
                    }
                    this.displayedTexts[this.textIndex] += obj.data.content.replace(/[*#]+/g, '');
                }
                this.scrollToBottom();
            } else if (obj.message && obj.message == '流式响应完成') {
                const targetIndex = newIndex >= 0 ? newIndex : (this.textIndex >= 0 ? this.textIndex : newIndex);
                if (this.displayedAgentContent1 && targetIndex >= 0 && this.agent_content_list[targetIndex]) {
                    this.$set(this.agent_content_list[targetIndex], 'thinkingContent', this.displayedAgentContent1);
                    this.$set(this.agent_content_list[targetIndex], 'isHaveSikao', true);
                    // 同步更新内容区域的思考过程显示
                    if (this.displayedThinkingTexts) {
                        this.$set(this.displayedThinkingTexts, targetIndex, this.displayedAgentContent1);
                    }
                }
                this.clearThinkingProcessLogic();
                this.clearInput();
                this.scrollToBottom();
                if (this.socketTask) {
                    this.socketTask.close();
                }
            }
        },

        checkTokenBalance(messageObj) {
            if (!messageObj) return false;

            const errorText = JSON.stringify(messageObj).toLowerCase();
            const messageText = (messageObj.message || '').toLowerCase();
            const dataText = (messageObj.data && typeof messageObj.data === 'string' ? messageObj.data : JSON.stringify(messageObj.data || '')).toLowerCase();
            const errorField = (messageObj.error || '').toLowerCase();

            const hasTokenError =
                errorText.includes('50000') ||
                errorText.includes('余额不足') ||
                errorText.includes('token余额') ||
                messageText.includes('50000') ||
                messageText.includes('余额不足') ||
                messageText.includes('token余额') ||
                dataText.includes('50000') ||
                dataText.includes('余额不足') ||
                dataText.includes('token余额') ||
                errorField.includes('50000') ||
                errorField.includes('余额不足') ||
                errorField.includes('token余额');

            return hasTokenError;
        },

        sendTask(param) {
            this.socketTask.send({
                data: param,
                success: (ss) => {
                    if (this.modelName == 'GLM-4.5') {
                        this.thinkingProgress = 100;
                        this.talking = true;
                        this.displayedTexts.push('');
                    }
                },
                fail: (err) => {
                    this.loading = false;
                    this.clearThinkingProcessLogic();
                    this.agent_con1 = -1;
                    this.agent_content_list.push({
                        content: '发送失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.socketTask.close();
                }
            });
        }
    }
}
