// @ts-check
import { TowMileageTariffEngine } from './core/towMileageTariffEngine.js';
import { PreTowVisualInspectionEngine } from './core/preTowVisualInspectionEngine.js';
import { FleetEmergencyDispatcherEngine } from './core/fleetEmergencyDispatcherEngine.js';
import { TowActaLedgerService } from './services/towActaLedgerService.js';
import { CraneTrackCacheService } from './services/craneTrackCache.service.js';
import { Formatters } from './utils/formatters.js';
import { Sanitizer } from './utils/sanitizer.js';

// Inicialización de datos
CraneTrackCacheService.initDemoDataIfEmpty();

// Estado reactivo en memoria
let activeTab = 'dispatch';
let selectedOrderId = null;
let currentInspectionDamages = [];
let currentWakeLockActive = false;

// Coordenadas de referencia para cálculo demo (Gran Buenos Aires / Rutas)
const LOCATIONS = {
  BASE_CENTRAL: { name: 'Base Central Pacheco (Panamericana Km 28)', lat: -34.4600, lon: -58.6300 },
  CAMPANA: { name: 'Ruta 9 Km 74 (Campana)', lat: -34.1687, lon: -58.9591 },
  ZARATE: { name: 'Taller Oficial Zárate', lat: -34.0950, lon: -59.0280 },
  PILAR: { name: 'Panamericana Ramal Pilar Km 50', lat: -34.4550, lon: -58.9100 },
  UNICENTER: { name: 'Shopping Unicenter (Martínez)', lat: -34.5080, lon: -58.5240 },
  DOLORES: { name: 'Autovía 2 Km 210 (Dolores)', lat: -36.3130, lon: -57.6790 },
  CABA: { name: 'Taller Central CABA (Warnes)', lat: -34.5980, lon: -58.4480 }
};

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupDispatchCenter();
  setupCalculator();
  setupInspectionTab();
  setupCabMode();
  setupReportsTab();
  renderAllViews();
});

function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.getAttribute('data-tab');
      if (!target) return;
      activeTab = target;
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach((sec) => sec.classList.add('hidden'));
      const activeSec = document.getElementById(`tab-${activeTab}`);
      if (activeSec) activeSec.classList.remove('hidden');
      renderAllViews();
    });
  });
}

function renderAllViews() {
  if (activeTab === 'dispatch') renderDispatchTable();
  if (activeTab === 'reports') renderReportsTable();
  if (activeTab === 'cab-mode') renderCabModeView();
}

// -------------------------------------------------------------
// 1. Centro de Despacho 24/7
// -------------------------------------------------------------
function setupDispatchCenter() {
  const btnNewTow = document.getElementById('btnOpenNewTow');
  if (btnNewTow) {
    btnNewTow.addEventListener('click', () => {
      document.querySelector('[data-tab="calculator"]')?.dispatchEvent(new MouseEvent('click'));
    });
  }
}

function renderDispatchTable() {
  const tbody = document.getElementById('tblDispatchBody');
  if (!tbody) return;

  const orders = CraneTrackCacheService.getOrders();
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No hay órdenes de auxilio activas.</td></tr>`;
    return;
  }

  const rows = orders.map((o) => {
    const sla = FleetEmergencyDispatcherEngine.evaluateSlaPerformance(o.dispatchedAt, o.targetSlaMinutes || 45);
    const plateFormatted = Formatters.formatLicensePlate(o.vehiclePlate).plate;
    const isOver = sla.isSlaBreached;

    return `
      <tr class="border-b border-slate-700/60 hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 font-mono font-bold text-orange-400">${Sanitizer.escapeHTML(o.id)}</td>
        <td class="py-3 px-4">
          <span class="inline-block bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-slate-100">${plateFormatted}</span>
          <div class="text-xs text-slate-400 mt-0.5">${Sanitizer.escapeHTML(o.vehicleModel || '')}</div>
        </td>
        <td class="py-3 px-4 text-xs">
          <div class="font-semibold text-slate-200">${Sanitizer.escapeHTML(o.insuranceKey || 'PARTICULAR')}</div>
          <div class="text-slate-400 truncate max-w-[200px]">${Sanitizer.escapeHTML(o.originAddress)}</div>
        </td>
        <td class="py-3 px-4 text-xs font-mono">
          <div class="text-slate-200">${Sanitizer.escapeHTML(o.unitCode)}</div>
          <div class="text-slate-400">${Sanitizer.escapeHTML(o.driverName)}</div>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
            isOver ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
          }">
            ${sla.elapsedMinutes}m / ${o.targetSlaMinutes || 45}m
          </span>
        </td>
        <td class="py-3 px-4 text-center font-bold text-xs">
          <span class="px-2 py-0.5 rounded ${getStatusBadgeClass(o.status)}">
            ${Sanitizer.escapeHTML(o.status)}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <button class="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2.5 py-1 rounded transition" onclick="window.selectOrderForInspection('${o.id}')">
            Peritaje
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'ON_SCENE': return 'bg-amber-900/60 text-amber-300 border border-amber-700';
    case 'IN_TRANSIT': return 'bg-blue-900/60 text-blue-300 border border-blue-700';
    case 'DELIVERED': return 'bg-emerald-900/60 text-emerald-300 border border-emerald-700';
    default: return 'bg-slate-800 text-slate-300';
  }
}

