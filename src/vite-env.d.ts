/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEBUG_KEYFRAMES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
