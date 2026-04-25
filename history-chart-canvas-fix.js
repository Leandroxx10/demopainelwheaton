/*
 * WMoldes - Correção segura para Chart.js canvas reuse
 * Deve carregar antes de history-charts.js.
 */
(function () {
  'use strict';

  function install() {
    if (!window.Chart || window.Chart.__wmoldesCanvasReuseFix) return;

    const OriginalChart = window.Chart;

    function findCanvas(input) {
      if (!input) return null;
      if (typeof input === 'string') return document.getElementById(input.replace('#', ''));
      if (input.canvas && input.canvas.nodeName === 'CANVAS') return input.canvas;
      if (input.nodeName === 'CANVAS') return input;
      return null;
    }

    const WrappedChart = new Proxy(OriginalChart, {
      construct(target, args) {
        try {
          const canvas = findCanvas(args[0]);
          if (canvas && target.getChart) {
            const existing = target.getChart(canvas);
            if (existing && typeof existing.destroy === 'function') {
              existing.destroy();
            }
          }
        } catch (err) {
          console.warn('WMoldes canvas fix:', err);
        }
        return Reflect.construct(target, args);
      },
      apply(target, thisArg, args) {
        return Reflect.apply(target, thisArg, args);
      },
      get(target, prop) {
        return target[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    });

    Object.setPrototypeOf(WrappedChart, OriginalChart);
    WrappedChart.prototype = OriginalChart.prototype;
    WrappedChart.__wmoldesCanvasReuseFix = true;

    window.Chart = WrappedChart;
  }

  install();

  // Caso Chart.js carregue depois por cache/ordem diferente.
  const timer = setInterval(function () {
    install();
    if (window.Chart && window.Chart.__wmoldesCanvasReuseFix) clearInterval(timer);
  }, 100);
})();
