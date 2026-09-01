import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'

// jsdom's Blob lacks arrayBuffer()/text() and doesn't survive native
// structuredClone (used by fake-indexeddb). Swap in Node's native Blob,
// which supports both.
if (typeof Blob === 'undefined' || !('arrayBuffer' in Blob.prototype)) {
  globalThis.Blob = NodeBlob as unknown as typeof Blob
}

// jsdom lacks createObjectURL
if (typeof URL !== 'undefined' && !URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock'
  URL.revokeObjectURL = () => {}
}
