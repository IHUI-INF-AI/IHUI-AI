package com.ai.manager.small.service.impl;

import com.ai.manager.app.domain.UserThirdPartyAccounts;
import com.ai.manager.app.domain.users.TeamPageVO;
import com.ai.manager.app.domain.users.Users;
import com.ai.manager.app.domain.users.UsersVO;
import com.ai.manager.app.domain.users.VipLevelVO;
import com.ai.manager.app.server.AuthorizationManagementServlet;
import com.ai.manager.core.config.ResponseTraderInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.constants.WXConfig;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.core.utils.JsonUtils;
import com.ai.manager.core.utils.SSLClient;
import com.ai.manager.small.domain.CommissionFlow;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.ZhsWithdrawalDetail;
import com.ai.manager.small.domain.dto.OrderPageDTO;
import com.ai.manager.small.domain.vo.CommissionFlowResult;
import com.ai.manager.small.domain.vo.CommissionFlowStatistics;
import com.ai.manager.small.domain.vo.TraderTeam;
import com.ai.manager.small.mapper.OrderMapper;
import com.ai.manager.small.mapper.UserMapper;
import com.ai.manager.small.mapper.ZhsCommissionFlowMapper;
import com.ai.manager.small.service.IZhsCommissionFlowService;
import com.ai.manager.small.service.IZhsWithdrawalDetailService;
import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import com.google.common.collect.Maps;
import lombok.SneakyThrows;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.DateUtil;
import org.assertj.core.util.Lists;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 佣金流水Service业务层处理
 * 
 * @author ljd
 * @date 2025-05-26
 */
@Service
public class ZhsCommissionFlowServiceImpl implements IZhsCommissionFlowService
{
    @Value("${ai.commission.day}")
    private Integer commissionDay;
    @Value("${ai.default.team.url}")
    private String teamUrl;
    @Value("${ai.default.statistics.url}")
    private String statisticsUrl;
    @Value("${ai.default.role.url}")
    private String roleUrl;

    @Value("${ai.wx.mini.default.product.activity}")
    private String activityImg;
    @Value("${ai.wx.mini.default.product.token}")
    private String tokenImg;
    @Value("${ai.wx.mini.default.product.trader}")
    private String traderImg;
    @Value("${ai.wx.mini.default.product.vip}")
    private String vipImg;

    @Autowired
    private ZhsCommissionFlowMapper mapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private JWTUtils jwtUtils;

    @Autowired
    private IZhsWithdrawalDetailService withdrawalDetailService;
    @Autowired
    private AuthorizationManagementServlet authorizationManagementServlet;

    @Value("${ai.default.img.url}")
    private String imgUrl;

    /**
     * 查询佣金流水
     * 
     * @param id 佣金流水主键
     * @return 佣金流水
     */
    @Override
    public CommissionFlow selectZhsCommissionFlowById(Integer id)
    {
        return mapper.selectZhsCommissionFlowById(id);
    }

    /**
     * 查询佣金流水列表
     *
     * @param zhsCommissionFlow 佣金流水
     * @param authorization
     * @return 佣金流水
     */
    @Override
    public List<CommissionFlow> selectZhsCommissionFlowList(CommissionFlow zhsCommissionFlow, String authorization)
    {
        Map<String, String> uuidToNick = Maps.newHashMap();

        // 获取我的团队下所有人（下级才会对本人分销）
        List<UsersVO> s = authorizationManagementServlet.getTeam(zhsCommissionFlow.getSearch(), null, null, authorization, zhsCommissionFlow.getTokenUuid());
//        JSONObject teamResult = new JSONObject(s);
//        JSONArray jsonArray = teamResult.getJSONArray("data");
        s.forEach(obj ->{
            UserThirdPartyAccounts thirdPartyAccounts = obj.getThirdPartyAccounts();
            uuidToNick.put(obj.getUuid(), obj.getNickname());

            List<Users> users = obj.getUsers();
            users.forEach(cObj ->{
                String nickname = cObj.getNickname();
                nickname = nickname.charAt(0) + "**";
                uuidToNick.put(cObj.getUuid(), nickname);
            });

        });
        List<CommissionFlow> commissionFlows = mapper.selectZhsCommissionFlowList(zhsCommissionFlow);
        commissionFlows.forEach(item -> {
            item.setNickname(uuidToNick.get(item.getOpenId()));

            if(item.getOrderType().equals(3)){
                item.setImages(activityImg);
            }
            if (StringUtils.isNotBlank(item.getProductIdentityId()) && item.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_VIP)){
                item.setProductName(BeanConfig.PRODUCT_IDENTITY_VIP_NAME);
                item.setImages(vipImg);
            }
            if (StringUtils.isNotBlank(item.getProductIdentityId()) && item.getProductIdentityId().equals(BeanConfig.PRODUCT_IDENTITY_OPERATE)){
                item.setProductName(BeanConfig.PRODUCT_IDENTITY_OPERATE_NAME);
                item.setImages(traderImg);
            }
            if(Objects.nonNull(item.getAmount())){
                item.setAmount(item.getAmount() / 100);
            }

        });

