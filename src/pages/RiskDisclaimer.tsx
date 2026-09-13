import { AlertTriangle } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import LegalProse from '../components/layout/LegalProse';

export default function RiskDisclaimer() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Risk Disclaimer"
      meta="Last updated 13 August 2026"
    >
      {/*
        The warning sits above the prose rather than inside it. It is the one
        part of this page a regulator, and a reader, expects to see without
        scrolling - burying it as section zero would defeat the point of
        having it. Blue rather than red because blue is the product's only
        accent; a red alert box here would be the single loudest thing on the
        whole site.
      */}
      <div className="mb-10 rounded-2xl border border-brand-blue-light/25 bg-brand-blue/[0.07] p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <AlertTriangle className="w-4 h-4 text-brand-blue-light flex-shrink-0" />
          <p className="text-[10px] tracking-[0.16em] uppercase text-brand-blue-light font-medium">
            Important risk warning
          </p>
        </div>
        <p className="text-[14.5px] sm:text-[15px] leading-[1.7] text-gray-200">
          Trading financial instruments involves substantial risk and is not suitable
          for all investors. You may lose some or all of your invested capital. Past
          performance is not indicative of future results. Please read this entire
          disclaimer carefully before using TradeX.
        </p>
      </div>

      <LegalProse>
          <section>
            <h2>1. Nature of the Service</h2>
            <p className="mb-4">
              TradeX is a <strong>trading journal and analytics platform only</strong>. We provide:
            </p>
            <ul>
              <li>Tools to record and analyze your trading activities</li>
              <li>Statistical analysis of your trading performance</li>
              <li>AI-powered insights about your trading psychology and patterns</li>
              <li>Data visualization and reporting features</li>
            </ul>
            <p className="mt-4 font-semibold">
              TradeX does NOT provide investment advice, trading recommendations, or financial guidance of any kind.
            </p>
          </section>

          <section>
            <h2>2. Not Financial Advice</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mb-4">
              <p className="mb-4">
                <strong>NOVA AI and all other features of TradeX are analytical tools only.</strong> They are NOT:
              </p>
              <ul>
                <li>Investment advice or recommendations</li>
                <li>Trading signals or buy/sell indicators</li>
                <li>Financial planning or wealth management services</li>
                <li>Professional trading guidance</li>
                <li>Predictions about future market movements</li>
                <li>Guarantees of trading profitability</li>
              </ul>
            </div>
            <p>
              All insights, statistics, and patterns identified by TradeX are based solely on your historical data
              and should be used as reference information only. You are solely responsible for all trading decisions.
            </p>
          </section>

          <section>
            <h2>3. Trading Risks</h2>

            <h3>3.1 General Trading Risks</h3>
            <ul>
              <li><strong>Capital Loss:</strong> You can lose all of your invested capital</li>
              <li><strong>Leverage Risk:</strong> Leveraged trading magnifies both gains and losses</li>
              <li><strong>Market Volatility:</strong> Markets can move rapidly against your positions</li>
              <li><strong>Liquidity Risk:</strong> You may not be able to exit positions when desired</li>
              <li><strong>Gap Risk:</strong> Markets can gap beyond your stop-loss orders</li>
              <li><strong>Systemic Risk:</strong> Broader market or economic events can affect your positions</li>
            </ul>

            <h3>3.2 Specific Market Risks</h3>
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="font-semibold mb-2">Forex Trading:</p>
                <p className="text-sm">
                  Currency trading involves high leverage, 24-hour volatility, and geopolitical risks. Most retail forex
                  traders lose money. Exchange rates can be affected by numerous unpredictable factors.
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="font-semibold mb-2">Cryptocurrency Trading:</p>
                <p className="text-sm">
                  Cryptocurrencies are highly volatile, unregulated in many jurisdictions, and subject to technological
                  risks including hacking, regulatory changes, and market manipulation. Prices can move dramatically in
                  short periods.
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="font-semibold mb-2">Options and Futures:</p>
                <p className="text-sm">
                  Derivatives trading involves complex financial instruments with substantial risks. Options can expire
                  worthless. Futures trading involves margin calls and potentially unlimited losses.
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="font-semibold mb-2">Stock Trading:</p>
                <p className="text-sm">
                  Equity markets can be affected by company-specific events, sector trends, economic data, and market
                  sentiment. Individual stocks can lose significant value or become worthless.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2>4. No Performance Guarantees</h2>
            <p className="mb-4">
              <strong>Past performance is not indicative of future results.</strong> The fact that:
            </p>
            <ul>
              <li>You had profitable trades in the past does not guarantee future profits</li>
              <li>A trading strategy worked historically does not mean it will work in the future</li>
              <li>NOVA identified certain patterns does not mean those patterns will continue</li>
              <li>Your statistics show a high win rate does not guarantee continued success</li>
              <li>Other traders are profitable does not mean you will be profitable</li>
            </ul>
            <p className="mt-4">
              Market conditions constantly change, and strategies that worked in one market environment may fail in another.
            </p>
          </section>

          <section>
            <h2>5. AI-Generated Insights</h2>
            <p className="mb-4">
              NOVA's AI-generated insights are based on pattern recognition and statistical analysis of your data.
              Important limitations:
            </p>
            <ul>
              <li>AI insights are probabilistic, not deterministic</li>
              <li>Correlations identified do not imply causation</li>
              <li>AI cannot predict unexpected market events or "black swan" scenarios</li>
              <li>Psychology insights are generalizations and may not apply to all situations</li>
              <li>AI is trained on historical data and cannot account for unprecedented events</li>
              <li>Technical errors or data issues may affect AI accuracy</li>
            </ul>
            <p className="mt-4 font-semibold">
              Never make trading decisions based solely on AI-generated insights. Always conduct your own analysis and
              consider multiple factors.
            </p>
          </section>

          <section>
            <h2>6. Data Accuracy</h2>
            <p className="mb-4">
              While we strive for accuracy, we cannot guarantee:
            </p>
            <ul>
              <li>100% accuracy of data imported from broker connections</li>
              <li>Real-time data updates (there may be delays)</li>
              <li>Absence of technical errors or glitches</li>
              <li>Accuracy of calculations or statistics</li>
              <li>Completeness of historical data</li>
            </ul>
            <p className="mt-4">
              You are responsible for verifying the accuracy of your trading data. Always cross-reference with your
              broker statements.
            </p>
          </section>

          <section>
            <h2>7. Educational Purpose</h2>
            <p>
              TradeX is designed for educational and record-keeping purposes. It helps you:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Maintain organized trading records</li>
              <li>Analyze your trading performance objectively</li>
              <li>Identify patterns in your trading behavior</li>
              <li>Track your progress over time</li>
              <li>Develop better self-awareness as a trader</li>
            </ul>
            <p className="mt-4">
              The Service is not a substitute for professional financial advice, trading education, or market research.
            </p>
          </section>

          <section>
            <h2>8. Professional Advice Recommended</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="mb-4">
                Before engaging in trading, we strongly recommend that you:
              </p>
              <ul>
                <li>Consult with a licensed financial advisor</li>
                <li>Understand your financial situation and risk tolerance</li>
                <li>Only invest money you can afford to lose</li>
                <li>Obtain proper trading education and training</li>
                <li>Start with a demo account before trading real money</li>
                <li>Understand the markets and instruments you trade</li>
                <li>Develop a comprehensive trading plan</li>
                <li>Practice proper risk management</li>
              </ul>
            </div>
          </section>

          <section>
            <h2>9. Emotional and Psychological Impact</h2>
            <p className="mb-4">
              Trading can have significant emotional and psychological effects:
            </p>
            <ul>
              <li>Trading losses can cause stress, anxiety, and emotional distress</li>
              <li>The pressure of financial risk can affect mental health</li>
              <li>Trading addiction or compulsive trading behaviors can develop</li>
              <li>Relationship and personal life impacts from trading stress</li>
              <li>Sleep disruption from monitoring markets</li>
            </ul>
            <p className="mt-4">
              While TradeX includes psychology tracking features, these are not a substitute for professional mental
              health support. If trading is negatively affecting your wellbeing, please seek professional help.
            </p>
          </section>

          <section>
            <h2>10. Regulatory Considerations</h2>
            <p className="mb-4">
              Important regulatory information:
            </p>
            <ul>
              <li>TradeX is not a registered investment advisor or broker-dealer</li>
              <li>We are not regulated by financial authorities</li>
              <li>Trading regulations vary by jurisdiction</li>
              <li>You are responsible for complying with your local laws</li>
              <li>Tax implications of trading vary by location</li>
              <li>Some jurisdictions restrict or prohibit certain types of trading</li>
            </ul>
            <p className="mt-4">
              Consult with legal and tax professionals regarding your trading activities and obligations.
            </p>
          </section>

          <section>
            <h2>11. Third-Party Brokers</h2>
            <p className="mb-4">
              When connecting your broker accounts to TradeX:
            </p>
            <ul>
              <li>We are not responsible for broker actions or policies</li>
              <li>Broker failures or issues are beyond our control</li>
              <li>Execution quality and pricing are determined by your broker</li>
              <li>We do not endorse or recommend specific brokers</li>
              <li>Conduct your own due diligence on broker selection</li>
              <li>Verify that brokers are properly regulated in your jurisdiction</li>
            </ul>
          </section>

          <section>
            <h2>12. Service Limitations</h2>
            <p className="mb-4">
              TradeX has limitations that could affect your use:
            </p>
            <ul>
              <li>Service interruptions may prevent access to your data</li>
              <li>Technical issues could result in data loss or corruption</li>
              <li>Feature limitations may not meet all your needs</li>
              <li>Integration issues with broker platforms may occur</li>
              <li>We may discontinue features or the entire service</li>
            </ul>
            <p className="mt-4 font-semibold">
              Never rely solely on TradeX for critical trading decisions. Maintain independent records and backups.
            </p>
          </section>

          <section>
            <h2>13. Statistics and Backtesting</h2>
            <p className="mb-4">
              Performance statistics and analysis provided by TradeX are based on your historical trading data:
            </p>
            <ul>
              <li>Historical statistics do not guarantee future performance</li>
              <li>Sample size and time period significantly affect reliability</li>
              <li>Survivorship bias may affect your perception of success</li>
              <li>Market conditions during your data period may not repeat</li>
              <li>Your trading behavior may change over time</li>
            </ul>
          </section>

          <section>
            <h2>14. No Liability for Trading Losses</h2>
            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-6">
              <p className="font-bold text-blue-400 mb-4">CRITICAL NOTICE:</p>
              <p className="mb-4">
                TradeX and its operators, employees, and affiliates are NOT liable for any trading losses or damages
                you may incur, including but not limited to:
              </p>
              <ul>
                <li>Direct financial losses from trading activities</li>
                <li>Losses from following patterns or insights identified by the Service</li>
                <li>Missed opportunities or timing issues</li>
                <li>Losses due to data errors or Service failures</li>
                <li>Consequential damages from using or inability to use the Service</li>
              </ul>
              <p className="mt-4 font-bold">
                YOU TRADE AT YOUR OWN RISK. YOU ARE SOLELY RESPONSIBLE FOR YOUR TRADING DECISIONS AND THEIR OUTCOMES.
              </p>
            </div>
          </section>

          <section>
            <h2>15. Your Acknowledgment</h2>
            <div className="bg-white/10 border border-white/20 rounded-lg p-6">
              <p className="mb-4 font-semibold">By using TradeX, you acknowledge and agree that:</p>
              <ul className="list-disc pl-6 space-y-3">
                <li>You have read and understood this entire Risk Disclaimer</li>
                <li>You understand the risks involved in trading financial instruments</li>
                <li>You are aware that you may lose all of your invested capital</li>
                <li>You will not hold TradeX liable for any trading losses</li>
                <li>You are using the Service as an analytical tool only</li>
                <li>You will make your own independent trading decisions</li>
                <li>You will seek professional advice before making significant financial decisions</li>
                <li>You are legally permitted to trade in your jurisdiction</li>
                <li>You accept full responsibility for your trading activities</li>
              </ul>
            </div>
          </section>

          <section>
            <h2>16. Contact Information</h2>
            <p className="mb-4">
              If you have questions about this Risk Disclaimer:
            </p>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p><strong>Email:</strong> tradenovaai@gmail.com</p>
            </div>
          </section>

          <div className="border-t border-white/10 pt-8 mt-12">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-sm font-semibold mb-2">
                This Risk Disclaimer is an integral part of our Terms of Service and should be read in conjunction
                with those terms and our Privacy Policy.
              </p>
              <p className="text-sm">
                If you do not accept the risks outlined in this disclaimer, you should not use TradeX or engage in trading activities.
              </p>
            </div>
          </div>
      </LegalProse>
    </PageShell>
  );
}
