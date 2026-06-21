# AgentCreationApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getCreationByShareCodeApiV1AgentsShareThirdCodeGet**](#getcreationbysharecodeapiv1agentssharethirdcodeget) | **GET** /api/v1/agents/share/third/{code} | 通过分享码获取创作|
|[**myCreationsApiV1AgentsMyTypePost**](#mycreationsapiv1agentsmytypepost) | **POST** /api/v1/agents/my/{type} | 我的创作列表|
|[**operateCreationApiV1AgentsOperateGcIdTypeGet**](#operatecreationapiv1agentsoperategcidtypeget) | **GET** /api/v1/agents/operate/{gc_id}/{type} | 点赞/收藏操作|
|[**shareCreationApiV1AgentsSharePost**](#sharecreationapiv1agentssharepost) | **POST** /api/v1/agents/share | 分享创作（生成分享码）|
|[**shareGenerateImageApiV1AgentsShareImagePost**](#sharegenerateimageapiv1agentsshareimagepost) | **POST** /api/v1/agents/share/image | 分享生成图片|
|[**shareToCodeApiV1AgentsShareCodePost**](#sharetocodeapiv1agentssharecodepost) | **POST** /api/v1/agents/share/code | 分享转CODE|

# **getCreationByShareCodeApiV1AgentsShareThirdCodeGet**
> any getCreationByShareCodeApiV1AgentsShareThirdCodeGet()

Public endpoint — retrieve a creation by its share code.

### Example

```typescript
import {
    AgentCreationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCreationApi(configuration);

let code: string; // (default to undefined)

const { status, data } = await apiInstance.getCreationByShareCodeApiV1AgentsShareThirdCodeGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|


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

# **myCreationsApiV1AgentsMyTypePost**
> any myCreationsApiV1AgentsMyTypePost()

Return the current user\'s creations filtered by type.

### Example

```typescript
import {
    AgentCreationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCreationApi(configuration);

let type: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.myCreationsApiV1AgentsMyTypePost(
    type,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **type** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **operateCreationApiV1AgentsOperateGcIdTypeGet**
> any operateCreationApiV1AgentsOperateGcIdTypeGet()

Toggle like or collect on a creation. Returns new state.

### Example

```typescript
import {
    AgentCreationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCreationApi(configuration);

let gcId: string; // (default to undefined)
let type: string; // (default to undefined)

const { status, data } = await apiInstance.operateCreationApiV1AgentsOperateGcIdTypeGet(
    gcId,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gcId** | [**string**] |  | defaults to undefined|
| **type** | [**string**] |  | defaults to undefined|


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

# **shareCreationApiV1AgentsSharePost**
> any shareCreationApiV1AgentsSharePost()

Generate a share code for a creation.

### Example

```typescript
import {
    AgentCreationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCreationApi(configuration);

let gcId: string; //创作ID (default to undefined)

const { status, data } = await apiInstance.shareCreationApiV1AgentsSharePost(
    gcId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gcId** | [**string**] | 创作ID | defaults to undefined|


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

# **shareGenerateImageApiV1AgentsShareImagePost**
> any shareGenerateImageApiV1AgentsShareImagePost()

Generate a shareable image card for a creation.

### Example

```typescript
import {
    AgentCreationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCreationApi(configuration);

let gcId: string; //创作ID (default to undefined)
let width: number; //图片宽度 (optional) (default to 800)
let height: number; //图片高度 (optional) (default to 600)

const { status, data } = await apiInstance.shareGenerateImageApiV1AgentsShareImagePost(
    gcId,
    width,
    height
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gcId** | [**string**] | 创作ID | defaults to undefined|
| **width** | [**number**] | 图片宽度 | (optional) defaults to 800|
| **height** | [**number**] | 图片高度 | (optional) defaults to 600|


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

# **shareToCodeApiV1AgentsShareCodePost**
> any shareToCodeApiV1AgentsShareCodePost()

Convert a share reference to a code (alias for share creation).

### Example

```typescript
import {
    AgentCreationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCreationApi(configuration);

let gcId: string; //创作ID (default to undefined)

const { status, data } = await apiInstance.shareToCodeApiV1AgentsShareCodePost(
    gcId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **gcId** | [**string**] | 创作ID | defaults to undefined|


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

