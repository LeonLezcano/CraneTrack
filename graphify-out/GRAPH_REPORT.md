# Graph Report - c:\Users\Regondi Calidad\Desktop\QM\CraneTrack  (2026-11-17)

## Corpus Check
- Corpus is ~15,245 words - fits in a single context window. You may not need a graph.

## Summary
- 136 nodes · 272 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9

## God Nodes (most connected - your core abstractions)
1. `runAllTests()` - 27 edges
2. `setupInspectionTab()` - 14 edges
3. `CraneTrackCacheService` - 12 edges
4. `Sanitizer` - 10 edges
5. `keywords` - 9 edges
6. `setupCalculator()` - 9 edges
7. `switchToTab()` - 8 edges
8. `renderAllViews()` - 8 edges
9. `renderDispatchTable()` - 8 edges
10. `Formatters` - 8 edges

## Surprising Connections (you probably didn't know these)
- `setupReportsTab()` --indirect_call--> `renderReportsTable()`  [INFERRED]
  src/app.js → src/app.js  _Bridges community 2 → community 5_
- `setupCalculator()` --calls--> `showStatusBanner()`  [EXTRACTED]
  src/app.js → src/app.js  _Bridges community 1 → community 7_
- `renderAllViews()` --calls--> `renderDispatchKpis()`  [EXTRACTED]
  src/app.js → src/app.js  _Bridges community 1 → community 2_
- `renderAllViews()` --calls--> `renderDispatchTable()`  [EXTRACTED]
  src/app.js → src/app.js  _Bridges community 1 → community 5_

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (21): author, description, keywords, license, name, scripts, compliance:audit, security:full (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (18): clearSignaturePad(), currentInspectionDamages, executePurgeAllData(), getActiveCabOrder(), hideStatusBanner(), LOCATIONS, renderAllViews(), renderCabModeView() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (5): printActaById(), renderDispatchKpis(), setupReportsTab(), CraneTrackCacheService, runAllTests()

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (7): FleetEmergencyDispatcherEngine, TowActaLedgerService, CryptoSeal, Formatters, __dirname, __filename, ROOT

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (12): currentSemver, indexContent, indexPath, nextSemver, parts, pkgData, pkgPath, root (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (6): getStatusBadgeClass(), renderDamagesList(), renderDispatchTable(), renderInspectionOrderSelector(), renderReportsTable(), Sanitizer

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, lang, name, scope, short_name (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.31
Nodes (4): getSelectedCalculatorSurcharges(), setupCalculator(), updateSplitBillingPreview(), TowMileageTariffEngine

## Knowledge Gaps
- **47 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runAllTests()` connect `Community 2` to `Community 1`, `Community 3`, `Community 5`, `Community 7`, `Community 8`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `LocalStorageMock` connect `Community 8` to `Community 3`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Sanitizer` connect `Community 5` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._