import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type ToastType } from '../../stores/toastStore';

const toastConfig: Record<ToastType, { icon: typeof CheckCircle2; bg: string; text: string; border: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-success-950/80', text: 'text-success-300', border: 'border-success-600/30' },
  error: { icon: XCircle, bg: 'bg-error-950/80', text: 'text-error-300', border: 'border-error-600/30' },
  warning: { icon: AlertTriangle, bg: 'bg-warning-950/80', text: 'text-warning-300', border: 'border-warning-600/30' },
  info: { icon: Info, bg: 'bg-primary-950/80', text: 'text-primary-300', border: 'border-primary-600/30' },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type];
        const Icon = config.icon;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-lg border ${config.border} ${config.bg} px-4 py-3 shadow-elevated backdrop-blur-md animate-slide-up`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${config.text}`} />
            <p className="text-sm text-gray-100">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-gray-500 transition-colors hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
