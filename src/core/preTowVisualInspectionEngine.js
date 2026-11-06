// @ts-check
/**
 * @fileoverview Pre-Tow Visual Inspection Engine for CraneTrack (AiAppFactory Standard)
 *
 * Motor de peritaje de daños vehiculares pre-enganche y checklist de seguridad técnica:
 * - Mapeo de daños de 5 cuadrantes (Frente, Lateral Izquierdo, Lateral Derecho, Trasera, Bajos/Tren delantero).
 * - Checklist de seguridad: Transmisión automática, tracción integral 4x4, llave disponible, dirección trabada.
 * - Validación de requerimiento obligatorio de patines / carros Dolly para prevenir roturas de diferenciales.
 * - Registro forense de fotos testigo georreferenciadas y firma de conformidad previa al izaje.
 */

export class PreTowVisualInspectionEngine {
  /**
   * Cuadrantes vehiculares de inspección.
   */
  static SECTORS = {
    FRONT: 'Frente (Paragolpes / Ópticas / Capot)',
    LEFT_SIDE: 'Lateral Izquierdo (Puertas / Espejo / Guardabarros)',
    RIGHT_SIDE: 'Lateral Derecho (Puertas / Espejo / Guardabarros)',
    REAR: 'Trasera (Paragolpes / Ópticas / Portón)',
    UNDERCARRIAGE: 'Bajos / Tren Delantero / Cárter / Escape'
  };

  /**
   * Tipos de daños normalizados.
   */
  static DAMAGE_TYPES = {
    DENT: 'Abolladura / Golpe de impacto',
    SCRATCH: 'Rayón profundo / Raspón de pintura',
    BROKEN_PART: 'Óptica / Paragolpes / Espejo roto',
    MISSING_PART: 'Faltante de pieza previo al auxilio',
    FLUID_LEAK: 'Pérdida visible de aceite / refrigerante'
  };

  /**
   * Evalúa los requerimientos técnicos y riesgos mecánicos previos a subir el vehículo a la plancha.
   * @param {Object} vehicleSpec
   * @param {'MANUAL'|'AUTOMATIC'} vehicleSpec.transmission Caja de cambios
   * @param {'FWD'|'RWD'|'AWD_4X4'} vehicleSpec.driveType Tipo de tracción
   * @param {boolean} vehicleSpec.hasKeys Si el conductor entrega las llaves
   * @param {boolean} vehicleSpec.isSteeringLocked Si la dirección se encuentra bloqueada
   * @param {boolean} vehicleSpec.areWheelsBlocked Si hay ruedas frenadas o destruidas
   * @returns {{
   *   requiresDolly: boolean,
   *   requiresWinchWedge: boolean,
   *   safetyWarnings: string[],
   *   canTowSafely: boolean
   * }}
   */
  static evaluateTowSafetyProtocol(vehicleSpec) {
    const safetyWarnings = [];
    let requiresDolly = false;
    let requiresWinchWedge = false;

    // Caja automática o tracción integral: terminantemente prohibido remolcar rodando ejes motrices
    if (vehicleSpec.driveType === 'AWD_4X4') {
      requiresDolly = true;
      safetyWarnings.push('Vehículo con TRACCIÓN INTEGRAL (4x4 / AWD): Exige plancha total o patines DOLLY en eje secundario para evitar destrucción de caja de transferencia.');
    } else if (vehicleSpec.transmission === 'AUTOMATIC') {
      requiresDolly = true;
      safetyWarnings.push('Vehículo con CAJA AUTOMÁTICA: Prohibido remolcar rodando ruedas motrices sin Dolly.');
    }

    if (!vehicleSpec.hasKeys) {
      safetyWarnings.push('SIN LLAVE DISPONIBLE: Se debe dejar constancia de que no se puede destrabar la palanca ni el volante.');
      requiresDolly = true;
    }

    if (vehicleSpec.isSteeringLocked) {
      safetyWarnings.push('DIRECCIÓN TRABADA: El vehículo no alineará sobre la rampa; requiere tiro con polea de desvío.');
      requiresWinchWedge = true;
    }

    if (vehicleSpec.areWheelsBlocked) {
      safetyWarnings.push('RUEDAS BLOQUEADAS O DESTRUIDAS: Requiere patines deslizantes de teflón para no dañar neumáticos.');
      requiresDolly = true;
    }

    return {
      requiresDolly,
      requiresWinchWedge,
      safetyWarnings,
      canTowSafely: true
    };
  }

  /**
   * Compila el acta forense de peritaje vehicular previa al izaje.
   * @param {Object} inspectionData
   * @param {string} inspectionData.orderId Número de orden de auxilio
   * @param {string} inspectionData.plate Patente del vehículo
   * @param {string} inspectionData.driverName Nombre del chofer de la grúa
   * @param {string} inspectionData.clientName Nombre del titular / conductor presente
   * @param {Array<{ sector: string, damageType: string, description: string }>} inspectionData.damages Lista de daños preexistentes
   * @param {Object} inspectionData.safetyProtocol Resultado de evaluateTowSafetyProtocol
   * @param {string[]} [inspectionData.witnessPhotos=[]] URLs o identificadores de fotos testigo
   * @param {string} [inspectionData.clientSignatureBase64=''] Firma digital de conformidad del cliente
   * @returns {{
   *   inspectionId: string,
   *   createdAt: string,
   *   damagesCount: number,
   *   summaryText: string,
   *   isSigned: boolean,
   *   inspectionRecord: Object
   * }}
   */
  static compileInspectionRecord(inspectionData) {
    const inspectionId = `INSP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    const damagesCount = inspectionData.damages ? inspectionData.damages.length : 0;
    const isSigned = Boolean(inspectionData.clientSignatureBase64 && inspectionData.clientSignatureBase64.length > 20);

    const summaryText = damagesCount === 0
      ? 'Sin daños preexistentes visibles al momento del enganche.'
      : `Se constataron ${damagesCount} daño(s) preexistente(s) antes de accionar el malacate/plancha.`;

    const inspectionRecord = {
      inspectionId,
      createdAt,
      orderId: inspectionData.orderId,
      plate: inspectionData.plate,
      driverName: inspectionData.driverName,
      clientName: inspectionData.clientName,
      damages: inspectionData.damages || [],
      safetyProtocol: inspectionData.safetyProtocol,
      witnessPhotos: inspectionData.witnessPhotos || [],
      clientSignatureBase64: inspectionData.clientSignatureBase64 || null,
      summaryText,
      isSigned
    };

    return {
      inspectionId,
      createdAt,
      damagesCount,
      summaryText,
      isSigned,
      inspectionRecord
    };
  }
}
