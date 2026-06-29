package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.CommissionFlow;
import com.ai.manager.small.domain.vo.CommissionFlowResult;
import com.ai.manager.small.domain.vo.CommissionFlowStatistics;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 佣金流水Mapper接口
 * 
 * @author ljd
 * @date 2025-05-26
 */
public interface ZhsCommissionFlowMapper 
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
     * @param zhsCommissionFlow 佣金流水
     * @return 佣金流水集合
     */
    public List<CommissionFlow> selectZhsCommissionFlowList(CommissionFlow zhsCommissionFlow);

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
     * 删除佣金流水
     * 
     * @param id 佣金流水主键
     * @return 结果
     */
    public int deleteZhsCommissionFlowById(Integer id);

    /**
     * 批量删除佣金流水
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteZhsCommissionFlowByIds(Integer[] ids);

    CommissionFlowResult getStatisticsAmount(@Param("token") String token, @Param("endOfDay") Long endOfDay);

    CommissionFlowStatistics getStatistics(@Param("token") String token, @Param("beginTime") Long beginTime, @Param("endTime") Long endTime, @Param("nowBeginTime") Long nowBeginTime, @Param("nowEndTime") Long nowEndTime);

    int editOrderStatus(@Param("ids") List<String> ids);

    Integer count(@Param("token") String token, @Param("search") String search, @Param("byOrderNum") Integer byOrderNum, @Param("byOrderTime") Integer byOrderTime, @Param("beginTime") Long beginTime, @Param("endTime") Long endTime);;
}
