import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-10 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service and Data Policy (Draft)</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p><em>This draft is for informational purposes only and is not legal advice. Please consult a qualified legal professional.</em></p>

            <h3>A. Draft Terms of Service</h3>
            <ol>
              <li><strong>Acceptance of Terms:</strong> By creating an account, accessing, or using the KACCP Platform ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Platform. You must be at least 18 years of age or older to use this service.</li>
              <li><strong>User Accounts:</strong> You agree to provide accurate and complete information during registration and to keep this information updated. You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.</li>
              <li><strong>User Conduct:</strong> You agree to use the Platform only for its intended purpose of transcribing Krio audio content. You shall not upload, submit, or transmit any content that is illegal, defamatory, obscene, or that infringes on the intellectual property or privacy rights of any third party. Your use of the Platform must comply with all applicable local, national, and international laws.</li>
              <li><strong>Intellectual Property and Data Ownership:</strong>
                <ul>
                  <li>You acknowledge that all audio files, including the source material (e.g., the Krio Bible), are owned by the platform and its licensors.</li>
                  <li>By submitting a transcription, you grant the KACCP Platform a perpetual, irrevocable, worldwide, royalty-free, and non-exclusive license to use, reproduce, modify, and distribute the transcription for the purpose of creating a publicly available dataset for machine learning research and development.</li>
                  <li>You represent and warrant that your transcriptions are your original work and do not infringe upon any third-party intellectual property rights. You agree that the KACCP Platform owns all rights, title, and interest in and to the final aggregated dataset.</li>
                </ul>
              </li>
              <li><strong>Payment and Compensation:</strong> Payment for your transcription work is based solely on the amount of work that is reviewed and approved by the KACCP Platform. The current rate is specified on the Platform and is subject to change at our discretion. Payment will be made through an agreed-upon method as specified in the Platform's payment policy.</li>
              <li><strong>Disclaimers and Limitation of Liability:</strong> The Platform is provided "as is" and "as available." We do not make any warranties, express or implied, regarding the Platform or your use of it. We shall not be liable for any damages, including but not limited to direct, indirect, incidental, or consequential damages, arising from your use of the Platform or your inability to use it.</li>
              <li><strong>Termination:</strong> We reserve the right to suspend or terminate your account and access to the Platform at any time, with or without cause, including for any violation of these Terms.</li>
            </ol>

            <h3>B. Data Protection and Privacy Policy Considerations</h3>
            <p>While Sierra Leone may not yet have a comprehensive data protection law, it is a best practice and an ethical obligation to protect user data in line with international standards.</p>
            <ol>
              <li><strong>Data Collection:</strong> We collect the following information from transcribers:
                <ul>
                  <li><strong>Personal Data:</strong> Your name, email address, and any payment information required for compensation.</li>
                  <li><strong>Usage Data:</strong> Information about your activity on the Platform, such as the number of chunks you have transcribed and your performance metrics.</li>
                  <li><strong>User-Generated Content:</strong> The audio chunks and your corresponding transcriptions.</li>
                </ul>
              </li>
              <li><strong>Data Usage:</strong>
                <ul>
                  <li><strong>Personal Data:</strong> This data is used solely for the purpose of managing your account, communicating with you, and processing your payments.</li>
                  <li><strong>Usage Data:</strong> This is used to monitor the performance of the platform, improve user experience, and manage the crowdsourcing process.</li>
                  <li><strong>User-Generated Content:</strong> The raw audio files and your approved transcriptions are used to create the final, anonymized, and publicly-available dataset for machine learning research.</li>
                </ul>
              </li>
              <li><strong>Data Security:</strong> All user data will be stored securely on cloud services with access limited to authorized personnel only. We will implement industry-standard security measures to protect your data from unauthorized access, disclosure, or destruction.</li>
              <li><strong>Anonymization:</strong> The final public dataset will not contain any personal data (e.g., names or email addresses) that could be used to identify individual transcribers. The data will be stripped of any identifiable information before it is made publicly available for research.</li>
              <li><strong>User Rights:</strong> You have the right to request access to, correction of, or deletion of your personal data. To exercise these rights, please contact us at the designated support email. You acknowledge that once a transcription is approved and becomes part of the final dataset, it cannot be individually removed.</li>
            </ol>

            <p className="mt-6 text-sm">Questions? Visit <Link href="https://geneline-x.net" className="underline" target="_blank">geneline-x.net</Link>.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
