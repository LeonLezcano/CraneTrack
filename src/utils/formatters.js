// @ts-check
/**
 * @fileoverview Formatters for CraneTrack (AiAppFactory Standard)
 */

export class Formatters {
  /**
   * Normaliza y valida patentes argentinas (Antiguo formato: ABC 123, Mercosur: AB 123 CD).
   * @param {string} plate
   * @returns {{ plate: string, isMercosur: boolean, isValid: boolean }}
   */
  static formatLicensePlate(plate) {
    if (!plate || typeof plate !== 'string') {
      return { plate: 'S/P', isMercosur: false, isValid: false };
    }
    const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Formato Mercosur: 2 letras, 3 números, 2 letras (ej. AF 123 CD)
    if (/^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(clean)) {
      return {
        plate: `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 7)}`,
        isMercosur: true,
        isValid: true
      };
    }

    // Formato Antiguo: 3 letras, 3 números (ej. GHI 456)
    if (/^[A-Z]{3}[0-9]{3}$/.test(clean)) {
      return {
        plate: `${clean.slice(0, 3)} ${clean.slice(3, 6)}`,
        isMercosur: false,
        isValid: true
      };
    }

    return { plate: clean || 'S/P', isMercosur: false, isValid: false };
  }

  /**
   * Formatea importes en pesos argentinos (ARS).
   * @param {number} amount
   * @returns {string}
   */
  static formatARS(amount) {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2
    }).format(num);
  }

  /**
   * Formatea distancias en kilómetros con 1 decimal.
   * @param {number} km
   * @returns {string}
   */
  static formatDistanceKm(km) {
    const num = Number(km) || 0;
    return `${num.toFixed(1)} km`;
  }

  /**
   * Formatea fecha y hora en huso horario de Argentina (UTC-3).
   * @param {string|number|Date} date
   * @returns {string}
   */
  static formatDateTimeAR(date) {
    if (!date) return '--/--/---- --:--';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--/--/---- --:--';

    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  }
}
