import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900 flex flex-col">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-6 flex justify-center">
            <Image src="/kaccp-logo.jpg" alt="KACCP" width={80} height={80} className="rounded-xl shadow-lg" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
            KACCP
          </h1>
          <p className="mt-2 text-xl md:text-2xl text-blue-200 font-medium">
            Voice Data Collection Platform
          </p>
          <p className="mt-4 text-lg text-blue-300/80 max-w-2xl mx-auto">
            Help preserve and digitize African languages by contributing your voice or transcription skills. 
            Built by <Link className="underline text-blue-200 hover:text-white" href="https://geneline-x.net" target="_blank">Geneline-X</Link> for 
            high-quality TTS data collection.
          </p>
          
          {/* Supported Languages */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {['Krio', 'Mende', 'Temne', 'Susu', 'Mandinka'].map((lang) => (
              <span key={lang} className="px-3 py-1 bg-blue-800/50 text-blue-200 rounded-full text-sm">
                {lang}
              </span>
            ))}
          </div>

          {/* Leaderboard Link */}
          <div className="mt-8">
            <Link 
              href="/leaderboard" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-800/50 hover:bg-blue-700/50 text-blue-100 rounded-xl transition border border-blue-700/50"
            >
              🏆 View Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* Role Selection Cards */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            How would you like to contribute?
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Choose your role based on your skills. Speakers record voice, transcribers write what they hear.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Speaker Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200 shadow-lg">
              <div className="text-5xl mb-4">🎙️</div>
              <h3 className="text-2xl font-bold text-blue-900 mb-2">Speaker</h3>
              <p className="text-blue-800/80 mb-6">
                Record your voice in your native language. Read English prompts and speak the translation naturally.
              </p>
              <ul className="text-sm text-blue-700 space-y-2 mb-6">
                <li>✓ Record short audio clips (max 10 seconds)</li>
                <li>✓ Translate English prompts to your language</li>
                <li>✓ Earn per minute of approved audio</li>
                <li>✓ Work from anywhere with a phone</li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 flex-1">
                  <Link href="/speaker/register">Register as Speaker</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="flex-1">
                  <Link href="/speaker/login">Speaker Login</Link>
                </Button>
              </div>
            </div>

            {/* Transcriber Card */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border border-green-200 shadow-lg">
              <div className="text-5xl mb-4">✍️</div>
              <h3 className="text-2xl font-bold text-green-900 mb-2">Transcriber</h3>
              <p className="text-green-800/80 mb-6">
                Listen to recordings and write exactly what you hear. Help create accurate text for AI training.
              </p>
              <ul className="text-sm text-green-700 space-y-2 mb-6">
                <li>✓ Listen to short audio recordings</li>
                <li>✓ Write transcriptions in the original language</li>
                <li>✓ Flag poor quality recordings</li>
                <li>✓ Earn per transcription approved</li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 flex-1">
                  <Link href="/transcriber/v2/register">Register as Transcriber</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="flex-1">
                  <Link href="/transcriber/login">Transcriber Login</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Register & Select Languages</h3>
              <p className="text-gray-600">
                Create an account and choose which languages you speak or can transcribe.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Record or Transcribe</h3>
              <p className="text-gray-600">
                Speakers record voice clips. Transcribers listen and write what they hear.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Get Paid</h3>
              <p className="text-gray-600">
                Earn money for every approved recording or transcription via Orange Money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats/Impact Section */}
      <section className="bg-blue-900 py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Building AI for African Languages
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-300">5+</div>
              <div className="text-blue-200 text-sm mt-1">Languages</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-300">200h</div>
              <div className="text-blue-200 text-sm mt-1">Target per Language</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-300">2</div>
              <div className="text-blue-200 text-sm mt-1">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-300">TTS</div>
              <div className="text-blue-200 text-sm mt-1">For Speech Synthesis</div>
            </div>
          </div>
        </div>
      </section>

      {/* Payout Info */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200">
            <h3 className="text-2xl font-bold text-amber-900 mb-4">💰 Earn with Orange Money</h3>
            <ul className="text-amber-800 space-y-2">
              <li>• <strong>Speakers:</strong> Earn per minute of approved recordings</li>
              <li>• <strong>Transcribers:</strong> Earn per minute of approved transcriptions</li>
              <li>• Payouts via Orange Money - no bank account needed</li>
              <li>• Weekly payment cycles</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-gray-900 text-gray-400">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Image src="/kaccp-logo.jpg" alt="KACCP" width={32} height={32} className="rounded" />
              <span className="text-white font-semibold">KACCP</span>
              <span className="text-gray-500">|</span>
              <span className="text-sm">Voice Data Collection Platform</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/speaker" className="hover:text-white transition-colors">Speaker Portal</Link>
              <Link href="/transcriber/v2" className="hover:text-white transition-colors">Transcriber Portal</Link>
              <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
              <Link href="/admin/v2" className="hover:text-white transition-colors">Admin</Link>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-800 text-center text-sm">
            <p>Built by <Link href="https://geneline-x.net" target="_blank" className="text-blue-400 hover:underline">Geneline-X</Link> for African language preservation</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
