package com.ai.manager.small.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.small.service.LoginService;
import com.google.common.collect.Maps;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.commons.lang3.StringUtils;
import org.apache.tomcat.util.http.fileupload.IOUtils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/login")
@Tag(name = "登录相关")
public class LoginController {

    @Autowired
    private LoginService loginService;

    /**
     * 获取微信OpenID
     * @param code
     * @return
     */
    @Deprecated
    @PostMapping("/getOpenId")
//    public Map<String, Object> getOpenId(@RequestBody Map<String, Object> param) {
//        Object code = param.get("code");
//        request.getHeader()
    public Map<String, Object> getOpenId(@RequestParam("code") String code) {
        // 参数校验移至此处
        if (Objects.isNull(code)) {
            HashMap<String, Object> result = Maps.newHashMap();
            result.put("code", 400);
            result.put("msg", "缺少 code 参数");
            return result;
        }
        // 调用Service方法，Service现在直接返回 ResponseResultInfo
        return loginService.getOpenId(code.toString());
    }

    /**
     * 手机号登录
     * @param code
     * @param openId
     * @param parentId
     * @return
     */
    @Deprecated
    @PostMapping("/getPhoneNumber")
//    public ResponseResultInfo getPhoneNumber(@RequestBody Map<String, Object> param) {
//        Object code = param.get("code");
    public ResponseResultInfo getPhoneNumber(@RequestParam("code") String code, @RequestParam("openId") String openId, @RequestParam(value = "parentId",required = false) String parentId) {
//        request.getHeader()
        // 参数校验移至此处
        if (Objects.isNull(code) || Objects.isNull(openId)) {
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("缺少 code 参数").build();
        }
        if(StringUtils.isBlank(parentId))
            parentId = "";
        loginService.login(openId, parentId);
        // 调用Service方法，Service现在直接返回 ResponseResultInfo
        return loginService.getPhoneNumber(code.toString(), openId.toString());
    }

    /**
     * 换绑微信账号
     * @param phone
     * @param openId
     * @return
     */
    @PostMapping("/editWxOpenId")
    public ResponseResultInfo editWxOpenId(@RequestBody Map<String, Object> param) {
        JSONObject jsonObject = new JSONObject(param);
        if(jsonObject.isEmpty() || jsonObject.isNull("phone") || jsonObject.isNull("openId") ){
            // 
            return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("缺少 code 参数").build();
        }
        return loginService.editWxOpenId(jsonObject.getString("phone"), jsonObject.getString("openId"));
    }



    /**
     * 获取微信小程序码
     * 对应 PHP: GET /getWxCode -> index.php/api/Login/getWxCode
     * 在Spring Boot中映射为 GET /api/getWxCode
     * @param inviteCode 邀请码
     * @return 小程序码图片或错误信息
     */
    @GetMapping("/getWxCode")
    public ResponseEntity<?> getWxCode(@RequestParam("invite_code") String inviteCode, @RequestParam(value = "back", required = false) Integer back) {
        // 参数校验移至此处
         if (inviteCode == null || inviteCode.isEmpty()) {
            ResponseResultInfo errorInfo = ResponseResultInfo.builder()
                     .code(ResultConfig.ERROR_PARAM_CODE.toString())
                     .msg("invite_code不能为空")
                     .build();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorInfo);
         }
        // Service 中仍然包含 invite_code 长度校验，这里不再重复

        // 调用Service方法获取小程序码数据，Service现在直接返回 ResponseResultInfo
        Object result = loginService.getWxCode(inviteCode, back);

        // 根据Service返回的结果类型决定如何响应
        if (result instanceof byte[]) {
            // 如果是字节数组，说明成功获取到图片
            byte[] imageBytes = (byte[]) result;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_JPEG); // 或者根据实际图片类型设置
            //headers.setContentLength(imageBytes.length); // 可选
            return new ResponseEntity<>(imageBytes, headers, HttpStatus.OK);
        } else {
            // 否则，认为是包含了错误信息的 Map
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
        }
    }

    /**
     * 用户隐式注册和登录
     *
     * @param openId
     * @param parentId
     * @return
     */
    @Deprecated
    @PostMapping("/login")
//    public ResponseResultInfo login(@RequestBody() JSONObject param ) {
//        String openId = null;
//        String parentId = null;
    public ResponseResultInfo login(@RequestParam("open_id") String openId,
                                     @RequestParam(value = "parentId", required = false) String parentId) {
        // 参数校验移至此处
        if (openId == null || openId.isEmpty()) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少open_id")
                    .build();
        }

        // 调用Service方法处理登录逻辑，Service现在直接返回 ResponseResultInfo
        return loginService.login(openId, parentId);
    }

    /**
     * 用户绑定信息
     * @param openId
     * @param nickname
     * @param phone
     * @param avatar
     * @param fileName
     * @param fileType
     * @return
     */
    @Deprecated
    @PostMapping("/bind")
    public ResponseResultInfo bind(@RequestParam("open_id") String openId,
                                    @RequestParam(value = "nickname", required = false) String nickname,
                                    @RequestParam(value = "phone", required = false) String phone,
                                    @RequestParam(value = "avatar", required = false) String avatar,
                                    @RequestParam(value = "fileName", required = false) String fileName,
                                    @RequestParam(value = "fileType", required = false) String fileType) {
        // 参数校验移至此处
        if (openId == null || openId.isEmpty()) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少 open_id")
                    .build();
        }
        // 调用Service方法处理绑定逻辑，Service现在直接返回 ResponseResultInfo
        return loginService.bind(openId, nickname, phone, avatar, fileName, fileType);
    }

    /**
     * 上传名片
     * @param param
     * @return
     */
    @PostMapping("/uploadBusinessCard")
    public ResponseResultInfo uploadBusinessCard( @RequestBody Map<String, Object> param
            /*,@RequestParam("id") Integer id,
                                                  @RequestParam("card") String card,
                                                  @RequestParam("fileName") String fileName*/) {
        JSONObject json = new JSONObject(param);
        Integer id;
        try{
            id = json.getInt("id");
        }catch (Exception e){
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("缺少用户 id")
                    .build();
        }
        String card = json.getString("card");
        String fileName = json.getString("fileName");

        if (StringUtils.isBlank(card)) {
             return ResponseResultInfo.builder()
                     .code(ResultConfig.ERROR_PARAM_CODE.toString())
                     .msg("缺少名片图片内容")
                     .build();
        }
        // 调用 LoginService 中实现的 uploadBusinessCard 方法，Service现在直接返回 ResponseResultInfo
        return loginService.uploadBusinessCard(id, card,fileName);
    }

    /**
     * 获取后端minio存放文件
     * @param filePath
     * @param response
     */
    @GetMapping("/getMinioFile")
    public void getMinioFile(@RequestParam("filePath") String filePath, HttpServletResponse response){
        System.out.println("获取图片 + " + filePath);
        URLConnection conn = null;
        try {
            URL console = new URL(filePath);
            conn = console.openConnection();
            InputStream is = conn.getInputStream();
            ServletOutputStream outputStream = response.getOutputStream();
            IOUtils.copy(is, outputStream);
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if(conn!=null){
                try {
                    conn.connect();
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    }

    @GetMapping("/get/url/link")
    public ResponseResultInfo<String> getUrlLink(@RequestParam("uuid")String uuid){
        return ResponseResultInfo.success(loginService.getUrlLink(uuid));
    }


    // 注销
    @DeleteMapping("/cancel")
    public ResponseResultInfo<String> cancelUser(@RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid){
        return ResponseResultInfo.<String>success(loginService.cancelUser(uuid));
    }
}