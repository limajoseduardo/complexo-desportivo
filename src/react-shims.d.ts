declare module 'react' {
  export type ReactNode = any;
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type PropsWithChildren<P> = P & { children?: ReactNode };
  export interface Attributes {
    key?: any;
  }

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useRef<T>(initialValue: T | null): { current: T | null };
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export interface ChangeEvent<T = Element> {
    target: T;
  }
  export function memo<T>(component: T): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export const Fragment: any;
  export const Children: any;
  export const createElement: any;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: any[]): void;
  export default any;
}

declare module 'react-dom' {
  const ReactDOM: any;
  export default ReactDOM;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const jsxDEV: any;
}

declare module 'react/jsx-dev-runtime' {
  export const jsxDEV: any;
  export const jsx: any;
  export const jsxs: any;
}

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: any;
    }

    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
