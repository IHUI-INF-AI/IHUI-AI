# AlipayFundApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**alipayFundNotify**](#alipayfundnotify) | **POST** /api/v1/payments/alipay/notify | Alipay Notify|
|[**alipayFundNotify_0**](#alipayfundnotify_0) | **POST** /api/v1/payments/alipay/notify | Alipay Notify|
|[**alipayReturnApiV1PaymentsAlipayReturnGet**](#alipayreturnapiv1paymentsalipayreturnget) | **GET** /api/v1/payments/alipay/return | Alipay Return|
|[**alipayReturnApiV1PaymentsAlipayReturnGet_0**](#alipayreturnapiv1paymentsalipayreturnget_0) | **GET** /api/v1/payments/alipay/return | Alipay Return|
|[**createPayApiV1PaymentsCreatePost**](#createpayapiv1paymentscreatepost) | **POST** /api/v1/payments/create | Create Pay|
|[**createPayApiV1PaymentsCreatePost_0**](#createpayapiv1paymentscreatepost_0) | **POST** /api/v1/payments/create | Create Pay|
|[**createPayJsonApiV1PaymentsCreate2Post**](#createpayjsonapiv1paymentscreate2post) | **POST** /api/v1/payments/create2 | Create Pay Json|
|[**createPayJsonApiV1PaymentsCreate2Post_0**](#createpayjsonapiv1paymentscreate2post_0) | **POST** /api/v1/payments/create2 | Create Pay Json|
|[**payFailApiV1PaymentsFailGet**](#payfailapiv1paymentsfailget) | **GET** /api/v1/payments/fail | Pay Fail|
|[**payFailApiV1PaymentsFailGet_0**](#payfailapiv1paymentsfailget_0) | **GET** /api/v1/payments/fail | Pay Fail|
|[**paySuccessApiV1PaymentsSuccessGet**](#paysuccessapiv1paymentssuccessget) | **GET** /api/v1/payments/success | Pay Success|
|[**paySuccessApiV1PaymentsSuccessGet_0**](#paysuccessapiv1paymentssuccessget_0) | **GET** /api/v1/payments/success | Pay Success|

# **alipayFundNotify**
> any alipayFundNotify()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.alipayFundNotify();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **alipayFundNotify_0**
> any alipayFundNotify_0()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.alipayFundNotify_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **alipayReturnApiV1PaymentsAlipayReturnGet**
> any alipayReturnApiV1PaymentsAlipayReturnGet()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.alipayReturnApiV1PaymentsAlipayReturnGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **alipayReturnApiV1PaymentsAlipayReturnGet_0**
> any alipayReturnApiV1PaymentsAlipayReturnGet_0()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.alipayReturnApiV1PaymentsAlipayReturnGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createPayApiV1PaymentsCreatePost**
> any createPayApiV1PaymentsCreatePost()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.createPayApiV1PaymentsCreatePost();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createPayApiV1PaymentsCreatePost_0**
> any createPayApiV1PaymentsCreatePost_0()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.createPayApiV1PaymentsCreatePost_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createPayJsonApiV1PaymentsCreate2Post**
> any createPayJsonApiV1PaymentsCreate2Post()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.createPayJsonApiV1PaymentsCreate2Post();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createPayJsonApiV1PaymentsCreate2Post_0**
> any createPayJsonApiV1PaymentsCreate2Post_0()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.createPayJsonApiV1PaymentsCreate2Post_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **payFailApiV1PaymentsFailGet**
> any payFailApiV1PaymentsFailGet()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.payFailApiV1PaymentsFailGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **payFailApiV1PaymentsFailGet_0**
> any payFailApiV1PaymentsFailGet_0()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

const { status, data } = await apiInstance.payFailApiV1PaymentsFailGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **paySuccessApiV1PaymentsSuccessGet**
> any paySuccessApiV1PaymentsSuccessGet()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

let orderNo: string; //order number (optional) (default to '')

const { status, data } = await apiInstance.paySuccessApiV1PaymentsSuccessGet(
    orderNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **orderNo** | [**string**] | order number | (optional) defaults to ''|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **paySuccessApiV1PaymentsSuccessGet_0**
> any paySuccessApiV1PaymentsSuccessGet_0()


### Example

```typescript
import {
    AlipayFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AlipayFundApi(configuration);

let orderNo: string; //order number (optional) (default to '')

const { status, data } = await apiInstance.paySuccessApiV1PaymentsSuccessGet_0(
    orderNo
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **orderNo** | [**string**] | order number | (optional) defaults to ''|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

