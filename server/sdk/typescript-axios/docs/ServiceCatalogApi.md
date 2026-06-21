# ServiceCatalogApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**callLogListApiV1ServiceCatalogLogListGet**](#callloglistapiv1servicecatalogloglistget) | **GET** /api/v1/service-catalog/log/list | 服务调用日志|
|[**callLogListApiV1ServiceCatalogLogListGet_0**](#callloglistapiv1servicecatalogloglistget_0) | **GET** /api/v1/service-catalog/log/list | 服务调用日志|
|[**deleteServiceApiV1ServiceCatalogSidDelete**](#deleteserviceapiv1servicecatalogsiddelete) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务|
|[**deleteServiceApiV1ServiceCatalogSidDelete_0**](#deleteserviceapiv1servicecatalogsiddelete_0) | **DELETE** /api/v1/service-catalog/{sid} | 下线服务|
|[**getServiceApiV1ServiceCatalogSidGet**](#getserviceapiv1servicecatalogsidget) | **GET** /api/v1/service-catalog/{sid} | 服务详情|
|[**getServiceApiV1ServiceCatalogSidGet_0**](#getserviceapiv1servicecatalogsidget_0) | **GET** /api/v1/service-catalog/{sid} | 服务详情|
|[**heartbeatApiV1ServiceCatalogSidHeartbeatPost**](#heartbeatapiv1servicecatalogsidheartbeatpost) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报|
|[**heartbeatApiV1ServiceCatalogSidHeartbeatPost_0**](#heartbeatapiv1servicecatalogsidheartbeatpost_0) | **POST** /api/v1/service-catalog/{sid}/heartbeat | 心跳上报|
|[**registerApiV1ServiceCatalogPost**](#registerapiv1servicecatalogpost) | **POST** /api/v1/service-catalog | 注册服务|
|[**registerApiV1ServiceCatalogPost_0**](#registerapiv1servicecatalogpost_0) | **POST** /api/v1/service-catalog | 注册服务|
|[**serviceListApiV1ServiceCatalogListGet**](#servicelistapiv1servicecataloglistget) | **GET** /api/v1/service-catalog/list | 服务列表|
|[**serviceListApiV1ServiceCatalogListGet_0**](#servicelistapiv1servicecataloglistget_0) | **GET** /api/v1/service-catalog/list | 服务列表|
|[**updateServiceApiV1ServiceCatalogSidPut**](#updateserviceapiv1servicecatalogsidput) | **PUT** /api/v1/service-catalog/{sid} | 更新服务|
|[**updateServiceApiV1ServiceCatalogSidPut_0**](#updateserviceapiv1servicecatalogsidput_0) | **PUT** /api/v1/service-catalog/{sid} | 更新服务|

# **callLogListApiV1ServiceCatalogLogListGet**
> any callLogListApiV1ServiceCatalogLogListGet()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let serviceCode: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.callLogListApiV1ServiceCatalogLogListGet(
    page,
    limit,
    serviceCode,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **serviceCode** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **callLogListApiV1ServiceCatalogLogListGet_0**
> any callLogListApiV1ServiceCatalogLogListGet_0()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let serviceCode: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.callLogListApiV1ServiceCatalogLogListGet_0(
    page,
    limit,
    serviceCode,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **serviceCode** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **deleteServiceApiV1ServiceCatalogSidDelete**
> any deleteServiceApiV1ServiceCatalogSidDelete()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteServiceApiV1ServiceCatalogSidDelete(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


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

# **deleteServiceApiV1ServiceCatalogSidDelete_0**
> any deleteServiceApiV1ServiceCatalogSidDelete_0()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteServiceApiV1ServiceCatalogSidDelete_0(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


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

# **getServiceApiV1ServiceCatalogSidGet**
> any getServiceApiV1ServiceCatalogSidGet()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.getServiceApiV1ServiceCatalogSidGet(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


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

# **getServiceApiV1ServiceCatalogSidGet_0**
> any getServiceApiV1ServiceCatalogSidGet_0()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)

const { status, data } = await apiInstance.getServiceApiV1ServiceCatalogSidGet_0(
    sid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|


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

# **heartbeatApiV1ServiceCatalogSidHeartbeatPost**
> any heartbeatApiV1ServiceCatalogSidHeartbeatPost()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)
let isHealthy: boolean; // (optional) (default to true)
let errorMsg: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.heartbeatApiV1ServiceCatalogSidHeartbeatPost(
    sid,
    isHealthy,
    errorMsg
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|
| **isHealthy** | [**boolean**] |  | (optional) defaults to true|
| **errorMsg** | [**string**] |  | (optional) defaults to undefined|


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

# **heartbeatApiV1ServiceCatalogSidHeartbeatPost_0**
> any heartbeatApiV1ServiceCatalogSidHeartbeatPost_0()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)
let isHealthy: boolean; // (optional) (default to true)
let errorMsg: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.heartbeatApiV1ServiceCatalogSidHeartbeatPost_0(
    sid,
    isHealthy,
    errorMsg
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|
| **isHealthy** | [**boolean**] |  | (optional) defaults to true|
| **errorMsg** | [**string**] |  | (optional) defaults to undefined|


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

# **registerApiV1ServiceCatalogPost**
> any registerApiV1ServiceCatalogPost()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let code: string; // (default to undefined)
let name: string; // (default to undefined)
let type: string; // (optional) (default to 'api')
let host: string; // (optional) (default to undefined)
let port: number; // (optional) (default to 0)
let path: string; // (optional) (default to '/')
let version: string; // (optional) (default to '1.0.0')
let description: string; // (optional) (default to undefined)
let group: string; // (optional) (default to 'default')
let tags: string; // (optional) (default to undefined)
let healthUrl: string; // (optional) (default to undefined)
let weight: number; // (optional) (default to 1)
let config: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.registerApiV1ServiceCatalogPost(
    code,
    name,
    type,
    host,
    port,
    path,
    version,
    description,
    group,
    tags,
    healthUrl,
    weight,
    config
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'api'|
| **host** | [**string**] |  | (optional) defaults to undefined|
| **port** | [**number**] |  | (optional) defaults to 0|
| **path** | [**string**] |  | (optional) defaults to '/'|
| **version** | [**string**] |  | (optional) defaults to '1.0.0'|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **group** | [**string**] |  | (optional) defaults to 'default'|
| **tags** | [**string**] |  | (optional) defaults to undefined|
| **healthUrl** | [**string**] |  | (optional) defaults to undefined|
| **weight** | [**number**] |  | (optional) defaults to 1|
| **config** | [**string**] |  | (optional) defaults to undefined|


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

# **registerApiV1ServiceCatalogPost_0**
> any registerApiV1ServiceCatalogPost_0()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let code: string; // (default to undefined)
let name: string; // (default to undefined)
let type: string; // (optional) (default to 'api')
let host: string; // (optional) (default to undefined)
let port: number; // (optional) (default to 0)
let path: string; // (optional) (default to '/')
let version: string; // (optional) (default to '1.0.0')
let description: string; // (optional) (default to undefined)
let group: string; // (optional) (default to 'default')
let tags: string; // (optional) (default to undefined)
let healthUrl: string; // (optional) (default to undefined)
let weight: number; // (optional) (default to 1)
let config: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.registerApiV1ServiceCatalogPost_0(
    code,
    name,
    type,
    host,
    port,
    path,
    version,
    description,
    group,
    tags,
    healthUrl,
    weight,
    config
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'api'|
| **host** | [**string**] |  | (optional) defaults to undefined|
| **port** | [**number**] |  | (optional) defaults to 0|
| **path** | [**string**] |  | (optional) defaults to '/'|
| **version** | [**string**] |  | (optional) defaults to '1.0.0'|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **group** | [**string**] |  | (optional) defaults to 'default'|
| **tags** | [**string**] |  | (optional) defaults to undefined|
| **healthUrl** | [**string**] |  | (optional) defaults to undefined|
| **weight** | [**number**] |  | (optional) defaults to 1|
| **config** | [**string**] |  | (optional) defaults to undefined|


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

# **serviceListApiV1ServiceCatalogListGet**
> any serviceListApiV1ServiceCatalogListGet()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let group: string; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.serviceListApiV1ServiceCatalogListGet(
    group,
    type,
    status,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **group** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **serviceListApiV1ServiceCatalogListGet_0**
> any serviceListApiV1ServiceCatalogListGet_0()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let group: string; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let keyword: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.serviceListApiV1ServiceCatalogListGet_0(
    group,
    type,
    status,
    keyword
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **group** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **keyword** | [**string**] |  | (optional) defaults to undefined|


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

# **updateServiceApiV1ServiceCatalogSidPut**
> any updateServiceApiV1ServiceCatalogSidPut()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let host: string; // (optional) (default to undefined)
let port: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let weight: number; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateServiceApiV1ServiceCatalogSidPut(
    sid,
    name,
    host,
    port,
    status,
    weight,
    config
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **host** | [**string**] |  | (optional) defaults to undefined|
| **port** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **weight** | [**number**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|


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

# **updateServiceApiV1ServiceCatalogSidPut_0**
> any updateServiceApiV1ServiceCatalogSidPut_0()


### Example

```typescript
import {
    ServiceCatalogApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServiceCatalogApi(configuration);

let sid: number; // (default to undefined)
let name: string; // (optional) (default to undefined)
let host: string; // (optional) (default to undefined)
let port: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let weight: number; // (optional) (default to undefined)
let config: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateServiceApiV1ServiceCatalogSidPut_0(
    sid,
    name,
    host,
    port,
    status,
    weight,
    config
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sid** | [**number**] |  | defaults to undefined|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **host** | [**string**] |  | (optional) defaults to undefined|
| **port** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **weight** | [**number**] |  | (optional) defaults to undefined|
| **config** | [**string**] |  | (optional) defaults to undefined|


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

