import {
    cozeZhsApiDashscopeImageGenerate,
    dashscopeImageEditSimple,
    cozeZhsApiDashscopeVideoGenerate,
    tencentHunyuan3dSubmit,
    tencentHunyuan3dQuery,
    cozeZhsApiLuyalaChatCompletions,
    cozeZhsApiDoubaoSeedream40,
    cozeZhsApiLuyalaVideoCreate,
    audioStart,
    audioEnd,
    soraRequest,
    soraRequestEnd,
    aliGenerateTimbre,
} from "@/service/aiModels.js"
import { postContext, saveChatHistory, getUserContextField, removeField, getAgentInfo } from "@/service/pay.js";

export default {
    data() {
        return {
            requestTime: null,
            JobId: '',
            talking: false,
            socketTask: null,
            textIndex: 0,
			modelConfigChangeData: {},
            audioTimer: null,
        }
    },
    computed: {
        // 获取正确的图片列表属性
        // 在ai_index2.vue中，imgsList是计算属性，_imgsList是数据属性
        // 在其他组件中，imgsList是数据属性
        imgsListProp() {
            return this._imgsList !== undefined ? '_imgsList' : 'imgsList';
        }
    },
    watch: {
        imgsList: {
            handler: function (n) {
            }
        }
    },
    beforeDestroy(){
        clearInterval(this.audioTimer)

        // if(this.audioTimer){
        //     clearInterval(this.audioTimer)
        // }

        if (this.requestTime) {
            clearTimeout(this.requestTime)
        }
    },
    methods: {
        // 设置图片列表的辅助方法
        setImgsList(value) {
            if (this._imgsList !== undefined) {
                this._imgsList = value;
            } else {
                this.imgsList = value;
            }
        },
        // 获取图片列表的辅助方法
        getImgsList() {
            if (this._imgsList !== undefined) {
                return this._imgsList;
            } else {
                return this.imgsList;
            }
        },
        // 过滤特殊标记和格式的函数
        filterSpecialMarkers(content) {
            if (!content || typeof content !== 'string') {
                return content || '';
            }
            let filtered = content;
            // 移除 FunctionCallEnd 标记
            filtered = filtered.replace(/<\|FunctionCallEnd\|>/g, '');
            // 移除 FunctionCall 开始标记
            filtered = filtered.replace(/<\|FunctionCall\|>/g, '');
            // 移除空的数组标记 []（如果单独存在）
            filtered = filtered.replace(/^\s*\[\]\s*$/g, '');
            // 移除内容开头的 [] 标记
            filtered = filtered.replace(/^\s*\[\]\s*/g, '');
            // 移除内容结尾的 [] 标记
            filtered = filtered.replace(/\s*\[\]\s*$/g, '');
            // 移除其他可能的特殊标记
            filtered = filtered.replace(/<\|[^|]+\|>/g, '');
            // 清理多余的空格和换行
            filtered = filtered.trim();
            return filtered;
        },
        talk(token,idstring,zidingyican) {
            if (this.prompt == '' || this.prompt == null || this.prompt == undefined) {
                uni.showToast({
                    title: '请输入内容',
                    icon: 'none'
                });
                return;
            }
            this.sourceIs = false;          // 关闭智能体选择弹窗
            this.isShowIcon = false;        // 关闭文件选择弹窗
            this.inputFocused = false;      // 输入

            // // 问题
            // this.question_list.push({
            //     question: this.prompt,
            //     imgsLista: this.imgsList
            // });
            // // 回复
            // this.agent_content_list.push({
            //     content: '内容生成中...',
            //     content1: '内容生成中...',
            //     imgUrlList: [],
            //     total_tokens: 0,
            //     thinkingContent: '',
            //     isHaveSikao: false
            // });
            console.log(this.modelNameEN)

            if(this.modelNameEN == 'cosyvoice-v3'){
                // 从ModelConfigDialog组件获取音色相关信息
                const selectedVoice = this.$refs.modelConfigDialog?.selectedVoice || {};
                const referenceAudio = this.modelConfigChangeData?.referenceAudio;
                const audioId = typeof selectedVoice === 'object' && selectedVoice.audioId ? selectedVoice.audioId : 'longyingying';
                const audioPath = referenceAudio || '';
                const copyWriting = this.prompt;
                const chatId = idstring


                // 调用aliGenerateTimbre接口
                if (copyWriting && audioId) {
                    aliGenerateTimbre({
                        copyWriting,
                        audioId,
                        audioPath,
                        chatId
                    }).then(res => {
                        this.setImgsList([])
                        res.actual_prompt = ''
                        const datas = res
                        
                        // 先清空agent_content_list，确保不会有冲突数据
                        // this.agent_content_list = []
                        
                        // 构造音频数据对象
                        const audioData = {
                            content: this.agent_content || '音频合成结果',
                            content1: this.agent_content1 || '',
                            imgUrlList: [], // 清空图片列表
                            audioUrl: datas.data.url || '', // 将音频URL存储在单独字段
                            total_tokens: res.total_tokens || 0,
                            isHaveSikao: false,
                            isAudio: true // 添加音频标记
                        };
                        
                        
                        // 替换之前的"内容生成中..."记录，而不是添加新记录
                        // 确保question_list和agent_content_list索引对应
                        if (this.agent_content_list.length > 0) {
                            this.agent_content_list[this.agent_content_list.length - 1] = audioData;
                        } else {
                            this.agent_content_list.push(audioData);
                        }
                        
                        
                        // 不调用pushData，避免数据结构冲突
                        // this.pushData(datas)
                        
                        this.clearInput()
                    }).catch(err => {
                        // 在出错时更新最后一条记录，而不是添加新记录，确保索引一致
                        if (this.agent_content_list.length > 0) {
                            this.agent_content_list[this.agent_content_list.length - 1] = {
                                content: '音频合成失败',
                                content1: '',
                                imgUrlList: [],
                                audioUrl: '',
                                total_tokens: 0,
                                isHaveSikao: false,
                                isAudio: true,
                                error: JSON.stringify(err)
                            };
                        } else {
                            this.agent_content_list.push({
                                content: '音频合成失败',
                                content1: '',
                                imgUrlList: [],
                                audioUrl: '',
                                total_tokens: 0,
                                isHaveSikao: false,
                                isAudio: true,
                                error: JSON.stringify(err)
                            });
                        }
                    });
                } else {
                    // 缺少参数情况下更新最后一条记录，而不是添加新记录，确保索引一致
                    if (this.agent_content_list.length > 0) {
                        this.agent_content_list[this.agent_content_list.length - 1] = {
                            content: '缺少必要参数',
                            content1: '',
                            imgUrlList: [],
                            audioUrl: '',
                            total_tokens: 0,
                            isHaveSikao: false,
                            isAudio: true,
                            debugInfo: {
                                copyWriting, 
                                audioId, 
                                hasCopyWriting: !!copyWriting, 
                                hasAudioId: !!audioId
                            }
                        };
                    } else {
                        this.agent_content_list.push({
                            content: '缺少必要参数',
                            content1: '',
                            imgUrlList: [],
                            audioUrl: '',
                            total_tokens: 0,
                            isHaveSikao: false,
                            isAudio: true,
                            debugInfo: {
                                copyWriting, 
                                audioId, 
                                hasCopyWriting: !!copyWriting, 
                                hasAudioId: !!audioId
                            }
                        });
                    }
                }
            }else if(this.modelNameEN == 'keling') {  // 先用他代替 可灵 ai 数字人
                if(!this.audioUrl) {
                    uni.showToast({
                        title: '请上传音频文件',
                        icon: 'error',
                        duration: 2000
                    });
                    this.agent_con1 = -1
                    return
                }
                if(this.imgsList.length<1){
                    uni.showToast({
                        title: '请上传首帧图片',
                        icon: 'error',
                        duration: 2000
                    });
                    this.agent_con1 = -1
                    return
                }
                
                const param = {
                    image: this.imgsList[0].imgUrl,
                    soundFile: this.audioUrl,
                    prompt: this.prompt,
                    chatId: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }
                audioStart(param).then(start=>{
                    // const datas = JSON.parse(start)
                    const task_id = start.data.task_id

                    this.getaudio(task_id)
                })
            }else if(this.modelNameEN == 'sora-2') {  // 先用他代替 可灵 ai 数字人
                
                const param = {
                    images: this.imgsList[0] ? this.imgsList[0].imgUrl : '',
                    orientation: this.modelConfigChangeData.orientation || 0,
                    prompt: this.prompt,
                    chatId: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }
                soraRequest(param).then(start=>{
                    const task_id = start.data.id

                    this.getvideo(task_id)
                })
            }else if(this.modelNameEN == 'volcengine-t2v'){
                const param = {
                    ...this.modelConfigChangeData,
                    user_uuid: this.userinfo.uuid,
                    prompt: this.prompt,
                    async_mode: true,
                    chat_id: idstring,
                    seed: 3,
                    frames: 10,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }
                cozeZhsApiDoubaoSeedream40(param, this.remark).then(res => {
                    this.setImgsList([])
                    // 添加完整的空值检查
                    if (res && res.image_url) {
                        res.actual_prompt = ''
                        const datas = res
                        this.pushData(datas)
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [datas.image_url],
                            total_tokens: res.total_tokens || 0,
                            isHaveSikao: false
                        });

                        this.clearInput()
                    } else {
                        this.agent_content_list.push({
                            content: '图片生成失败，请重试',
                            content1: '',
                            imgUrlList: [],
                            total_tokens: 0,
                            isHaveSikao: false
                        });
                        this.clearInput()
                    }
                }).catch(error => {
                    this.agent_content_list.push({
                        content: '图片生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput()
                })
            }else if(this.modelNameEN == 'doubao-seedream-4.0'){
                const param = {
                    ...this.modelConfigChangeData,
                    user_uuid: this.userinfo.uuid,
                    prompt: this.prompt,
                    async_mode: true,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }

                cozeZhsApiDoubaoSeedream40(param, this.remark).then(res => {
                    this.setImgsList([])
                    // 添加完整的空值检查
                    if (res && res.image_url) {
                        res.actual_prompt = ''
                        const datas = res
                        this.pushData(datas)
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [datas.image_url],
                            total_tokens: res.total_tokens || 0,
                            isHaveSikao: false
                        });

                        this.clearInput()
                    } else {
                        this.agent_content_list.push({
                            content: '视频生成失败，请重试',
                            content1: '',
                            imgUrlList: [],
                            total_tokens: 0,
                            isHaveSikao: false
                        });
                        this.clearInput()
                    }
                }).catch(error => {
                    this.agent_content_list.push({
                        content: '视频生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput()
                })
            }else if (this.modelNameEN == 'qwen-image') {
                // this.pushData({ actual_prompt: '' })
                // this.agent_content_list.push({
                //     content: '',
                //     content1: '',
                //     imgUrlList: ['https://file.aizhs.top/sys-backs/2025/08/30/qwen_image_fe8514b76c874ffa84e6a8d0f6df3922_20250830094749A007.jpg']
                // });
                // this.agent_con1 = false
                // this.clearInput()

                const param = {
                    ...this.modelConfigChangeData,
                    user_uuid: this.userinfo.uuid,
                    prompt: this.prompt,
                    async_mode: true,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }
                cozeZhsApiDashscopeImageGenerate(param, this.remark).then(res => {
                    this.setImgsList([])
                    // 检查新格式: res.image_url
                    if (res && res.image_url) {
                        res.actual_prompt = ''
                        const datas = res
                        this.pushData(datas)
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [datas.image_url],
                            total_tokens: res.total_tokens || 0,
                            isHaveSikao: false
                        });

                        this.clearInput()
                    } 
                    // 检查旧格式: res.data.output.results[0].url
                    else if (res && res.data && res.data.output && res.data.output.results && res.data.output.results.length > 0) {
                        const datas = res.data.output.results[0]
                        this.pushData(datas)
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [datas.url],
                            total_tokens: 0
                        });

                        this.clearInput()
                    } else {
                        this.agent_content_list.push({
                            content: '图片生成失败，请重试',
                            content1: '',
                            imgUrlList: [],
                            total_tokens: 0,
                            isHaveSikao: false
                        });
                        this.clearInput()
                    }
                }).catch(error => {
                    this.agent_content_list.push({
                        content: '图片生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput()
                })
            }else if (this.modelNameEN == 'qwen-image-Edit' && this.imgsList.length > 0) {
                if (this.imgsList.length > 1) {
                    uni.showToast({
                        title: '该模型只支持修改一张图片',
                        icon: 'none'
                    });
                }
                const url = this.imgsList[0].imgUrl
                const param = {
                    images: url,
                    image_url: url,
                    prompt: this.prompt,
                    edit_instruction: this.prompt,
                    watermark: false,
                    user_uuid: this.userinfo.uuid,
                    model: this.modelNameEN,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }
                dashscopeImageEditSimple(param, this.remark).then(res => {
                    this.setImgsList([])
                    this.thinkingProgress = 100;
                    // 添加完整的空值检查
                    if (res && res.data && res.data.image) {
                        const newIndex = this.agent_content_list.length;
                        if (newIndex > 0) {
                            this.agent_content_list.splice(newIndex - 1, 1);
                        }
                        this.agent_content_list.push({
                            content: '',
                            content1: '',
                            imgUrlList: [res.data.image],
                            total_tokens: 0,
                            isHaveSikao: false
                        });
                        this.displayedTexts[newIndex] = '';
                        this.typeWriterAgentContent1('', '', newIndex, false);
                        this.clearInput()
                    } else {
                        this.agent_content_list.push({
                            content: '图片编辑失败，请重试',
                            content1: '',
                            imgUrlList: [],
                            total_tokens: 0,
                            isHaveSikao: false
                        });
                        this.clearInput()
                    }
                }).catch(error => {
                    this.agent_content_list.push({
                        content: '图片编辑失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput()
                })
            }else if (this.modelNameEN == 'wan2.5-i2v-preview') {
                const param = {
                    ...this.modelConfigChangeData,
                    prompt: this.prompt,
                    model: 'wan2.5-t2v-plus',
                    negative_prompt: '',
                    duration: 5,
                    prompt_extend: true,
                    seed: 3,
                    watermark: false,
                    user_uuid: this.userinfo.uuid,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }
                this.requestByWebSocket('wan2.5-i2v-preview', idstring, zidingyican)
            }else if (this.modelNameEN == 'wan2.5-i2v-previe') {
                this.requestByWebSocket('wan2.5-i2v-previe', idstring, zidingyican)
            }else if (this.modelNameEN == 'hunyuanTo3D') {
                const param = {
                    Prompt: this.prompt,
                    ResultFormat: "MP4",
                    EnablePBR: false,
                    user_uuid: this.userinfo.uuid,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }

                tencentHunyuan3dSubmit(param, this.remark).then(res => {
                    this.setImgsList([])
                    if (res.data.JobId) {
                        this.JobId = res.data.JobId
                        this.requestTime = setTimeout(() => {
                            tencentHunyuan3dQuery({
                                JobId: this.JobId,
                                user_uuid: this.userinfo.uuid,
                            }).then(resolve => {

                            })
                        }, 300000)

                    }
                })
            }else if (this.modelNameEN == 'qwen-plus') {
                this.requestByWebSocket('qwen-plus',idstring, zidingyican)
            }else if (this.modelNameEN == 'Doubao-1.6') {
                this.requestByWebSocket('Doubao-1.6',idstring, zidingyican)
            }else if (this.modelNameEN == 'GLM-4.5') {
                this.requestByWebSocket('GLM-4.5',idstring, zidingyican)
            }else if (this.modelNameEN == 'Nano_Banana') {
                let imgs = this.imgsList.map(item => {
                    return {
                        type: 'image_url',
                        image_url: {
                            url: item.imgUrl
                        }
                    }
                })
                imgs.unshift({
                    type: "text",
                    text: this.prompt
                })
                const param = {
                    max_tokens: 4096,
                    model: "google/gemini-2.5-flash-image-preview:free",
                    user_uuid: this.userinfo.uuid,
                    messages: [
                        {
                            role: "user",
                            content: imgs
                        }
                    ],
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }

                cozeZhsApiLuyalaChatCompletions(param, this.remark).then(res => {
                    this.setImgsList([])
                    this.pushData({
                        actual_prompt: res.data.choices[0].message.content
                    })

                    if (res.data.uploaded_files.length > 0) {
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: res.data.uploaded_files,
                            total_tokens: res.total_tokens,
                            isHaveSikao: false
                        });
                        this.clearInput()
                    } else {
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [],
                            total_tokens: res.total_tokens,
                            isHaveSikao: false
                        });
                    }
                })
            }else if (this.modelNameEN == 'veo3-frames') {
                let imgs = this.imgsList
                const param = {
                    prompt: this.prompt,
                    images: this.imgsList,
                    user_uuid: this.userinfo.uuid,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                }

                cozeZhsApiLuyalaVideoCreate(param, this.remark).then(res => {
                    this.setImgsList([])
                    
                    // 优先检查 lists 字段
                    const listsData = this.processListsData(res);
                    if (listsData) {
                        this.pushData({
                            actual_prompt: listsData.content
                        });
                        this.agent_content_list.push({
                            content: listsData.content,
                            content1: listsData.content1,
                            imgUrlList: listsData.imgUrlList,
                            videoUrl: listsData.videoUrl,
                            total_tokens: listsData.total_tokens,
                            isHaveSikao: listsData.isHaveSikao,
                            hasLists: listsData.hasLists,
                            lists: listsData.lists
                        });
                        this.clearInput()
                    } else if (res.video_url) {
                        this.pushData({
                            actual_prompt: res.video_url
                        });
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [],
                            videoUrl: res.video_url,
                            total_tokens: res.total_tokens,
                            isHaveSikao: false
                        })
                        this.clearInput()
                    } else {
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [],
                            total_tokens: res.total_tokens,
                            videoUrl: res.video_url,
                        });
                    }
                })
            }else{
                // 获取当前选中模型的信息，使用与ai_index2.vue相同的安全访问方式
                const currentModel = this.modelInfo && this.modelInfo.name ? this.modelInfo : (this.modelList && this.modelList[this.pitch] ? this.modelList[this.pitch] : null);
                
                // 根据模型的quest_type字段判断是否使用HTTP请求
                const isHttpModel = currentModel && currentModel.quest_type === 'http';
                const isHttpModelType = currentModel && currentModel.grass_roots == 'java';
                
                
                if (isHttpModel) {
                    // 使用HTTP请求方式（第393-432行的逻辑）
                    let imgs = this.imgsList
                    const param = {
                        prompt: this.prompt,
                        images: this.imgsList,
                        user_uuid: this.userinfo.uuid,
                        chat_id: idstring,
                        ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                    }
                    let baseurl = isHttpModelType ? 1 : 3;
                    cozeZhsApiLuyalaVideoCreate(param, this.remark,baseurl).then(res => {
                        this.setImgsList([])
                        
                        // 获取占位项的索引（占位项已在handleSendMessage中添加）
                        const placeholderIndex = this.agent_content_list.length > 0 ? this.agent_content_list.length - 1 : 0;
                        
                        // 优先检查 lists 字段
                        const listsData = this.processListsData(res);
                        if (listsData) {
                            this.pushData({
                                actual_prompt: listsData.content
                            });
                            // 更新占位项而不是添加新项
                            this.$set(this.agent_content_list, placeholderIndex, {
                                content: listsData.content,
                                content1: listsData.content1,
                                imgUrlList: listsData.imgUrlList,
                                videoUrl: listsData.videoUrl,
                                total_tokens: listsData.total_tokens,
                                isHaveSikao: listsData.isHaveSikao,
                                hasLists: listsData.hasLists,
                                lists: listsData.lists
                            });
                            // 更新displayedTexts
                            if (listsData.content) {
                                this.$set(this.displayedTexts, placeholderIndex, listsData.content);
                            }
                            this.clearInput()
                        } else if (res.video_url) {
                            this.pushData({
                                actual_prompt: res.video_url
                            });
                            // 过滤特殊标记
                            const rawContent = res.llm_result || this.agent_content || res.message || '';
                            const filteredContent = this.filterSpecialMarkers(rawContent);
                            this.agent_content = filteredContent;
                            this.agent_content1 = filteredContent;
                            // 更新占位项而不是添加新项
                            this.$set(this.agent_content_list, placeholderIndex, {
                                content: this.agent_content,
                                content1: this.agent_content1,
                                imgUrlList: [],
                                videoUrl: res.video_url,
                                total_tokens: res.total_tokens,
                                isHaveSikao: false
                            });
                            // 更新displayedTexts
                            if (this.agent_content) {
                                this.$set(this.displayedTexts, placeholderIndex, this.agent_content);
                            }
                            this.clearInput()
                        } else if (res && res.image_url) {
                            // 过滤特殊标记
                            const rawContent = res.llm_result || this.agent_content || res.message || '';
                            const filteredContent = this.filterSpecialMarkers(rawContent);
                            this.agent_content = filteredContent;
                            this.agent_content1 = filteredContent;
                            // 更新占位项而不是添加新项
                            this.$set(this.agent_content_list, placeholderIndex, {
                                content: filteredContent,
                                content1: this.agent_content1,
                                imgUrlList: [res.image_url],
                                total_tokens: res.total_tokens,
                                isHaveSikao: false,
                                videoUrl: res.video_url,
                            });
                            // 更新displayedTexts
                            if (filteredContent) {
                                this.$set(this.displayedTexts, placeholderIndex, filteredContent);
                            }
                            this.clearInput()
                        } else if (res && res.image_urls && res.image_urls.length > 0) {
                            // 处理多个图片URL的情况，更新占位项而不是添加新项
                            // 过滤特殊标记
                            const rawContent = res.message || '';
                            const filteredContent = this.filterSpecialMarkers(rawContent);
                            this.agent_content = filteredContent;
                            this.agent_content1 = filteredContent;
                            // 更新占位项而不是添加新项
                            this.$set(this.agent_content_list, placeholderIndex, {
                                content: res.llm_result ? this.filterSpecialMarkers(res.llm_result) : filteredContent,
                                content1: this.agent_content1,
                                imgUrlList: res.image_urls,
                                total_tokens: res.total_tokens,
                                isHaveSikao: false,
                                videoUrl: res.video_url,
                            });
                            // 更新displayedTexts
                            if (filteredContent) {
                                this.$set(this.displayedTexts, placeholderIndex, filteredContent);
                            }
                            this.clearInput()
                        } else {
                            // 更新占位项而不是添加新项
                            // 过滤特殊标记
                            const filteredContent = this.filterSpecialMarkers(res.data.content);
                            this.agent_content = filteredContent;
                            this.agent_content1 = filteredContent;
                            // 更新占位项而不是添加新项
                            this.$set(this.agent_content_list, placeholderIndex, {
                                content: this.agent_content,
                                content1: this.agent_content1,
                                imgUrlList: [],
                                videoUrl: res.video_url,
                                total_tokens: res.total_tokens,
                                isHaveSikao: false,
                            });
                            // 更新displayedTexts
                            if (filteredContent) {
                                this.$set(this.displayedTexts, placeholderIndex, filteredContent);
                            }
                            this.clearInput()
                        }
                    }).catch(error => {
                        // 确保在错误情况下也清理资源
                        this.clearInput()
                        // 可以添加错误提示
                        uni.showToast({
                            title: '生成失败，请重试',
                            icon: 'none'
                        })
                    })
                } else {
                    // 使用WebSocket方式（原有逻辑）
                    this.requestByWebSocket(this.modelNameEN, idstring, zidingyican)
                }
            }
        },
        getaudio(task_id){
            audioEnd(task_id).then(end=>{
                if(end.data.task_status == 'succeed'){
                    clearInterval(this.audioTimer)
                    const videoWebUrl = end.data.task_result.videos[0].url
                    this.setImgsList([])
                    // 直接更新现有的'内容生成中...'项，而不是先删除再添加
                    const newIndex = this.agent_content_list.length - 1;
                    this.agent_content = '';
                    this.agent_content1 = '';
                    // 保留原始的video_ratio值
                    let videoRatio = end.data.task_result.videos[0].video_ratio || '16:9';
                    
                    // 确保video_ratio是字符串格式
                    if (typeof videoRatio !== 'string') {
                        videoRatio = '16:9'; // 默认使用16:9
                    }
                    
                    this.$set(this.agent_content_list, newIndex, {
                        content: '',
                        content1: '',
                        imgUrlList: [],
                        videoUrl: videoWebUrl,
                        video_ratio: videoRatio, // 保留原始比例
                        total_tokens: end.data.task_result.videos[0].total_tokens || 0,
                    });
                    this.displayedTexts[newIndex] = '';
                    this.clearInput()
                }else if(end.data.task_status == 'failed'){
                    clearInterval(this.audioTimer)
                }else{
                    this.audioTimer = setTimeout(()=>{
                        this.getaudio(task_id)
                    }, 2000)
                }
            })
        },
        getvideo(task_id){
            soraRequestEnd({id:task_id}).then(end=>{
                if(end.data.status == 'completed'){
                    clearInterval(this.audioTimer)
                    const videoWebUrl = end.data.video_url
                    this.setImgsList([])
                    // 直接更新现有的'内容生成中...'项，而不是先删除再添加
                    const newIndex = this.agent_content_list.length - 1;
                    this.agent_content = '';
                    this.agent_content1 = '';
                    // 根据视频宽高比设置videoRatio
                    let videoRatio = '16:9'; // 默认值
                    
                    // 判断视频宽高比
                    if (end.data && end.data.width && end.data.height) {
                        if (end.data.width > end.data.height) {
                            videoRatio = '16:9'; // 横屏
                        } else {
                            videoRatio = '9:16'; // 竖屏
                        }
                    }
                    
                    
                    this.displayedTexts[newIndex] = '';
                    this.clearInput()
                }else if(end.data.task_status == 'failed'){
                    clearInterval(this.audioTimer)
                }else{
                    this.audioTimer = setTimeout(()=>{
                        this.getvideo(task_id)
                    }, 2000)
                }
            })
        },
        requestByWebSocket(name,idstring,zidingyican) {
            this.loading = true
            let imageUrl
            if(this.imgsList.length > 0){
                imageUrl = this.imgsList[0].imgUrl
            }
            if (name == 'wan2.5-i2v-previe' && this.imgsList.length > 1) {
                uni.showToast({
                    title: '视频生成只支持上传一张图片',
                    icon: 'none'
                });
            }
            let param
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
                })
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
                })
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
                })
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
                })
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
                })
            } else if (name == 'qwen-omni') {
                param = JSON.stringify({
                    prompt: this.prompt,
                    user_uuid: this.userinfo.uuid,
                    model: 'qwen-omni',
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                })
            }else{
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
                })
            }
            // 占位项已在handleSendMessage中添加，所以当前长度就是占位项的索引
            const newIndex = this.agent_content_list.length
            // textIndex应该指向占位项的索引（即最后一个索引）
            this.textIndex = this.displayedTexts.length > 0 ? this.displayedTexts.length - 1 : 0
            
            if (this.talking) {
                this.sendTask(param)
            } else {
                this.setImgsList([])
                // WebSocket地址
                // const baseUrl = 'ws://192.168.1.72:8000'
                const baseUrl = 'wss://zca.aizhs.top'
                const socketUrl = `${baseUrl}${this.remark}`

                this.socketTask = uni.connectSocket({
                    url: socketUrl,
                    success: () => {
                    },
                    fail: (err) => {
                        this.loading = false;
                        // 添加新项目而不是修改历史记录
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
                    this.sendTask(param)
                });

                // 监听WebSocket接收到服务器的消息事件
                this.socketTask.onMessage((res) => {
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
                    // 检查token余额不足的错误提示
                    const checkTokenBalance = (messageObj) => {
                        if (!messageObj) return false;
                        
                        // 检查多个可能的字段
                        const errorText = JSON.stringify(messageObj).toLowerCase();
                        const messageText = (messageObj.message || '').toLowerCase();
                        const dataText = (messageObj.data && typeof messageObj.data === 'string' ? messageObj.data : JSON.stringify(messageObj.data || '')).toLowerCase();
                        const errorField = (messageObj.error || '').toLowerCase();
                        
                        // 检查是否包含token余额不足的关键词
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
                    };

                    // 如果检测到token余额不足，弹出提示并跳转到充值页面
                    if (checkTokenBalance(obj)) {
                        // 清理思考过程相关逻辑
                        this.clearThinkingProcessLogic();
                        this.loading = false;
                        this.talking = false;
                        
                        // 关闭WebSocket连接
                        if (this.socketTask) {
                            this.socketTask.close();
                        }
                        
                        // 弹出提示框
                        uni.showModal({
                            title: '智汇值不足',
                            content: '您的智汇值余额小于50000，无法使用大模型，是否前往充值？',
                            confirmText: '立即充值',
                            cancelText: '取消',
                            success: (res) => {
                                if (res.confirm) {
                                    // 跳转到充值页面
                                    uni.navigateTo({
                                        url: '/pagesA/top-up/index'
                                    });
                                }
                            }
                        });
                        
                        return; // 不再处理后续消息
                    }

                    if(name == 'wan2.5-i2v-preview' || name == 'wan2.5-i2v-previe'){
                        // 如果消息是"流式响应完成"，直接返回，不进行页面更改操作
                        if (obj && obj.message && obj.message === '流式响应完成') {
                            return;
                        }
                        
                        // 添加完整的空值检查，根据新的返回值格式处理
                        // 新格式: { code: 200, data: { video_url, content, total_tokens, type, event, ... } }
                        const isSuccess = obj && (
                            (obj.code === 200 && obj.data) || 
                            (obj.data && (obj.data.type === 'success' || obj.data.event === 'video_synthesis.success'))
                        );
                        
                        if (isSuccess && obj.data) {
                            // 清理思考过程相关逻辑
                            this.clearThinkingProcessLogic();
                            this.thinkingProgress = 100;
                            const datas = obj.data;
                            
                            // 使用返回的 content 或 message，如果没有则使用默认文本
                            const contentText = datas.content || datas.message || '视频生成完成';
                            this.agent_content = contentText;
                            this.agent_content1 = contentText;
                            
                            // 获取视频URL
                            const videoUrl = datas.video_url || '';
                            
                            // 获取token消耗，如果没有则默认为0
                            const totalTokens = datas.total_tokens || 0;
                            
                            // video_ratio 在新返回值中可能不存在，使用默认值 '16:9'
                            // 如果需要，可以根据视频URL或其他信息推断比例
                            const videoRatio = datas.video_ratio || '16:9';
                            
                            // 检查是否已经有对应的列表项，如果有则更新，否则创建新的
                            // newIndex 是在发送消息时计算的，此时已经创建了占位项，所以应该更新 newIndex - 1 的项
                            const currentIndex = newIndex > 0 ? newIndex - 1 : 0;
                            
                            // 检查列表项是否存在（占位项在发送消息时已创建）
                            
                            
                            // 确保 displayedTexts 有对应的索引
                            if (!this.displayedTexts[currentIndex]) {
                                this.$set(this.displayedTexts, currentIndex, '');
                            }
                            
                            // 如果视频URL存在，直接显示视频，不需要打字机效果
                            if (videoUrl) {
                                this.$set(this.displayedTexts, currentIndex, '');
                                // 使用 nextTick 确保 DOM 更新后再滚动
                                this.$nextTick(() => {
                                    this.scrollToBottom();
                                });
                            } else {
                                this.typeWriterAgentContent1(this.agent_content1, this.agent_content, currentIndex, false);
                            }
                            this.clearInput()
                        } else {
                            // 清理思考过程相关逻辑
                            this.clearThinkingProcessLogic();
                            this.thinkingProgress = 100;
                            
                            // 检查是否已经有对应的列表项
                            const currentIndex = newIndex > 0 ? newIndex - 1 : 0;
                            if (this.agent_content_list[currentIndex]) {
                                // 更新已存在的列表项（占位项）
                                
                                // 使用 Vue.set 确保响应式更新
                                this.$set(this.agent_content_list, currentIndex, {
                                    ...this.agent_content_list[currentIndex],
                                    content: '视频生成失败，请重试',
                                    content1: '',
                                    videoUrl: '',
                                    video_ratio: '16:9',
                                    total_tokens: 0,
                                    isHaveSikao: false
                                });
                                
                                // 强制触发视图更新
                                this.$forceUpdate();
                            } else {
                                // 如果列表项不存在，创建新的
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
                            this.clearInput()
                        }
                    } else {
                        if (obj.data && obj.data.content) {
                            if(obj.event && obj.event == "conversation.message.delta"){
                                // 标记为生成中的思考过程
                                if (!this.isThinkingGeneration) {
                                    this.isThinkingGeneration = true;
                                }
                                // 过滤特殊标记
                                const filteredContent = this.filterSpecialMarkers(obj.data.content.replace(/[*#]+/g, ''));
                                this.displayedAgentContent1 += filteredContent;
                                // 同时更新思考过程的流式输出显示
                                if (this.textIndex >= 0 && this.displayedThinkingTexts) {
                                    // 初始化思考过程显示内容
                                    if (this.displayedThinkingTexts[this.textIndex] === undefined) {
                                        this.$set(this.displayedThinkingTexts, this.textIndex, '');
                                    }
                                    // 更新思考过程的流式输出
                                    this.$set(this.displayedThinkingTexts, this.textIndex, this.displayedAgentContent1);
                                    // 在开始接收思考内容时，立即设置 isHaveSikao 为 true，以便内容区域显示思考过程
                                    if (this.agent_content_list[this.textIndex]) {
                                        this.$set(this.agent_content_list[this.textIndex], 'isHaveSikao', true);
                                    }
                                }
                            }else if(obj.event && obj.event == "conversation.chat.completed") {
                                // 清理思考过程相关逻辑
                                this.clearThinkingProcessLogic();
                                if(this.displayedTexts[this.textIndex] == undefined){
                                    this.displayedTexts[this.textIndex] = ''
                                }
                                // 过滤特殊标记后再添加
                                const filteredContent = this.filterSpecialMarkers(obj.data.content.replace(/[*#]+/g, ''));
                                this.displayedTexts[this.textIndex] += filteredContent;
                            }
                            this.scrollToBottom()
                        }else if(obj.message && obj.message == '流式响应完成'){
                            // 保存思考内容到agent_content_list
                            if (this.displayedAgentContent1 && this.textIndex >= 0 && this.agent_content_list[this.textIndex]) {
                                this.$set(this.agent_content_list[this.textIndex], 'thinkingContent', this.displayedAgentContent1);
                                this.$set(this.agent_content_list[this.textIndex], 'isHaveSikao', true);
                                // 同时更新思考过程的显示内容
                                if (this.displayedThinkingTexts) {
                                    this.$set(this.displayedThinkingTexts, this.textIndex, this.displayedAgentContent1);
                                }
                            }
                            // 确保将displayedTexts的内容同步到agent_content_list
                            if (this.textIndex >= 0 && this.agent_content_list[this.textIndex] && this.displayedTexts[this.textIndex]) {
                                // 过滤特殊标记
                                const finalContent = this.filterSpecialMarkers(this.displayedTexts[this.textIndex]);
                                this.$set(this.agent_content_list[this.textIndex], 'content', finalContent);
                                this.$set(this.agent_content_list[this.textIndex], 'content1', finalContent);
                            }
                            // 清理思考过程相关逻辑
                            this.clearThinkingProcessLogic();
                            this.clearInput()
                            this.scrollToBottom()
                            // 关闭WebSocket连接
                            if(this.socketTask) {
                                this.socketTask.close();
                            }
                        }
                    }

                    if(obj && obj.total_tokens && newIndex > 0 && this.agent_content_list[newIndex - 1]) {
                        this.$set(this.agent_content_list[newIndex - 1], 'total_tokens', obj.total_tokens)
                        this.$set(this.agent_content_list[newIndex - 1], 'isHaveSikao', true)
                    }

                });

                // 监听WebSocket错误事件
                this.socketTask.onError((err) => {
                    this.talking = false
                    this.loading = false;
                    // 添加新项目而不是修改历史记录
                    this.agent_content_list.push({
                        content: '连接错误，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    // 清理思考过程相关逻辑
                    this.clearThinkingProcessLogic();
                    this.socketTask.close();
                });

                // 监听WebSocket关闭事件
                this.socketTask.onClose((res) => {
                    this.talking = false
                    this.loading = false;
                });
            }

        },
        // 发送消息
        sendTask(param) {
            this.socketTask.send({
                data: param,
                success: (ss) => {
                    if (this.modelName == 'GLM-4.5') {
                        this.thinkingProgress = 100
                        this.talking = true
                        this.displayedTexts.push('')
                    }
                },
                fail: (err) => {
                    this.loading = false;
                    // 清理思考过程相关逻辑
                    this.clearThinkingProcessLogic();
                    this.agent_con1 = -1;
                    // 添加新项目而不是修改历史记录
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
        },
        pushData(datas) {
            // 添加空值检查
            if (!datas) {
                return;
            }
            
            this.thinkingProgress = 100;
            const newIndex = this.agent_content_list.length;
            
            // 检查是否有元素可以删除
            if (newIndex > 0) {
                this.agent_content_list.splice(newIndex - 1, 1);
            }
            
            this.agent_content = datas.actual_prompt || '';
            this.agent_content1 = datas.actual_prompt || '';
            this.displayedTexts[newIndex] = '';
            
            // 启动打字效果
            this.typeWriterAgentContent1(this.agent_content1, this.agent_content, newIndex, false);
            
            // 由于删除了元素，现在数组长度变短了，所以不需要再设置已删除元素的属性
            // 这些属性应该在后续添加新元素时设置
        },
        clearInput() {
            this.refreshToken()
            this.aiScrollToBottom();
            this.prompt = '';
            this.imgUrl = '';
            this.imgsLista = []
            // 清理思考过程相关逻辑
            this.clearThinkingProcessLogic();
            this.agent_con1 = -1;
            this.isShowLoading = false
            this.loading = false;
            this.refreshChatHistory()
        },
        refreshToken() {
            getAgentInfo().then(res => {
                console.log(res)
                uni.$emit('updateTokenQuantity', res.data);
            })
        },
        
        // 默认的清理思考过程逻辑方法
        // 组件可以重写此方法来提供自定义的清理逻辑
        clearThinkingProcessLogic() {
            // 基础清理逻辑，组件可以重写此方法
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
            if (this.progressIntervala) {
                clearInterval(this.progressIntervala);
                this.progressIntervala = null;
            }
            if (this.agentContent1Timer) {
                clearTimeout(this.agentContent1Timer);
                this.agentContent1Timer = null;
            }
        },
        // 处理 lists 数据的辅助方法
        // 将 lists 数组转换为适合显示的数据结构
        processListsData(res) {
            if (res && res.lists && Array.isArray(res.lists) && res.lists.length > 0) {
                const lists = res.lists;
                const imgUrlList = [];
                
                // 遍历 lists 数组，收集所有图片URL
                lists.forEach(item => {
                    if (item.type === 'image' && item.image) {
                        imgUrlList.push(item.image);
                    }
                });
                
                // 提取所有文本内容用于打字效果显示，并过滤特殊标记
                const contentTexts = lists.filter(item => item.type === 'text' && item.text).map(item => {
                    // 对每个文本项也进行过滤
                    return this.filterSpecialMarkers(item.text || '');
                });
                const combinedContent = contentTexts.join('\n\n');
                // 对最终组合的内容也进行过滤
                const filteredCombinedContent = this.filterSpecialMarkers(combinedContent);
                const filteredLlmResult = this.filterSpecialMarkers(res.llm_result || '');
                const filteredMessage = this.filterSpecialMarkers(res.message || '');
                
                return {
                    content: filteredCombinedContent || filteredLlmResult || filteredMessage || '',
                    content1: filteredCombinedContent || filteredLlmResult || filteredMessage || '',
                    imgUrlList: imgUrlList,
                    videoUrl: res.video_url || '',
                    total_tokens: res.total_tokens || 0,
                    isHaveSikao: false,
                    hasLists: true,
                    lists: lists.map(item => {
                        // 对 lists 中的文本项也进行过滤
                        if (item.type === 'text' && item.text) {
                            return {
                                ...item,
                                text: this.filterSpecialMarkers(item.text)
                            };
                        }
                        return item;
                    }) // 保留原始 lists 数组结构，但过滤文本内容
                };
            }
            return null;
        }
    }
  }
