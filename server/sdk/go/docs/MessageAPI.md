# \MessageAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BatchDeleteApiV1MessageBatchDeleteDelete**](MessageAPI.md#BatchDeleteApiV1MessageBatchDeleteDelete) | **Delete** /api/v1/message/batch-delete | 批量删除
[**BatchDeleteApiV1MessageBatchDeleteDelete_0**](MessageAPI.md#BatchDeleteApiV1MessageBatchDeleteDelete_0) | **Delete** /api/v1/message/batch-delete | 批量删除
[**CreateAnnouncementApiV1MessageAnnouncementPost**](MessageAPI.md#CreateAnnouncementApiV1MessageAnnouncementPost) | **Post** /api/v1/message/announcement | 发布公告
[**CreateAnnouncementApiV1MessageAnnouncementPost_0**](MessageAPI.md#CreateAnnouncementApiV1MessageAnnouncementPost_0) | **Post** /api/v1/message/announcement | 发布公告
[**CreateTemplateApiV1MessageTemplatePost**](MessageAPI.md#CreateTemplateApiV1MessageTemplatePost) | **Post** /api/v1/message/template | 新增模板
[**CreateTemplateApiV1MessageTemplatePost_0**](MessageAPI.md#CreateTemplateApiV1MessageTemplatePost_0) | **Post** /api/v1/message/template | 新增模板
[**DeleteAnnouncementApiV1MessageAnnouncementAidDelete**](MessageAPI.md#DeleteAnnouncementApiV1MessageAnnouncementAidDelete) | **Delete** /api/v1/message/announcement/{aid} | 删除公告
[**DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0**](MessageAPI.md#DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0) | **Delete** /api/v1/message/announcement/{aid} | 删除公告
[**DeleteMessageApiV1MessageMidDelete**](MessageAPI.md#DeleteMessageApiV1MessageMidDelete) | **Delete** /api/v1/message/{mid} | 删除消息
[**DeleteMessageApiV1MessageMidDelete_0**](MessageAPI.md#DeleteMessageApiV1MessageMidDelete_0) | **Delete** /api/v1/message/{mid} | 删除消息
[**GetAnnouncementApiV1MessageAnnouncementAidGet**](MessageAPI.md#GetAnnouncementApiV1MessageAnnouncementAidGet) | **Get** /api/v1/message/announcement/{aid} | 公告详情
[**GetAnnouncementApiV1MessageAnnouncementAidGet_0**](MessageAPI.md#GetAnnouncementApiV1MessageAnnouncementAidGet_0) | **Get** /api/v1/message/announcement/{aid} | 公告详情
[**ListAnnouncementsApiV1MessageAnnouncementListGet**](MessageAPI.md#ListAnnouncementsApiV1MessageAnnouncementListGet) | **Get** /api/v1/message/announcement/list | 公告列表
[**ListAnnouncementsApiV1MessageAnnouncementListGet_0**](MessageAPI.md#ListAnnouncementsApiV1MessageAnnouncementListGet_0) | **Get** /api/v1/message/announcement/list | 公告列表
[**ListMessagesApiV1MessageListGet**](MessageAPI.md#ListMessagesApiV1MessageListGet) | **Get** /api/v1/message/list | 我的消息列表
[**ListMessagesApiV1MessageListGet_0**](MessageAPI.md#ListMessagesApiV1MessageListGet_0) | **Get** /api/v1/message/list | 我的消息列表
[**MarkReadApiV1MessageMidReadPost**](MessageAPI.md#MarkReadApiV1MessageMidReadPost) | **Post** /api/v1/message/{mid}/read | 标记已读
[**MarkReadApiV1MessageMidReadPost_0**](MessageAPI.md#MarkReadApiV1MessageMidReadPost_0) | **Post** /api/v1/message/{mid}/read | 标记已读
[**MessageMarkAllRead**](MessageAPI.md#MessageMarkAllRead) | **Post** /api/v1/message/read-all | 全部标记已读
[**MessageMarkAllRead_0**](MessageAPI.md#MessageMarkAllRead_0) | **Post** /api/v1/message/read-all | 全部标记已读
[**MessageUnreadCount**](MessageAPI.md#MessageUnreadCount) | **Get** /api/v1/message/unread-count | 未读消息数
[**MessageUnreadCount_0**](MessageAPI.md#MessageUnreadCount_0) | **Get** /api/v1/message/unread-count | 未读消息数
[**SendPrivateApiV1MessagePrivatePost**](MessageAPI.md#SendPrivateApiV1MessagePrivatePost) | **Post** /api/v1/message/private | 发送私信
[**SendPrivateApiV1MessagePrivatePost_0**](MessageAPI.md#SendPrivateApiV1MessagePrivatePost_0) | **Post** /api/v1/message/private | 发送私信
[**TemplateListApiV1MessageTemplateListGet**](MessageAPI.md#TemplateListApiV1MessageTemplateListGet) | **Get** /api/v1/message/template/list | 消息模板列表
[**TemplateListApiV1MessageTemplateListGet_0**](MessageAPI.md#TemplateListApiV1MessageTemplateListGet_0) | **Get** /api/v1/message/template/list | 消息模板列表
[**UpdateAnnouncementApiV1MessageAnnouncementAidPut**](MessageAPI.md#UpdateAnnouncementApiV1MessageAnnouncementAidPut) | **Put** /api/v1/message/announcement/{aid} | 修改公告
[**UpdateAnnouncementApiV1MessageAnnouncementAidPut_0**](MessageAPI.md#UpdateAnnouncementApiV1MessageAnnouncementAidPut_0) | **Put** /api/v1/message/announcement/{aid} | 修改公告



## BatchDeleteApiV1MessageBatchDeleteDelete

> interface{} BatchDeleteApiV1MessageBatchDeleteDelete(ctx).Ids(ids).Execute()

批量删除

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
	ids := "ids_example" // string | ID列表,逗号分隔

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.BatchDeleteApiV1MessageBatchDeleteDelete(context.Background()).Ids(ids).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.BatchDeleteApiV1MessageBatchDeleteDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BatchDeleteApiV1MessageBatchDeleteDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.BatchDeleteApiV1MessageBatchDeleteDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBatchDeleteApiV1MessageBatchDeleteDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ids** | **string** | ID列表,逗号分隔 | 

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


## BatchDeleteApiV1MessageBatchDeleteDelete_0

> interface{} BatchDeleteApiV1MessageBatchDeleteDelete_0(ctx).Ids(ids).Execute()

批量删除

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
	ids := "ids_example" // string | ID列表,逗号分隔

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.BatchDeleteApiV1MessageBatchDeleteDelete_0(context.Background()).Ids(ids).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.BatchDeleteApiV1MessageBatchDeleteDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BatchDeleteApiV1MessageBatchDeleteDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.BatchDeleteApiV1MessageBatchDeleteDelete_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBatchDeleteApiV1MessageBatchDeleteDelete_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ids** | **string** | ID列表,逗号分隔 | 

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


## CreateAnnouncementApiV1MessageAnnouncementPost

> interface{} CreateAnnouncementApiV1MessageAnnouncementPost(ctx).Title(title).Content(content).Cover(cover).Type_(type_).Priority(priority).TargetUser(targetUser).TargetUrl(targetUrl).PublishTime(publishTime).ExpireTime(expireTime).Execute()

发布公告

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
	content := "content_example" // string | 
	cover := "cover_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional) (default to 1)
	priority := int32(56) // int32 |  (optional) (default to 1)
	targetUser := "targetUser_example" // string |  (optional) (default to "all")
	targetUrl := "targetUrl_example" // string |  (optional)
	publishTime := time.Now() // time.Time |  (optional)
	expireTime := time.Now() // time.Time |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.CreateAnnouncementApiV1MessageAnnouncementPost(context.Background()).Title(title).Content(content).Cover(cover).Type_(type_).Priority(priority).TargetUser(targetUser).TargetUrl(targetUrl).PublishTime(publishTime).ExpireTime(expireTime).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.CreateAnnouncementApiV1MessageAnnouncementPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAnnouncementApiV1MessageAnnouncementPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.CreateAnnouncementApiV1MessageAnnouncementPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAnnouncementApiV1MessageAnnouncementPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **content** | **string** |  | 
 **cover** | **string** |  | 
 **type_** | **int32** |  | [default to 1]
 **priority** | **int32** |  | [default to 1]
 **targetUser** | **string** |  | [default to &quot;all&quot;]
 **targetUrl** | **string** |  | 
 **publishTime** | **time.Time** |  | 
 **expireTime** | **time.Time** |  | 

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


## CreateAnnouncementApiV1MessageAnnouncementPost_0

> interface{} CreateAnnouncementApiV1MessageAnnouncementPost_0(ctx).Title(title).Content(content).Cover(cover).Type_(type_).Priority(priority).TargetUser(targetUser).TargetUrl(targetUrl).PublishTime(publishTime).ExpireTime(expireTime).Execute()

发布公告

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
	content := "content_example" // string | 
	cover := "cover_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional) (default to 1)
	priority := int32(56) // int32 |  (optional) (default to 1)
	targetUser := "targetUser_example" // string |  (optional) (default to "all")
	targetUrl := "targetUrl_example" // string |  (optional)
	publishTime := time.Now() // time.Time |  (optional)
	expireTime := time.Now() // time.Time |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.CreateAnnouncementApiV1MessageAnnouncementPost_0(context.Background()).Title(title).Content(content).Cover(cover).Type_(type_).Priority(priority).TargetUser(targetUser).TargetUrl(targetUrl).PublishTime(publishTime).ExpireTime(expireTime).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.CreateAnnouncementApiV1MessageAnnouncementPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateAnnouncementApiV1MessageAnnouncementPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.CreateAnnouncementApiV1MessageAnnouncementPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateAnnouncementApiV1MessageAnnouncementPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **content** | **string** |  | 
 **cover** | **string** |  | 
 **type_** | **int32** |  | [default to 1]
 **priority** | **int32** |  | [default to 1]
 **targetUser** | **string** |  | [default to &quot;all&quot;]
 **targetUrl** | **string** |  | 
 **publishTime** | **time.Time** |  | 
 **expireTime** | **time.Time** |  | 

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


## CreateTemplateApiV1MessageTemplatePost

> interface{} CreateTemplateApiV1MessageTemplatePost(ctx).Code(code).Name(name).Type_(type_).Content(content).Subject(subject).Variables(variables).Execute()

新增模板

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
	code := "code_example" // string | 
	name := "name_example" // string | 
	type_ := "type__example" // string | 
	content := "content_example" // string | 
	subject := "subject_example" // string |  (optional)
	variables := "variables_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.CreateTemplateApiV1MessageTemplatePost(context.Background()).Code(code).Name(name).Type_(type_).Content(content).Subject(subject).Variables(variables).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.CreateTemplateApiV1MessageTemplatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateTemplateApiV1MessageTemplatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.CreateTemplateApiV1MessageTemplatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateTemplateApiV1MessageTemplatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **name** | **string** |  | 
 **type_** | **string** |  | 
 **content** | **string** |  | 
 **subject** | **string** |  | 
 **variables** | **string** |  | 

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


## CreateTemplateApiV1MessageTemplatePost_0

> interface{} CreateTemplateApiV1MessageTemplatePost_0(ctx).Code(code).Name(name).Type_(type_).Content(content).Subject(subject).Variables(variables).Execute()

新增模板

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
	code := "code_example" // string | 
	name := "name_example" // string | 
	type_ := "type__example" // string | 
	content := "content_example" // string | 
	subject := "subject_example" // string |  (optional)
	variables := "variables_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.CreateTemplateApiV1MessageTemplatePost_0(context.Background()).Code(code).Name(name).Type_(type_).Content(content).Subject(subject).Variables(variables).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.CreateTemplateApiV1MessageTemplatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateTemplateApiV1MessageTemplatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.CreateTemplateApiV1MessageTemplatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateTemplateApiV1MessageTemplatePost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **name** | **string** |  | 
 **type_** | **string** |  | 
 **content** | **string** |  | 
 **subject** | **string** |  | 
 **variables** | **string** |  | 

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


## DeleteAnnouncementApiV1MessageAnnouncementAidDelete

> interface{} DeleteAnnouncementApiV1MessageAnnouncementAidDelete(ctx, aid).Execute()

删除公告

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.DeleteAnnouncementApiV1MessageAnnouncementAidDelete(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.DeleteAnnouncementApiV1MessageAnnouncementAidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteAnnouncementApiV1MessageAnnouncementAidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.DeleteAnnouncementApiV1MessageAnnouncementAidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteAnnouncementApiV1MessageAnnouncementAidDeleteRequest struct via the builder pattern


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


## DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0

> interface{} DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0(ctx, aid).Execute()

删除公告

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.DeleteAnnouncementApiV1MessageAnnouncementAidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteAnnouncementApiV1MessageAnnouncementAidDelete_4Request struct via the builder pattern


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


## DeleteMessageApiV1MessageMidDelete

> interface{} DeleteMessageApiV1MessageMidDelete(ctx, mid).Execute()

删除消息

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
	mid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.DeleteMessageApiV1MessageMidDelete(context.Background(), mid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.DeleteMessageApiV1MessageMidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteMessageApiV1MessageMidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.DeleteMessageApiV1MessageMidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**mid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteMessageApiV1MessageMidDeleteRequest struct via the builder pattern


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


## DeleteMessageApiV1MessageMidDelete_0

> interface{} DeleteMessageApiV1MessageMidDelete_0(ctx, mid).Execute()

删除消息

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
	mid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.DeleteMessageApiV1MessageMidDelete_0(context.Background(), mid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.DeleteMessageApiV1MessageMidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteMessageApiV1MessageMidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.DeleteMessageApiV1MessageMidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**mid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteMessageApiV1MessageMidDelete_5Request struct via the builder pattern


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


## GetAnnouncementApiV1MessageAnnouncementAidGet

> interface{} GetAnnouncementApiV1MessageAnnouncementAidGet(ctx, aid).Execute()

公告详情

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.GetAnnouncementApiV1MessageAnnouncementAidGet(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.GetAnnouncementApiV1MessageAnnouncementAidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAnnouncementApiV1MessageAnnouncementAidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.GetAnnouncementApiV1MessageAnnouncementAidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAnnouncementApiV1MessageAnnouncementAidGetRequest struct via the builder pattern


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


## GetAnnouncementApiV1MessageAnnouncementAidGet_0

> interface{} GetAnnouncementApiV1MessageAnnouncementAidGet_0(ctx, aid).Execute()

公告详情

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
	aid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.GetAnnouncementApiV1MessageAnnouncementAidGet_0(context.Background(), aid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.GetAnnouncementApiV1MessageAnnouncementAidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAnnouncementApiV1MessageAnnouncementAidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.GetAnnouncementApiV1MessageAnnouncementAidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetAnnouncementApiV1MessageAnnouncementAidGet_6Request struct via the builder pattern


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


## ListAnnouncementsApiV1MessageAnnouncementListGet

> interface{} ListAnnouncementsApiV1MessageAnnouncementListGet(ctx).Page(page).Limit(limit).Type_(type_).Execute()

公告列表

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
	type_ := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.ListAnnouncementsApiV1MessageAnnouncementListGet(context.Background()).Page(page).Limit(limit).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.ListAnnouncementsApiV1MessageAnnouncementListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAnnouncementsApiV1MessageAnnouncementListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.ListAnnouncementsApiV1MessageAnnouncementListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAnnouncementsApiV1MessageAnnouncementListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **int32** |  | 

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


## ListAnnouncementsApiV1MessageAnnouncementListGet_0

> interface{} ListAnnouncementsApiV1MessageAnnouncementListGet_0(ctx).Page(page).Limit(limit).Type_(type_).Execute()

公告列表

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
	type_ := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.ListAnnouncementsApiV1MessageAnnouncementListGet_0(context.Background()).Page(page).Limit(limit).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.ListAnnouncementsApiV1MessageAnnouncementListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAnnouncementsApiV1MessageAnnouncementListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.ListAnnouncementsApiV1MessageAnnouncementListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAnnouncementsApiV1MessageAnnouncementListGet_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **int32** |  | 

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


## ListMessagesApiV1MessageListGet

> interface{} ListMessagesApiV1MessageListGet(ctx).Page(page).Limit(limit).Type_(type_).IsRead(isRead).Execute()

我的消息列表

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
	isRead := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.ListMessagesApiV1MessageListGet(context.Background()).Page(page).Limit(limit).Type_(type_).IsRead(isRead).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.ListMessagesApiV1MessageListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMessagesApiV1MessageListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.ListMessagesApiV1MessageListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMessagesApiV1MessageListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **isRead** | **bool** |  | 

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


## ListMessagesApiV1MessageListGet_0

> interface{} ListMessagesApiV1MessageListGet_0(ctx).Page(page).Limit(limit).Type_(type_).IsRead(isRead).Execute()

我的消息列表

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
	isRead := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.ListMessagesApiV1MessageListGet_0(context.Background()).Page(page).Limit(limit).Type_(type_).IsRead(isRead).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.ListMessagesApiV1MessageListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListMessagesApiV1MessageListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.ListMessagesApiV1MessageListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListMessagesApiV1MessageListGet_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **isRead** | **bool** |  | 

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


## MarkReadApiV1MessageMidReadPost

> interface{} MarkReadApiV1MessageMidReadPost(ctx, mid).Execute()

标记已读

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
	mid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.MarkReadApiV1MessageMidReadPost(context.Background(), mid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.MarkReadApiV1MessageMidReadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkReadApiV1MessageMidReadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.MarkReadApiV1MessageMidReadPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**mid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkReadApiV1MessageMidReadPostRequest struct via the builder pattern


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


## MarkReadApiV1MessageMidReadPost_0

> interface{} MarkReadApiV1MessageMidReadPost_0(ctx, mid).Execute()

标记已读

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
	mid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.MarkReadApiV1MessageMidReadPost_0(context.Background(), mid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.MarkReadApiV1MessageMidReadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkReadApiV1MessageMidReadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.MarkReadApiV1MessageMidReadPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**mid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkReadApiV1MessageMidReadPost_9Request struct via the builder pattern


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


## MessageMarkAllRead

> interface{} MessageMarkAllRead(ctx).Execute()

全部标记已读

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
	resp, r, err := apiClient.MessageAPI.MessageMarkAllRead(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.MessageMarkAllRead``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MessageMarkAllRead`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.MessageMarkAllRead`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMessageMarkAllReadRequest struct via the builder pattern


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


## MessageMarkAllRead_0

> interface{} MessageMarkAllRead_0(ctx).Execute()

全部标记已读

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
	resp, r, err := apiClient.MessageAPI.MessageMarkAllRead_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.MessageMarkAllRead_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MessageMarkAllRead_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.MessageMarkAllRead_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMessageMarkAllRead_10Request struct via the builder pattern


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


## MessageUnreadCount

> interface{} MessageUnreadCount(ctx).Execute()

未读消息数

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
	resp, r, err := apiClient.MessageAPI.MessageUnreadCount(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.MessageUnreadCount``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MessageUnreadCount`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.MessageUnreadCount`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMessageUnreadCountRequest struct via the builder pattern


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


## MessageUnreadCount_0

> interface{} MessageUnreadCount_0(ctx).Execute()

未读消息数

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
	resp, r, err := apiClient.MessageAPI.MessageUnreadCount_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.MessageUnreadCount_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MessageUnreadCount_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.MessageUnreadCount_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMessageUnreadCount_11Request struct via the builder pattern


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


## SendPrivateApiV1MessagePrivatePost

> interface{} SendPrivateApiV1MessagePrivatePost(ctx).ToUserId(toUserId).Content(content).Title(title).Execute()

发送私信

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
	toUserId := "toUserId_example" // string | 
	content := "content_example" // string | 
	title := "title_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.SendPrivateApiV1MessagePrivatePost(context.Background()).ToUserId(toUserId).Content(content).Title(title).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.SendPrivateApiV1MessagePrivatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendPrivateApiV1MessagePrivatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.SendPrivateApiV1MessagePrivatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendPrivateApiV1MessagePrivatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **toUserId** | **string** |  | 
 **content** | **string** |  | 
 **title** | **string** |  | 

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


## SendPrivateApiV1MessagePrivatePost_0

> interface{} SendPrivateApiV1MessagePrivatePost_0(ctx).ToUserId(toUserId).Content(content).Title(title).Execute()

发送私信

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
	toUserId := "toUserId_example" // string | 
	content := "content_example" // string | 
	title := "title_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.SendPrivateApiV1MessagePrivatePost_0(context.Background()).ToUserId(toUserId).Content(content).Title(title).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.SendPrivateApiV1MessagePrivatePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendPrivateApiV1MessagePrivatePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.SendPrivateApiV1MessagePrivatePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendPrivateApiV1MessagePrivatePost_12Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **toUserId** | **string** |  | 
 **content** | **string** |  | 
 **title** | **string** |  | 

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


## TemplateListApiV1MessageTemplateListGet

> interface{} TemplateListApiV1MessageTemplateListGet(ctx).Type_(type_).Execute()

消息模板列表

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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.TemplateListApiV1MessageTemplateListGet(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.TemplateListApiV1MessageTemplateListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TemplateListApiV1MessageTemplateListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.TemplateListApiV1MessageTemplateListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTemplateListApiV1MessageTemplateListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## TemplateListApiV1MessageTemplateListGet_0

> interface{} TemplateListApiV1MessageTemplateListGet_0(ctx).Type_(type_).Execute()

消息模板列表

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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.TemplateListApiV1MessageTemplateListGet_0(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.TemplateListApiV1MessageTemplateListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TemplateListApiV1MessageTemplateListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.TemplateListApiV1MessageTemplateListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTemplateListApiV1MessageTemplateListGet_13Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## UpdateAnnouncementApiV1MessageAnnouncementAidPut

> interface{} UpdateAnnouncementApiV1MessageAnnouncementAidPut(ctx, aid).Title(title).Content(content).Status(status).Priority(priority).Execute()

修改公告

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
	aid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	content := "content_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	priority := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.UpdateAnnouncementApiV1MessageAnnouncementAidPut(context.Background(), aid).Title(title).Content(content).Status(status).Priority(priority).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.UpdateAnnouncementApiV1MessageAnnouncementAidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateAnnouncementApiV1MessageAnnouncementAidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.UpdateAnnouncementApiV1MessageAnnouncementAidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateAnnouncementApiV1MessageAnnouncementAidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **content** | **string** |  | 
 **status** | **int32** |  | 
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


## UpdateAnnouncementApiV1MessageAnnouncementAidPut_0

> interface{} UpdateAnnouncementApiV1MessageAnnouncementAidPut_0(ctx, aid).Title(title).Content(content).Status(status).Priority(priority).Execute()

修改公告

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
	aid := int32(56) // int32 | 
	title := "title_example" // string |  (optional)
	content := "content_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)
	priority := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MessageAPI.UpdateAnnouncementApiV1MessageAnnouncementAidPut_0(context.Background(), aid).Title(title).Content(content).Status(status).Priority(priority).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MessageAPI.UpdateAnnouncementApiV1MessageAnnouncementAidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateAnnouncementApiV1MessageAnnouncementAidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MessageAPI.UpdateAnnouncementApiV1MessageAnnouncementAidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**aid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateAnnouncementApiV1MessageAnnouncementAidPut_14Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **title** | **string** |  | 
 **content** | **string** |  | 
 **status** | **int32** |  | 
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

