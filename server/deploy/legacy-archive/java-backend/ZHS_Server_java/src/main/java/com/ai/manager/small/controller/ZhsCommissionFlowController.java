package com.ai.manager.small.controller;

import com.ai.manager.app.domain.users.TeamPageVO;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.config.ResponseTraderInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.core.constants.WXConfig;
import com.ai.manager.small.domain.CommissionFlow;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.dto.OrderPageDTO;
import com.ai.manager.small.domain.vo.CommissionFlowResult;
import com.ai.manager.small.domain.vo.TraderTeam;
import com.ai.manager.small.service.IZhsCommissionFlowService;
import com.github.pagehelper.PageHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 分销流水
 * 
 * @author ljd
 * @date 2025-05-26
 */
@RestController
@RequestMapping("/flow")
@Tag(name = "分销流水")
public class ZhsCommissionFlowController
{
    @Autowired
    private IZhsCommissionFlowService zhsCommissionFlowService;

    @Operation(summary = "我的订单", description = "描述")
    @GetMapping("/orderList")
    public ResponseResultInfo<List<Order>> orderList(OrderPageDTO order, @RequestHeader(BeanConfig.ZHS_AUTHORIZATION) String authorization)
    {
        PageHelper.startPage(order.getPageNum(), order.getPageSize(), order.getOrderByColumn()).setReasonable(true);
        List<Order> list = zhsCommissionFlowService.getOrder(order, authorization);
        return ResponseResultInfo.<List<Order>>builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(list).build();
    }


    @Operation(summary = "分销流水列表", description = "描述")
    @GetMapping("/list")
    public ResponseResultInfo<List<CommissionFlow>> list( CommissionFlow zhsCommissionFlow, @RequestHeader(BeanConfig.ZHS_AUTHORIZATION) String authorization)
    {
        List<CommissionFlow> list = zhsCommissionFlowService.selectZhsCommissionFlowList(zhsCommissionFlow, authorization);
        long count = list.stream().mapToInt(CommissionFlow::getAmount).sum();

        return ResponseResultInfo.<List<CommissionFlow>>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(list)
                .amountCount(count)
                .build();
    }

    @Operation(summary = "分销统计", description = "描述")
    @GetMapping("/getStatistics")
    public ResponseResultInfo<CommissionFlowResult> getStatistics(@Parameter(name = "token",description = "用户OpenId")@RequestParam("token") String token
    , @RequestHeader(BeanConfig.ZHS_AUTHORIZATION)String authorization
    )
    {
        CommissionFlowResult list = zhsCommissionFlowService.getStatistics(token, authorization);
        return ResponseResultInfo.<CommissionFlowResult>builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(list).build();
    }

    @Operation(summary = "我的团队", description = "描述")
    @GetMapping("/getTraderTeam")
    public ResponseTraderInfo<List<TraderTeam>> getTraderTeam(
            @Parameter(name = "token",description = "用户OpenId")@RequestParam(value = "token") String token,
            @Parameter(name = "search",description = "模糊匹配")@RequestParam(value = "search", required = false) String search,
            @Parameter(name = "byOrderNum",description = "关于订单数排序 0不排序 | 1正序 | 2倒叙")@RequestParam(value = "byOrderNum", required = false) Integer byOrderNum,
            @Parameter(name = "byOrderTtime",description = "关于订单数时间 0不排序 | 1正序 | 2倒叙")@RequestParam(value = "byOrderTtime", required = false) Integer byOrderTtime,
            @Parameter(name = "begin",description = "起始时间 yyyy-MM-dd")@RequestParam(value = "begin", required = false) String begin,
            @Parameter(name = "end",description = "终止时间  yyyy-MM-dd")@RequestParam(value = "end", required = false) String end
    )
    {
        List<TraderTeam> list = zhsCommissionFlowService.getTraderTeam(token, search, byOrderNum, byOrderTtime, begin, end);
        Integer count = zhsCommissionFlowService.count(token, search, byOrderNum, byOrderTtime, begin, end);
        return ResponseTraderInfo.<List<TraderTeam>>builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(list)
                .total(Long.valueOf(count))
                .build();
    }
    @Operation(summary = "我的团队", description = "描述")
    @GetMapping("/getTraderTeamByCenter")
    public ResponseTraderInfo<List<TraderTeam>> getTraderTeamByCenter(
            TeamPageVO vo,
            @RequestHeader(BeanConfig.ZHS_AUTHORIZATION) String authorization,
            @RequestHeader(WXConfig.DEVICE_TYPE_HEAD) String platform
    )
    {
        ResponseTraderInfo<List<TraderTeam>> traderTeam = zhsCommissionFlowService.getTraderTeam2(vo, authorization, platform);
        traderTeam.setTeamCount(zhsCommissionFlowService.getTeamSize(platform, vo.getToken()));
        return traderTeam;
    }

}
