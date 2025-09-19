"use client"
import { UploadButton } from "@uploadthing/react"
import type { OurFileRouter } from "@/app/api/uploadthing/core"
import { toast } from 'sonner'

export default function AvatarUpload(props: { onUploaded: (url: string) => void }) {
  return (
    <div>
      <UploadButton<OurFileRouter, "avatarUploader">
        endpoint="avatarUploader"
        onClientUploadComplete={(res) => {
          const url = res?.[0]?.url
          if (url) {
            props.onUploaded(url)
            toast.success('Avatar uploaded')
          } else {
            toast.error('Upload failed: no URL')
          }
        }}
        onUploadError={(error: Error) => {
          toast.error(error.message || 'Upload failed')
        }}
        appearance={{
          button: "ut-ready:bg-sky-600 ut-ready:hover:bg-sky-700 ut-uploading:cursor-not-allowed bg-sky-600 text-white px-3 py-2 rounded",
        }}
      />
    </div>
  )
}
