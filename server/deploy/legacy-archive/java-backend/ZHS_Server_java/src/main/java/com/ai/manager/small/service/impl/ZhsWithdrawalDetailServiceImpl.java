package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.ZhsWithdrawalDetail;
import com.ai.manager.small.mapper.ZhsWithdrawalDetailMapper;
import com.ai.manager.small.service.IZhsWithdrawalDetailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 提现明细Service业务层处理
 * 
 * @author 张旭
 * @date 2025-06-11
 */
@Service
public class ZhsWithdrawalDetailServiceImpl implements IZhsWithdrawalDetailService
{
    @Autowired
    private ZhsWithdrawalDetailMapper zhsWithdrawalDetailMapper;

    /**
     * 查询提现明细
     * 
     * @param Id 提现明细主键
     * @return 提现明细
     */
    @Override
    public ZhsWithdrawalDetail selectZhsWithdrawalDetailById(String Id)
    {
        return zhsWithdrawalDetailMapper.selectZhsWithdrawalDetailById(Id);
    }

    /**
     * 查询提现明细列表
     * 
     * @param zhsWithdrawalDetail 提现明细
     * @return 提现明细
     */
    @Override
    public List<ZhsWithdrawalDetail> selectZhsWithdrawalDetailList(ZhsWithdrawalDetail zhsWithdrawalDetail)
    {
        return zhsWithdrawalDetailMapper.selectZhsWithdrawalDetailList(zhsWithdrawalDetail);
    }

    /**
     * 新增提现明细
     * 
     * @param zhsWithdrawalDetail 提现明细
     * @return 结果
     */
    @Override
    public int insertZhsWithdrawalDetail(ZhsWithdrawalDetail zhsWithdrawalDetail)
    {
        return zhsWithdrawalDetailMapper.insertZhsWithdrawalDetail(zhsWithdrawalDetail);
    }

    /**
     * 修改提现明细
     * 
     * @param zhsWithdrawalDetail 提现明细
     * @return 结果
     */
    @Override
    public int updateZhsWithdrawalDetail(ZhsWithdrawalDetail zhsWithdrawalDetail)
    {
        return zhsWithdrawalDetailMapper.updateZhsWithdrawalDetail(zhsWithdrawalDetail);
    }

    /**
     * 批量删除提现明细
     * 
     * @param Ids 需要删除的提现明细主键
     * @return 结果
     */
    @Override
    public int deleteZhsWithdrawalDetailByIds(String[] Ids)
    {
        return zhsWithdrawalDetailMapper.deleteZhsWithdrawalDetailByIds(Ids);
    }

    /**
     * 删除提现明细信息
     * 
     * @param Id 提现明细主键
     * @return 结果
     */
    @Override
    public int deleteZhsWithdrawalDetailById(String Id)
    {
        return zhsWithdrawalDetailMapper.deleteZhsWithdrawalDetailById(Id);
    }

    @Override
    public ZhsWithdrawalDetail getOneByTransferBillNo(String transferBillNo) {

        return zhsWithdrawalDetailMapper.getOneByTransferBillNo(transferBillNo);
    }
}