// -------------------------------------------------------------
// 2. Calculador Split-Billing & Despacho
// -------------------------------------------------------------
function setupCalculator() {
  const form = document.getElementById('formNewTow');
  const selOrigin = document.getElementById('calcOriginPreset');
  const selDest = document.getElementById('calcDestPreset');
  const inpKm = document.getElementById('calcTowKm');

  // Autocalcular km Haversine al cambiar combos de origen/destino
  const handlePresetChange = () => {
    // @ts-ignore
    const oKey = selOrigin?.value;
    // @ts-ignore
    const dKey = selDest?.value;
    if (LOCATIONS[oKey] && LOCATIONS[dKey]) {
      const dist = TowMileageTariffEngine.calculateHaversineDistanceKm(
        LOCATIONS[oKey].lat, LOCATIONS[oKey].lon,
        LOCATIONS[dKey].lat, LOCATIONS[dKey].lon
      );
      // @ts-ignore
      if (inpKm) inpKm.value = dist.toFixed(1);
      updateSplitBillingPreview();
    }
  };

  selOrigin?.addEventListener('change', handlePresetChange);
  selDest?.addEventListener('change', handlePresetChange);

  // Recalcular en tiempo real
  form?.addEventListener('input', updateSplitBillingPreview);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const plateRaw = /** @type {HTMLInputElement} */ (document.getElementById('inpPlate'))?.value || '';
    const plate = Formatters.formatLicensePlate(plateRaw).plate;
    const model = /** @type {HTMLInputElement} */ (document.getElementById('inpModel'))?.value || 'Vehículo';
    const insurance = /** @type {HTMLSelectElement} */ (document.getElementById('selInsurance'))?.value || 'LA_SEGUNDA';
    const km = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('calcTowKm'))?.value) || 35.0;
    const unitCode = /** @type {HTMLSelectElement} */ (document.getElementById('selUnit'))?.value || 'MOV-01 (Plancha)';
    const driverName = /** @type {HTMLInputElement} */ (document.getElementById('inpDriver'))?.value || 'Chofer de Guardia';
    const origin = /** @type {HTMLInputElement} */ (document.getElementById('inpOriginAddress'))?.value || 'Lugar de Siniestro';
    const dest = /** @type {HTMLInputElement} */ (document.getElementById('inpDestAddress'))?.value || 'Taller Destino';

    const newOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      dispatchedAt: new Date().toISOString(),
      vehiclePlate: plate,
      vehicleModel: model,
      insuranceKey: insurance,
      driverName,
      unitCode,
      unitType: 'LIGHT_FLATBED',
      originAddress: origin,
      destinationAddress: dest,
      status: 'DISPATCHED',
      towDistanceKm: km,
      targetSlaMinutes: 45
    };

    CraneTrackCacheService.saveOrder(newOrder);
    alert(`Auxilio ${newOrder.id} despachado exitosamente. Se notificó al móvil ${unitCode}.`);
    document.querySelector('[data-tab="dispatch"]')?.dispatchEvent(new MouseEvent('click'));
  });
}

