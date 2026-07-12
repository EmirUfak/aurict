import type { AurictWindowApi } from '../shared/ipc-types.js';

declare global {
  interface Window {
    aurict: AurictWindowApi;
  }
}

export {};
