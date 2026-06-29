package com.ai.manager.mcp.service.impl;

import cn.hutool.core.map.MapUtil;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.mcp.service.AgentService;
import com.ai.manager.mcp.service.Gemini3ProPreviewService;
import com.ai.manager.small.domain.AiModelInfo;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.mapper.AiModelInfoMapper;
import com.ai.manager.small.mapper.ZhsUserAgentContextMapper;
import com.alibaba.druid.support.json.JSONUtils;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.google.common.collect.Maps;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class Gemini3ProPreviewServiceImpl implements Gemini3ProPreviewService {

    private static final String MODEL_ID = "5f4fa169-c550-11f0-a735-00163e44ab29";

    @Value("${sora2.api.key}")
    private String YUNWU_TOKEN;
    @Value("${n8n.token.counting.unit}")
    private Integer TOKEN_COUNTING_UNIT;

    @Autowired
    private ZhsUserAgentContextMapper contextMapper;

    private static final String DEFAULT_DOMAIN = "https://yunwu.ai";

    private static final boolean IS_BUCKSHEE = true;

    private static final String QUERY_MODEL_NAME = "gemini-3-pro-preview";
    private static final String DB_MODEL_NAME = "gemini-3-pro-preview";


    @Autowired
    private AiModelInfoMapper mapper;
    @Autowired
    private AgentService agentService;

    @Override
    public ResponseResultInfo generate(Map<String, Object> param, String problem) {

        /*
        {
          "prompt": "用户提示词",
          "user_uuid": "用户唯一标识",
          "chat_id": "会话ID",
          "images": "图片URL1,图片URL2,...",
          "zidingyican": [
            {"name": "参数名", "desc": "描述", "value": "参数值", "needful": true/false}
          ]
        }
         */



        String prompt = param.get("prompt").toString();
        String uuid = param.get("user_uuid").toString();
        String chatId = param.get("chat_id").toString();

        agentService.sendMessageToPublic(uuid, DB_MODEL_NAME,chatId, "user", null, "text",prompt, null);

        Map<String, Object> query = Maps.newHashMap();

        if (param.containsKey("zidingyican")) {
            Object o = param.get("zidingyican");
            JSONArray array = null;
            if (o instanceof String) {
                array = JSON.parseArray(o.toString());
            } else if (o instanceof List) {
                array = new JSONArray((List) o);
            } else {
                array = new JSONArray();
            }
            // 校验自定义参是否必穿
            if (judgeNeedful(array)) {
                return ResponseResultInfo.error(null, "必穿项为空！");
            }
            /*
            [
                {
                    "name": "systemInstruction",
                    "desc": "系统角色",
                    "value": ""
                }, {
                    "name": "temperature",
                    "desc": "性格温度",
                    "value": ""
                }, {
                    "name": "topP",
                    "desc": "topP",
                    "value": ""
                }, {
                    "name": "includeThoughts",
                    "desc": "是否包含思考过程",
                    "value": ""
                }, {
                    "name": "thinkingBudget",
                    "desc": "思考限制",
                    "value": ""
                }
            ]
             */

            Map<String, Object> generationConfig = Maps.newHashMap();
            Map<String, Object> thinkingConfig = Maps.newHashMap();
            for (int i = 0; i < array.size(); i++) {
                JSONObject zdyc = array.getJSONObject(i);
                if (Objects.isNull(zdyc.get("value"))) {
                    continue;
                }
                if (zdyc.getString("name").equals("systemInstruction")) {
                    Map<String, String> text = MapUtil.builder("text", zdyc.getString("value")).build();
                    ArrayList<Map<String, String>> maps = Lists.newArrayList(text);
                    Map<String, ArrayList<Map<String, String>>> parts = MapUtil.builder("parts", maps).build();
                    query.put("systemInstruction", parts);
                }
                if (zdyc.getString("name").equals("temperature")) {
                    generationConfig.put("temperature", zdyc.get("value"));
                    if (Objects.isNull(zdyc.get("value")) || zdyc.getString("value").isEmpty()) {
                        generationConfig.put("temperature", 1);
                    }
                }
//                if(zdyc.getString("name").equals("topP")){
//                    generationConfig.put("topP", zdyc.get("value"));
//                }
                if (zdyc.getString("name").equals("includeThoughts")) {
                    thinkingConfig.put("includeThoughts", zdyc.get("value"));
                }
                if (zdyc.getString("name").equals("thinkingBudget")) {
                    thinkingConfig.put("thinkingBudget", zdyc.get("value"));
                    if (Objects.isNull(zdyc.get("value")) || zdyc.getString("value").isEmpty()) {
                        thinkingConfig.put("thinkingBudget", 26240);
                    }
                }
            }
            generationConfig.put("topP", 1);
//            if(!thinkingConfig.isEmpty()){
            generationConfig.put("thinkingConfig", thinkingConfig);
//            }
//            if(!generationConfig.isEmpty()){
            query.put("generationConfig", generationConfig);
//            }
        }
        // region 提示词----------------------
        Map<String, String> text = MapUtil.builder("text", prompt).build();
        ArrayList<Map<String, String>> maps = Lists.newArrayList(text);
        Map<String, Object> contents = Maps.newHashMap();
        contents.put("role", "user");
        contents.put("parts", maps);
        query.put("contents", Lists.newArrayList(contents));
        // endregion --------------------

        /*
        {
          "systemInstruction": {
            "parts": [
              {
                "text": "你是一直小猪.你会在回复开始的时候 加一个'哼哼'"
              }
            ]
          },
          "contents": [
            {
              "role": "user",
              "parts": [
                {
                  "text": "你是谁?"
                }
              ]
            }
          ],
          "generationConfig": {
            "temperature": 1,
            "topP": 1,
            "thinkingConfig": {
              "includeThoughts": true,
              "thinkingBudget": 26240
            }
          }
        }
         */
        String s = null;
        Long second = 0L;
        // 处理回参结构
        Map<String, Object> map = Maps.newHashMap();
        map.put("bot_id",QUERY_MODEL_NAME);
        map.put("chat_id",chatId);
        map.put("content_type","text");
        map.put("created_at", new Date(System.currentTimeMillis()));
        StringBuilder sb = new StringBuilder();

        try {
            s = postUri(query, String.format("/v1beta/models/gemini-3-pro-preview:generateContent?key=%s", YUNWU_TOKEN));
//        String s = "{\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"哼哼，我是一只圆滚滚、粉嫩嫩的小猪呀！我看你是不是藏了好吃的？快交出来！\"}]},\"finishReason\":\"STOP\",\"index\":0,\"safetyRatings\":null}],\"promptFeedback\":{\"safetyRatings\":null},\"usageMetadata\":{\"promptTokenCount\":22,\"candidatesTokenCount\":28,\"totalTokenCount\":530,\"thoughtsTokenCount\":480,\"promptTokensDetails\":[{\"modality\":\"TEXT\",\"tokenCount\":22}]},\"modelVersion\":\"gemini-3-pro-preview\",\"responseId\":\"yNEdacnhEJiM_PUPjfrmuQI\"}";

            JSONObject jsonObject = JSON.parseObject(s);
            // 计算消耗token
            if (jsonObject.containsKey("usageMetadata")) {
//            usageMetadata, totalTokenCount
                JSONObject usageMetadata = jsonObject.getJSONObject("usageMetadata");
                Integer totalTokenCount = usageMetadata.getInteger("totalTokenCount");
                // 1元 100wtokens
                // 1元 2w算力
                second = 20000L * totalTokenCount * TOKEN_COUNTING_UNIT / 1000000L;
            }
            if (!IS_BUCKSHEE) {
                // 查看消耗总数  1.6元/秒
                Integer i = contextMapper.userConsume(uuid, second);
            }


            JSONArray candidates = jsonObject.getJSONArray("candidates");
            for (int i = 0; i < candidates.size(); i++) {
                JSONObject item = candidates.getJSONObject(i);
                JSONObject content = item.getJSONObject("content");
                JSONArray parts = content.getJSONArray("parts");
                for (int j = 0; j < parts.size(); j++) {
                    String parts_text = parts.getJSONObject(j).getString("text");
                    if(StringUtils.isNotBlank(parts_text) && sb.length()>0){
//                        sb.append("<br/>");
                        sb.append("\n");
                    }
                    sb.append(parts_text);
                }
            }
            map.put("content", sb.toString());

        } catch (Exception e) {
            e.printStackTrace();
        }
        agentService.sendMessageToPublic(uuid, DB_MODEL_NAME,chatId, null, "stop", "text",sb.toString(), second);
        // 保存上下文
        ZhsUserAgentContext build = ZhsUserAgentContext.builder()
                .id(UUID.randomUUID().toString())
                .agentId(DB_MODEL_NAME)
                .userUuid(uuid)
                .problem(prompt)
//                .userUrl(image + "," + soundFile)
                .field1(second.toString())
                .sendTime(Instant.now().getEpochSecond())
                .modelName(DB_MODEL_NAME)
                .answer(sb.toString())
                .chatId(chatId)
                .videoRatio("0")
                .build();
        contextMapper.insertZhsUserAgentContext(build);
        ResponseResultInfo<Object> success = ResponseResultInfo.success(map);
        success.setTotal_tokens(second);
        return success;
    }

    /**
     * 有必穿 但是必穿值为空返回true
     *
     * @param zdyc
     * @return
     */
    private Boolean judgeNeedful(JSONArray zdyc) {
        AiModelInfo modelInfo = mapper.queryById(MODEL_ID);
        String variables = modelInfo.getVariables();
        if (StringUtils.isNotBlank(variables)) {
            // 获取当前数据 判断自定义惨是否存在必穿项
            try {

                JSONArray array = JSON.parseArray(variables);
                // 便利所有对象 拿到必传值
                for (int i = 0; i < array.size(); i++) {
                    JSONObject jsonObject = array.getJSONObject(i);
                    if (jsonObject.containsKey("needful") && jsonObject.getBoolean("needful")) {
                        boolean needful = true;
                        if (zdyc.isEmpty()) {
                            return needful;
                        }

                        for (int j = 0; j < array.size(); j++) {
                            JSONObject zdycObj = zdyc.getJSONObject(j);
                            if (zdycObj.getString("name").equals(jsonObject.getString("name")) && Objects.nonNull(zdycObj.get("value"))) {
                                needful = false;
                            }
                        }
                        return needful;
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return false;
    }

    private String postUri(Map<String, Object> param, String uri) {
        String jsonString = JSONUtils.toJSONString(param);
        System.out.println("当前入参为：\n" + jsonString);
        HttpResponse postResponse = HttpRequest.post(DEFAULT_DOMAIN + uri)
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header(BeanConfig.ZHS_AUTHORIZATION, YUNWU_TOKEN)
                .header("x-goog-api-key", YUNWU_TOKEN)
                .body(jsonString)
                .execute();
        String body = postResponse.body();
        System.out.println("POST 响应: \n" + body);
        return body;
        // {"code":0,"message":"SUCCEED","request_id":"a60990f3-b485-4dbb-b02f-6eea9cd000c5","data":{"task_id":"797182621750399062","task_status":"submitted","created_at":1758091666748,"updated_at":1758091666748}}
    }
}
