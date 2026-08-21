import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/layout/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <h1 className="text-4xl sm:text-5xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">Last Updated: August 13, 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p>
              TradeX ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use our trading journal and analytics platform.
            </p>
            <p className="mt-4">
              Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy,
              please do not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1 Personal Information</h3>
            <p className="mb-4">We collect information that you provide directly to us:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account Information: Email address, username, password (encrypted)</li>
              <li>Profile Information: Name, profile picture, trading preferences</li>
              <li>Payment Information: Processed securely through Stripe (we do not store full payment details)</li>
              <li>Communication Data: Support messages, feedback, and correspondence</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2 Trading Data</h3>
            <p className="mb-4">When you use our Service, we collect:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Trade Information: Entry/exit prices, symbols, positions, profit/loss, timestamps</li>
              <li>Journal Entries: Notes, screenshots, tags, and trade analysis</li>
              <li>Psychology Data: Pre-trade and post-trade mental state assessments</li>
              <li>Broker Connection Data: Account balances, positions, and trade history from connected brokers</li>
              <li>Performance Metrics: Win rates, risk metrics, and statistical analysis</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Device Information: IP address, browser type, operating system</li>
              <li>Usage Data: Pages viewed, features used, time spent, click patterns</li>
              <li>Cookies and Tracking: Session cookies, preferences, analytics data</li>
              <li>Log Data: Error reports, performance metrics, access times</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use the collected information for:</p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.1 Service Provision</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Creating and managing your account</li>
              <li>Providing trade journaling and analytics features</li>
              <li>Generating NOVA AI insights and recommendations</li>
              <li>Processing payments and managing subscriptions</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.2 Service Improvement</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Analyzing usage patterns to improve features</li>
              <li>Training and improving NOVA AI models</li>
              <li>Identifying and fixing technical issues</li>
              <li>Developing new features and functionality</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.3 Communication</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sending service updates and notifications</li>
              <li>Responding to support requests</li>
              <li>Sending marketing communications (with your consent)</li>
              <li>Notifying you of changes to our terms or policies</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.4 Security and Legal Compliance</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Preventing fraud and abuse</li>
              <li>Enforcing our Terms of Service</li>
              <li>Complying with legal obligations</li>
              <li>Protecting our rights and property</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. How We Share Your Information</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mb-4">
              <p className="font-semibold text-blue-400 mb-2">Important:</p>
              <p>We do NOT sell your personal trading data to third parties.</p>
            </div>

            <p className="mb-4">We may share your information with:</p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.1 Service Providers</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Supabase: Database and authentication services</li>
              <li>Stripe: Payment processing</li>
              <li>Cloud providers: Data hosting and storage</li>
              <li>Analytics providers: Usage analytics and monitoring</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.2 Legal Requirements</h3>
            <p className="mb-4">We may disclose your information if required to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with legal obligations or court orders</li>
              <li>Protect our rights, property, or safety</li>
              <li>Prevent fraud or illegal activities</li>
              <li>Respond to government requests</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.3 Business Transfers</h3>
            <p>
              In the event of a merger, acquisition, or sale of assets, your information may be transferred.
              We will notify you before your information becomes subject to a different privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Security</h2>
            <p className="mb-4">We implement industry-standard security measures to protect your information:</p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.1 Technical Measures</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption: All data transmitted using TLS/SSL encryption</li>
              <li>Database Security: Encrypted at rest, access controls, regular backups</li>
              <li>Authentication: Secure password hashing, multi-factor authentication support</li>
              <li>Monitoring: Continuous security monitoring and threat detection</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.2 Organizational Measures</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Limited access to personal data on a need-to-know basis</li>
              <li>Regular security audits and assessments</li>
              <li>Employee training on data protection</li>
              <li>Incident response procedures</li>
            </ul>

            <p className="mt-4 text-sm">
              Note: While we use reasonable efforts to protect your information, no method of transmission over the
              internet or electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
            <p className="mb-4">We retain your information for as long as necessary to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide our services to you</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce agreements</li>
              <li>Maintain business records</li>
            </ul>
            <p className="mt-4">
              After account deletion, we may retain anonymized, aggregated data for analytics and service improvement.
              Personal data is deleted within 90 days of account closure, except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Your Privacy Rights</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">7.1 Access and Control</h3>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal information</li>
              <li>Update or correct your information</li>
              <li>Delete your account and data</li>
              <li>Export your trading data</li>
              <li>Opt-out of marketing communications</li>
              <li>Disable or disconnect broker connections</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">7.2 Regional Rights</h3>
            <p className="mb-4">Depending on your location, you may have additional rights:</p>

            <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
              <p className="font-semibold mb-2">GDPR (European Union):</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Right to data portability</li>
                <li>Right to restriction of processing</li>
                <li>Right to object to processing</li>
                <li>Right to withdraw consent</li>
                <li>Right to lodge a complaint with a supervisory authority</li>
              </ul>
            </div>

            <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
              <p className="font-semibold mb-2">CCPA (California):</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Right to know what personal information is collected</li>
                <li>Right to know if personal information is sold or disclosed</li>
                <li>Right to opt-out of the sale of personal information</li>
                <li>Right to deletion of personal information</li>
                <li>Right to non-discrimination for exercising your rights</li>
              </ul>
            </div>

            <p className="mt-4">
              To exercise these rights, contact us at tradenovaai@gmail.com. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Cookies and Tracking Technologies</h2>
            <p className="mb-4">We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain your session and keep you logged in</li>
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns and improve our Service</li>
              <li>Provide personalized content and features</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Types of Cookies We Use:</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Essential Cookies: Required for the Service to function</li>
              <li>Functional Cookies: Remember your preferences</li>
              <li>Analytics Cookies: Help us understand usage patterns</li>
              <li>Performance Cookies: Monitor and improve performance</li>
            </ul>

            <p className="mt-4">
              You can control cookies through your browser settings. Note that disabling cookies may limit Service functionality.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Analytics and Session Recording</h3>
            <p className="mb-4">
              We use Google Analytics to understand how visitors find and navigate our website, and PostHog to
              understand how the application itself is used - which features are opened, where people encounter
              difficulty, and whether they return over time.
            </p>
            <p className="mb-4">
              PostHog also records anonymized playback of app sessions, showing which elements were clicked and
              navigated. <strong className="text-white">These recordings are masked: all on-screen text and all
              form inputs are obscured before anything leaves your browser.</strong> Your trade figures, account
              balances, positions and journal entries are never captured in a recording, and the text of elements
              you click is stripped from analytics events. What we see is layout and interaction - not your
              trading data.
            </p>
            <p className="mb-4">
              Analytics identify your account only by its internal ID. We do not send your name, email address or
              any trading data to these providers.
            </p>
            <p>
              You can opt out of all analytics and session recording on any device by visiting{' '}
              <span className="text-blue-400">tradexnova.com/?noanalytics=1</span> in that browser. The preference
              is stored on your device and applies until you clear your browser data or reverse it with{' '}
              <span className="text-blue-400">?noanalytics=0</span>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Third-Party Links</h2>
            <p>
              Our Service may contain links to third-party websites or services. We are not responsible for the privacy
              practices of these third parties. We encourage you to review their privacy policies before providing any information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Children's Privacy</h2>
            <p>
              TradeX is not intended for users under 18 years of age. We do not knowingly collect personal information
              from children. If you believe we have collected information from a child, please contact us immediately
              and we will delete the information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. International Data Transfers</h2>
            <p className="mb-4">
              Your information may be transferred to and processed in countries other than your country of residence.
              These countries may have different data protection laws. By using our Service, you consent to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The transfer of your information to our facilities and service providers</li>
              <li>Processing of your information in other jurisdictions</li>
              <li>Application of the privacy laws of the jurisdiction where data is processed</li>
            </ul>
            <p className="mt-4">
              We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. AI and Machine Learning</h2>
            <p className="mb-4">
              NOVA, our AI assistant, analyzes your trading data to provide insights. Important notes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your data is used to generate personalized insights for you</li>
              <li>Aggregated, anonymized data may be used to improve AI models</li>
              <li>Your individual trading data is not shared with other users</li>
              <li>AI insights are analytical tools, not financial advice</li>
              <li>You can opt-out of AI features at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Data Breach Notification</h2>
            <p>
              In the event of a data breach that affects your personal information, we will notify you and relevant
              authorities within 72 hours of becoming aware of the breach, as required by applicable law. We will
              provide information about the breach, its impact, and steps we are taking to address it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending an email notification to registered users</li>
              <li>Displaying a notice in the Service</li>
            </ul>
            <p className="mt-4">
              Your continued use of the Service after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. Contact Us</h2>
            <p className="mb-4">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <p><strong>Email:</strong> tradenovaai@gmail.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">16. Your Consent</h2>
            <p>
              By using TradeX, you acknowledge that you have read and understood this Privacy Policy and consent to
              the collection, use, and disclosure of your information as described herein.
            </p>
          </section>

          <div className="border-t border-white/10 pt-8 mt-12">
            <p className="text-sm text-gray-500">
              This Privacy Policy is part of our Terms of Service and should be read in conjunction with those terms.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
