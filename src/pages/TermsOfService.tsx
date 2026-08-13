import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/layout/Footer';

export default function TermsOfService() {
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

        <h1 className="text-4xl sm:text-5xl font-bold mb-4">Terms of Service</h1>
        <p className="text-gray-400 mb-8">Last Updated: August 13, 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using TradeX ("Service"), you accept and agree to be bound by the terms and provision of this agreement.
              If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="mb-4">
              TradeX provides a trading journal and analytics platform with AI-powered insights. The Service allows users to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Log and track trading activities</li>
              <li>Analyze trading performance and psychology</li>
              <li>Receive AI-powered insights through NOVA</li>
              <li>Connect with supported trading platforms</li>
              <li>Access trading analytics and reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Trading Disclaimer</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mb-4">
              <p className="font-semibold text-blue-400 mb-2">IMPORTANT NOTICE:</p>
              <p className="mb-4">
                TradeX is a journaling and analytics tool ONLY. We do not provide investment advice, trading signals,
                or recommendations to buy or sell any financial instruments.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Trading involves substantial risk of loss and is not suitable for all investors</li>
                <li>Past performance is not indicative of future results</li>
                <li>You should carefully consider your financial situation before trading</li>
                <li>All trading decisions are made at your own discretion and risk</li>
                <li>NOVA's insights are analytical tools, not financial advice</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. User Account and Security</h2>
            <p className="mb-4">
              You are responsible for maintaining the confidentiality of your account and password. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Be responsible for all activities that occur under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Subscription and Payment Terms</h2>
            <p className="mb-4">
              TradeX offers subscription-based access to the Service:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Subscriptions are billed on a monthly basis</li>
              <li>A 7-day free trial is offered to new users</li>
              <li>Payment is processed through Stripe, a third-party payment processor</li>
              <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
              <li>You can cancel your subscription at any time from your account settings</li>
              <li>Refunds are provided on a case-by-case basis at our discretion</li>
              <li>We reserve the right to change pricing with 30 days notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Ownership and Usage</h2>
            <p className="mb-4">
              You retain all rights to your trading data. By using the Service, you grant us permission to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Store and process your data to provide the Service</li>
              <li>Use aggregated, anonymized data for service improvement</li>
              <li>Analyze your data through NOVA to provide insights</li>
              <li>Backup your data for disaster recovery purposes</li>
            </ul>
            <p className="mt-4">
              We will never sell your personal trading data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Prohibited Uses</h2>
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to the Service or systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Reverse engineer or decompile any part of the Service</li>
              <li>Share your account credentials with others</li>
              <li>Use automated systems or bots without permission</li>
              <li>Misrepresent your identity or affiliation</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Intellectual Property</h2>
            <p className="mb-4">
              The Service, including all content, features, and functionality, is owned by TradeX and protected by
              international copyright, trademark, and other intellectual property laws.
            </p>
            <p>
              You may not copy, modify, distribute, sell, or lease any part of our Service without explicit written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Service Availability</h2>
            <p className="mb-4">
              We strive to provide continuous service availability, but we do not guarantee:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Uninterrupted or error-free operation</li>
              <li>That defects will be corrected immediately</li>
              <li>That the Service will meet your specific requirements</li>
              <li>The accuracy or completeness of AI-generated insights</li>
            </ul>
            <p className="mt-4">
              We may modify, suspend, or discontinue the Service at any time with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Limitation of Liability</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRADEX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY,
                OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p className="mb-4">
                THIS INCLUDES BUT IS NOT LIMITED TO DAMAGES RESULTING FROM:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Trading losses or missed trading opportunities</li>
                <li>Errors in data, analytics, or AI insights</li>
                <li>Service interruptions or data loss</li>
                <li>Unauthorized access to your account</li>
                <li>Third-party broker connection issues</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Indemnification</h2>
            <p>
              You agree to indemnify and hold TradeX harmless from any claims, losses, liability, damages, and expenses
              arising from your use of the Service, violation of these Terms, or violation of any rights of another party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Termination</h2>
            <p className="mb-4">
              We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violation of these Terms</li>
              <li>Fraudulent or illegal activity</li>
              <li>Non-payment of fees</li>
              <li>At your request</li>
            </ul>
            <p className="mt-4">
              Upon termination, your right to use the Service will immediately cease. We may delete your data after
              a reasonable retention period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of material changes via
              email or through the Service. Your continued use of the Service after changes constitutes acceptance
              of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which
              TradeX operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. Dispute Resolution</h2>
            <p className="mb-4">
              Any disputes arising from these Terms or the Service shall be resolved through:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Good faith negotiation between the parties</li>
              <li>Binding arbitration if negotiation fails</li>
              <li>Individual basis only (no class actions)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">16. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited
              or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">17. Contact Information</h2>
            <p className="mb-4">
              For questions about these Terms, please contact us at:
            </p>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p>Email: tradenovaai@gmail.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">18. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and TradeX
              regarding the use of the Service.
            </p>
          </section>

          <div className="border-t border-white/10 pt-8 mt-12">
            <p className="text-sm text-gray-500">
              By using TradeX, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
