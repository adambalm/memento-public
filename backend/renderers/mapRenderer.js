/**
 * Map Renderer - Visualization Screen
 * Full-screen Mermaid diagram with zoom/pan controls
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Render the visualization/map page
 */
function renderMapPage(sessionData, sessionId) {
  const { visualization, totalTabs, timestamp } = sessionData;
  const mermaidCode = visualization?.mermaid;
  const interpretation = visualization?.interpretation;

  const extraStyles = `
    .map-container {
      position: relative;
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      overflow: hidden;
      margin-top: 1em;
    }

    .map-controls {
      position: absolute;
      top: 1em;
      right: 1em;
      z-index: 10;
      display: flex;
      gap: 0.5em;
      background: rgba(255,255,255,0.9);
      padding: 0.5em;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .map-controls button {
      width: 36px;
      height: 36px;
      border: 1px solid var(--border-light);
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1.2em;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .map-controls button:hover {
      background: var(--bg-secondary);
    }

    .map-viewport {
      width: 100%;
      height: 70vh;
      overflow: auto;
      cursor: grab;
    }
    .map-viewport:active {
      cursor: grabbing;
    }

    .map-inner {
      min-width: 100%;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2em;
      transform-origin: center center;
      transition: transform 0.1s ease-out;
    }

    .mermaid {
      background: white;
    }
    .mermaid svg {
      max-width: none !important;
      height: auto !important;
    }

    .map-interpretation {
      padding: 1em 1.5em;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-light);
      font-style: italic;
      color: var(--text-secondary);
    }

    .no-visualization {
      text-align: center;
      padding: 4em 2em;
      color: var(--text-muted);
    }
    .no-visualization h2 {
      margin-bottom: 0.5em;
    }

    .zoom-indicator {
      position: absolute;
      bottom: 1em;
      right: 1em;
      background: rgba(255,255,255,0.9);
      padding: 0.25em 0.75em;
      border-radius: 4px;
      font-size: 0.85em;
      color: var(--text-muted);
      font-family: system-ui, sans-serif;
    }
  `;

  const extraScripts = mermaidCode ? `
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
      // Initialize Mermaid
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: 'basis'
        }
      });

      document.addEventListener('DOMContentLoaded', function() {
        mermaid.run({ nodes: document.querySelectorAll('.mermaid') }).then(() => {
          // After render, enable zoom/pan
          initZoomPan();
        });
      });

      // Zoom and pan functionality
      let currentZoom = 1;
      const zoomStep = 0.25;
      const minZoom = 0.25;
      const maxZoom = 3;

      function initZoomPan() {
        const viewport = document.querySelector('.map-viewport');
        const inner = document.querySelector('.map-inner');
        if (!viewport || !inner) return;

        updateZoomDisplay();

        // Pan with mouse drag
        let isPanning = false;
        let startX, startY, scrollLeft, scrollTop;

        viewport.addEventListener('mousedown', (e) => {
          isPanning = true;
          startX = e.pageX - viewport.offsetLeft;
          startY = e.pageY - viewport.offsetTop;
          scrollLeft = viewport.scrollLeft;
          scrollTop = viewport.scrollTop;
        });

        viewport.addEventListener('mouseleave', () => isPanning = false);
        viewport.addEventListener('mouseup', () => isPanning = false);

        viewport.addEventListener('mousemove', (e) => {
          if (!isPanning) return;
          e.preventDefault();
          const x = e.pageX - viewport.offsetLeft;
          const y = e.pageY - viewport.offsetTop;
          viewport.scrollLeft = scrollLeft - (x - startX);
          viewport.scrollTop = scrollTop - (y - startY);
        });

        // Zoom with wheel
        viewport.addEventListener('wheel', (e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
              zoomIn();
            } else {
              zoomOut();
            }
          }
        });
      }

      function zoomIn() {
        currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
        applyZoom();
      }

      function zoomOut() {
        currentZoom = Math.max(minZoom, currentZoom - zoomStep);
        applyZoom();
      }

      function zoomReset() {
        currentZoom = 1;
        applyZoom();
      }

      function zoomFit() {
        const viewport = document.querySelector('.map-viewport');
        const svg = document.querySelector('.mermaid svg');
        if (!viewport || !svg) return;

        const svgRect = svg.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();

        const scaleX = (viewportRect.width - 40) / svgRect.width;
        const scaleY = (viewportRect.height - 40) / svgRect.height;
        currentZoom = Math.min(scaleX, scaleY, 1);
        applyZoom();
      }

      function applyZoom() {
        const inner = document.querySelector('.map-inner');
        if (inner) {
          inner.style.transform = 'scale(' + currentZoom + ')';
        }
        updateZoomDisplay();
      }

      function updateZoomDisplay() {
        const indicator = document.querySelector('.zoom-indicator');
        if (indicator) {
          indicator.textContent = Math.round(currentZoom * 100) + '%';
        }
      }
    </script>
  ` : '';

  const content = mermaidCode ? `
    <div class="page-content full-width">
      <h1>Session Map</h1>
      <p>Visual map of how your tabs relate to each other. Drag to pan, Ctrl+scroll to zoom.</p>

      <div class="map-container">
        <div class="map-controls">
          <button onclick="zoomIn()" title="Zoom in">+</button>
          <button onclick="zoomOut()" title="Zoom out">−</button>
          <button onclick="zoomReset()" title="Reset zoom">1:1</button>
          <button onclick="zoomFit()" title="Fit to screen">⊡</button>
        </div>
        <div class="map-viewport">
          <div class="map-inner">
            <pre class="mermaid">${mermaidCode}</pre>
          </div>
        </div>
        <div class="zoom-indicator">100%</div>
        ${interpretation ? `
          <div class="map-interpretation">
            ${escapeHtml(interpretation)}
          </div>
        ` : ''}
      </div>
    </div>
  ` : `
    <div class="page-content">
      <div class="no-visualization">
        <h2>No Map Available</h2>
        <p>This session doesn't have a visualization. Try running a new capture.</p>
        <a href="/results/${sessionId}" class="btn btn-secondary" style="margin-top: 1em;">Back to Summary</a>
      </div>
    </div>
  `;

  return wrapInLayout(content, {
    sessionId,
    currentPage: 'map',
    title: 'Session Map',
    sessionData: { totalTabs, timestamp },
    extraHead: extraStyles,
    extraScripts
  });
}

module.exports = { renderMapPage };
