import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Instagram, Lock } from 'lucide-react';
import Wordmark from '../shared/Wordmark';
import EarlyAccessModal from '../shared/EarlyAccessModal';
import { useHasLaunched } from '../../lib/launch';

export default function Footer() {
  const launched = useHasLaunched();
  const [showEarlyAccess, setShowEarlyAccess] = useState(false);
  const navigate = useNavigate();

  const handleEarlyAccessSuccess = () => {
    setShowEarlyAccess(false);
    navigate('/auth');
  };

  return (
    <footer className="bg-black border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/*
          Four columns now, not two. The credibility pages live here rather
          than in the top nav on purpose: a nav link on a landing page is an
          exit taken before anything has been read, but somebody who has
          scrolled all the way to the footer is deciding, and this is exactly
          where they go looking for the security and pricing pages.
        */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-flex items-center">
              <Wordmark className="text-xl" />
            </Link>
            <p className="mt-4 text-[13px] text-gray-500 max-w-xs leading-relaxed">
              A trading journal built around psychology. Talk through the trade,
              and TradeX finds the pattern costing you money.
            </p>
            <div className="mt-6 flex space-x-6">
              <a
                href="https://www.instagram.com/tradexnova/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-white transition-colors"
              >
                <span className="sr-only">Instagram</span>
                <Instagram size={20} />
              </a>
            </div>
          </div>

          <div className="col-span-1">
            <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.18em]">Product</h3>
            <ul className="mt-4 space-y-2">
              {[
                ['/features', 'Features'],
                ['/nova', 'Nova AI'],
                ['/pricing', 'Pricing'],
                ['/security', 'Security'],
              ].map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="text-[13px] text-gray-400 hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-1">
            <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.18em]">Company</h3>
            <ul className="mt-4 space-y-2">
              {[
                ['/about', 'About'],
                ['/faq', 'FAQ'],
                ['/for-prop-firm-traders', 'For prop traders'],
                ['/affiliates', 'Affiliates'],
              ].map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="text-[13px] text-gray-400 hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-1">
            <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.18em]">Legal</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link to="/privacy" className="text-[13px] text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms" className="text-[13px] text-gray-400 hover:text-white transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link to="/risk-disclaimer" className="text-[13px] text-gray-400 hover:text-white transition-colors">Risk Disclaimer</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} TradeX. All rights reserved.
            </p>
            <div className="flex flex-col md:flex-row items-center gap-4 mt-4 md:mt-0">
              {/*
                Gone once the site is open. The access code existed to let a
                few people in before launch; afterwards it is a locked door
                next to an unlocked one, and it invites visitors to hunt for a
                code instead of just signing up.

                `launched` was already computed here and simply never used -
                the typecheck flagged it as an unused variable, which is what
                a gate that was written but never wired up looks like.
              */}
              {!launched && (
                <button
                  onClick={() => setShowEarlyAccess(true)}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Lock size={14} />
                  Early Access
                </button>
              )}
              <p className="text-sm text-gray-400">
                Designed with precision. Built for traders.
              </p>
            </div>
          </div>
        </div>
      </div>

      <EarlyAccessModal
        isOpen={showEarlyAccess}
        onClose={() => setShowEarlyAccess(false)}
        onSuccess={handleEarlyAccessSuccess}
      />
    </footer>
  );
}