// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TowMileageTariffEngine } from '../src/core/towMileageTariffEngine.js';
import { PreTowVisualInspectionEngine } from '../src/core/preTowVisualInspectionEngine.js';
import { FleetEmergencyDispatcherEngine } from '../src/core/fleetEmergencyDispatcherEngine.js';
import { TowActaLedgerService } from '../src/services/towActaLedgerService.js';
import { CraneTrackCacheService } from '../src/services/craneTrackCache.service.js';
import { Formatters } from '../src/utils/formatters.js';
import { Sanitizer } from '../src/utils/sanitizer.js';
import { CryptoSeal } from '../src/utils/cryptoSeal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Mock localStorage para Node.js
class LocalStorageMock {
  constructor() {
    /** @type {Map<string, string>} */
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
// @ts-ignore
globalThis.localStorage = new LocalStorageMock();

async function runAllTests() {
  let passed = 0;
  let failed = 0;
  const tests = [];

  function test(name, fn) {
    tests.push({ name, fn });
  }

  // -------------------------------------------------------------
  // CAPA 1: Unitarias & Fuzzing Caótico (Algoritmos & Convenios)
  // -------------------------------------------------------------
  test('Capa 1.1: Haversine entre coordenadas idénticas devuelve exactamente 0 km', () => {
    const d = TowMileageTariffEngine.calculateHaversineDistanceKm(-34.6037, -58.3816, -34.6037, -58.3816);
    assert.equal(d, 0.0);
  });

  test('Capa 1.2: Haversine calcula distancia conocida Buenos Aires a Campana (~74 km)', () => {
    const d = TowMileageTariffEngine.calculateHaversineDistanceKm(-34.6037, -58.3816, -34.1687, -58.9591);
    assert.ok(d >= 70 && d <= 78, `Esperado ~74km, dio ${d}`);
  });

  test('Capa 1.3: Haversine calcula distancia Buenos Aires a Mar del Plata (~385 km)', () => {
    const d = TowMileageTariffEngine.calculateHaversineDistanceKm(-34.6037, -58.3816, -38.0055, -57.5562);
    assert.ok(d >= 370 && d <= 410, `Esperado ~385km, dio ${d}`);
  });

  test('Capa 1.4: calculateFullServiceRoute suma los 3 tramos (Base -> Siniestro -> Destino -> Base)', () => {
    const base = { lat: -34.5500, lon: -58.4500 };
    const siniestro = { lat: -34.6000, lon: -58.4000 };
    const destino = { lat: -34.6500, lon: -58.3500 };
    const r = TowMileageTariffEngine.calculateFullServiceRoute(base, siniestro, destino);
    assert.ok(r.leg1MobilizationKm > 0);
    assert.ok(r.leg2TowKm > 0);
    assert.ok(r.leg3ReturnKm > 0);
    assert.equal(r.totalRouteKm, Number((r.leg1MobilizationKm + r.leg2TowKm + r.leg3ReturnKm).toFixed(2)));
  });

  test('Capa 1.5: Split-Billing dentro de franquicia: 0 cargo de km excedente al asegurado', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 80,
      insuranceKey: 'LA_SEGUNDA' // Franquicia 100 km
    });
    assert.equal(s.coveredKm, 80);
    assert.equal(s.excessKm, 0);
    assert.equal(s.clientExcessKmArs, 0);
    assert.equal(s.insuranceSubtotalArs, 80 * 1400);
  });

  test('Capa 1.6: Split-Billing con exceso: desdobla exactamente la franquicia y el excedente (135 km La Segunda)', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 135,
      insuranceKey: 'LA_SEGUNDA' // 100 cubiertos @ $1400, 35 excedentes @ $1900
    });
    assert.equal(s.coveredKm, 100);
    assert.equal(s.excessKm, 35);
    assert.equal(s.insuranceSubtotalArs, 140000);
    assert.equal(s.clientExcessKmArs, 35 * 1900);
    assert.equal(s.clientTotalArs, 35 * 1900);
  });

  test('Capa 1.7: Split-Billing Federación Patronal aplica tarifas de convenio', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 120,
      insuranceKey: 'FED_PATRONAL' // 100 cubiertos @ $1350, 20 excedentes @ $1850
    });
    assert.equal(s.coveredKm, 100);
    assert.equal(s.excessKm, 20);
    assert.equal(s.insuranceSubtotalArs, 135000);
    assert.equal(s.clientExcessKmArs, 37000);
  });

  test('Capa 1.8: Split-Billing Zurich tiene franquicia extendida de 200 km', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 180,
      insuranceKey: 'ZURICH' // 200 km cubiertos
    });
    assert.equal(s.coveredKm, 180);
    assert.equal(s.excessKm, 0);
    assert.equal(s.clientExcessKmArs, 0);
  });

  test('Capa 1.9: Split-Billing Particular (Sin Seguro) factura 100% al cliente', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 50,
      insuranceKey: 'PARTICULAR' // 0 franquicia, $2200/km particular
    });
    assert.equal(s.coveredKm, 0);
    assert.equal(s.excessKm, 50);
    assert.equal(s.insuranceSubtotalArs, 0);
    assert.equal(s.clientTotalArs, 50 * 2200);
  });

  test('Capa 1.10: Split-Billing adicional Malacate Zanja suma $45.000', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 40,
      insuranceKey: 'RIVADAVIA',
      surcharges: ['WINCH_DITCH']
    });
    assert.equal(s.clientSurchargesArs, 45000);
    assert.equal(s.clientTotalArs, 45000);
  });

  test('Capa 1.11: Split-Billing adicional Patines Dolly suma $35.000', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 40,
      insuranceKey: 'RIVADAVIA',
      surcharges: ['DOLLY_SKATES']
    });
    assert.equal(s.clientSurchargesArs, 35000);
  });

  test('Capa 1.12: Split-Billing horas de espera punitoria se liquidan a $18.000/hora', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 50,
      insuranceKey: 'SAN_CRISTOBAL',
      waitingHours: 2.5
    });
    assert.equal(s.clientSurchargesArs, 2.5 * 18000);
  });

  test('Capa 1.13: Split-Billing recargo nocturno/feriado multiplica subtotales por 1.20', () => {
    const base = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 150,
      insuranceKey: 'LA_SEGUNDA',
      isNightOrHoliday: false
    });
    const night = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 150,
      insuranceKey: 'LA_SEGUNDA',
      isNightOrHoliday: true
    });
    assert.equal(night.insuranceSubtotalArs, Math.round(base.insuranceSubtotalArs * 1.2));
    assert.equal(night.clientExcessKmArs, Math.round(base.clientExcessKmArs * 1.2));
  });

  test('Capa 1.14: Split-Billing genera payload QR BCRA 3.0 con identificador interoperable', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 125,
      insuranceKey: 'LA_SEGUNDA'
    });
    assert.ok(s.qrPaymentString.startsWith('00020101021243650014AR.GOB.BCRA.INTEROP'));
    assert.ok(s.qrPaymentString.includes(String(s.clientTotalArs)));
  });

  test('Capa 1.15: Fuzzing: Split-Billing con valores negativos o nulos no explota', () => {
    const s = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: -100,
      waitingHours: -5,
      surcharges: ['INVALID_CODE']
    });
    assert.equal(s.excessKm, 0);
    assert.equal(s.clientTotalArs, 0);
  });

  test('Capa 1.16: PreTowVisualInspectionEngine detecta Dolly para caja automática', () => {
    const r = PreTowVisualInspectionEngine.evaluateTowSafetyProtocol({
      transmission: 'AUTOMATIC',
      driveType: 'FWD',
      hasKeys: true,
      isSteeringLocked: false,
      areWheelsBlocked: false
    });
    assert.equal(r.requiresDolly, true);
    assert.ok(r.safetyWarnings.some((w) => w.includes('CAJA AUTOMÁTICA')));
  });

  test('Capa 1.17: PreTowVisualInspectionEngine detecta Dolly para tracción integral AWD/4x4', () => {
    const r = PreTowVisualInspectionEngine.evaluateTowSafetyProtocol({
      transmission: 'MANUAL',
      driveType: 'AWD_4X4',
      hasKeys: true,
      isSteeringLocked: false,
      areWheelsBlocked: false
    });
    assert.equal(r.requiresDolly, true);
    assert.ok(r.safetyWarnings.some((w) => w.includes('TRACCIÓN INTEGRAL')));
  });

  test('Capa 1.18: PreTowVisualInspectionEngine detecta tiro con polea de desvío si dirección trabada', () => {
    const r = PreTowVisualInspectionEngine.evaluateTowSafetyProtocol({
      transmission: 'MANUAL',
      driveType: 'FWD',
      hasKeys: false,
      isSteeringLocked: true,
      areWheelsBlocked: false
    });
    assert.equal(r.requiresWinchWedge, true);
    assert.equal(r.requiresDolly, true);
  });

  test('Capa 1.19: PreTowVisualInspectionEngine detecta ruedas bloqueadas', () => {
    const r = PreTowVisualInspectionEngine.evaluateTowSafetyProtocol({
      transmission: 'MANUAL',
      driveType: 'FWD',
      hasKeys: true,
      isSteeringLocked: false,
      areWheelsBlocked: true
    });
    assert.equal(r.requiresDolly, true);
    assert.ok(r.safetyWarnings.some((w) => w.includes('RUEDAS BLOQUEADAS')));
  });

  test('Capa 1.20: PreTowVisualInspectionEngine compila acta de peritaje con resumen', () => {
    const rec = PreTowVisualInspectionEngine.compileInspectionRecord({
      orderId: 'ORD-901',
      plate: 'AF 123 CD',
      driverName: 'Chofer 1',
      clientName: 'Cliente 1',
      damages: [
        { sector: 'Frente', damageType: 'Abolladura', description: 'Óptica rota' }
      ]
    });
    assert.ok(rec.inspectionId.startsWith('INSP-'));
    assert.equal(rec.damagesCount, 1);
    assert.ok(rec.summaryText.includes('1 daño(s)'));
    assert.equal(rec.isSigned, false);
  });

  test('Capa 1.21: PreTowVisualInspectionEngine detecta firma de cliente válida', () => {
    const rec = PreTowVisualInspectionEngine.compileInspectionRecord({
      orderId: 'ORD-902',
      plate: 'GHI 456',
      driverName: 'Chofer 1',
      clientName: 'Cliente 1',
      damages: [],
      clientSignatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
    });
    assert.equal(rec.isSigned, true);
    assert.equal(rec.damagesCount, 0);
  });

  test('Capa 1.22: FleetEmergencyDispatcherEngine recomienda móvil subsuelo si isUnderground', () => {
    const m = FleetEmergencyDispatcherEngine.matchFleetUnitType({
      estimatedWeightKg: 1500,
      isUnderground: true,
      needsLifting: false
    });
    assert.equal(m.recommendedUnitType, 'LOW_CLEARANCE');
  });

  test('Capa 1.23: FleetEmergencyDispatcherEngine recomienda hidrogrua si needsLifting', () => {
    const m = FleetEmergencyDispatcherEngine.matchFleetUnitType({
      estimatedWeightKg: 2000,
      isUnderground: false,
      needsLifting: true
    });
    assert.equal(m.recommendedUnitType, 'HYDRAULIC_CRANE');
  });

  test('Capa 1.24: FleetEmergencyDispatcherEngine recomienda grúa tenedor pesada si peso > 3000 kg', () => {
    const m = FleetEmergencyDispatcherEngine.matchFleetUnitType({
      estimatedWeightKg: 5000,
      isUnderground: false,
      needsLifting: false
    });
    assert.equal(m.recommendedUnitType, 'HEAVY_FORK');
  });

  test('Capa 1.25: FleetEmergencyDispatcherEngine recomienda plancha hidráulica liviana para autos estándar', () => {
    const m = FleetEmergencyDispatcherEngine.matchFleetUnitType({
      estimatedWeightKg: 1400,
      isUnderground: false,
      needsLifting: false
    });
    assert.equal(m.recommendedUnitType, 'LIGHT_FLATBED');
  });

  test('Capa 1.26: FleetEmergencyDispatcherEngine calcula SLA en tiempo (badge-success)', () => {
    const recent = new Date(Date.now() - 15 * 60000).toISOString();
    const sla = FleetEmergencyDispatcherEngine.evaluateSlaPerformance(recent, 45);
    assert.equal(sla.isSlaBreached, false);
    assert.equal(sla.badgeClass, 'badge-success');
  });

  test('Capa 1.27: FleetEmergencyDispatcherEngine calcula SLA próximo a vencer (badge-warning)', () => {
    const warn = new Date(Date.now() - 35 * 60000).toISOString();
    const sla = FleetEmergencyDispatcherEngine.evaluateSlaPerformance(warn, 45);
    assert.equal(sla.isSlaBreached, false);
    assert.equal(sla.badgeClass, 'badge-warning');
  });

  test('Capa 1.28: FleetEmergencyDispatcherEngine calcula SLA excedido (badge-danger)', () => {
    const over = new Date(Date.now() - 65 * 60000).toISOString();
    const sla = FleetEmergencyDispatcherEngine.evaluateSlaPerformance(over, 45);
    assert.equal(sla.isSlaBreached, true);
    assert.equal(sla.badgeClass, 'badge-danger');
  });

  test('Capa 1.29: Formatters formatea patentes Mercosur correctamente (AF 123 CD)', () => {
    const f = Formatters.formatLicensePlate('af123cd');
    assert.equal(f.plate, 'AF 123 CD');
    assert.equal(f.isMercosur, true);
    assert.equal(f.isValid, true);
  });

  test('Capa 1.30: Formatters formatea patentes formato clásico (GHI 456)', () => {
    const f = Formatters.formatLicensePlate('ghi456');
    assert.equal(f.plate, 'GHI 456');
    assert.equal(f.isMercosur, false);
    assert.equal(f.isValid, true);
  });

  test('Capa 1.31: Formatters maneja patentes inválidas retornando isValid: false', () => {
    const f = Formatters.formatLicensePlate('123');
    assert.equal(f.isValid, false);
  });

  test('Capa 1.32: Formatters formatea moneda ARS y distancias', () => {
    const ars = Formatters.formatARS(185000);
    assert.ok(ars.includes('185.000') || ars.includes('185,000'));
    const km = Formatters.formatDistanceKm(84.38);
    assert.equal(km, '84.4 km');
  });

  test('Capa 1.33: Formatters formatea fecha en huso de Buenos Aires', () => {
    const d = Formatters.formatDateTimeAR('2026-11-06T15:30:00Z');
    assert.ok(d.includes('/'));
    assert.ok(d.includes(':'));
  });

  // -------------------------------------------------------------
  // CAPA 2: Integración & Outbox FIFO & Invariante Anti-Siembras
  // -------------------------------------------------------------
  test('Capa 2.1: Invariante Anti-Siembras Fantasma: isDemoPurged() es false inicialmente', () => {
    localStorage.clear();
    assert.equal(CraneTrackCacheService.isDemoPurged(), false);
  });

  test('Capa 2.2: initDemoDataIfEmpty() siembra 3 órdenes si no está purgado', () => {
    CraneTrackCacheService.initDemoDataIfEmpty();
    assert.equal(CraneTrackCacheService.getOrders().length, 3);
  });

  test('Capa 2.3: purgeAllData() borra datos y activa flag de purga', () => {
    CraneTrackCacheService.purgeAllData();
    assert.equal(CraneTrackCacheService.isDemoPurged(), true);
    assert.equal(CraneTrackCacheService.getOrders().length, 0);
  });

  test('Capa 2.4: Anti-Siembra Fantasma: initDemoDataIfEmpty() NO repuebla tras purga', () => {
    CraneTrackCacheService.initDemoDataIfEmpty();
    assert.equal(CraneTrackCacheService.getOrders().length, 0);
  });

  test('Capa 2.5: Outbox FIFO: Encola y descola acciones offline respetando orden', () => {
    localStorage.clear();
    CraneTrackCacheService.enqueueOutbox({ action: 'DISPATCH', id: '1' });
    CraneTrackCacheService.enqueueOutbox({ action: 'ON_SCENE', id: '2' });
    const list = CraneTrackCacheService.flushOutbox();
    assert.equal(list.length, 2);
    assert.equal(list[0].action, 'DISPATCH');
    assert.equal(list[1].action, 'ON_SCENE');
    assert.equal(CraneTrackCacheService.flushOutbox().length, 0);
  });

  test('Capa 2.6: CraneTrackCacheService.saveOrder actualiza orden existente por ID', () => {
    localStorage.clear();
    CraneTrackCacheService.saveOrder({ id: 'ORD-10', status: 'PENDING' });
    CraneTrackCacheService.saveOrder({ id: 'ORD-10', status: 'COMPLETED' });
    const orders = CraneTrackCacheService.getOrders();
    assert.equal(orders.length, 1);
    assert.equal(orders[0].status, 'COMPLETED');
  });

  test('Capa 2.7: CryptoSeal genera hash SHA-256 determinista de 64 caracteres', async () => {
    const h1 = await CryptoSeal.computeSha256('TEST_PAYLOAD');
    const h2 = await CryptoSeal.computeSha256('TEST_PAYLOAD');
    assert.equal(h1.length, 64);
    assert.equal(h1, h2);
  });

  test('Capa 2.8: TowActaLedgerService emite y sella un acta de remolque', async () => {
    const order = {
      id: 'ORD-TEST-88',
      vehiclePlate: 'AG 111 BB',
      vehicleModel: 'Ford Focus',
      driverName: 'Pedro Chofer',
      unitCode: 'MOV-01',
      originAddress: 'Av. Corrientes 1200',
      destinationAddress: 'Taller Central'
    };
    const insp = PreTowVisualInspectionEngine.compileInspectionRecord({
      orderId: order.id,
      plate: order.vehiclePlate,
      driverName: order.driverName,
      clientName: 'Juan Pérez',
      damages: []
    });
    const billing = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 75,
      insuranceKey: 'SAN_CRISTOBAL'
    });
    const sealed = await TowActaLedgerService.emitAndSealActa(order, insp, billing, 'FIRMA_RECIBIDO');
    assert.ok(sealed.actaId.startsWith('ACTA-TOW-'));
    assert.equal(sealed.sha256Digest.length, 64);
    assert.equal(sealed.actaPayload.plate, 'AG 111 BB');
  });

  // -------------------------------------------------------------
  // CAPA 3: Componentes & Zero-Sink Sanitizer & HTML Print
  // -------------------------------------------------------------
  test('Capa 3.1: Sanitizer.escapeHTML neutraliza XSS en tags script', () => {
    const s = Sanitizer.escapeHTML('<script>alert("hack")</script>');
    assert.equal(s.includes('<script>'), false);
    assert.ok(s.includes('&lt;script&gt;'));
  });

  test('Capa 3.2: Sanitizer.sanitizeURL bloquea esquemas javascript: y data:', () => {
    assert.equal(Sanitizer.sanitizeURL('javascript:void(0)'), '#');
    assert.equal(Sanitizer.sanitizeURL('data:image/svg+xml,...'), '#');
    assert.equal(Sanitizer.sanitizeURL('https://google.com/maps'), 'https://google.com/maps');
  });

  test('Capa 3.3: TowActaLedgerService.renderActaPrintHtml incluye membrete corporativo y sello', () => {
    const sealed = {
      actaPayload: {
        actaId: 'ACTA-999',
        sealedAt: new Date().toISOString(),
        insuranceName: 'San Cristóbal Seguros',
        plate: 'AA 999 ZZ',
        vehicleModel: 'Toyota Corolla',
        driverName: 'Chofer Test',
        unitCode: 'M-10',
        originAddress: 'Origen A',
        destinationAddress: 'Destino B',
        kilometers: { towDistanceKm: 150, coveredKm: 150, excessKm: 0 },
        billing: { insuranceSubtotalArs: 217500, clientExcessKmArs: 0, clientSurchargesArs: 0, clientTotalArs: 0, grandTotalArs: 217500 },
        damagesList: []
      },
      sha256Digest: '112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00'
    };
    const html = TowActaLedgerService.renderActaPrintHtml(sealed);
    assert.ok(html.includes('CRANETRACK • AUXILIOS Y REMOLQUES 24/7'));
    assert.ok(html.includes('AA 999 ZZ'));
    assert.ok(html.includes('112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00'));
  });

  test('Capa 3.4: TowActaLedgerService.exportInsuranceSettlementCsv genera CSV válido con BOM UTF-8', () => {
    const actas = [
      {
        actaPayload: {
          actaId: 'ACTA-01',
          sealedAt: '2026-11-06T12:00:00Z',
          insuranceName: 'La Segunda',
          plate: 'AB 123 CD',
          vehicleModel: 'Fiat Cronos',
          originAddress: 'Calle 1',
          destinationAddress: 'Calle 2',
          kilometers: { coveredKm: 50, excessKm: 0 },
          billing: { insuranceSubtotalArs: 70000, clientTotalArs: 0 }
        },
        sha256Digest: 'aabbcc'
      }
    ];
    const csv = TowActaLedgerService.exportInsuranceSettlementCsv(actas, 'ALL');
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes(';'));
    assert.ok(csv.includes('Fiat Cronos'));
  });

  // -------------------------------------------------------------
  // CAPA 4: Seguridad, CSP & Firestore Rules
  // -------------------------------------------------------------
  test('Capa 4.1: firebase.json presente en raíz', () => {
    assert.equal(fs.existsSync(path.join(ROOT, 'firebase.json')), true);
  });

  test('Capa 4.2: Content-Security-Policy estricta configurada', () => {
    const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    const headers = fb.hosting.headers[0].headers;
    const csp = headers.find((h) => h.key === 'Content-Security-Policy');
    assert.ok(csp);
    assert.equal(csp.value.includes("'unsafe-eval'"), false);
  });

  test('Capa 4.3: Cabeceras X-Frame-Options: DENY, HSTS y nosniff', () => {
    const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    const headers = fb.hosting.headers[0].headers;
    assert.ok(headers.find((h) => h.key === 'X-Frame-Options' && h.value === 'DENY'));
    assert.ok(headers.find((h) => h.key === 'X-Content-Type-Options' && h.value === 'nosniff'));
    assert.ok(headers.find((h) => h.key === 'Strict-Transport-Security'));
  });

  test('Capa 4.4: firestore.rules presente en raíz', () => {
    assert.equal(fs.existsSync(path.join(ROOT, 'firestore.rules')), true);
  });

  test('Capa 4.5: firestore.rules prohíbe allow read, write: if true;', () => {
    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    assert.equal(rules.includes('allow read, write: if true'), false);
    assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;'));
  });

  test('Capa 4.6: firestore.rules impone inmutabilidad a tow_actas', () => {
    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    assert.ok(rules.includes('match /tow_actas/{actaId}'));
    assert.ok(rules.includes('allow update: if false;'));
    assert.ok(rules.includes('allow delete: if false;'));
  });

  test('Capa 4.7: .gitignore bloquea .env y node_modules', () => {
    const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    assert.ok(gi.includes('.env'));
    assert.ok(gi.includes('node_modules'));
  });

  test('Capa 4.8: Ausencia total de secretos hardcodeados', () => {
    const files = ['package.json', 'version.json', 'firebase.json'];
    for (const f of files) {
      const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
      assert.equal(c.includes('AIzaSy'), false);
      assert.equal(c.includes('sk-ant-'), false);
    }
  });

  // -------------------------------------------------------------
  // CAPA 5: E2E Completo & Verificación de Cantidad de Tests
  // -------------------------------------------------------------
  test('Capa 5.1: Flujo E2E completo: Despacho -> Peritaje -> Split Billing -> Acta Sellada', async () => {
    const order = {
      id: 'ORD-E2E-100',
      vehiclePlate: 'AG 999 XP',
      vehicleModel: 'BMW 330i xDrive (AWD)',
      insuranceKey: 'ZURICH',
      driverName: 'Esteban Chofer',
      unitCode: 'MOV-10',
      originAddress: 'Ruta 2 Km 180 (Dolores)',
      destinationAddress: 'Taller Oficial BMW (CABA)',
      status: 'DISPATCHED'
    };

    const safety = PreTowVisualInspectionEngine.evaluateTowSafetyProtocol({
      transmission: 'AUTOMATIC',
      driveType: 'AWD_4X4',
      hasKeys: true,
      isSteeringLocked: false,
      areWheelsBlocked: false
    });
    assert.equal(safety.requiresDolly, true);

    const inspection = PreTowVisualInspectionEngine.compileInspectionRecord({
      orderId: order.id,
      plate: order.vehiclePlate,
      driverName: order.driverName,
      clientName: 'Federico Asegurado',
      damages: [
        { sector: 'Frente', damageType: 'Abolladura', description: 'Impacto con guardrail' }
      ],
      safetyProtocol: safety,
      clientSignatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
    });
    assert.equal(inspection.isSigned, true);

    const billing = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: 240,
      insuranceKey: 'ZURICH',
      surcharges: ['DOLLY_SKATES']
    });
    assert.equal(billing.coveredKm, 200);
    assert.equal(billing.excessKm, 40);

    const sealed = await TowActaLedgerService.emitAndSealActa(order, inspection, billing, 'FIRMA_TALLER');
    assert.equal(sealed.sha256Digest.length, 64);
  });

  test('Capa 5.2: Screen Wake Lock API maneja entorno sin navegador de forma no bloqueante', async () => {
    const res = await FleetEmergencyDispatcherEngine.requestScreenWakeLock();
    assert.equal(typeof res.active, 'boolean');
  });

  test('Capa 5.3: Metadatos de versión consistentes entre package.json y version.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
    assert.equal(ver.version, 'v' + pkg.version);
  });

  // Ejecución secuencial controlada
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ PASS: ${t.name}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ FAIL: ${t.name}`);
      console.error(err);
    }
  }

  console.log('\n======================================================');
  console.log(`📊 RESULTADO DE LA SUITE CRANETRACK: ${passed} PASSED | ${failed} FAILED (Total: ${tests.length})`);
  console.log('======================================================\n');

  if (tests.length < 50) {
    console.error(`❌ BLOQUEO: Se exige un mínimo de 50 tests (ejecutados: ${tests.length})`);
    process.exit(1);
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Crash in test runner:', err);
  process.exit(1);
});
