// @ts-check
import { CryptoSeal } from '../utils/cryptoSeal.js';
import { Formatters } from '../utils/formatters.js';
import { Sanitizer } from '../utils/sanitizer.js';

/**
 * @fileoverview Tow Acta Ledger Service for CraneTrack (AiAppFactory Standard)
 * Emisión, sellado criptográfico SHA-256 y exportación documental de Actas de Remolque.
 */

export class TowActaLedgerService {
  /**
   * Genera y sella criptográficamente un Acta Digital de Remolque y Peritaje.
   * @param {Object} towOrder Orden de auxilio completada
   * @param {Object} inspectionRecord Peritaje de daños preexistentes
   * @param {Object} billingSplit Liquidación de kilometraje y adicionales
   * @param {string} [receiverSignatureBase64=''] Firma de recepción del taller/destinatario
   * @returns {Promise<{
   *   actaId: string,
   *   sealedAt: string,
   *   sha256Digest: string,
   *   actaPayload: Object
   * }>}
   */
  static async emitAndSealActa(towOrder, inspectionRecord, billingSplit, receiverSignatureBase64 = '') {
    const actaId = `ACTA-TOW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const sealedAt = new Date().toISOString();

    const actaPayload = {
      actaId,
      sealedAt,
      orderId: towOrder.id,
      insuranceName: billingSplit.insuranceName,
      plate: towOrder.vehiclePlate,
      vehicleModel: towOrder.vehicleModel,
      driverName: towOrder.driverName,
      unitCode: towOrder.unitCode,
      originAddress: towOrder.originAddress,
      destinationAddress: towOrder.destinationAddress,
      kilometers: {
        towDistanceKm: billingSplit.towDistanceKm,
        coveredKm: billingSplit.coveredKm,
        excessKm: billingSplit.excessKm
      },
      billing: {
        insuranceSubtotalArs: billingSplit.insuranceSubtotalArs,
        clientExcessKmArs: billingSplit.clientExcessKmArs,
        clientSurchargesArs: billingSplit.clientSurchargesArs,
        clientTotalArs: billingSplit.clientTotalArs,
        grandTotalArs: billingSplit.grandTotalArs
      },
      inspectionSummary: inspectionRecord.summaryText,
      damagesCount: inspectionRecord.damagesCount,
      damagesList: inspectionRecord.damages || [],
      clientSignature: inspectionRecord.clientSignatureBase64 ? 'REGISTRADA' : 'NO_REGISTRADA',
      receiverSignature: receiverSignatureBase64 ? 'REGISTRADA' : 'NO_REGISTRADA'
    };

    const sha256Digest = await CryptoSeal.computeSha256(actaPayload);

    return {
      actaId,
      sealedAt,
      sha256Digest,
      actaPayload
    };
  }

  /**
   * Genera el CSV de liquidación mensual para enviar a las compañías de seguros.
   * @param {Array<Object>} actasList Lista de actas de remolque
   * @param {string} [insuranceFilter='ALL']
   * @returns {string} Cadena CSV con BOM UTF-8 y delimitador ;
   */
  static exportInsuranceSettlementCsv(actasList, insuranceFilter = 'ALL') {
    const filtered = insuranceFilter === 'ALL'
      ? actasList
      : actasList.filter((a) => a.actaPayload.insuranceName === insuranceFilter);

    const headers = [
      'Nro Acta',
      'Fecha y Hora',
      'Aseguradora',
      'Dominio',
      'Vehículo',
      'Origen',
      'Destino',
      'Km Cubiertos',
      'Subtotal Seguro ARS',
      'Km Excedente',
      'Total Cliente ARS',
      'Sello SHA-256'
    ];

    const rows = filtered.map((item) => {
      const p = item.actaPayload;
      return [
        p.actaId,
        Formatters.formatDateTimeAR(p.sealedAt),
        p.insuranceName,
        p.plate,
        p.vehicleModel || 'S/D',
        p.originAddress,
        p.destinationAddress,
        p.kilometers.coveredKm.toFixed(1),
        p.billing.insuranceSubtotalArs.toFixed(2),
        p.kilometers.excessKm.toFixed(1),
        p.billing.clientTotalArs.toFixed(2),
        item.sha256Digest
      ];
    });

    const sanitize = (val) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const lines = [
      headers.map(sanitize).join(';'),
      ...rows.map((r) => r.map(sanitize).join(';'))
    ];

    return '\uFEFF' + lines.join('\r\n');
  }

  /**
   * Genera el HTML formateado A4 para imprimir el comprobante oficial de remolque y peritaje.
   * @param {Object} sealedActa
   * @returns {string}
   */
  static renderActaPrintHtml(sealedActa) {
    const p = sealedActa.actaPayload;
    const esc = Sanitizer.escapeHTML;
    const damagesHtml = p.damagesList && p.damagesList.length > 0
      ? p.damagesList.map((d) => `<li><strong>${esc(d.sector)}:</strong> ${esc(d.damageType)} - ${esc(d.description || 'Sin notas')}</li>`).join('')
      : '<li><em>Sin daños preexistentes constatados previo al enganche.</em></li>';

    return `
    <div class="tow-acta-sheet" style="font-family: system-ui, sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; color: #0f172a; background: #fff;">
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ea580c;">CRANETRACK • AUXILIOS Y REMOLQUES 24/7</h1>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Acta Oficial de Traslado Vehicular y Peritaje Pre-Enganche</p>
        </div>
        <div style="text-align: right; font-size: 11px;">
          <div><strong>Acta Nº:</strong> ${esc(p.actaId)}</div>
          <div><strong>Fecha:</strong> ${esc(Formatters.formatDateTimeAR(p.sealedAt))}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 12px; margin-bottom: 14px;">
        <div><strong>Aseguradora / Convenio:</strong> ${esc(p.insuranceName)}</div>
        <div><strong>Dominio / Patente:</strong> ${esc(p.plate)}</div>
        <div><strong>Vehículo:</strong> ${esc(p.vehicleModel || 'S/D')}</div>
        <div><strong>Móvil / Chofer:</strong> ${esc(p.unitCode)} - ${esc(p.driverName)}</div>
        <div><strong>Origen (Siniestro):</strong> ${esc(p.originAddress)}</div>
        <div><strong>Destino (Taller/Depósito):</strong> ${esc(p.destinationAddress)}</div>
      </div>

      <h3 style="font-size: 13px; text-transform: uppercase; color: #334155; margin-bottom: 6px;">1. Liquidación de Kilometraje y Desdoblamiento (Split-Billing)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px;">Concepto</th>
            <th style="padding: 6px; text-align: center;">Km</th>
            <th style="padding: 6px; text-align: right;">Aseguradora</th>
            <th style="padding: 6px; text-align: right;">Particular (En Ruta)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px;">Acarreo de Línea (Franquicia Póliza)</td>
            <td style="padding: 6px; text-align: center;">${esc(Number(p.kilometers.coveredKm).toFixed(1))} km</td>
            <td style="padding: 6px; text-align: right; font-weight: 600;">${esc(Formatters.formatARS(p.billing.insuranceSubtotalArs))}</td>
            <td style="padding: 6px; text-align: right;">-</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px;">Kilómetros Excedentes</td>
            <td style="padding: 6px; text-align: center;">${esc(Number(p.kilometers.excessKm).toFixed(1))} km</td>
            <td style="padding: 6px; text-align: right;">-</td>
            <td style="padding: 6px; text-align: right; font-weight: 600; color: #c2410c;">${esc(Formatters.formatARS(p.billing.clientExcessKmArs))}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px;">Adicionales de Maniobra (Dolly / Malacate)</td>
            <td style="padding: 6px; text-align: center;">-</td>
            <td style="padding: 6px; text-align: right;">-</td>
            <td style="padding: 6px; text-align: right; font-weight: 600; color: #c2410c;">${esc(Formatters.formatARS(p.billing.clientSurchargesArs))}</td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 800;">
            <td style="padding: 8px;">TOTALES</td>
            <td style="padding: 8px; text-align: center;">${esc(Number(p.kilometers.towDistanceKm).toFixed(1))} km</td>
            <td style="padding: 8px; text-align: right; color: #1e293b;">${esc(Formatters.formatARS(p.billing.insuranceSubtotalArs))}</td>
            <td style="padding: 8px; text-align: right; color: #ea580c;">${esc(Formatters.formatARS(p.billing.clientTotalArs))}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size: 13px; text-transform: uppercase; color: #334155; margin-bottom: 6px;">2. Peritaje de Daños Preexistentes al Enganche</h3>
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px 14px; font-size: 11px; margin-bottom: 24px;">
        <ul style="margin: 0; padding-left: 18px;">
          ${damagesHtml}
        </ul>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; text-align: center;">
        <div>
          <div style="height: 40px; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px;"></div>
          Firma Conductor / Titular (${esc(p.clientSignature || 'NO_REGISTRADA')})
        </div>
        <div>
          <div style="height: 40px; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px;"></div>
          Firma Chofer de Grúa / Operador
        </div>
        <div>
          <div style="height: 40px; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px;"></div>
          Firma Recepción Taller (${esc(p.receiverSignature || 'NO_REGISTRADA')})
        </div>
      </div>

      <div style="margin-top: 24px; padding: 8px 12px; background: #f1f5f9; border-radius: 4px; font-family: monospace; font-size: 10px; color: #475569; word-break: break-all;">
        <strong>SELLO CRIPTOGRÁFICO DE SEGURIDAD (SHA-256):</strong><br>
        ${esc(sealedActa.sha256Digest)}
      </div>
    </div>`;
  }
}
