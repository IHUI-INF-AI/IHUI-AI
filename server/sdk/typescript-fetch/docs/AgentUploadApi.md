# AgentUploadApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteUploadApiV1AgentUploadUidDelete**](AgentUploadApi.md#deleteuploadapiv1agentuploaduiddelete) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录 |
| [**deleteUploadApiV1AgentUploadUidDelete_0**](AgentUploadApi.md#deleteuploadapiv1agentuploaduiddelete_0) | **DELETE** /api/v1/agent-upload/{uid} | 删除上传记录 |
| [**listUploadsApiV1AgentUploadListGet**](AgentUploadApi.md#listuploadsapiv1agentuploadlistget) | **GET** /api/v1/agent-upload/list | 我的上传 |
| [**listUploadsApiV1AgentUploadListGet_0**](AgentUploadApi.md#listuploadsapiv1agentuploadlistget_0) | **GET** /api/v1/agent-upload/list | 我的上传 |
| [**recordUploadApiV1AgentUploadPost**](AgentUploadApi.md#recorduploadapiv1agentuploadpost) | **POST** /api/v1/agent-upload | 记录上传 |
| [**recordUploadApiV1AgentUploadPost_0**](AgentUploadApi.md#recorduploadapiv1agentuploadpost_0) | **POST** /api/v1/agent-upload | 记录上传 |



## deleteUploadApiV1AgentUploadUidDelete

> any deleteUploadApiV1AgentUploadUidDelete(uid)

删除上传记录

### Example

```ts
import {
  Configuration,
  AgentUploadApi,
} from '';
import type { DeleteUploadApiV1AgentUploadUidDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUploadApi();

  const body = {
    // number
    uid: 56,
  } satisfies DeleteUploadApiV1AgentUploadUidDeleteRequest;

  try {
    const data = await api.deleteUploadApiV1AgentUploadUidDelete(body);
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
| **uid** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteUploadApiV1AgentUploadUidDelete_0

> any deleteUploadApiV1AgentUploadUidDelete_0(uid)

删除上传记录

### Example

```ts
import {
  Configuration,
  AgentUploadApi,
} from '';
import type { DeleteUploadApiV1AgentUploadUidDelete0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUploadApi();

  const body = {
    // number
    uid: 56,
  } satisfies DeleteUploadApiV1AgentUploadUidDelete0Request;

  try {
    const data = await api.deleteUploadApiV1AgentUploadUidDelete_0(body);
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
| **uid** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listUploadsApiV1AgentUploadListGet

> any listUploadsApiV1AgentUploadListGet(page, limit, agentId, bizType, fileType)

我的上传

### Example

```ts
import {
  Configuration,
  AgentUploadApi,
} from '';
import type { ListUploadsApiV1AgentUploadListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUploadApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    bizType: bizType_example,
    // string (optional)
    fileType: fileType_example,
  } satisfies ListUploadsApiV1AgentUploadListGetRequest;

  try {
    const data = await api.listUploadsApiV1AgentUploadListGet(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bizType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **fileType** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listUploadsApiV1AgentUploadListGet_0

> any listUploadsApiV1AgentUploadListGet_0(page, limit, agentId, bizType, fileType)

我的上传

### Example

```ts
import {
  Configuration,
  AgentUploadApi,
} from '';
import type { ListUploadsApiV1AgentUploadListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUploadApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    bizType: bizType_example,
    // string (optional)
    fileType: fileType_example,
  } satisfies ListUploadsApiV1AgentUploadListGet0Request;

  try {
    const data = await api.listUploadsApiV1AgentUploadListGet_0(body);
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
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bizType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **fileType** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## recordUploadApiV1AgentUploadPost

> any recordUploadApiV1AgentUploadPost(fileName, fileUrl, fileType, fileSize, mimeType, ext, agentId, agentName, bizType)

记录上传

### Example

```ts
import {
  Configuration,
  AgentUploadApi,
} from '';
import type { RecordUploadApiV1AgentUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUploadApi();

  const body = {
    // string
    fileName: fileName_example,
    // string
    fileUrl: fileUrl_example,
    // string (optional)
    fileType: fileType_example,
    // number (optional)
    fileSize: 56,
    // string (optional)
    mimeType: mimeType_example,
    // string (optional)
    ext: ext_example,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    agentName: agentName_example,
    // string (optional)
    bizType: bizType_example,
  } satisfies RecordUploadApiV1AgentUploadPostRequest;

  try {
    const data = await api.recordUploadApiV1AgentUploadPost(body);
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
| **fileName** | `string` |  | [Defaults to `undefined`] |
| **fileUrl** | `string` |  | [Defaults to `undefined`] |
| **fileType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **fileSize** | `number` |  | [Optional] [Defaults to `0`] |
| **mimeType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ext** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bizType** | `string` |  | [Optional] [Defaults to `&#39;avatar&#39;`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## recordUploadApiV1AgentUploadPost_0

> any recordUploadApiV1AgentUploadPost_0(fileName, fileUrl, fileType, fileSize, mimeType, ext, agentId, agentName, bizType)

记录上传

### Example

```ts
import {
  Configuration,
  AgentUploadApi,
} from '';
import type { RecordUploadApiV1AgentUploadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentUploadApi();

  const body = {
    // string
    fileName: fileName_example,
    // string
    fileUrl: fileUrl_example,
    // string (optional)
    fileType: fileType_example,
    // number (optional)
    fileSize: 56,
    // string (optional)
    mimeType: mimeType_example,
    // string (optional)
    ext: ext_example,
    // string (optional)
    agentId: agentId_example,
    // string (optional)
    agentName: agentName_example,
    // string (optional)
    bizType: bizType_example,
  } satisfies RecordUploadApiV1AgentUploadPost0Request;

  try {
    const data = await api.recordUploadApiV1AgentUploadPost_0(body);
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
| **fileName** | `string` |  | [Defaults to `undefined`] |
| **fileUrl** | `string` |  | [Defaults to `undefined`] |
| **fileType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **fileSize** | `number` |  | [Optional] [Defaults to `0`] |
| **mimeType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **ext** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **agentName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **bizType** | `string` |  | [Optional] [Defaults to `&#39;avatar&#39;`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

