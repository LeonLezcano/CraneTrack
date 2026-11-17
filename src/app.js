// @ts-check
import { TowMileageTariffEngine } from './core/towMileageTariffEngine.js';
import { PreTowVisualInspectionEngine } from './core/preTowVisualInspectionEngine.js';
import { FleetEmergencyDispatcherEngine } from './core/fleetEmergencyDispatcherEngine.js';
import { TowActaLedgerService } from './services/towActaLedgerService.js';
import { CraneTrackCacheService } from './services/craneTrackCache.service.js';
import { Formatters } from './utils/formatters.js';
import { Sanitizer } from './utils/sanitizer.js';

// Inicialización de datos (respeta invariante cranetrack_demo_purged)
CraneTrackCacheService.initDemoDataIfEmpty();

// Estado reactivo en memoria
let activeTab = 'dispatch';
let selectedOrderId = null;
let currentInspectionDamages = [];
let currentWakeLockActive = false;
let hasSignatureStroke = false;

const FLEET_TOTAL_UNITS = 5;

// Coordenadas de referencia para cálculo local (Gran Buenos Aires / Rutas)
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
  setupStatusBanner();
  setupNavigation();
  setupDispatchCenter();
  setupCalculator();
  setupInspectionTab();
  setupCabMode();
  setupReportsTab();
  updateSplitBillingPreview();
  renderAllViews();
});

// -------------------------------------------------------------
// Feedback no bloqueante en pantalla
// -------------------------------------------------------------
function showStatusBanner(message, tone = 'info') {
  const banner = document.getElementById('appStatusBanner');
  const textEl = document.getElementById('appStatusMessage');
  if (!banner || !textEl) return;

  textEl.textContent = message;
  banner.classList.remove('hidden', 'border-slate-700', 'border-emerald-700', 'border-amber-700', 'border-red-700', 'bg-slate-900', 'bg-emerald-950', 'bg-amber-950', 'bg-red-950');
  if (tone === 'success') {
    banner.classList.add('border-emerald-700', 'bg-emerald-950');
  } else if (tone === 'warning') {
    banner.classList.add('border-amber-700', 'bg-amber-950');
  } else if (tone === 'error') {
    banner.classList.add('border-red-700', 'bg-red-950');
  } else {
    banner.classList.add('border-slate-700', 'bg-slate-900');
  }
}

function hideStatusBanner() {
  const banner = document.getElementById('appStatusBanner');
  banner?.classList.add('hidden');
}

function setupStatusBanner() {
  document.getElementById('btnCloseStatusBanner')?.addEventListener('click', hideStatusBanner);
}

// -------------------------------------------------------------
// Navegación por pestañas con soporte ARIA
// -------------------------------------------------------------
function switchToTab(targetTab) {
  if (!targetTab) return;
  activeTab = targetTab;
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach((t) => {
    const isMatch = t.getAttribute('data-tab') === targetTab;
    t.classList.toggle('active', isMatch);
    t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-content').forEach((sec) => sec.classList.add('hidden'));
  const activeSec = document.getElementById(`tab-${activeTab}`);
  if (activeSec) activeSec.classList.remove('hidden');
  renderAllViews();
}

function setupNavigation() {
  const tabs = Array.from(document.querySelectorAll('.nav-tab'));
  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.getAttribute('data-tab');
      if (target) switchToTab(target);
    });
    tab.addEventListener('keydown', (e) => {
      const ke = /** @type {KeyboardEvent} */ (e);
      if (ke.key === 'ArrowRight' || ke.key === 'ArrowLeft') {
        ke.preventDefault();
        const nextIdx = ke.key === 'ArrowRight'
          ? (idx + 1) % tabs.length
          : (idx - 1 + tabs.length) % tabs.length;
        const nextTab = /** @type {HTMLElement} */ (tabs[nextIdx]);
        nextTab.focus();
        const target = nextTab.getAttribute('data-tab');
        if (target) switchToTab(target);
      }
    });
  });
}

function renderAllViews() {
  renderDispatchKpis();
  if (activeTab === 'dispatch') renderDispatchTable();
  if (activeTab === 'inspection') renderInspectionOrderSelector();
  if (activeTab === 'reports') renderReportsTable();
  if (activeTab === 'cab-mode') renderCabModeView();
}

