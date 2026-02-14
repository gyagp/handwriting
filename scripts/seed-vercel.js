/**
 * Seed script: Upload existing local data/ files to Vercel Blob storage.
 * Automatically migrates plaintext passwords to PBKDF2 hashes during upload.
 *
 * Prerequisites:
 *   - Set BLOB_READ_WRITE_TOKEN environment variable
 *   - npm install @vercel/blob
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/seed-vercel.js
 *
 * On Windows PowerShell:
 *   $env:BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxx"; node scripts/seed-vercel.js
 */

import { put } from '@vercel/blob'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '..', 'data')
const BLOB_PREFIX = 'data/'

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex')
  return { hash, salt: s }
}

async function uploadJson(blobPath, data) {
  const blob = await put(blobPath, JSON.stringify(data, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  })
  console.log(`  Uploaded ${blobPath} → ${blob.url}`)
}

async function uploadFile(localPath, blobPath) {
  if (!fs.existsSync(localPath)) {
    console.log(`  Skipping ${blobPath} (file not found)`)
    return
  }

  const content = fs.readFileSync(localPath, 'utf-8')
  const blob = await put(blobPath, content, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  })
  console.log(`  Uploaded ${blobPath} → ${blob.url}`)
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required.')
    console.error('Get it from: Vercel Dashboard → Your Project → Storage → Blob → Tokens')
    process.exit(1)
  }

  console.log('Seeding Vercel Blob storage from local data/ directory...\n')

  // Upload system.json with password migration
  const systemPath = path.join(dataDir, 'system.json')
  if (fs.existsSync(systemPath)) {
    const systemData = JSON.parse(fs.readFileSync(systemPath, 'utf-8'))

    // Migrate plaintext passwords to hashed
    let migrated = 0
    if (Array.isArray(systemData.users)) {
      for (const user of systemData.users) {
        if (user.password && !user.passwordHash) {
          const { hash, salt } = hashPassword(user.password)
          user.passwordHash = hash
          user.passwordSalt = salt
          delete user.password
          migrated++
          console.log(`  Migrated password for user: ${user.username}`)
        }
      }
    }
    if (migrated > 0) {
      console.log(`  Migrated ${migrated} plaintext password(s) to PBKDF2 hashes`)
    }

    await uploadJson(`${BLOB_PREFIX}system.json`, systemData)
  }

  // Upload works.json
  await uploadFile(path.join(dataDir, 'works.json'), `${BLOB_PREFIX}works.json`)

  // Upload per-user files
  const usersDir = path.join(dataDir, 'users')
  if (fs.existsSync(usersDir)) {
    const userFolders = fs.readdirSync(usersDir)
    for (const userId of userFolders) {
      const userDir = path.join(usersDir, userId)
      if (!fs.statSync(userDir).isDirectory()) continue

      console.log(`\n  User: ${userId}`)
      await uploadFile(
        path.join(userDir, 'samples.json'),
        `${BLOB_PREFIX}users/${userId}/samples.json`
      )
      await uploadFile(
        path.join(userDir, 'works.json'),
        `${BLOB_PREFIX}users/${userId}/works.json`
      )
    }
  }

  console.log('\nDone! All data has been seeded to Vercel Blob storage.')
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
