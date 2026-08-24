import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Instagram, Lock } from 'lucide-react';
import Logo from '../shared/Logo';
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
    <footer className="bg-dark-700 border-t border-dark-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="col-span-1">
            <Link to="/" className="flex items-center">
              <Logo className="h-8 w-auto" />
              <span className="ml-2 text-xl font-bold text-white">TradeX</span>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              AI-powered trading journal for the modern trader. Track, analyze, and improve your performance.
            </p>
            <div className="mt-6 flex space-x-6">
              <a
                href="https://www.instagram.com/tradexnova/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gold-400 transition-colors"
              >
                <span className="sr-only">Instagram</span>
                <Instagram size={20} />
              </a>
            </div>
          </div>

          <div className="col-span-1">
            <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider">Legal</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link to="/privacy" className="text-gray-300 hover:text-gold-300 transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-300 hover:text-gold-300 transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link to="/risk-disclaimer" className="text-gray-300 hover:text-gold-300 transition-colors">Risk Disclaimer</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-dark-300">
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