# NoticePushReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Topic** | Pointer to **string** |  | [optional] [default to "announcement"]
**Title** | Pointer to **string** |  | [optional] [default to ""]
**Content** | Pointer to **string** |  | [optional] [default to ""]
**UserId** | Pointer to **NullableString** |  | [optional] 
**Level** | Pointer to **string** |  | [optional] [default to "info"]
**Extra** | Pointer to **map[string]interface{}** |  | [optional] 

## Methods

### NewNoticePushReq

`func NewNoticePushReq() *NoticePushReq`

NewNoticePushReq instantiates a new NoticePushReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewNoticePushReqWithDefaults

`func NewNoticePushReqWithDefaults() *NoticePushReq`

NewNoticePushReqWithDefaults instantiates a new NoticePushReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTopic

`func (o *NoticePushReq) GetTopic() string`

GetTopic returns the Topic field if non-nil, zero value otherwise.

### GetTopicOk

`func (o *NoticePushReq) GetTopicOk() (*string, bool)`

GetTopicOk returns a tuple with the Topic field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTopic

`func (o *NoticePushReq) SetTopic(v string)`

SetTopic sets Topic field to given value.

### HasTopic

`func (o *NoticePushReq) HasTopic() bool`

HasTopic returns a boolean if a field has been set.

### GetTitle

`func (o *NoticePushReq) GetTitle() string`

GetTitle returns the Title field if non-nil, zero value otherwise.

### GetTitleOk

`func (o *NoticePushReq) GetTitleOk() (*string, bool)`

GetTitleOk returns a tuple with the Title field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTitle

`func (o *NoticePushReq) SetTitle(v string)`

SetTitle sets Title field to given value.

### HasTitle

`func (o *NoticePushReq) HasTitle() bool`

HasTitle returns a boolean if a field has been set.

### GetContent

`func (o *NoticePushReq) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *NoticePushReq) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *NoticePushReq) SetContent(v string)`

SetContent sets Content field to given value.

### HasContent

`func (o *NoticePushReq) HasContent() bool`

HasContent returns a boolean if a field has been set.

### GetUserId

`func (o *NoticePushReq) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *NoticePushReq) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *NoticePushReq) SetUserId(v string)`

SetUserId sets UserId field to given value.

### HasUserId

`func (o *NoticePushReq) HasUserId() bool`

HasUserId returns a boolean if a field has been set.

### SetUserIdNil

`func (o *NoticePushReq) SetUserIdNil(b bool)`

 SetUserIdNil sets the value for UserId to be an explicit nil

### UnsetUserId
`func (o *NoticePushReq) UnsetUserId()`

UnsetUserId ensures that no value is present for UserId, not even an explicit nil
### GetLevel

`func (o *NoticePushReq) GetLevel() string`

GetLevel returns the Level field if non-nil, zero value otherwise.

### GetLevelOk

`func (o *NoticePushReq) GetLevelOk() (*string, bool)`

GetLevelOk returns a tuple with the Level field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLevel

`func (o *NoticePushReq) SetLevel(v string)`

SetLevel sets Level field to given value.

### HasLevel

`func (o *NoticePushReq) HasLevel() bool`

HasLevel returns a boolean if a field has been set.

### GetExtra

`func (o *NoticePushReq) GetExtra() map[string]interface{}`

GetExtra returns the Extra field if non-nil, zero value otherwise.

### GetExtraOk

`func (o *NoticePushReq) GetExtraOk() (*map[string]interface{}, bool)`

GetExtraOk returns a tuple with the Extra field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExtra

`func (o *NoticePushReq) SetExtra(v map[string]interface{})`

SetExtra sets Extra field to given value.

### HasExtra

`func (o *NoticePushReq) HasExtra() bool`

HasExtra returns a boolean if a field has been set.

### SetExtraNil

`func (o *NoticePushReq) SetExtraNil(b bool)`

 SetExtraNil sets the value for Extra to be an explicit nil

### UnsetExtra
`func (o *NoticePushReq) UnsetExtra()`

UnsetExtra ensures that no value is present for Extra, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