function updateSplitBillingPreview() {
  const km = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('calcTowKm'))?.value) || 0;
  const insurance = /** @type {HTMLSelectElement} */ (document.getElementById('selInsurance'))?.value || 'LA_SEGUNDA';
  const isNight = /** @type {HTMLInputElement} */ (document.getElementById('chkNight'))?.checked || false;
  const isWinch = /** @type {HTMLInputElement} */ (document.getElementById('chkWinch'))?.checked || false;
  const isDolly = /** @type {HTMLInputElement} */ (document.getElementById('chkDolly'))?.checked || false;
  const isUnder = /** @type {HTMLInputElement} */ (document.getElementById('chkUnderground'))?.checked || false;
  const waitHours = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('inpWaitHours'))?.value) || 0;

  const surcharges = [];
  if (isWinch) surcharges.push('WINCH_DITCH');
  if (isDolly) surcharges.push('DOLLY_SKATES');
  if (isUnder) surcharges.push('UNDERGROUND_PARKING');

  const split = TowMileageTariffEngine.calculateSplitBilling({
    towDistanceKm: km,
    insuranceKey: insurance,
    surcharges,
    isNightOrHoliday: isNight,
    waitingHours: waitHours
  });

  const elIns = document.getElementById('previewInsuranceArs');
  const elClientKm = document.getElementById('previewClientKmArs');
  const elClientSurcharges = document.getElementById('previewClientSurchargesArs');
  const elClientTotal = document.getElementById('previewClientTotalArs');
  const elCoveredKm = document.getElementById('previewCoveredKm');
  const elExcessKm = document.getElementById('previewExcessKm');

  if (elIns) elIns.textContent = Formatters.formatARS(split.insuranceSubtotalArs);
  if (elClientKm) elClientKm.textContent = Formatters.formatARS(split.clientExcessKmArs);
  if (elClientSurcharges) elClientSurcharges.textContent = Formatters.formatARS(split.clientSurchargesArs);
  if (elClientTotal) elClientTotal.textContent = Formatters.formatARS(split.clientTotalArs);
  if (elCoveredKm) elCoveredKm.textContent = `${split.coveredKm.toFixed(1)} km`;
  if (elExcessKm) elExcessKm.textContent = `${split.excessKm.toFixed(1)} km`;
}

// -------------------------------------------------------------
// 3. Peritaje Pre-Enganche
// -------------------------------------------------------------
function setupInspectionTab() {
  const btnAddDamage = document.getElementById('btnAddDamage');
  const btnSealActa = document.getElementById('btnSealInspectionActa');

  btnAddDamage?.addEventListener('click', () => {
    const sector = /** @type {HTMLSelectElement} */ (document.getElementById('selDamageSector'))?.value || 'Frente';
    const type = /** @type {HTMLSelectElement} */ (document.getElementById('selDamageType'))?.value || 'Abolladura';
    const notes = /** @type {HTMLInputElement} */ (document.getElementById('inpDamageNotes'))?.value || '';

    currentInspectionDamages.push({ sector, damageType: type, description: notes });
    // @ts-ignore
    if (document.getElementById('inpDamageNotes')) document.getElementById('inpDamageNotes').value = '';
    renderDamagesList();
  });

  btnSealActa?.addEventListener('click', async () => {
    const orders = CraneTrackCacheService.getOrders();
    const order = orders.find((o) => o.id === selectedOrderId) || orders[0];
    if (!order) {
      alert('No hay orden seleccionada para peritar.');
      return;
    }

    const transmission = /** @type {HTMLSelectElement} */ (document.getElementById('selTransmission'))?.value || 'MANUAL';
    const driveType = /** @type {HTMLSelectElement} */ (document.getElementById('selDriveType'))?.value || 'FWD';
    const hasKeys = /** @type {HTMLInputElement} */ (document.getElementById('chkHasKeys'))?.checked ?? true;
    const isLocked = /** @type {HTMLInputElement} */ (document.getElementById('chkSteeringLocked'))?.checked ?? false;
    const isWheels = /** @type {HTMLInputElement} */ (document.getElementById('chkWheelsBlocked'))?.checked ?? false;

    // @ts-ignore
    const safety = PreTowVisualInspectionEngine.evaluateTowSafetyProtocol({
      transmission,
      driveType,
      hasKeys,
      isSteeringLocked: isLocked,
      areWheelsBlocked: isWheels
    });

    const inspection = PreTowVisualInspectionEngine.compileInspectionRecord({
      orderId: order.id,
      plate: order.vehiclePlate,
      driverName: order.driverName,
      clientName: 'Asegurado en Ruta',
      damages: currentInspectionDamages,
      safetyProtocol: safety,
      clientSignatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
    });

    const billing = TowMileageTariffEngine.calculateSplitBilling({
      towDistanceKm: order.towDistanceKm || 50,
      insuranceKey: order.insuranceKey || 'LA_SEGUNDA'
    });

    const sealed = await TowActaLedgerService.emitAndSealActa(order, inspection, billing, 'TALLER_RECEPTOR_OK');
    CraneTrackCacheService.saveActa(sealed);

    // Actualiza estado de la orden a DELIVERED
    order.status = 'DELIVERED';
    CraneTrackCacheService.saveOrder(order);

    alert(`✅ Acta ${sealed.actaId} sellada con SHA-256!\nDigest: ${sealed.sha256Digest.slice(0, 20)}...`);
    currentInspectionDamages = [];
    renderDamagesList();
    document.querySelector('[data-tab="reports"]')?.dispatchEvent(new MouseEvent('click'));
  });
}

