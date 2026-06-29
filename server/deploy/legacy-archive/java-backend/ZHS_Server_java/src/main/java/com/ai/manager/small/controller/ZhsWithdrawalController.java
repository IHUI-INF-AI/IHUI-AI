package com.ai.manager.small.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.utils.NonceRandomUtils;
import com.ai.manager.small.domain.ZhsWithdrawalDetail;
import com.ai.manager.small.mapper.CommissionFlowMapper;
import com.ai.manager.small.mapper.UserMapper;
import com.ai.manager.small.mapper.ZhsUserMapper;
import com.ai.manager.small.service.IZhsWithdrawalDetailService;
import com.alibaba.druid.util.StringUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
/**
 * 提现接口
 */
@RestController
@RequestMapping("/zhsWithdrawal")
@Tag(name = "Distribution", description = "提现相关接口")
public class ZhsWithdrawalController {

    @Autowired
    private CommissionFlowMapper commissionFlowMapper;
    @Autowired
    private IZhsWithdrawalDetailService IZhsWithdrawalDetailService;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private ZhsUserMapper zhsUserMapper;
    @Value("${wx.shops.id}")
    private String machId;
    @Value("${wx.appid}")
    private String appId;
    /**
     * 提现详情页数据面板
     * @param openId
     * @param orderStatus
     * @return
     */
    @Operation(summary = "提现详情页数据面板")
    @PostMapping ("/searchCount")

