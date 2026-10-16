// Body definition for the next-gen Tesla Roadster, measured from the reveal
// footage (side / rear / top views). Units are meters.
// Axes: +x forward, +y up, +z towards the car's right side. Only the right
// half (z >= 0) is described; the builder mirrors it.
//
// Each station is a planar cross-section at a given x. Rows run from the
// underside centre, around the flank, over the shoulder to the roof centre:
//   Uo  underside outer edge
//   Rb  rocker bottom (black skirt starts)
//   Lo  lower crease (black / white split)
//   Md  widest flank line (soft)
//   Sh  shoulder crease
//   Bt  belt line (window base / fender crease / sail outer edge)
//   Re  window top (roof rail outer edge)
//   Ra  roof rail inner edge (sail ridge at the rear)
//   Gl  glass edge (canopy edge, sail inner wall foot)
//   Tp  centre-line height
// Rows may be omitted on a station; they are then interpolated from the
// neighbouring stations. `corner` lists rows that get a hard kink there.

export const STATIONS = [
  { x: 2.2, Uo: [0.52, 0.205], Rb: [0.635, 0.21], Lo: [0.685, 0.345], Md: [0.702, 0.45], Sh: [0.694, 0.53], Bt: [0.66, 0.556], Re: [0.5, 0.557], Ra: [0.33, 0.556], Gl: [0.33, 0.556], Tp: 0.555 },
  { x: 2.14, Uo: [0.56, 0.195], Rb: [0.69, 0.2], Lo: [0.735, 0.345], Md: [0.752, 0.462], Sh: [0.742, 0.565], Bt: [0.705, 0.588], Re: [0.54, 0.584], Ra: [0.36, 0.58], Gl: [0.36, 0.58], Tp: 0.578 },
  { x: 2.0, Uo: [0.6, 0.185], Rb: [0.785, 0.19], Lo: [0.825, 0.335], Md: [0.842, 0.492], Sh: [0.83, 0.625], Bt: [0.772, 0.66], Re: [0.6, 0.648], Ra: [0.41, 0.64], Gl: [0.41, 0.64], Tp: 0.635 },
  { x: 1.8, Uo: [0.6, 0.18], Rb: [0.865, 0.18], Lo: [0.905, 0.325], Md: [0.922, 0.522], Sh: [0.9, 0.712], Bt: [0.8, 0.752], Re: [0.635, 0.728], Ra: [0.44, 0.715], Gl: [0.44, 0.715], Tp: 0.705 },
  { x: 1.6, Uo: [0.6, 0.175], Rb: [0.89, 0.175], Lo: [0.935, 0.315], Md: [0.95, 0.535], Sh: [0.925, 0.782], Bt: [0.816, 0.829], Re: [0.66, 0.8], Ra: [0.46, 0.785], Gl: [0.46, 0.785], Tp: 0.775 },
  { x: 1.5, corner: ['Gl', 'Tp'], Uo: [0.6, 0.172], Rb: [0.9, 0.175], Lo: [0.945, 0.312], Md: [0.96, 0.54], Sh: [0.932, 0.8], Bt: [0.822, 0.845], Re: [0.7, 0.822], Ra: [0.5, 0.806], Gl: [0.44, 0.802], Tp: 0.8 },
  { x: 1.35, Uo: [0.6, 0.17], Rb: [0.91, 0.175], Lo: [0.952, 0.308], Md: [0.964, 0.546], Sh: [0.935, 0.83], Bt: [0.828, 0.862], Re: [0.77, 0.856], Ra: [0.69, 0.849], Gl: [0.63, 0.846], Tp: 0.852 },
  { x: 1.25, corner: ['Re', 'Ra', 'Gl'], Sh: [0.937, 0.835], Bt: [0.815, 0.868], Re: [0.813, 0.87], Ra: [0.811, 0.872], Gl: [0.81, 0.872], Tp: 0.885 },
  { x: 1.05, Bt: [0.8, 0.866], Re: [0.765, 0.915], Ra: [0.735, 0.926], Gl: [0.735, 0.926], Tp: 0.946 },
  { x: 0.85, Uo: [0.6, 0.17], Rb: [0.92, 0.175], Lo: [0.962, 0.3], Md: [0.968, 0.55], Sh: [0.943, 0.832], Bt: [0.795, 0.862], Re: [0.71, 0.965], Ra: [0.68, 0.977], Gl: [0.68, 0.977], Tp: 1.005 },
  { x: 0.55, Rb: [0.925, 0.175], Lo: [0.965, 0.3], Md: [0.97, 0.55], Sh: [0.948, 0.83], Bt: [0.79, 0.86], Re: [0.66, 1.03], Ra: [0.628, 1.043], Gl: [0.628, 1.043], Tp: 1.085 },
  { x: 0.25, Rb: [0.926, 0.175], Lo: [0.966, 0.305], Md: [0.972, 0.55], Sh: [0.952, 0.832], Bt: [0.785, 0.862], Re: [0.62, 1.09], Ra: [0.585, 1.103], Gl: [0.585, 1.103], Tp: 1.145 },
  { x: -0.1, Rb: [0.928, 0.176], Lo: [0.968, 0.315], Md: [0.976, 0.555], Sh: [0.958, 0.84], Bt: [0.785, 0.87], Re: [0.6, 1.105], Ra: [0.563, 1.118], Gl: [0.563, 1.118], Tp: 1.165 },
  { x: -0.45, Uo: [0.6, 0.17], Rb: [0.93, 0.178], Lo: [0.972, 0.33], Md: [0.982, 0.56], Sh: [0.965, 0.858], Bt: [0.775, 0.9], Re: [0.582, 1.095], Ra: [0.545, 1.107], Gl: [0.545, 1.107], Tp: 1.155 },
  { x: -0.8, Rb: [0.935, 0.18], Lo: [0.976, 0.355], Md: [0.988, 0.57], Sh: [0.972, 0.885], Bt: [0.735, 0.957], Re: [0.585, 1.06], Ra: [0.55, 1.068], Gl: [0.505, 1.055], Tp: 1.115 },
  { x: -1.08, corner: ['Bt', 'Re'], Rb: [0.94, 0.182], Lo: [0.98, 0.385], Md: [0.993, 0.585], Sh: [0.977, 0.915], Bt: [0.625, 1.028], Re: [0.622, 1.03], Ra: [0.56, 1.033], Gl: [0.47, 1.012], Tp: 1.068 },
  { x: -1.4, Uo: [0.6, 0.18], Rb: [0.945, 0.19], Lo: [0.984, 0.43], Md: [0.996, 0.61], Sh: [0.98, 0.91], Bt: [0.6, 1.008], Re: [0.597, 1.01], Ra: [0.535, 1.012], Gl: [0.415, 0.968], Tp: 1.008 },
  { x: -1.7, Uo: [0.6, 0.195], Rb: [0.945, 0.21], Lo: [0.984, 0.52], Md: [0.994, 0.65], Sh: [0.975, 0.895], Bt: [0.58, 0.962], Re: [0.577, 0.963], Ra: [0.515, 0.963], Gl: [0.345, 0.905], Tp: 0.932 },
  { x: -1.84, corner: ['Gl', 'Tp'], Uo: [0.6, 0.205], Rb: [0.943, 0.218], Lo: [0.98, 0.575], Md: [0.988, 0.675], Sh: [0.969, 0.89], Bt: [0.572, 0.94], Re: [0.569, 0.941], Ra: [0.505, 0.94], Gl: [0.31, 0.878], Tp: 0.89 },
  { x: -2.0, Uo: [0.6, 0.22], Rb: [0.932, 0.228], Lo: [0.968, 0.63], Md: [0.975, 0.7], Sh: [0.958, 0.884], Bt: [0.565, 0.918], Re: [0.562, 0.919], Ra: [0.495, 0.915], Gl: [0.29, 0.86], Tp: 0.86 },
  { x: -2.12, Uo: [0.6, 0.235], Rb: [0.91, 0.24], Lo: [0.948, 0.665], Md: [0.955, 0.722], Sh: [0.942, 0.879], Bt: [0.558, 0.898], Re: [0.556, 0.899], Ra: [0.49, 0.895], Gl: [0.29, 0.86], Tp: 0.86 },
  { x: -2.2, Uo: [0.6, 0.25], Rb: [0.86, 0.25], Lo: [0.915, 0.68], Md: [0.925, 0.735], Sh: [0.918, 0.875], Bt: [0.555, 0.882], Re: [0.553, 0.883], Ra: [0.488, 0.88], Gl: [0.29, 0.86], Tp: 0.86 },
];

export const FRONT_X = 2.2;
export const REAR_X = -2.2;

// Wheel arches: semi-elliptical cut-outs with vertical lower edges.
export const ARCHES = [
  { x: 1.39, yc: 0.36, rx: 0.405, ry: 0.4 },
  { x: -1.56, yc: 0.36, rx: 0.405, ry: 0.395 },
];

export const WHEELS = {
  front: { x: 1.39, z: 0.8, radius: 0.36, width: 0.27 },
  rear: { x: -1.56, z: 0.81, radius: 0.36, width: 0.31 },
};

// Butterfly door outline. The lower door edge follows Lo, the top follows Re.
// The front cut is a station; the rear cut slants forward towards the sill.
export const DOOR = {
  frontX: 0.715,
  tipX: 1.25,
  rearAnchorX: -0.43,
  warpEndX: -1.0,
  rearLine: { Lo: -0.3, Md: -0.37, Sh: -0.45, Bt: -0.49, Re: -0.57, Ra: -0.57, Gl: -0.57 },
};

export const GLASS = {
  windshieldX: 1.5,
  rearGlassEndX: -1.84,
  ventEndX: -1.97,
  sideFrontX: 1.25,
  quarterTipX: -1.08,
};
