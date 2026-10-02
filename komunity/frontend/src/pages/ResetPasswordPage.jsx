import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token || !email) {
    return (
      <div className="text-center animate-fade-in">
        <h1 className="font-display font-extrabold text-2xl text-white mb-2">Invalid reset link</h1>
        <p className="text-sm text-gray-400 mb-6">
          This password reset link is missing required parameters. Please request a new one.
        </p>
        <Link to="/forgot-password" className="btn-primary text-sm">
          Request new link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword({ email, token, newPassword });
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-6">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <h1 className="font-display font-extrabold text-2xl text-white mb-2">Password reset!</h1>
        <p className="text-sm text-gray-400 mb-6">
          Your password has been updated successfully. You can now sign in with your new password.
        </p>
        <Link to="/login" className="btn-primary text-sm inline-flex gap-2">
          <ArrowLeft size={14} /> Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-display font-extrabold text-2xl text-white text-center mb-2">
        Reset your password
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter a new password for <strong className="text-gray-300">{email}</strong>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">New Password</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Confirm Password</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={isLoading}>
          <Lock size={14} />
          {isLoading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
