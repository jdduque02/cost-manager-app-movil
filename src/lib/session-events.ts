type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Pub/sub minimalista para notificar que la sesión expiró de forma
 * irrecuperable (401 reactivo cuyo refresh también falló). Existe como
 * módulo aparte para evitar un import circular entre `api/client.ts`
 * (que detecta la expiración) y `store/auth.store.ts` (que reacciona a ella).
 */
export function emitSessionExpired(): void {
  for (const listener of listeners) listener();
}

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
