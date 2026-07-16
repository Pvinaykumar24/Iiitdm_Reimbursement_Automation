import { useToastStore } from '../../store/toastStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 320,
        pointerEvents: 'none'
      }}
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        
        const bg = isError ? '#FCEBEB' : isSuccess ? '#EAF3DE' : '#f3f0fc';
        const color = isError ? '#791F1F' : isSuccess ? '#27500A' : '#4C4C9D';
        const border = isError ? '1px solid #F3C3C3' : isSuccess ? '1px solid #D1E7B9' : '1px solid #D3CEF9';
        const icon = isError ? 'ti-circle-x' : isSuccess ? 'ti-circle-check' : 'ti-bell';

        return (
          <div
            key={t.id}
            style={{
              background: bg,
              color: color,
              border: border,
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 500,
              boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              pointerEvents: 'auto',
              animation: 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }} />
            <div style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: color,
                opacity: 0.6,
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <i className="ti ti-x" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
