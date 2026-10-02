import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/contexts/authStore';
import toast from 'react-hot-toast';


export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const { register, socialLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    const ref = new URLSearchParams(window.location.search).get('ref');
    const result = await register(form.fullName, form.email, form.password, ref);
    if (result.ok) {
      toast.success('Account created! Welcome to Komunity 🎉');
      navigate('/discover');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="card animate-slide-up">
      <h2 className="font-display font-bold text-xl text-white mb-1">Create account</h2>
      <p className="text-sm text-gray-500 mb-6">Join thousands of learners & creators</p>



      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" placeholder="Ada Lovelace" value={form.fullName} onChange={set('fullName')} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} required />
        </div>
        <button type="submit" className="btn-primary w-full justify-center" disabled={isLoading}>
          {isLoading ? 'Creating account…' : 'Get started free'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
