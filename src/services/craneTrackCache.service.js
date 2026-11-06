// @ts-check
/**
 * @fileoverview Offline-First Cache & Outbox FIFO Service for CraneTrack (AiAppFactory Standard)
 */

export class CraneTrackCacheService {
  static STORAGE_KEYS = {
    ORDERS: 'cranetrack_orders',
    ACTAS: 'cranetrack_actas',
    OUTBOX: 'cranetrack_outbox',
    PURGED: 'cranetrack_demo_purged'
  };

  /**
   * Verifica si el usuario purgó los datos de demo.
   * Invariante Anti-Siembras Fantasma (Regla 14 AiAppFactory).
   * @returns {boolean}
   */
  static isDemoPurged() {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(this.STORAGE_KEYS.PURGED) === 'true';
  }

  /**
   * Marca el sistema como purgado y borra datos de demo.
   */
  static purgeAllData() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.STORAGE_KEYS.PURGED, 'true');
    localStorage.removeItem(this.STORAGE_KEYS.ORDERS);
    localStorage.removeItem(this.STORAGE_KEYS.ACTAS);
    localStorage.removeItem(this.STORAGE_KEYS.OUTBOX);
  }

  /**
   * Obtiene la lista de órdenes de auxilio.
   * @returns {Array<Object>}
   */
  static getOrders() {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(this.STORAGE_KEYS.ORDERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Guarda o actualiza una orden.
   * @param {Object} order
   */
  static saveOrder(order) {
    if (typeof localStorage === 'undefined') return;
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === order.id);
    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.unshift(order);
    }
    localStorage.setItem(this.STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }

  /**
   * Obtiene las actas de remolque selladas.
   * @returns {Array<Object>}
   */
  static getActas() {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(this.STORAGE_KEYS.ACTAS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Guarda un acta sellada.
   * @param {Object} acta
   */
  static saveActa(acta) {
    if (typeof localStorage === 'undefined') return;
    const actas = this.getActas();
    actas.unshift(acta);
    localStorage.setItem(this.STORAGE_KEYS.ACTAS, JSON.stringify(actas));
  }

  /**
   * Encola una acción offline en la Outbox FIFO.
   * @param {Object} action
   */
  static enqueueOutbox(action) {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(this.STORAGE_KEYS.OUTBOX);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ ...action, queuedAt: Date.now() });
    localStorage.setItem(this.STORAGE_KEYS.OUTBOX, JSON.stringify(queue));
  }

  /**
   * Vacía y procesa la cola de Outbox.
   * @returns {Array<Object>}
   */
  static flushOutbox() {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(this.STORAGE_KEYS.OUTBOX);
    if (!raw) return [];
    const queue = JSON.parse(raw);
    localStorage.setItem(this.STORAGE_KEYS.OUTBOX, JSON.stringify([]));
    return queue;
  }

  /**
   * Carga datos iniciales de prueba sólo si no está purgado.
   */
  static initDemoDataIfEmpty() {
    if (this.isDemoPurged()) return;
    const existing = this.getOrders();
    if (existing.length > 0) return;

    const demoOrders = [
      {
        id: 'ORD-8821',
        dispatchedAt: new Date(Date.now() - 25 * 60000).toISOString(),
        vehiclePlate: 'AF 342 KL',
        vehicleModel: 'Toyota Hilux 4x4 2.8',
        insuranceKey: 'SAN_CRISTOBAL',
        driverName: 'Carlos Benítez',
        unitCode: 'MOV-04 (Plancha Pesada)',
        unitType: 'LIGHT_FLATBED',
        originAddress: 'Ruta Nacional 9 Km 74 (Campana)',
        destinationAddress: 'Taller Oficial Toyota (Zárate)',
        status: 'ON_SCENE',
        towDistanceKm: 38.5,
        targetSlaMinutes: 45
      },
      {
        id: 'ORD-8820',
        dispatchedAt: new Date(Date.now() - 70 * 60000).toISOString(),
        vehiclePlate: 'AE 980 PO',
        vehicleModel: 'Peugeot 208 Feline Tiptronic',
        insuranceKey: 'LA_SEGUNDA',
        driverName: 'Rubén Maidana',
        unitCode: 'MOV-02 (Plancha + Dolly)',
        unitType: 'LIGHT_FLATBED',
        originAddress: 'Subsuelo 2 - Shopping Unicenter (Martínez)',
        destinationAddress: 'Domicilio Particular (Pilar)',
        status: 'IN_TRANSIT',
        towDistanceKm: 42.0,
        targetSlaMinutes: 60
      },
      {
        id: 'ORD-8819',
        dispatchedAt: new Date(Date.now() - 150 * 60000).toISOString(),
        vehiclePlate: 'AD 112 MN',
        vehicleModel: 'Mercedes-Benz Sprinter 516',
        insuranceKey: 'FED_PATRONAL',
        driverName: 'Jorge Almirón',
        unitCode: 'MOV-09 (Grúa Horquilla Pesada)',
        unitType: 'HEAVY_FORK',
        originAddress: 'Autopista Panamericana Km 38',
        destinationAddress: 'Concesionario Colcar (Moreno)',
        status: 'DELIVERED',
        towDistanceKm: 65.0,
        targetSlaMinutes: 90
      }
    ];

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEYS.ORDERS, JSON.stringify(demoOrders));
    }
  }
}
