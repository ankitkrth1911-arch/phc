/**
 * Chart.js Visualizations
 * Styled with the Hospitality palette: Linen, Espresso Ink, Warm Brass, Terracotta
 */

export class DashboardCharts {
  constructor() {
    this.forecastChart = null;
    this.driversChart = null;
    this.federatedChart = null;
  }

  // 1. Forecast Chart: Past Demand (Solid) vs Forecast (Dashed) with Uncertainty Band
  renderForecast(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.forecastChart) {
      this.forecastChart.destroy();
    }

    const labels = data.week || [];
    const actualData = data.actual || [];
    const yhatData = data.yhat || [];
    const yhatLo = data.yhat_lo || [];
    const yhatHi = data.yhat_hi || [];

    // Connect last actual point to first forecast point seamlessly
    const lastActualIdx = actualData.findIndex((v, i) => v !== null && actualData[i + 1] === null);
    if (lastActualIdx !== -1 && yhatData[lastActualIdx] === null) {
      yhatData[lastActualIdx] = actualData[lastActualIdx];
      yhatLo[lastActualIdx] = actualData[lastActualIdx];
      yhatHi[lastActualIdx] = actualData[lastActualIdx];
    }

    this.forecastChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Actual Recorded Demand',
            data: actualData,
            borderColor: '#211B17',
            backgroundColor: '#211B17',
            borderWidth: 2.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            pointBackgroundColor: '#FFFDF9',
            pointBorderColor: '#211B17',
            pointBorderWidth: 2,
            tension: 0.25,
            fill: false
          },
          {
            label: 'Surge Forecast (Expected)',
            data: yhatData,
            borderColor: '#C59B4B',
            backgroundColor: '#C59B4B',
            borderWidth: 2.5,
            borderDash: [6, 4],
            pointRadius: 3.5,
            pointHoverRadius: 6,
            pointBackgroundColor: '#FFFDF9',
            pointBorderColor: '#C59B4B',
            pointBorderWidth: 2,
            tension: 0.25,
            fill: false
          },
          {
            label: 'Upper Bound (95% CI)',
            data: yhatHi,
            borderColor: 'transparent',
            backgroundColor: 'rgba(197, 155, 75, 0.16)',
            pointRadius: 0,
            fill: '+1', // Fill down to yhatLo
            tension: 0.25
          },
          {
            label: 'Lower Bound (95% CI)',
            data: yhatLo,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 14,
              boxHeight: 14,
              usePointStyle: true,
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 11,
                weight: '600'
              },
              color: '#4A4037',
              filter: (item) => !item.text.includes('Bound')
            }
          },
          tooltip: {
            backgroundColor: '#211B17',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '700' },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 12,
            cornerRadius: 8,
            boxPadding: 4,
            callbacks: {
              label: (ctx) => {
                if (ctx.raw === null || ctx.raw === undefined) return '';
                return `${ctx.dataset.label}: ${Math.round(ctx.raw)} units`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: '#EDE7DC',
              drawBorder: false
            },
            ticks: {
              color: '#7A6F64',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
            }
          },
          y: {
            grid: {
              color: '#EDE7DC',
              drawBorder: false
            },
            ticks: {
              color: '#7A6F64',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              callback: (val) => `${val} u`
            }
          }
        }
      }
    });
  }

  // 2. Risk Drivers Chart: Horizontal Bar Chart
  renderRiskDrivers(canvasId, drivers) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.driversChart) {
      this.driversChart.destroy();
    }

    const labels = drivers.map(d => d.feature);
    const dataVals = drivers.map(d => Math.round(d.importance * 100));

    this.driversChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Contribution Weight (%)',
          data: dataVals,
          backgroundColor: '#BD5D38',
          hoverBackgroundColor: '#A74C28',
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#211B17',
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctx) => `Driver Impact: ${ctx.raw}%`
            }
          }
        },
        scales: {
          x: {
            max: 50,
            grid: { color: '#EDE7DC', drawBorder: false },
            ticks: {
              callback: (v) => `${v}%`,
              color: '#7A6F64',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
            }
          },
          y: {
            grid: { display: false, drawBorder: false },
            ticks: {
              color: '#211B17',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '500' }
            }
          }
        }
      }
    });
  }

  // 3. Federated Learning Chart: Convergence Across Training Rounds
  renderFederated(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.federatedChart) {
      this.federatedChart.destroy();
    }

    const rounds = data.rounds.map(r => `R-${r}`);

    this.federatedChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: rounds,
        datasets: [
          {
            label: 'Local-Only Training (Isolated District)',
            data: data.local_only_mae,
            borderColor: '#BD5D38',
            backgroundColor: '#BD5D38',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2
          },
          {
            label: 'Federated Model (Privacy-Preserving)',
            data: data.federated_mae,
            borderColor: '#C59B4B',
            backgroundColor: '#C59B4B',
            borderWidth: 2.8,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.2
          },
          {
            label: 'Centralized Benchmark (Pooled Data)',
            data: data.centralized_mae,
            borderColor: '#211B17',
            backgroundColor: '#211B17',
            borderWidth: 1.8,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 14,
              usePointStyle: true,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' },
              color: '#4A4037'
            }
          },
          tooltip: {
            backgroundColor: '#211B17',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} MAE`
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#EDE7DC', drawBorder: false },
            ticks: {
              color: '#7A6F64',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 },
              maxTicksLimit: 12
            }
          },
          y: {
            grid: { color: '#EDE7DC', drawBorder: false },
            ticks: {
              color: '#7A6F64',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              callback: (v) => `${v} MAE`
            }
          }
        }
      }
    });
  }
}