        return commissionFlows;
    }

    /**
     * 新增佣金流水
     * 
     * @param zhsCommissionFlow 佣金流水
     * @return 结果
     */
    @Override
    public int insertZhsCommissionFlow(CommissionFlow zhsCommissionFlow)
    {
        return mapper.insertZhsCommissionFlow(zhsCommissionFlow);
    }

    /**
     * 修改佣金流水
     * 
     * @param zhsCommissionFlow 佣金流水
     * @return 结果
     */
    @Override
    public int updateZhsCommissionFlow(CommissionFlow zhsCommissionFlow)
    {
        return mapper.updateZhsCommissionFlow(zhsCommissionFlow);
    }

    /**
     * 批量删除佣金流水
     * 
     * @param ids 需要删除的佣金流水主键
     * @return 结果
     */
    @Override
    public int deleteZhsCommissionFlowByIds(Integer[] ids)
    {
        return mapper.deleteZhsCommissionFlowByIds(ids);
    }

    /**
     * 删除佣金流水信息
     * 
     * @param id 佣金流水主键
     * @return 结果
     */
    @Override
    public int deleteZhsCommissionFlowById(Integer id)
    {
        return mapper.deleteZhsCommissionFlowById(id);
    }

    @Override
    public Integer updateByIdToSettle(Integer id) {
        CommissionFlow commissionFlow = new CommissionFlow();
        commissionFlow.setId(id);
        // 手动计算佣金，不了解规则
        commissionFlow.setType(1);
        return mapper.updateZhsCommissionFlow(commissionFlow);
    }

    @SneakyThrows
    @Override
    public CommissionFlowResult getStatistics(String token, String authorization) {
        // 计算开始时间
        Instant now = Instant.now();
        // 将Instant转换为带时区的ZonedDateTime，使用系统默认时区
        ZonedDateTime zonedNow = now.atZone(ZoneId.systemDefault());
        // 当天
        Long nowBeginTime = zonedNow.with(LocalTime.MIN).toInstant().getEpochSecond();
        Long nowEndtime = zonedNow.with(LocalTime.MAX).toInstant().getEpochSecond();

        // 订单结束周期
        ZonedDateTime sevenDaysAgo = zonedNow.minusDays(commissionDay);

        // 获取七天前的晚上23:59:59.999
        Long endOfDay = sevenDaysAgo.with(LocalTime.MAX).toInstant().getEpochSecond();
//        Long endOfDay = now.getEpochSecond();

        // 计算金额
        CommissionFlowResult result = mapper.getStatisticsAmount(token, endOfDay);
        if(Objects.isNull(result)){
            result = CommissionFlowResult.builder().build();
        }

        // 计算当天
        Long startOfDay = sevenDaysAgo.with(LocalTime.MIN).toInstant().getEpochSecond();
        CommissionFlowStatistics day = mapper.getStatistics(token, startOfDay, endOfDay, nowBeginTime, nowEndtime);
        result.setDayStatistics(day);

        // 计算当月
        ZonedDateTime monthTime = sevenDaysAgo.minusMonths(1);
        long monthStartTime = monthTime.with(LocalTime.MIN).toInstant().getEpochSecond();
        long monthBeginTime = zonedNow.minusMonths(1).with(LocalTime.MIN).toInstant().getEpochSecond();
        CommissionFlowStatistics month = mapper.getStatistics(token, monthStartTime, endOfDay, monthBeginTime, nowEndtime);
        result.setMonthStatistics(month);

        // 计算总数
        CommissionFlowStatistics sum = mapper.getStatistics(token, null, endOfDay, null, nowEndtime);

        // 计算三个时间段的总数
        Map<String, Object> param = Maps.newHashMap();
        param.put("now", now.getEpochSecond());
        param.put("uuid", token);

        Map<String, Object> head = Maps.newHashMap();
        head.put(BeanConfig.ZHS_AUTHORIZATION, authorization);
        head.put(WXConfig.DEVICE_TYPE_HEAD, WXConfig.DEVICE_CODE);

        SSLClient sslClient = new SSLClient();
        String s = sslClient.doGet(statisticsUrl, JsonUtils.toJson(param), head);
        JSONObject jsonObject = new JSONObject(s);
        day.setStrength(jsonObject.getInt("today"));
        month.setStrength(jsonObject.getInt("month"));
        sum.setStrength(jsonObject.getInt("all"));


        result.setSumStatistics(sum);
        return result;
    }

    /**
     * 查询团队
     *
//     * @param uuid         用户OpenId
//     * @param search       模糊匹配
//     * @param byOrderNum   关于订单数排序 0不排序 | 1正序 | 2倒叙
//     * @param byOrderTtime 关于订单数时间 0不排序 | 1正序 | 2倒叙
//     * @param begin        起始时间 yyyy-MM-dd
//     * @param end          终止时间  yyyy-MM-dd
     * @param platform
     * @return
     */
    @SneakyThrows
    @Override
    public ResponseTraderInfo<List<TraderTeam>> getTraderTeam2(TeamPageVO vo, String authorization, String platform) {

        String uuid = vo.getToken();
        String search = vo.getSearch();
        Integer byOrderNum = vo.getByOrderNum();
        Integer byOrderTtime = vo.getByOrderTime();
        String begin = vo.getBegin();
        String end = vo.getEnd();
        Map authMap = jwtUtils.parseJwt(authorization.substring("Bearer ".length()), Map.class);

        Page<Object> objects = PageHelper.startPage(vo.getPageNum(), vo.getPageSize(), vo.getOrderByColumn()).setReasonable(true);
        List<UsersVO> s = authorizationManagementServlet.getTeam(search, begin, end, platform, uuid);
        long total = objects.getTotal();
        PageHelper.clearPage();

        // 我的团队
        List<TraderTeam> teams = Lists.newArrayList();
        // 下级团队
        Map<String, List<String>> cUuidMap = Maps.newHashMap();
        // 所有uuid
        List<String> allUuids = Lists.newArrayList();
//        JSONObject teamResult = new JSONObject(s);
//        JSONArray jsonArray = teamResult.getJSONArray("data");
        for (int i = 0; i < s.size(); i++) {
//            JSONObject jsonObject = jsonArray.getJSONObject(i);
            UsersVO jsonObject = s.get(i);
            TraderTeam team = new TraderTeam();

            team.setId(jsonObject.getUuid());
            team.setOpenId(team.getId());
            allUuids.add(team.getId());
            Date createdAtObj = jsonObject.getCreatedAt();
            team.setCreatedAt(createdAtObj.toInstant().getEpochSecond());


//            JSONObject thirdPartyAccounts = jsonObject.getJSONObject("thirdPartyAccounts");
            String nickname = jsonObject.getNickname();
            if(!authMap.get("uuid").equals(uuid))
                nickname = nickname.charAt(0) + "**";
            team.setNickname(nickname);


//            team.setOpenId(thirdPartyAccounts.getString("openId"));
            try{
                team.setAvatar(jsonObject.getAvatar());
            } catch (Exception e){
                team.setAvatar(imgUrl);
            }
            VipLevelVO vipLevelVO;
            if(!Objects.isNull(jsonObject.getVipLevelVO()) && StringUtils.isNotBlank((vipLevelVO = jsonObject.getVipLevelVO()).getId())){
                team.setVipId(vipLevelVO.getId());
                team.setVipName(vipLevelVO.getTitle());
            }
            teams.add(team);
            // 获取下级信息
            List<Users> users = jsonObject.getUsers();
            List<String> cUuid = Lists.newArrayList();
            for (Users obj : users) {
                cUuid.add(obj.getUuid());
                allUuids.add(obj.getUuid());
            }
            cUuidMap.put(team.getId(), cUuid);
        }

        // 时间转化
        Long beginTime = null, endTime = null/*, orderBeginTime = null, orderEndTime*/;
        if(StringUtils.isNotBlank(begin)){
            ZonedDateTime zonedDateTime = DateUtil.parse(begin).toInstant().atZone(ZoneId.systemDefault());
            beginTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
//            orderBeginTime = zonedDateTime.minusDays(commissionDay).with(LocalTime.MIN).toInstant().getEpochSecond();
        }
        if(StringUtils.isNotBlank(end)){
            ZonedDateTime zonedDateTime = DateUtil.parse(end).toInstant().atZone(ZoneId.systemDefault());
            endTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
//            orderEndTime = zonedDateTime.minusDays(commissionDay).with(LocalTime.MAX).toInstant().getEpochSecond();
//        } else {
//            orderEndTime = Instant.now().atZone(ZoneId.systemDefault()).minusDays(commissionDay).with(LocalTime.MAX).toInstant().getEpochSecond();
        }
//        List<TraderTeam> traderTeam = userMapper.getTraderTeam(token, search, byOrderNum, byOrderTtime, beginTime, endTime/*, orderBeginTime, orderEndTime*/);
        if(CollectionUtils.isEmpty(allUuids)){
            return ResponseTraderInfo.<List<TraderTeam>>builder()
                    .code(ResultConfig.SUCCESS_CODE.toString())
                    .msg(ResultConfig.SUCCESS)
                    .data(teams)
                    .total((long) allUuids.size())
                    .build();
        }
        List<TraderTeam> traderTeam = userMapper.getTraderTeam2(allUuids, beginTime, endTime/*, orderBeginTime, orderEndTime*/);

        Map<String, TraderTeam> map = traderTeam.stream()
                .collect(Collectors.toMap(TraderTeam::getId, Function.identity()));

        teams.forEach(item -> {
            List<String> cUuid = cUuidMap.get(item.getId());
            accumulateToExistingBean(item, map, cUuid);
        });

        // 获取当前用户的团队
        return ResponseTraderInfo.<List<TraderTeam>>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(teams)
                .total(total)
                .build();
    }
    // 计算数量
    @Override
    public Long getTeamSize(String platform, String uuid){
        return authorizationManagementServlet.getTeamSize(platform, uuid);
    }


    private void accumulateToExistingBean(TraderTeam target, Map<String, TraderTeam> map, List<String> keys) {
        keys.stream()
                .map(map::get)
                .filter(Objects::nonNull)
                .forEach(bean -> {
                    // 直接在 target Bean 上累加 count
                    if (bean.getTransactionVolume() == null) {
                        bean.setTransactionVolume(0);
                    }
                    // 直接在 target Bean 上累加 sum
                    if (bean.getCommission() == null) {
                        bean.setCommission(0);
                    }
                    // 直接在 target Bean 上累加 count
                    if (bean.getOrderNum() == null) {
                        bean.setOrderNum(0);
                    }
                    target.setTransactionVolume(target.getTransactionVolume() + bean.getTransactionVolume());
                    target.setCommission(target.getCommission() + bean.getCommission());
                    target.setOrderNum(target.getOrderNum() + bean.getOrderNum());
                });
    }

    /**
     * 查询团队
     *
     * @param token        用户OpenId
     * @param search       模糊匹配
     * @param byOrderNum   关于订单数排序 0不排序 | 1正序 | 2倒叙
     * @param byOrderTtime 关于订单数时间 0不排序 | 1正序 | 2倒叙
     * @param begin        起始时间 yyyy-MM-dd
     * @param end          终止时间  yyyy-MM-dd
     * @return
     */
    @Override
    public List<TraderTeam> getTraderTeam(String token, String search, Integer byOrderNum, Integer byOrderTtime, String begin, String end) {

        // 时间转化
        Long beginTime = null, endTime = null/*, orderBeginTime = null, orderEndTime*/;
        if(StringUtils.isNotBlank(begin)){
            ZonedDateTime zonedDateTime = DateUtil.parse(begin).toInstant().atZone(ZoneId.systemDefault());
            beginTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
//            orderBeginTime = zonedDateTime.minusDays(commissionDay).with(LocalTime.MIN).toInstant().getEpochSecond();
        }
        if(StringUtils.isNotBlank(end)){
            ZonedDateTime zonedDateTime = DateUtil.parse(end).toInstant().atZone(ZoneId.systemDefault());
            endTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
//            orderEndTime = zonedDateTime.minusDays(commissionDay).with(LocalTime.MAX).toInstant().getEpochSecond();
//        } else {
//            orderEndTime = Instant.now().atZone(ZoneId.systemDefault()).minusDays(commissionDay).with(LocalTime.MAX).toInstant().getEpochSecond();
        }
        List<TraderTeam> traderTeam = userMapper.getTraderTeam(token, search, byOrderNum, byOrderTtime, beginTime, endTime/*, orderBeginTime, orderEndTime*/);
//        List<TraderTeam> collect = traderTeam.stream().sorted(Comparator.comparingInt(TraderTeam::getOrderNum).reversed()).limit(3).collect(Collectors.toList());
        traderTeam.forEach(item -> item.setAvatar(StringUtils.isNotBlank(item.getAvatar())? item.getAvatar(): imgUrl));


        // 获取当前用户的团队
        return traderTeam;
    }

    @Override
    public void editTransferAccountsNotify(String transferBillNo) {
        // 查询账单
        ZhsWithdrawalDetail withdrawalDetail = withdrawalDetailService.getOneByTransferBillNo(transferBillNo);

        // 根据账单中字段修改订单表状态
        String orderIds = withdrawalDetail.getOrderIds();
        List<String> ids = Arrays.asList(orderIds.split(","));
        int i = mapper.editOrderStatus(ids);
        withdrawalDetail.setWithdrawalStatus("3");
        withdrawalDetailService.updateZhsWithdrawalDetail(withdrawalDetail);
    }

    @SneakyThrows
    @Override
    public List<Order> getOrder(OrderPageDTO order, String authorization) {
        // 获取订单信息
        List<Order> orders = orderMapper.getOrder(order);

        orders.forEach(item -> {
            if (item.getProductName().equals(BeanConfig.PRODUCT_IDENTITY_VIP)){
                item.setProductName(BeanConfig.PRODUCT_IDENTITY_VIP_NAME);
                item.setImages(vipImg);
            }
            if (item.getProductName().equals(BeanConfig.PRODUCT_IDENTITY_OPERATE)){
                item.setProductName(BeanConfig.PRODUCT_IDENTITY_OPERATE_NAME);
                item.setImages(traderImg);
            }
            if (item.getOrderType() == 3){
                item.setImages(activityImg);
            }
            if(StringUtils.isBlank(item.getImages())){
                item.setImages("https://file.aizhs.top/sys-mini/default/logo.png");
            }


        });

//        Map<String, Object> head = Maps.newHashMap();
//        head.put(BeanConfig.ZHS_AUTHORIZATION, authorization);
//        head.put(WXConfig.DEVICE_TYPE_HEAD, WXConfig.DEVICE_CODE);
//
//        SSLClient sslClient = new SSLClient();
//        String s = sslClient.doGet(roleUrl, "", head);
        // 获取获取角色信息；

        return orders;
    }

    @Override
    public Integer count(String token, String search, Integer byOrderNum, Integer byOrderTime, String begin, String end) {
        // 时间转化
        Long beginTime = null, endTime = null/*, orderBeginTime = null, orderEndTime*/;
        if(StringUtils.isNotBlank(begin)){
            ZonedDateTime zonedDateTime = DateUtil.parse(begin).toInstant().atZone(ZoneId.systemDefault());
            beginTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
//            orderBeginTime = zonedDateTime.minusDays(commissionDay).with(LocalTime.MIN).toInstant().getEpochSecond();
        }
        if(StringUtils.isNotBlank(end)){
            ZonedDateTime zonedDateTime = DateUtil.parse(end).toInstant().atZone(ZoneId.systemDefault());
            endTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
//            orderEndTime = zonedDateTime.minusDays(commissionDay).with(LocalTime.MAX).toInstant().getEpochSecond();
//        } else {
//            orderEndTime = Instant.now().atZone(ZoneId.systemDefault()).minusDays(commissionDay).with(LocalTime.MAX).toInstant().getEpochSecond();
        }
        return mapper.count(token, search, byOrderNum, byOrderTime, beginTime, endTime);
    }

    @Deprecated
    @SneakyThrows
    private String getTeam(String search, String begin, String end, String authorization, String uuid){

        Map<String, Object> params = Maps.newHashMap();
        params.put("search", search);
        params.put("begin", begin);
        params.put("end", end);

        Map<String, Object> heads = Maps.newHashMap();
        heads.put(BeanConfig.ZHS_AUTHORIZATION, authorization);
        heads.put(BeanConfig.ZHS_CONTENT_TYPE, BeanConfig.ZHS_CONTENT_TYPE_JSON);
        heads.put(WXConfig.DEVICE_TYPE_HEAD, WXConfig.DEVICE_CODE);

        // 请求后台获取
        SSLClient sslClient = new SSLClient();
        return sslClient.doPost(String.format(teamUrl, uuid), JsonUtils.toJson(params), heads);
    }


    public static void main(String[] args) {
        Instant now = Instant.now();

        // 将Instant转换为带时区的ZonedDateTime，使用系统默认时区
        ZonedDateTime zonedNow = now.atZone(ZoneId.systemDefault());

        // 计算七天前的日期
        ZonedDateTime sevenDaysAgo = zonedNow.minusDays(7);

        // 获取七天前的早上0点
        ZonedDateTime startOfDay = sevenDaysAgo.with(LocalTime.MIN);

        // 获取七天前的晚上23:59:59.999
        ZonedDateTime endOfDay = sevenDaysAgo.with(LocalTime.MAX);

        // 格式化输出结果
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

        System.out.println("当前时间: " + zonedNow.format(formatter));
        System.out.println("七天前的早上: " + startOfDay.format(formatter));
        System.out.println("七天前的晚上: " + endOfDay.format(formatter));
    }
}
