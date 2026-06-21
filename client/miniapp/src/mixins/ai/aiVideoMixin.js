import { soraRequest, cozeZhsApiDoubaoSeedream40, cozeZhsApiDashscopeVideoGenerate } from "@/service/aiModels.js"

export default {
    methods: {
        handleSora2(idstring, zidingyican) {
            const param = {
                images: this.imgsList[0] ? this.imgsList[0].imgUrl : '',
                orientation: this.modelConfigChangeData.orientation || 0,
                prompt: this.prompt,
                chatId: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };
            soraRequest(param).then(start => {
                const task_id = start.data.id;
                this.getvideo(task_id);
            });
        },

        getvideo(task_id) {
            const { soraRequestEnd } = require("@/service/aiModels.js");
            soraRequestEnd({ id: task_id }).then(end => {
                if (end.data.status == 'completed') {
                    clearInterval(this.audioTimer);
                    const videoWebUrl = end.data.video_url;
                    this.setImgsList([]);
                    const newIndex = this.agent_content_list.length - 1;
                    this.agent_content = '';
                    this.agent_content1 = '';
                    let videoRatio = '16:9';
                    
                    if (end.data && end.data.width && end.data.height) {
                        if (end.data.width > end.data.height) {
                            videoRatio = '16:9';
                        } else {
                            videoRatio = '9:16';
                        }
                    }
                    
                    this.$set(this.agent_content_list, newIndex, {
                        content: '',
                        content1: '',
                        imgUrlList: [],
                        videoUrl: videoWebUrl,
                        video_ratio: videoRatio,
                        total_tokens: end.amountCount || 0,
                    });
                    this.displayedTexts[newIndex] = '';
                    this.clearInput();
                } else if (end.data.task_status == 'failed') {
                    clearInterval(this.audioTimer);
                } else {
                    this.audioTimer = setTimeout(() => {
                        this.getvideo(task_id);
                    }, 2000);
                }
            });
        },

        handleVolcengineT2V(idstring, zidingyican) {
            const param = {
                ...this.modelConfigChangeData,
                user_uuid: this.userinfo.uuid,
                prompt: this.prompt,
                async_mode: true,
                chat_id: idstring,
                seed: 3,
                frames: 10,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };
            cozeZhsApiDoubaoSeedream40(param, this.remark).then(res => {
                this.setImgsList([]);
                if (res && res.image_url) {
                    res.actual_prompt = '';
                    const datas = res;
                    this.pushData(datas);
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [datas.image_url],
                        total_tokens: res.total_tokens || 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                } else {
                    this.agent_content_list.push({
                        content: '图片生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                }
            }).catch(error => {
                this.agent_content_list.push({
                    content: '图片生成失败，请重试',
                    content1: '',
                    imgUrlList: [],
                    total_tokens: 0,
                    isHaveSikao: false
                });
                this.clearInput();
            });
        },

        handleDoubaoSeedream40(idstring, zidingyican) {
            const param = {
                ...this.modelConfigChangeData,
                user_uuid: this.userinfo.uuid,
                prompt: this.prompt,
                async_mode: true,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };

            cozeZhsApiDoubaoSeedream40(param, this.remark).then(res => {
                this.setImgsList([]);
                if (res && res.image_url) {
                    res.actual_prompt = '';
                    const datas = res;
                    this.pushData(datas);
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [datas.image_url],
                        total_tokens: res.total_tokens || 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                } else {
                    this.agent_content_list.push({
                        content: '视频生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                }
            }).catch(error => {
                this.agent_content_list.push({
                    content: '视频生成失败，请重试',
                    content1: '',
                    imgUrlList: [],
                    total_tokens: 0,
                    isHaveSikao: false
                });
                this.clearInput();
            });
        },

        handleDashscopeVideoGenerate(idstring, zidingyican) {
            const param = {
                ...this.modelConfigChangeData,
                user_uuid: this.userinfo.uuid,
                prompt: this.prompt,
                async_mode: true,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };

            cozeZhsApiDashscopeVideoGenerate(param, this.remark).then(res => {
                this.setImgsList([]);
                if (res && res.video_url) {
                    this.pushData({ actual_prompt: res.video_url });
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [],
                        videoUrl: res.video_url,
                        total_tokens: res.total_tokens || 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                } else {
                    this.agent_content_list.push({
                        content: '视频生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                }
            }).catch(error => {
                this.agent_content_list.push({
                    content: '视频生成失败，请重试',
                    content1: '',
                    imgUrlList: [],
                    total_tokens: 0,
                    isHaveSikao: false
                });
                this.clearInput();
            });
        }
    }
}
