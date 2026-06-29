package com.ai.manager.small.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.small.domain.ZhsAgentBuy;
import com.ai.manager.small.service.IZhsAgentBuyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 用户支付购买智能体记录表Controller
 * 
 * @author AI Assistant
 * @date 2025-08-12
 */
@RestController
@RequestMapping("/zhs_agent_buy")
@Tag(name = "智能体购买记录管理")
public class ZhsAgentBuyController {
    @Autowired
    private IZhsAgentBuyService zhsAgentBuyService;

    /**
     * 查询用户支付购买智能体记录表列表
     */
    @GetMapping("/list")
    @Operation(summary = "查询购买记录列表")
    public ResponseResultInfo list(ZhsAgentBuy zhsAgentBuy) {
        List<ZhsAgentBuy> list = zhsAgentBuyService.selectZhsAgentBuyList(zhsAgentBuy);
        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(list)
                .build();
    }

    /**
     * 获取用户支付购买智能体记录表详细信息
     */
    @GetMapping("/{id}")
    @Operation(summary = "根据ID查询购买记录详情")
    public ResponseResultInfo getInfo(@PathVariable("id") String id) {
        ZhsAgentBuy zhsAgentBuy = zhsAgentBuyService.selectZhsAgentBuyById(id);
        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(zhsAgentBuy)
                .build();
    }

    /**
     * 新增用户支付购买智能体记录表
     */
    @PostMapping
    @Operation(summary = "新增购买记录")
    public ResponseResultInfo add(@RequestBody ZhsAgentBuy zhsAgentBuy) {
        try {
            int result = zhsAgentBuyService.insertZhsAgentBuy(zhsAgentBuy);
            if (result > 0) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("新增成功")
                        .data(result)
                        .build();
            } else {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_CODE.toString())
                        .msg("新增失败")
                        .build();
            }
        } catch (Exception e) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_CODE.toString())
                    .msg("新增失败：" + e.getMessage())
                    .build();
        }
    }

    /**
     * 修改用户支付购买智能体记录表
     */
    @PutMapping
    @Operation(summary = "修改购买记录")
    public ResponseResultInfo edit(@RequestBody ZhsAgentBuy zhsAgentBuy) {
        try {
            int result = zhsAgentBuyService.updateZhsAgentBuy(zhsAgentBuy);
            if (result > 0) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("修改成功")
                        .data(result)
                        .build();
            } else {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_CODE.toString())
                        .msg("修改失败")
                        .build();
            }
        } catch (Exception e) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_CODE.toString())
                    .msg("修改失败：" + e.getMessage())
                    .build();
        }
    }

    /**
     * 删除用户支付购买智能体记录表
     */
    @DeleteMapping("/{ids}")
    @Operation(summary = "删除购买记录")
    public ResponseResultInfo remove(@PathVariable String[] ids) {
        try {
            int result = zhsAgentBuyService.deleteZhsAgentBuyByIds(ids);
            if (result > 0) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("删除成功")
                        .data(result)
                        .build();
            } else {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_CODE.toString())
                        .msg("删除失败")
                        .build();
            }
        } catch (Exception e) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_CODE.toString())
                    .msg("删除失败：" + e.getMessage())
                    .build();
        }
    }

    /**
     * 根据用户UUID和智能体ID查询购买记录
     */
    @GetMapping("/user/{bugUuid}/agent/{agentId}")
    @Operation(summary = "根据用户和智能体查询购买记录")
    public ResponseResultInfo getByUserAndAgent(@PathVariable("bugUuid") String bugUuid, 
                                               @PathVariable("agentId") String agentId) {
        List<ZhsAgentBuy> list = zhsAgentBuyService.selectByBugUuidAndAgentId(bugUuid, agentId);
        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(list)
                .build();
    }

    /**
     * 根据订单号查询购买记录
     */
    @GetMapping("/order/{orderNo}")
    @Operation(summary = "根据订单号查询购买记录")
    public ResponseResultInfo getByOrderNo(@PathVariable("orderNo") String orderNo) {
        ZhsAgentBuy zhsAgentBuy = zhsAgentBuyService.selectByOrderNo(orderNo);
        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(zhsAgentBuy)
                .build();
    }

    /**
     * 查询未结算的购买记录
     */
    @GetMapping("/unsettled")
    @Operation(summary = "查询未结算的购买记录")
    public ResponseResultInfo getUnsettledRecords() {
        List<ZhsAgentBuy> list = zhsAgentBuyService.selectUnsettledRecords();
        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(list)
                .build();
    }

    /**
     * 查询过期的购买记录
     */
    @GetMapping("/expired")
    @Operation(summary = "查询过期的购买记录")
    public ResponseResultInfo getExpiredRecords() {
        List<ZhsAgentBuy> list = zhsAgentBuyService.selectExpiredRecords();
        return ResponseResultInfo.builder()
                .code(ResultConfig.SUCCESS_CODE.toString())
                .msg(ResultConfig.SUCCESS)
                .data(list)
                .build();
    }

    /**
     * 更新记录状态为过期
     */
    @PutMapping("/{id}/expire")
    @Operation(summary = "更新记录状态为过期")
    public ResponseResultInfo updateToExpired(@PathVariable("id") String id) {
        try {
            int result = zhsAgentBuyService.updateStatusToExpired(id);
            if (result > 0) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("状态更新成功")
                        .data(result)
                        .build();
            } else {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_CODE.toString())
                        .msg("状态更新失败")
                        .build();
            }
        } catch (Exception e) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_CODE.toString())
                    .msg("状态更新失败：" + e.getMessage())
                    .build();
        }
    }

    /**
     * 更新记录为已结算
     */
    @PutMapping("/{id}/settle")
    @Operation(summary = "更新记录为已结算")
    public ResponseResultInfo updateSettlement(@PathVariable("id") String id) {
        try {
            int result = zhsAgentBuyService.updateSettlementStatus(id);
            if (result > 0) {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.SUCCESS_CODE.toString())
                        .msg("结算状态更新成功")
                        .data(result)
                        .build();
            } else {
                return ResponseResultInfo.builder()
                        .code(ResultConfig.ERROR_CODE.toString())
                        .msg("结算状态更新失败")
                        .build();
            }
        } catch (Exception e) {
            return ResponseResultInfo.builder()
                    .code(ResultConfig.ERROR_CODE.toString())
                    .msg("结算状态更新失败：" + e.getMessage())
                    .build();
        }
    }
}
