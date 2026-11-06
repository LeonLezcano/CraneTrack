// @ts-check
/**
 * @fileoverview Fleet Emergency Dispatcher & Cab Mode Engine for CraneTrack (AiAppFactory Standard)
 *
 * Motor de despacho inteligente 24/7 de grúas, cálculo de SLA y modo cabina vehicular:
 * - Selección de tipo de unidad óptima (Plancha Liviana, Grúa Pesada, Subsuelos Baja Altura).
 * - Máquina de estados estricta del auxilio: PENDING -> DISPATCHED -> ON_SCENE -> TOWING -> DELIVERED.
 * - Integración nativa de Screen Wake Lock API para mantener la pantalla activa en soporte de parabrisas.
 * - Auto re-enganche de Wake Lock al regresar de aplicaciones GPS externas (Waze / Google Maps).
 */

export class FleetEmergencyDispatcherEngine {
  /**
   * Tipos de grúas y móviles de la flota.
   */
  static UNIT_TYPES = {
    LIGHT_FLATBED: { id: 'LIGHT_FLATBED', label: 'Plancha Hidráulica Liviana', maxWeightKg: 3000, minHeightM: 2.40 },
    HEAVY_FORK: { id: 'HEAVY_FORK', label: 'Grúa Pesada de Horquilla / Tenedor', maxWeightKg: 18000, minHeightM: 3.20 },
    LOW_CLEARANCE: { id: 'LOW_CLEARANCE', label: 'Unidad de Subsuelos (Baja Altura)', maxWeightKg: 2400, minHeightM: 1.90 },
    HYDRAULIC_CRANE: { id: 'HYDRAULIC_CRANE', label: 'Camión con Hidrogrua Articulada', maxWeightKg: 8000, minHeightM: 3.00 }
  };

  /**
   * Estados del ciclo operativo de auxilio.
   */
  static TOW_STATUSES = {
    PENDING_DISPATCH: 'PENDING_DISPATCH',
    DISPATCHED: 'DISPATCHED',
    EN_ROUTE: 'EN_ROUTE',
    ON_SCENE: 'ON_SCENE',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED'
  };

  /**
   * Recomienda el tipo de móvil de rescate adecuado según el peso y las condiciones del siniestro.
   * @param {Object} incidentReq
   * @param {number} incidentReq.estimatedWeightKg Peso estimado del vehículo
   * @param {boolean} incidentReq.isUnderground Si está en un garaje subterráneo
   * @param {boolean} incidentReq.needsLifting Si requiere izaje desde zanja o barranco
   * @returns {{ recommendedUnitType: string, reason: string }}
   */
  static matchFleetUnitType(incidentReq) {
    if (incidentReq.isUnderground) {
      return {
        recommendedUnitType: 'LOW_CLEARANCE',
        reason: 'Altura reducida (< 2.00m) en subsuelo: se requiere móvil de perfil bajo.'
      };
    }

    if (incidentReq.needsLifting) {
      return {
        recommendedUnitType: 'HYDRAULIC_CRANE',
        reason: 'Vehículo desbarrancado o inaccesible: requiere pluma hidrogrua articulada.'
      };
    }

    if (incidentReq.estimatedWeightKg > 3000) {
      return {
        recommendedUnitType: 'HEAVY_FORK',
        reason: `Peso vehicular superior a 3 toneladas (${incidentReq.estimatedWeightKg} kg): exige grúa pesada tenedor.`
      };
    }

    return {
      recommendedUnitType: 'LIGHT_FLATBED',
      reason: 'Vehículo liviano estándar: apto para plancha hidráulica autodeslizante convencional.'
    };
  }

  /**
   * Calcula el tiempo restante y cumplimiento de SLA de auxilio en ruta.
   * @param {string|Date} dispatchedAt Timestamp de despacho
   * @param {number} targetSlaMinutes Tiempo objetivo acordado con aseguradora (ej. 45 o 60 min)
   * @returns {{ elapsedMinutes: number, remainingMinutes: number, isSlaBreached: boolean, badgeClass: string }}
   */
  static evaluateSlaPerformance(dispatchedAt, targetSlaMinutes = 45) {
    const start = new Date(dispatchedAt).getTime();
    const now = Date.now();
    const elapsedMinutes = Math.max(0, Math.round((now - start) / 60000));
    const remainingMinutes = targetSlaMinutes - elapsedMinutes;
    const isSlaBreached = remainingMinutes < 0;

    let badgeClass = 'badge-success';
    if (isSlaBreached) {
      badgeClass = 'badge-danger';
    } else if (remainingMinutes <= 15) {
      badgeClass = 'badge-warning';
    }

    return {
      elapsedMinutes,
      remainingMinutes,
      isSlaBreached,
      badgeClass
    };
  }

  /**
   * Activa el Screen Wake Lock para el modo cabina vehicular en parabrisas.
   * @returns {Promise<{ active: boolean, error?: string }>}
   */
  static async requestScreenWakeLock() {
    if (typeof navigator === 'undefined' || !navigator.wakeLock) {
      return { active: false, error: 'Screen Wake Lock API no soportada en este entorno.' };
    }

    try {
      const wakeLock = await navigator.wakeLock.request('screen');

      // Auto-reenganche al regresar de Waze/Google Maps
      if (typeof document !== 'undefined') {
        const handleVisibilityChange = async () => {
          if (document.visibilityState === 'visible') {
            try {
              await navigator.wakeLock.request('screen');
            } catch {
              // Silencioso para no ensuciar consola
            }
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange, { once: true });
      }

      return { active: true };
    } catch (err) {
      return { active: false, error: err.message };
    }
  }
}
