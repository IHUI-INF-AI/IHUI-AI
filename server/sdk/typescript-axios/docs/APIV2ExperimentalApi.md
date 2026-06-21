# APIV2ExperimentalApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**v2InfoApiV2InfoGet**](#v2infoapiv2infoget) | **GET** /api/v2/info | v2 API 元数据|
|[**v2LoginApiV2AuthLoginPost**](#v2loginapiv2authloginpost) | **POST** /api/v2/auth/login | [v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope|
|[**v2PingApiV2PingGet**](#v2pingapiv2pingget) | **GET** /api/v2/ping | v2 API ping|

# **v2InfoApiV2InfoGet**
> any v2InfoApiV2InfoGet()

返回 v2 API 元信息 (供客户端探测).

### Example

```typescript
import {
    APIV2ExperimentalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new APIV2ExperimentalApi(configuration);

const { status, data } = await apiInstance.v2InfoApiV2InfoGet();
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

# **v2LoginApiV2AuthLoginPost**
> any v2LoginApiV2AuthLoginPost()

v2 登录 - 完整版.  请求体: {\"username\": \"xxx\", \"password\": \"xxx\"} 或 query 参数 响应体: {\"code\": \"0\", \"msg\": \"success\", \"data\": {access_token, refresh_token, expires_in, scope, user}}

### Example

```typescript
import {
    APIV2ExperimentalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new APIV2ExperimentalApi(configuration);

const { status, data } = await apiInstance.v2LoginApiV2AuthLoginPost();
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

# **v2PingApiV2PingGet**
> any v2PingApiV2PingGet()


### Example

```typescript
import {
    APIV2ExperimentalApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new APIV2ExperimentalApi(configuration);

const { status, data } = await apiInstance.v2PingApiV2PingGet();
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

