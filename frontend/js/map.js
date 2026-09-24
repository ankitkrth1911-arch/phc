/**
 * Leaflet Spatial Map
 * Visualizes rural health centres with risk-coded markers, pulse animations, and click-to-select context binding.
 */

export class RiskMap {
  constructor(containerId, onSelectPhcCallback) {
    this.containerId = containerId;
    this.onSelectPhc = onSelectPhcCallback;
    this.map = null;
    this.markerLayer = null;
    this.initMap();
  }

  initMap() {
    const el = document.getElementById(this.containerId);
    if (!el || typeof L === 'undefined') return;

    // Centered over South-Western Odisha rural health cluster (Koraput/Kalahandi/Rayagada)
    this.map = L.map(this.containerId, {
      center: [19.45, 82.85],
      zoom: 9,
      zoomControl: true,
      scrollWheelZoom: false
    });

    // Warm, muted OpenStreetMap CartoDB Positron / OSM tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
  }

  renderPoints(points, selectedPhcId) {
    if (!this.map || !this.markerLayer) return;

    this.markerLayer.clearLayers();
    const bounds = [];

    points.forEach(p => {
      const isSelected = p.phc_id === selectedPhcId;
      const isCritical = p.risk_level === 'Critical';
      const isCaution = p.risk_level === 'Caution';

      // Custom HTML Marker with pulsing aura for critical nodes
      const pulseHtml = (isCritical || isCaution)
        ? `<div class="pin-pulse ${p.risk_level}"></div>`
        : '';

      const borderStyle = isSelected ? 'border: 3px solid #211B17; transform: scale(1.3); z-index: 100;' : '';

      const iconHtml = `
        <div class="custom-phc-pin" style="${borderStyle}">
          ${pulseHtml}
          <div class="pin-core ${p.risk_level}"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'leaflet-custom-div-icon',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([p.lat, p.lon], { icon: customIcon });

      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 190px;">
          <div style="font-weight: 700; font-size: 0.95rem; color: #211B17; margin-bottom: 2px;">
            ${p.phc_name}
          </div>
          <div style="font-size: 0.76rem; color: #7A6F64; margin-bottom: 8px;">
            District: ${p.district_id ? p.district_id.replace('DIST_', '').title() : 'Rural'}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 0.8rem; font-weight: 600; color: #4A4037;">Risk Score:</span>
            <span style="font-weight: 700; font-size: 0.9rem; color: ${this._getColor(p.risk_level)};">
              ${p.risk_score}% (${p.risk_level})
            </span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-size: 0.8rem; font-weight: 600; color: #4A4037;">Runway:</span>
            <span style="font-weight: 700; font-size: 0.88rem; color: #211B17;">
              ${p.days_to_stockout} days
            </span>
          </div>
          <button id="map-select-${p.phc_id}" style="
            width: 100%;
            background: #C59B4B;
            border: none;
            color: #211B17;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
          ">
            ${isSelected ? 'Currently Selected' : 'Focus This Health Centre'}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        if (this.onSelectPhc) {
          this.onSelectPhc(p.phc_id);
        }
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`map-select-${p.phc_id}`);
        if (btn) {
          btn.addEventListener('click', () => {
            if (this.onSelectPhc) {
              this.onSelectPhc(p.phc_id);
              marker.closePopup();
            }
          });
        }
      });

      this.markerLayer.addLayer(marker);
      bounds.push([p.lat, p.lon]);
    });

    if (bounds.length > 0 && !this.hasFittedBounds) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
      this.hasFittedBounds = true;
    }
  }

  focusPhc(lat, lon) {
    if (this.map) {
      this.map.setView([lat, lon], 10, { animate: true });
    }
  }

  _getColor(level) {
    if (level === 'Critical') return '#C53030';
    if (level === 'Caution') return '#D97706';
    return '#2A7E48';
  }
}
