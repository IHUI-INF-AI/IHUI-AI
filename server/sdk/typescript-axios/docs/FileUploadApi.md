# FileUploadApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post**](#uploadbase64fileapiv1cozezhsapifileuploadbase64post) | **POST** /api/v1/cozeZhsApi/file/upload/base64 | Upload base64 file|
|[**uploadFormFileApiV1CozeZhsApiFileUploadFormPost**](#uploadformfileapiv1cozezhsapifileuploadformpost) | **POST** /api/v1/cozeZhsApi/file/upload/form | Upload file via form-data|
|[**uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost**](#uploadoctetfileapiv1cozezhsapifileuploadoctetpost) | **POST** /api/v1/cozeZhsApi/file/upload/octet | Upload file via octet-stream|

# **uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post**
> any uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(base64UploadRequest)

Upload a base64-encoded file. Auto-converts webp to png.

### Example

```typescript
import {
    FileUploadApi,
    Configuration,
    Base64UploadRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new FileUploadApi(configuration);

let base64UploadRequest: Base64UploadRequest; //

const { status, data } = await apiInstance.uploadBase64FileApiV1CozeZhsApiFileUploadBase64Post(
    base64UploadRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **base64UploadRequest** | **Base64UploadRequest**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadFormFileApiV1CozeZhsApiFileUploadFormPost**
> any uploadFormFileApiV1CozeZhsApiFileUploadFormPost()

Upload any file via multipart/form-data.

### Example

```typescript
import {
    FileUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FileUploadApi(configuration);

let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadFormFileApiV1CozeZhsApiFileUploadFormPost(
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost**
> any uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost()

Upload file via raw octet-stream body. file_name in query.

### Example

```typescript
import {
    FileUploadApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FileUploadApi(configuration);

let fileName: string; // (default to undefined)

const { status, data } = await apiInstance.uploadOctetFileApiV1CozeZhsApiFileUploadOctetPost(
    fileName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileName** | [**string**] |  | defaults to undefined|


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

