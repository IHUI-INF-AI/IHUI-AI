# \NotificationAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ChannelListApiV1NotificationChannelListGet**](NotificationAPI.md#ChannelListApiV1NotificationChannelListGet) | **Get** /api/v1/notification/channel/list | 通知渠道列表
[**ChannelListApiV1NotificationChannelListGet_0**](NotificationAPI.md#ChannelListApiV1NotificationChannelListGet_0) | **Get** /api/v1/notification/channel/list | 通知渠道列表
[**DeleteNotificationApiV1NotificationNidDelete**](NotificationAPI.md#DeleteNotificationApiV1NotificationNidDelete) | **Delete** /api/v1/notification/{nid} | 删除通知
[**DeleteNotificationApiV1NotificationNidDelete_0**](NotificationAPI.md#DeleteNotificationApiV1NotificationNidDelete_0) | **Delete** /api/v1/notification/{nid} | 删除通知
[**ListNotificationsApiV1NotificationListGet**](NotificationAPI.md#ListNotificationsApiV1NotificationListGet) | **Get** /api/v1/notification/list | 我的通知列表
[**ListNotificationsApiV1NotificationListGet_0**](NotificationAPI.md#ListNotificationsApiV1NotificationListGet_0) | **Get** /api/v1/notification/list | 我的通知列表
[**MarkReadApiV1NotificationNidReadPost**](NotificationAPI.md#MarkReadApiV1NotificationNidReadPost) | **Post** /api/v1/notification/{nid}/read | 标记已读
[**MarkReadApiV1NotificationNidReadPost_0**](NotificationAPI.md#MarkReadApiV1NotificationNidReadPost_0) | **Post** /api/v1/notification/{nid}/read | 标记已读
[**NotificationCreateChannel**](NotificationAPI.md#NotificationCreateChannel) | **Post** /api/v1/notification/channel | 添加渠道
[**NotificationCreateChannel_0**](NotificationAPI.md#NotificationCreateChannel_0) | **Post** /api/v1/notification/channel | 添加渠道
[**NotificationDeleteChannel**](NotificationAPI.md#NotificationDeleteChannel) | **Delete** /api/v1/notification/channel/{cid} | 删除渠道
[**NotificationDeleteChannel_0**](NotificationAPI.md#NotificationDeleteChannel_0) | **Delete** /api/v1/notification/channel/{cid} | 删除渠道
[**NotificationLogList**](NotificationAPI.md#NotificationLogList) | **Get** /api/v1/notification/log/list | 通知发送日志
[**NotificationLogList_0**](NotificationAPI.md#NotificationLogList_0) | **Get** /api/v1/notification/log/list | 通知发送日志
[**NotificationMarkAllRead**](NotificationAPI.md#NotificationMarkAllRead) | **Post** /api/v1/notification/read-all | 全部标记已读
[**NotificationMarkAllRead_0**](NotificationAPI.md#NotificationMarkAllRead_0) | **Post** /api/v1/notification/read-all | 全部标记已读
[**NotificationUnreadCount**](NotificationAPI.md#NotificationUnreadCount) | **Get** /api/v1/notification/unread-count | 未读通知数
[**NotificationUnreadCount_0**](NotificationAPI.md#NotificationUnreadCount_0) | **Get** /api/v1/notification/unread-count | 未读通知数
[**NotificationUpdateChannel**](NotificationAPI.md#NotificationUpdateChannel) | **Put** /api/v1/notification/channel/{cid} | 修改渠道
[**NotificationUpdateChannel_0**](NotificationAPI.md#NotificationUpdateChannel_0) | **Put** /api/v1/notification/channel/{cid} | 修改渠道
[**SendNotificationApiV1NotificationSendPost**](NotificationAPI.md#SendNotificationApiV1NotificationSendPost) | **Post** /api/v1/notification/send | 发送通知
[**SendNotificationApiV1NotificationSendPost_0**](NotificationAPI.md#SendNotificationApiV1NotificationSendPost_0) | **Post** /api/v1/notification/send | 发送通知
[**SetSubscriptionApiV1NotificationSubscriptionPost**](NotificationAPI.md#SetSubscriptionApiV1NotificationSubscriptionPost) | **Post** /api/v1/notification/subscription | 设置订阅
[**SetSubscriptionApiV1NotificationSubscriptionPost_0**](NotificationAPI.md#SetSubscriptionApiV1NotificationSubscriptionPost_0) | **Post** /api/v1/notification/subscription | 设置订阅
[**SubscriptionListApiV1NotificationSubscriptionListGet**](NotificationAPI.md#SubscriptionListApiV1NotificationSubscriptionListGet) | **Get** /api/v1/notification/subscription/list | 我的订阅偏好
[**SubscriptionListApiV1NotificationSubscriptionListGet_0**](NotificationAPI.md#SubscriptionListApiV1NotificationSubscriptionListGet_0) | **Get** /api/v1/notification/subscription/list | 我的订阅偏好



## ChannelListApiV1NotificationChannelListGet

> interface{} ChannelListApiV1NotificationChannelListGet(ctx).Type_(type_).Execute()

通知渠道列表

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
	resp, r, err := apiClient.NotificationAPI.ChannelListApiV1NotificationChannelListGet(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.ChannelListApiV1NotificationChannelListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChannelListApiV1NotificationChannelListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.ChannelListApiV1NotificationChannelListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChannelListApiV1NotificationChannelListGetRequest struct via the builder pattern


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


## ChannelListApiV1NotificationChannelListGet_0

> interface{} ChannelListApiV1NotificationChannelListGet_0(ctx).Type_(type_).Execute()

通知渠道列表

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
	resp, r, err := apiClient.NotificationAPI.ChannelListApiV1NotificationChannelListGet_0(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.ChannelListApiV1NotificationChannelListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChannelListApiV1NotificationChannelListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.ChannelListApiV1NotificationChannelListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChannelListApiV1NotificationChannelListGet_1Request struct via the builder pattern


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


## DeleteNotificationApiV1NotificationNidDelete

> interface{} DeleteNotificationApiV1NotificationNidDelete(ctx, nid).Execute()

删除通知

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
	nid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.DeleteNotificationApiV1NotificationNidDelete(context.Background(), nid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.DeleteNotificationApiV1NotificationNidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteNotificationApiV1NotificationNidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.DeleteNotificationApiV1NotificationNidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**nid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteNotificationApiV1NotificationNidDeleteRequest struct via the builder pattern


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


## DeleteNotificationApiV1NotificationNidDelete_0

> interface{} DeleteNotificationApiV1NotificationNidDelete_0(ctx, nid).Execute()

删除通知

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
	nid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.DeleteNotificationApiV1NotificationNidDelete_0(context.Background(), nid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.DeleteNotificationApiV1NotificationNidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteNotificationApiV1NotificationNidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.DeleteNotificationApiV1NotificationNidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**nid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteNotificationApiV1NotificationNidDelete_2Request struct via the builder pattern


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


## ListNotificationsApiV1NotificationListGet

> interface{} ListNotificationsApiV1NotificationListGet(ctx).Page(page).Limit(limit).Type_(type_).Status(status).Execute()

我的通知列表

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
	resp, r, err := apiClient.NotificationAPI.ListNotificationsApiV1NotificationListGet(context.Background()).Page(page).Limit(limit).Type_(type_).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.ListNotificationsApiV1NotificationListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListNotificationsApiV1NotificationListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.ListNotificationsApiV1NotificationListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListNotificationsApiV1NotificationListGetRequest struct via the builder pattern


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


## ListNotificationsApiV1NotificationListGet_0

> interface{} ListNotificationsApiV1NotificationListGet_0(ctx).Page(page).Limit(limit).Type_(type_).Status(status).Execute()

我的通知列表

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
	resp, r, err := apiClient.NotificationAPI.ListNotificationsApiV1NotificationListGet_0(context.Background()).Page(page).Limit(limit).Type_(type_).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.ListNotificationsApiV1NotificationListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListNotificationsApiV1NotificationListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.ListNotificationsApiV1NotificationListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListNotificationsApiV1NotificationListGet_3Request struct via the builder pattern


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


## MarkReadApiV1NotificationNidReadPost

> interface{} MarkReadApiV1NotificationNidReadPost(ctx, nid).Execute()

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
	nid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.MarkReadApiV1NotificationNidReadPost(context.Background(), nid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.MarkReadApiV1NotificationNidReadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkReadApiV1NotificationNidReadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.MarkReadApiV1NotificationNidReadPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**nid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkReadApiV1NotificationNidReadPostRequest struct via the builder pattern


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


## MarkReadApiV1NotificationNidReadPost_0

> interface{} MarkReadApiV1NotificationNidReadPost_0(ctx, nid).Execute()

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
	nid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.MarkReadApiV1NotificationNidReadPost_0(context.Background(), nid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.MarkReadApiV1NotificationNidReadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MarkReadApiV1NotificationNidReadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.MarkReadApiV1NotificationNidReadPost_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**nid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMarkReadApiV1NotificationNidReadPost_4Request struct via the builder pattern


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


## NotificationCreateChannel

> interface{} NotificationCreateChannel(ctx).Name(name).Type_(type_).Config(config).IsDefault(isDefault).Execute()

添加渠道

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
	name := "name_example" // string | 
	type_ := "type__example" // string | 
	config := "config_example" // string |  (optional)
	isDefault := true // bool |  (optional) (default to false)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.NotificationCreateChannel(context.Background()).Name(name).Type_(type_).Config(config).IsDefault(isDefault).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationCreateChannel``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationCreateChannel`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationCreateChannel`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiNotificationCreateChannelRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **type_** | **string** |  | 
 **config** | **string** |  | 
 **isDefault** | **bool** |  | [default to false]

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


## NotificationCreateChannel_0

> interface{} NotificationCreateChannel_0(ctx).Name(name).Type_(type_).Config(config).IsDefault(isDefault).Execute()

添加渠道

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
	name := "name_example" // string | 
	type_ := "type__example" // string | 
	config := "config_example" // string |  (optional)
	isDefault := true // bool |  (optional) (default to false)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.NotificationCreateChannel_0(context.Background()).Name(name).Type_(type_).Config(config).IsDefault(isDefault).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationCreateChannel_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationCreateChannel_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationCreateChannel_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiNotificationCreateChannel_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **type_** | **string** |  | 
 **config** | **string** |  | 
 **isDefault** | **bool** |  | [default to false]

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


## NotificationDeleteChannel

> interface{} NotificationDeleteChannel(ctx, cid).Execute()

删除渠道

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
	resp, r, err := apiClient.NotificationAPI.NotificationDeleteChannel(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationDeleteChannel``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationDeleteChannel`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationDeleteChannel`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationDeleteChannelRequest struct via the builder pattern


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


## NotificationDeleteChannel_0

> interface{} NotificationDeleteChannel_0(ctx, cid).Execute()

删除渠道

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
	resp, r, err := apiClient.NotificationAPI.NotificationDeleteChannel_0(context.Background(), cid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationDeleteChannel_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationDeleteChannel_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationDeleteChannel_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationDeleteChannel_6Request struct via the builder pattern


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


## NotificationLogList

> interface{} NotificationLogList(ctx).Page(page).Limit(limit).SuccessFlag(successFlag).Execute()

通知发送日志

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
	successFlag := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.NotificationLogList(context.Background()).Page(page).Limit(limit).SuccessFlag(successFlag).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationLogList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationLogList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationLogList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiNotificationLogListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **successFlag** | **bool** |  | 

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


## NotificationLogList_0

> interface{} NotificationLogList_0(ctx).Page(page).Limit(limit).SuccessFlag(successFlag).Execute()

通知发送日志

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
	successFlag := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.NotificationLogList_0(context.Background()).Page(page).Limit(limit).SuccessFlag(successFlag).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationLogList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationLogList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationLogList_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiNotificationLogList_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **successFlag** | **bool** |  | 

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


## NotificationMarkAllRead

> interface{} NotificationMarkAllRead(ctx).Execute()

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
	resp, r, err := apiClient.NotificationAPI.NotificationMarkAllRead(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationMarkAllRead``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationMarkAllRead`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationMarkAllRead`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationMarkAllReadRequest struct via the builder pattern


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


## NotificationMarkAllRead_0

> interface{} NotificationMarkAllRead_0(ctx).Execute()

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
	resp, r, err := apiClient.NotificationAPI.NotificationMarkAllRead_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationMarkAllRead_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationMarkAllRead_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationMarkAllRead_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationMarkAllRead_8Request struct via the builder pattern


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


## NotificationUnreadCount

> interface{} NotificationUnreadCount(ctx).Execute()

未读通知数

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
	resp, r, err := apiClient.NotificationAPI.NotificationUnreadCount(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationUnreadCount``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationUnreadCount`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationUnreadCount`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationUnreadCountRequest struct via the builder pattern


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


## NotificationUnreadCount_0

> interface{} NotificationUnreadCount_0(ctx).Execute()

未读通知数

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
	resp, r, err := apiClient.NotificationAPI.NotificationUnreadCount_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationUnreadCount_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationUnreadCount_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationUnreadCount_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationUnreadCount_9Request struct via the builder pattern


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


## NotificationUpdateChannel

> interface{} NotificationUpdateChannel(ctx, cid).Name(name).Config(config).IsDefault(isDefault).Status(status).Execute()

修改渠道

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
	name := "name_example" // string |  (optional)
	config := "config_example" // string |  (optional)
	isDefault := true // bool |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.NotificationUpdateChannel(context.Background(), cid).Name(name).Config(config).IsDefault(isDefault).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationUpdateChannel``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationUpdateChannel`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationUpdateChannel`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationUpdateChannelRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **config** | **string** |  | 
 **isDefault** | **bool** |  | 
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


## NotificationUpdateChannel_0

> interface{} NotificationUpdateChannel_0(ctx, cid).Name(name).Config(config).IsDefault(isDefault).Status(status).Execute()

修改渠道

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
	name := "name_example" // string |  (optional)
	config := "config_example" // string |  (optional)
	isDefault := true // bool |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.NotificationUpdateChannel_0(context.Background(), cid).Name(name).Config(config).IsDefault(isDefault).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.NotificationUpdateChannel_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `NotificationUpdateChannel_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.NotificationUpdateChannel_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**cid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiNotificationUpdateChannel_10Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **config** | **string** |  | 
 **isDefault** | **bool** |  | 
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


## SendNotificationApiV1NotificationSendPost

> interface{} SendNotificationApiV1NotificationSendPost(ctx).Title(title).Content(content).UserId(userId).Type_(type_).Channel(channel).TargetType(targetType).TargetId(targetId).TargetUrl(targetUrl).UserIds(userIds).Execute()

发送通知



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
	userId := "userId_example" // string |  (optional)
	type_ := "type__example" // string |  (optional) (default to "site")
	channel := "channel_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	targetId := "targetId_example" // string |  (optional)
	targetUrl := "targetUrl_example" // string |  (optional)
	userIds := "userIds_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.SendNotificationApiV1NotificationSendPost(context.Background()).Title(title).Content(content).UserId(userId).Type_(type_).Channel(channel).TargetType(targetType).TargetId(targetId).TargetUrl(targetUrl).UserIds(userIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.SendNotificationApiV1NotificationSendPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendNotificationApiV1NotificationSendPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.SendNotificationApiV1NotificationSendPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendNotificationApiV1NotificationSendPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **content** | **string** |  | 
 **userId** | **string** |  | 
 **type_** | **string** |  | [default to &quot;site&quot;]
 **channel** | **string** |  | 
 **targetType** | **string** |  | 
 **targetId** | **string** |  | 
 **targetUrl** | **string** |  | 
 **userIds** | **string** |  | 

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


## SendNotificationApiV1NotificationSendPost_0

> interface{} SendNotificationApiV1NotificationSendPost_0(ctx).Title(title).Content(content).UserId(userId).Type_(type_).Channel(channel).TargetType(targetType).TargetId(targetId).TargetUrl(targetUrl).UserIds(userIds).Execute()

发送通知



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
	userId := "userId_example" // string |  (optional)
	type_ := "type__example" // string |  (optional) (default to "site")
	channel := "channel_example" // string |  (optional)
	targetType := "targetType_example" // string |  (optional)
	targetId := "targetId_example" // string |  (optional)
	targetUrl := "targetUrl_example" // string |  (optional)
	userIds := "userIds_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.SendNotificationApiV1NotificationSendPost_0(context.Background()).Title(title).Content(content).UserId(userId).Type_(type_).Channel(channel).TargetType(targetType).TargetId(targetId).TargetUrl(targetUrl).UserIds(userIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.SendNotificationApiV1NotificationSendPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendNotificationApiV1NotificationSendPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.SendNotificationApiV1NotificationSendPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSendNotificationApiV1NotificationSendPost_11Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | 
 **content** | **string** |  | 
 **userId** | **string** |  | 
 **type_** | **string** |  | [default to &quot;site&quot;]
 **channel** | **string** |  | 
 **targetType** | **string** |  | 
 **targetId** | **string** |  | 
 **targetUrl** | **string** |  | 
 **userIds** | **string** |  | 

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


## SetSubscriptionApiV1NotificationSubscriptionPost

> interface{} SetSubscriptionApiV1NotificationSubscriptionPost(ctx).Type_(type_).Category(category).Enabled(enabled).Execute()

设置订阅

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
	type_ := "type__example" // string | 
	category := "category_example" // string | 
	enabled := true // bool |  (optional) (default to true)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.SetSubscriptionApiV1NotificationSubscriptionPost(context.Background()).Type_(type_).Category(category).Enabled(enabled).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.SetSubscriptionApiV1NotificationSubscriptionPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SetSubscriptionApiV1NotificationSubscriptionPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.SetSubscriptionApiV1NotificationSubscriptionPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSetSubscriptionApiV1NotificationSubscriptionPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 
 **category** | **string** |  | 
 **enabled** | **bool** |  | [default to true]

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


## SetSubscriptionApiV1NotificationSubscriptionPost_0

> interface{} SetSubscriptionApiV1NotificationSubscriptionPost_0(ctx).Type_(type_).Category(category).Enabled(enabled).Execute()

设置订阅

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
	type_ := "type__example" // string | 
	category := "category_example" // string | 
	enabled := true // bool |  (optional) (default to true)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.NotificationAPI.SetSubscriptionApiV1NotificationSubscriptionPost_0(context.Background()).Type_(type_).Category(category).Enabled(enabled).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.SetSubscriptionApiV1NotificationSubscriptionPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SetSubscriptionApiV1NotificationSubscriptionPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.SetSubscriptionApiV1NotificationSubscriptionPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSetSubscriptionApiV1NotificationSubscriptionPost_12Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 
 **category** | **string** |  | 
 **enabled** | **bool** |  | [default to true]

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


## SubscriptionListApiV1NotificationSubscriptionListGet

> interface{} SubscriptionListApiV1NotificationSubscriptionListGet(ctx).Execute()

我的订阅偏好

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
	resp, r, err := apiClient.NotificationAPI.SubscriptionListApiV1NotificationSubscriptionListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.SubscriptionListApiV1NotificationSubscriptionListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubscriptionListApiV1NotificationSubscriptionListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.SubscriptionListApiV1NotificationSubscriptionListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiSubscriptionListApiV1NotificationSubscriptionListGetRequest struct via the builder pattern


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


## SubscriptionListApiV1NotificationSubscriptionListGet_0

> interface{} SubscriptionListApiV1NotificationSubscriptionListGet_0(ctx).Execute()

我的订阅偏好

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
	resp, r, err := apiClient.NotificationAPI.SubscriptionListApiV1NotificationSubscriptionListGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `NotificationAPI.SubscriptionListApiV1NotificationSubscriptionListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubscriptionListApiV1NotificationSubscriptionListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `NotificationAPI.SubscriptionListApiV1NotificationSubscriptionListGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiSubscriptionListApiV1NotificationSubscriptionListGet_13Request struct via the builder pattern


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

