/**
 * PHC Supply Resilience — Main Orchestrator
 * Coordinates state, command palette (/), floating dock, animated transitions, and 10 end-to-end endpoints.
 */

import { ApiService } from './api.js';
import { RiskGauge } from './gauge.js';
import { DashboardCharts } from './charts.js';
import { RiskMap } from './map.js';

class App {
  constructor() {
    this.state = {
      phcs: [],
      medicines: [],
      scenarios: [],
      selectedState: 'Odisha',
      selectedDistrictId: '',
      selectedPhcId: '',
      selectedMedicineId: '',
      selectedScenarioId: 'MONSOON_FLOOD',
      paletteActiveTab: 'all',
      paletteSearchQuery: ''
    };

    this.gauge = null;
    this.charts = null;
    this.map = null;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async init() {
    this.gauge = new RiskGauge('riskGaugeCanvas');
    this.charts = new DashboardCharts();
    this.map = new RiskMap('mapContainer', (phcId) => this.selectPhc(phcId));

    this.bindEvents();
    this.initIntersectionObserver();

    // Initial data load
    const phcPayload = await ApiService.getPhcs();
    this.state.phcs = phcPayload.phcs || [];
    this.state.medicines = phcPayload.medicines || [];
    this.state.scenarios = phcPayload.scenarios || [];

    // Set default selections
    if (this.state.phcs.length > 0) {
      // Pick a high-vulnerability rural PHC by default (e.g. Thuamul Rampur)
      const defaultPhc = this.state.phcs.find(p => p.phc_id.includes('THUAMUL')) || this.state.phcs[0];
      this.state.selectedPhcId = defaultPhc.phc_id;
      this.state.selectedDistrictId = defaultPhc.district_id;
      this.state.selectedState = defaultPhc.state;
    }

    if (this.state.medicines.length > 0) {
      this.state.selectedMedicineId = this.state.medicines[0]; // ORS_ZINC
    }

    if (this.state.scenarios.length > 0) {
      const defaultScen = this.state.scenarios.find(s => s.scenario_id === 'MONSOON_FLOOD') || this.state.scenarios[0];
      this.state.selectedScenarioId = defaultScen.scenario_id;
    }

    await this.refreshDashboard(true);
  }

  bindEvents() {
    // 1. Keyboard shortcut "/" to open command palette
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.openPalette();
      }
      if (e.key === 'Escape') {
        this.closePalette();
      }
    });

    // 2. Open palette triggers
    document.getElementById('contextCapsuleTrigger')?.addEventListener('click', () => this.openPalette());
    document.getElementById('dockPaletteBtn')?.addEventListener('click', () => this.openPalette());
    document.getElementById('paletteBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'paletteBackdrop') this.closePalette();
    });

    // 3. Command palette search input
    const searchInput = document.getElementById('paletteInput');
    searchInput?.addEventListener('input', (e) => {
      this.state.paletteSearchQuery = e.target.value.toLowerCase().trim();
      this.renderPaletteResults();
    });

    // 4. Command palette tab buttons
    document.querySelectorAll('.palette-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.palette-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.state.paletteActiveTab = e.currentTarget.dataset.tab;
        this.renderPaletteResults();
      });
    });

    // 5. Floating dock smooth scroll buttons
    document.querySelectorAll('.dock-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  initIntersectionObserver() {
    const sections = document.querySelectorAll('section[id]');
    const dockButtons = document.querySelectorAll('.dock-item-btn');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          const currentId = entry.target.getAttribute('id');
          dockButtons.forEach(btn => {
            if (btn.dataset.target === currentId) {
              btn.classList.add('active');
            } else {
              btn.classList.remove('active');
            }
          });
        }
      });
    }, { threshold: [0.25, 0.5] });

    sections.forEach(s => observer.observe(s));
  }

  openPalette(focusCategory = null) {
    const backdrop = document.getElementById('paletteBackdrop');
    const input = document.getElementById('paletteInput');
    if (!backdrop) return;

    if (focusCategory) {
      this.state.paletteActiveTab = focusCategory;
      document.querySelectorAll('.palette-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === focusCategory);
      });
    }

    backdrop.classList.add('open');
    if (input) {
      input.value = '';
      this.state.paletteSearchQuery = '';
      setTimeout(() => input.focus(), 50);
    }
    this.renderPaletteResults();
  }

  closePalette() {
    const backdrop = document.getElementById('paletteBackdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  renderPaletteResults() {
    const listEl = document.getElementById('paletteResultsList');
    if (!listEl) return;

    const query = this.state.paletteSearchQuery;
    const tab = this.state.paletteActiveTab;
    let items = [];

    // PHCs
    if (tab === 'all' || tab === 'phc') {
      this.state.phcs.forEach(p => {
        if (!query || p.phc_name.toLowerCase().includes(query) || p.district_id.toLowerCase().includes(query)) {
          items.push({
            type: 'phc',
            id: p.phc_id,
            primary: p.phc_name,
            secondary: `${p.state} › District: ${p.district_id.replace('DIST_', '').title()}`,
            badge: 'PHC',
            action: () => {
              this.selectPhc(p.phc_id);
              this.closePalette();
            }
          });
        }
      });
    }

    // Medicines
    if (tab === 'all' || tab === 'medicine') {
      this.state.medicines.forEach(m => {
        const cleanName = m.replace('_', ' ').title();
        if (!query || cleanName.toLowerCase().includes(query) || m.toLowerCase().includes(query)) {
          items.push({
            type: 'medicine',
            id: m,
            primary: cleanName,
            secondary: `Essential Formulary ID: ${m}`,
            badge: 'Medicine',
            action: () => {
              this.state.selectedMedicineId = m;
              this.refreshDashboard();
              this.closePalette();
            }
          });
        }
      });
    }

    // Scenarios
    if (tab === 'all' || tab === 'scenario') {
      this.state.scenarios.forEach(s => {
        if (!query || s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query)) {
          items.push({
            type: 'scenario',
            id: s.scenario_id,
            primary: s.name,
            secondary: `Demand Multiplier: ${s.demand_multiplier}x — ${s.description}`,
            badge: 'Emergency Alert',
            action: () => {
              this.state.selectedScenarioId = s.scenario_id;
              this.refreshDashboard();
              this.closePalette();
            }
          });
        }
      });
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 28px; text-align: center; color: var(--ink-muted); font-size: 0.9rem;">
          No matching operational parameters found for "${query}"
        </div>
      `;
      return;
    }

    listEl.innerHTML = items.map((item, idx) => `
      <div class="palette-result-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
        <div class="result-item-left">
          <span class="result-primary-text">${item.primary}</span>
          <span class="result-secondary-text">${item.secondary}</span>
        </div>
        <span class="result-category-badge">${item.badge}</span>
      </div>
    `).join('');

    // Bind click handlers
    listEl.querySelectorAll('.palette-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        if (items[idx]) items[idx].action();
      });
    });
  }

  selectPhc(phcId) {
    const phc = this.state.phcs.find(p => p.phc_id === phcId);
    if (!phc) return;
    this.state.selectedPhcId = phcId;
    this.state.selectedDistrictId = phc.district_id;
    this.state.selectedState = phc.state;

    // Pan map smoothly to the selected PHC
    if (this.map) {
      this.map.focusPhc(phc.lat, phc.lon);
    }

    this.refreshDashboard();
  }

  async refreshDashboard(isInitial = false) {
    const { selectedPhcId, selectedMedicineId, selectedScenarioId } = this.state;
    const currentPhc = this.state.phcs.find(p => p.phc_id === selectedPhcId) || {};
    const currentScen = this.state.scenarios.find(s => s.scenario_id === selectedScenarioId) || {};

    // 1. Update Persistent Breadcrumb Strip
    this.updateBreadcrumbs(currentPhc, currentScen);

    // 2. Trigger Orchestrated Entrance Animation
    const mainContainer = document.querySelector('.orchestrated-content');
    if (mainContainer && !this.prefersReducedMotion) {
      mainContainer.classList.remove('orchestrated-content');
      void mainContainer.offsetWidth; // Force CSS reflow
      mainContainer.classList.add('orchestrated-content');
    }

    // 3. Fetch All 10 Endpoints in Parallel
    const [
      forecastData,
      riskData,
      driversData,
      alertsData,
      mapData,
      transfersData,
      explanationData,
      federatedData,
      modelPerfData
    ] = await Promise.all([
      ApiService.getForecast(selectedPhcId, selectedMedicineId),
      ApiService.getRisk(selectedPhcId, selectedMedicineId, selectedScenarioId),
      ApiService.getRiskDrivers(selectedPhcId, selectedMedicineId),
      ApiService.getAlerts(selectedScenarioId),
      ApiService.getMap(selectedScenarioId, selectedMedicineId),
      ApiService.getTransfers(selectedScenarioId, selectedMedicineId),
      ApiService.getExplanation(selectedPhcId, selectedMedicineId, selectedScenarioId),
      ApiService.getFederated(),
      ApiService.getModelPerformance()
    ]);

    // 4. Render Risk & Gauge
    this.renderRiskSection(riskData);

    // 5. Render Forecast Chart
    this.charts.renderForecast('forecastChartCanvas', forecastData);

    // 6. Render Risk Drivers Chart
    this.charts.renderRiskDrivers('riskDriversChartCanvas', driversData.drivers || []);

    // 7. Render Alerts Banner & Affected Matrix
    this.renderAlertsSection(alertsData);

    // 8. Render Map Markers
    this.map.renderPoints(mapData.points || [], selectedPhcId);

    // 9. Render Constrained Transfers Table & Comparison
    this.renderTransfersSection(transfersData, currentPhc);

    // 10. Render Plain-Language Explanation
    this.renderExplanationSection(explanationData);

    // 11. Render Federated Learning Convergence
    this.charts.renderFederated('federatedChartCanvas', federatedData);

    // 12. Render Model Performance Benchmark Table
    this.renderModelPerformanceSection(modelPerfData.rows || []);
  }

  updateBreadcrumbs(currentPhc, currentScen) {
    const el = document.getElementById('capsuleBreadcrumbs');
    if (!el) return;

    const state = currentPhc.state || 'Odisha';
    const dist = currentPhc.district_id ? currentPhc.district_id.replace('DIST_', '').title() : 'District';
    const phc = currentPhc.phc_name || 'Select PHC';
    const med = this.state.selectedMedicineId ? this.state.selectedMedicineId.replace('_', ' ').title() : 'Medicine';
    const scen = currentScen.name || 'Normal Baseline';

    el.innerHTML = `
      <div class="crumb-item" title="Click to change state"><span class="crumb-val">${state}</span></div>
      <span class="crumb-sep">›</span>
      <div class="crumb-item" title="Click to change district"><span class="crumb-tag">Dist:</span> <span class="crumb-val">${dist}</span></div>
      <span class="crumb-sep">›</span>
      <div class="crumb-item" title="Click to change health centre"><span class="crumb-tag">PHC:</span> <span class="crumb-val">${phc}</span></div>
      <span class="crumb-sep">›</span>
      <div class="crumb-item" title="Click to change medicine"><span class="crumb-tag">Med:</span> <span class="crumb-val">${med}</span></div>
      <span class="crumb-sep">›</span>
      <div class="crumb-item" title="Click to change emergency scenario"><span class="crumb-tag">Alert:</span> <span class="crumb-val" style="color: var(--accent-clay);">${scen}</span></div>
    `;
  }

  renderRiskSection(risk) {
    const scoreValEl = document.getElementById('riskScoreValue');
    const levelBadgeEl = document.getElementById('riskLevelBadge');
    const daysValEl = document.getElementById('daysToStockoutValue');

    if (this.gauge) {
      this.gauge.setScore(risk.risk_score);
    }

    if (scoreValEl) {
      this.animateNumber(scoreValEl, risk.risk_score, 1);
    }

    if (levelBadgeEl) {
      levelBadgeEl.className = `gauge-risk-badge ${risk.risk_level}`;
      levelBadgeEl.textContent = `${risk.risk_level} Stockout Threat`;
    }

    if (daysValEl) {
      this.animateNumber(daysValEl, risk.days_to_stockout, 0);
    }
  }

  renderAlertsSection(alertsData) {
    const bannerEl = document.getElementById('alertBannerText');
    const tableBody = document.getElementById('affectedDistrictsTableBody');
    const alertCard = document.getElementById('alertBannerCard');

    if (bannerEl) {
      bannerEl.textContent = alertsData.banner || 'No current emergency surge alerts.';
    }

    if (!tableBody) return;
    const alerts = alertsData.alerts || [];

    if (alerts.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--ink-muted); padding: 18px;">
            Nominal state reserves. No districts experiencing critical stockout pressure under baseline conditions.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = alerts.map(a => {
      const distName = a.district_id.replace('DIST_', '').title();
      const medTags = (a.medicines_affected || []).map(m => `
        <span class="district-pill-tag">${m.replace('_', ' ').title()}</span>
      `).join('');

      return `
        <tr>
          <td style="font-weight: 600; color: var(--ink-primary);">${distName}</td>
          <td>${medTags}</td>
          <td>
            <span class="provenance-badge badge-computed" style="background: var(--risk-critical-soft); color: var(--risk-critical); border-color: var(--risk-critical-border);">
              Severe Surge
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderTransfersSection(transfersData, currentPhc) {
    const transfers = transfersData.transfers || [];
    const baseSum = transfersData.baseline_summary || {};
    const optSum = transfersData.optimized_summary || {};
    const constraintsText = transfersData.constraints_respected || '';

    // Update KPI summary stats
    this.animateNumber(document.getElementById('kpiUnmetDemand'), optSum.unmet_demand || 0, 0);
    this.animateNumber(document.getElementById('kpiCriticalShortages'), optSum.critical_shortages || 0, 0);
    this.animateNumber(document.getElementById('kpiUnitsMoved'), optSum.units_moved || 0, 0);
    this.animateNumber(document.getElementById('kpiImprovementPct'), optSum.improvement_pct || 0, 1);

    // Update Comparative Optimizer vs Baseline box
    const optDemandEl = document.getElementById('optSummaryUnmet');
    const optShortagesEl = document.getElementById('optSummaryShortages');
    const optMovedEl = document.getElementById('optSummaryMoved');
    const optCostEl = document.getElementById('optSummaryCost');

    if (optDemandEl) optDemandEl.textContent = `${optSum.unmet_demand || 0} u`;
    if (optShortagesEl) optShortagesEl.textContent = optSum.critical_shortages || 0;
    if (optMovedEl) optMovedEl.textContent = `${optSum.units_moved || 0} u`;
    if (optCostEl) optCostEl.textContent = `${Math.round(optSum.transport_cost_km || 0)} km-u`;

    const baseDemandEl = document.getElementById('baseSummaryUnmet');
    const baseShortagesEl = document.getElementById('baseSummaryShortages');
    const baseMovedEl = document.getElementById('baseSummaryMoved');
    const baseCostEl = document.getElementById('baseSummaryCost');

    if (baseDemandEl) baseDemandEl.textContent = `${baseSum.unmet_demand || 0} u`;
    if (baseShortagesEl) baseShortagesEl.textContent = baseSum.critical_shortages || 0;
    if (baseMovedEl) baseMovedEl.textContent = `${baseSum.units_moved || 0} u`;
    if (baseCostEl) baseCostEl.textContent = `${Math.round(baseSum.transport_cost_km || 0)} km-u`;

    const impBadge = document.getElementById('improvementBadgeText');
    if (impBadge) {
      impBadge.textContent = `+${optSum.improvement_pct || 0}% Advantage`;
    }

    // Constraints footer
    const constrEl = document.getElementById('constraintsRespectedStatement');
    if (constrEl) constrEl.textContent = constraintsText;

    // Transfers Table
    const tableBody = document.getElementById('transfersTableBody');
    if (!tableBody) return;

    if (transfers.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--ink-muted); padding: 22px;">
            No inter-district transfers required. Local safety stock satisfies operational demand.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = transfers.map(t => {
      const fromName = t.from_phc.replace('PHC_', '').replace(/_/g, ' ').title();
      const toName = t.to_phc.replace('PHC_', '').replace(/_/g, ' ').title();
      const medName = t.medicine_id.replace(/_/g, ' ').title();

      const isCurrentDonor = t.from_phc === this.state.selectedPhcId;
      const isCurrentReceiver = t.to_phc === this.state.selectedPhcId;
      const rowHighlight = (isCurrentDonor || isCurrentReceiver)
        ? 'background: rgba(197, 155, 75, 0.08); font-weight: 600;'
        : '';

      return `
        <tr style="${rowHighlight}">
          <td>
            <span style="font-weight: 600; color: var(--ink-primary);">${fromName}</span>
            ${isCurrentDonor ? '<span class="provenance-badge badge-computed" style="margin-left: 6px;">Active Donor</span>' : ''}
          </td>
          <td>
            <span style="font-weight: 600; color: var(--ink-primary);">${toName}</span>
            ${isCurrentReceiver ? '<span class="provenance-badge badge-computed" style="margin-left: 6px; background: var(--risk-critical-soft); color: var(--risk-critical);">Target Shortage</span>' : ''}
          </td>
          <td>${medName}</td>
          <td class="num" style="font-weight: 700; color: var(--ink-primary);">${t.quantity.toLocaleString()} units</td>
          <td class="num">${t.distance_km} km</td>
        </tr>
      `;
    }).join('');
  }

  renderExplanationSection(explanation) {
    const textEl = document.getElementById('explanationTextBody');
    const badgeEl = document.getElementById('explanationSourceBadge');
    if (!textEl) return;

    textEl.textContent = explanation.text || 'Generating logistics assessment...';

    if (badgeEl) {
      if (explanation.source === 'llm') {
        badgeEl.className = 'provenance-badge badge-source-llm';
        badgeEl.textContent = 'Server LLM Synthesis (Gemini)';
      } else {
        badgeEl.className = 'provenance-badge badge-source-template';
        badgeEl.textContent = 'Grounded Logistics Engine (Verified Rule)';
      }
    }
  }

  renderModelPerformanceSection(rows) {
    const tableBody = document.getElementById('modelPerformanceTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = rows.map((r, i) => {
      const isOurModel = r.model.includes('Fed-Ensemble');
      const rowStyle = isOurModel ? 'background: #FAF3E5; font-weight: 600;' : '';
      return `
        <tr style="${rowStyle}">
          <td>
            ${r.model}
            ${isOurModel ? '<span class="provenance-badge badge-computed" style="margin-left: 8px;">Active Model</span>' : ''}
          </td>
          <td class="num">${r.MAE.toFixed(2)}</td>
          <td class="num" style="${r.MASE < 1.0 ? 'color: var(--risk-secure); font-weight: 700;' : ''}">${r.MASE.toFixed(2)}</td>
          <td>
            ${r.MASE < 1.0 ? '<span style="color: var(--risk-secure); font-weight: 600;">Superior to Random Walk</span>' : '<span style="color: var(--ink-muted);">Baseline</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  animateNumber(element, target, decimals = 0) {
    if (!element) return;
    if (this.prefersReducedMotion) {
      element.textContent = target.toFixed(decimals);
      return;
    }

    const start = parseFloat(element.textContent) || 0;
    const duration = 400; // ms
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const val = start + (target - start) * ease;
      element.textContent = val.toFixed(decimals);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = target.toFixed(decimals);
      }
    };

    requestAnimationFrame(step);
  }
}

// String helper for title casing
String.prototype.title = function() {
  return this.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  window.PHCApp = app;
});
