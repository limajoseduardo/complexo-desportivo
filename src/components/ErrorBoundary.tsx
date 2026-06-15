import React from 'react';

export class GlobalErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-600 rounded-xl m-4 border border-red-200 shadow-sm flex flex-col items-center text-center">
          <h1 className="text-xl font-black mb-2 uppercase tracking-widest text-red-700">Erro de Interface</h1>
          <p className="text-xs font-bold mb-4 opacity-80">Ocorreu um erro ao carregar este componente.</p>
          <pre className="text-[10px] overflow-auto bg-white p-4 rounded-lg shadow-inner max-w-full text-left font-mono">{this.state.error?.message}</pre>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
