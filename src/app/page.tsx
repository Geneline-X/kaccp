import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="container mx-auto px-6 py-24">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-sky-900">
            KACCP Platform
          </h1>
          <p className="mt-4 text-lg text-sky-800/80">
            Manage audio sources, crowdsourced transcriptions, AI-assisted reviews, and payouts — all in one place.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="bg-sky-600 hover:bg-sky-700">
              <Link href="/admin">Go to Admin Console</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/admin/login">Sign in as Admin</Link>
            </Button>
          </div>
        </div>
      </div>
      <section className="border-t bg-white/60">
        <div className="container mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
          <Feature title="Ingestion" desc="Register long-form audio and let your worker service handle chunking & uploads to GCS." />
          <Feature title="Transcription" desc="Transcribers claim chunks, submit text, and receive AI suggestions for clean English." />
          <Feature title="Review & Export" desc="Approve with or without AI-corrections and export the master dataset to your GCS bucket." />
        </div>
      </section>
    </main>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <h3 className="text-sky-900 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-sky-800/80">{desc}</p>
    </div>
  )
}
