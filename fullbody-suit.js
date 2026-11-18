'use strict';

// Full-Body Suit Renderer - Professional jacket and trousers
// Integrates with existing lapel and fabric systems

function drawFullBodySuit(ctx, mannequinDims, config) {
  const {
    fabric = 0,
    lapel = 0,
    closure = 1,
    buttons = {},
    pockets = {},
    vents = 0,
    trouserStyle = {}
  } = config;

  const { centerX: x, headBottom, chestY, waistY, hipY, kneeY, ankleY, scale } = mannequinDims;

  // Get fabric color
  const fabricColor = fabrics[fabric]?.color || '#2c3e50';
  const fabricThread = fabrics[fabric]?.thread || '#7492b6';

  ctx.save();

  // === JACKET BODY ===

  // Main jacket torso with tailored shape
  ctx.fillStyle = fabricColor;
  ctx.beginPath();

  // Shoulders (wide)
  ctx.moveTo(x - 95, headBottom + 25);
  ctx.lineTo(x - 85, headBottom + 45);

  // Chest to waist (tapered)
  ctx.lineTo(x - 70, chestY);
  ctx.lineTo(x - 58, waistY - 30);

  // Waist suppression
  ctx.lineTo(x - 52, waistY);

  // Hip flare
  ctx.lineTo(x - 56, hipY - 50);

  // Jacket hem
  ctx.lineTo(x - 58, hipY - 20);

  // Front opening (V-shape)
  ctx.lineTo(x - 12, hipY - 20);
  ctx.lineTo(x - 8, waistY);
  ctx.lineTo(x - 5, chestY + 30);
  ctx.lineTo(x, headBottom + 80);

  // Right side (mirrored)
  ctx.lineTo(x + 5, chestY + 30);
  ctx.lineTo(x + 8, waistY);
  ctx.lineTo(x + 12, hipY - 20);
  ctx.lineTo(x + 58, hipY - 20);
  ctx.lineTo(x + 56, hipY - 50);
  ctx.lineTo(x + 52, waistY);
  ctx.lineTo(x + 58, waistY - 30);
  ctx.lineTo(x + 70, chestY);
  ctx.lineTo(x + 85, headBottom + 45);
  ctx.lineTo(x + 95, headBottom + 25);

  // Shoulder line to collar
  ctx.lineTo(x + 40, headBottom + 15);
  ctx.lineTo(x + 22, headBottom + 5);
  ctx.lineTo(x, headBottom + 10);
  ctx.lineTo(x - 22, headBottom + 5);
  ctx.lineTo(x - 40, headBottom + 15);
  ctx.closePath();
  ctx.fill();

  // Jacket depth shading
  const jacketShade = ctx.createLinearGradient(x - 70, chestY, x + 70, chestY);
  jacketShade.addColorStop(0, '#00000020');
  jacketShade.addColorStop(0.5, 'transparent');
  jacketShade.addColorStop(1, '#00000020');
  ctx.fillStyle = jacketShade;
  ctx.fillRect(x - 70, headBottom + 20, 140, hipY - headBottom - 40);

  // === COLLAR ===
  ctx.fillStyle = fabricColor;
  ctx.beginPath();
  ctx.moveTo(x - 22, headBottom);
  ctx.lineTo(x - 25, headBottom + 15);
  ctx.lineTo(x, headBottom + 18);
  ctx.lineTo(x + 25, headBottom + 15);
  ctx.lineTo(x + 22, headBottom);
  ctx.closePath();
  ctx.fill();

  // === LAPELS (using existing lapel paths - scaled and positioned) ===
  ctx.save();
  ctx.translate(x, headBottom - 120);
  ctx.scale(0.12, 0.12);

  // Left lapel
  ctx.fillStyle = fabricColor;
  const lapelPath = lapels[lapel];
  const leftPath = Array.isArray(lapelPath) ? lapelPath[0] : lapelPath;
  ctx.fill(new Path2D(leftPath));

  // Right lapel (mirrored)
  ctx.scale(-1, 1);
  const rightPath = Array.isArray(lapelPath) ? lapelPath[1] : lapelPath;
  ctx.fill(new Path2D(rightPath));

  ctx.restore();

  // === SLEEVES ===
  for (const side of [-1, 1]) {
    ctx.fillStyle = fabricColor;

    // Upper sleeve
    ctx.beginPath();
    ctx.moveTo(x + side * 85, headBottom + 45);
    ctx.lineTo(x + side * 78, chestY + 80);
    ctx.lineTo(x + side * 70, chestY + 80);
    ctx.lineTo(x + side * 77, headBottom + 45);
    ctx.closePath();
    ctx.fill();

    // Lower sleeve
    ctx.beginPath();
    ctx.moveTo(x + side * 78, chestY + 80);
    ctx.lineTo(x + side * 72, hipY - 10);
    ctx.lineTo(x + side * 65, hipY - 10);
    ctx.lineTo(x + side * 70, chestY + 80);
    ctx.closePath();
    ctx.fill();

    // Sleeve cuff
    ctx.fillStyle = fabricColor;
    ctx.fillRect(x + side * 72 - (side > 0 ? 0 : 7), hipY - 15, 7, 8);

    // Cuff buttons (small)
    ctx.fillStyle = '#4a3728';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + side * 68.5, hipY - 12 + i * 8, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === BUTTONS (front) ===
  const buttonY1 = chestY + 20;
  const buttonY2 = chestY + 70;

  ctx.fillStyle = '#4a3728';
  for (const y of [buttonY1, buttonY2]) {
    ctx.beginPath();
    ctx.arc(x + 10, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // === POCKETS ===
  ctx.fillStyle = '#00000030';

  // Breast pocket (left)
  ctx.fillRect(x - 35, chestY - 10, 20, 3);

  // Hip pockets
  ctx.fillRect(x - 45, waistY + 30, 28, 3);
  ctx.fillRect(x + 17, waistY + 30, 28, 3);

  // === TROUSERS ===
  ctx.fillStyle = fabricColor;

  for (const side of [-1, 1]) {
    // Trouser leg
    ctx.beginPath();
    // Waist to hip
    ctx.moveTo(x + side * 20, hipY);
    ctx.lineTo(x + side * 34, kneeY);
    // Knee to ankle
    ctx.lineTo(x + side * 32, ankleY);
    ctx.lineTo(x + side * 25, ankleY);
    // Back up
    ctx.lineTo(x + side * 27, kneeY);
    ctx.lineTo(x + side * 15, hipY);
    ctx.closePath();
    ctx.fill();

    // Trouser crease (center line)
    ctx.strokeStyle = '#00000020';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + side * 27.5, hipY);
    ctx.lineTo(x + side * 28.5, ankleY);
    ctx.stroke();
  }

  // Trouser waistband
  ctx.fillStyle = fabricColor;
  ctx.fillRect(x - 60, hipY - 8, 120, 10);

  // Belt loops
  ctx.fillStyle = fabricColor;
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(x + i * 25, hipY - 8, 3, 10);
  }

  // === FINISHING TOUCHES ===

  // Jacket front edge highlight
  ctx.strokeStyle = '#ffffff15';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 10, headBottom + 80);
  ctx.lineTo(x - 12, hipY - 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 10, headBottom + 80);
  ctx.lineTo(x + 12, hipY - 20);
  ctx.stroke();

  ctx.restore();
}

// Export for use
if (typeof window !== 'undefined') {
  window.drawFullBodySuit = drawFullBodySuit;
}
