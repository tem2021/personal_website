/// <reference types="vite/client" />

declare module '*.json' {
  const value: unknown;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_DEMO_VIDEO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
