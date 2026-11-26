// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred; the camera chases the plane
// along the valley while the sky, far mountains and hills slide past at their own
// parallax. Every instrument on the HUD is lit, and the plane, the terrain and the
// rings are drawn from the game's own numbers, never from an image.

import { FIELD, FONT, PALETTE, PLANE, RING, WORLD_LENGTH } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_SORTIE = 'sortie';
export const SCREEN_VICTORY = 'victory';

const PLANE_SCREEN_X = 460;
const LIFE_SIZE = 18;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const altLabel = cachedLabel('ALT ');
  const speedLabel = cachedLabel('SPD ');
  const scoreLabel = cachedLabel('SCORE ');
  const headingLabel = cachedLabel('HDG ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, glow) {
    if (!fonts.has(size)) fonts.set(size, `600 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    if (glow) {
      context.shadowColor = glow;
      context.shadowBlur = 8;
    }
    context.fillText(value, x, y);
    context.shadowBlur = 0;
  }

  function drawSky(terrain, time) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyHorizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Low sun, late afternoon, with a warm glow.
    const sunX = 1050;
    const sunY = 150;
    context.fillStyle = PALETTE.sunGlow;
    context.beginPath();
    context.arc(sunX, sunY, 90, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 34, 0, Math.PI * 2);
    context.fill();
  }

  function ridge(offset, baseY, amplitude, color, seedPhase) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 16) {
      const wx = x + offset;
      const y = baseY
        + amplitude * Math.sin(wx * 0.004 + seedPhase)
        + amplitude * 0.5 * Math.sin(wx * 0.011 + seedPhase * 2.7);
      context.lineTo(x, y);
    }
    context.lineTo(FIELD.width, FIELD.height);
    context.closePath();
    context.fill();
  }

  function drawClouds(terrain, camX, time) {
    context.fillStyle = 'rgba(255, 255, 255, 0.88)';
    const span = FIELD.width + 400;
    for (const cloud of terrain.clouds) {
      const raw = cloud.x * 0.25 + time * cloud.speed - camX * 0.25;
      const x = (((raw % span) + span) % span) - 200;
      context.beginPath();
      context.ellipse(x, cloud.y, cloud.w / 2, cloud.w / 6, 0, 0, Math.PI * 2);
      context.ellipse(x + cloud.w / 4, cloud.y + 8, cloud.w / 3, cloud.w / 7, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBirds(terrain, camX, time) {
    context.strokeStyle = 'rgba(30, 40, 60, 0.8)';
    context.lineWidth = 2;
    for (const bird of terrain.birds) {
      const x = ((bird.x - camX * 0.5 + time * 12) % (FIELD.width + 100)) - 50;
      const y = bird.y + Math.sin(time * 2 + bird.phase) * 12;
      const flap = Math.sin(time * 6 + bird.phase) * 5;
      context.beginPath();
      context.moveTo(x - 9, y);
      context.quadraticCurveTo(x - 3, y - 6 - flap, x, y);
      context.quadraticCurveTo(x + 3, y - 6 - flap, x + 9, y);
      context.stroke();
    }
  }

  function drawTerrain(terrain, camX) {
    // The ground itself, sampled every 8 px across the screen.
    context.beginPath();
    context.moveTo(0, FIELD.height);
    for (let sx = 0; sx <= FIELD.width; sx += 8) {
      context.lineTo(sx, terrain.groundHeight(camX + sx));
    }
    context.lineTo(FIELD.width, FIELD.height);
    context.closePath();
    const groundGradient = context.createLinearGradient(0, 180, 0, FIELD.height);
    groundGradient.addColorStop(0, PALETTE.grassLight);
    groundGradient.addColorStop(0.35, PALETTE.grass);
    groundGradient.addColorStop(1, PALETTE.rock);
    context.fillStyle = groundGradient;
    context.fill();
    // Snow on the high peaks.
    context.fillStyle = PALETTE.snow;
    for (let sx = 0; sx <= FIELD.width; sx += 8) {
      const gy = terrain.groundHeight(camX + sx);
      if (gy < 300) context.fillRect(sx, gy, 9, 10);
    }
    // The river in the gorge.
    if (camX + FIELD.width > terrain.river.x0 && camX < terrain.river.x1) {
      context.fillStyle = PALETTE.river;
      context.fillRect(terrain.river.x0 - camX, terrain.river.y - 14, terrain.river.x1 - terrain.river.x0, 22);
      context.fillStyle = PALETTE.riverLight;
      context.fillRect(terrain.river.x0 - camX, terrain.river.y - 14, terrain.river.x1 - terrain.river.x0, 5);
    }
    // The town: walls, roofs, lit windows.
    for (const house of terrain.town) {
      const hx = house.x - camX;
      if (hx < -80 || hx > FIELD.width + 80) continue;
      context.fillStyle = PALETTE.townWall;
      context.fillRect(hx, house.y - house.h, house.w, house.h);
      context.fillStyle = PALETTE.townRoof;
      context.beginPath();
      context.moveTo(hx - 4, house.y - house.h);
      context.lineTo(hx + house.w / 2, house.y - house.h - 16);
      context.lineTo(hx + house.w + 4, house.y - house.h);
      context.closePath();
      context.fill();
      if (house.lit) {
        context.fillStyle = PALETTE.windowLit;
        context.fillRect(hx + 8, house.y - house.h + 10, 9, 11);
        context.fillRect(hx + house.w - 17, house.y - house.h + 10, 9, 11);
      }
    }
    // Pine trees.
    for (const tree of terrain.trees) {
      const tx = tree.x - camX;
      if (tx < -30 || tx > FIELD.width + 30) continue;
      context.fillStyle = tree.shade > 0.5 ? PALETTE.pine : PALETTE.pineDark;
      context.beginPath();
      context.moveTo(tx, tree.y - tree.h);
      context.lineTo(tx - 11, tree.y);
      context.lineTo(tx + 11, tree.y);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(tx, tree.y - tree.h - 10);
      context.lineTo(tx - 8, tree.y - tree.h + 6);
      context.lineTo(tx + 8, tree.y - tree.h + 6);
      context.closePath();
      context.fill();
    }
    // The runways: grey strips, white dashes, a windsock at each end.
    for (const runway of terrain.runways) {
      const rx0 = runway.x0 - camX;
      const rx1 = runway.x1 - camX;
      if (rx1 < -40 || rx0 > FIELD.width + 40) continue;
      context.fillStyle = PALETTE.runway;
      context.fillRect(rx0, runway.y - 4, rx1 - rx0, 10);
      context.fillStyle = PALETTE.runwayLine;
      for (let dx = rx0 + 14; dx < rx1 - 20; dx += 44) context.fillRect(dx, runway.y - 1, 24, 4);
      text(runway.name, (rx0 + rx1) / 2, runway.y + 30, 15, PALETTE.hudText, 'center');
      context.strokeStyle = '#8b93a3';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(rx1 - 8, runway.y - 4);
      context.lineTo(rx1 - 8, runway.y - 34);
      context.stroke();
      context.fillStyle = '#ff8c42';
      context.beginPath();
      context.moveTo(rx1 - 8, runway.y - 34);
      context.lineTo(rx1 + 16, runway.y - 30);
      context.lineTo(rx1 - 8, runway.y - 26);
      context.closePath();
      context.fill();
    }
  }

  function drawRing(x, y, taken, index, time) {
    if (taken) return;
    const pulse = 1 + Math.sin(time * 3 + index) * 0.06;
    context.save();
    context.translate(x, y);
    context.scale(pulse, pulse);
    context.strokeStyle = PALETTE.ringGlow;
    context.lineWidth = 12;
    context.beginPath();
    context.arc(0, 0, RING.radius, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = PALETTE.ring;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, 0, RING.radius, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.ring;
    context.beginPath();
    context.arc(0, 0, 5, 0, Math.PI * 2);
    context.fill();
    text(String(index + 1), 0, 6, 22, '#7a5b00', 'center');
    context.restore();
  }

  function drawBeacon(terrain, camX, time) {
    const bx = terrain.beacon.x - camX;
    const by = terrain.beacon.y;
    if (bx < -60 || bx > FIELD.width + 60) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    context.strokeStyle = `rgba(255, 107, 94, ${0.4 + pulse * 0.5})`;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(bx, by, 26 + pulse * 10, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#ff6b5e';
    context.beginPath();
    context.arc(bx, by, 7, 0, Math.PI * 2);
    context.fill();
    text('HIKER', bx, by - 34, 14, PALETTE.hudText, 'center');
  }

  function drawDrum(drum, camX) {
    if (drum.taken) return;
    const dx = drum.x - camX;
    if (dx < -40 || dx > FIELD.width + 40) return;
    context.fillStyle = PALETTE.fuel;
    context.beginPath();
    context.arc(dx, drum.y, 18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    text('F', dx, drum.y + 6, 18, '#ffffff', 'center');
  }

  function drawParcel(terrain, camX) {
    const parcel = terrain.parcel;
    if (parcel.taken) return;
    const px = parcel.x - camX;
    if (px < -40 || px > FIELD.width + 40) return;
    context.fillStyle = '#d9a441';
    context.fillRect(px - 14, parcel.y - 12, 28, 24);
    context.strokeStyle = '#8a5a12';
    context.lineWidth = 2;
    context.strokeRect(px - 14, parcel.y - 12, 28, 24);
    context.beginPath();
    context.moveTo(px, parcel.y - 12);
    context.lineTo(px, parcel.y + 12);
    context.stroke();
    text('PARCEL', px, parcel.y - 20, 13, PALETTE.hudText, 'center');
  }

  function drawPlane(plane, time) {
    const px = PLANE_SCREEN_X;
    const py = plane.y;
    context.save();
    context.translate(px, py);
    context.scale(1.5, 1.5);
    // Flying west the sprite is mirrored, so the nose still points along the
    // velocity: scale(-1, 1) then rotate(pitch) puts the nose at pi - pitch.
    context.scale(plane.dir, 1);
    context.rotate(plane.pitch);
    // Blink while invulnerable after a hit.
    if (plane.invulnerable === 0 || Math.floor(plane.invulnerable * 8) % 2 === 0) {
      // Tail fin and main wing.
      context.fillStyle = PALETTE.planeWing;
      context.beginPath();
      context.moveTo(-26, 2);
      context.lineTo(-34, -16);
      context.lineTo(-22, -14);
      context.lineTo(-14, 2);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(-6, 4);
      context.lineTo(10, 12);
      context.lineTo(2, 2);
      context.closePath();
      context.fill();
      // Fuselage.
      context.fillStyle = PALETTE.planeBody;
      context.beginPath();
      context.moveTo(-32, 0);
      context.quadraticCurveTo(-32, -9, -12, -10);
      context.lineTo(18, -8);
      context.quadraticCurveTo(34, -6, 34, 0);
      context.quadraticCurveTo(34, 7, 16, 8);
      context.lineTo(-14, 8);
      context.quadraticCurveTo(-30, 7, -32, 0);
      context.closePath();
      context.fill();
      // Trim stripe.
      context.fillStyle = PALETTE.planeTrim;
      context.fillRect(-28, -2, 56, 3);
      // Cockpit glass.
      context.fillStyle = PALETTE.planeGlass;
      context.beginPath();
      context.moveTo(6, -8);
      context.quadraticCurveTo(16, -9, 20, -4);
      context.lineTo(8, -3);
      context.closePath();
      context.fill();
      // Propeller: a spinning blur whose speed follows the throttle.
      const propAngle = time * (4 + plane.throttle * 30);
      context.strokeStyle = 'rgba(40, 40, 50, 0.55)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(34 + Math.cos(propAngle) * 16, Math.sin(propAngle) * 16);
      context.lineTo(34 - Math.cos(propAngle) * 16, -Math.sin(propAngle) * 16);
      context.stroke();
      context.beginPath();
      context.arc(34, 0, 17, 0, Math.PI * 2);
      context.strokeStyle = 'rgba(40, 40, 50, 0.22)';
      context.lineWidth = 8;
      context.stroke();
      // Navigation lights, blinking.
      if (Math.floor(time * 2) % 2 === 0) {
        context.fillStyle = '#ff4040';
        context.beginPath();
        context.arc(-30, -2, 3, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#40ff70';
      context.beginPath();
      context.arc(30, 6, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawCompass(headingDeg) {
    const cx = FIELD.width / 2;
    const cy = 30;
    context.fillStyle = PALETTE.hudPanel;
    context.beginPath();
    context.roundRect(cx - 170, 10, 340, 40, 8);
    context.fill();
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let index = -2; index <= 2; index += 1) {
      const deg = Math.round((headingDeg + index * 45) / 45) * 45;
      const label = points[((Math.round(deg / 45) % 8) + 8) % 8];
      const x = cx + index * 64 - ((headingDeg % 45) / 45) * 64;
      text(label, x, cy + 8, 15, index === 0 ? PALETTE.hudAmber : PALETTE.hudText, 'center');
    }
    context.fillStyle = PALETTE.hudAmber;
    context.beginPath();
    context.moveTo(cx, 12);
    context.lineTo(cx - 5, 4);
    context.lineTo(cx + 5, 4);
    context.closePath();
    context.fill();
  }

  function drawHud(state, missions, time) {
    const plane = state.plane;
    const altitudeFt = Math.max(0, Math.round((state.groundAtPlane - plane.y) * 3.2));
    const speedKt = Math.round(plane.speed * 0.55);
    // Heading is the compass direction of the velocity: east is 90, west is 270,
    // and the climb angle tilts it a little either way.
    const headingDeg = Math.round(
      (((plane.dir > 0 ? 90 - plane.pitch * 57.3 : 270 + plane.pitch * 57.3) % 360) + 360) % 360,
    );
    context.textBaseline = 'top';
    // Top-left: altitude, speed, heading.
    context.fillStyle = PALETTE.hudPanel;
    context.beginPath();
    context.roundRect(14, 10, 300, 96, 10);
    context.fill();
    text(altLabel(altitudeFt) + ' FT', 28, 40, 26, PALETTE.hudText, 'left', 'rgba(140, 200, 255, 0.6)');
    text(speedLabel(speedKt) + ' KT', 28, 74, 26, PALETTE.hudText, 'left', 'rgba(140, 200, 255, 0.6)');
    text(headingLabel(headingDeg) + '°', 180, 40, 26, PALETTE.hudAmber, 'left', 'rgba(255, 207, 92, 0.6)');
    text('THR ' + Math.round(plane.throttle * 100) + '%', 180, 74, 26, PALETTE.hudGreen, 'left');
    drawCompass(headingDeg);
    // Top-right: score, fuel, damage.
    context.fillStyle = PALETTE.hudPanel;
    context.beginPath();
    context.roundRect(FIELD.width - 314, 10, 300, 96, 10);
    context.fill();
    text(scoreLabel(plane.score), FIELD.width - 28, 40, 26, PALETTE.hudText, 'right', 'rgba(140, 200, 255, 0.6)');
    const fuelColor = plane.fuel <= 25 ? PALETTE.hudRed : PALETTE.fuel;
    text('FUEL', FIELD.width - 290, 74, 18, PALETTE.muted, 'left');
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(FIELD.width - 232, 72, 170, 16);
    context.fillStyle = fuelColor;
    context.fillRect(FIELD.width - 232, 72, 170 * (plane.fuel / 100), 16);
    if (plane.fuel <= 25 && Math.floor(time * 3) % 2 === 0) {
      text('LOW FUEL', FIELD.width - 56, 74, 18, PALETTE.hudRed, 'right');
    }
    // Damage pips: three little propellers.
    for (let life = 0; life < 3; life += 1) {
      context.fillStyle = life < 3 - plane.damage ? PALETTE.planeBody : 'rgba(255,255,255,0.15)';
      context.beginPath();
      context.arc(FIELD.width - 280 + life * 26, 30, 8, 0, Math.PI * 2);
      context.fill();
    }
    // Mission banner, bottom centre.
    context.fillStyle = PALETTE.hudPanel;
    const banner = missions.name + ' — ' + missions.objective();
    context.beginPath();
    context.roundRect(220, FIELD.height - 52, FIELD.width - 440, 38, 10);
    context.fill();
    text(banner, FIELD.width / 2, FIELD.height - 26, 19, PALETTE.hudText, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 62;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 64, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 112 + index * 32, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 26, 22, PALETTE.hudAmber, 'center');
  }

  function drawWorld(state, terrain, time) {
    const plane = state.plane;
    const camX = Math.min(Math.max(plane.x - PLANE_SCREEN_X, 0), WORLD_LENGTH - FIELD.width);
    state.groundAtPlane = terrain.groundHeight(plane.x);
    drawSky(terrain, time);
    drawClouds(terrain, camX, time);
    ridge(camX * 0.25, 330, 70, PALETTE.farMountain2, 1.3);
    ridge(camX * 0.4, 420, 60, PALETTE.farMountain, 4.1);
    ridge(camX * 0.6, 520, 46, PALETTE.hillDark, 7.7);
    drawBirds(terrain, camX, time);
    // Every feature below already draws in screen coordinates (world x minus camX),
    // so no extra camera transform is needed here.
    drawTerrain(terrain, camX);
    // Rings, drums, parcel and beacon live in world space too.
    for (let index = 0; index < terrain.rings.length; index += 1) {
      const ring = terrain.rings[index];
      const rx = ring.x - camX;
      if (rx > -80 && rx < FIELD.width + 80) drawRing(rx, ring.y, ring.taken, index, time);
    }
    for (const drum of terrain.drums) drawDrum(drum, camX);
    drawParcel(terrain, camX);
    drawBeacon(terrain, camX, time);
    drawPlane(plane, time);
    return camX;
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, terrain, missions, screen, ui) {
    const time = ui.time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state, terrain, time);
    if (screen === SCREEN_TITLE) {
      drawPanel('SKY COURIER', [
        'Alpine Airlift — three sorties over one valley.',
        '↑ ↓ throttle · ← → pitch · Space airbrake · P pause · M mute',
        'Thread the rings. Deliver the parcel. Bring the hiker home.',
        ui.best > 0 ? `Best score ${ui.best}` : '',
      ], 'Press Space or click to fly');
      return;
    }
    drawHud(state, missions, time);
    if (ui.banner) {
      context.fillStyle = PALETTE.hudPanel;
      const bw = context.measureText(ui.banner).width + 48;
      context.beginPath();
      context.roundRect((FIELD.width - bw) / 2, 116, bw, 40, 10);
      context.fill();
      text(ui.banner, FIELD.width / 2, 142, 22, PALETTE.hudAmber, 'center');
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The valley will wait for you.'], 'Press P to resume', PALETTE.panelEdge);
    } else if (screen === SCREEN_SORTIE) {
      drawPanel(ui.sortieName, [ui.sortieBrief, ''], 'Press Space to take off', PALETTE.hudGreen);
    } else if (screen === SCREEN_OVER) {
      drawPanel('Crashed', [
        `Score ${state.plane.score} · Best ${ui.best}`,
        'The courier walks home. The valley keeps the parcel.',
      ], 'Press Space to fly again', PALETTE.hudRed);
    } else if (screen === SCREEN_VICTORY) {
      drawPanel('All sorties complete!', [
        `Final score ${state.plane.score} · Best ${ui.best}`,
        'Rings threaded, parcel delivered, hiker home safe.',
      ], 'Press Space to fly the valley again', PALETTE.ring);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
