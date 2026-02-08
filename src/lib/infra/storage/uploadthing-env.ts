// Normalizes UploadThing environment variables across versions.
// v7 expects UPLOADTHING_TOKEN. Some guides reference UPLOADTHING_SECRET.
// We map SECRET -> TOKEN if TOKEN is not set.

if (!process.env.UPLOADTHING_TOKEN) {
  const legacy = process.env.UPLOADTHING_SECRET || process.env.UT_SECRET || process.env.UT_API_KEY
  if (legacy) {
    process.env.UPLOADTHING_TOKEN = legacy
    // eslint-disable-next-line no-console
    console.warn('[uploadthing] UPLOADTHING_TOKEN was not set; using legacy secret from UPLOADTHING_SECRET/UT_SECRET')
  }
}

export function assertUploadThingEnv() {
  if (!process.env.UPLOADTHING_TOKEN) {
    // eslint-disable-next-line no-console
    console.error('[uploadthing] Missing UPLOADTHING_TOKEN (or legacy UPLOADTHING_SECRET). Uploads will fail.')
    return false
  }
  return true
}
