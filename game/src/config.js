// Sky Courier: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The world scrolls sideways:
// the plane flies left to right over a 12,000 px alpine valley.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How long the valley is, in world pixels. */
export const WORLD_LENGTH = 12000;

/** The plane's physics. Speeds are px/s; pitch is radians, negative = nose up. */
export const PLANE = {
  maxSpeed: 340,
  minSpeed: 55,
  stallSpeed: 120,
  accel: 0.9,
  drag: 0.12,
  turnRate: 1.5,
  climbPenalty: 0.55,
  sinkFactor: 1.15,
  width: 64,
  height: 20,
};

/** Fuel: percent, 100 at the start of a sortie. */
export const FUEL = {
  start: 100,
  burnIdle: 0.35,
  burnFull: 1.5,
  drumRefill: 35,
  missionRefill: 40,
  warningAt: 25,
};

export const DAMAGE = { max: 3, invulnerable: 2.0 };

export const RING = { radius: 42, points: 150, count: 6 };

export const MISSION_POINTS = { ringRun: 150, pickup: 200, landing: 500, rescue: 500, victory: 1000 };

/** Seconds of grace after a hard touchdown before the next damage can land. */
export const TOUCHDOWN = { maxSink: 95, maxPitch: 0.14, minSpeed: 90, maxSpeed: 260 };

export const PALETTE = {
  backdrop: '#0e1420',
  skyTop: '#2e5f8a',
  skyMid: '#7fb2d9',
  skyHorizon: '#ffd9a0',
  sun: '#fff3c4',
  sunGlow: 'rgba(255, 220, 140, 0.35)',
  farMountain: '#5a6f9e',
  farMountain2: '#46587f',
  hill: '#4a7a4e',
  hillDark: '#3a6240',
  grass: '#5d8a4a',
  grassLight: '#79a85e',
  rock: '#6b6258',
  snow: '#f4f8ff',
  pine: '#2c5233',
  pineDark: '#1f3d26',
  river: '#4f9fd8',
  riverLight: '#7cc0e8',
  runway: '#3c3f46',
  runwayLine: '#f5f0dc',
  townRoof: '#b4552d',
  townWall: '#e8dcc0',
  windowLit: '#ffd76a',
  planeBody: '#e84c3d',
  planeWing: '#c0392b',
  planeGlass: '#bfe8ff',
  planeTrim: '#f5f0dc',
  ring: '#f2c94c',
  ringGlow: 'rgba(242, 201, 76, 0.45)',
  fuel: '#37c978',
  fuelDark: '#1e7a46',
  hudPanel: 'rgba(10, 16, 28, 0.72)',
  hudText: '#eef4ff',
  hudAmber: '#ffcf5c',
  hudRed: '#ff6b5e',
  hudGreen: '#7ce8a0',
  panel: 'rgba(12, 18, 32, 0.88)',
  panelEdge: '#3d5a80',
  text: '#eef1f5',
  muted: '#9fb2c8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sky-courier.best';
