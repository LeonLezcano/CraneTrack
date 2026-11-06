# 🚛 CraneTrack v1.0.00
### Plataforma de Auxilio Mecánico Pesado, Remolques 24/7, Odómetro Haversine & Split-Billing Aseguradoras

> **AiAppFactory Standard:** Emergency 24/7 Dispatch, Geodesic Audit, Pre-Tow Visual Damage Map & Interoperable QR 3.0  
> **Directivas:** Testing-First (56 tests en 5 capas), AppSec Guardian 100/100, Zero Fake Features, Zero-Sink DOM Armor, Screen Wake Lock API.

---

## 🎯 1. Propósito y Dolor Resuelto
CraneTrack digitaliza la operación de empresas de auxilio mecánico, grúas hidráulicas de plancha y rescate pesado:
1. **Recortes de Kilometraje en Aseguradoras:** Cálculo geodésico auditado (Haversine) entre Base Central $\to$ Siniestro $\to$ Taller/Destino $\to$ Retorno, eliminando discrepancias en liquidaciones con La Segunda, Federación Patronal, San Cristóbal, Rivadavia y Zurich.
2. **Reclamos Fraudulentos por Daños:** Peritaje visual de 5 cuadrantes (Frente, Lateral Izquierdo, Lateral Derecho, Trasera, Bajos) y checklist técnico (Caja Automática, Tracción 4x4 AWD, Dirección Bloqueada) con captura de fotos testigo geolocalizadas y firma del titular antes del izaje.
3. **Cobro de Excedentes en Ruta (Split-Billing):** Desdoblamiento automático entre los kilómetros cubiertos por la póliza y los kilómetros excedentes + adicionales de rescate (malacate en zanja, patines dolly, subsuelos) con generación de cuerda QR Interoperable BCRA 3.0 para cobro en el acto.
4. **Modo Cabina para Choferes (Screen Wake Lock API):** Pantalla activa continua en el soporte de parabrisas con auto-reenganche al regresar de Waze o Google Maps.

---

## 🏗️ 2. Arquitectura de Módulos
```
src/
├── core/
│   ├── towMileageTariffEngine.js          # Odómetro Haversine y Split-Billing aseguradora vs particular
│   ├── preTowVisualInspectionEngine.js    # Peritaje de daños de 5 cuadrantes y checklist técnico
│   └── fleetEmergencyDispatcherEngine.js  # Asignación de unidades, SLA 24/7 y Screen Wake Lock
├── services/
│   ├── towActaLedgerService.js            # Emisión de actas digitales selladas con SHA-256 y CSV
│   └── craneTrackCache.service.js         # Persistencia Offline-First, Outbox FIFO y anti-siembras
└── utils/
    ├── sanitizer.js                       # Sanitizador estricto Zero-Sink DOM Armor
    ├── cryptoSeal.js                      # Sello SHA-256 determinista para comprobantes forenses
    └── formatters.js                      # Formateo de patentes Mercosur/Clásicas, ARS, km y fecha
```

---

## 🧪 3. Batería de Pruebas Multi-Capa (56 Tests Aprobados)

```bash
# Ejecutar suite de pruebas completa:
pnpm test
# o con Node:
node tests/run_tests.js
```
- **Capa 1 (Unitarias & Fuzzing):** 33 tests (Haversine, Split-Billing, convenios de aseguradoras, patines dolly, recargos nocturnos, SLA, patentes y formatters).
- **Capa 2 (Integración & Offline):** 8 tests (Cache local, Outbox FIFO, anti-siembra de demo, sellado SHA-256).
- **Capa 3 (Componentes & Formatters):** 4 tests (Sanitizer XSS, URLs, comprobante HTML membretado, CSV).
- **Capa 4 (Seguridad & CSP):** 8 tests (firebase.json headers, firestore.rules zero-trust, inmutabilidad de actas).
- **Capa 5 (E2E & Campo):** 3 tests (Ciclo completo de auxilio en ruta, Screen Wake Lock fallback, versiones).

---

## 🛡️ 4. Auditoría de Seguridad (AppSec Guardian)

```bash
pnpm run test:security
```
- **Puntaje:** **100/100** (0 críticas, 0 altas, 0 medias, 0 bajas).
- **Headers:** Content-Security-Policy estricta, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS`.
