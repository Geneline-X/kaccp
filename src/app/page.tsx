import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex flex-col">
      <div className="container mx-auto px-6 py-24">
        <div className="max-w-3xl">
          <div className="mb-4">
            <Image src="/kaccp-logo.jpg" alt="KACCP" width={56} height={56} className="rounded-md" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-sky-900">
            Become a Transcriber
          </h1>
          <p className="mt-4 text-lg text-sky-800/80">
            Help build the Krio Audio Corpus by transcribing short audio clips. Sign up and start contributing in minutes.
          </p>
          <p className="mt-2 text-sm text-sky-800/70">
            Built by <Link className="underline" href="https://geneline-x.net" target="_blank">Geneline-X</Link> to crowdsource low-resource language data for research. Future support for additional languages is planned.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="bg-sky-600 hover:bg-sky-700">
              <Link href="/transcriber/register">Sign up as Transcriber</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/transcriber/login">Transcriber Login</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/leaderboard">View Leaderboard</Link>
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

      <section className="border-t bg-gradient-to-b from-amber-50 to-white">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          <div className="p-5 rounded-lg border bg-white/70 shadow-sm">
            <h3 className="text-xl font-semibold text-sky-900">Leaderboard & Community</h3>
            <p className="mt-2 text-sky-900/80 text-sm">
              Compete friendly with other transcribers and track progress transparently. The public leaderboard shows
              top contributors by approved minutes and estimated earnings. Only transcribers who opt in via their profile are shown.
            </p>
            <div className="mt-4">
              <Button asChild className="bg-sky-600 hover:bg-sky-700">
                <Link href="/leaderboard">Explore the Leaderboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-white">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          <div className="p-5 rounded-lg border bg-white/70 shadow-sm">
            <h3 className="text-xl font-semibold text-sky-900">Payouts via Orange Money</h3>
            <ul className="mt-2 text-sky-900/80 text-sm list-disc pl-5 space-y-1">
              <li>Payouts are handled manually by our team using Orange Money. No payment gateway is needed from you.</li>
              <li>Make sure your phone number in your profile is accurate to receive payments.</li>
              <li>Cash-out threshold is <span className="font-semibold">30 SLE</span> in a weekly cycle.</li>
              <li>Earnings are based on approved minutes at the current rate (1.2 SLE per minute).</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t bg-white">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          <h2 className="text-2xl font-semibold text-sky-900">How it works</h2>
          <ol className="list-decimal pl-5 mt-4 space-y-2 text-sky-900/90">
            <li>Create an account and sign in as a transcriber.</li>
            <li>Go to the Dashboard and open the "Available" tab.</li>
            <li>Pick any audio chunk from the list and click "Claim" or use "Claim next available".</li>
            <li>Listen to the Krio audio and type the English transcription in the task page.</li>
            <li>You can "Save Draft" and return later; your draft will be prefilled automatically.</li>
            <li>When ready, submit for review. Approved work is counted toward your earnings.</li>
          </ol>
          <div className="mt-6 p-4 rounded-md border bg-sky-50">
            <div className="font-medium text-sky-900">Rate</div>
            <div className="text-sky-900/80 text-sm">You earn <span className="font-semibold">1.2 SLE per minute</span> of approved audio.</div>
          </div>
          <div className="mt-4 p-4 rounded-md border bg-sky-50">
            <div className="font-medium text-sky-900">Track your progress</div>
            <div className="text-sky-900/80 text-sm">Your Dashboard shows your minutes submitted and approved, and an estimated payout based on the current rate.</div>
          </div>
          <div className="mt-4 p-4 rounded-md border bg-sky-50">
            <div className="font-medium text-sky-900">Claiming rules</div>
            <ul className="mt-2 text-sky-900/80 text-sm list-disc pl-5 space-y-1">
              <li>You can have <span className="font-semibold">one active assignment at a time</span>.</li>
              <li>After you submit, the assignment leaves "My Work" and appears under the <span className="font-semibold">Submitted</span> tab, so you can claim a new chunk.</li>
              <li>If you need to stop, you can release your current assignment from "My Work" at any time.</li>
            </ul>
          </div>
          <div className="mt-4 p-4 rounded-md border bg-sky-50">
            <div className="font-medium text-sky-900">What happens after you submit?</div>
            <ul className="mt-2 text-sky-900/80 text-sm list-disc pl-5 space-y-1">
              <li><span className="font-semibold">Pending</span>: waiting for admin review (shown in Submitted tab).</li>
              <li><span className="font-semibold">Approved</span>: counts toward your earnings; it disappears from the default Submitted view.</li>
              <li><span className="font-semibold">Rejected</span>: the chunk returns to the Available list for anyone to claim.</li>
              <li><span className="font-semibold">Edit Requested</span>: the chunk is assigned back to you and will reappear in <span className="font-semibold">My Work</span> so you can make updates.</li>
            </ul>
          </div>
        </div>
      </section>
      <footer className="mt-auto border-t bg-white/80">
        <div className="container mx-auto px-6 py-4 text-xs text-sky-800/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>KACCP</span>
            <span className="mx-1">•</span>
            <Link href="/leaderboard" className="underline hover:text-sky-900">Leaderboard</Link>
            <span className="mx-1">•</span>
            <Link href="/transcriber/profile" className="underline hover:text-sky-900">Profile</Link>
          </div>
          <div>
            <Link href="/admin" className="underline hover:text-sky-900">Admin Console</Link>
            <span className="mx-2">•</span>
            <Link href="/admin/login" className="underline hover:text-sky-900">Admin Login</Link>
          </div>
        </div>
      </footer>
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
