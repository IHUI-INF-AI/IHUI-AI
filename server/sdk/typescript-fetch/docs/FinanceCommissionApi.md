# FinanceCommissionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listOrdersApiV1FinanceOrdersGet**](FinanceCommissionApi.md#listordersapiv1financeordersget) | **GET** /api/v1/finance/orders | 我的订单列表（分页+筛选） |
| [**settleCommissionApiV1FinanceSettleCommissionIdPost**](FinanceCommissionApi.md#settlecommissionapiv1financesettlecommissionidpost) | **POST** /api/v1/finance/settle/{commission_id} | 手动结算佣金流水 |



## listOrdersApiV1FinanceOrdersGet

> any listOrdersApiV1FinanceOrdersGet(page, limit, orderType, status)

我的订单列表（分页+筛选）

### Example

```ts
import {
  Configuration,
  FinanceCommissionApi,
} from '';
import type { ListOrdersApiV1FinanceOrdersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceCommissionApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 订单类型：0=token 1=activity 2=identity 3=agent (optional)
    orderType: 56,
    // number | 订单状态：0=待支付 1=已支付 2=已退款 3=已取消 (optional)
    status: 56,
  } satisfies ListOrdersApiV1FinanceOrdersGetRequest;

  try {
    const data = await api.listOrdersApiV1FinanceOrdersGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **orderType** | `number` | 订单类型：0&#x3D;token 1&#x3D;activity 2&#x3D;identity 3&#x3D;agent | [Optional] [Defaults to `undefined`] |
| **status** | `number` | 订单状态：0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## settleCommissionApiV1FinanceSettleCommissionIdPost

> any settleCommissionApiV1FinanceSettleCommissionIdPost(commissionId)

手动结算佣金流水

Mirrors Java updateByIdToSettle: manually mark a commission flow as settled (type&#x3D;1).

### Example

```ts
import {
  Configuration,
  FinanceCommissionApi,
} from '';
import type { SettleCommissionApiV1FinanceSettleCommissionIdPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FinanceCommissionApi(config);

  const body = {
    // number
    commissionId: 56,
  } satisfies SettleCommissionApiV1FinanceSettleCommissionIdPostRequest;

  try {
    const data = await api.settleCommissionApiV1FinanceSettleCommissionIdPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **commissionId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

