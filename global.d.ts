declare namespace JSX {
  interface Element {};
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

interface ImportMeta {
  env: Record<string, string | undefined>;
}
