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
    <div className="flex min-h-[100dvh] flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-white">LiftLogic</h1>
        <p className="mt-1 text-[14px] text-zinc-400">Locked</p>

        <form onSubmit={onSubmit} className="mt-7">
          <div className="well relative flex items-center px-4 focus-within:border-zinc-500">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => onPasswordChange(e.target.value)}
              className="w-full bg-transparent py-3.5 pr-10 text-[16px] text-white placeholder-zinc-500 focus:outline-none"
              placeholder="Enter password to unlock"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="btn-quiet absolute right-2 p-2"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" className="btn-primary mt-4 w-full py-4 text-[16px]">
            Unlock app
          </button>
        </form>
      </div>
    </div>
  );
};
