package com.ai.manager.small.service.impl;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.small.domain.User;
import com.ai.manager.small.domain.ZhsProductIdentity;
import com.ai.manager.small.mapper.UserMapper;
import com.ai.manager.small.mapper.ZhsProductIdentityMapper;
import com.ai.manager.small.mapper.ZhsUserMapper;
import com.ai.manager.small.service.IZhsProductIdentityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

/**
 * 开通身份订单Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-06-07
 */
@Service
public class ZhsProductIdentityServiceImpl implements IZhsProductIdentityService
{
    @Autowired
    private ZhsProductIdentityMapper mapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private ZhsUserMapper zhsUserMapper;

    private final String VIP = "35cc6b0c-5006-4fd6-84eb-e4c5ead1783c";
    private final String OPERATE = "fc56ee79-c7a9-4fef-8d04-5e450dc27d0e";

    /**
     * 查询开通身份订单
     * 
     * @param id 开通身份订单主键
     * @return 开通身份订单
     */
    @Override
    public ZhsProductIdentity selectZhsProductIdentityById(String id)
    {
        return mapper.selectZhsProductIdentityById(id);
    }

    /**
     * 查询开通身份订单列表
     * 
     * @param zhsProductIdentity 开通身份订单
     * @return 开通身份订单
     */
    @Override
    public List<ZhsProductIdentity> selectZhsProductIdentityList(ZhsProductIdentity zhsProductIdentity)
    {
        return mapper.selectZhsProductIdentityList(zhsProductIdentity);
    }

    /**
     * 新增开通身份订单
     * 
     * @param zhsProductIdentity 开通身份订单
     * @return 结果
     */
    @Override
    public int insertZhsProductIdentity(ZhsProductIdentity zhsProductIdentity)
    {
        return mapper.insertZhsProductIdentity(zhsProductIdentity);
    }

    /**
     * 修改开通身份订单
     * 
     * @param zhsProductIdentity 开通身份订单
     * @return 结果
     */
    @Override
    public int updateZhsProductIdentity(ZhsProductIdentity zhsProductIdentity)
    {
        return mapper.updateZhsProductIdentity(zhsProductIdentity);
    }

    /**
     * 批量删除开通身份订单
     * 
     * @param ids 需要删除的开通身份订单主键
     * @return 结果
     */
    @Override
    public int deleteZhsProductIdentityByIds(String[] ids)
    {
        return mapper.deleteZhsProductIdentityByIds(ids);
    }

    /**
     * 删除开通身份订单信息
     * 
     * @param id 开通身份订单主键
     * @return 结果
     */
    @Override
    public int deleteZhsProductIdentityById(String id)
    {
        return mapper.deleteZhsProductIdentityById(id);
    }

    @Override
    public ResponseResultInfo<ZhsProductIdentity> getByOpenId(String token) {
        User byOpenId = zhsUserMapper.getByUuid(token);
        if(byOpenId.getIsVIP() == 1 && byOpenId.getIdentityTypy() == 1){
            return ResponseResultInfo.<ZhsProductIdentity>builder().code(ResultConfig.ERROR_PARAM_CODE.toString()).msg("当前用户已是最大身份").build();
        }
        ZhsProductIdentity productIdentity;
        if(byOpenId.getIdentityTypy() != 1 && byOpenId.getIsVIP() == 1){
            productIdentity = mapper.selectZhsProductIdentityById(BeanConfig.PRODUCT_IDENTITY_OPERATE);
        } else {
            productIdentity = mapper.selectZhsProductIdentityById(BeanConfig.PRODUCT_IDENTITY_VIP);
        }
        // 判断时间与是否启用
        long date = new Date().getTime();
        if(!(productIdentity.getBeginTime().getTime()<= date && productIdentity.getEndTime().getTime() >= date && productIdentity.getStatus() == 1)){
            productIdentity.setAmount(productIdentity.getDefAmount());
        }
        productIdentity.setDefAmount(null);

        return ResponseResultInfo.<ZhsProductIdentity>builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(productIdentity).build();
    }
}