// -------------------------------------------------------------
// 1. Centro de Despacho 24/7
// -------------------------------------------------------------
function setupDispatchCenter() {
  document.getElementById('btnOpenNewTow')?.addEventListener('click', () => {
    switchToTab('calculator');
  });

  const tbody = document.getElementById('tblDispatchBody');
  tbody?.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement|null} */ (e.target);
    const btn = target?.closest('button[data-action="inspect-order"]');
    if (!btn) return;
    const orderId = btn.getAttribute('data-order-id');
    if (orderId) selectOrderForInspection(orderId);
  });

  // Diálogo accesible para limpiar datos locales/demo
  const dlg = /** @type {HTMLDialogElement|null} */ (document.getElementById('dlgConfirmPurge'));
  document.getElementById('btnPurgeDemo')?.addEventListener('click', () => {
    if (dlg && typeof dlg.showModal === 'function') {
      dlg.showModal();
    } else {
      executePurgeAllData();
    }
  });
  document.getElementById('btnCancelPurge')?.addEventListener('click', () => dlg?.close());
  document.getElementById('btnConfirmPurge')?.addEventListener('click', () => {
    dlg?.close();
    executePurgeAllData();
  });
  dlg?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dlg.close();
  });
}

function executePurgeAllData() {
  CraneTrackCacheService.purgeAllData();
  selectedOrderId = null;
  currentInspectionDamages = [];
  renderDamagesList();
  renderAllViews();
  showStatusBanner('Datos locales y registros demo eliminados. Puede registrar un nuevo auxilio cuando lo necesite.', 'info');
}

function renderDispatchKpis() {
  const orders = CraneTrackCacheService.getOrders();
  const actas = CraneTrackCacheService.getActas();

  const activeOrders = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  const assignedUnits = new Set(activeOrders.map((o) => o.unitCode).filter(Boolean)).size;
  const onSceneCount = activeOrders.filter((o) => o.status === 'ON_SCENE').length;
  const inRouteCount = activeOrders.length - onSceneCount;

  let slaText = '--';
  let slaMeta = 'Sin órdenes para evaluar';
  if (orders.length > 0) {
    const withinSla = orders.filter((o) => !FleetEmergencyDispatcherEngine.evaluateSlaPerformance(o.dispatchedAt, o.targetSlaMinutes || 45).isSlaBreached).length;
    const pct = ((withinSla / orders.length) * 100).toFixed(1);
    slaText = `${pct}%`;
    slaMeta = `${withinSla} de ${orders.length} dentro del SLA`;
  }

  const totalClientArs = actas.reduce((acc, a) => acc + (Number(a?.actaPayload?.billing?.clientTotalArs) || 0), 0);

  const elAssigned = document.getElementById('kpiAssignedUnits');
  const elAssignedMeta = document.getElementById('kpiAssignedUnitsMeta');
  const elActive = document.getElementById('kpiActiveOrders');
  const elActiveMeta = document.getElementById('kpiActiveOrdersMeta');
  const elSla = document.getElementById('kpiSlaCompliance');
  const elSlaMeta = document.getElementById('kpiSlaComplianceMeta');
  const elExcess = document.getElementById('kpiClientExcessTotal');
  const elExcessMeta = document.getElementById('kpiClientExcessMeta');

  if (elAssigned) elAssigned.textContent = `${assignedUnits} / ${FLEET_TOTAL_UNITS}`;
  if (elAssignedMeta) elAssignedMeta.textContent = assignedUnits > 0 ? 'Unidades con servicio asignado' : 'Flota disponible en base';
  if (elActive) elActive.textContent = String(activeOrders.length);
  if (elActiveMeta) elActiveMeta.textContent = `${onSceneCount} en siniestro, ${inRouteCount} en ruta`;
  if (elSla) elSla.textContent = slaText;
  if (elSlaMeta) elSlaMeta.textContent = slaMeta;
  if (elExcess) elExcess.textContent = Formatters.formatARS(totalClientArs);
  if (elExcessMeta) elExcessMeta.textContent = `${actas.length} acta(s) sellada(s)`;
}

