// The alpine valley: one seeded heightmap, the runways flattened into it, and every
// feature the missions need placed along it. Nothing here draws; it only answers
// questions (how high is the ground here, where is the next ring) so the renderer
// and the flight model share one truth.

import { FIELD, RING, WORLD_LENGTH } from './config.js';

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createTerrain(random) {
  // Three sine layers with seeded phases: a broad valley, rolling hills, rough peaks.
  const p1 = random() * Math.PI * 2;
  const p2 = random() * Math.PI * 2;
  const p3 = random() * Math.PI * 2;

  const flats = [
    { x0: 300, x1: 1000, y: 600 }, // home runway: Alpine Field
    { x0: 8700, x1: 9400, y: 420 }, // mountain airstrip: Eagle's Nest
  ];

  function rawHeight(x) {
    const t = x / WORLD_LENGTH;
    const valley = 560 + 90 * Math.sin(t * Math.PI * 2.2 + p1);
    const hills = 70 * Math.sin(t * Math.PI * 7 + p2);
    const peaks = 55 * Math.sin(t * Math.PI * 17 + p3) * Math.sin(t * Math.PI * 3 + p1);
    // A deep river gorge around x = 4200.
    const gorge = -120 * Math.exp(-(((x - 4200) / 260) ** 2));
    return valley + hills + peaks + gorge;
  }

  function groundHeight(x) {
    let y = rawHeight(x);
    for (const flat of flats) {
      const blend = smoothstep(flat.x0 - 140, flat.x0 + 60, x) * (1 - smoothstep(flat.x1 - 60, flat.x1 + 140, x));
      y = y * (1 - blend) + flat.y * blend;
    }
    return Math.min(660, Math.max(180, y));
  }

  // The two runways, with names the HUD and the missions use.
  const runways = [
    { name: "Alpine Field", x0: 320, x1: 980, y: 600 },
    { name: "Eagle's Nest", x0: 8720, x1: 9380, y: 420 },
  ];

  // A little town with lit windows, sitting in the valley floor.
  const town = [];
  for (let index = 0; index < 9; index += 1) {
    const x = 2250 + index * 78 + random() * 30;
    town.push({ x, y: groundHeight(x), w: 44 + random() * 22, h: 30 + random() * 22, lit: random() > 0.35 });
  }

  // Pine trees on the slopes, never on a runway, the river or the town.
  const trees = [];
  for (let x = 120; x < WORLD_LENGTH - 100; x += 46 + random() * 60) {
    const onRunway = runways.some((r) => x > r.x0 - 60 && x < r.x1 + 60);
    const inTown = x > 2150 && x < 3050;
    const inRiver = x > 3950 && x < 4450;
    if (onRunway || inTown || inRiver) continue;
    const y = groundHeight(x);
    trees.push({ x, y, h: 26 + random() * 30, shade: random() });
  }

  // The river: a band of water filling the gorge.
  const river = { x0: 3980, x1: 4420, y: 640 };

  // Six golden rings along a gentle flight path, each well clear of the ground.
  const rings = [];
  for (let index = 0; index < RING.count; index += 1) {
    const x = 1500 + index * 1350;
    const clearance = 190 + random() * 90;
    rings.push({ x, y: Math.min(groundHeight(x) - clearance, 330), taken: false });
  }

  // Fuel drums: fly through one to refill.
  const drums = [
    { x: 3400, y: groundHeight(3400) - 150, taken: false },
    { x: 7600, y: groundHeight(7600) - 150, taken: false },
  ];

  // The stranded hiker's beacon, high on a peak.
  const beacon = { x: 6100, y: groundHeight(6100) - 60 };

  // The parcel depot at the home runway.
  const parcel = { x: 660, y: 600 - 70, taken: false };

  // Drifting clouds, spread over the whole sky.
  const clouds = [];
  for (let index = 0; index < 26; index += 1) {
    clouds.push({
      x: random() * WORLD_LENGTH,
      y: 60 + random() * 220,
      w: 120 + random() * 160,
      speed: 4 + random() * 8,
    });
  }

  // A few birds for life in the sky.
  const birds = [];
  for (let index = 0; index < 8; index += 1) {
    birds.push({ x: random() * WORLD_LENGTH, y: 120 + random() * 200, phase: random() * Math.PI * 2 });
  }

  return { groundHeight, runways, town, river, trees, rings, drums, beacon, parcel, clouds, birds };
}
