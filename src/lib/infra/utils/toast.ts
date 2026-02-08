import { toast } from 'sonner'

type ToastType = 'success' | 'error' | 'info' | 'warning'

export const showToast = (
  type: ToastType,
  message: string,
  options: {
    description?: string
    duration?: number
    action?: {
      label: string
      onClick: () => void
    }
  } = {}
) => {
  const { description, duration = 5000, action } = options
  
  const toastOptions = {
    description,
    duration,
    ...(action && {
      action: {
        label: action.label,
        onClick: action.onClick,
      },
    }),
  }

  switch (type) {
    case 'success':
      toast.success(message, toastOptions)
      break
    case 'error':
      toast.error(message, toastOptions)
      break
    case 'info':
      toast.info(message, toastOptions)
      break
    case 'warning':
      toast.warning(message, toastOptions)
      break
    default:
      toast(message, toastOptions)
  }
}

// Helper functions for common toast types
export const toastSuccess = (message: string, description?: string) =>
  showToast('success', message, { description })

export const toastError = (message: string, description?: string) =>
  showToast('error', message, { description })

export const toastInfo = (message: string, description?: string) =>
  showToast('info', message, { description })

export const toastWarning = (message: string, description?: string) =>
  showToast('warning', message, { description })