function renderDispatchTable() {
  const tbody = document.getElementById('tblDispatchBody');
  if (!tbody) return;

  const orders = CraneTrackCacheService.getOrders();
  if (orders.length === 0) {
    Sanitizer.safeSetInnerHTML(
      tbody,
      '<tr><td colspan="7" class="text-center py-8 px-4 text-slate-300">No hay órdenes de auxilio activas. Use "Nuevo Pedido de Grúa" para despachar una unidad.</td></tr>'
    );
    return;
  }

  const rows = orders.map((o) => {
    const sla = FleetEmergencyDispatcherEngine.evaluateSlaPerformance(o.dispatchedAt, o.targetSlaMinutes || 45);
    const plateFormatted = Formatters.formatLicensePlate(o.vehiclePlate).plate;
    const isOver = sla.isSlaBreached;
    const demoBadge = o.isDemo
      ? '<span class="ml-1.5 px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-amber-300 font-mono text-xs">[DEMO]</span>'
      : '';

    return `
      <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
        <td class="py-3 px-4 font-mono font-bold text-orange-400">
          ${Sanitizer.escapeHTML(o.id)}${demoBadge}
        </td>
        <td class="py-3 px-4">
          <span class="inline-block bg-slate-950 border border-slate-700 px-2 py-0.5 rounded-md font-mono font-bold text-slate-100">${Sanitizer.escapeHTML(plateFormatted)}</span>
          <div class="text-xs text-slate-300 mt-0.5">${Sanitizer.escapeHTML(o.vehicleModel || '')}</div>
        </td>
        <td class="py-3 px-4 text-xs">
          <div class="font-semibold text-slate-100">${Sanitizer.escapeHTML(o.insuranceKey || 'PARTICULAR')}</div>
          <div class="text-slate-300 truncate max-w-[220px]">${Sanitizer.escapeHTML(o.originAddress)}</div>
        </td>
        <td class="py-3 px-4 text-xs font-mono">
          <div class="text-slate-100">${Sanitizer.escapeHTML(o.unitCode)}</div>
          <div class="text-slate-300">${Sanitizer.escapeHTML(o.driverName)}</div>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
            isOver ? 'bg-red-950 text-red-200 border border-red-800' : 'bg-emerald-950 text-emerald-200 border border-emerald-800'
          }">
            ${sla.elapsedMinutes}m / ${o.targetSlaMinutes || 45}m
          </span>
        </td>
        <td class="py-3 px-4 text-center font-bold text-xs">
          <span class="inline-block px-2.5 py-1 rounded-md ${getStatusBadgeClass(o.status)}">
            ${Sanitizer.escapeHTML(o.status)}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <button type="button" data-action="inspect-order" data-order-id="${Sanitizer.escapeHTML(o.id)}"
            class="min-h-[44px] min-w-[44px] bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg transition">
            Peritaje
          </button>
        </td>
      </tr>
    `;
  }).join('');

  Sanitizer.safeSetInnerHTML(tbody, rows);
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'ON_SCENE': return 'bg-amber-950 text-amber-200 border border-amber-700';
    case 'IN_TRANSIT': return 'bg-blue-950 text-blue-200 border border-blue-700';
    case 'DELIVERED': return 'bg-emerald-950 text-emerald-200 border border-emerald-700';
    default: return 'bg-slate-800 text-slate-200 border border-slate-700';
  }
}

// -------------------------------------------------------------
// 2. Calculador Split-Billing & Despacho
// -------------------------------------------------------------
function getSelectedCalculatorSurcharges() {
  const surcharges = [];
  if (/** @type {HTMLInputElement|null} */ (document.getElementById('chkWinch'))?.checked) surcharges.push('WINCH_DITCH');
  if (/** @type {HTMLInputElement|null} */ (document.getElementById('chkDolly'))?.checked) surcharges.push('DOLLY_SKATES');
  if (/** @type {HTMLInputElement|null} */ (document.getElementById('chkUnderground'))?.checked) surcharges.push('UNDERGROUND_PARKING');
  return surcharges;
}

