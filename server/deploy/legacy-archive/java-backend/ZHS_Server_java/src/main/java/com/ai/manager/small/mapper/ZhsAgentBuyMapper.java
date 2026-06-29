package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.ZhsAgentBuy;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 用户支付购买智能体记录表Mapper接口
 * 
 * @author AI Assistant
 * @date 2025-08-12
 */
@Mapper
public interface ZhsAgentBuyMapper {
    /**
     * 查询用户支付购买智能体记录表
     * 
     * @param id 用户支付购买智能体记录表主键
     * @return 用户支付购买智能体记录表
     */
    public ZhsAgentBuy selectZhsAgentBuyById(String id);

    /**
     * 查询用户支付购买智能体记录表列表
     * 
     * @param zhsAgentBuy 用户支付购买智能体记录表
     * @return 用户支付购买智能体记录表集合
     */
    public List<ZhsAgentBuy> selectZhsAgentBuyList(ZhsAgentBuy zhsAgentBuy);

    /**
     * 新增用户支付购买智能体记录表
     * 
     * @param zhsAgentBuy 用户支付购买智能体记录表
     * @return 结果
     */
    public int insertZhsAgentBuy(ZhsAgentBuy zhsAgentBuy);

    /**
     * 修改用户支付购买智能体记录表
     * 
     * @param zhsAgentBuy 用户支付购买智能体记录表
     * @return 结果
     */
    public int updateZhsAgentBuy(ZhsAgentBuy zhsAgentBuy);

    /**
     * 删除用户支付购买智能体记录表
     * 
     * @param id 用户支付购买智能体记录表主键
     * @return 结果
     */
    public int deleteZhsAgentBuyById(String id);

    /**
     * 批量删除用户支付购买智能体记录表
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteZhsAgentBuyByIds(String[] ids);

    /**
     * 根据用户UUID和智能体ID查询购买记录
     * 
     * @param bugUuid 购买人uuid
     * @param agentId 智能体id
     * @return 购买记录列表
     */
    public List<ZhsAgentBuy> selectByBugUuidAndAgentId(@Param("bugUuid") String bugUuid, @Param("agentId") String agentId);

    /**
     * 根据订单号查询购买记录
     * 
     * @param orderNo 订单号
     * @return 购买记录
     */
    public ZhsAgentBuy selectByOrderNo(@Param("orderNo") String orderNo);

    /**
     * 查询未结算的购买记录
     * 
     * @return 未结算的购买记录列表
     */
    public List<ZhsAgentBuy> selectUnsettledRecords();

    /**
     * 查询过期的购买记录
     * 
     * @return 过期的购买记录列表
     */
    public List<ZhsAgentBuy> selectExpiredRecords();
}
