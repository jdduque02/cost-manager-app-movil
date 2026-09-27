import { useState, useEffect, useCallback } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

/**
 * Hook reactivo que suscribe al estado de red del dispositivo.
 * Se actualiza automáticamente cuando cambia la conectividad.
 *
 * @returns { isConnected, isInternetReachable } - Estado actual de la red.
 *   - isConnected: el dispositivo tiene conexión de red (WiFi, LTE, etc.).
 *   - isInternetReachable: la conexión tiene acceso real a Internet.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
  });

  const handleChange = useCallback((state: NetInfoState) => {
    setStatus({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
    });
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleChange);
    // Obtener estado inicial
    NetInfo.fetch().then(handleChange);
    return () => unsubscribe();
  }, [handleChange]);

  return status;
}

/**
 * Comprobación puntual (no reactiva) de conectividad.
 * Útil para verificar antes de realizar una operación crítica.
 * @returns true si hay red e Internet alcanzable.
 */
export async function checkConnectivity(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return (state.isConnected ?? false) && (state.isInternetReachable ?? false);
}
