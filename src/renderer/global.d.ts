import type { LazaVaultApi } from "../shared/contracts";

declare global {
  interface Window {
    lazaVault: LazaVaultApi;
  }
}

export {};
