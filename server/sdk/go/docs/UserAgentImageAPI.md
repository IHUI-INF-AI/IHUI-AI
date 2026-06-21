# \UserAgentImageAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateImageApiV1UserAgentImagePost**](UserAgentImageAPI.md#CreateImageApiV1UserAgentImagePost) | **Post** /api/v1/user-agent-image | 记录图片交互
[**CreateImageApiV1UserAgentImagePost_0**](UserAgentImageAPI.md#CreateImageApiV1UserAgentImagePost_0) | **Post** /api/v1/user-agent-image | 记录图片交互
[**DeleteImageApiV1UserAgentImageIidDelete**](UserAgentImageAPI.md#DeleteImageApiV1UserAgentImageIidDelete) | **Delete** /api/v1/user-agent-image/{iid} | 删除图片记录
[**DeleteImageApiV1UserAgentImageIidDelete_0**](UserAgentImageAPI.md#DeleteImageApiV1UserAgentImageIidDelete_0) | **Delete** /api/v1/user-agent-image/{iid} | 删除图片记录
[**GetImageApiV1UserAgentImageIidGet**](UserAgentImageAPI.md#GetImageApiV1UserAgentImageIidGet) | **Get** /api/v1/user-agent-image/{iid} | 图片详情
[**GetImageApiV1UserAgentImageIidGet_0**](UserAgentImageAPI.md#GetImageApiV1UserAgentImageIidGet_0) | **Get** /api/v1/user-agent-image/{iid} | 图片详情
[**ListImagesApiV1UserAgentImageListGet**](UserAgentImageAPI.md#ListImagesApiV1UserAgentImageListGet) | **Get** /api/v1/user-agent-image/list | 我的图片交互
[**ListImagesApiV1UserAgentImageListGet_0**](UserAgentImageAPI.md#ListImagesApiV1UserAgentImageListGet_0) | **Get** /api/v1/user-agent-image/list | 我的图片交互



## CreateImageApiV1UserAgentImagePost

> interface{} CreateImageApiV1UserAgentImagePost(ctx).ImageUrl(imageUrl).ImageType(imageType).AgentId(agentId).AgentName(agentName).Prompt(prompt).Model(model).TaskId(taskId).Status(status).Cost(cost).Width(width).Height(height).Size(size).Execute()

记录图片交互

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
	imageUrl := "imageUrl_example" // string | 
	imageType := "imageType_example" // string |  (optional) (default to "input")
	agentId := "agentId_example" // string |  (optional)
	agentName := "agentName_example" // string |  (optional)
	prompt := "prompt_example" // string |  (optional)
	model := "model_example" // string |  (optional)
	taskId := "taskId_example" // string |  (optional)
	status := int32(56) // int32 |  (optional) (default to 1)
	cost := int32(56) // int32 |  (optional) (default to 0)
	width := int32(56) // int32 |  (optional) (default to 0)
	height := int32(56) // int32 |  (optional) (default to 0)
	size := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.CreateImageApiV1UserAgentImagePost(context.Background()).ImageUrl(imageUrl).ImageType(imageType).AgentId(agentId).AgentName(agentName).Prompt(prompt).Model(model).TaskId(taskId).Status(status).Cost(cost).Width(width).Height(height).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.CreateImageApiV1UserAgentImagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateImageApiV1UserAgentImagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.CreateImageApiV1UserAgentImagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateImageApiV1UserAgentImagePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **imageUrl** | **string** |  | 
 **imageType** | **string** |  | [default to &quot;input&quot;]
 **agentId** | **string** |  | 
 **agentName** | **string** |  | 
 **prompt** | **string** |  | 
 **model** | **string** |  | 
 **taskId** | **string** |  | 
 **status** | **int32** |  | [default to 1]
 **cost** | **int32** |  | [default to 0]
 **width** | **int32** |  | [default to 0]
 **height** | **int32** |  | [default to 0]
 **size** | **int32** |  | [default to 0]

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


## CreateImageApiV1UserAgentImagePost_0

> interface{} CreateImageApiV1UserAgentImagePost_0(ctx).ImageUrl(imageUrl).ImageType(imageType).AgentId(agentId).AgentName(agentName).Prompt(prompt).Model(model).TaskId(taskId).Status(status).Cost(cost).Width(width).Height(height).Size(size).Execute()

记录图片交互

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
	imageUrl := "imageUrl_example" // string | 
	imageType := "imageType_example" // string |  (optional) (default to "input")
	agentId := "agentId_example" // string |  (optional)
	agentName := "agentName_example" // string |  (optional)
	prompt := "prompt_example" // string |  (optional)
	model := "model_example" // string |  (optional)
	taskId := "taskId_example" // string |  (optional)
	status := int32(56) // int32 |  (optional) (default to 1)
	cost := int32(56) // int32 |  (optional) (default to 0)
	width := int32(56) // int32 |  (optional) (default to 0)
	height := int32(56) // int32 |  (optional) (default to 0)
	size := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.CreateImageApiV1UserAgentImagePost_0(context.Background()).ImageUrl(imageUrl).ImageType(imageType).AgentId(agentId).AgentName(agentName).Prompt(prompt).Model(model).TaskId(taskId).Status(status).Cost(cost).Width(width).Height(height).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.CreateImageApiV1UserAgentImagePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateImageApiV1UserAgentImagePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.CreateImageApiV1UserAgentImagePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateImageApiV1UserAgentImagePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **imageUrl** | **string** |  | 
 **imageType** | **string** |  | [default to &quot;input&quot;]
 **agentId** | **string** |  | 
 **agentName** | **string** |  | 
 **prompt** | **string** |  | 
 **model** | **string** |  | 
 **taskId** | **string** |  | 
 **status** | **int32** |  | [default to 1]
 **cost** | **int32** |  | [default to 0]
 **width** | **int32** |  | [default to 0]
 **height** | **int32** |  | [default to 0]
 **size** | **int32** |  | [default to 0]

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


## DeleteImageApiV1UserAgentImageIidDelete

> interface{} DeleteImageApiV1UserAgentImageIidDelete(ctx, iid).Execute()

删除图片记录

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
	iid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.DeleteImageApiV1UserAgentImageIidDelete(context.Background(), iid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.DeleteImageApiV1UserAgentImageIidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteImageApiV1UserAgentImageIidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.DeleteImageApiV1UserAgentImageIidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**iid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteImageApiV1UserAgentImageIidDeleteRequest struct via the builder pattern


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


## DeleteImageApiV1UserAgentImageIidDelete_0

> interface{} DeleteImageApiV1UserAgentImageIidDelete_0(ctx, iid).Execute()

删除图片记录

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
	iid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.DeleteImageApiV1UserAgentImageIidDelete_0(context.Background(), iid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.DeleteImageApiV1UserAgentImageIidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteImageApiV1UserAgentImageIidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.DeleteImageApiV1UserAgentImageIidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**iid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteImageApiV1UserAgentImageIidDelete_2Request struct via the builder pattern


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


## GetImageApiV1UserAgentImageIidGet

> interface{} GetImageApiV1UserAgentImageIidGet(ctx, iid).Execute()

图片详情

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
	iid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.GetImageApiV1UserAgentImageIidGet(context.Background(), iid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.GetImageApiV1UserAgentImageIidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetImageApiV1UserAgentImageIidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.GetImageApiV1UserAgentImageIidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**iid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetImageApiV1UserAgentImageIidGetRequest struct via the builder pattern


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


## GetImageApiV1UserAgentImageIidGet_0

> interface{} GetImageApiV1UserAgentImageIidGet_0(ctx, iid).Execute()

图片详情

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
	iid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.GetImageApiV1UserAgentImageIidGet_0(context.Background(), iid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.GetImageApiV1UserAgentImageIidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetImageApiV1UserAgentImageIidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.GetImageApiV1UserAgentImageIidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**iid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetImageApiV1UserAgentImageIidGet_3Request struct via the builder pattern


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


## ListImagesApiV1UserAgentImageListGet

> interface{} ListImagesApiV1UserAgentImageListGet(ctx).Page(page).Limit(limit).ImageType(imageType).AgentId(agentId).Execute()

我的图片交互

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
	imageType := "imageType_example" // string |  (optional)
	agentId := "agentId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.ListImagesApiV1UserAgentImageListGet(context.Background()).Page(page).Limit(limit).ImageType(imageType).AgentId(agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.ListImagesApiV1UserAgentImageListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListImagesApiV1UserAgentImageListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.ListImagesApiV1UserAgentImageListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListImagesApiV1UserAgentImageListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **imageType** | **string** |  | 
 **agentId** | **string** |  | 

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


## ListImagesApiV1UserAgentImageListGet_0

> interface{} ListImagesApiV1UserAgentImageListGet_0(ctx).Page(page).Limit(limit).ImageType(imageType).AgentId(agentId).Execute()

我的图片交互

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
	imageType := "imageType_example" // string |  (optional)
	agentId := "agentId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.UserAgentImageAPI.ListImagesApiV1UserAgentImageListGet_0(context.Background()).Page(page).Limit(limit).ImageType(imageType).AgentId(agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `UserAgentImageAPI.ListImagesApiV1UserAgentImageListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListImagesApiV1UserAgentImageListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `UserAgentImageAPI.ListImagesApiV1UserAgentImageListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListImagesApiV1UserAgentImageListGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **imageType** | **string** |  | 
 **agentId** | **string** |  | 

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