function renderDamagesList() {
  const container = document.getElementById('damagesListContainer');
  if (!container) return;

  if (currentInspectionDamages.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic">No se han registrado daños preexistentes aún.</div>`;
    return;
  }

  const items = currentInspectionDamages.map((d, i) => `
    <div class="flex items-center justify-between bg-slate-800/80 border border-slate-700/80 px-3 py-2 rounded text-xs mb-1.5">
      <div>
        <strong class="text-orange-400">${Sanitizer.escapeHTML(d.sector)}:</strong> 
        <span class="text-slate-200">${Sanitizer.escapeHTML(d.damageType)}</span>
        ${d.description ? `<span class="text-slate-400">(${Sanitizer.escapeHTML(d.description)})</span>` : ''}
      </div>
      <button class="text-red-400 hover:text-red-300 ml-2" onclick="window.removeDamage(${i})">✕</button>
    </div>
  `).join('');

  container.innerHTML = items;
}

// @ts-ignore
window.removeDamage = (index) => {
  currentInspectionDamages.splice(index, 1);
  renderDamagesList();
};

// @ts-ignore
window.selectOrderForInspection = (orderId) => {
  selectedOrderId = orderId;
  const orders = CraneTrackCacheService.getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    const elHeader = document.getElementById('inspectionOrderHeader');
    if (elHeader) {
      elHeader.textContent = `Peritaje para Orden ${order.id} — Dominio: ${order.vehiclePlate} (${order.vehicleModel})`;
    }
  }
  document.querySelector('[data-tab="inspection"]')?.dispatchEvent(new MouseEvent('click'));
};

// -------------------------------------------------------------
// 4. Modo Cabina Chofer (Wake Lock)
// -------------------------------------------------------------
function setupCabMode() {
  const btnWakeLock = document.getElementById('btnToggleWakeLock');
  btnWakeLock?.addEventListener('click', async () => {
    if (!currentWakeLockActive) {
      const res = await FleetEmergencyDispatcherEngine.requestScreenWakeLock();
      if (res.active) {
        currentWakeLockActive = true;
        btnWakeLock.textContent = '🔆 PANTALLA ACTIVA EN SOPORTE';
        btnWakeLock.className = 'w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 text-base transition';
      } else {
        alert('Wake Lock no disponible en este dispositivo. Mantenga la pantalla encendida manualmente.');
      }
    } else {
      currentWakeLockActive = false;
      btnWakeLock.textContent = '💤 ACTIVAR PANTALLA FIJA (WAKE LOCK)';
      btnWakeLock.className = 'w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-extrabold rounded-xl shadow-lg shadow-orange-950/50 flex items-center justify-center gap-2 text-base transition';
    }
  });

  const btnArrived = document.getElementById('btnCabArrived');
  btnArrived?.addEventListener('click', () => {
    alert('📍 Llegada a origen registrada. Inicie peritaje visual antes de accionar el malacate.');
    document.querySelector('[data-tab="inspection"]')?.dispatchEvent(new MouseEvent('click'));
  });
}

