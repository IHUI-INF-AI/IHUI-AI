package com.ai.manager.core.utils.test;

import cn.hutool.http.HttpUtil;
import com.ai.manager.core.utils.HttpsUtil;
import com.google.common.collect.Maps;
import com.google.gson.Gson;
import org.apache.http.client.utils.DateUtils;
import org.json.JSONObject;

import java.sql.Date;
import java.time.Instant;
import java.util.Map;

public class TestSendMessage {
    public static void main(String[] args) {
        String tokenUrl = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s";
        tokenUrl = String.format(tokenUrl,"wx27028e276ffdbc5d","59c25dfdb673f5ef33dc9bd4bf8906b0");
        String tokenPathResult = HttpsUtil.httpsGet(tokenUrl);
        System.out.println(tokenPathResult);
        JSONObject tokenPathJSON = new JSONObject(tokenPathResult);
        Map<String, Object> map = tokenPathJSON.toMap();
        String accessToken = map.get("access_token").toString();
//        String accessToken = "96_A1wwatq-QqwxCHphkWdL764qGTgv6QLhWHPIvLZ_gtSDsaWIHQ5XgP8he5Q7CjtzVDzOjZuK48e-VL_DLKNuYT7vuTXqQnCrI-64nNyBNKNhbWxiLRYtx9NR5cIXRPjABAJDB";
//        System.out.println(accessToken);
//
////
//        Map<String, Object> bodyMap = Maps.newHashMap();
//        bodyMap.put("touser","ovPwF7OGpL7vaF3kyvb1dI9Oljc0");
//        bodyMap.put("template_id","6BBC_zk2VK4phW4S4U2Y8sIAlqguzwd3VZqmf_z_vTU");
//        Map<String, Object> param = Maps.newHashMap();
//
//        param.put("name1",Maps.immutableEntry("value", "申请人"));
//        param.put("time2",Maps.immutableEntry("value", DateUtils.formatDate(Date.from(Instant.now()),"yyyy-MM-dd HH:mm:ss")));
//        param.put("thing4",Maps.immutableEntry("value", "申请项目"));
//        param.put("thing6",Maps.immutableEntry("value", "备注"));
//        bodyMap.put("data",param);
//
//
//        String post = HttpUtil.post("https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=" + accessToken, new Gson().toJson(bodyMap));
//        System.out.println(post);
    }
}
