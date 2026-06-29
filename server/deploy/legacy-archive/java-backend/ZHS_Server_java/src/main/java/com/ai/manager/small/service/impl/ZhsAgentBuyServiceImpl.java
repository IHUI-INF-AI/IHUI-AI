package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.ZhsAgentBuy;
import com.ai.manager.small.mapper.ZhsAgentBuyMapper;
import com.ai.manager.small.service.IZhsAgentBuyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 用户支付购买智能体记录表Service业务层处理
 * 
 * @author AI Assistant
 * @date 2025-08-12
 */
@Service
public class ZhsAgentBuyServiceImpl implements IZhsAgentBuyService {
    @Autowired
    private ZhsAgentBuyMapper zhsAgentBuyMapper;

    /**
     * 查询用户支付购买智能体记录表
     * 
     * @param id 用户支付购买智能体记录表主键
     * @return 用户支付购买智能体记录表
     */
    @Override
    public ZhsAgentBuy selectZhsAgentBuyById(String id) {
        return zhsAgentBuyMapper.selectZhsAgentBuyById(id);
    }

    /**
     * 查询用户支付购买智能体记录表列表
     * 
     * @param zhsAgentBuy 用户支付购买智能体记录表
     * @return 用户支付购买智能体记录表
     */
    @Override
    public List<ZhsAgentBuy> selectZhsAgentBuyList(ZhsAgentBuy zhsAgentBuy) {
        return zhsAgentBuyMapper.selectZhsAgentBuyList(zhsAgentBuy);
    }

    /**
     * 新增用户支付购买智能体记录表
     * 
     * @param zhsAgentBuy 用户支付购买智能体记录表
     * @return 结果
     */
    @Override
    public int insertZhsAgentBuy(ZhsAgentBuy zhsAgentBuy) {
        return zhsAgentBuyMapper.insertZhsAgentBuy(zhsAgentBuy);
    }

    /**
     * 修改用户支付购买智能体记录表
     * 
     * @param zhsAgentBuy 用户支付购买智能体记录表
     * @return 结果
     */
    @Override
    public int updateZhsAgentBuy(ZhsAgentBuy zhsAgentBuy) {
        return zhsAgentBuyMapper.updateZhsAgentBuy(zhsAgentBuy);
    }

    /**
     * 批量删除用户支付购买智能体记录表
     * 
     * @param ids 需要删除的用户支付购买智能体记录表主键
     * @return 结果
     */
    @Override
    public int deleteZhsAgentBuyByIds(String[] ids) {
        return zhsAgentBuyMapper.deleteZhsAgentBuyByIds(ids);
    }

    /**
     * 删除用户支付购买智能体记录表信息
     * 
     * @param id 用户支付购买智能体记录表主键
     * @return 结果
     */
    @Override
    public int deleteZhsAgentBuyById(String id) {
        return zhsAgentBuyMapper.deleteZhsAgentBuyById(id);
    }

    /**
     * 根据用户UUID和智能体ID查询购买记录
     * 
     * @param bugUuid 购买人uuid
     * @param agentId 智能体id
     * @return 购买记录列表
     */
    @Override
    public List<ZhsAgentBuy> selectByBugUuidAndAgentId(String bugUuid, String agentId) {
        return zhsAgentBuyMapper.selectByBugUuidAndAgentId(bugUuid, agentId);
    }

    /**
     * 根据订单号查询购买记录
     * 
     * @param orderNo 订单号
     * @return 购买记录
     */
    @Override
    public ZhsAgentBuy selectByOrderNo(String orderNo) {
        return zhsAgentBuyMapper.selectByOrderNo(orderNo);
    }

    /**
     * 查询未结算的购买记录
     * 
     * @return 未结算的购买记录列表
     */
    @Override
    public List<ZhsAgentBuy> selectUnsettledRecords() {
        return zhsAgentBuyMapper.selectUnsettledRecords();
    }

    /**
     * 查询过期的购买记录
     * 
     * @return 过期的购买记录列表
     */
    @Override
    public List<ZhsAgentBuy> selectExpiredRecords() {
        return zhsAgentBuyMapper.selectExpiredRecords();
    }

    /**
     * 更新记录状态为过期
     * 
     * @param id 记录ID
     * @return 结果
     */
    @Override
    public int updateStatusToExpired(String id) {
        ZhsAgentBuy zhsAgentBuy = new ZhsAgentBuy();
        zhsAgentBuy.setId(id);
        zhsAgentBuy.setStatus("1"); // 1=过期
        return zhsAgentBuyMapper.updateZhsAgentBuy(zhsAgentBuy);
    }

    /**
     * 更新记录为已结算
     * 
     * @param id 记录ID
     * @return 结果
     */
    @Override
    public int updateSettlementStatus(String id) {
        ZhsAgentBuy zhsAgentBuy = new ZhsAgentBuy();
        zhsAgentBuy.setId(id);
        zhsAgentBuy.setSettlement("1"); // 1=已结算
        return zhsAgentBuyMapper.updateZhsAgentBuy(zhsAgentBuy);
    }
}
