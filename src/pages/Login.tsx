import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/lib/auth';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    const success = login(password);
    if (success) {
      onLogin();
      navigate('/', { replace: true });
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
              <Lock className="h-7 w-7 text-[var(--color-primary)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">منصة ذكاء التجارة</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">أدخل كلمة المرور للمتابعة</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false); }}
                placeholder="كلمة المرور"
                className="flex h-11 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent pl-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-[var(--color-danger)] text-center">كلمة المرور غير صحيحة</p>
            )}

            <button
              type="submit"
              disabled={!password}
              className="w-full h-11 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              دخول
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
