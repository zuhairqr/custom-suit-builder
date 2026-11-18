'use strict';

// Full-Body Professional Renderer Integration
// Hooks into existing rendering pipeline with enhanced full-body view

(function() {
  // Store original paintFullSuit function
  const originalPaintFullSuit = window.paintFullSuit;

  // Enhanced full-body paint function
  window.paintFullSuitEnhanced = function(canvas, config, view, options = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Set canvas to full-body proportions (taller)
    const targetWidth = options.thumbnail ? 280 : 600;
    const targetHeight = options.thumbnail ? 420 : 900;

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#f8f7f5');
    bgGradient.addColorStop(1, '#eae8e3');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate scale based on canvas size
    const scale = canvas.width / 600;

    // Draw mannequin first
    const mannequinDims = drawFullBodyMannequin(ctx, {
      x: canvas.width / 2,
      y: 60 * scale,
      scale: scale * 0.9,
      skinTone: options.skinTone || '#f5d9be'
    });

    // Draw full suit on top
    drawFullBodySuit(ctx, mannequinDims, config);

    // Add professional studio lighting
    addStudioLighting(ctx, canvas.width, canvas.height);

    // Add subtle vignette
    addVignette(ctx, canvas.width, canvas.height);

    return true;
  };

  // Professional studio lighting effect
  function addStudioLighting(ctx, width, height) {
    // Key light from top-left
    const keyLight = ctx.createRadialGradient(width * 0.3, height * 0.2, 0, width * 0.3, height * 0.2, width * 0.8);
    keyLight.addColorStop(0, '#ffffff18');
    keyLight.addColorStop(0.5, '#ffffff08');
    keyLight.addColorStop(1, 'transparent');
    ctx.fillStyle = keyLight;
    ctx.fillRect(0, 0, width, height);

    // Rim light from behind
    const rimLight = ctx.createLinearGradient(width * 0.8, 0, width, 0);
    rimLight.addColorStop(0, 'transparent');
    rimLight.addColorStop(1, '#ffffff10');
    ctx.fillStyle = rimLight;
    ctx.fillRect(0, 0, width, height);
  }

  // Subtle vignette effect
  function addVignette(ctx, width, height) {
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.3,
      width / 2, height / 2, Math.min(width, height) * 0.7
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, '#00000012');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  // Override or augment the original paintFullSuit
  // Check if user wants full-body view
  window.useFullBodyView = true; // Set to true by default for Hockerty-style

  if (window.useFullBodyView) {
    // Replace original function with enhanced version
    window.paintFullSuit = function(canvas, config, view, options) {
      // Use enhanced full-body renderer
      return window.paintFullSuitEnhanced(canvas, config, view, options);
    };
  }
})();

// Add toggle function for switching between views
window.toggleFullBodyView = function(enabled) {
  window.useFullBodyView = enabled;
  // Trigger re-render if renderPreview exists
  if (typeof window.renderPreview === 'function') {
    window.renderPreview();
  }
};

// Export for console debugging
if (typeof window !== 'undefined') {
  window.fullBodyRenderer = {
    enabled: () => window.useFullBodyView,
    toggle: (state) => window.toggleFullBodyView(state),
    version: '1.0.0 - Hockerty Style'
  };

  console.log('%c✨ Full-Body Renderer Loaded', 'color: #4CAF50; font-weight: bold; font-size: 14px');
  console.log('Use fullBodyRenderer.toggle(true/false) to switch views');
}
