import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/api';
import { Mail, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-6">
          <Mail size={28} className="text-green-400" />
        </div>
        <h1 className="font-display font-extrabold text-2xl text-white mb-2">Check your inbox</h1>
        <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
          If an account exists for <strong className="text-gray-200">{email}</strong>, we've sent a password reset link. It expires in 1 hour.
        </p>
        <Link to="/login" className="btn-secondary text-sm inline-flex gap-2">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-display font-extrabold text-2xl text-white text-center mb-2">
        Forgot password?
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter your email and we'll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Email</label>
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={isLoading}>
          {isLoading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-4">
        Remember your password?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
      </p>
    </div>
  );
}
