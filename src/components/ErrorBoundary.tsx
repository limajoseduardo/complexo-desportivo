import React from 'react';

type ReactNode = React.ReactNode;

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: object) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    const { hasError, error } = (this as any).state as State;
    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-in fade-in zoom-in-95">
          <h1 className="text-xl font-black mb-2 uppercase tracking-widest text-red-700">Erro de Interface</h1>
          <p className="text-xs font-bold mb-4 opacity-80">Ocorreu um erro ao carregar este componente.</p>
          <pre className="text-[10px] overflow-auto bg-white p-4 rounded-lg shadow-inner max-w-full text-left font-mono">{error?.message}</pre>
          <div className="flex gap-4 w-full justify-center">
            <button
              onClick={() => (this as any).setState({ hasError: false, error: null })}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}
