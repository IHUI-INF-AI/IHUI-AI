# FinanceFundApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost**](#agenttransfernotifyapiv1financefundagenttransfernotifypost) | **POST** /api/v1/finance/fund/agent/transfer/notify | Agent Transfer Notify|
|[**fileToStreamApiV1FinanceFundFileToStreamPost**](#filetostreamapiv1financefundfiletostreampost) | **POST** /api/v1/finance/fund/file/to/stream | File To Stream|
|[**fundAppNotifyApiV1FinanceFundAppNotifyPost**](#fundappnotifyapiv1financefundappnotifypost) | **POST** /api/v1/finance/fund/app/notify | Fund App Notify|
|[**fundNotifyApiV1FinanceFundNotifyPost**](#fundnotifyapiv1financefundnotifypost) | **POST** /api/v1/finance/fund/notify | Fund Notify|
|[**getInfoApiV1FinanceFundGetInfoGet**](#getinfoapiv1financefundgetinfoget) | **GET** /api/v1/finance/fund/getInfo | Get Info|
|[**getProductApiV1FinanceFundGetProductGet**](#getproductapiv1financefundgetproductget) | **GET** /api/v1/finance/fund/getProduct | Get Product|
|[**getStatisticsApiV1FinanceFundGetStatisticsGet**](#getstatisticsapiv1financefundgetstatisticsget) | **GET** /api/v1/finance/fund/getStatistics | Get Statistics|
|[**useTokenApiV1FinanceFundUseTokenPost**](#usetokenapiv1financefundusetokenpost) | **POST** /api/v1/finance/fund/useToken | Use Token|

# **agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost**
> any agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

const { status, data } = await apiInstance.agentTransferNotifyApiV1FinanceFundAgentTransferNotifyPost();
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

# **fileToStreamApiV1FinanceFundFileToStreamPost**
> any fileToStreamApiV1FinanceFundFileToStreamPost()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

const { status, data } = await apiInstance.fileToStreamApiV1FinanceFundFileToStreamPost();
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

# **fundAppNotifyApiV1FinanceFundAppNotifyPost**
> any fundAppNotifyApiV1FinanceFundAppNotifyPost()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

const { status, data } = await apiInstance.fundAppNotifyApiV1FinanceFundAppNotifyPost();
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

# **fundNotifyApiV1FinanceFundNotifyPost**
> any fundNotifyApiV1FinanceFundNotifyPost()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

const { status, data } = await apiInstance.fundNotifyApiV1FinanceFundNotifyPost();
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

# **getInfoApiV1FinanceFundGetInfoGet**
> any getInfoApiV1FinanceFundGetInfoGet()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

let token: string; //user uuid (default to undefined)

const { status, data } = await apiInstance.getInfoApiV1FinanceFundGetInfoGet(
    token
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **token** | [**string**] | user uuid | defaults to undefined|


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

# **getProductApiV1FinanceFundGetProductGet**
> any getProductApiV1FinanceFundGetProductGet()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

const { status, data } = await apiInstance.getProductApiV1FinanceFundGetProductGet();
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

# **getStatisticsApiV1FinanceFundGetStatisticsGet**
> any getStatisticsApiV1FinanceFundGetStatisticsGet()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

const { status, data } = await apiInstance.getStatisticsApiV1FinanceFundGetStatisticsGet();
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

# **useTokenApiV1FinanceFundUseTokenPost**
> any useTokenApiV1FinanceFundUseTokenPost()


### Example

```typescript
import {
    FinanceFundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FinanceFundApi(configuration);

let platform: string; // (optional) (default to 'WEB')

const { status, data } = await apiInstance.useTokenApiV1FinanceFundUseTokenPost(
    platform
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | (optional) defaults to 'WEB'|


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

