# BodyImageApiV1UserModelChatImagePost

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Model** | Pointer to **string** |  | [optional] [default to "dall-e-3"]
**Prompt** | **string** |  | 
**Size** | Pointer to **string** |  | [optional] [default to "1024x1024"]
**N** | Pointer to **int32** |  | [optional] [default to 1]

## Methods

### NewBodyImageApiV1UserModelChatImagePost

`func NewBodyImageApiV1UserModelChatImagePost(prompt string, ) *BodyImageApiV1UserModelChatImagePost`

NewBodyImageApiV1UserModelChatImagePost instantiates a new BodyImageApiV1UserModelChatImagePost object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyImageApiV1UserModelChatImagePostWithDefaults

`func NewBodyImageApiV1UserModelChatImagePostWithDefaults() *BodyImageApiV1UserModelChatImagePost`

NewBodyImageApiV1UserModelChatImagePostWithDefaults instantiates a new BodyImageApiV1UserModelChatImagePost object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModel

`func (o *BodyImageApiV1UserModelChatImagePost) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyImageApiV1UserModelChatImagePost) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyImageApiV1UserModelChatImagePost) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyImageApiV1UserModelChatImagePost) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetPrompt

`func (o *BodyImageApiV1UserModelChatImagePost) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *BodyImageApiV1UserModelChatImagePost) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *BodyImageApiV1UserModelChatImagePost) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetSize

`func (o *BodyImageApiV1UserModelChatImagePost) GetSize() string`

GetSize returns the Size field if non-nil, zero value otherwise.

### GetSizeOk

`func (o *BodyImageApiV1UserModelChatImagePost) GetSizeOk() (*string, bool)`

GetSizeOk returns a tuple with the Size field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSize

`func (o *BodyImageApiV1UserModelChatImagePost) SetSize(v string)`

SetSize sets Size field to given value.

### HasSize

`func (o *BodyImageApiV1UserModelChatImagePost) HasSize() bool`

HasSize returns a boolean if a field has been set.

### GetN

`func (o *BodyImageApiV1UserModelChatImagePost) GetN() int32`

GetN returns the N field if non-nil, zero value otherwise.

### GetNOk

`func (o *BodyImageApiV1UserModelChatImagePost) GetNOk() (*int32, bool)`

GetNOk returns a tuple with the N field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetN

`func (o *BodyImageApiV1UserModelChatImagePost) SetN(v int32)`

SetN sets N field to given value.

### HasN

`func (o *BodyImageApiV1UserModelChatImagePost) HasN() bool`

HasN returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


