import type { VoiceProvider } from '@/providers/VoiceProvider';
import { MockVoiceProvider } from '@/providers/MockVoiceProvider';
import { ZadarmaProvider } from '@/providers/ZadarmaProvider';

/**
 * Provider Registry — unico punto central de seleccion del proveedor
 * de telefonia.
 *
 * Toda la aplicacion obtiene el proveedor a traves de getVoiceProvider()
 * y depende exclusivamente de la interfaz VoiceProvider. Ninguna pantalla,
 * servicio o componente importa o conoce la clase concreta del proveedor.
 *
 * ────────────────────────────────────────────────────────────────
 *  ARQUITECTURA DE SEGURIDAD (Zadarma):
 *
 *  Las credenciales de Zadarma (ZADARMA_KEY / ZADARMA_SECRET) viven
 *  SOLO en el servidor como secretos privados del Edge Function "voice".
 *  NUNCA se exponen al frontend (no son variables VITE_).
 *
 *  ZadarmaProvider es un cliente HTTP delgado que llama a endpoints
 *  internos del backend; la firma HMAC de Zadarma se genera alla.
 *
 *  PARA ACTIVAR ZADARMA (un solo cambio):
 *  1. Definir ZADARMA_KEY y ZADARMA_SECRET como secretos del Edge Function.
 *  2. Implementar la logica real en supabase/functions/voice/index.ts.
 *  3. Cambiar ACTIVE_PROVIDER de 'mock' a 'zadarma' aqui abajo.
 *
 *  No es necesario modificar ningun otro archivo del CRM.
 * ────────────────────────────────────────────────────────────────
 */

/** Identificador del proveedor activo. Cambiar esta unica linea para integrar Zadarma. */
const ACTIVE_PROVIDER: ProviderId = 'zadarma';

type ProviderId = 'mock' | 'zadarma';

/**
 * Fabrica de proveedores. Cada caso devuelve una instancia concreta
 * que implementa VoiceProvider. Agregar aqui el nuevo proveedor cuando
 * se cree ZadarmaProvider.
 */
function createProvider(id: ProviderId): VoiceProvider {
  switch (id) {
    case 'mock':
      return new MockVoiceProvider();
    case 'zadarma':
      return new ZadarmaProvider();
    default:
      throw new Error(`Proveedor de telefonia desconocido: ${id}`);
  }
}

const activeProvider = createProvider(ACTIVE_PROVIDER);
const mockProvider = createProvider('mock');

/**
 * Devuelve el proveedor de telefonia activo.
 * Es la unica forma en que el resto del CRM accede a la telefonia.
 */
export function getVoiceProvider(): VoiceProvider {
  return activeProvider;
}

/**
 * Devuelve siempre el proveedor mock, independientemente de ACTIVE_PROVIDER.
 * Se usa para el boton "Simular llamada" cuando el proveedor activo es real.
 */
export function getMockVoiceProvider(): VoiceProvider {
  return mockProvider;
}

export type { VoiceProvider } from '@/providers/VoiceProvider';
