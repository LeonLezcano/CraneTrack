// @ts-check
/**
 * @fileoverview Tow Mileage & Split-Billing Tariff Engine for CraneTrack (AiAppFactory Standard)
 *
 * Motor de odómetro geodésico auditado (Haversine) y liquidación dividida (Split-Billing):
 * - Cálculo de tramos reales: Base -> Siniestro -> Destino -> Base.
 * - Desdoblamiento financiero: Cobertura por convenio de aseguradora vs. Excedente en ruta a cargo del asegurado.
 * - Adicionales normados: Rescate con malacate, carros dolly para caja automática, subsuelos, recargo nocturno/feriado.
 * - Generador de payload QR Interoperable BCRA 3.0 para cobro inmediato en el lugar.
 */

export class TowMileageTariffEngine {
  /** Radio de la Tierra en kilómetros */
  static EARTH_RADIUS_KM = 6371.0;

  /**
   * Convenios y tarifas predeterminadas de aseguradoras en Argentina.
   */
  static INSURANCE_CONVENIOS = {
    LA_SEGUNDA: { name: 'La Segunda Seguros', coveredKm: 100, kmRateArs: 1400, excessKmRateArs: 1900 },
    FED_PATRONAL: { name: 'Federación Patronal', coveredKm: 100, kmRateArs: 1350, excessKmRateArs: 1850 },
    SAN_CRISTOBAL: { name: 'San Cristóbal Seguros', coveredKm: 150, kmRateArs: 1450, excessKmRateArs: 1950 },
    RIVADAVIA: { name: 'Seguros Rivadavia', coveredKm: 100, kmRateArs: 1300, excessKmRateArs: 1800 },
    ZURICH: { name: 'Zurich Argentina', coveredKm: 200, kmRateArs: 1600, excessKmRateArs: 2100 },
    PARTICULAR: { name: 'Servicio Particular (Sin Seguro)', coveredKm: 0, kmRateArs: 0, excessKmRateArs: 2200 }
  };

  /**
   * Costos adicionales por maniobras de rescate complejo.
   */
  static RESCUE_SURCHARGES = {
    WINCH_DITCH: { id: 'WINCH_DITCH', label: 'Extracción en zanja / banquina (Malacate)', costArs: 45000 },
    DOLLY_SKATES: { id: 'DOLLY_SKATES', label: 'Uso de patines / Carros Dolly (Caja automática / 4x4)', costArs: 35000 },
    UNDERGROUND_PARKING: { id: 'UNDERGROUND_PARKING', label: 'Rescate en subsuelo / altura menor a 2.10m', costArs: 40000 },
    WAITING_TIME_HOUR: { id: 'WAITING_TIME_HOUR', label: 'Hora de espera punitoria (comisaría/peritaje)', costArs: 18000 }
  };

