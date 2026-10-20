"use client";

import { useSyncExternalStore } from "react";

const subscribeToReadiness = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Keep the server snapshot for hydration, then expose browser-only state. */
export function useClientReady(): boolean {
  return useSyncExternalStore(subscribeToReadiness, clientReady, serverReady);
}
