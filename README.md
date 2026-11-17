# CraneTrack

Plataforma de despacho 24/7, odómetro geodésico Haversine, peritaje pre-enganche y split-billing para aseguradoras y servicio particular.

## 1. Propósito y Funcionalidades Reales Implementadas

1. **Centro de Despacho 24/7 (`src/core/fleetEmergencyDispatcherEngine.js`, `src/app.js`):**
   - Tablero con KPIs calculados dinámicamente desde almacenamiento local (`CraneTrackCacheService`): unidades asignadas, órdenes activas, cumplimiento SLA y excedentes liquidados.
   - Purga explícita de registros locales/demo con diálogo accesible y protección anti-re-siembra (`cranetrack_demo_purged`).
2. **Odómetro Geodésico y Split-Billing (`src/core/towMileageTariffEngine.js`):**
   - Cálculo de distancia Haversine entre ubicaciones preestablecidas o ingreso manual de kilometraje.
   - Desdoblamiento entre franquicia cubierta por aseguradora y excedentes/adicionales a cargo del titular en ruta.
   - El módulo de cobro QR (`[MOCK] Payload QR Interoperable BCRA 3.0`) genera localmente la cadena EMVCo de prueba sin pasarela de pago conectada ni generación gráfica de QR.
3. **Peritaje Pre-Enganche y Firma en Pantalla (`src/core/preTowVisualInspectionEngine.js`, `src/services/towActaLedgerService.js`):**
   - Selector de orden activa, protocolo de seguridad mecánica (transmisión, tracción, llaves, dirección, ruedas), registro de daños por cuadrante y firma táctil/puntero en `<canvas>`.
   - Sellado criptográfico real SHA-256 vía Web Crypto API (`CryptoSeal`), exportación CSV con BOM UTF-8 e impresión A4 limpia (`@media print`).
4. **Modo Cabina para Choferes (`#tab-cab-mode`):**
   - Integración de `Screen Wake Lock API` con fallback no bloqueante, enlace dinámico a Google Maps según origen de la orden, enlace telefónico al titular si hay teléfono cargado y persistencia de estado `ON_SCENE` al confirmar llegada.

## 2. Arquitectura y Diseño

- **Sistema Visual:** Documentado en [DESIGN.md](./DESIGN.md) (tema oscuro de alto contraste para cabina nocturna, tipografía del sistema sin fuentes externas, áreas táctiles `>=44px` y `>=48px` en Modo Cabina).
- **Offline-First y Seguridad:**
  - Tailwind CSS compilado localmente en `styles.css` (sin `cdn.tailwindcss.com`).
  - Web App Manifest (`manifest.json`), registro de Service Worker (`src/sw-register.js` -> `sw.js`) con caché versionada de assets estáticos y cabecera `Cache-Control: no-cache, no-store, must-revalidate` en `/sw.js` dentro de `firebase.json`.
  - `Content-Security-Policy` sin `'unsafe-inline'` en `script-src` y renderizado DOM seguro mediante `Sanitizer.safeSetInnerHTML()` y `Sanitizer.escapeHTML()`.

```text
src/
├── app.js
├── input.css
├── sw-register.js
├── core/
│   ├── towMileageTariffEngine.js
│   ├── preTowVisualInspectionEngine.js
│   └── fleetEmergencyDispatcherEngine.js
├── services/
│   ├── towActaLedgerService.js
│   └── craneTrackCache.service.js
└── utils/
    ├── sanitizer.js
    ├── cryptoSeal.js
    └── formatters.js
```

## 3. Pruebas y Auditoría de Seguridad

```bash
# Suite automatizada de 5 capas (58 tests)
pnpm test

# Auditoría de seguridad estática y simulación de abuso
pnpm run security:full
```
