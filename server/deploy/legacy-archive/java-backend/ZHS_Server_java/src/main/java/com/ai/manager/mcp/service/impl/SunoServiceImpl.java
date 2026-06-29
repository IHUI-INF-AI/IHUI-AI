package com.ai.manager.mcp.service.impl;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.mcp.service.AgentService;
import com.ai.manager.mcp.service.SunoService;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.mapper.ZhsUserAgentContextMapper;
import com.ai.manager.small.service.impl.MinioSysFileServiceImpl;
import com.alibaba.druid.support.json.JSONUtils;
import lombok.extern.slf4j.Slf4j;
import org.assertj.core.util.Lists;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class SunoServiceImpl implements SunoService {

    @Value("${sora2.api.key}")
    private String YUNWU_TOKEN;

    private final String MODEL_SUNO = "chirp-v5";
    private final String DB_MODEL_NAME = "chirp-v5";

    private final String DEFAULT_DOMAIN = "https://yunwu.ai";

    @Autowired
    private ZhsUserAgentContextMapper contextMapper;

    @Autowired
    private MinioSysFileServiceImpl minioSysFileService;
    @Autowired
    private AgentService agentService;

    @Override
    public ResponseResultInfo generateMusic(Map<String, Object> param, String problem) {
        param.put("mv", MODEL_SUNO);
        Integer type = Integer.valueOf(param.get("type").toString());
        String chatId = param.get("chat_id").toString();
        String uuid = param.get("creator").toString();
        param.remove("type");
        param.remove("chatId");
        param.remove("creator");
        agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, "user", null, "text", problem, null);

        // 判断请求地址
        String uri = "/suno/submit/music";
        if(type == 4){
            uri = "/suno/submit/concat";
        }

        if(type == 0){
            param.put("gpt_description_prompt", param.get("prompt"));
            param.remove("prompt");
        }
        if(type == 1){
        }
        if(type == 2){
            param.put("task", "upload_extend");
            param.put("continue_clip_id", param.get("clip_id"));
            param.remove("clip_id");
            param.remove("make_instrumental");
        }
        if(type == 3){
            param.put("task", "extend");
            param.put("continue_clip_id", param.get("clip_id"));
            param.remove("clip_id");
            param.remove("make_instrumental");
        }
        if(type == 4){
            param.put("is_infill", param.get("make_instrumental"));
            param.remove("make_instrumental");
            param.remove("prompt");
        }

        // 调用suno
        String body = generate(param, uri);
        Object parse = JSONUtils.parse(body);
        String clip_id = "";
        if (parse instanceof Map){
            clip_id = ((Map)parse).get("data").toString();
        }

        // 获取data值作为clip_id 同时周期性调用获取任务进程
        boolean isContinue = true;
        List result = Lists.newArrayList();
        do {
            // 等待一秒
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.err.println("等待被中断，终止业务逻辑");
                break;
            }
            String infoBody = getInfo(clip_id);
            JSONObject infoJson = new JSONObject(infoBody);
            if (!infoJson.getString("code").equalsIgnoreCase("success")){
                continue;
            }
            JSONObject data = infoJson.getJSONObject("data");
            if (!data.getString("status").equalsIgnoreCase("success")){
                continue;
            }
            JSONArray dataArray = data.getJSONArray("data");
            for (int i = 0; i < dataArray.length(); i++) {
                JSONObject music = dataArray.getJSONObject(i);
                // 判断是否结束
                if(music.getString("state").equalsIgnoreCase("succeeded") && music.getString("status").equalsIgnoreCase("complete")){
                    result = dataArray.toList();
                    isContinue = false;
                    break;
                }
            }
        }while (isContinue);

        saveContext(problem, uuid, chatId, result);


        return ResponseResultInfo.success(result);
    }

    private void saveContext(String problem, String uuid, String chatId, List result) {
        // 处理文件 对文件保存到本地服务器
        if (result != null && !result.isEmpty()) {
            for (int i = 0; i < result.size(); i++) {
                if (result.get(i) instanceof Map) {
                    Map<String, Object> itemMap = (Map<String, Object>) result.get(i);
                    
                    // 检查并处理audio_url字段
                    if (itemMap.containsKey("audio_url") && itemMap.get("audio_url") != null) {
                        String audioUrl = itemMap.get("audio_url").toString();
                        if (audioUrl.startsWith("http")) {
                            try {
                                ResponseResultInfo<String> uploadResult = minioSysFileService.fileUploadNetworkPath(audioUrl);
                                if ("200".equals(uploadResult.getCode()) && uploadResult.getData() != null) {
                                    itemMap.put("audio_url", uploadResult.getData());
                                    agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, null, null, "audio", uploadResult.getData(), null);

                                }
                            } catch (Exception e) {
                                System.err.println("上传音频文件失败: " + e.getMessage());
                            }
                        }
                    }
                    
                    // 检查并处理video_url字段
                    if (itemMap.containsKey("video_url") && itemMap.get("video_url") != null) {
                        String videoUrl = itemMap.get("video_url").toString();
                        if (videoUrl.startsWith("http")) {
                            try {
                                ResponseResultInfo<String> uploadResult = minioSysFileService.fileUploadNetworkPath(videoUrl);
                                if ("200".equals(uploadResult.getCode()) && uploadResult.getData() != null) {
                                    itemMap.put("video_url", uploadResult.getData());
                                    agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, null, null, "video", uploadResult.getData(), null);
                                }
                            } catch (Exception e) {
                                System.err.println("上传视频文件失败: " + e.getMessage());
                            }
                        }
                    }
                    
                    // 检查并处理image_url字段
                    if (itemMap.containsKey("image_url") && itemMap.get("image_url") != null) {
                        String imageUrl = itemMap.get("image_url").toString();
                        if (imageUrl.startsWith("http")) {
                            try {
                                ResponseResultInfo<String> uploadResult = minioSysFileService.fileUploadNetworkPath(imageUrl);
                                if ("200".equals(uploadResult.getCode()) && uploadResult.getData() != null) {
                                    itemMap.put("image_url", uploadResult.getData());
                                    agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, null, null, "image", uploadResult.getData(), null);
                                }
                            } catch (Exception e) {
                                System.err.println("上传图片文件失败: " + e.getMessage());
                            }
                        }
                    }
                    
                    // 检查并处理image_large_url字段
                    if (itemMap.containsKey("image_large_url") && itemMap.get("image_large_url") != null) {
                        String imageLargeUrl = itemMap.get("image_large_url").toString();
                        if (imageLargeUrl.startsWith("http")) {
                            try {
                                ResponseResultInfo<String> uploadResult = minioSysFileService.fileUploadNetworkPath(imageLargeUrl);
                                if ("200".equals(uploadResult.getCode()) && uploadResult.getData() != null) {
                                    itemMap.put("image_large_url", uploadResult.getData());
                                    agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, null, null, "image", uploadResult.getData(), null);
                                }
                            } catch (Exception e) {
                                System.err.println("上传大图文件失败: " + e.getMessage());
                            }
                        }
                    }
                    
                    // 检查并处理avatar_image_url字段
                    if (itemMap.containsKey("avatar_image_url") && itemMap.get("avatar_image_url") != null) {
                        String avatarImageUrl = itemMap.get("avatar_image_url").toString();
                        if (avatarImageUrl.startsWith("http")) {
                            try {
                                ResponseResultInfo<String> uploadResult = minioSysFileService.fileUploadNetworkPath(avatarImageUrl);
                                if ("200".equals(uploadResult.getCode()) && uploadResult.getData() != null) {
                                    itemMap.put("avatar_image_url", uploadResult.getData());
                                    agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, null, null, "image", uploadResult.getData(), null);
                                }
                            } catch (Exception e) {
                                System.err.println("上传头像图片文件失败: " + e.getMessage());
                            }
                        }
                    }
                    // 检查并处理avatar_image_url字段
                    if (itemMap.containsKey("prompt") && itemMap.get("prompt") != null) {
                        String prompt = itemMap.get("prompt").toString();
                        agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, null, null, "text", prompt, null);
                    }

                    // 更新列表中的对象
                    result.set(i, itemMap);
                }
            }
        }


        agentService.sendMessageToPublic(uuid, DB_MODEL_NAME, chatId, null, "stop", "text", "", null);

        // 保存上下文
        ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                .id(UUID.randomUUID().toString())
                .agentId(DB_MODEL_NAME)
                .userUuid(uuid)
                .problem(problem)
                .sendTime(Instant.now().getEpochSecond())
                .modelName(DB_MODEL_NAME)
                .chatId(chatId)
                .videoRatio("0")
                .answer(JSONUtils.toJSONString(result))
                .build();
        contextMapper.insertZhsUserAgentContext(build);

        // 计算token消耗：固定消耗3*20000*5/10
         Long tokenConsumption = 3L * 20000L * 5L / 10L;
         
         // 扣减用户token
         if (uuid != null && !uuid.isEmpty()) {
             contextMapper.userConsume(uuid, tokenConsumption);
             log.info("用户{}使用Suno服务消耗token: {}", uuid, tokenConsumption);
         }
    }

    private String getInfo(String clipId) {
        String uri = "/suno/fetch/%s";
        HttpResponse postResponse = HttpRequest.get( DEFAULT_DOMAIN + String.format(uri,clipId))
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header(BeanConfig.ZHS_AUTHORIZATION, "Bearer " + YUNWU_TOKEN)
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: " + body);
        return body;
    }

    private String generate(Map<String, Object> param, String uri) {
        HttpResponse postResponse = HttpRequest.post( DEFAULT_DOMAIN + uri)
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header(BeanConfig.ZHS_AUTHORIZATION, "Bearer " + YUNWU_TOKEN)
                .body(JSONUtils.toJSONString(param))
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: " + body);
        return body;
        // {"code":0,"message":"SUCCEED","request_id":"a60990f3-b485-4dbb-b02f-6eea9cd000c5","data":{"task_id":"797182621750399062","task_status":"submitted","created_at":1758091666748,"updated_at":1758091666748}}
    }
}
