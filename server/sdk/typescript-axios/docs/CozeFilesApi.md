# CozeFilesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**uploadFileApiV1CozeFilesFilesUploadPost**](#uploadfileapiv1cozefilesfilesuploadpost) | **POST** /api/v1/coze/files/files/upload | Upload File|
|[**uploadFileApiV1CozeFilesFilesUploadPost_0**](#uploadfileapiv1cozefilesfilesuploadpost_0) | **POST** /api/v1/coze/files/files/upload | Upload File|

# **uploadFileApiV1CozeFilesFilesUploadPost**
> any uploadFileApiV1CozeFilesFilesUploadPost()


### Example

```typescript
import {
    CozeFilesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeFilesApi(configuration);

let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadFileApiV1CozeFilesFilesUploadPost(
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

# **uploadFileApiV1CozeFilesFilesUploadPost_0**
> any uploadFileApiV1CozeFilesFilesUploadPost_0()


### Example

```typescript
import {
    CozeFilesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeFilesApi(configuration);

let file: File; // (default to undefined)

const { status, data } = await apiInstance.uploadFileApiV1CozeFilesFilesUploadPost_0(
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

