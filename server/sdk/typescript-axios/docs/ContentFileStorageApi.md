# ContentFileStorageApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deleteFileApiV1ContentFilesFileIdDelete**](#deletefileapiv1contentfilesfileiddelete) | **DELETE** /api/v1/content/files/{file_id} | 删除文件|
|[**listFilesApiV1ContentFilesListGet**](#listfilesapiv1contentfileslistget) | **GET** /api/v1/content/files/list | 文件列表|
|[**uploadFileApiV1ContentFilesUploadPost**](#uploadfileapiv1contentfilesuploadpost) | **POST** /api/v1/content/files/upload | 上传文件记录|

# **deleteFileApiV1ContentFilesFileIdDelete**
> any deleteFileApiV1ContentFilesFileIdDelete()


### Example

```typescript
import {
    ContentFileStorageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentFileStorageApi(configuration);

let fileId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteFileApiV1ContentFilesFileIdDelete(
    fileId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileId** | [**number**] |  | defaults to undefined|


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

# **listFilesApiV1ContentFilesListGet**
> any listFilesApiV1ContentFilesListGet()


### Example

```typescript
import {
    ContentFileStorageApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentFileStorageApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let fileType: string; //按文件类型过滤 (optional) (default to undefined)

const { status, data } = await apiInstance.listFilesApiV1ContentFilesListGet(
    page,
    limit,
    fileType
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **fileType** | [**string**] | 按文件类型过滤 | (optional) defaults to undefined|


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

# **uploadFileApiV1ContentFilesUploadPost**
> any uploadFileApiV1ContentFilesUploadPost(fileUploadBody)


### Example

```typescript
import {
    ContentFileStorageApi,
    Configuration,
    FileUploadBody
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentFileStorageApi(configuration);

let fileUploadBody: FileUploadBody; //

const { status, data } = await apiInstance.uploadFileApiV1ContentFilesUploadPost(
    fileUploadBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileUploadBody** | **FileUploadBody**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

