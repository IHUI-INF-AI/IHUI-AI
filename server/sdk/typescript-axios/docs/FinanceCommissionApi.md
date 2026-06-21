# FinanceCommissionApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**listOrdersApiV1FinanceOrdersGet**](#listordersapiv1financeordersget) | **GET** /api/v1/finance/orders | 我的订单列表（分页+筛选）|
|[**settleCommissionApiV1FinanceSettleCommissionIdPost**](#settlecommissionapiv1financesettlecommissionidpost) | **POST** /api/v1/finance/settle/{commission_id} | 手动结算佣金流水|

# **listOrdersApiV1FinanceOrdersGet**
> any listOrdersApiV1FinanceOrdersGet()


### Example

```typescript
import {
    FinanceCommissionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceCommissionApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let orderType: number; //订单类型：0=token 1=activity 2=identity 3=agent (optional) (default to undefined)
let status: number; //订单状态：0=待支付 1=已支付 2=已退款 3=已取消 (optional) (default to undefined)

const { status, data } = await apiInstance.listOrdersApiV1FinanceOrdersGet(
    page,
    limit,
    orderType,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **orderType** | [**number**] | 订单类型：0&#x3D;token 1&#x3D;activity 2&#x3D;identity 3&#x3D;agent | (optional) defaults to undefined|
| **status** | [**number**] | 订单状态：0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **settleCommissionApiV1FinanceSettleCommissionIdPost**
> any settleCommissionApiV1FinanceSettleCommissionIdPost()

Mirrors Java updateByIdToSettle: manually mark a commission flow as settled (type=1).

### Example

```typescript
import {
    FinanceCommissionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceCommissionApi(configuration);

let commissionId: number; // (default to undefined)

const { status, data } = await apiInstance.settleCommissionApiV1FinanceSettleCommissionIdPost(
    commissionId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **commissionId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

