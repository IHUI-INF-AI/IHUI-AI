import { aliGenerateTimbre, audioStart } from "@/service/aiModels.js"

export default {
    methods: {
        handleCosyVoiceV3(idstring) {
            const selectedVoice = this.$refs.modelConfigDialog?.selectedVoice || {};
            const referenceAudio = this.modelConfigChangeData?.referenceAudio;
            const audioId = typeof selectedVoice === 'object' && selectedVoice.audioId ? selectedVoice.audioId : 'longyingying';
            const audioPath = referenceAudio || '';
            const copyWriting = this.prompt;
            const chatId = idstring;

            if (copyWriting && audioId) {
                aliGenerateTimbre({
                    copyWriting,
                    audioId,
                    audioPath,
                    chatId
                }).then(res => {
                    this.setImgsList([]);
                    res.actual_prompt = '';
                    const datas = res;

                    const audioData = {
                        content: this.agent_content || '音频合成结果',
                        content1: this.agent_content1 || '',
                        imgUrlList: [],
                        audioUrl: datas.data.url || '',
                        total_tokens: res.total_tokens || 0,
                        isHaveSikao: false,
                        isAudio: true
                    };

                    if (this.agent_content_list.length > 0) {
                        this.agent_content_list[this.agent_content_list.length - 1] = audioData;
                    } else {
                        this.agent_content_list.push(audioData);
                    }

                    this.clearInput();
                }).catch(err => {
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
        },

        handleKeling(idstring, zidingyican) {
            if (!this.audioUrl) {
                uni.showToast({
                    title: '请上传音频文件',
                    icon: 'error',
                    duration: 2000
                });
                this.agent_con1 = -1;
                return;
            }
            if (this.imgsList.length < 1) {
                uni.showToast({
                    title: '请上传首帧图片',
                    icon: 'error',
                    duration: 2000
                });
                this.agent_con1 = -1;
                return;
            }

            const param = {
                image: this.imgsList[0].imgUrl,
                soundFile: this.audioUrl,
                prompt: this.prompt,
                chatId: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };

            audioStart(param).then(start => {
                const task_id = start.data.task_id;
                this.getaudio(task_id);
            });
        },

        getaudio(task_id) {
            const { audioEnd } = require("@/service/aiModels.js");
            audioEnd(task_id).then(end => {
                if (end.data.task_status == 'succeed') {
                    clearInterval(this.audioTimer);
                    const videoWebUrl = end.data.task_result.videos[0].url;
                    this.setImgsList([]);
                    const newIndex = this.agent_content_list.length - 1;
                    this.agent_content = '';
                    this.agent_content1 = '';
                    let videoRatio = end.data.task_result.videos[0].video_ratio || '16:9';
                    
                    if (typeof videoRatio !== 'string') {
                        videoRatio = '16:9';
                    }
                    
                    this.$set(this.agent_content_list, newIndex, {
                        content: '',
                        content1: '',
                        imgUrlList: [],
                        videoUrl: videoWebUrl,
                        video_ratio: videoRatio,
                        total_tokens: end.data.task_result.videos[0].total_tokens || 0,
                    });
                    this.displayedTexts[newIndex] = '';
                    this.clearInput();
                } else if (end.data.task_status == 'failed') {
                    clearInterval(this.audioTimer);
                } else {
                    this.audioTimer = setTimeout(() => {
                        this.getaudio(task_id);
                    }, 2000);
                }
            });
        }
    }
}
