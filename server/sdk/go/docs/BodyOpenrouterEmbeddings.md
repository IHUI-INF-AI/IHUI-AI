# BodyOpenrouterEmbeddings

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**InputText** | **string** |  | 
**Model** | Pointer to **string** |  | [optional] [default to "openai/text-embedding-3-small"]

## Methods

### NewBodyOpenrouterEmbeddings

`func NewBodyOpenrouterEmbeddings(inputText string, ) *BodyOpenrouterEmbeddings`

NewBodyOpenrouterEmbeddings instantiates a new BodyOpenrouterEmbeddings object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyOpenrouterEmbeddingsWithDefaults

`func NewBodyOpenrouterEmbeddingsWithDefaults() *BodyOpenrouterEmbeddings`

NewBodyOpenrouterEmbeddingsWithDefaults instantiates a new BodyOpenrouterEmbeddings object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetInputText

`func (o *BodyOpenrouterEmbeddings) GetInputText() string`

GetInputText returns the InputText field if non-nil, zero value otherwise.

### GetInputTextOk

`func (o *BodyOpenrouterEmbeddings) GetInputTextOk() (*string, bool)`

GetInputTextOk returns a tuple with the InputText field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputText

`func (o *BodyOpenrouterEmbeddings) SetInputText(v string)`

SetInputText sets InputText field to given value.


### GetModel

`func (o *BodyOpenrouterEmbeddings) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyOpenrouterEmbeddings) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyOpenrouterEmbeddings) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyOpenrouterEmbeddings) HasModel() bool`

HasModel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


