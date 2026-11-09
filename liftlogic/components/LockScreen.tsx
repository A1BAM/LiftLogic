import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Bubbles } from './Bubbles';

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
    <div className="relative flex min-h-[100dvh] flex-col justify-center px-6">
      <Bubbles />
      <div className="glass relative mx-auto w-full max-w-sm px-6 py-7">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-aero-900">LiftLogic</h1>
        <p className="mt-0.5 text-[14px] text-aero-700">Locked</p>

        <form onSubmit={onSubmit} className="mt-7">
          <div className="well relative flex items-center px-4 focus-within:ring-2 focus-within:ring-aero-300">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => onPasswordChange(e.target.value)}
              className="w-full bg-transparent py-3.5 pr-10 text-[16px] text-aero-900 placeholder-aero-400 focus:outline-none"
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

          <button type="submit" className="btn-gel mt-5 w-full py-3.5 text-[15px]">
            Unlock app
          </button>
        </form>
      </div>
    </div>
  );
};