function setupCalculator() {
  const form = document.getElementById('formNewTow');
  const selOrigin = /** @type {HTMLSelectElement|null} */ (document.getElementById('calcOriginPreset'));
  const selDest = /** @type {HTMLSelectElement|null} */ (document.getElementById('calcDestPreset'));
  const inpOrigin = /** @type {HTMLInputElement|null} */ (document.getElementById('inpOriginAddress'));
  const inpDest = /** @type {HTMLInputElement|null} */ (document.getElementById('inpDestAddress'));
  const inpKm = /** @type {HTMLInputElement|null} */ (document.getElementById('calcTowKm'));
  const errBox = document.getElementById('calcFormError');

  const handlePresetChange = () => {
    const oKey = selOrigin?.value || '';
    const dKey = selDest?.value || '';
    if (LOCATIONS[oKey] && inpOrigin) inpOrigin.value = LOCATIONS[oKey].name;
    if (LOCATIONS[dKey] && inpDest) inpDest.value = LOCATIONS[dKey].name;
    if (LOCATIONS[oKey] && LOCATIONS[dKey]) {
      const dist = TowMileageTariffEngine.calculateHaversineDistanceKm(
        LOCATIONS[oKey].lat, LOCATIONS[oKey].lon,
        LOCATIONS[dKey].lat, LOCATIONS[dKey].lon
      );
      if (inpKm) inpKm.value = dist.toFixed(1);
      updateSplitBillingPreview();
    }
  };

  selOrigin?.addEventListener('change', handlePresetChange);
  selDest?.addEventListener('change', handlePresetChange);
  form?.addEventListener('input', updateSplitBillingPreview);
  form?.addEventListener('change', updateSplitBillingPreview);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    errBox?.classList.add('hidden');

    const plateRaw = /** @type {HTMLInputElement|null} */ (document.getElementById('inpPlate'))?.value || '';
    const parsedPlate = Formatters.formatLicensePlate(plateRaw);
    const model = (/** @type {HTMLInputElement|null} */ (document.getElementById('inpModel'))?.value || '').trim();
    const km = parseFloat(inpKm?.value || '0');

    if (!parsedPlate.isValid) {
      if (errBox) {
        errBox.textContent = 'Ingrese una patente argentina válida (formato Mercosur AB 123 CD o clásico ABC 123).';
        errBox.classList.remove('hidden');
      }
      document.getElementById('inpPlate')?.focus();
      return;
    }
    if (!model) {
      if (errBox) {
        errBox.textContent = 'Ingrese el modelo del vehículo a asistir.';
        errBox.classList.remove('hidden');
      }
      document.getElementById('inpModel')?.focus();
      return;
    }
    if (!Number.isFinite(km) || km <= 0) {
      if (errBox) {
        errBox.textContent = 'La distancia de acarreo debe ser mayor a 0 km.';
        errBox.classList.remove('hidden');
      }
      inpKm?.focus();
      return;
    }

    const insurance = /** @type {HTMLSelectElement|null} */ (document.getElementById('selInsurance'))?.value || 'LA_SEGUNDA';
    const unitCode = /** @type {HTMLSelectElement|null} */ (document.getElementById('selUnit'))?.value || 'MOV-01 (Plancha)';
    const driverName = (/** @type {HTMLInputElement|null} */ (document.getElementById('inpDriver'))?.value || '').trim() || 'Chofer de Guardia';
    const contactPhone = (/** @type {HTMLInputElement|null} */ (document.getElementById('inpClientPhone'))?.value || '').trim();
    const origin = (inpOrigin?.value || '').trim() || 'Lugar de Siniestro';
    const dest = (inpDest?.value || '').trim() || 'Taller Destino';
    const isNightOrHoliday = /** @type {HTMLInputElement|null} */ (document.getElementById('chkNight'))?.checked || false;
    const waitingHours = Math.max(0, parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('inpWaitHours'))?.value || '0') || 0);
    const surcharges = getSelectedCalculatorSurcharges();

    const newOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      dispatchedAt: new Date().toISOString(),
      vehiclePlate: parsedPlate.plate,
      vehicleModel: model,
      insuranceKey: insurance,
      driverName,
      contactPhone,
      unitCode,
      unitType: 'LIGHT_FLATBED',
      originAddress: origin,
      destinationAddress: dest,
      surcharges,
      isNightOrHoliday,
      waitingHours,
      isDemo: false,
      status: 'DISPATCHED',
      towDistanceKm: km,
      targetSlaMinutes: 45
    };

    CraneTrackCacheService.saveOrder(newOrder);
    CraneTrackCacheService.enqueueOutbox({ action: 'DISPATCH', orderId: newOrder.id });
    selectedOrderId = newOrder.id;
    showStatusBanner(`Auxilio ${newOrder.id} registrado y asignado al móvil ${unitCode}.`, 'success');
    switchToTab('dispatch');
  });
}

function updateSplitBillingPreview() {
  const km = Math.max(0, parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('calcTowKm'))?.value || '0') || 0);
  const insurance = /** @type {HTMLSelectElement|null} */ (document.getElementById('selInsurance'))?.value || 'LA_SEGUNDA';
  const isNight = /** @type {HTMLInputElement|null} */ (document.getElementById('chkNight'))?.checked || false;
  const waitHours = Math.max(0, parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('inpWaitHours'))?.value || '0') || 0);
  const surcharges = getSelectedCalculatorSurcharges();

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
  const elQr = document.getElementById('previewQrString');

  if (elIns) elIns.textContent = Formatters.formatARS(split.insuranceSubtotalArs);
  if (elClientKm) elClientKm.textContent = Formatters.formatARS(split.clientExcessKmArs);
  if (elClientSurcharges) elClientSurcharges.textContent = Formatters.formatARS(split.clientSurchargesArs);
  if (elClientTotal) elClientTotal.textContent = Formatters.formatARS(split.clientTotalArs);
  if (elCoveredKm) elCoveredKm.textContent = `${split.coveredKm.toFixed(1)} km`;
  if (elExcessKm) elExcessKm.textContent = `${split.excessKm.toFixed(1)} km`;
  if (elQr) elQr.textContent = split.qrPaymentString;
}