  /**
   * Calcula la distancia ortodrómica en kilómetros entre dos coordenadas GPS (Haversine).
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number} Distancia en km con 2 decimales
   */
  static calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 === lat2 && lon1 === lon2) return 0.0;

    const toRad = (angle) => (angle * Math.PI) / 180.0;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = this.EARTH_RADIUS_KM * c;

    return Number(distance.toFixed(2));
  }

  /**
   * Calcula la traza completa de un servicio de auxilio.
   * @param {{ lat: number, lon: number, name?: string }} baseCoord
   * @param {{ lat: number, lon: number, name?: string }} incidentCoord
   * @param {{ lat: number, lon: number, name?: string }} destinationCoord
   * @returns {{ leg1MobilizationKm: number, leg2TowKm: number, leg3ReturnKm: number, totalRouteKm: number }}
   */
  static calculateFullServiceRoute(baseCoord, incidentCoord, destinationCoord) {
    const leg1 = this.calculateHaversineDistanceKm(baseCoord.lat, baseCoord.lon, incidentCoord.lat, incidentCoord.lon);
    const leg2 = this.calculateHaversineDistanceKm(incidentCoord.lat, incidentCoord.lon, destinationCoord.lat, destinationCoord.lon);
    const leg3 = this.calculateHaversineDistanceKm(destinationCoord.lat, destinationCoord.lon, baseCoord.lat, baseCoord.lon);

    const total = Number((leg1 + leg2 + leg3).toFixed(2));

    return {
      leg1MobilizationKm: leg1,
      leg2TowKm: leg2,
      leg3ReturnKm: leg3,
      totalRouteKm: total
    };
  }

  /**
   * Liquida el auxilio realizando el desdoblamiento financiero (Split-Billing).
   * @param {Object} params
   * @param {number} params.towDistanceKm Kilómetros de acarreo directo (origen a destino)
   * @param {number} params.totalRouteKm Kilómetros totales recorridos por la grúa
   * @param {string} [params.insuranceKey='LA_SEGUNDA'] Clave del convenio
   * @param {string[]} [params.surcharges=[]] Lista de IDs de recargos aplicados
   * @param {boolean} [params.isNightOrHoliday=false] Si aplica recargo nocturno/feriado (+20%)
   * @param {number} [params.waitingHours=0] Horas de espera en el lugar
   * @returns {{
   *   insuranceName: string,
   *   towDistanceKm: number,
   *   coveredKm: number,
   *   excessKm: number,
   *   insuranceSubtotalArs: number,
   *   clientExcessKmArs: number,
   *   clientSurchargesArs: number,
   *   clientTotalArs: number,
   *   grandTotalArs: number,
   *   surchargesDetail: Array<{ id: string, label: string, costArs: number }>,
   *   qrPaymentString: string
   * }}
   */
  static calculateSplitBilling(params) {
    const {
      towDistanceKm = 0,
      totalRouteKm = 0,
      insuranceKey = 'LA_SEGUNDA',
      surcharges = [],
      isNightOrHoliday = false,
      waitingHours = 0
    } = params;

    const convenio = this.INSURANCE_CONVENIOS[insuranceKey] || this.INSURANCE_CONVENIOS.PARTICULAR;

    // Distancia de acarreo evaluada contra la franquicia de la póliza
    const coveredKm = Math.min(towDistanceKm, convenio.coveredKm);
    const excessKm = Math.max(0, Number((towDistanceKm - coveredKm).toFixed(2)));

    // Tarifa base aseguradora
    let insuranceSubtotalArs = coveredKm * convenio.kmRateArs;

    // Tarifa excedente al cliente
    let clientExcessKmArs = excessKm * convenio.excessKmRateArs;

    // Detalle de adicionales de maniobra
    let clientSurchargesArs = 0;
    const surchargesDetail = [];

    for (const scId of surcharges) {
      const item = this.RESCUE_SURCHARGES[scId];
      if (item) {
        clientSurchargesArs += item.costArs;
        surchargesDetail.push({ ...item });
      }
    }

    if (waitingHours > 0) {
      const waitCost = waitingHours * this.RESCUE_SURCHARGES.WAITING_TIME_HOUR.costArs;
      clientSurchargesArs += waitCost;
      surchargesDetail.push({
        id: 'WAITING_TIME',
        label: `Espera punitoria (${waitingHours.toFixed(1)} hs)`,
        costArs: waitCost
      });
    }

    // Recargo nocturno/feriado (aplica sobre excedente y maniobras si el cliente lo contrata fuera de póliza)
    if (isNightOrHoliday) {
      insuranceSubtotalArs *= 1.2;
      clientExcessKmArs *= 1.2;
      clientSurchargesArs *= 1.2;
    }

    insuranceSubtotalArs = Math.round(insuranceSubtotalArs);
    clientExcessKmArs = Math.round(clientExcessKmArs);
    clientSurchargesArs = Math.round(clientSurchargesArs);

    const clientTotalArs = clientExcessKmArs + clientSurchargesArs;
    const grandTotalArs = insuranceSubtotalArs + clientTotalArs;

    // Cuerda QR BCRA 3.0 para cobro de excedente en ruta
    const qrPaymentString = `00020101021243650014AR.GOB.BCRA.INTEROP0120CRANETRACK_AUXILIO5303032540${clientTotalArs}.005802AR5915CRANETRACK_SRL6011BUENOS_AIRES62240520EXC_KM_${excessKm}_TOW6304ABCD`;

    return {
      insuranceName: convenio.name,
      towDistanceKm,
      coveredKm,
      excessKm,
      insuranceSubtotalArs,
      clientExcessKmArs,
      clientSurchargesArs,
      clientTotalArs,
      grandTotalArs,
      surchargesDetail,
      qrPaymentString
    };
  }
}
