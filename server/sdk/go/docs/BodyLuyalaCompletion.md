# BodyLuyalaCompletion

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** |  | 
**Model** | Pointer to **string** |  | [optional] [default to "luyala-pro"]
**MaxTokens** | Pointer to **int32** |  | [optional] [default to 1024]

## Methods

### NewBodyLuyalaCompletion

`func NewBodyLuyalaCompletion(prompt string, ) *BodyLuyalaCompletion`

NewBodyLuyalaCompletion instantiates a new BodyLuyalaCompletion object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyLuyalaCompletionWithDefaults

`func NewBodyLuyalaCompletionWithDefaults() *BodyLuyalaCompletion`

NewBodyLuyalaCompletionWithDefaults instantiates a new BodyLuyalaCompletion object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *BodyLuyalaCompletion) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *BodyLuyalaCompletion) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *BodyLuyalaCompletion) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetModel

`func (o *BodyLuyalaCompletion) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyLuyalaCompletion) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyLuyalaCompletion) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyLuyalaCompletion) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetMaxTokens

`func (o *BodyLuyalaCompletion) GetMaxTokens() int32`

GetMaxTokens returns the MaxTokens field if non-nil, zero value otherwise.

### GetMaxTokensOk

`func (o *BodyLuyalaCompletion) GetMaxTokensOk() (*int32, bool)`

GetMaxTokensOk returns a tuple with the MaxTokens field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxTokens

`func (o *BodyLuyalaCompletion) SetMaxTokens(v int32)`

SetMaxTokens sets MaxTokens field to given value.

### HasMaxTokens

`func (o *BodyLuyalaCompletion) HasMaxTokens() bool`

HasMaxTokens returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