// -------------------------------------------------------------
// 3. Peritaje Pre-Enganche y Pad de Firma
// -------------------------------------------------------------
function setupSignaturePad() {
  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('signatureCanvas'));
  const btnClear = document.getElementById('btnClearSignature');
  const statusEl = document.getElementById('signatureStatus');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let drawing = false;
  const setStatus = (signed) => {
    hasSignatureStroke = signed;
    if (statusEl) statusEl.textContent = signed ? 'Firma capturada en pantalla' : 'Sin trazo registrado';
  };

  const getCoords = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || canvas.width);
    const scaleY = canvas.height / (rect.height || canvas.height);
    return {
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY
    };
  };

  canvas.addEventListener('pointerdown', (ev) => {
    drawing = true;
    canvas.setPointerCapture?.(ev.pointerId);
    const p = getCoords(ev);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const p = getCoords(ev);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasSignatureStroke) setStatus(true);
  });

  const endStroke = () => { drawing = false; };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  btnClear?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStatus(false);
  });
}

function clearSignaturePad() {
  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('signatureCanvas'));
  const statusEl = document.getElementById('signatureStatus');
  const ctx = canvas?.getContext('2d');
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignatureStroke = false;
  if (statusEl) statusEl.textContent = 'Sin trazo registrado';
}

function renderInspectionOrderSelector() {
  const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('selInspectionOrder'));
  const emptyState = document.getElementById('inspectionEmptyState');
  const headerEl = document.getElementById('inspectionOrderHeader');
  const btnSeal = /** @type {HTMLButtonElement|null} */ (document.getElementById('btnSealInspectionActa'));
  const orders = CraneTrackCacheService.getOrders();

  if (!sel) return;

  if (orders.length === 0) {
    Sanitizer.safeSetInnerHTML(sel, '<option value="">Sin órdenes disponibles</option>');
    sel.disabled = true;
    emptyState?.classList.remove('hidden');
    if (btnSeal) btnSeal.disabled = true;
    if (headerEl) headerEl.textContent = 'Peritaje Visual Pre-Enganche';
    return;
  }

  sel.disabled = false;
  emptyState?.classList.add('hidden');
  if (btnSeal) btnSeal.disabled = false;

  if (!selectedOrderId || !orders.some((o) => o.id === selectedOrderId)) {
    selectedOrderId = orders[0].id;
  }

  const optionsHtml = orders.map((o) => {
    const label = `${o.id} - ${o.vehiclePlate} (${o.vehicleModel || 'Vehículo'})`;
    const isSel = o.id === selectedOrderId ? ' selected' : '';
    return `<option value="${Sanitizer.escapeHTML(o.id)}"${isSel}>${Sanitizer.escapeHTML(label)}</option>`;
  }).join('');

  Sanitizer.safeSetInnerHTML(sel, optionsHtml);
  sel.value = selectedOrderId;

  const current = orders.find((o) => o.id === selectedOrderId);
  if (current && headerEl) {
    headerEl.textContent = `Peritaje para Orden ${current.id} - Dominio: ${current.vehiclePlate} (${current.vehicleModel || 'Vehículo'})`;
  }
}

