package com.ai.manager.small.service;

import com.ai.manager.app.domain.users.UsersVO;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.utils.HttpsUtil;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.core.utils.NonceRandomUtils;
import com.ai.manager.small.domain.User;
import com.ai.manager.small.domain.ZhsIdentityProportion;
import com.ai.manager.small.mapper.UserMapper;
import com.ai.manager.small.mapper.ZhsIdentityProportionMapper;
import com.ai.manager.small.service.impl.ISysFileService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Maps;
import lombok.SneakyThrows;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Base64Utils;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class LoginService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ISysFileService fileService;

    @Autowired
    private ZhsIdentityProportionMapper identityProportionMapper;

    @Autowired
    private JWTUtils jwtUtils;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Value("${ai.default.img.url}")
    private String imgUrl;

    @Value("${wx.appid}")
    private String APPID;

    @Value("${wx.secret}")
    private String SECRET;

    @Value("${wx.jsapi.token_path}")
    private String TOKEN_PATH;
    @Value("${wx.jsapi.user_phone_number}")
    private String USER_PHONE_NUMBER;
    @Value("${wx.jsapi.home.url}")
    private String MINI_HOME_URL;

    @Value("${ai.first.share}")
    private String FIRSE_SHARE;

    /**
     * 获取微信OpenID和SessionKey
     * 对应 PHP 的 getOpenId 方法
     *
     * @param code 微信登录凭证
     * @return 包含 openid 和 session_key 的 ResponseResultInfo，或包含错误信息的 ResponseResultInfo
     */
    public Map<String, Object> getOpenId(String code) {
        Map<String, Object> result = new HashMap<>();
        // 参数校验已移至 Controller

        String url = "https://api.weixin.qq.com/sns/jscode2session?appid=" + APPID + "&secret=" + SECRET + "&js_code=" + code + "&grant_type=authorization_code";

        try {
            String response = HttpsUtil.httpsGet(url);
            ObjectMapper objectMapper = new ObjectMapper();
            Map<String, Object> data = objectMapper.readValue(response, Map.class);

            if (data != null && data.containsKey("openid")) {
                result.put("openid", data.get("openid"));
                result.put("session_key", data.get("session_key"));
                result.put("msg", ResultConfig.SUCCESS);
            } else {
                result.put("error", "微信接口请求失败");
                result.put("detail", data);
                // result.put("status", 500);
            }
        } catch (Exception e) {
            // 处理请求异常
            result.put("error", "调用微信接口异常");
            result.put("detail", e.getMessage());
            // result.put("status", 500);
        }

        return result;
    }
    public ResponseResultInfo getPhoneNumber(String code, String openId) {

        try {
            // 获取token
            String tokenPath = String.format(TOKEN_PATH, APPID, SECRET);
            String tokenPathResult = HttpsUtil.httpsGet(tokenPath);
            JSONObject tokenPathJSON = new JSONObject(tokenPathResult);
            Map<String, Object> map = tokenPathJSON.toMap();
            String accessToken = map.get("access_token").toString();

            String format = String.format(USER_PHONE_NUMBER, accessToken);
            Map<String, Object> param = Maps.newHashMap();
//            param.put("access_token",accessToken);
            param.put("code",code);
            param.put("openid",openId);
            ObjectMapper jsonMapper = new ObjectMapper();
            byte[] postDataBytes = jsonMapper.writeValueAsBytes(param);

            Map<String, String> headers = new HashMap<>();
            headers.put(BeanConfig.ZHS_CONTENT_TYPE, "application/json");
            InputStream inputStream = HttpsUtil.httpsPostInputStream(format, postDataBytes, headers);
            String phoneNumberResult = IOUtils.toString(inputStream);
            JSONObject phoneNumberJSON = new JSONObject(phoneNumberResult);
            Integer errcode = phoneNumberJSON.getInt("errcode");
            String errmsg = phoneNumberJSON.getString("errmsg");
            if(errcode != 0){
                System.out.println(phoneNumberResult);
                return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg(errmsg).build();
            }
            JSONObject numberResult = phoneNumberJSON.getJSONObject("phone_info");
            String phoneNumber = numberResult.getString("phoneNumber");
//            String purePhoneNumber = numberResult.getString("purePhoneNumber");
//            JSONObject watermark = numberResult.getJSONObject("watermark");
//            String appid = watermark.getString("appid");
            long nowTime = Instant.now().getEpochSecond();

            // 判断当前手机号是否是已经绑定
            User phoneToUser = userMapper.getByPhone(phoneNumber);
            if(Objects.nonNull(phoneToUser) && StringUtils.isBlank(phoneToUser.getOpenId())){
                // 修改当前用户的手机号并删除就数据
                int di = userMapper.delVisitor(openId);
                if(di <= 0)
                    throw new RuntimeException("游客身份错误");
                // 绑定当前账号
                phoneToUser.setOpenId(openId);
                int i = userMapper.updateUser(phoneToUser);
                return ResponseResultInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(phoneToUser).build();
            } else if (Objects.nonNull(phoneToUser) && phoneToUser.getOpenId().equals(openId)){
                phoneToUser.setZhsToken(getZhsToken(phoneToUser));
                return ResponseResultInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(phoneToUser).build();
            } else if (Objects.nonNull(phoneToUser)) {
                return ResponseResultInfo.builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("当前手机号已绑定其他小程序！").build();
            }

            // 手机号存储到当前用户，修改状态为非会员
            User build = User.builder().isVIP(0)
                    .openId(openId)
                    .phone(phoneNumber)
                    .createdAt(nowTime)
                    .updatedAt(nowTime)
                    /*.phone(purePhoneNumber)*/
                    .build();
            userMapper.setNumber(build);
            User user = userMapper.selectByOpenId(openId);
            // 对上级用户进行分销
            ZhsIdentityProportion crankUpProportion = identityProportionMapper.getCrankUpProportion();
            userMapper.updateParent(openId,crankUpProportion);

            user.setZhsToken(getZhsToken(user));
            return ResponseResultInfo.builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg(ResultConfig.SUCCESS)
                    .data(user)
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
    private String getZhsToken(User user){
        // 获取token
        return jwtUtils.createJWT(user);
    }

    /**
     * 获取微信小程序码
     * 对应 PHP 的 getWxCode 方法
     *
     * @param inviteCode 邀请码
     * @param back
     * @return ResponseResultInfo 包含小程序码的字节数组或错误信息
     */
    public Object getWxCode(String inviteCode, Integer back) {
        // 参数校验已移至 Controller

        // 检查 invite_code 长度
        if (inviteCode.length() > 32) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_PARAM_CODE.toString())
                    .msg("invite_code 参数长度不能超过 32 字符")
                    .build();
        }

        try {
            // 1. 获取 access_token
            String tokenUrl = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + APPID + "&secret=" + SECRET;
            String tokenResponse = HttpsUtil.httpsGet(tokenUrl);
            ObjectMapper objectMapper = new ObjectMapper();
            Map<String, Object> tokenData = objectMapper.readValue(tokenResponse, Map.class);

            if (tokenData == null || !tokenData.containsKey("access_token")) {
                return ResponseResultInfo.builder()
                        .code("500")
                        .msg("获取access_token失败")
                        .data(tokenData)
                        .build();
            }
            String accessToken = (String) tokenData.get("access_token");

            // 2. 获取小程序码
            String wxCodeUrl = "https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=" + accessToken;
            Map<String, Object> postData = new HashMap<>();
            postData.put("scene", "invite_code=" + inviteCode);
            postData.put("page", MINI_HOME_URL);
//            postData.put("page", "pages/table/tools/index");
            postData.put("check_path", false);
            postData.put("width", 430);
            postData.put("env_version", "release");
            postData.put("is_hyaline", (Objects.isNull(back) || 1 != back));

            ObjectMapper jsonMapper = new ObjectMapper();
            byte[] postDataBytes = jsonMapper.writeValueAsBytes(postData); // Convert Map to JSON byte array

            Map<String, String> headers = new HashMap<>();
            headers.put(BeanConfig.ZHS_CONTENT_TYPE, "application/json");

            try (InputStream is = HttpsUtil.httpsPostInputStream(wxCodeUrl, postDataBytes, headers)) {
                if (is != null) {
                    // Read the InputStream into a byte array
                    byte[] imageBytes = org.springframework.util.StreamUtils.copyToByteArray(is); // Use StreamUtils for easy conversion
                    // Check if the response is JSON error or image data
                    // A simple check: if it starts with '{' it's likely JSON error
                    if (imageBytes.length > 0 && imageBytes[0] == '{') {
                        // It's likely an error JSON. Convert to Map and return.
                        Map<String, Object> errorData = jsonMapper.readValue(imageBytes, Map.class);
                        Map<String, Object> result = new HashMap<>();
                        result.put("code", 1);
                        result.put("msg", "获取小程序码失败");
                        result.put("error", errorData.get("errmsg"));
                        result.put("errcode", errorData.get("errcode"));
                        return result;
                    } else {
                        // It's likely the image data
                        return imageBytes;
//                        return mergeImages(is, new FileInputStream("C:\\Users\\Administrator\\Pictures\\20250627142002.png"), 100);
                    }

                } else {
                    Map<String, Object> result = new HashMap<>();
                    result.put("code", 1);
                    result.put("msg", "请求小程序码失败或返回空响应");
                    return result;
                }
            } catch (IOException e) {
                Map<String, Object> result = new HashMap<>();
                result.put("code", 1);
                result.put("msg", "处理小程序码响应异常");
                result.put("error", e.getMessage());
                return result;
            }

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("code", 1);
            result.put("msg", "调用微信接口或处理响应异常");
            result.put("error", e.getMessage());
            return result;
        }
    }

    // 合并图片
    public byte[] mergeImages(InputStream qrcodeInput, InputStream logoInput, int logoSize) throws IOException {
        // 读取小程序码图片
        BufferedImage qrcodeImage = ImageIO.read(qrcodeInput);

        // 读取中心图片并调整大小
        BufferedImage logoImage = ImageIO.read(logoInput);
        Image scaledLogo = logoImage.getScaledInstance(logoSize, logoSize, Image.SCALE_SMOOTH);

        // 创建Graphics2D对象进行绘制
        Graphics2D g2d = qrcodeImage.createGraphics();
        // 计算中心位置
        int x = (qrcodeImage.getWidth() - logoSize) / 2;
        int y = (qrcodeImage.getHeight() - logoSize) / 2;

        // 绘制中心图片
        g2d.drawImage(scaledLogo, x, y, null);

        // 添加白色边框
        g2d.setColor(Color.WHITE);
        g2d.setStroke(new BasicStroke(5));
        g2d.drawRect(x, y, logoSize, logoSize);

        g2d.dispose();

        // 输出合并后的图片
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(qrcodeImage, "PNG", baos);
        return baos.toByteArray();
    }


    /**
     * 用户隐式注册和登录
     * 对应 PHP 的 login 方法
     *
     * @param openId   微信用户OpenID
     * @param parentId 邀请人ID
     * @return ResponseResultInfo 包含用户信息或错误信息
     */
    @Transactional // 确保数据库操作的原子性
    public ResponseResultInfo<User> login(String openId, String parentId) {
        // 参数校验已移至 Controller

        // 查询用户是否存在
        User user = userMapper.selectByOpenId(openId);

        if (user == null) {
            // 用户不存在，进行注册
            User newUser = new User();
            newUser.setOpenId(openId);
            newUser.setToken(UUID.randomUUID().toString());

            // 生成昵称
            String nickname = "AI_" + generateRandomString(4);
//            String nickname = "∞_" + generateRandomString(4);
            newUser.setNickname(nickname);

            // 生成唯一邀请码
            String inviteCode;
            User existingUserWithCode;
            do {
                inviteCode = generateRandomString(15);
                existingUserWithCode = userMapper.selectByInviteCode(inviteCode);
            } while (existingUserWithCode != null);
            newUser.setInviteCode(inviteCode);

            newUser.setParentId(parentId);

            // 设置默认值（根据数据库表定义或业务需求）
            newUser.setTotalEarnings(0L);
            newUser.setBalance(0L);
            newUser.setIsVIP(-1); // 默认非VIP // 改为默认为-1游客
//            newUser.setUuid(UUID.randomUUID().toString());
            newUser.setCreatedAt(Instant.now().getEpochSecond());
            newUser.setAvatar(imgUrl);

            // 插入用户
            userMapper.insertUser(newUser);
            user = newUser;

            /*
            // TODO 需确认需求  之前是否有首次创建用户后不同智能体有免费次数
            // 获取所有代理商数据
            List<Agent> agents = agentMapper.selectAll();

            // 遍历代理商数据并为新用户创建免费次数记录
            if (agents != null) {
                for (Agent agent : agents) {
                    UserAgentFreeTimes userAgentFreeTimes = new UserAgentFreeTimes();
                    userAgentFreeTimes.setUserId(user.getId());
                    userAgentFreeTimes.setAgentId(agent.getId());
                    userAgentFreeTimes.setDegree(4);
                    userAgentFreeTimes.setCreatedAt(System.currentTimeMillis() / 1000L);
                    userAgentFreeTimes.setUpdatedAt(System.currentTimeMillis() / 1000L);
                    userAgentFreeTimesMapper.insertUserAgentFreeTimes(userAgentFreeTimes);
                }
            }*/
        } else if (StringUtils.isNotBlank(parentId) && StringUtils.isBlank(user.getParentId())){
            // 判断用户parentId是否存在
            user.setParentId(parentId);
            int i = userMapper.updateUser(user);

        } else if (StringUtils.isBlank(user.getPhone())) {
            // 判断手机号是否存在
            return ResponseResultInfo.<User>builder()
                    .code("40101")
                    .msg("未验证手机号")
                    .data(user)
                    .build();
        }

        user.setZhsToken(getZhsToken(user));

        // 返回用户信息
        return ResponseResultInfo.<User>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(user)
                .build();
    }

    /**
     * 用户绑定信息
     * 对应 PHP 的 bind 方法
     *
     * @param openId   用户OpenID
     * @param nickname 昵称 (可选)
     * @param phone    手机号 (可选)
     * @param avatar   头像文件 (可选，对应 PHP 的 base64 图片)
     * @return ResponseResultInfo 包含更新后的用户信息或错误信息
     */
    @Transactional
    public ResponseResultInfo bind(String openId, String nickname, String phone, String avatar, String fileName, String fileType) {
        // 参数校验已移至 Controller

//        User updateUser = userMapper.selectByOpenId(openId);
        User updateUser = userMapper.selectByOpenId(openId);

        if (updateUser == null) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户不存在")
                    .build();
        }
