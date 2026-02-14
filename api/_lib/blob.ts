import { put, list } from '@vercel/blob'

const BLOB_PREFIX = 'data/'

export function blobPath(relativePath: string): string {
  return `${BLOB_PREFIX}${relativePath}`
}

/**
 * Read a JSON blob by its exact pathname.
 */
export async function readBlobJson(pathname: string): Promise<any | null> {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 10 })
    const blob = blobs.find(b => b.pathname === pathname)
    if (!blob) return null
    const response = await fetch(blob.url)
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Write a JSON object as a blob. Uses deterministic pathname (no random suffix).
 */
export async function writeBlobJson(pathname: string, data: any): Promise<void> {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  })
}

/**
 * List all blobs under a given prefix.
 */
export async function listBlobsByPrefix(prefix: string) {
  const { blobs } = await list({ prefix })
  return blobs
}