function setupInspectionTab() {
  setupSignaturePad();

  const selOrder = /** @type {HTMLSelectElement|null} */ (document.getElementById('selInspectionOrder'));
  selOrder?.addEventListener('change', () => {
    selectedOrderId = selOrder.value || null;
    renderInspectionOrderSelector();
  });

  document.getElementById('damagesListContainer')?.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement|null} */ (e.target);
    const btn = target?.closest('button[data-action="remove-damage"]');
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-index') || '-1', 10);
    if (idx >= 0) {
      currentInspectionDamages.splice(idx, 1);
      renderDamagesList();
    }
  });

  const btnAddDamage = document.getElementById('btnAddDamage');
  const btnSealActa = /** @type {HTMLButtonElement|null} */ (document.getElementById('btnSealInspectionActa'));

  btnAddDamage?.addEventListener('click', () => {
    const sector = /** @type {HTMLSelectElement|null} */ (document.getElementById('selDamageSector'))?.value || 'Frente';
    const type = /** @type {HTMLSelectElement|null} */ (document.getElementById('selDamageType'))?.value || 'Abolladura';
    const inpNotes = /** @type {HTMLInputElement|null} */ (document.getElementById('inpDamageNotes'));
    const notes = inpNotes?.value || '';

    currentInspectionDamages.push({ sector, damageType: type, description: notes });
    if (inpNotes) inpNotes.value = '';
    renderDamagesList();
  });

  btnSealActa?.addEventListener('click', async () => {
    const orders = CraneTrackCacheService.getOrders();
    const order = orders.find((o) => o.id === selectedOrderId) || orders[0];
    if (!order) {
      showStatusBanner('No hay orden seleccionada para peritar.', 'warning');
      return;
    }

    const origDisabled = btnSealActa.disabled;
    const origText = btnSealActa.textContent;
    btnSealActa.disabled = true;
    btnSealActa.textContent = 'Sellando acta con SHA-256...';

    try {
      const transmission = /** @type {'MANUAL'|'AUTOMATIC'} */ (
        /** @type {HTMLSelectElement|null} */ (document.getElementById('selTransmission'))?.value || 'MANUAL'
      );
      const driveType = /** @type {'FWD'|'RWD'|'AWD_4X4'} */ (
        /** @type {HTMLSelectElement|null} */ (document.getElementById('selDriveType'))?.value || 'FWD'
      );
      const hasKeys = /** @type {HTMLInputElement|null} */ (document.getElementById('chkHasKeys'))?.checked ?? true;
      const isLocked = /** @type {HTMLInputElement|null} */ (document.getElementById('chkSteeringLocked'))?.checked ?? false;
      const isWheels = /** @type {HTMLInputElement|null} */ (document.getElementById('chkWheelsBlocked'))?.checked ?? false;

      const safety = PreTowVisualInspectionEngine.evaluateTowSafetyProtocol({
        transmission,
        driveType,
        hasKeys,
        isSteeringLocked: isLocked,
        areWheelsBlocked: isWheels
      });

      const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('signatureCanvas'));
      const clientSignatureBase64 = hasSignatureStroke && canvas ? canvas.toDataURL('image/png') : '';
      const receiverInput = (/** @type {HTMLInputElement|null} */ (document.getElementById('inpReceiverName'))?.value || '').trim();

      const inspection = PreTowVisualInspectionEngine.compileInspectionRecord({
        orderId: order.id,
        plate: order.vehiclePlate,
        driverName: order.driverName,
        clientName: 'Asegurado en Ruta',
        damages: currentInspectionDamages,
        safetyProtocol: safety,
        clientSignatureBase64
      });

      const billing = TowMileageTariffEngine.calculateSplitBilling({
        towDistanceKm: order.towDistanceKm || 50,
        insuranceKey: order.insuranceKey || 'LA_SEGUNDA',
        surcharges: Array.isArray(order.surcharges) ? order.surcharges : [],
        isNightOrHoliday: Boolean(order.isNightOrHoliday),
        waitingHours: Number(order.waitingHours) || 0
      });

      const sealed = await TowActaLedgerService.emitAndSealActa(order, inspection, billing, receiverInput);
      CraneTrackCacheService.saveActa(sealed);

      order.status = 'DELIVERED';
      CraneTrackCacheService.saveOrder(order);

      showStatusBanner(`Acta ${sealed.actaId} sellada con SHA-256 (${sealed.sha256Digest.slice(0, 16)}...).`, 'success');
      currentInspectionDamages = [];
      renderDamagesList();
      clearSignaturePad();
      const inpReceiver = /** @type {HTMLInputElement|null} */ (document.getElementById('inpReceiverName'));
      if (inpReceiver) inpReceiver.value = '';
      switchToTab('reports');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al sellar acta';
      showStatusBanner(`No se pudo sellar el acta: ${msg}`, 'error');
    } finally {
      btnSealActa.disabled = origDisabled;
      if (origText) btnSealActa.textContent = origText;
    }
  });
}

