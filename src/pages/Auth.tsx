import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/auth';
import Button from '../components/shared/Button';
import PasswordStrengthIndicator, { isPasswordValid } from '../components/auth/PasswordStrengthIndicator';
import EarlyAccessModal from '../components/shared/EarlyAccessModal';
import { LogIn, UserPlus, Eye, EyeOff, Lock } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'verify-code' | 'reset-password';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const [authMode, setAuthMode] = useState<AuthMode>(mode === 'signup' ? 'signup' : 'login');
  const [hasEarlyAccess, setHasEarlyAccess] = useState(false);
  const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    const earlyAccess = localStorage.getItem('tradex_early_access');
    setHasEarlyAccess(earlyAccess === 'granted');
  }, []);

  const handleEarlyAccessSuccess = () => {
    setHasEarlyAccess(true);
    setShowEarlyAccessModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (authMode === 'login') {
        await signIn(email, password);
        setTimeout(() => navigate('/dashboard'), 100);
      } else if (authMode === 'signup') {
        if (!isPasswordValid(password)) {
          setError('Please ensure your password meets all requirements');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (!termsAccepted) {
          setError('Please accept the Terms of Service and Privacy Policy');
          setLoading(false);
          return;
        }
        await signUp(email, password);
        setTimeout(() => navigate('/dashboard'), 100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: 'request', email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset code');
      }

      setResetEmail(email);
      setAuthMode('verify-code');
      setSuccess('A verification code has been sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: 'verify', email: resetEmail, code: resetCode }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid or expired code');
      }

      setAuthMode('reset-password');
      setSuccess('Code verified! Enter your new password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isPasswordValid(newPassword)) {
      setError('Please ensure your password meets all requirements');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'reset',
            email: resetEmail,
            code: resetCode,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess('Password reset successful! You can now sign in');
      setAuthMode('login');
      setEmail(resetEmail);
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: 'request', email: resetEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }

      setSuccess('A new verification code has been sent to your email');
      setResetCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const renderLoginForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-blue-400 bg-blue-400/10 p-3 rounded-lg">
          {success}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={loading}
        icon={<LogIn size={16} />}
      >
        Sign In
      </Button>

      <button
        type="button"
        onClick={() => {
          setAuthMode('forgot-password');
          setError('');
          setSuccess('');
        }}
        className="w-full text-sm text-gray-400 hover:text-white transition-colors"
      >
        Forgot your password?
      </button>
    </form>
  );

  const renderSignupForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <PasswordStrengthIndicator password={password} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Confirm Password
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {confirmPassword && password !== confirmPassword && (
          <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
        )}
        {confirmPassword && password === confirmPassword && (
          <p className="mt-1 text-xs text-blue-400">Passwords match</p>
        )}
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="terms"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-blue-400 focus:ring-blue-400/50"
        />
        <label htmlFor="terms" className="text-sm text-gray-400">
          I agree to the{' '}
          <Link to="/terms" className="text-blue-400 hover:underline" target="_blank">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-blue-400 hover:underline" target="_blank">
            Privacy Policy
          </Link>
        </label>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={loading}
        icon={<UserPlus size={16} />}
      >
        Create Account
      </Button>
    </form>
  );

  const renderForgotPasswordForm = () => (
    <form onSubmit={handleForgotPassword} className="space-y-4">
      <p className="text-sm text-gray-400 mb-4">
        Enter your email address and we'll send you a verification code to reset your password.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          required
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-blue-400 bg-blue-400/10 p-3 rounded-lg">
          {success}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={loading}
      >
        Send Reset Code
      </Button>

      <button
        type="button"
        onClick={() => {
          setAuthMode('login');
          setError('');
          setSuccess('');
        }}
        className="w-full text-sm text-gray-400 hover:text-white transition-colors"
      >
        Back to sign in
      </button>
    </form>
  );

  const renderVerifyCodeForm = () => (
    <form onSubmit={handleVerifyCode} className="space-y-4">
      <p className="text-sm text-gray-400 mb-4">
        Enter the 6-digit code sent to <span className="text-white">{resetEmail}</span>
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Verification Code
        </label>
        <input
          type="text"
          value={resetCode}
          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="input-field text-center text-2xl tracking-[0.5em] font-mono"
          placeholder="000000"
          maxLength={6}
          required
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-blue-400 bg-blue-400/10 p-3 rounded-lg">
          {success}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={loading}
        disabled={resetCode.length !== 6}
      >
        Verify Code
      </Button>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setAuthMode('forgot-password');
            setError('');
            setSuccess('');
            setResetCode('');
          }}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Change email
        </button>
        <button
          type="button"
          onClick={handleResendCode}
          disabled={loading}
          className="text-sm text-blue-400 hover:text-blue-400/80 transition-colors disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </form>
  );

  const renderResetPasswordForm = () => (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <p className="text-sm text-gray-400 mb-4">
        Create a new password for your account.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          New Password
        </label>
        <div className="relative">
          <input
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <PasswordStrengthIndicator password={newPassword} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          className="input-field"
          required
        />
        {confirmNewPassword && newPassword !== confirmNewPassword && (
          <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
        )}
        {confirmNewPassword && newPassword === confirmNewPassword && (
          <p className="mt-1 text-xs text-blue-400">Passwords match</p>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-blue-400 bg-blue-400/10 p-3 rounded-lg">
          {success}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={loading}
      >
        Reset Password
      </Button>
    </form>
  );

  const getTitle = () => {
    switch (authMode) {
      case 'login':
        return 'Welcome Back';
      case 'signup':
        return 'Create Account';
      case 'forgot-password':
        return 'Reset Password';
      case 'verify-code':
        return 'Enter Code';
      case 'reset-password':
        return 'New Password';
      default:
        return 'Welcome';
    }
  };

  const getSubtitle = () => {
    switch (authMode) {
      case 'login':
        return 'Sign in to access your trading dashboard';
      case 'signup':
        return 'Start your trading journey with TradeX';
      case 'forgot-password':
        return 'We\'ll send you a code to reset your password';
      case 'verify-code':
        return 'Check your email for the verification code';
      case 'reset-password':
        return 'Choose a strong password for your account';
      default:
        return '';
    }
  };

  if (!hasEarlyAccess) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-6 sm:mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="text-blue-400" size={32} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Early Access Required</h1>
              <p className="text-sm sm:text-base text-gray-400">
                TradeX is currently in early access. Enter your access code to continue.
              </p>
            </div>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 sm:p-6 text-center">
              <Button
                onClick={() => setShowEarlyAccessModal(true)}
                variant="primary"
                fullWidth
                icon={<Lock size={16} />}
              >
                Enter Access Code
              </Button>

              <p className="mt-6 text-sm text-gray-400">
                Don't have an access code?{' '}
                <Link to="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Join our waitlist
                </Link>
              </p>
            </div>
          </motion.div>
        </div>

        <EarlyAccessModal
          isOpen={showEarlyAccessModal}
          onClose={() => setShowEarlyAccessModal(false)}
          onSuccess={handleEarlyAccessSuccess}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
        key={authMode}
      >
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{getTitle()}</h1>
          <p className="text-sm sm:text-base text-gray-400">{getSubtitle()}</p>
        </div>

        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 sm:p-6">
          {authMode === 'login' && renderLoginForm()}
          {authMode === 'signup' && renderSignupForm()}
          {authMode === 'forgot-password' && renderForgotPasswordForm()}
          {authMode === 'verify-code' && renderVerifyCodeForm()}
          {authMode === 'reset-password' && renderResetPasswordForm()}

          {(authMode === 'login' || authMode === 'signup') && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setError('');
                  setSuccess('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {authMode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
