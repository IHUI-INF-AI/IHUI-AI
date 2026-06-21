# \FeedbackAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeleteFeedbackApiV1FeedbackFidDelete**](FeedbackAPI.md#DeleteFeedbackApiV1FeedbackFidDelete) | **Delete** /api/v1/feedback/{fid} | 删除反馈
[**DeleteFeedbackApiV1FeedbackFidDelete_0**](FeedbackAPI.md#DeleteFeedbackApiV1FeedbackFidDelete_0) | **Delete** /api/v1/feedback/{fid} | 删除反馈
[**FeedbackAdminList**](FeedbackAPI.md#FeedbackAdminList) | **Get** /api/v1/feedback/admin/list | 反馈列表(管理员)
[**FeedbackAdminList_0**](FeedbackAPI.md#FeedbackAdminList_0) | **Get** /api/v1/feedback/admin/list | 反馈列表(管理员)
[**GetFeedbackApiV1FeedbackFidGet**](FeedbackAPI.md#GetFeedbackApiV1FeedbackFidGet) | **Get** /api/v1/feedback/{fid} | 反馈详情
[**GetFeedbackApiV1FeedbackFidGet_0**](FeedbackAPI.md#GetFeedbackApiV1FeedbackFidGet_0) | **Get** /api/v1/feedback/{fid} | 反馈详情
[**HandleFeedbackApiV1FeedbackFidHandlePut**](FeedbackAPI.md#HandleFeedbackApiV1FeedbackFidHandlePut) | **Put** /api/v1/feedback/{fid}/handle | 处理反馈
[**HandleFeedbackApiV1FeedbackFidHandlePut_0**](FeedbackAPI.md#HandleFeedbackApiV1FeedbackFidHandlePut_0) | **Put** /api/v1/feedback/{fid}/handle | 处理反馈
[**ListMyFeedbacksApiV1FeedbackListGet**](FeedbackAPI.md#ListMyFeedbacksApiV1FeedbackListGet) | **Get** /api/v1/feedback/list | 我的反馈
[**ListMyFeedbacksApiV1FeedbackListGet_0**](FeedbackAPI.md#ListMyFeedbacksApiV1FeedbackListGet_0) | **Get** /api/v1/feedback/list | 我的反馈
[**RateFeedbackApiV1FeedbackFidRatePost**](FeedbackAPI.md#RateFeedbackApiV1FeedbackFidRatePost) | **Post** /api/v1/feedback/{fid}/rate | 评价反馈
[**RateFeedbackApiV1FeedbackFidRatePost_0**](FeedbackAPI.md#RateFeedbackApiV1FeedbackFidRatePost_0) | **Post** /api/v1/feedback/{fid}/rate | 评价反馈
[**SubmitFeedbackApiV1FeedbackPost**](FeedbackAPI.md#SubmitFeedbackApiV1FeedbackPost) | **Post** /api/v1/feedback | 提交反馈
[**SubmitFeedbackApiV1FeedbackPost_0**](FeedbackAPI.md#SubmitFeedbackApiV1FeedbackPost_0) | **Post** /api/v1/feedback | 提交反馈



## DeleteFeedbackApiV1FeedbackFidDelete

> interface{} DeleteFeedbackApiV1FeedbackFidDelete(ctx, fid).Execute()

删除反馈

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
	fid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.DeleteFeedbackApiV1FeedbackFidDelete(context.Background(), fid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.DeleteFeedbackApiV1FeedbackFidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteFeedbackApiV1FeedbackFidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.DeleteFeedbackApiV1FeedbackFidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteFeedbackApiV1FeedbackFidDeleteRequest struct via the builder pattern


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


## DeleteFeedbackApiV1FeedbackFidDelete_0

> interface{} DeleteFeedbackApiV1FeedbackFidDelete_0(ctx, fid).Execute()

删除反馈

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
	fid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.DeleteFeedbackApiV1FeedbackFidDelete_0(context.Background(), fid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.DeleteFeedbackApiV1FeedbackFidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteFeedbackApiV1FeedbackFidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.DeleteFeedbackApiV1FeedbackFidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteFeedbackApiV1FeedbackFidDelete_1Request struct via the builder pattern


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


## FeedbackAdminList

> interface{} FeedbackAdminList(ctx).Page(page).Limit(limit).Status(status).Type_(type_).Priority(priority).Execute()

反馈列表(管理员)

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
	type_ := "type__example" // string |  (optional)
	priority := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.FeedbackAdminList(context.Background()).Page(page).Limit(limit).Status(status).Type_(type_).Priority(priority).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.FeedbackAdminList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FeedbackAdminList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.FeedbackAdminList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFeedbackAdminListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **type_** | **string** |  | 
 **priority** | **int32** |  | 

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


## FeedbackAdminList_0

> interface{} FeedbackAdminList_0(ctx).Page(page).Limit(limit).Status(status).Type_(type_).Priority(priority).Execute()

反馈列表(管理员)

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
	type_ := "type__example" // string |  (optional)
	priority := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.FeedbackAdminList_0(context.Background()).Page(page).Limit(limit).Status(status).Type_(type_).Priority(priority).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.FeedbackAdminList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FeedbackAdminList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.FeedbackAdminList_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFeedbackAdminList_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 
 **type_** | **string** |  | 
 **priority** | **int32** |  | 

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


## GetFeedbackApiV1FeedbackFidGet

> interface{} GetFeedbackApiV1FeedbackFidGet(ctx, fid).Execute()

反馈详情

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
	fid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.GetFeedbackApiV1FeedbackFidGet(context.Background(), fid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.GetFeedbackApiV1FeedbackFidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetFeedbackApiV1FeedbackFidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.GetFeedbackApiV1FeedbackFidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetFeedbackApiV1FeedbackFidGetRequest struct via the builder pattern


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


## GetFeedbackApiV1FeedbackFidGet_0

> interface{} GetFeedbackApiV1FeedbackFidGet_0(ctx, fid).Execute()

反馈详情

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
	fid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.GetFeedbackApiV1FeedbackFidGet_0(context.Background(), fid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.GetFeedbackApiV1FeedbackFidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetFeedbackApiV1FeedbackFidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.GetFeedbackApiV1FeedbackFidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetFeedbackApiV1FeedbackFidGet_3Request struct via the builder pattern


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


## HandleFeedbackApiV1FeedbackFidHandlePut

> interface{} HandleFeedbackApiV1FeedbackFidHandlePut(ctx, fid).Status(status).Remark(remark).Priority(priority).Reply(reply).Execute()

处理反馈

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
	fid := int32(56) // int32 | 
	status := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)
	priority := int32(56) // int32 |  (optional)
	reply := "reply_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.HandleFeedbackApiV1FeedbackFidHandlePut(context.Background(), fid).Status(status).Remark(remark).Priority(priority).Reply(reply).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.HandleFeedbackApiV1FeedbackFidHandlePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HandleFeedbackApiV1FeedbackFidHandlePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.HandleFeedbackApiV1FeedbackFidHandlePut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiHandleFeedbackApiV1FeedbackFidHandlePutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **status** | **int32** |  | 
 **remark** | **string** |  | 
 **priority** | **int32** |  | 
 **reply** | **string** |  | 

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


## HandleFeedbackApiV1FeedbackFidHandlePut_0

> interface{} HandleFeedbackApiV1FeedbackFidHandlePut_0(ctx, fid).Status(status).Remark(remark).Priority(priority).Reply(reply).Execute()

处理反馈

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
	fid := int32(56) // int32 | 
	status := int32(56) // int32 | 
	remark := "remark_example" // string |  (optional)
	priority := int32(56) // int32 |  (optional)
	reply := "reply_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.HandleFeedbackApiV1FeedbackFidHandlePut_0(context.Background(), fid).Status(status).Remark(remark).Priority(priority).Reply(reply).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.HandleFeedbackApiV1FeedbackFidHandlePut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HandleFeedbackApiV1FeedbackFidHandlePut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.HandleFeedbackApiV1FeedbackFidHandlePut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiHandleFeedbackApiV1FeedbackFidHandlePut_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **status** | **int32** |  | 
 **remark** | **string** |  | 
 **priority** | **int32** |  | 
 **reply** | **string** |  | 

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


## ListMyFeedbacksApiV1FeedbackListGet

> interface{} ListMyFeedbacksApiV1FeedbackListGet(ctx).Page(page).Limit(limit).Type_(type_).Status(status).Execute()

我的反馈

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
	type_ := "type__example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.ListMyFeedbacksApiV1FeedbackListGet(context.Background()).Page(page).Limit(limit).Type_(type_).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.ListMyFeedbacksApiV1FeedbackListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMyFeedbacksApiV1FeedbackListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.ListMyFeedbacksApiV1FeedbackListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMyFeedbacksApiV1FeedbackListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **status** | **int32** |  | 

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


## ListMyFeedbacksApiV1FeedbackListGet_0

> interface{} ListMyFeedbacksApiV1FeedbackListGet_0(ctx).Page(page).Limit(limit).Type_(type_).Status(status).Execute()

我的反馈

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
	type_ := "type__example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.ListMyFeedbacksApiV1FeedbackListGet_0(context.Background()).Page(page).Limit(limit).Type_(type_).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.ListMyFeedbacksApiV1FeedbackListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMyFeedbacksApiV1FeedbackListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.ListMyFeedbacksApiV1FeedbackListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMyFeedbacksApiV1FeedbackListGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **status** | **int32** |  | 

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


## RateFeedbackApiV1FeedbackFidRatePost

> interface{} RateFeedbackApiV1FeedbackFidRatePost(ctx, fid).Rating(rating).Execute()

评价反馈

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
	fid := int32(56) // int32 | 
	rating := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.RateFeedbackApiV1FeedbackFidRatePost(context.Background(), fid).Rating(rating).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.RateFeedbackApiV1FeedbackFidRatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RateFeedbackApiV1FeedbackFidRatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.RateFeedbackApiV1FeedbackFidRatePost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRateFeedbackApiV1FeedbackFidRatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **rating** | **int32** |  | 

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


## RateFeedbackApiV1FeedbackFidRatePost_0

> interface{} RateFeedbackApiV1FeedbackFidRatePost_0(ctx, fid).Rating(rating).Execute()

评价反馈

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
	fid := int32(56) // int32 | 
	rating := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.RateFeedbackApiV1FeedbackFidRatePost_0(context.Background(), fid).Rating(rating).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.RateFeedbackApiV1FeedbackFidRatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RateFeedbackApiV1FeedbackFidRatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.RateFeedbackApiV1FeedbackFidRatePost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**fid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRateFeedbackApiV1FeedbackFidRatePost_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **rating** | **int32** |  | 

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


## SubmitFeedbackApiV1FeedbackPost

> interface{} SubmitFeedbackApiV1FeedbackPost(ctx).Title(title).Content(content).Type_(type_).Images(images).Contact(contact).AppVersion(appVersion).DeviceInfo(deviceInfo).Execute()

提交反馈

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
	title := "title_example" // string | 
	content := "content_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "bug")
	images := "images_example" // string |  (optional)
	contact := "contact_example" // string |  (optional)
	appVersion := "appVersion_example" // string |  (optional)
	deviceInfo := "deviceInfo_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.SubmitFeedbackApiV1FeedbackPost(context.Background()).Title(title).Content(content).Type_(type_).Images(images).Contact(contact).AppVersion(appVersion).DeviceInfo(deviceInfo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.SubmitFeedbackApiV1FeedbackPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitFeedbackApiV1FeedbackPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.SubmitFeedbackApiV1FeedbackPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitFeedbackApiV1FeedbackPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **content** | **string** |  | 
 **type_** | **string** |  | [default to &quot;bug&quot;]
 **images** | **string** |  | 
 **contact** | **string** |  | 
 **appVersion** | **string** |  | 
 **deviceInfo** | **string** |  | 

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


## SubmitFeedbackApiV1FeedbackPost_0

> interface{} SubmitFeedbackApiV1FeedbackPost_0(ctx).Title(title).Content(content).Type_(type_).Images(images).Contact(contact).AppVersion(appVersion).DeviceInfo(deviceInfo).Execute()

提交反馈

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
	title := "title_example" // string | 
	content := "content_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "bug")
	images := "images_example" // string |  (optional)
	contact := "contact_example" // string |  (optional)
	appVersion := "appVersion_example" // string |  (optional)
	deviceInfo := "deviceInfo_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.FeedbackAPI.SubmitFeedbackApiV1FeedbackPost_0(context.Background()).Title(title).Content(content).Type_(type_).Images(images).Contact(contact).AppVersion(appVersion).DeviceInfo(deviceInfo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `FeedbackAPI.SubmitFeedbackApiV1FeedbackPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitFeedbackApiV1FeedbackPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `FeedbackAPI.SubmitFeedbackApiV1FeedbackPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitFeedbackApiV1FeedbackPost_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **content** | **string** |  | 
 **type_** | **string** |  | [default to &quot;bug&quot;]
 **images** | **string** |  | 
 **contact** | **string** |  | 
 **appVersion** | **string** |  | 
 **deviceInfo** | **string** |  | 

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

