# RankingApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**agentRankingApiV1RankingAgentGet**](#agentrankingapiv1rankingagentget) | **GET** /api/v1/ranking/agent | Agent排行榜|
|[**agentRankingApiV1RankingAgentGet_0**](#agentrankingapiv1rankingagentget_0) | **GET** /api/v1/ranking/agent | Agent排行榜|
|[**courseRankingApiV1RankingCourseGet**](#courserankingapiv1rankingcourseget) | **GET** /api/v1/ranking/course | 课程排行榜|
|[**courseRankingApiV1RankingCourseGet_0**](#courserankingapiv1rankingcourseget_0) | **GET** /api/v1/ranking/course | 课程排行榜|
|[**createRankingApiV1RankingPost**](#createrankingapiv1rankingpost) | **POST** /api/v1/ranking | 创建榜单|
|[**createRankingApiV1RankingPost_0**](#createrankingapiv1rankingpost_0) | **POST** /api/v1/ranking | 创建榜单|
|[**listRankingsApiV1RankingListGet**](#listrankingsapiv1rankinglistget) | **GET** /api/v1/ranking/list | 排行榜列表|
|[**listRankingsApiV1RankingListGet_0**](#listrankingsapiv1rankinglistget_0) | **GET** /api/v1/ranking/list | 排行榜列表|
|[**userRankingApiV1RankingUserGet**](#userrankingapiv1rankinguserget) | **GET** /api/v1/ranking/user | 用户积分排行榜|
|[**userRankingApiV1RankingUserGet_0**](#userrankingapiv1rankinguserget_0) | **GET** /api/v1/ranking/user | 用户积分排行榜|

# **agentRankingApiV1RankingAgentGet**
> any agentRankingApiV1RankingAgentGet()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let period: string; // (optional) (default to 'all')
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.agentRankingApiV1RankingAgentGet(
    period,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **period** | [**string**] |  | (optional) defaults to 'all'|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **agentRankingApiV1RankingAgentGet_0**
> any agentRankingApiV1RankingAgentGet_0()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let period: string; // (optional) (default to 'all')
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.agentRankingApiV1RankingAgentGet_0(
    period,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **period** | [**string**] |  | (optional) defaults to 'all'|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **courseRankingApiV1RankingCourseGet**
> any courseRankingApiV1RankingCourseGet()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.courseRankingApiV1RankingCourseGet(
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **courseRankingApiV1RankingCourseGet_0**
> any courseRankingApiV1RankingCourseGet_0()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.courseRankingApiV1RankingCourseGet_0(
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **createRankingApiV1RankingPost**
> any createRankingApiV1RankingPost()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let name: string; // (default to undefined)
let code: string; // (default to undefined)
let type: string; // (optional) (default to 'agent')
let period: string; // (optional) (default to 'day')
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createRankingApiV1RankingPost(
    name,
    code,
    type,
    period,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'agent'|
| **period** | [**string**] |  | (optional) defaults to 'day'|
| **description** | [**string**] |  | (optional) defaults to undefined|


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

# **createRankingApiV1RankingPost_0**
> any createRankingApiV1RankingPost_0()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let name: string; // (default to undefined)
let code: string; // (default to undefined)
let type: string; // (optional) (default to 'agent')
let period: string; // (optional) (default to 'day')
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createRankingApiV1RankingPost_0(
    name,
    code,
    type,
    period,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'agent'|
| **period** | [**string**] |  | (optional) defaults to 'day'|
| **description** | [**string**] |  | (optional) defaults to undefined|


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

# **listRankingsApiV1RankingListGet**
> any listRankingsApiV1RankingListGet()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

const { status, data } = await apiInstance.listRankingsApiV1RankingListGet();
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

# **listRankingsApiV1RankingListGet_0**
> any listRankingsApiV1RankingListGet_0()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

const { status, data } = await apiInstance.listRankingsApiV1RankingListGet_0();
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

# **userRankingApiV1RankingUserGet**
> any userRankingApiV1RankingUserGet()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let period: string; // (optional) (default to 'all')
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.userRankingApiV1RankingUserGet(
    period,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **period** | [**string**] |  | (optional) defaults to 'all'|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

# **userRankingApiV1RankingUserGet_0**
> any userRankingApiV1RankingUserGet_0()


### Example

```typescript
import {
    RankingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RankingApi(configuration);

let period: string; // (optional) (default to 'all')
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.userRankingApiV1RankingUserGet_0(
    period,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **period** | [**string**] |  | (optional) defaults to 'all'|
| **limit** | [**number**] |  | (optional) defaults to 50|


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

