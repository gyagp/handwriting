import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerUser,
  loginUser,
  saveWork,
  deleteWork,
  currentUser,
  getWorks,
  approveWork
} from '../src/services/db'
import { Work } from '../src/types'

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as any

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Mock crypto.randomUUID if not available (it usually is in recent Node)
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  } as any
}

describe('Automated Functional Tests', () => {

  beforeEach(() => {
    // Reset current user before each test
    currentUser.value = null
    vi.clearAllMocks()
  })

  it('should register tester accounts', async () => {
    // Register tester01
    try {
        await registerUser('tester01', 'password123')
    } catch (e: any) {
        // Ignore if already exists (in a real persistent env), but here we are in-memory usually unless db.ts loads from file.
        // Since we mocked fetch, loadFromFile won't load anything real unless we mock the return.
        // db.ts initializes store in memory.
        if (e.message !== '用户名已存在') throw e
    }

    const user1 = await loginUser('tester01', 'password123')
    expect(user1.username).toBe('tester01')

    // Register tester02
    try {
        await registerUser('tester02', 'password123')
    } catch (e: any) {
        if (e.message !== '用户名已存在') throw e
    }
    const user2 = await loginUser('tester02', 'password123')
    expect(user2.username).toBe('tester02')
  })

  it('tester01 should create a work and tester02 should not be able to delete it', async () => {
    // Login as tester01
    await loginUser('tester01', 'password123')

    const work: Work = {
      id: crypto.randomUUID(),
      userId: currentUser.value!.id,
      title: 'Test Work',
      author: 'Tester',
      content: '测试内容',
      visibility: 'public',
      status: 'pending',
      charStyles: {},
      charAdjustments: {},
      layout: 'horizontal',
      gridType: 'mi',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRefined: false
    }

    await saveWork(work)

    const works = await getWorks()
    const savedWork = works.find(w => w.id === work.id)
    expect(savedWork).toBeDefined()

    // Login as tester02
    await loginUser('tester02', 'password123')

    // tester02 tries to delete tester01's work
    await expect(deleteWork(work.id)).rejects.toThrow('Permission denied')
  })

  it('tester01 should be able to delete their own pending work', async () => {
    await loginUser('tester01', 'password123')

    const work: Work = {
      id: crypto.randomUUID(),
      userId: currentUser.value!.id,
      title: 'Pending Work',
      author: 'Tester',
      content: '待审核',
      visibility: 'public',
      status: 'pending',
      charStyles: {},
      charAdjustments: {},
      layout: 'horizontal',
      gridType: 'mi',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRefined: false
    }

    await saveWork(work)

    // Should be able to delete because it is pending (not published)
    await deleteWork(work.id)

    const works = await getWorks()
    const deletedWork = works.find(w => w.id === work.id)
    expect(deletedWork).toBeUndefined()
  })

  it('tester01 cannot delete their own PUBLISHED public work', async () => {
    // Setup: Create work as tester01, then Admin approves it, then tester01 tries to delete

    // 1. Login tester01 & Create
    await loginUser('tester01', 'password123')
    const work: Work = {
      id: crypto.randomUUID(),
      userId: currentUser.value!.id,
      title: 'Published Work',
      author: 'Tester',
      content: '已发布',
      visibility: 'public',
      status: 'pending',
      charStyles: {},
      charAdjustments: {},
      layout: 'horizontal',
      gridType: 'mi',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRefined: false
    }
    await saveWork(work)

    // 2. Login Admin & Approve
    // We need to register admin first in this memory session if not exists
    // db.ts initSettings creates admin, but we might need to trigger it or just register one.
    // Actually initSettings is called in main.ts, not here.
    // Let's manually register an admin for test
    try {
        await registerUser('admin', 'admin12345')
    } catch {}
    const admin = await loginUser('admin', 'admin12345')
    // Manually set role to admin because registerUser defaults to user
    admin.role = 'admin'

    await approveWork(work.id, true) // Approve -> status = published

    // 3. Login tester01 & Try Delete
    await loginUser('tester01', 'password123')

    await expect(deleteWork(work.id)).rejects.toThrow('已公开的作品无法删除')
  })

  it('tester01 CAN modify writing of their own PUBLISHED public work', async () => {
     // 1. Login tester01 & Create
     await loginUser('tester01', 'password123')
     const work: Work = {
       id: crypto.randomUUID(),
       userId: currentUser.value!.id,
       title: 'Modifiable Work',
       author: 'Tester',
       content: '可修改书写',
       visibility: 'public',
       status: 'published', // Simulate already published
       charStyles: {},
       charAdjustments: {},
       layout: 'horizontal',
       gridType: 'mi',
       createdAt: Date.now(),
       updatedAt: Date.now(),
       isRefined: false
     }
     // Force push to store or save (saveWork handles status logic)
     // If we use saveWork as user, it might reset status to pending if we are not careful.
     // But let's assume it was approved.

     // Let's do the proper flow
     work.status = 'pending'
     await saveWork(work)

     // Admin approve
     const admin = await loginUser('admin', 'admin12345')
     admin.role = 'admin'
     await approveWork(work.id, true)

     // Tester01 modifies WRITING (isRefined, charStyles)
     await loginUser('tester01', 'password123')

     // Fetch the work to get current state
     const works = await getWorks()
     const myWork = works.find(w => w.id === work.id)!

     // Modify
     myWork.isRefined = true
     myWork.charStyles = { 0: 'sample-id' }

     // Save
     await saveWork(myWork)

     // Verify it is saved and still published
     const worksAfter = await getWorks()
     const savedWork = worksAfter.find(w => w.id === work.id)!
     expect(savedWork.isRefined).toBe(true)
     expect(savedWork.status).toBe('published')
  })

  it('tester01 CANNOT modify CONTENT of their own PUBLISHED public work', async () => {
    // 1. Login tester01 & Create
    await loginUser('tester01', 'password123')
    const work: Work = {
      id: crypto.randomUUID(),
      userId: currentUser.value!.id,
      title: 'Fixed Content Work',
      author: 'Tester',
      content: '固定内容',
      visibility: 'public',
      status: 'pending',
      charStyles: {},
      charAdjustments: {},
      layout: 'horizontal',
      gridType: 'mi',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRefined: false
    }
    await saveWork(work)

    // Admin approve
    const admin = await loginUser('admin', 'admin12345')
    admin.role = 'admin'
    await approveWork(work.id, true)

    // Tester01 modifies CONTENT
    await loginUser('tester01', 'password123')

    const works = await getWorks()
    // Clone the work to simulate frontend behavior (editing a copy)
    // Otherwise we are modifying the store reference directly, so existingWork === work
    const myWork = { ...works.find(w => w.id === work.id)! }

    myWork.content = '修改后的内容'

    await expect(saveWork(myWork)).rejects.toThrow('已公开的作品无法修改内容')
 })
})
