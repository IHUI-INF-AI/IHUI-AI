# ContentFileStorageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteFileApiV1ContentFilesFileIdDelete**](ContentFileStorageApi.md#deletefileapiv1contentfilesfileiddelete) | **DELETE** /api/v1/content/files/{file_id} | 删除文件 |
| [**listFilesApiV1ContentFilesListGet**](ContentFileStorageApi.md#listfilesapiv1contentfileslistget) | **GET** /api/v1/content/files/list | 文件列表 |
| [**uploadFileApiV1ContentFilesUploadPost**](ContentFileStorageApi.md#uploadfileapiv1contentfilesuploadpost) | **POST** /api/v1/content/files/upload | 上传文件记录 |



## deleteFileApiV1ContentFilesFileIdDelete

> any deleteFileApiV1ContentFilesFileIdDelete(fileId)

删除文件

### Example

```ts
import {
  Configuration,
  ContentFileStorageApi,
} from '';
import type { DeleteFileApiV1ContentFilesFileIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentFileStorageApi(config);

  const body = {
    // number
    fileId: 56,
  } satisfies DeleteFileApiV1ContentFilesFileIdDeleteRequest;

  try {
    const data = await api.deleteFileApiV1ContentFilesFileIdDelete(body);
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
| **fileId** | `number` |  | [Defaults to `undefined`] |

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


## listFilesApiV1ContentFilesListGet

> any listFilesApiV1ContentFilesListGet(page, limit, fileType)

文件列表

### Example

```ts
import {
  Configuration,
  ContentFileStorageApi,
} from '';
import type { ListFilesApiV1ContentFilesListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentFileStorageApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string | 按文件类型过滤 (optional)
    fileType: fileType_example,
  } satisfies ListFilesApiV1ContentFilesListGetRequest;

  try {
    const data = await api.listFilesApiV1ContentFilesListGet(body);
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
| **fileType** | `string` | 按文件类型过滤 | [Optional] [Defaults to `undefined`] |

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


## uploadFileApiV1ContentFilesUploadPost

> any uploadFileApiV1ContentFilesUploadPost(fileUploadBody)

上传文件记录

### Example

```ts
import {
  Configuration,
  ContentFileStorageApi,
} from '';
import type { UploadFileApiV1ContentFilesUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContentFileStorageApi(config);

  const body = {
    // FileUploadBody
    fileUploadBody: ...,
  } satisfies UploadFileApiV1ContentFilesUploadPostRequest;

  try {
    const data = await api.uploadFileApiV1ContentFilesUploadPost(body);
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
| **fileUploadBody** | [FileUploadBody](FileUploadBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

