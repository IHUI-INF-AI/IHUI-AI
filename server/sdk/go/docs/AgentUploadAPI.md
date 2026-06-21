# \AgentUploadAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeleteUploadApiV1AgentUploadUidDelete**](AgentUploadAPI.md#DeleteUploadApiV1AgentUploadUidDelete) | **Delete** /api/v1/agent-upload/{uid} | 删除上传记录
[**DeleteUploadApiV1AgentUploadUidDelete_0**](AgentUploadAPI.md#DeleteUploadApiV1AgentUploadUidDelete_0) | **Delete** /api/v1/agent-upload/{uid} | 删除上传记录
[**ListUploadsApiV1AgentUploadListGet**](AgentUploadAPI.md#ListUploadsApiV1AgentUploadListGet) | **Get** /api/v1/agent-upload/list | 我的上传
[**ListUploadsApiV1AgentUploadListGet_0**](AgentUploadAPI.md#ListUploadsApiV1AgentUploadListGet_0) | **Get** /api/v1/agent-upload/list | 我的上传
[**RecordUploadApiV1AgentUploadPost**](AgentUploadAPI.md#RecordUploadApiV1AgentUploadPost) | **Post** /api/v1/agent-upload | 记录上传
[**RecordUploadApiV1AgentUploadPost_0**](AgentUploadAPI.md#RecordUploadApiV1AgentUploadPost_0) | **Post** /api/v1/agent-upload | 记录上传



## DeleteUploadApiV1AgentUploadUidDelete

> interface{} DeleteUploadApiV1AgentUploadUidDelete(ctx, uid).Execute()

删除上传记录

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	uid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUploadAPI.DeleteUploadApiV1AgentUploadUidDelete(context.Background(), uid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUploadAPI.DeleteUploadApiV1AgentUploadUidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteUploadApiV1AgentUploadUidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUploadAPI.DeleteUploadApiV1AgentUploadUidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteUploadApiV1AgentUploadUidDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteUploadApiV1AgentUploadUidDelete_0

> interface{} DeleteUploadApiV1AgentUploadUidDelete_0(ctx, uid).Execute()

删除上传记录

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	uid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUploadAPI.DeleteUploadApiV1AgentUploadUidDelete_0(context.Background(), uid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUploadAPI.DeleteUploadApiV1AgentUploadUidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteUploadApiV1AgentUploadUidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUploadAPI.DeleteUploadApiV1AgentUploadUidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**uid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteUploadApiV1AgentUploadUidDelete_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListUploadsApiV1AgentUploadListGet

> interface{} ListUploadsApiV1AgentUploadListGet(ctx).Page(page).Limit(limit).AgentId(agentId).BizType(bizType).FileType(fileType).Execute()

我的上传

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	agentId := "agentId_example" // string |  (optional)
	bizType := "bizType_example" // string |  (optional)
	fileType := "fileType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUploadAPI.ListUploadsApiV1AgentUploadListGet(context.Background()).Page(page).Limit(limit).AgentId(agentId).BizType(bizType).FileType(fileType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUploadAPI.ListUploadsApiV1AgentUploadListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListUploadsApiV1AgentUploadListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUploadAPI.ListUploadsApiV1AgentUploadListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListUploadsApiV1AgentUploadListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **agentId** | **string** |  | 
 **bizType** | **string** |  | 
 **fileType** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListUploadsApiV1AgentUploadListGet_0

> interface{} ListUploadsApiV1AgentUploadListGet_0(ctx).Page(page).Limit(limit).AgentId(agentId).BizType(bizType).FileType(fileType).Execute()

我的上传

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	agentId := "agentId_example" // string |  (optional)
	bizType := "bizType_example" // string |  (optional)
	fileType := "fileType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUploadAPI.ListUploadsApiV1AgentUploadListGet_0(context.Background()).Page(page).Limit(limit).AgentId(agentId).BizType(bizType).FileType(fileType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUploadAPI.ListUploadsApiV1AgentUploadListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListUploadsApiV1AgentUploadListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUploadAPI.ListUploadsApiV1AgentUploadListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListUploadsApiV1AgentUploadListGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **agentId** | **string** |  | 
 **bizType** | **string** |  | 
 **fileType** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## RecordUploadApiV1AgentUploadPost

> interface{} RecordUploadApiV1AgentUploadPost(ctx).FileName(fileName).FileUrl(fileUrl).FileType(fileType).FileSize(fileSize).MimeType(mimeType).Ext(ext).AgentId(agentId).AgentName(agentName).BizType(bizType).Execute()

记录上传

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	fileName := "fileName_example" // string | 
	fileUrl := "fileUrl_example" // string | 
	fileType := "fileType_example" // string |  (optional)
	fileSize := int32(56) // int32 |  (optional) (default to 0)
	mimeType := "mimeType_example" // string |  (optional)
	ext := "ext_example" // string |  (optional)
	agentId := "agentId_example" // string |  (optional)
	agentName := "agentName_example" // string |  (optional)
	bizType := "bizType_example" // string |  (optional) (default to "avatar")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUploadAPI.RecordUploadApiV1AgentUploadPost(context.Background()).FileName(fileName).FileUrl(fileUrl).FileType(fileType).FileSize(fileSize).MimeType(mimeType).Ext(ext).AgentId(agentId).AgentName(agentName).BizType(bizType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUploadAPI.RecordUploadApiV1AgentUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordUploadApiV1AgentUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUploadAPI.RecordUploadApiV1AgentUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordUploadApiV1AgentUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fileName** | **string** |  | 
 **fileUrl** | **string** |  | 
 **fileType** | **string** |  | 
 **fileSize** | **int32** |  | [default to 0]
 **mimeType** | **string** |  | 
 **ext** | **string** |  | 
 **agentId** | **string** |  | 
 **agentName** | **string** |  | 
 **bizType** | **string** |  | [default to &quot;avatar&quot;]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## RecordUploadApiV1AgentUploadPost_0

> interface{} RecordUploadApiV1AgentUploadPost_0(ctx).FileName(fileName).FileUrl(fileUrl).FileType(fileType).FileSize(fileSize).MimeType(mimeType).Ext(ext).AgentId(agentId).AgentName(agentName).BizType(bizType).Execute()

记录上传

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	fileName := "fileName_example" // string | 
	fileUrl := "fileUrl_example" // string | 
	fileType := "fileType_example" // string |  (optional)
	fileSize := int32(56) // int32 |  (optional) (default to 0)
	mimeType := "mimeType_example" // string |  (optional)
	ext := "ext_example" // string |  (optional)
	agentId := "agentId_example" // string |  (optional)
	agentName := "agentName_example" // string |  (optional)
	bizType := "bizType_example" // string |  (optional) (default to "avatar")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUploadAPI.RecordUploadApiV1AgentUploadPost_0(context.Background()).FileName(fileName).FileUrl(fileUrl).FileType(fileType).FileSize(fileSize).MimeType(mimeType).Ext(ext).AgentId(agentId).AgentName(agentName).BizType(bizType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUploadAPI.RecordUploadApiV1AgentUploadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordUploadApiV1AgentUploadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUploadAPI.RecordUploadApiV1AgentUploadPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordUploadApiV1AgentUploadPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fileName** | **string** |  | 
 **fileUrl** | **string** |  | 
 **fileType** | **string** |  | 
 **fileSize** | **int32** |  | [default to 0]
 **mimeType** | **string** |  | 
 **ext** | **string** |  | 
 **agentId** | **string** |  | 
 **agentName** | **string** |  | 
 **bizType** | **string** |  | [default to &quot;avatar&quot;]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