function renderCabModeView() {
  const orders = CraneTrackCacheService.getOrders();
  const activeOrder = orders.find((o) => o.status === 'DISPATCHED' || o.status === 'IN_TRANSIT') || orders[0];

  const elPlate = document.getElementById('cabPlate');
  const elModel = document.getElementById('cabModel');
  const elOrigin = document.getElementById('cabOrigin');
  const elDest = document.getElementById('cabDest');
  const elDistance = document.getElementById('cabDistance');

  if (activeOrder) {
    if (elPlate) elPlate.textContent = activeOrder.vehiclePlate;
    if (elModel) elModel.textContent = activeOrder.vehicleModel;
    if (elOrigin) elOrigin.textContent = activeOrder.originAddress;
    if (elDest) elDest.textContent = activeOrder.destinationAddress;
    if (elDistance) elDistance.textContent = Formatters.formatDistanceKm(activeOrder.towDistanceKm || 0);
  }
}

// -------------------------------------------------------------
// 5. Liquidación & Reportes
// -------------------------------------------------------------
function setupReportsTab() {
  const btnExportCsv = document.getElementById('btnExportCsv');
  const selFilter = document.getElementById('selInsuranceFilter');

  btnExportCsv?.addEventListener('click', () => {
    const actas = CraneTrackCacheService.getActas();
    // @ts-ignore
    const filter = selFilter?.value || 'ALL';
    const csv = TowActaLedgerService.exportInsuranceSettlementCsv(actas, filter);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacion_auxilios_${filter.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  selFilter?.addEventListener('change', renderReportsTable);
}

function renderReportsTable() {
  const tbody = document.getElementById('tblReportsBody');
  const selFilter = /** @type {HTMLSelectElement} */ (document.getElementById('selInsuranceFilter'));
  const filter = selFilter ? selFilter.value : 'ALL';
  if (!tbody) return;

  const actas = CraneTrackCacheService.getActas();
  const filtered = filter === 'ALL'
    ? actas
    : actas.filter((a) => a.actaPayload.insuranceName.includes(filter) || a.actaPayload.insuranceName === filter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No hay actas emitidas para este convenio.</td></tr>`;
    return;
  }

  const rows = filtered.map((item, idx) => {
    const p = item.actaPayload;
    return `
      <tr class="border-b border-slate-700/60 hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 font-mono font-bold text-orange-400 text-xs">${Sanitizer.escapeHTML(p.actaId)}</td>
        <td class="py-3 px-4 text-xs">
          <div class="font-bold text-slate-100">${Sanitizer.escapeHTML(p.plate)}</div>
          <div class="text-slate-400">${Sanitizer.escapeHTML(p.vehicleModel || '')}</div>
        </td>
        <td class="py-3 px-4 text-xs font-semibold text-slate-200">${Sanitizer.escapeHTML(p.insuranceName)}</td>
        <td class="py-3 px-4 text-xs text-right font-mono font-bold text-emerald-400">
          ${Formatters.formatARS(p.billing.insuranceSubtotalArs)}
        </td>
        <td class="py-3 px-4 text-xs text-right font-mono font-bold text-orange-400">
          ${Formatters.formatARS(p.billing.clientTotalArs)}
        </td>
        <td class="py-3 px-4 text-center">
          <button class="bg-orange-600 hover:bg-orange-500 text-white text-xs px-2.5 py-1 rounded transition" onclick="window.printActa(${idx})">
            🖨️ Imprimir
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

// @ts-ignore
window.printActa = (idx) => {
  const actas = CraneTrackCacheService.getActas();
  const item = actas[idx];
  if (!item) return;

  const html = TowActaLedgerService.renderActaPrintHtml(item);
  const container = document.getElementById('printContainer');
  if (container) {
    container.innerHTML = html;
    window.print();
  }
};
