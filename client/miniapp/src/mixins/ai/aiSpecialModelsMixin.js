import { tencentHunyuan3dSubmit, tencentHunyuan3dQuery } from "@/service/aiModels.js"

export default {
    data() {
        return {
            requestTime: null,
            JobId: ''
        }
    },

    beforeDestroy() {
        if (this.requestTime) {
            clearTimeout(this.requestTime);
        }
    },

    methods: {
        handleHunyuanTo3D(idstring, zidingyican) {
            const param = {
                Prompt: this.prompt,
                ResultFormat: "MP4",
                EnablePBR: false,
                user_uuid: this.userinfo.uuid,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };

            tencentHunyuan3dSubmit(param, this.remark).then(res => {
                this.setImgsList([]);
                if (res.data.JobId) {
                    this.JobId = res.data.JobId;
                    this.requestTime = setTimeout(() => {
                        tencentHunyuan3dQuery({
                            JobId: this.JobId,
                            user_uuid: this.userinfo.uuid,
                        }).then(resolve => {

                        });
                    }, 300000);
                }
            });
        },

        handleNanoBanana(idstring, zidingyican) {
            const { cozeZhsApiLuyalaChatCompletions } = require("@/service/aiModels.js");
            let imgs = this.imgsList.map(item => {
                return {
                    type: 'image_url',
                    image_url: {
                        url: item.imgUrl
                    }
                };
            });
            imgs.unshift({
                type: "text",
                text: this.prompt
            });

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
            };

            cozeZhsApiLuyalaChatCompletions(param, this.remark).then(res => {
                this.setImgsList([]);
                this.pushData({
                    actual_prompt: res.data.choices[0].message.content
                });

                if (res.data.uploaded_files.length > 0) {
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: res.data.uploaded_files,
                        total_tokens: res.total_tokens,
                        isHaveSikao: false
                    });
                    this.clearInput();
                } else {
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [],
                        total_tokens: res.total_tokens,
                        isHaveSikao: false
                    });
                }
            });
        },

        handleVeo3Frames(idstring, zidingyican) {
            const { cozeZhsApiLuyalaVideoCreate } = require("@/service/aiModels.js");
            let imgs = this.imgsList;
            const param = {
                prompt: this.prompt,
                images: this.imgsList,
                user_uuid: this.userinfo.uuid,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };

            cozeZhsApiLuyalaVideoCreate(param, this.remark).then(res => {
                this.setImgsList([]);

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
                    this.clearInput();
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
                    });
                    this.clearInput();
                } else {
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [],
                        total_tokens: res.total_tokens,
                        videoUrl: res.video_url,
                    });
                }
            });
        },

        handleHttpModel(idstring, zidingyican) {
            const { cozeZhsApiLuyalaVideoCreate } = require("@/service/aiModels.js");
            const currentModel = this.modelInfo && this.modelInfo.name ? this.modelInfo : (this.modelList && this.modelList[this.pitch] ? this.modelList[this.pitch] : null);

            if (currentModel) {
                const isHttpModelType = currentModel && currentModel.grass_roots == 'java';
                let imgs = this.imgsList;
                const param = {
                    prompt: this.prompt,
                    images: this.imgsList,
                    user_uuid: this.userinfo.uuid,
                    chat_id: idstring,
                    ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
                };
                let baseurl = isHttpModelType ? 1 : 3;

                cozeZhsApiLuyalaVideoCreate(param, this.remark, baseurl).then(res => {
                    this.setImgsList([]);

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
                        this.clearInput();
                    } else if (res.video_url) {
                        this.pushData({
                            actual_prompt: res.video_url
                        });
                        this.agent_content = res.llm_result || this.agent_content || res.message || '';
                        this.agent_content1 = res.llm_result || this.agent_content || res.message || '';
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [],
                            videoUrl: res.video_url,
                            total_tokens: res.total_tokens,
                            isHaveSikao: false
                        });
                        this.clearInput();
                    } else if (res && res.image_url) {
                        this.agent_content = res.llm_result || this.agent_content || res.message || '';
                        this.agent_content1 = res.llm_result || this.agent_content || res.message || '';
                        const newIndex = this.agent_content_list.length;
                        this.displayedTexts[newIndex] = res.llm_result || this.agent_content || res.message || '';
                        this.agent_content_list.push({
                            content: res.llm_result || this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [res.image_url],
                            total_tokens: res.total_tokens,
                            isHaveSikao: false,
                            videoUrl: res.video_url,
                        });
                        this.clearInput();
                    } else if (res && res.image_urls && res.image_urls.length > 0) {
                        this.agent_content = res.message || '';
                        this.agent_content1 = res.message || '';
                        const newIndex = this.agent_content_list.length;
                        this.displayedTexts[newIndex] = res.message || '';
                        this.agent_content_list.push({
                            content: res.llm_result || this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: res.image_urls,
                            total_tokens: res.total_tokens,
                            isHaveSikao: false,
                            videoUrl: res.video_url,
                        });
                        this.clearInput();
                    } else {
                        this.agent_content = res.data.content;
                        this.agent_content1 = res.data.content;
                        const newIndex = this.agent_content_list.length;
                        this.displayedTexts[newIndex] = res.data.content;
                        this.agent_content_list.push({
                            content: this.agent_content,
                            content1: this.agent_content1,
                            imgUrlList: [],
                            videoUrl: res.video_url,
                            total_tokens: res.total_tokens,
                            isHaveSikao: false,
                        });
                        this.clearInput();
                    }
                }).catch(error => {
                    this.clearInput();
                    uni.showToast({
                        title: '生成失败，请重试',
                        icon: 'none'
                    });
                });
            }
        }
    }
}
