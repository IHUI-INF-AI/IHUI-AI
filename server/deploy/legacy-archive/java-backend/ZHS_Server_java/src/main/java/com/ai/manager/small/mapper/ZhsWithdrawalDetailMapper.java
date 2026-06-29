package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.ZhsWithdrawalDetail;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 提现明细Mapper接口
 * 
 * @author 张旭
 * @date 2025-06-11
 */
public interface ZhsWithdrawalDetailMapper 
{
    /**
     * 查询提现明细
     * 
     * @param Id 提现明细主键
     * @return 提现明细
     */
    public ZhsWithdrawalDetail selectZhsWithdrawalDetailById(String Id);

    /**
     * 查询提现明细列表
     * 
     * @param zhsWithdrawalDetail 提现明细
     * @return 提现明细集合
     */
    public List<ZhsWithdrawalDetail> selectZhsWithdrawalDetailList(ZhsWithdrawalDetail zhsWithdrawalDetail);

    /**
     * 新增提现明细
     * 
     * @param zhsWithdrawalDetail 提现明细
     * @return 结果
     */
    public int insertZhsWithdrawalDetail(ZhsWithdrawalDetail zhsWithdrawalDetail);

    /**
     * 修改提现明细
     * 
     * @param zhsWithdrawalDetail 提现明细
     * @return 结果
     */
    public int updateZhsWithdrawalDetail(ZhsWithdrawalDetail zhsWithdrawalDetail);

    /**
     * 删除提现明细
     * 
     * @param Id 提现明细主键
     * @return 结果
     */
    public int deleteZhsWithdrawalDetailById(String Id);

    /**
     * 批量删除提现明细
     * 
     * @param Ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteZhsWithdrawalDetailByIds(String[] Ids);

    ZhsWithdrawalDetail getOneByTransferBillNo(@Param("transferBillNo") String transferBillNo);
}
