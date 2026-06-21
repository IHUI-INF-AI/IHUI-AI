import {
    cozeZhsApiDashscopeImageGenerate,
    dashscopeImageEditSimple,
    cozeZhsApiDashscopeVideoGenerate,
    cozeZhsApiDoubaoSeedream40,
    cozeZhsApiLuyalaVideoCreate,
    audioStart,
    audioEnd,
    soraRequest,
    soraRequestEnd,
    aliGenerateTimbre
} from "@/service/aiModels.js"

export default {
    data() {
        return {
            requestTime: null,
            JobId: '',
            talking: false,
            socketTask: null,
            textIndex: 0,
            modelConfigChangeData: {},
            audioTimer: null
        }
    },

    computed: {
        imgsListProp() {
            return this._imgsList !== undefined ? '_imgsList' : 'imgsList'
        }
    },

    watch: {
        imgsList: {
            handler: function() {}
        }
    },

    beforeDestroy() {
        clearInterval(this.audioTimer)
    },

    methods: {
        setImgsList(value) {
            if (this._imgsList !== undefined) {
                this._imgsList = value
            } else {
                this.imgsList = value
            }
        },

        getImgsList() {
            if (this._imgsList !== undefined) {
                return this._imgsList
            }
            return this.imgsList
        },

        validatePrompt() {
            if (!this.prompt) {
                uni.showToast({
                    title: '请输入内容',
                    icon: 'none'
                })
                return false
            }
            return true
        },

        prepareChatData(idstring) {
            this.sourceIs = false
            this.isShowIcon = false
            this.inputFocused = false

            this.question_list.push({
                question: this.prompt,
                imgsLista: this.imgsList
            })

            this.agent_content_list.push({
                content: '内容生成中...',
                content1: '内容生成中...',
                imgUrlList: [],
                total_tokens: 0,
                thinkingContent: '',
                isHaveSikao: false
            })

            return idstring
        },

        handleCosyVoiceV3(idstring) {
            const selectedVoice = this.$refs.modelConfigDialog?.selectedVoice || {}
            const referenceAudio = this.modelConfigChangeData?.referenceAudio
            const audioId = typeof selectedVoice === 'object' && selectedVoice.audioId ? selectedVoice.audioId : 'longyingying'
            const audioPath = referenceAudio || ''
            const copyWriting = this.prompt
            const chatId = idstring

            if (!copyWriting || !audioId) {
                this.updateAgentContentList({
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
                })
                return
            }

            aliGenerateTimbre({
                copyWriting,
                audioId,
                audioPath,
                chatId
            }).then(res => {
                this.setImgsList([])
                res.actual_prompt = ''

                this.updateAgentContentList({
                    content: this.agent_content || '音频合成结果',
                    content1: this.agent_content1 || '',
                    imgUrlList: [],
                    audioUrl: res.data?.url || '',
                    total_tokens: res.total_tokens || 0,
                    isHaveSikao: false,
                    isAudio: true
                })

                this.clearInput()
            }).catch(err => {
                this.updateAgentContentList({
                    content: '音频合成失败',
                    content1: '',
                    imgUrlList: [],
                    audioUrl: '',
                    total_tokens: 0,
                    isHaveSikao: false,
                    isAudio: true,
                    error: JSON.stringify(err)
                })
            })
        },

        handleKeling(idstring, zidingyican) {
            if (!this.audioUrl) {
                uni.showToast({
                    title: '请上传音频文件',
                    icon: 'error',
                    duration: 2000
                })
                this.agent_con1 = -1
                return
            }

            if (this.imgsList.length < 1) {
                uni.showToast({
                    title: '请上传首帧图片',
                    icon: 'error',
                    duration: 2000
                })
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

            audioStart(param).then(start => {
                const task_id = start.data.task_id
                this.getaudio(task_id)
            })
        },

        handleSora2(idstring, zidingyican) {
            const param = {
                images: this.imgsList[0] ? this.imgsList[0].imgUrl : '',
                orientation: this.modelConfigChangeData.orientation || 0,
                prompt: this.prompt,
                chatId: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            }

            soraRequest(param).then(start => {
                const task_id = start.data.id
                this.getvideo(task_id)
            })
        },

        handleVolcengineT2v(idstring, zidingyican) {
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
                this.handleImageGenerationResponse(res, '图片生成失败，请重试')
            }).catch(() => {
                this.handleImageGenerationError('图片生成失败，请重试')
            })
        },

        handleDoubaoSeedream40(idstring, zidingyican) {
            const param = {
                ...this.modelConfigChangeData,
                user_uuid: this.userinfo.uuid,
                prompt: this.prompt,
                async_mode: true,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            }

            cozeZhsApiDoubaoSeedream40(param, this.remark).then(res => {
                this.handleImageGenerationResponse(res, '视频生成失败，请重试')
            }).catch(() => {
                this.handleImageGenerationError('视频生成失败，请重试')
            })
        },

        handleQwenImage(idstring, zidingyican) {
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

                if (res && res.image_url) {
                    res.actual_prompt = ''
                    this.pushData(res)
                    this.updateAgentContentList({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [res.image_url],
                        total_tokens: res.total_tokens || 0,
                        isHaveSikao: false
                    })
                    this.clearInput()
                } else if (res?.data?.output?.results?.length > 0) {
                    const datas = res.data.output.results[0]
                    this.pushData(datas)
                    this.updateAgentContentList({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [datas.url],
                        total_tokens: 0
                    })
                    this.clearInput()
                } else {
                    this.handleImageGenerationError('图片生成失败，请重试')
                }
            }).catch(() => {
                this.handleImageGenerationError('图片生成失败，请重试')
            })
        },

        handleQwenImageEdit(idstring, zidingyican) {
            if (this.imgsList.length > 1) {
                uni.showToast({
                    title: '该模型只支持修改一张图片',
                    icon: 'none'
                })
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
                this.thinkingProgress = 100

                if (res?.data?.image) {
                    const newIndex = this.agent_content_list.length
                    if (newIndex > 0) {
                        this.agent_content_list.splice(newIndex - 1, 1)
                    }
                    this.updateAgentContentList({
                        content: '',
                        content1: '',
                        imgUrlList: [res.data.image],
                        total_tokens: 0,
                        isHaveSikao: false
                    })
                    this.displayedTexts[newIndex] = ''
                    this.typeWriterAgentContent1('', '', newIndex, false)
                    this.clearInput()
                } else {
                    this.handleImageGenerationError('图片编辑失败，请重试')
                }
            }).catch(() => {
                this.handleImageGenerationError('图片编辑失败，请重试')
            })
        },

        handleWan25I2vPreview(idstring, zidingyican) {
            const param = {
                ...this.modelConfigChangeData,
                prompt: this.prompt,
                model: 'wan2.5-t2v-plus',
                negative_prompt: '',
                user_uuid: this.userinfo.uuid,
                async_mode: true,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            }

            cozeZhsApiDashscopeVideoGenerate(param, this.remark).then(res => {
                this.handleVideoGenerationResponse(res)
            }).catch(() => {
                this.handleVideoGenerationError()
            })
        },

        handleImageGenerationResponse(res, errorMsg = '生成失败，请重试') {
            if (res && res.image_url) {
                res.actual_prompt = ''
                this.pushData(res)
                this.updateAgentContentList({
                    content: this.agent_content,
                    content1: this.agent_content1,
                    imgUrlList: [res.image_url],
                    total_tokens: res.total_tokens || 0,
                    isHaveSikao: false
                })
                this.clearInput()
            } else {
                this.handleImageGenerationError(errorMsg)
            }
        },

        handleImageGenerationError(errorMsg) {
            this.updateAgentContentList({
                content: errorMsg,
                content1: '',
                imgUrlList: [],
                total_tokens: 0,
                isHaveSikao: false
            })
            this.clearInput()
        },

        handleVideoGenerationResponse(res) {
            this.setImgsList([])
            if (res?.data?.video_url) {
                this.updateAgentContentList({
                    content: '',
                    content1: '',
                    imgUrlList: [],
                    videoUrl: res.data.video_url,
                    total_tokens: 0,
                    isHaveSikao: false
                })
                this.clearInput()
            } else {
                this.handleVideoGenerationError()
            }
        },

        handleVideoGenerationError() {
            this.updateAgentContentList({
                content: '视频生成失败，请重试',
                content1: '',
                imgUrlList: [],
                total_tokens: 0,
                isHaveSikao: false
            })
            this.clearInput()
        },

        updateAgentContentList(data) {
            if (this.agent_content_list.length > 0) {
                this.agent_content_list[this.agent_content_list.length - 1] = data
            } else {
                this.agent_content_list.push(data)
            }
        }
    }
}
