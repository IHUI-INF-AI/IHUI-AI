
# ContextSaveRequest


## Properties

Name | Type
------------ | -------------
`agentId` | string
`contextKey` | string
`contextValue` | string
`fieldName` | string

## Example

```typescript
import type { ContextSaveRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "agentId": null,
  "contextKey": null,
  "contextValue": null,
  "fieldName": null,
} satisfies ContextSaveRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ContextSaveRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


