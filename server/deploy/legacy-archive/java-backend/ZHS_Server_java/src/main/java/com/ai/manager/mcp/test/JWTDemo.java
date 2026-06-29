package com.ai.manager.mcp.test;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.constants.BeanConfig;
import com.alibaba.druid.support.json.JSONUtils;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.google.common.collect.Maps;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class JWTDemo {

    static String ak = "A3CNdFEkmbaTatMJQ3hEkLAKECann4Qt"; // 填写access key
    static String sk = "FBf89QQn3baMkeTHPGKrMYQEaBgCfPHH"; // 填写secret key

    public static void main(String[] args) {
//        String token = sign(ak, sk);
        // 枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
        String token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuYmYiOjE3NTgwOTM3ODYsImlzcyI6IkEzQ05kRkVrbWJhVGF0TUpRM2hFa0xBS0VDYW5uNFF0IiwiZXhwIjoxNzU4MDk1NTkxfQ.UVsx1GGKNmFUQd_RcoZmMKI28ilAknrpA5qMLAJpGYI";
        System.out.println(token); // 打印生成的API_TOKEN

//        create(token);
//        getAITask(token);
        Object parse = JSONUtils.parse("{\"code\":0,\"message\":\"SUCCEED\",\"request_id\":\"690fe91b-fbb7-4ea2-8dca-e846cf0827db\",\"data\":{\"task_id\":\"797191640489828365\",\"task_status\":\"succeed\",\"task_info\":{\"external_task_id\":\"11112\"},\"task_result\":{\"videos\":[{\"id\":\"797191640795996237\",\"url\":\"https://v2-kling.kechuangai.com/bs2/upload-ylab-stunt/ce0990f6-5af2-4510-9a74-50b6f6d95e4c-u2cbIBbxtCJykqEuljLUkw-output.mp4?x-kcdn-pid=112452\",\"duration\":\"14.666\"}]},\"task_status_msg\":\"\",\"created_at\":1758093816979,\"updated_at\":1758094147654}}");

        System.out.println(parse);
    }
    static String sign(String ak,String sk) {
        try {
            Date expiredAt = new Date(System.currentTimeMillis() + 1800*1000); // 有效时间，此处示例代表当前时间+1800s(30min)
            Date notBefore = new Date(System.currentTimeMillis() - 5*1000); //开始生效的时间，此处示例代表当前时间-5秒
            Algorithm algo = Algorithm.HMAC256(sk);
            Map<String, Object> header = new HashMap<>();
            header.put("alg", "HS256");
            return JWT.create()
                    .withIssuer(ak)
                    .withHeader(header)
                    .withExpiresAt(expiredAt)
                    .withNotBefore(notBefore)
                    .sign(algo);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    static void create(String jwt){
        Map<String, String> param = Maps.newHashMap();
        param.put("image",FileStreamToBase64.fileStreamToBase64("D:\\Users\\Administrator\\Pictures\\微信图片_20250917142127_9_131.jpg")); // 数字人参考图 base64 不含前缀data:image/png;base64,
//        param.put("sound_file","https://file.aizhs.top/sys-backs/9月16日 15点53分.mp3"); // 指定音色文件base64 或者url
        param.put("sound_file",FileStreamToBase64.fileStreamToBase64("E:\\job\\slackOff\\9月17日.MP3")); // 指定音色文件base64 或者url
        param.put("prompt",""); // 提示词
        param.put("mode","std"); // 生成视频的模式 std标准模式（标准），基础模式，性价比高 | pro专家模式（高品质），高表现模式，生成视频质量更佳
        param.put("callback_url",""); // 回调通知地址
        param.put("external_task_id","11112"); // 本地任务id

        // 2. POST 请求（JSON 数据）
        HttpResponse postResponse = HttpRequest.post("https://api-beijing.klingai.com/v1/videos/avatar/image2video")
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header("Authorization", "Bearer " + jwt)
                .body(JSONUtils.toJSONString(param))
                .execute();
        System.out.println("POST 响应: " + postResponse.body());
        // {"code":0,"message":"SUCCEED","request_id":"a60990f3-b485-4dbb-b02f-6eea9cd000c5","data":{"task_id":"797182621750399062","task_status":"submitted","created_at":1758091666748,"updated_at":1758091666748}}

    }

    static void getAITask(String jwt){
        Map<String, String> param = Maps.newHashMap();
        // 2. POST 请求（JSON 数据）
        HttpResponse postResponse = HttpRequest.get("https://api-beijing.klingai.com/v1/videos/avatar/image2video/" + "797191640489828365")
                .header(BeanConfig.ZHS_CONTENT_TYPE, "application/json")
                .header("Authorization", "Bearer " + jwt)
                .body(JSONUtils.toJSONString(param))
                .execute();
        System.out.println("POST 响应: " + postResponse.body());
    }
}
