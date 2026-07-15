import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Lock, Mail, User, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToastStore } from '../../stores/toastStore';

const signInSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [serverError, setServerError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const showToast = useToastStore((s) => s.showToast);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSignIn = async (data: SignInFormData) => {
    setServerError(null);
    try {
      await signIn(data.email, data.password);
      showToast('success', 'Welcome back!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setServerError(message);
    }
  };

  const onSignUp = async (data: SignUpFormData) => {
    setServerError(null);
    try {
      await signUp(data.email, data.password, data.displayName);
      showToast('success', 'Account created! Welcome to PersonalOS.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setServerError(message);
    }
  };

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setServerError(null);
    signInForm.reset();
    signUpForm.reset();
  };

  const isSubmitting = mode === 'signin' ? signInForm.formState.isSubmitting : signUpForm.formState.isSubmitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 px-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-secondary-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-scale-in">
        {/* Logo / Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">PersonalOS</h1>
          <p className="text-sm text-gray-500 mt-1.5">
            Your single operating system for work and life
          </p>
        </div>

        {/* Auth Card */}
        <div className="card backdrop-blur-xl bg-surface-100/80">
          {/* Tab Switcher */}
          <div className="flex gap-1 p-1 bg-surface-200/60 rounded-lg mb-6">
            <button
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-surface-400 text-white shadow-subtle'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-surface-400 text-white shadow-subtle'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {serverError && (
            <div className="mb-4 rounded-lg border border-error-600/30 bg-error-950/50 px-4 py-3 animate-slide-down">
              <p className="text-sm text-error-300">{serverError}</p>
            </div>
          )}

          {mode === 'signin' ? (
            <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
              <Field label="Email" icon={Mail} error={signInForm.formState.errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="input-field pl-10"
                  {...signInForm.register('email')}
                />
              </Field>
              <Field label="Password" icon={Lock} error={signInForm.formState.errors.password?.message}>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="input-field pl-10"
                  {...signInForm.register('password')}
                />
              </Field>
              <SubmitButton isSubmitting={isSubmitting} label="Sign In" />
            </form>
          ) : (
            <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
              <Field label="Display Name" icon={User} error={signUpForm.formState.errors.displayName?.message}>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  className="input-field pl-10"
                  {...signUpForm.register('displayName')}
                />
              </Field>
              <Field label="Email" icon={Mail} error={signUpForm.formState.errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="input-field pl-10"
                  {...signUpForm.register('email')}
                />
              </Field>
              <Field label="Password" icon={Lock} error={signUpForm.formState.errors.password?.message}>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="input-field pl-10"
                  {...signUpForm.register('password')}
                />
              </Field>
              <Field label="Confirm Password" icon={Lock} error={signUpForm.formState.errors.confirmPassword?.message}>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className="input-field pl-10"
                  {...signUpForm.register('confirmPassword')}
                />
              </Field>
              <SubmitButton isSubmitting={isSubmitting} label="Create Account" />
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          By continuing, you agree to keep your data secure and private.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  icon: typeof Mail;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        {children}
      </div>
      {error && <p className="mt-1.5 text-xs text-error-400">{error}</p>}
    </div>
  );
}

function SubmitButton({ isSubmitting, label }: { isSubmitting: boolean; label: string }) {
  return (
    <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2">
      {isSubmitting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Please wait...
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}
