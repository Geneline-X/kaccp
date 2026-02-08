import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import { getAuthUser } from '@/lib/infra/auth/auth'

const f = createUploadthing()

export const ourFileRouter = {
  avatarUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const user = await getAuthUser(req as any)
      if (!user) throw new UploadThingError('Unauthorized')
      return { userId: user.id }
    })
    .onUploadComplete(async ({ file, metadata }) => {
      // Optionally: you can persist audit logs here
      return { url: file.url, userId: (metadata as any).userId }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
