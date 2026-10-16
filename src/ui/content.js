// Figures from Tesla's Roadster page and reveal coverage (Oct 2026).
export const TRIMS = {
  performance: {
    label: 'Performance',
    tag: 'Road Ready',
    specs: [
      ['<1.6', 's', '0-60 mph'],
      ['300+', 'mi', 'Range'],
      ['2', '', 'Seats'],
    ],
    note: 'Active aero with a multi-mode suction system.',
  },
  thrust: {
    label: 'Thrust',
    tag: 'Race Ready',
    specs: [
      ['<0.9', 's', '0-60 mph'],
      ['300+', 'mi', 'Range'],
      ['2', '', 'Seats'],
    ],
    note: 'Adds cold-gas thrusters in the rear. Limited release.',
  },
  rocket: {
    label: 'Rocket',
    tag: 'Air Ready',
    specs: [
      ['<0.59', 's', '0-60 mph'],
      ['230+', 'mph', 'Top Speed'],
      ['1', '', 'Seat'],
    ],
    note: 'Perimeter thrusters for forward, upward and rotational movement. So yes, it can fly.',
  },
};

export const AERO_MODES = {
  road: { label: 'Road', caption: 'Road Mode', sub: 'Wing stowed flush with the rear deck' },
  downforce: { label: 'High Downforce', caption: 'High-Downforce Mode', sub: 'Track Mode lowers the car · wing raised and pitched · fans at full suction' },
  lowdrag: { label: 'Low Drag', caption: 'Low-Drag Mode', sub: 'Track Mode lowers the car · wing extended flat · endplates angled out' },
};

// [position, target, options]
export const CAMERAS = {
  front: { label: 'Front', pos: [7.4, 0.95, 0.001], target: [0, 0.5, 0] },
  '34': { label: '3/4', pos: [6.2, 1.7, 5.6], target: [0, 0.55, 0] },
  side: { label: 'Side', pos: [0.2, 0.8, 8.8], target: [0, 0.55, 0] },
  rear34: { label: 'Rear 3/4', pos: [-6.2, 1.8, 5.2], target: [0, 0.55, 0] },
  rear: { label: 'Rear', pos: [-7.6, 1.2, 0.001], target: [0, 0.55, 0] },
  top: { label: 'Top', pos: [-0.25, 10.8, 0.001], target: [0, 0, 0] },
  under: { label: 'Under', pos: [3.6, -2.7, 3.0], target: [0, 0.25, 0] },
  cabin: { label: 'Cabin', pos: [-0.44, 0.95, -0.3], target: [0.75, 0.74, -0.12], limits: { min: 0.05, max: 1.4 }, interior: true },
  chase: { label: 'Chase', pos: [-7.6, 2.05, 0.001], target: [0.6, 0.72, 0] },
  nose: { pos: [4.9, 1.05, 2.6], target: [1.9, 0.5, 0] },
  wing: { pos: [-4.2, 1.9, 2.6], target: [-1.95, 0.95, 0] },
  nozzles: { pos: [-3.8, 0.62, 1.5], target: [-2.2, 0.42, 0] },
  wheel: { pos: [2.2, 0.55, 3.0], target: [1.39, 0.38, 0.8] },
  door: { pos: [2.4, 1.6, 4.4], target: [0.2, 0.8, 0.4] },
  canopy: { pos: [1.6, 3.2, 3.2], target: [-0.2, 0.95, 0] },
};

// Anchors are in car space (+x forward, +z right). `normal` hides a hotspot when it faces away.
export const HOTSPOTS = [
  {
    id: 'lightbar',
    title: 'Hidden headlights',
    text: 'A single blade of light spans the nose. The headlights stay hidden in the bodywork until you need them.',
    anchor: [2.215, 0.545, 0],
    normal: [1, 0.1, 0],
    cam: 'nose',
    action: 'lights',
    actionLabel: 'Toggle lights',
  },
  {
    id: 'doors',
    title: 'Butterfly doors',
    text: 'The doors hinge at the A-pillar and swing up and forward, opening the roof section for an easy step into the low cockpit.',
    anchor: [0.15, 0.82, 0.86],
    normal: [0, 0.2, 1],
    cam: 'door',
    action: 'doors',
    actionLabel: 'Open / close doors',
  },
  {
    id: 'canopy',
    title: 'Gold-tinted glass',
    text: 'The canopy glass takes its gold tint from astronaut visors. The silhouette draws on the SR-71 Blackbird.',
    anchor: [-0.25, 1.075, 0],
    normal: [0, 1, 0],
    cam: 'canopy',
  },
  {
    id: 'wing',
    title: 'Active rear wing',
    text: 'The wing deploys for High-Downforce or Low-Drag modes, and powered fans keep the downforce coming even at zero speed.',
    anchor: [-2.06, 0.9, 0],
    normal: [-0.4, 1, 0],
    cam: 'wing',
    action: 'aero',
    actionLabel: 'Cycle aero modes',
  },
  {
    id: 'thrusters',
    title: 'Cold-gas thrusters',
    text: 'On Thrust and Rocket, cold-gas thrusters with all-electric actuators add acceleration and make micro-adjustments within a fraction of a second.',
    anchor: [-2.215, 0.445, 0.24],
    normal: [-1, 0, 0],
    cam: 'nozzles',
    action: 'thrust',
    actionLabel: 'Fire thrusters',
  },
  {
    id: 'fans',
    title: 'Multi-mode suction',
    text: 'The fans and ground-sealing system pull air from under the car. That is enough suction to hold the Roadster upside down, even when stationary.',
    anchor: [-2.215, 0.33, -0.33],
    normal: [-1, 0, 0],
    cam: 'nozzles',
    action: 'downforce',
    actionLabel: 'High-Downforce mode',
  },
  {
    id: 'wheels',
    title: 'Aero wheels',
    text: 'Thin-spoke wheels over wide performance tyres, with a staggered setup front to rear.',
    anchor: [1.39, 0.36, 0.95],
    normal: [0, 0, 1],
    cam: 'wheel',
    action: 'drive',
    actionLabel: 'Spin wheels',
  },
  {
    id: 'cabin',
    title: 'Ultrawhite cabin',
    text: 'Ultrawhite surfaces with gray microsuede, a steer-by-wire yoke, a centre touchscreen and two small forward displays. The seats are fixed to save weight.',
    anchor: [0.35, 0.86, -0.4],
    normal: [0, 1, -0.3],
    cam: 'cabin',
  },
];

export const ENVIRONMENTS = {
  studio: 'Studio',
  salt: 'Salt Flat',
  night: 'Night',
};