    public ResponseResultInfo<Map<String,Object>> searchCount(@RequestBody String withdrawal, HttpServletRequest request)   {
        JSONObject resquestJson = new JSONObject(withdrawal) ;
        String token=resquestJson.getString("token");
        String orderStatus=resquestJson.getString("orderStatus");
        String startOfDay=resquestJson.getString("startOfDay");
        String endOfDay=resquestJson.getString("endOfDay");

    // 1. 获取账户信息
    Map<String,String> reMap = commissionFlowMapper.getAccountByOpenId(token);
    Map<String,Object> resJson = new HashMap<>();
    resJson.put("detail", reMap);

    // 2. 处理日期参数
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    LocalDate startDate, endDate;
        long startTimestamp = 0;
        long endTimestamp = 0;
        if (!StringUtils.isEmpty(startOfDay) && !StringUtils.isEmpty(endOfDay)) {

        startDate = LocalDate.parse(startOfDay, formatter);
        endDate = LocalDate.parse(endOfDay, formatter);
        // 3. 查询订单数据
         startTimestamp = startDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()/1000;
         endTimestamp = endDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()/1000;
    }

    List<Map<String,Object>> list = commissionFlowMapper.selectAllOrders(
        token, orderStatus, startTimestamp, endTimestamp);
    resJson.put("list", list);

    // 4. 直接构建ResponseResultInfo，避免不必要的反序列化
    return ResponseResultInfo.<Map<String,Object>>builder()
            .code(ResultConfig.SUCCESS_CODE.toString())
            .msg(ResultConfig.SUCCESS)
            .data(resJson)
            .build();
}
    /**
     * 提现申请发起
     */
    @Operation(summary = "提现申请发起")
    @PostMapping ("/withdrawal")
    public ResponseResultInfo<Map<String,Object>> withdrawal(@RequestBody String withdrawal, HttpServletRequest request) {

        JSONObject resJson = new JSONObject(withdrawal) ;
//        User user=zhsUserMapper.getByUuid(resJson.getString("token"));
        ZhsWithdrawalDetail zhsWithdrawalDetail=new ZhsWithdrawalDetail();
        zhsWithdrawalDetail.setUserId(resJson.getString("token"));
        zhsWithdrawalDetail.setUserName(resJson.getString("nickname"));
        zhsWithdrawalDetail.setOpenId(resJson.getString("openId"));

        zhsWithdrawalDetail.setWithdrawalAmount(String.valueOf(resJson.getInt("amount")*0.98));//扣除2%手续费
        zhsWithdrawalDetail.setWithdrawalType("1");//微信
        zhsWithdrawalDetail.setWithdrawalStatus("1");//待审核
        zhsWithdrawalDetail.setWithdrawalTime(String.valueOf(Instant.now().getEpochSecond()));//发起时间
        // 时间戳
        long payTime = Instant.now().getEpochSecond();
        // 订单号
        String outTradeNo = "WX" +  NonceRandomUtils.getRandomString(8) + payTime;
        //发起提现包含的佣金工单
        List<Map<String,Object>> list = commissionFlowMapper.selectAllOrders(
                resJson.getString("token"), "2", 0, Instant.now().getEpochSecond());
        
        String orderIds = list.stream()
                .map(m -> m.get("order_id").toString())
                .collect(Collectors.joining(","));
        zhsWithdrawalDetail.setOutBillNo(outTradeNo);
        zhsWithdrawalDetail.setOrderIds(orderIds);
        IZhsWithdrawalDetailService.insertZhsWithdrawalDetail(zhsWithdrawalDetail);


        List<String> ids = list.stream()
                .map(m -> m.get("id").toString())
                .collect(Collectors.toList());
        int i = commissionFlowMapper.updateStatus(ids);

        Map<String,Object> map = new HashMap<>();
        map.put("outBillNo", outTradeNo);

         return ResponseResultInfo.<Map<String,Object>>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                 .data(map)
                .build();
    }
    /**
     * 个人提现记录查询
     * @param openId
     * @param dateStr
     * @return
     */
    @Operation(summary = "个人提现记录查询")
    @PostMapping ("/withdrawalRecord")
    public ResponseResultInfo<List<ZhsWithdrawalDetail>> withdrawalRecord(@RequestBody String withdrawal, HttpServletRequest request)  {
        JSONObject resJson = new JSONObject(withdrawal) ;
        String token=resJson.getString("token");
        String dateStr=resJson.getString("dateStr");
        ZhsWithdrawalDetail zhsWithdrawalDetail=new ZhsWithdrawalDetail();
        zhsWithdrawalDetail.setOpenId(token);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        LocalDate startDate,endDate;

        if (StringUtils.isEmpty(dateStr) ) {
            // 为空，取今天
            startDate = LocalDate.now();
            endDate = startDate.plusDays(1);
        } else {
            // 都不为空，分别解析
            startDate = LocalDate.parse(dateStr, formatter);
            endDate = LocalDate.parse(dateStr, formatter).plusDays(1);
        }
        long startTimestamp = startDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        long endTimestamp = endDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        Map<String,Object> map=new HashMap<>();
        map.put("beginWithdrawalTime",startTimestamp/1000);
        map.put("endWithdrawalTime",endTimestamp/1000);
        zhsWithdrawalDetail.setParams(map);
        List<ZhsWithdrawalDetail> list=IZhsWithdrawalDetailService.selectZhsWithdrawalDetailList(zhsWithdrawalDetail);
        return ResponseResultInfo.<List<ZhsWithdrawalDetail>>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(list)
                .build();
    }
    /**
     * 个人可收款查询
     * @param openId
     * @param
     * @return
     */
    @Operation(summary = "个人可收款查询")
    @PostMapping ("/getWithdrawal")
    public String getWithdrawal(@RequestBody String withdrawal)  {
        JSONObject resJson = new JSONObject(withdrawal) ;
        String token=resJson.getString("token");
        ZhsWithdrawalDetail zhsWithdrawalDetail=new ZhsWithdrawalDetail();
        zhsWithdrawalDetail.setUserId(token);
        zhsWithdrawalDetail.setWithdrawalStatus("2");//待收款
        List<ZhsWithdrawalDetail> list=IZhsWithdrawalDetailService.selectZhsWithdrawalDetailList(zhsWithdrawalDetail);
        ZhsWithdrawalDetail zhsWithdrawalDetail1=new ZhsWithdrawalDetail();
        if(list!=null&& !list.isEmpty()) {
            zhsWithdrawalDetail1=list.get(0);
            resJson.put("code","200");
            JSONObject resJson1= new JSONObject(zhsWithdrawalDetail1.getWeChatMsg());
            resJson1.put("mchId",machId);
            resJson1.put("appId",appId);
            resJson.put("data",resJson1);
            resJson.put("msg","success");
            return resJson.toString();
        }else {
            zhsWithdrawalDetail.setWithdrawalStatus("5");//退回
            list=IZhsWithdrawalDetailService.selectZhsWithdrawalDetailList(zhsWithdrawalDetail);
            if(list!=null&& !list.isEmpty()) {
                zhsWithdrawalDetail1=list.get(0);
                resJson.put("code","400");
                resJson.put("data","提现申请已退回，单号："+zhsWithdrawalDetail1.getOutBillNo()+
                        "退回原因:"+zhsWithdrawalDetail1.getNotes());
                resJson.put("msg","success");
                return resJson.toString();
            }else {
                zhsWithdrawalDetail.setWithdrawalStatus("1");//待审核
                list=IZhsWithdrawalDetailService.selectZhsWithdrawalDetailList(zhsWithdrawalDetail);
                if(list!=null&& !list.isEmpty()){
                    zhsWithdrawalDetail1=list.get(0);
                    resJson.put("data","提现审核中，单号："+zhsWithdrawalDetail1.getOutBillNo());
                    resJson.put("code","300");
                    resJson.put("msg","success");

                }else {
                    resJson.put("code","500");
                    resJson.put("data","无记录");
                    resJson.put("msg","success");
                }

                return resJson.toString();
            }
        }
    }
}
