package com.ai.manager.mcp.service.impl;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.mcp.service.AgentService;
import com.ai.manager.mcp.service.JianYiAIService;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.mapper.ZhsUserAgentContextMapper;
import com.alibaba.druid.support.json.JSONUtils;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.google.common.collect.Maps;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class JianYiSora2ServiceImpl implements JianYiAIService {

    @Value("${sora2.api.key}")
    private String soraApiKey;
    private final String MODEL_SORA = "sora-2-all";
    private final String DB_MODEL_SORA = "sora-2";

    /*
    http://jeniya.top

     */
    private final String DEFAULT_DOMAIN = "https://yunwu.ai";

    @Autowired
    private ZhsUserAgentContextMapper contextMapper;
    @Autowired
    private AgentService agentService;


    @Override
    public ResponseResultInfo generateVideoBySora2(Map<String, Object> param) {
        // 逗号分隔图片路径
        String images = param.getOrDefault("images", "").toString();
        String prompt = param.getOrDefault("prompt", "").toString();
//        String prompt = "";
        // 横屏竖屏 0竖屏 portrait | 1横屏 landscape
        Integer orientation = Integer.valueOf(param.get("orientation").toString());

        String uuid = param.getOrDefault("uuid", "").toString();
        String chatId = param.getOrDefault("chatId", "").toString();
        StringBuilder imgSB = new StringBuilder();
        try {
            JSONArray objects = JSON.parseArray(images);
            for (int i = 0; i < objects.size(); i++) {
                com.alibaba.fastjson.JSONObject jsonObject = objects.getJSONObject(i);
                if(jsonObject.containsKey("image_url")){
                    if(imgSB.length()>0){
                        imgSB.append(",");
                    }
                    imgSB.append(jsonObject.getString("image_url"));
                }
                if(jsonObject.containsKey("imageUrl")){
                    if(imgSB.length()>0){
                        imgSB.append(",");
                    }
                    imgSB.append(jsonObject.getString("imageUrl"));
                }
                if(jsonObject.containsKey("imgUrl")){
                    if(imgSB.length()>0){
                        imgSB.append(",");
                    }
                    imgSB.append(jsonObject.getString("imgUrl"));
                }
                if(jsonObject.containsKey("img_url")){
                    if(imgSB.length()>0){
                        imgSB.append(",");
                    }
                    imgSB.append(jsonObject.getString("img_url"));
                }
            }
        }catch (Exception e){
            imgSB.append(images);
        }
        images = imgSB.toString();
        if(imgSB.length()>0)
            agentService.sendMessageToPublic(uuid,DB_MODEL_SORA, chatId, "user", null, "image", images, null);
        agentService.sendMessageToPublic(uuid,DB_MODEL_SORA, chatId, "user", null, "text", prompt, null);

        String s = create(images, orientation, prompt);
        /*
        {
            "id": "sora-2:task_01k78x9fwse07r1p0vbd7j0ts3",
            "status": "pending",
            "status_update_time": 1760162005183
        }
        */


        // 判断结果是否是token过期
        Object parse = JSONUtils.parse(s);

        if (parse instanceof Map) {
            Map result = (Map) parse;
            // 轮询查询任务
            do {
                ResponseResultInfo<Object> responseResultInfo = videoInfoBySora2_2(result.get("id").toString(), uuid, prompt, images, chatId);
                if(Objects.isNull(responseResultInfo)){
                    try {
                        Thread.sleep(10*1000);
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }while (true);
            return ResponseResultInfo.success(parse);
        }
        return ResponseResultInfo.error(parse, "生成失败");
    }


    private String create(String images, Integer orientation, String prompt) {

        Map<String, Object> param = Maps.newHashMap();
        if(StringUtils.isBlank(images)){
            param.put("images", Lists.newArrayList(images.split(",")));
        }else {
            param.put("images", Lists.newArrayList());
        }
        param.put("model", MODEL_SORA);
        // 0横屏 landscape | 1竖屏 portrait
        param.put("orientation", "landscape");
        if(orientation != null && orientation == 1){
            param.put("orientation", "portrait");
        }
//        param.put("prompt",""); // 提示词
        param.put("prompt", prompt);
        // large高清 | small一般
        param.put("size", "large");

        // 2. POST 请求（JSON 数据）
        HttpResponse postResponse = HttpRequest.post( DEFAULT_DOMAIN + "/v1/video/create")
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header(BeanConfig.ZHS_AUTHORIZATION, "Bearer " + soraApiKey)
                .body(JSONUtils.toJSONString(param))
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: " + body);

        return body;
        // {"code":0,"message":"SUCCEED","request_id":"a60990f3-b485-4dbb-b02f-6eea9cd000c5","data":{"task_id":"797182621750399062","task_status":"submitted","created_at":1758091666748,"updated_at":1758091666748}}

    }

    @Override
    public ResponseResultInfo videoInfoBySora2(String id, String uuid) {

        // 根据id获取任务进度
        String info = getInfo(id);
        /*
{
    "id": "sora-2:task_01k7645sgxec3s5n0mrx5bezay",
    "width": 640,
    "detail": {
        "id": "task_01k7645sgxec3s5n0mrx5bezay",
        "url": "https://filesystem.site/gptimage/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000%2Fsrc.mp4?st=2025-10-10T02%3A48%3A51Z&se=2025-10-16T03%3A48%3A51Z&sks=b&skt=2025-10-10T02%3A48%3A51Z&ske=2025-10-16T03%3A48%3A51Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=8b872fb2-b44b-4c1d-9ff6-1d4509d19e6e&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=aKZUPdruK12eeBLd5j5I5PsyRFcdtb%2FWUt90ursFSFw%3D&az=oaivgprodscus",
        "input": {
            "prompt": "愚公移山",
            "orientation": "landscape"
        },
        "status": "completed",
        "gif_url": "https://filesystem.site/gptimage/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000%2Fpreview.gif?st=2025-10-10T02%3A48%3A51Z&se=2025-10-16T03%3A48%3A51Z&sks=b&skt=2025-10-10T02%3A48%3A51Z&ske=2025-10-16T03%3A48%3A51Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=8b872fb2-b44b-4c1d-9ff6-1d4509d19e6e&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=qpyEEhJnH8ddWjdnXzolS6hR3ajijf21vSsQdcR6jMo%3D&az=oaivgprodscus",
        "post_id": "s_68e8846744148191a4cf7acbde16cf30",
        "created_at": 1760068560887,
        "draft_info": {
            "id": "gen_01k7649mnef6m9ezh256jj23sr",
            "url": "https://videos.openai.com/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000_wm%2Fsrc.mp4?st=2025-10-10T02%3A52%3A19Z&se=2025-10-16T03%3A52%3A19Z&sks=b&skt=2025-10-10T02%3A52%3A19Z&ske=2025-10-16T03%3A52%3A19Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=fea36edb-a052-425e-a84a-436fdce0a7b4&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=Lc3QLYK4wvN3JAE3cfqwNX1tc4qxIhNPHJIp8zQsKwU%3D&az=oaivgprodscus",
            "kind": "sora_draft",
            "tags": [],
            "title": null,
            "width": 640,
            "height": 352,
            "prompt": "愚公移山",
            "task_id": "task_01k7645sgxec3s5n0mrx5bezay",
            "encodings": {
                "md": {
                    "path": "https://videos.openai.com/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000_wm%2Fmd.mp4?st=2025-10-10T02%3A52%3A19Z&se=2025-10-16T03%3A52%3A19Z&sks=b&skt=2025-10-10T02%3A52%3A19Z&ske=2025-10-16T03%3A52%3A19Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=fea36edb-a052-425e-a84a-436fdce0a7b4&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=wSaHGS%2BPG8SvMyuHn0F8IaBZvGSN5W6lwtDpKruJGdQ%3D&az=oaivgprodscus"
                },
                "gif": {
                    "path": "https://videos.openai.com/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000_wm%2Fpreview.gif?st=2025-10-10T02%3A52%3A19Z&se=2025-10-16T03%3A52%3A19Z&sks=b&skt=2025-10-10T02%3A52%3A19Z&ske=2025-10-16T03%3A52%3A19Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=fea36edb-a052-425e-a84a-436fdce0a7b4&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=PBJRGqoAe%2Ffb7ft8cCOv%2BrkUtQ83eCIPue6ermf9Z1E%3D&az=oaivgprodscus"
                },
                "source": {
                    "path": "https://videos.openai.com/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000_wm%2Fsrc.mp4?st=2025-10-10T02%3A52%3A19Z&se=2025-10-16T03%3A52%3A19Z&sks=b&skt=2025-10-10T02%3A52%3A19Z&ske=2025-10-16T03%3A52%3A19Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=fea36edb-a052-425e-a84a-436fdce0a7b4&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=Lc3QLYK4wvN3JAE3cfqwNX1tc4qxIhNPHJIp8zQsKwU%3D&az=oaivgprodscus"
                },
                "unfurl": null,
                "source_wm": {
                    "path": "https://videos.openai.com/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000_wm%2Fsrc.mp4?st=2025-10-10T02%3A52%3A19Z&se=2025-10-16T03%3A52%3A19Z&sks=b&skt=2025-10-10T02%3A52%3A19Z&ske=2025-10-16T03%3A52%3A19Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=fea36edb-a052-425e-a84a-436fdce0a7b4&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=Lc3QLYK4wvN3JAE3cfqwNX1tc4qxIhNPHJIp8zQsKwU%3D&az=oaivgprodscus"
                },
                "thumbnail": {
                    "path": "https://videos.openai.com/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000_wm%2Fthumbnail.webp?st=2025-10-10T02%3A52%3A19Z&se=2025-10-16T03%3A52%3A19Z&sks=b&skt=2025-10-10T02%3A52%3A19Z&ske=2025-10-16T03%3A52%3A19Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=fea36edb-a052-425e-a84a-436fdce0a7b4&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=eVdWqZRCAp6WjoCmJxW2QZ5xN0eIWn1w69UTr3VD2zo%3D&az=oaivgprodscus"
                }
            },
            "created_at": 1760068702.231306,
            "generation_id": "gen_01k7649mnef6m9ezh256jj23sr",
            "storyboard_id": null,
            "draft_reviewed": false,
            "creation_config": {
                "prompt": "愚公移山",
                "task_id": null,
                "n_frames": null,
                "style_id": null,
                "orientation": null,
                "inpaint_image": null,
                "storyboard_id": null,
                "cameo_profiles": null,
                "remix_target_post": null
            },
            "generation_type": "",
            "downloadable_url": "https://videos.openai.com/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000_wm%2Fsrc.mp4?st=2025-10-10T02%3A52%3A19Z&se=2025-10-16T03%3A52%3A19Z&sks=b&skt=2025-10-10T02%3A52%3A19Z&ske=2025-10-16T03%3A52%3A19Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=fea36edb-a052-425e-a84a-436fdce0a7b4&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=Lc3QLYK4wvN3JAE3cfqwNX1tc4qxIhNPHJIp8zQsKwU%3D&az=oaivgprodscus"
        },
        "thumbnail_url": "https://filesystem.site/gptimage/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000%2Fthumbnail.webp?st=2025-10-10T02%3A48%3A51Z&se=2025-10-16T03%3A48%3A51Z&sks=b&skt=2025-10-10T02%3A48%3A51Z&ske=2025-10-16T03%3A48%3A51Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=8b872fb2-b44b-4c1d-9ff6-1d4509d19e6e&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=c6uvwXyQ9AtB9sT8hTduID8VViUsrEvpqTp4jvae5c0%3D&az=oaivgprodscus"
    },
    "height": 352,
    "status": "completed",
    "video_url": "https://filesystem.site/gptimage/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000%2Fsrc.mp4?st=2025-10-10T02%3A48%3A51Z&se=2025-10-16T03%3A48%3A51Z&sks=b&skt=2025-10-10T02%3A48%3A51Z&ske=2025-10-16T03%3A48%3A51Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=8b872fb2-b44b-4c1d-9ff6-1d4509d19e6e&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=aKZUPdruK12eeBLd5j5I5PsyRFcdtb%2FWUt90ursFSFw%3D&az=oaivgprodscus",
    "thumbnail_url": "https://filesystem.site/gptimage/vg-assets/assets%2Ftask_01k7645sgxec3s5n0mrx5bezay%2Ftask_01k7645sgxec3s5n0mrx5bezay_genid_5c52c286-3a20-49d1-badc-b55a858e3136_25_10_10_03_57_629241%2Fvideos%2F00000%2Fthumbnail.webp?st=2025-10-10T02%3A48%3A51Z&se=2025-10-16T03%3A48%3A51Z&sks=b&skt=2025-10-10T02%3A48%3A51Z&ske=2025-10-16T03%3A48%3A51Z&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skoid=8b872fb2-b44b-4c1d-9ff6-1d4509d19e6e&skv=2019-02-02&sv=2018-11-09&sr=b&sp=r&spr=https%2Chttp&sig=c6uvwXyQ9AtB9sT8hTduID8VViUsrEvpqTp4jvae5c0%3D&az=oaivgprodscus",
    "status_update_time": 1760068720553
}
         */
        System.out.println(info);
        JSONObject parse = new JSONObject(info);

        // 判断是否结束
        Long second = 0L;
        if(parse.getString("status").equals("completed")){
            JSONObject detail = parse.getJSONObject("detail");

            // 保存下文
            ZhsUserAgentContext context = contextMapper.getUserContextByTaskId(id);
            if (Objects.isNull(context)) {
                return ResponseResultInfo.error(JSONUtils.parse(parse.toString()), "未找到当前任务");
            }
            context.setAnswer(info);
            context.setAnswer(info);

            context.setAgentUrl(detail.getString("url"));

            // TODO 计算价格
            second = 20000L / 1000 * 168;
            context.setField1(second.toString());
            contextMapper.updateZhsUserAgentContext(context);
            // 查看消耗总数  1.6元/秒
            Integer i = contextMapper.userConsume(uuid, second);
        }

        ResponseResultInfo<Object> success = ResponseResultInfo.success(JSONUtils.parse(parse.toString()));
        success.setAmountCount(second);
        return success;
    }

    /**
     *
     * @param id
     * @param uuid
     * @param prompt
     * @param images
     * @param chatId
     * @return
     */
    private ResponseResultInfo<Object> videoInfoBySora2_2(String id, String uuid, String prompt, String images, String chatId) {

        // 根据id获取任务进度
        String info = getInfo(id);
        System.out.println(info);
        JSONObject parse = new JSONObject(info);
        // 判断是否结束
        Long second = 0L;
        if(parse.getString("status").equals("completed")){
            JSONObject detail = parse.getJSONObject("detail");
            // TODO 计算价格
            second = 20000L / 1000 * 168;
            agentService.sendMessageToPublic(uuid,DB_MODEL_SORA, chatId, null, "stop", "value", detail.getString("url"), null);

            // 保存上下文
            ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                    .id(UUID.randomUUID().toString())
                    .agentId(DB_MODEL_SORA)
                    .userUuid(uuid)
                    .problem(prompt)
                    .userUrl(images)
                    .sendTime(Instant.now().getEpochSecond())
                    .modelName(DB_MODEL_SORA)
                    .chatId(chatId)
                    .videoRatio("0")
                    .answer(info)
                    .agentUrl(detail.getString("url"))
                    .field1(second.toString())
                    .build();
            contextMapper.insertZhsUserAgentContext(build);
            // 查看消耗总数  1.6元/秒
            Integer i = contextMapper.userConsume(uuid, second);
        } else if (parse.getString("status").equals("running")){
            return null;
        } else {
            return ResponseResultInfo.success(JSONUtils.parse(parse.toString()));
        }

        ResponseResultInfo<Object> success = ResponseResultInfo.success(JSONUtils.parse(parse.toString()));
        success.setAmountCount(second);
        return success;
    }
    private String getInfo(String id) {
        System.out.println("sora2入参TaskId：" + id);
        // 2. POST 请求（JSON 数据）
        HttpResponse postResponse = HttpRequest.get( DEFAULT_DOMAIN + "/v1/video/query?id=" + id)
                .header("Accept", "application/json")
                .header(BeanConfig.ZHS_AUTHORIZATION, "Bearer " + soraApiKey)
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: " + body);

        return body;
        // {"code":0,"message":"SUCCEED","request_id":"a60990f3-b485-4dbb-b02f-6eea9cd000c5","data":{"task_id":"797182621750399062","task_status":"submitted","created_at":1758091666748,"updated_at":1758091666748}}
    }
}
