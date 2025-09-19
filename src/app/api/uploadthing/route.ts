import { createRouteHandler } from 'uploadthing/next'
import { ourFileRouter } from './core'
import { assertUploadThingEnv } from '@/lib/uploadthing-env'

// Force Node.js runtime for UploadThing handlers (recommended)
export const runtime = 'nodejs'

// Ensure env is present (maps UPLOADTHING_SECRET -> UPLOADTHING_TOKEN if needed)
assertUploadThingEnv()

export const { GET, POST } = createRouteHandler({ router: ourFileRouter })
