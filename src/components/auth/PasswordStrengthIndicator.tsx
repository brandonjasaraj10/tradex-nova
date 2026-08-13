import { useMemo } from 'react';
import { Check, X } from 'lucide-react';

type PasswordStrengthIndicatorProps = {
  password: string;
};

type Requirement = {
  label: string;
  met: boolean;
};

export function getPasswordStrength(password: string): { score: number; requirements: Requirement[] } {
  const requirements: Requirement[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains a number', met: /[0-9]/.test(password) },
  ];

  const score = requirements.filter(r => r.met).length;
  return { score, requirements };
}

export function isPasswordValid(password: string): boolean {
  const { score } = getPasswordStrength(password);
  return score === 4;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { score, requirements } = useMemo(() => getPasswordStrength(password), [password]);

  const getStrengthColor = () => {
    return score === 4 ? 'bg-blue-500' : 'bg-gray-500';
  };

  const getStrengthLabel = () => {
    return score === 4 ? 'Strong' : 'Weak';
  };

  if (!password) return null;

  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${(score / 4) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${score === 4 ? 'text-blue-400' : 'text-gray-400'}`}>
          {getStrengthLabel()}
        </span>
      </div>

      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check size={12} className="text-blue-400" />
            ) : (
              <X size={12} className="text-gray-500" />
            )}
            <span className={req.met ? 'text-gray-300' : 'text-gray-500'}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
