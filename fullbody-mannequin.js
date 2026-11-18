'use strict';

// Professional Full-Body Mannequin Renderer
// Hockerty-style realistic proportions with complete head-to-toe figure

function drawFullBodyMannequin(ctx, options = {}) {
  const {
    x = 512,           // Center X
    y = 200,           // Top Y (head starts here)
    scale = 1,         // Overall scale
    skinTone = '#f5d9be',
    highlight = '#ffffff',
    shadow = '#d4bfa8'
  } = options;

  ctx.save();

  // Scale factor for proportions (8-head canon)
  const headHeight = 90 * scale;
  const bodyWidth = 180 * scale;

  // === HEAD ===
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.ellipse(x, y + headHeight * 0.5, headHeight * 0.38, headHeight * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head highlight
  const headGrad = ctx.createRadialGradient(x - 15, y + 20, 10, x, y + 40, 50);
  headGrad.addColorStop(0, highlight + '40');
  headGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = headGrad;
  ctx.fill();

  // === NECK ===
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.moveTo(x - 18, y + headHeight * 0.9);
  ctx.lineTo(x - 22, y + headHeight * 1.15);
  ctx.lineTo(x + 22, y + headHeight * 1.15);
  ctx.lineTo(x + 18, y + headHeight * 0.9);
  ctx.closePath();
  ctx.fill();

  // Neck shadow
  ctx.fillStyle = shadow + '40';
  ctx.fillRect(x - 22, y + headHeight * 1.05, 44, 12);

  // === SHOULDERS (broader, more masculine) ===
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  // Left shoulder curve
  ctx.moveTo(x - 22, y + headHeight * 1.15);
  ctx.quadraticCurveTo(x - 85, y + headHeight * 1.3, x - 95, y + headHeight * 1.55);
  ctx.lineTo(x - 85, y + headHeight * 1.75);
  ctx.quadraticCurveTo(x - 80, y + headHeight * 1.6, x - 60, y + headHeight * 1.5);
  ctx.lineTo(x - 40, y + headHeight * 1.6);
  // Torso connection
  ctx.lineTo(x, y + headHeight * 1.65);
  ctx.lineTo(x + 40, y + headHeight * 1.6);
  ctx.lineTo(x + 60, y + headHeight * 1.5);
  ctx.quadraticCurveTo(x + 80, y + headHeight * 1.6, x + 85, y + headHeight * 1.75);
  ctx.lineTo(x + 95, y + headHeight * 1.55);
  ctx.quadraticCurveTo(x + 85, y + headHeight * 1.3, x + 22, y + headHeight * 1.15);
  ctx.closePath();
  ctx.fill();

  // Shoulder depth shading
  const shoulderShade = ctx.createLinearGradient(x - 95, y + headHeight * 1.4, x + 95, y + headHeight * 1.4);
  shoulderShade.addColorStop(0, shadow + '30');
  shoulderShade.addColorStop(0.5, 'transparent');
  shoulderShade.addColorStop(1, shadow + '30');
  ctx.fillStyle = shoulderShade;
  ctx.beginPath();
  ctx.ellipse(x, y + headHeight * 1.5, 90, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  // === ARMS (full length to wrists) ===
  for (const side of [-1, 1]) {
    ctx.fillStyle = skinTone;

    // Upper arm
    ctx.beginPath();
    ctx.moveTo(x + side * 85, y + headHeight * 1.75);
    ctx.lineTo(x + side * 75, y + headHeight * 3.2);
    ctx.lineTo(x + side * 68, y + headHeight * 3.2);
    ctx.lineTo(x + side * 78, y + headHeight * 1.75);
    ctx.closePath();
    ctx.fill();

    // Elbow
    ctx.beginPath();
    ctx.arc(x + side * 71.5, y + headHeight * 3.2, 8, 0, Math.PI * 2);
    ctx.fill();

    // Forearm
    ctx.beginPath();
    ctx.moveTo(x + side * 75, y + headHeight * 3.2);
    ctx.lineTo(x + side * 70, y + headHeight * 4.8);
    ctx.lineTo(x + side * 63, y + headHeight * 4.8);
    ctx.lineTo(x + side * 68, y + headHeight * 3.2);
    ctx.closePath();
    ctx.fill();

    // Hand
    ctx.beginPath();
    ctx.ellipse(x + side * 66.5, y + headHeight * 5, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arm shadow (inner side)
    if (side === -1) {
      ctx.fillStyle = shadow + '25';
      ctx.fillRect(x + side * 75, y + headHeight * 1.75, 10, headHeight * 3.05);
    }
  }

  // === TORSO (athletic V-shape) ===
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  // Chest (wide)
  ctx.moveTo(x - 40, y + headHeight * 1.6);
  ctx.lineTo(x - 65, y + headHeight * 2.2);
  // Waist (tapered)
  ctx.lineTo(x - 55, y + headHeight * 3.5);
  // Hips (slightly wider than waist)
  ctx.lineTo(x - 60, y + headHeight * 4.2);
  // Bottom center
  ctx.lineTo(x, y + headHeight * 4.3);
  // Right side (mirrored)
  ctx.lineTo(x + 60, y + headHeight * 4.2);
  ctx.lineTo(x + 55, y + headHeight * 3.5);
  ctx.lineTo(x + 65, y + headHeight * 2.2);
  ctx.lineTo(x + 40, y + headHeight * 1.6);
  ctx.closePath();
  ctx.fill();

  // Torso center highlight
  const torsoHighlight = ctx.createLinearGradient(x - 30, y + headHeight * 2, x + 30, y + headHeight * 2);
  torsoHighlight.addColorStop(0, 'transparent');
  torsoHighlight.addColorStop(0.5, highlight + '30');
  torsoHighlight.addColorStop(1, 'transparent');
  ctx.fillStyle = torsoHighlight;
  ctx.fillRect(x - 30, y + headHeight * 1.6, 60, headHeight * 2.7);

  // === LEGS (full length to ankles) ===
  for (const side of [-1, 1]) {
    ctx.fillStyle = skinTone;

    // Thigh
    ctx.beginPath();
    ctx.moveTo(x + side * 20, y + headHeight * 4.2);
    ctx.lineTo(x + side * 32, y + headHeight * 6.2);
    ctx.lineTo(x + side * 27, y + headHeight * 6.2);
    ctx.lineTo(x + side * 15, y + headHeight * 4.2);
    ctx.closePath();
    ctx.fill();

    // Knee
    ctx.beginPath();
    ctx.arc(x + side * 29.5, y + headHeight * 6.2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Calf
    ctx.beginPath();
    ctx.moveTo(x + side * 32, y + headHeight * 6.2);
    ctx.lineTo(x + side * 30, y + headHeight * 7.8);
    ctx.lineTo(x + side * 25, y + headHeight * 7.8);
    ctx.lineTo(x + side * 27, y + headHeight * 6.2);
    ctx.closePath();
    ctx.fill();

    // Ankle
    ctx.beginPath();
    ctx.arc(x + side * 27.5, y + headHeight * 7.8, 4, 0, Math.PI * 2);
    ctx.fill();

    // Leg shadow (inner side)
    if (side === -1) {
      ctx.fillStyle = shadow + '20';
      ctx.fillRect(x + side * 32, y + headHeight * 4.2, 12, headHeight * 3.6);
    }
  }

  ctx.restore();

  // Return dimensions for suit rendering
  return {
    headTop: y,
    headBottom: y + headHeight * 1.15,
    shoulderWidth: 190 * scale,
    chestY: y + headHeight * 2,
    waistY: y + headHeight * 3.5,
    hipY: y + headHeight * 4.2,
    kneeY: y + headHeight * 6.2,
    ankleY: y + headHeight * 7.8,
    centerX: x,
    scale: scale
  };
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.drawFullBodyMannequin = drawFullBodyMannequin;
}