//        User updateUser = new User();
        updateUser.setOpenId(openId);
        boolean needsUpdate = false;

        // 可选更新字段
        if (nickname != null) {
            updateUser.setNickname(nickname);
            needsUpdate = true;
        }

        if (phone != null) {
            updateUser.setPhone(phone);
            needsUpdate = true;
        }
        String fileUrl = null;
        if (StringUtils.isNotBlank(avatar) && avatar.contains("base64,")) {
            if(StringUtils.isBlank(fileName))
                fileName = NonceRandomUtils.getRandomString(64) + ".png";
            updateUser.setAvatar(fileUrl = saveBase64Image(avatar, fileName));
        } else{
            fileUrl = updateUser.getAvatar();
        }


        if (needsUpdate) {
            // 添加 updated_at
            updateUser.setUpdatedAt(Instant.now().getEpochSecond());
            userMapper.updateByOpenId(updateUser);
        }

        // 重新获取更新后的用户信息
//        User updatedUser = userMapper.selectByOpenId(openId);
        updateUser.setProfilePicUrl(fileUrl);

        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg("绑定成功")
                .data(updateUser)
                .build();
    }

    /**
     * 保存 base64 编码的图片文件
     *
     * @param base64ImageContent base64 编码的图片内容 (例如: "data:image/jpeg;base64,...")
     * @return 文件在服务器上的 URL 路径，失败返回 null
     * @throws IOException
     */
    private String saveBase64Image(String base64ImageContent, String fileName){
        byte[] bytes = Base64Utils.decodeFromString(base64ImageContent.substring(base64ImageContent.indexOf("base64,") + 7));
        return fileService.uploadMinio(bytes, /*UUID.randomUUID() + */ fileName);
    }

    /**
     * 生成指定长度的随机字符串（小写字母+数字）
     * 对应 PHP 的 generateRandomString 方法
     *
     * @param length 字符串长度
     * @return 随机字符串
     */
    private String generateRandomString(int length) {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(length);
        Random random = new Random();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    // TODO: 如果需要 PHP 中的 curlGet 方法，可以在这里实现一个通用的 HTTP GET 请求方法
    // 可以使用 RestTemplate 或其他库

    /**
     * 上传名片
     * 对应 PHP 的 uploadBusinessCard 方法
     *
     * @param userId     用户ID
     * @param base64Card base64编码的名片图片内容
     * @return ResponseResultInfo 包含上传结果和图片URL或错误信息
     */
    @Transactional
    public ResponseResultInfo uploadBusinessCard(Integer userId, String base64Card, String fileName) {
        // 参数校验已移至 Controller

        User user = userMapper.selectById(userId);
        if (user == null) {
            return ResponseResultInfo.builder()
                    .code("404")
                    .msg("用户不存在")
                    .build();
        }

        // base64 名片图片处理
        if (base64Card.startsWith("data:image")) {
            try {
                String cardUrl = saveBase64Image(base64Card, fileName);
                if (cardUrl != null) {
                    // 更新用户 card 字段和 updated_at
                    Long updatedAt = Instant.now().getEpochSecond();
                    int rowsAffected = userMapper.updateUserCard(userId, cardUrl, updatedAt);

                    if (rowsAffected > 0) {
                        return ResponseResultInfo.builder()
                                .code(ResultConfig.SUCCESS_CODE.toString())
                                .msg("名片上传成功")
                                .data(cardUrl)
                                .build();
                    }
                }
            } catch (Exception e) {
                // 处理文件保存异常
                return ResponseResultInfo.builder()
                        .code("500")
                        .msg("名片文件保存异常: " + e.getMessage())
                        .build();
            }
        }
        return ResponseResultInfo.builder()
                .code(ResultConfig.ERROR_PARAM_CODE.toString())
                .msg("名片文件保存异常")
                .build();
    }

    public ResponseResultInfo editWxOpenId(String phone, String openId) {
        int i = userMapper.editWxOpenId(phone, openId);
        return ResponseResultInfo.success();
    }

    public User parseJwt(String bearer, Class<User> userClass) {
        try {
            return jwtUtils.parseJwt(bearer, userClass);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public ResponseResultInfo<String> fileUpload(String file, String fileName) {
        String s = saveBase64Image(file, fileName);
        return ResponseResultInfo.success(s);
    }

    @SneakyThrows
    public String getUrlLink(String uuid) {

        // 获取token
        String tokenPath = String.format(TOKEN_PATH, APPID, SECRET);
        String tokenPathResult = HttpsUtil.httpsGet(tokenPath);
        JSONObject tokenPathJSON = new JSONObject(tokenPathResult);
        Map<String, Object> map = tokenPathJSON.toMap();
        String accessToken = map.get("access_token").toString();


        String url = "https://api.weixin.qq.com/wxa/generate_urllink?access_token=%s";
//
//        String s = HttpsUtil.httpsPost(String.format(url, accessToken));

        System.out.println(accessToken);
        String format = String.format(url, accessToken);
        Map<String, Object> param = Maps.newHashMap();
//        param.put("access_token",accessToken);
        param.put("path","pages/table/aiIndex/ai_index");
        ObjectMapper jsonMapper = new ObjectMapper();
        byte[] postDataBytes = jsonMapper.writeValueAsBytes(param);

        Map<String, String> headers = new HashMap<>();
        headers.put(BeanConfig.ZHS_CONTENT_TYPE, "application/json");
        InputStream inputStream = HttpsUtil.httpsPostInputStream(format, postDataBytes, headers);
        return IOUtils.toString(inputStream);
//        String s = HttpsUtil.httpsPost(format, param, headers);
//        return s;
    }

    public ResponseResultInfo<String> fileUploadNetworkPath(String file) {
        return fileService.fileUploadNetworkPath(file);
    }

    public String cancelUser(String uuid) {
        // 获取当前用户信息
        userMapper.cancelUser(uuid);
        return ResultConfig.SUCCESS;
    }


    /**
     *
     * @return 获取明天00：00销毁的剩余时长
     */
    private Long getTomorrow(){
        // 1. 获取当前Instant和系统默认时区（可替换为指定时区，如ZoneId.of("UTC")）
        Instant now = Instant.now();
        ZoneId zoneId = ZoneId.systemDefault();

        // 2. 计算明天00:00的Instant
        ZonedDateTime tomorrowMidnight = LocalDate.now(zoneId)
                .plusDays(1) // 今天加1天 = 明天
                .atTime(LocalTime.MIDNIGHT) // 设定时间为00:00
                .atZone(zoneId); // 绑定时区
        Instant tomorrowMidnightInstant = tomorrowMidnight.toInstant();

        // 3. 计算从现在到明天00:00的毫秒数（long值）
        long millisUntilTomorrow = Duration.between(now, tomorrowMidnightInstant).toMillis();

        System.out.println("当前时间戳(ms)：" + now.toEpochMilli());
        System.out.println("明天00:00时间戳(ms)：" + tomorrowMidnightInstant.toEpochMilli());
        System.out.println("从现在到明天00:00的毫秒数：" + millisUntilTomorrow);
        return Duration.between(now, tomorrowMidnightInstant).getSeconds();
    }

//    public UsersVO firstShare(String uuid) {
//        // 获取redis中是否存在这个值
//        if(Objects.nonNull(redisTemplate.opsForValue().get(uuid))){
//            return null;
//        }
//
//        redisTemplate.opsForValue().set(uuid, uuid, getTomorrow(), TimeUnit.SECONDS);
////        redisTemplate.opsForValue().set(uuid, uuid, 10, TimeUnit.SECONDS);
//        // 保存用户token
//        userMapper.firstShare(uuid,FIRSE_SHARE);
//        return "已完成赠送";
//    }
    public String firstShare(String uuid) {
        // 获取redis中是否存在这个值
        if(Objects.nonNull(redisTemplate.opsForValue().get(uuid))){
            return "当日已赠送";
        }

        redisTemplate.opsForValue().set(uuid, uuid, getTomorrow(), TimeUnit.SECONDS);
//        redisTemplate.opsForValue().set(uuid, uuid, 10, TimeUnit.SECONDS);
        // 保存用户token
        userMapper.firstShare(uuid,FIRSE_SHARE);
        return "已完成赠送";
    }

    public Boolean firstShareShow(String uuid) {
        // 获取redis中是否存在这个值
        return !Objects.isNull(redisTemplate.opsForValue().get(uuid));
    }
}