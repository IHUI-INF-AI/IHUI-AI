package com.ai.manager.small.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.service.DistributionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

// Swagger (SpringDoc) imports
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/distribution") // 根据 route.php 中的路径结构，基础路径是 /api
@Tag(name = "Distribution", description = "分销系统相关接口（原始php项目迁移）")
public class DistributionController {

    @Autowired
    private DistributionService distributionService;

    /**
     * 获取操盘手的所有下家列表
     * 对应 PHP 的 getSubordinates 方法
     * @param openId 微信用户OpenID
     * @param quantity 每页条数
     * @param page 当前页码
     * @return 下家列表（分页）
     */
    @GetMapping("/getSubordinates")
    public ResponseResultInfo getSubordinates(@RequestParam("open_id") String openId,
                                              @RequestParam(value = "quantity", defaultValue = "10") int quantity,
                                              @RequestParam(value = "page", defaultValue = "1") int page) {
        return distributionService.getSubordinates(openId, quantity, page);
    }

    /**
     * 获取用户及其下级的订单
     * 对应 PHP: POST /getUserAndChildrenOrders -> index.php/api/Distribution/getUserAndChildrenOrders
     * 在Spring Boot中映射为 POST /api/getUserAndChildrenOrders
     * 注意：PHP中使用了 param 获取参数，POST和GET都可，这里使用 POST
     * @param userId 用户ID
     * @param page 页码
     * @param quantity 每页数量
     * @return 订单列表
     */
    @PostMapping("/getUserAndChildrenOrders")
    public ResponseResultInfo getUserAndChildrenOrders(@RequestParam("id") Integer userId,
                                                        @RequestParam(value = "page", defaultValue = "1") int page,
                                                        @RequestParam(value = "quantity", defaultValue = "10") int quantity) {
        return distributionService.getUserAndChildrenOrders(userId, page, quantity);
    }

    /**
     * 获取操盘手数据卡片统计
     * 对应 PHP: GET /getOperatorDataCardData -> index.php/api/Distribution/getOperatorDataCardData
     * 在Spring Boot中映射为 GET /api/getOperatorDataCardData
     * @param userId 用户ID
     * @return 统计数据
     */
    @GetMapping("/getOperatorDataCardData")
    public ResponseResultInfo getOperatorDataCardData(@RequestParam("user_id") Integer userId) {
        return distributionService.getOperatorDataCardData(userId);
    }

    /**
     * 获取用户邀请的下级用户的订单统计
     * 对应 PHP: GET /getUserInviteeOrderStats -> index.php/api/Distribution/getUserInviteeOrderStats
     * 在Spring Boot中映射为 GET /api/getUserInviteeOrderStats
     * @param userId 用户ID
     * @return 下级用户列表及订单统计信息
     */
    @Operation(summary = "获取下级用户订单统计", description = "根据用户ID获取其邀请的下级用户的订单统计信息")
    @GetMapping("/getUserInviteeOrderStats")
    public ResponseResultInfo getUserInviteeOrderStats(@RequestParam("user_id") Integer userId) {
        return distributionService.getUserInviteeOrderStats(userId);
    }

    /**
     * 获取用户佣金明细
     * 对应 PHP 的 getUserCommissionDetail 方法
     * @param userId 用户ID
     * @return 用户佣金明细数据
     */
    @Operation(summary = "操盘手获取佣金页面信息", description = "根据用户ID分页获取用户的佣金流水明细")
    @GetMapping("/getUserCommissionDetail")
    public ResponseResultInfo getUserCommissionDetail(@Parameter(description = "用户ID") @RequestParam("user_id") Integer userId) {
        // Service 层已移除分页逻辑，此处不再传递分页参数
        return distributionService.getUserCommissionDetail(userId);
    }
}
