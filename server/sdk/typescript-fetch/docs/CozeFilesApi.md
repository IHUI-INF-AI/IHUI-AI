# CozeFilesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**uploadFileApiV1CozeFilesFilesUploadPost**](CozeFilesApi.md#uploadfileapiv1cozefilesfilesuploadpost) | **POST** /api/v1/coze/files/files/upload | Upload File |
| [**uploadFileApiV1CozeFilesFilesUploadPost_0**](CozeFilesApi.md#uploadfileapiv1cozefilesfilesuploadpost_0) | **POST** /api/v1/coze/files/files/upload | Upload File |



## uploadFileApiV1CozeFilesFilesUploadPost

> any uploadFileApiV1CozeFilesFilesUploadPost(file)

Upload File

### Example

```ts
import {
  Configuration,
  CozeFilesApi,
} from '';
import type { UploadFileApiV1CozeFilesFilesUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeFilesApi();

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadFileApiV1CozeFilesFilesUploadPostRequest;

  try {
    const data = await api.uploadFileApiV1CozeFilesFilesUploadPost(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadFileApiV1CozeFilesFilesUploadPost_0

> any uploadFileApiV1CozeFilesFilesUploadPost_0(file)

Upload File

### Example

```ts
import {
  Configuration,
  CozeFilesApi,
} from '';
import type { UploadFileApiV1CozeFilesFilesUploadPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeFilesApi();

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadFileApiV1CozeFilesFilesUploadPost0Request;

  try {
    const data = await api.uploadFileApiV1CozeFilesFilesUploadPost_0(body);
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
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

