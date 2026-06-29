package com.ai.manager.small.service;


import com.ai.manager.app.domain.users.TeamPageVO;
import com.ai.manager.core.config.ResponseTraderInfo;
import com.ai.manager.small.domain.CommissionFlow;
import com.ai.manager.small.domain.Order;
import com.ai.manager.small.domain.dto.OrderPageDTO;
import com.ai.manager.small.domain.vo.CommissionFlowResult;
import com.ai.manager.small.domain.vo.TraderTeam;

import java.util.List;

/**
 * 佣金流水Service接口
 * 
 * @author ljd
 * @date 2025-05-26
 */
public interface IZhsCommissionFlowService 
{
    /**
     * 查询佣金流水
     * 
     * @param id 佣金流水主键
     * @return 佣金流水
     */
    public CommissionFlow selectZhsCommissionFlowById(Integer id);

    /**
     * 查询佣金流水列表
     *
     * @param CommissionFlow 佣金流水
     * @param authorization
     * @return 佣金流水集合
     */
    public List<CommissionFlow> selectZhsCommissionFlowList(CommissionFlow zhsCommissionFlow, String authorization);

    /**
     * 新增佣金流水
     * 
     * @param zhsCommissionFlow 佣金流水
     * @return 结果
     */
    public int insertZhsCommissionFlow(CommissionFlow zhsCommissionFlow);

    /**
     * 修改佣金流水
     * 
     * @param zhsCommissionFlow 佣金流水
     * @return 结果
     */
    public int updateZhsCommissionFlow(CommissionFlow zhsCommissionFlow);

    /**
     * 批量删除佣金流水
     * 
     * @param ids 需要删除的佣金流水主键集合
     * @return 结果
     */
    public int deleteZhsCommissionFlowByIds(Integer[] ids);

    /**
     * 删除佣金流水信息
     * 
     * @param id 佣金流水主键
     * @return 结果
     */
    public int deleteZhsCommissionFlowById(Integer id);

    Integer updateByIdToSettle(Integer id);

    CommissionFlowResult getStatistics(String token, String authorization);

    List<TraderTeam> getTraderTeam(String uuid, String search, Integer byOrderNum, Integer byOrderTtime, String begin, String end);

    /**
     * 提现回调 修改账单状态
     * @param transferBillNo
     */
    void editTransferAccountsNotify(String transferBillNo);

    List<Order> getOrder(OrderPageDTO order, String authorization);

    Integer count(String token, String search, Integer byOrderNum, Integer byOrderTtime, String begin, String end);

    ResponseTraderInfo<List<TraderTeam>> getTraderTeam2(TeamPageVO vo, String authorization, String platform);

    Long getTeamSize(String token, String platform);
}
