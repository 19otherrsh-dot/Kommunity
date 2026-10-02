import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/contexts/authStore';
import toast from 'react-hot-toast';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, socialLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();


  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.ok) {
      toast.success('Welcome back!');
      navigate('/discover');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="card animate-slide-up">
      <h2 className="font-display font-bold text-xl text-white mb-1">Sign in</h2>
      <p className="text-sm text-gray-500 mb-6">Enter your details to continue</p>



      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full justify-center" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="text-right">
          <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-brand-400 transition-colors">
            Forgot password?
          </Link>
        </div>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-400 hover:text-brand-300 transition-colors">
          Create one free
        </Link>
      </p>
    </div>
  );
}
