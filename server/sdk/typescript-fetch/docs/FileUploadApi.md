# FileUploadApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post**](FileUploadApi.md#uploadbase64fileapiv1cozezhsapifileuploadbase64post) | **POST** /api/v1/cozeZhsApi/file/upload/base64 | Upload base64 file |
| [**uploadFormFileApiV1CozeZhsApiFileUploadFormPost**](FileUploadApi.md#uploadformfileapiv1cozezhsapifileuploadformpost) | **POST** /api/v1/cozeZhsApi/file/upload/form | Upload file via form-data |
| [**uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost**](FileUploadApi.md#uploadoctetfileapiv1cozezhsapifileuploadoctetpost) | **POST** /api/v1/cozeZhsApi/file/upload/octet | Upload file via octet-stream |



## uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post

> any uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(base64UploadRequest)

Upload base64 file

Upload a base64-encoded file. Auto-converts webp to png.

### Example

```ts
import {
  Configuration,
  FileUploadApi,
} from '';
import type { UploadBase64FileApiV1CozeZhsApiFileUploadBase64PostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FileUploadApi();

  const body = {
    // Base64UploadRequest
    base64UploadRequest: ...,
  } satisfies UploadBase64FileApiV1CozeZhsApiFileUploadBase64PostRequest;

  try {
    const data = await api.uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(body);
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
| **base64UploadRequest** | [Base64UploadRequest](Base64UploadRequest.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadFormFileApiV1CozeZhsApiFileUploadFormPost

> any uploadFormFileApiV1CozeZhsApiFileUploadFormPost(file)

Upload file via form-data

Upload any file via multipart/form-data.

### Example

```ts
import {
  Configuration,
  FileUploadApi,
} from '';
import type { UploadFormFileApiV1CozeZhsApiFileUploadFormPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FileUploadApi();

  const body = {
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies UploadFormFileApiV1CozeZhsApiFileUploadFormPostRequest;

  try {
    const data = await api.uploadFormFileApiV1CozeZhsApiFileUploadFormPost(body);
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


## uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost

> any uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost(fileName)

Upload file via octet-stream

Upload file via raw octet-stream body. file_name in query.

### Example

```ts
import {
  Configuration,
  FileUploadApi,
} from '';
import type { UploadOctetFileApiV1CozeZhsApiFileUploadOctetPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new FileUploadApi();

  const body = {
    // string
    fileName: fileName_example,
  } satisfies UploadOctetFileApiV1CozeZhsApiFileUploadOctetPostRequest;

  try {
    const data = await api.uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost(body);
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

