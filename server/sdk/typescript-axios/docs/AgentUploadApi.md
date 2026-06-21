# AgentUploadApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deleteUploadApiV1AgentUploadUidDelete**](#deleteuploadapiv1agentuploaduiddelete) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录|
|[**deleteUploadApiV1AgentUploadUidDelete_0**](#deleteuploadapiv1agentuploaduiddelete_0) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录|
|[**listUploadsApiV1AgentUploadListGet**](#listuploadsapiv1agentuploadlistget) | **GET** /api/v1/agent-upload/list | 我的上传|
|[**listUploadsApiV1AgentUploadListGet_0**](#listuploadsapiv1agentuploadlistget_0) | **GET** /api/v1/agent-upload/list | 我的上传|
|[**recordUploadApiV1AgentUploadPost**](#recorduploadapiv1agentuploadpost) | **POST** /api/v1/agent-upload | 记录上传|
|[**recordUploadApiV1AgentUploadPost_0**](#recorduploadapiv1agentuploadpost_0) | **POST** /api/v1/agent-upload | 记录上传|

# **deleteUploadApiV1AgentUploadUidDelete**
> any deleteUploadApiV1AgentUploadUidDelete()


### Example

```typescript
import {
    AgentUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUploadApi(configuration);

let uid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteUploadApiV1AgentUploadUidDelete(
    uid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uid** | [**number**] |  | defaults to undefined|


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

# **deleteUploadApiV1AgentUploadUidDelete_0**
> any deleteUploadApiV1AgentUploadUidDelete_0()


### Example

```typescript
import {
    AgentUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUploadApi(configuration);

let uid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteUploadApiV1AgentUploadUidDelete_0(
    uid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uid** | [**number**] |  | defaults to undefined|


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

# **listUploadsApiV1AgentUploadListGet**
> any listUploadsApiV1AgentUploadListGet()


### Example

```typescript
import {
    AgentUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUploadApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let agentId: string; // (optional) (default to undefined)
let bizType: string; // (optional) (default to undefined)
let fileType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listUploadsApiV1AgentUploadListGet(
    page,
    limit,
    agentId,
    bizType,
    fileType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **bizType** | [**string**] |  | (optional) defaults to undefined|
| **fileType** | [**string**] |  | (optional) defaults to undefined|


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

# **listUploadsApiV1AgentUploadListGet_0**
> any listUploadsApiV1AgentUploadListGet_0()


### Example

```typescript
import {
    AgentUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUploadApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let agentId: string; // (optional) (default to undefined)
let bizType: string; // (optional) (default to undefined)
let fileType: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listUploadsApiV1AgentUploadListGet_0(
    page,
    limit,
    agentId,
    bizType,
    fileType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **bizType** | [**string**] |  | (optional) defaults to undefined|
| **fileType** | [**string**] |  | (optional) defaults to undefined|


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

# **recordUploadApiV1AgentUploadPost**
> any recordUploadApiV1AgentUploadPost()


### Example

```typescript
import {
    AgentUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUploadApi(configuration);

let fileName: string; // (default to undefined)
let fileUrl: string; // (default to undefined)
let fileType: string; // (optional) (default to undefined)
let fileSize: number; // (optional) (default to 0)
let mimeType: string; // (optional) (default to undefined)
let ext: string; // (optional) (default to undefined)
let agentId: string; // (optional) (default to undefined)
let agentName: string; // (optional) (default to undefined)
let bizType: string; // (optional) (default to 'avatar')

const { status, data } = await apiInstance.recordUploadApiV1AgentUploadPost(
    fileName,
    fileUrl,
    fileType,
    fileSize,
    mimeType,
    ext,
    agentId,
    agentName,
    bizType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileName** | [**string**] |  | defaults to undefined|
| **fileUrl** | [**string**] |  | defaults to undefined|
| **fileType** | [**string**] |  | (optional) defaults to undefined|
| **fileSize** | [**number**] |  | (optional) defaults to 0|
| **mimeType** | [**string**] |  | (optional) defaults to undefined|
| **ext** | [**string**] |  | (optional) defaults to undefined|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **agentName** | [**string**] |  | (optional) defaults to undefined|
| **bizType** | [**string**] |  | (optional) defaults to 'avatar'|


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

# **recordUploadApiV1AgentUploadPost_0**
> any recordUploadApiV1AgentUploadPost_0()


### Example

```typescript
import {
    AgentUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentUploadApi(configuration);

let fileName: string; // (default to undefined)
let fileUrl: string; // (default to undefined)
let fileType: string; // (optional) (default to undefined)
let fileSize: number; // (optional) (default to 0)
let mimeType: string; // (optional) (default to undefined)
let ext: string; // (optional) (default to undefined)
let agentId: string; // (optional) (default to undefined)
let agentName: string; // (optional) (default to undefined)
let bizType: string; // (optional) (default to 'avatar')

const { status, data } = await apiInstance.recordUploadApiV1AgentUploadPost_0(
    fileName,
    fileUrl,
    fileType,
    fileSize,
    mimeType,
    ext,
    agentId,
    agentName,
    bizType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileName** | [**string**] |  | defaults to undefined|
| **fileUrl** | [**string**] |  | defaults to undefined|
| **fileType** | [**string**] |  | (optional) defaults to undefined|
| **fileSize** | [**number**] |  | (optional) defaults to 0|
| **mimeType** | [**string**] |  | (optional) defaults to undefined|
| **ext** | [**string**] |  | (optional) defaults to undefined|
| **agentId** | [**string**] |  | (optional) defaults to undefined|
| **agentName** | [**string**] |  | (optional) defaults to undefined|
| **bizType** | [**string**] |  | (optional) defaults to 'avatar'|


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

