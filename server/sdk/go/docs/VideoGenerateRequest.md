# VideoGenerateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | Text prompt for video generation | 
**Images** | Pointer to **[]interface{}** | Reference image URLs | [optional] 
**UserUuid** | **string** | User UUID (passed by client) | 
**ChatId** | Pointer to **NullableString** | Chat context ID | [optional] 
**Zidingyican** | Pointer to **[]interface{}** | Custom parameter list | [optional] 

## Methods

### NewVideoGenerateRequest

`func NewVideoGenerateRequest(prompt string, userUuid string, ) *VideoGenerateRequest`

NewVideoGenerateRequest instantiates a new VideoGenerateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVideoGenerateRequestWithDefaults

`func NewVideoGenerateRequestWithDefaults() *VideoGenerateRequest`

NewVideoGenerateRequestWithDefaults instantiates a new VideoGenerateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *VideoGenerateRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *VideoGenerateRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *VideoGenerateRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetImages

`func (o *VideoGenerateRequest) GetImages() []interface{}`

GetImages returns the Images field if non-nil, zero value otherwise.

### GetImagesOk

`func (o *VideoGenerateRequest) GetImagesOk() (*[]interface{}, bool)`

GetImagesOk returns a tuple with the Images field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImages

`func (o *VideoGenerateRequest) SetImages(v []interface{})`

SetImages sets Images field to given value.

### HasImages

`func (o *VideoGenerateRequest) HasImages() bool`

HasImages returns a boolean if a field has been set.

### GetUserUuid

`func (o *VideoGenerateRequest) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *VideoGenerateRequest) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *VideoGenerateRequest) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.


### GetChatId

`func (o *VideoGenerateRequest) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *VideoGenerateRequest) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *VideoGenerateRequest) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *VideoGenerateRequest) HasChatId() bool`

HasChatId returns a boolean if a field has been set.

### SetChatIdNil

`func (o *VideoGenerateRequest) SetChatIdNil(b bool)`

 SetChatIdNil sets the value for ChatId to be an explicit nil

### UnsetChatId
`func (o *VideoGenerateRequest) UnsetChatId()`

UnsetChatId ensures that no value is present for ChatId, not even an explicit nil
### GetZidingyican

`func (o *VideoGenerateRequest) GetZidingyican() []interface{}`

GetZidingyican returns the Zidingyican field if non-nil, zero value otherwise.

### GetZidingyicanOk

`func (o *VideoGenerateRequest) GetZidingyicanOk() (*[]interface{}, bool)`

GetZidingyicanOk returns a tuple with the Zidingyican field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetZidingyican

`func (o *VideoGenerateRequest) SetZidingyican(v []interface{})`

SetZidingyican sets Zidingyican field to given value.

### HasZidingyican

`func (o *VideoGenerateRequest) HasZidingyican() bool`

HasZidingyican returns a boolean if a field has been set.

### SetZidingyicanNil

`func (o *VideoGenerateRequest) SetZidingyicanNil(b bool)`

 SetZidingyicanNil sets the value for Zidingyican to be an explicit nil

### UnsetZidingyican
`func (o *VideoGenerateRequest) UnsetZidingyican()`

UnsetZidingyican ensures that no value is present for Zidingyican, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


