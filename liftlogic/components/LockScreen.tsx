import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface LockScreenProps {
  password: string;
  onPasswordChange: (next: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Deliberately almost empty. It is seen for two seconds at a time and has
 * exactly one job, so there is nothing to look at but the field.
 */
export const LockScreen: React.FC<LockScreenProps> = ({ password, onPasswordChange, onSubmit }) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="flex min-h-screen flex-col justify-center px-7">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-100">LiftLogic</h1>
        <p className="mt-1 text-[13px] text-zinc-600">Locked</p>

        <form onSubmit={onSubmit} className="mt-8">
          <div className="relative flex items-center border-b border-ink-700 focus-within:border-zinc-500 transition-colors">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => onPasswordChange(e.target.value)}
              className="w-full bg-transparent py-3 pr-10 text-[17px] text-zinc-50 placeholder-zinc-700 focus:outline-none"
              placeholder="Enter password to unlock"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="btn-quiet absolute right-0 p-2"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" className="btn-primary mt-5 w-full py-3.5 text-[15px]">
            Unlock app
          </button>
        </form>
      </div>
    </div>
  );
};
