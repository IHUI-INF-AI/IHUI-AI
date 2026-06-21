# \LiveAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddCommentApiV1LiveChannelCidCommentPost**](LiveAPI.md#AddCommentApiV1LiveChannelCidCommentPost) | **Post** /api/v1/live/channel/{cid}/comment | 发表评论
[**AddCommentApiV1LiveChannelCidCommentPost_0**](LiveAPI.md#AddCommentApiV1LiveChannelCidCommentPost_0) | **Post** /api/v1/live/channel/{cid}/comment | 发表评论
[**GetChannelApiV1LiveChannelCidGet**](LiveAPI.md#GetChannelApiV1LiveChannelCidGet) | **Get** /api/v1/live/channel/{cid} | 直播详情
[**GetChannelApiV1LiveChannelCidGet_0**](LiveAPI.md#GetChannelApiV1LiveChannelCidGet_0) | **Get** /api/v1/live/channel/{cid} | 直播详情
[**ListChannelsApiV1LiveChannelListGet**](LiveAPI.md#ListChannelsApiV1LiveChannelListGet) | **Get** /api/v1/live/channel/list | 直播列表
[**ListChannelsApiV1LiveChannelListGet_0**](LiveAPI.md#ListChannelsApiV1LiveChannelListGet_0) | **Get** /api/v1/live/channel/list | 直播列表
[**ListCommentsApiV1LiveChannelCidCommentsGet**](LiveAPI.md#ListCommentsApiV1LiveChannelCidCommentsGet) | **Get** /api/v1/live/channel/{cid}/comments | 评论列表
[**ListCommentsApiV1LiveChannelCidCommentsGet_0**](LiveAPI.md#ListCommentsApiV1LiveChannelCidCommentsGet_0) | **Get** /api/v1/live/channel/{cid}/comments | 评论列表
[**LiveChannelCategoryList**](LiveAPI.md#LiveChannelCategoryList) | **Get** /api/v1/live/category/list | 直播分类
[**LiveChannelCategoryList_0**](LiveAPI.md#LiveChannelCategoryList_0) | **Get** /api/v1/live/category/list | 直播分类
[**LiveCreateChannel**](LiveAPI.md#LiveCreateChannel) | **Post** /api/v1/live/channel | 创建直播
[**LiveCreateChannel_0**](LiveAPI.md#LiveCreateChannel_0) | **Post** /api/v1/live/channel | 创建直播
[**LiveDeleteChannel**](LiveAPI.md#LiveDeleteChannel) | **Delete** /api/v1/live/channel/{cid} | 删除直播
[**LiveDeleteChannel_0**](LiveAPI.md#LiveDeleteChannel_0) | **Delete** /api/v1/live/channel/{cid} | 删除直播
[**LiveUpdateChannel**](LiveAPI.md#LiveUpdateChannel) | **Put** /api/v1/live/channel/{cid} | 修改直播
[**LiveUpdateChannel_0**](LiveAPI.md#LiveUpdateChannel_0) | **Put** /api/v1/live/channel/{cid} | 修改直播
[**StartLiveApiV1LiveChannelCidStartPost**](LiveAPI.md#StartLiveApiV1LiveChannelCidStartPost) | **Post** /api/v1/live/channel/{cid}/start | 开始直播
[**StartLiveApiV1LiveChannelCidStartPost_0**](LiveAPI.md#StartLiveApiV1LiveChannelCidStartPost_0) | **Post** /api/v1/live/channel/{cid}/start | 开始直播
[**StopLiveApiV1LiveChannelCidStopPost**](LiveAPI.md#StopLiveApiV1LiveChannelCidStopPost) | **Post** /api/v1/live/channel/{cid}/stop | 结束直播
[**StopLiveApiV1LiveChannelCidStopPost_0**](LiveAPI.md#StopLiveApiV1LiveChannelCidStopPost_0) | **Post** /api/v1/live/channel/{cid}/stop | 结束直播
[**ToggleSubscribeApiV1LiveChannelCidSubscribePost**](LiveAPI.md#ToggleSubscribeApiV1LiveChannelCidSubscribePost) | **Post** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅
[**ToggleSubscribeApiV1LiveChannelCidSubscribePost_0**](LiveAPI.md#ToggleSubscribeApiV1LiveChannelCidSubscribePost_0) | **Post** /api/v1/live/channel/{cid}/subscribe | 订阅/取消订阅



## AddCommentApiV1LiveChannelCidCommentPost

> interface{} AddCommentApiV1LiveChannelCidCommentPost(ctx, cid).Content(content).Type_(type_).Execute()

发表评论

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
	cid := int32(56) // int32 | 
	content := "content_example" // string | 
	type_ := int32(56) // int32 |  (optional) (default to 1)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.AddCommentApiV1LiveChannelCidCommentPost(context.Background(), cid).Content(content).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.AddCommentApiV1LiveChannelCidCommentPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCommentApiV1LiveChannelCidCommentPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.AddCommentApiV1LiveChannelCidCommentPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAddCommentApiV1LiveChannelCidCommentPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **content** | **string** |  | 
 **type_** | **int32** |  | [default to 1]

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


## AddCommentApiV1LiveChannelCidCommentPost_0

> interface{} AddCommentApiV1LiveChannelCidCommentPost_0(ctx, cid).Content(content).Type_(type_).Execute()

发表评论

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
	cid := int32(56) // int32 | 
	content := "content_example" // string | 
	type_ := int32(56) // int32 |  (optional) (default to 1)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.AddCommentApiV1LiveChannelCidCommentPost_0(context.Background(), cid).Content(content).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.AddCommentApiV1LiveChannelCidCommentPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddCommentApiV1LiveChannelCidCommentPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.AddCommentApiV1LiveChannelCidCommentPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAddCommentApiV1LiveChannelCidCommentPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **content** | **string** |  | 
 **type_** | **int32** |  | [default to 1]

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


## GetChannelApiV1LiveChannelCidGet

> interface{} GetChannelApiV1LiveChannelCidGet(ctx, cid).Execute()

直播详情

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.GetChannelApiV1LiveChannelCidGet(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.GetChannelApiV1LiveChannelCidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetChannelApiV1LiveChannelCidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.GetChannelApiV1LiveChannelCidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetChannelApiV1LiveChannelCidGetRequest struct via the builder pattern


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


## GetChannelApiV1LiveChannelCidGet_0

> interface{} GetChannelApiV1LiveChannelCidGet_0(ctx, cid).Execute()

直播详情

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.GetChannelApiV1LiveChannelCidGet_0(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.GetChannelApiV1LiveChannelCidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetChannelApiV1LiveChannelCidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.GetChannelApiV1LiveChannelCidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetChannelApiV1LiveChannelCidGet_2Request struct via the builder pattern


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


## ListChannelsApiV1LiveChannelListGet

> interface{} ListChannelsApiV1LiveChannelListGet(ctx).Page(page).Limit(limit).Status(status).CategoryId(categoryId).HostId(hostId).Keyword(keyword).Execute()

直播列表

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
	status := int32(56) // int32 |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	hostId := "hostId_example" // string |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.ListChannelsApiV1LiveChannelListGet(context.Background()).Page(page).Limit(limit).Status(status).CategoryId(categoryId).HostId(hostId).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.ListChannelsApiV1LiveChannelListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListChannelsApiV1LiveChannelListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.ListChannelsApiV1LiveChannelListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListChannelsApiV1LiveChannelListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **categoryId** | **int32** |  | 
 **hostId** | **string** |  | 
 **keyword** | **string** |  | 

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


## ListChannelsApiV1LiveChannelListGet_0

> interface{} ListChannelsApiV1LiveChannelListGet_0(ctx).Page(page).Limit(limit).Status(status).CategoryId(categoryId).HostId(hostId).Keyword(keyword).Execute()

直播列表

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
	status := int32(56) // int32 |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	hostId := "hostId_example" // string |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.ListChannelsApiV1LiveChannelListGet_0(context.Background()).Page(page).Limit(limit).Status(status).CategoryId(categoryId).HostId(hostId).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.ListChannelsApiV1LiveChannelListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListChannelsApiV1LiveChannelListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.ListChannelsApiV1LiveChannelListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListChannelsApiV1LiveChannelListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **categoryId** | **int32** |  | 
 **hostId** | **string** |  | 
 **keyword** | **string** |  | 

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


## ListCommentsApiV1LiveChannelCidCommentsGet

> interface{} ListCommentsApiV1LiveChannelCidCommentsGet(ctx, cid).Page(page).Limit(limit).Execute()

评论列表

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
	cid := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.ListCommentsApiV1LiveChannelCidCommentsGet(context.Background(), cid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.ListCommentsApiV1LiveChannelCidCommentsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommentsApiV1LiveChannelCidCommentsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.ListCommentsApiV1LiveChannelCidCommentsGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListCommentsApiV1LiveChannelCidCommentsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 50]

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


## ListCommentsApiV1LiveChannelCidCommentsGet_0

> interface{} ListCommentsApiV1LiveChannelCidCommentsGet_0(ctx, cid).Page(page).Limit(limit).Execute()

评论列表

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
	cid := int32(56) // int32 | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.ListCommentsApiV1LiveChannelCidCommentsGet_0(context.Background(), cid).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.ListCommentsApiV1LiveChannelCidCommentsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListCommentsApiV1LiveChannelCidCommentsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.ListCommentsApiV1LiveChannelCidCommentsGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListCommentsApiV1LiveChannelCidCommentsGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 50]

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


## LiveChannelCategoryList

> interface{} LiveChannelCategoryList(ctx).Execute()

直播分类

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveChannelCategoryList(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveChannelCategoryList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveChannelCategoryList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveChannelCategoryList`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiLiveChannelCategoryListRequest struct via the builder pattern


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


## LiveChannelCategoryList_0

> interface{} LiveChannelCategoryList_0(ctx).Execute()

直播分类

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveChannelCategoryList_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveChannelCategoryList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveChannelCategoryList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveChannelCategoryList_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiLiveChannelCategoryList_5Request struct via the builder pattern


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


## LiveCreateChannel

> interface{} LiveCreateChannel(ctx).Title(title).Description(description).Cover(cover).CategoryId(categoryId).Type_(type_).Price(price).PlanStartTime(planStartTime).PlanDuration(planDuration).Execute()

创建直播

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	description := "description_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	type_ := int32(56) // int32 |  (optional) (default to 1)
	price := int32(56) // int32 |  (optional) (default to 0)
	planStartTime := time.Now() // time.Time |  (optional)
	planDuration := int32(56) // int32 |  (optional) (default to 60)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveCreateChannel(context.Background()).Title(title).Description(description).Cover(cover).CategoryId(categoryId).Type_(type_).Price(price).PlanStartTime(planStartTime).PlanDuration(planDuration).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveCreateChannel``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveCreateChannel`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveCreateChannel`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLiveCreateChannelRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **description** | **string** |  | 
 **cover** | **string** |  | 
 **categoryId** | **int32** |  | 
 **type_** | **int32** |  | [default to 1]
 **price** | **int32** |  | [default to 0]
 **planStartTime** | **time.Time** |  | 
 **planDuration** | **int32** |  | [default to 60]

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


## LiveCreateChannel_0

> interface{} LiveCreateChannel_0(ctx).Title(title).Description(description).Cover(cover).CategoryId(categoryId).Type_(type_).Price(price).PlanStartTime(planStartTime).PlanDuration(planDuration).Execute()

创建直播

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	title := "title_example" // string | 
	description := "description_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)
	categoryId := int32(56) // int32 |  (optional)
	type_ := int32(56) // int32 |  (optional) (default to 1)
	price := int32(56) // int32 |  (optional) (default to 0)
	planStartTime := time.Now() // time.Time |  (optional)
	planDuration := int32(56) // int32 |  (optional) (default to 60)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveCreateChannel_0(context.Background()).Title(title).Description(description).Cover(cover).CategoryId(categoryId).Type_(type_).Price(price).PlanStartTime(planStartTime).PlanDuration(planDuration).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveCreateChannel_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveCreateChannel_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveCreateChannel_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLiveCreateChannel_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **description** | **string** |  | 
 **cover** | **string** |  | 
 **categoryId** | **int32** |  | 
 **type_** | **int32** |  | [default to 1]
 **price** | **int32** |  | [default to 0]
 **planStartTime** | **time.Time** |  | 
 **planDuration** | **int32** |  | [default to 60]

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


## LiveDeleteChannel

> interface{} LiveDeleteChannel(ctx, cid).Execute()

删除直播

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveDeleteChannel(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveDeleteChannel``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveDeleteChannel`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveDeleteChannel`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLiveDeleteChannelRequest struct via the builder pattern


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


## LiveDeleteChannel_0

> interface{} LiveDeleteChannel_0(ctx, cid).Execute()

删除直播

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveDeleteChannel_0(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveDeleteChannel_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveDeleteChannel_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveDeleteChannel_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLiveDeleteChannel_7Request struct via the builder pattern


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


## LiveUpdateChannel

> interface{} LiveUpdateChannel(ctx, cid).Title(title).Description(description).Cover(cover).PlanStartTime(planStartTime).Execute()

修改直播

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	cid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)
	planStartTime := time.Now() // time.Time |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveUpdateChannel(context.Background(), cid).Title(title).Description(description).Cover(cover).PlanStartTime(planStartTime).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveUpdateChannel``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveUpdateChannel`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveUpdateChannel`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLiveUpdateChannelRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **cover** | **string** |  | 
 **planStartTime** | **time.Time** |  | 

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


## LiveUpdateChannel_0

> interface{} LiveUpdateChannel_0(ctx, cid).Title(title).Description(description).Cover(cover).PlanStartTime(planStartTime).Execute()

修改直播

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
    "time"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	cid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)
	planStartTime := time.Now() // time.Time |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.LiveUpdateChannel_0(context.Background(), cid).Title(title).Description(description).Cover(cover).PlanStartTime(planStartTime).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.LiveUpdateChannel_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LiveUpdateChannel_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.LiveUpdateChannel_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLiveUpdateChannel_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **description** | **string** |  | 
 **cover** | **string** |  | 
 **planStartTime** | **time.Time** |  | 

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


## StartLiveApiV1LiveChannelCidStartPost

> interface{} StartLiveApiV1LiveChannelCidStartPost(ctx, cid).Execute()

开始直播

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.StartLiveApiV1LiveChannelCidStartPost(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.StartLiveApiV1LiveChannelCidStartPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StartLiveApiV1LiveChannelCidStartPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.StartLiveApiV1LiveChannelCidStartPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiStartLiveApiV1LiveChannelCidStartPostRequest struct via the builder pattern


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


## StartLiveApiV1LiveChannelCidStartPost_0

> interface{} StartLiveApiV1LiveChannelCidStartPost_0(ctx, cid).Execute()

开始直播

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.StartLiveApiV1LiveChannelCidStartPost_0(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.StartLiveApiV1LiveChannelCidStartPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StartLiveApiV1LiveChannelCidStartPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.StartLiveApiV1LiveChannelCidStartPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiStartLiveApiV1LiveChannelCidStartPost_9Request struct via the builder pattern


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


## StopLiveApiV1LiveChannelCidStopPost

> interface{} StopLiveApiV1LiveChannelCidStopPost(ctx, cid).Execute()

结束直播

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.StopLiveApiV1LiveChannelCidStopPost(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.StopLiveApiV1LiveChannelCidStopPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StopLiveApiV1LiveChannelCidStopPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.StopLiveApiV1LiveChannelCidStopPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiStopLiveApiV1LiveChannelCidStopPostRequest struct via the builder pattern


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


## StopLiveApiV1LiveChannelCidStopPost_0

> interface{} StopLiveApiV1LiveChannelCidStopPost_0(ctx, cid).Execute()

结束直播

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.StopLiveApiV1LiveChannelCidStopPost_0(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.StopLiveApiV1LiveChannelCidStopPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StopLiveApiV1LiveChannelCidStopPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.StopLiveApiV1LiveChannelCidStopPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiStopLiveApiV1LiveChannelCidStopPost_10Request struct via the builder pattern


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


## ToggleSubscribeApiV1LiveChannelCidSubscribePost

> interface{} ToggleSubscribeApiV1LiveChannelCidSubscribePost(ctx, cid).Execute()

订阅/取消订阅

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.ToggleSubscribeApiV1LiveChannelCidSubscribePost(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.ToggleSubscribeApiV1LiveChannelCidSubscribePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ToggleSubscribeApiV1LiveChannelCidSubscribePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.ToggleSubscribeApiV1LiveChannelCidSubscribePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiToggleSubscribeApiV1LiveChannelCidSubscribePostRequest struct via the builder pattern


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


## ToggleSubscribeApiV1LiveChannelCidSubscribePost_0

> interface{} ToggleSubscribeApiV1LiveChannelCidSubscribePost_0(ctx, cid).Execute()

订阅/取消订阅

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
	cid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LiveAPI.ToggleSubscribeApiV1LiveChannelCidSubscribePost_0(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LiveAPI.ToggleSubscribeApiV1LiveChannelCidSubscribePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ToggleSubscribeApiV1LiveChannelCidSubscribePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LiveAPI.ToggleSubscribeApiV1LiveChannelCidSubscribePost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiToggleSubscribeApiV1LiveChannelCidSubscribePost_11Request struct via the builder pattern


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