function renderDamagesList() {
  const container = document.getElementById('damagesListContainer');
  if (!container) return;

  if (currentInspectionDamages.length === 0) {
    Sanitizer.safeSetInnerHTML(
      container,
      '<div class="text-xs text-slate-400 py-2">No se han registrado daños preexistentes aún.</div>'
    );
    return;
  }

  const items = currentInspectionDamages.map((d, i) => `
    <div class="flex items-center justify-between py-2.5 gap-3 text-xs">
      <div>
        <strong class="text-orange-400">${Sanitizer.escapeHTML(d.sector)}:</strong>
        <span class="text-slate-100">${Sanitizer.escapeHTML(d.damageType)}</span>
        ${d.description ? `<span class="text-slate-300"> (${Sanitizer.escapeHTML(d.description)})</span>` : ''}
      </div>
      <button type="button" data-action="remove-damage" data-index="${i}" aria-label="Eliminar daño"
        class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-red-300 hover:bg-red-950 hover:text-red-200 transition shrink-0">
        <svg aria-hidden="true" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');

  Sanitizer.safeSetInnerHTML(container, items);
}

function selectOrderForInspection(orderId) {
  selectedOrderId = orderId;
  switchToTab('inspection');
}

// -------------------------------------------------------------
// 4. Modo Cabina Chofer (Wake Lock + Estado Real)
// -------------------------------------------------------------
function getActiveCabOrder() {
  const orders = CraneTrackCacheService.getOrders();
  if (orders.length === 0) return null;
  if (selectedOrderId) {
    const picked = orders.find((o) => o.id === selectedOrderId);
    if (picked) return picked;
  }
  return orders.find((o) => o.status === 'DISPATCHED' || o.status === 'IN_TRANSIT' || o.status === 'ON_SCENE') || orders[0];
}

function setupCabMode() {
  const btnWakeLock = document.getElementById('btnToggleWakeLock');
  btnWakeLock?.addEventListener('click', async () => {
    if (!currentWakeLockActive) {
      const res = await FleetEmergencyDispatcherEngine.requestScreenWakeLock();
      if (res.active) {
        currentWakeLockActive = true;
        btnWakeLock.textContent = 'PANTALLA ACTIVA EN SOPORTE (WAKE LOCK)';
        btnWakeLock.classList.remove('bg-orange-600', 'hover:bg-orange-500');
        btnWakeLock.classList.add('bg-emerald-700', 'hover:bg-emerald-600');
        showStatusBanner('Bloqueo de pantalla activo para soporte en parabrisas.', 'success');
      } else {
        showStatusBanner('Screen Wake Lock no disponible en este navegador o dispositivo. Mantenga la pantalla encendida manualmente.', 'warning');
      }
    } else {
      currentWakeLockActive = false;
      btnWakeLock.textContent = 'ACTIVAR PANTALLA FIJA (WAKE LOCK)';
      btnWakeLock.classList.remove('bg-emerald-700', 'hover:bg-emerald-600');
      btnWakeLock.classList.add('bg-orange-600', 'hover:bg-orange-500');
    }
  });

  const btnArrived = document.getElementById('btnCabArrived');
  btnArrived?.addEventListener('click', () => {
    const activeOrder = getActiveCabOrder();
    if (!activeOrder) {
      showStatusBanner('No hay una orden activa para confirmar llegada.', 'warning');
      return;
    }
    activeOrder.status = FleetEmergencyDispatcherEngine.TOW_STATUSES.ON_SCENE;
    CraneTrackCacheService.saveOrder(activeOrder);
    CraneTrackCacheService.enqueueOutbox({ action: 'ON_SCENE', orderId: activeOrder.id });
    selectedOrderId = activeOrder.id;
    showStatusBanner(`Llegada a siniestro registrada para orden ${activeOrder.id}. Complete el peritaje pre-enganche.`, 'success');
    switchToTab('inspection');
  });
}

function renderCabModeView() {
  const activeOrder = getActiveCabOrder();

  const emptyEl = document.getElementById('cabEmptyState');
  const detailsEl = document.getElementById('cabOrderDetails');
  const badgeEl = document.getElementById('cabStatusBadge');
  const elPlate = document.getElementById('cabPlate');
  const elModel = document.getElementById('cabModel');
  const elOrigin = document.getElementById('cabOrigin');
  const elDest = document.getElementById('cabDest');
  const elDistance = document.getElementById('cabDistance');
  const mapsLink = /** @type {HTMLAnchorElement|null} */ (document.getElementById('cabMapsLink'));
  const callLink = /** @type {HTMLAnchorElement|null} */ (document.getElementById('cabCallLink'));
  const callLabel = document.getElementById('cabCallLabel');
  const btnArrived = /** @type {HTMLButtonElement|null} */ (document.getElementById('btnCabArrived'));

  if (!activeOrder) {
    emptyEl?.classList.remove('hidden');
    detailsEl?.classList.add('hidden');
    if (badgeEl) badgeEl.textContent = 'SIN ORDEN';
    if (btnArrived) btnArrived.disabled = true;
    if (mapsLink) {
      mapsLink.href = '#';
      mapsLink.classList.add('opacity-50', 'pointer-events-none');
    }
    if (callLink) {
      callLink.href = '#';
      callLink.classList.add('opacity-50', 'pointer-events-none');
    }
    if (callLabel) callLabel.textContent = 'Sin teléfono';
    return;
  }

  emptyEl?.classList.add('hidden');
  detailsEl?.classList.remove('hidden');
  if (btnArrived) btnArrived.disabled = false;

  if (badgeEl) badgeEl.textContent = activeOrder.status || 'DISPATCHED';
  if (elPlate) elPlate.textContent = activeOrder.vehiclePlate || '--';
  if (elModel) elModel.textContent = activeOrder.vehicleModel || '--';
  if (elOrigin) elOrigin.textContent = activeOrder.originAddress || '--';
  if (elDest) elDest.textContent = activeOrder.destinationAddress || '--';
  if (elDistance) elDistance.textContent = Formatters.formatDistanceKm(activeOrder.towDistanceKm || 0);

  if (mapsLink) {
    const query = encodeURIComponent(activeOrder.originAddress || '');
    mapsLink.href = Sanitizer.sanitizeURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    mapsLink.classList.remove('opacity-50', 'pointer-events-none');
  }

  if (callLink && callLabel) {
    const cleanPhone = String(activeOrder.contactPhone || '').replace(/[^+\d]/g, '');
    if (cleanPhone) {
      callLink.href = Sanitizer.sanitizeURL(`tel:${cleanPhone}`);
      callLink.classList.remove('opacity-50', 'pointer-events-none');
      callLabel.textContent = `Llamar (${activeOrder.contactPhone})`;
    } else {
      callLink.href = '#';
      callLink.classList.add('opacity-50', 'pointer-events-none');
      callLabel.textContent = 'Sin teléfono cargado';
    }
  }
}

// -------------------------------------------------------------
// 5. Liquidación & Reportes
// -------------------------------------------------------------
function setupReportsTab() {
  const btnExportCsv = document.getElementById('btnExportCsv');
  const selFilter = /** @type {HTMLSelectElement|null} */ (document.getElementById('selInsuranceFilter'));

  btnExportCsv?.addEventListener('click', () => {
    const actas = CraneTrackCacheService.getActas();
    const filter = selFilter?.value || 'ALL';
    const filtered = filter === 'ALL'
      ? actas
      : actas.filter((a) => a.actaPayload.insuranceName.includes(filter) || a.actaPayload.insuranceName === filter);
    const csv = TowActaLedgerService.exportInsuranceSettlementCsv(filtered, 'ALL');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacion_auxilios_${filter.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  selFilter?.addEventListener('change', renderReportsTable);

  document.getElementById('tblReportsBody')?.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement|null} */ (e.target);
    const btn = target?.closest('button[data-action="print-acta"]');
    if (!btn) return;
    const actaId = btn.getAttribute('data-acta-id');
    if (actaId) printActaById(actaId);
  });
}

function renderReportsTable() {
  const tbody = document.getElementById('tblReportsBody');
  const selFilter = /** @type {HTMLSelectElement|null} */ (document.getElementById('selInsuranceFilter'));
  const filter = selFilter ? selFilter.value : 'ALL';
  if (!tbody) return;

  const actas = CraneTrackCacheService.getActas();
  const filtered = filter === 'ALL'
    ? actas
    : actas.filter((a) => a.actaPayload.insuranceName.includes(filter) || a.actaPayload.insuranceName === filter);

  if (filtered.length === 0) {
    Sanitizer.safeSetInnerHTML(
      tbody,
      '<tr><td colspan="6" class="text-center py-8 px-4 text-slate-300">No hay actas emitidas para este filtro. Selle un peritaje en Peritaje Daños para generar la primera acta.</td></tr>'
    );
    return;
  }

  const rows = filtered.map((item) => {
    const p = item.actaPayload;
    return `
      <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
        <td class="py-3 px-4 font-mono font-bold text-orange-400 text-xs">${Sanitizer.escapeHTML(p.actaId)}</td>
        <td class="py-3 px-4 text-xs">
          <div class="font-bold text-slate-100">${Sanitizer.escapeHTML(p.plate)}</div>
          <div class="text-slate-300">${Sanitizer.escapeHTML(p.vehicleModel || '')}</div>
        </td>
        <td class="py-3 px-4 text-xs font-semibold text-slate-100">${Sanitizer.escapeHTML(p.insuranceName)}</td>
        <td class="py-3 px-4 text-xs text-right font-mono font-bold text-emerald-400">
          ${Sanitizer.escapeHTML(Formatters.formatARS(p.billing.insuranceSubtotalArs))}
        </td>
        <td class="py-3 px-4 text-xs text-right font-mono font-bold text-orange-400">
          ${Sanitizer.escapeHTML(Formatters.formatARS(p.billing.clientTotalArs))}
        </td>
        <td class="py-3 px-4 text-center">
          <button type="button" data-action="print-acta" data-acta-id="${Sanitizer.escapeHTML(item.actaId)}"
            class="min-h-[44px] min-w-[44px] bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg transition inline-flex items-center justify-center gap-1.5">
            <svg aria-hidden="true" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span>Imprimir</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  Sanitizer.safeSetInnerHTML(tbody, rows);
}

function printActaById(actaId) {
  const actas = CraneTrackCacheService.getActas();
  const item = actas.find((a) => a.actaId === actaId || a.actaPayload?.actaId === actaId);
  if (!item) return;

  const html = TowActaLedgerService.renderActaPrintHtml(item);
  const container = document.getElementById('printContainer');
  if (container) {
    Sanitizer.safeSetInnerHTML(container, html);
    window.print();
  }
}
