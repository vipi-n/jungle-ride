import * as THREE from 'three';
import { STATIONS, ARCHES, DOOR, GLASS, FRONT_X, REAR_X } from './bodyData.js';

export const MAT = {
  PAINT: 0,
  TRIM: 1,
  GLASS: 2,
  UNDER: 3,
  LINER: 4,
  JAMB: 5,
  DOOR_INNER: 6,
};

const DATA_ROWS = ['Uo', 'Rb', 'Lo', 'Md', 'Sh', 'Bt', 'Re', 'Ra', 'Gl', 'Tp'];
const ROWS = ['Cb', 'Uo', 'Wt', 'Rb', 'Lo', 'Md', 'Sh', 'Bt', 'Re', 'Ra', 'Gl', 'Tp'];
const RI = Object.fromEntries(ROWS.map((id, i) => [id, i]));

// true = crease, false = smooth, 'mat' = crease only where the material changes
const ROW_SHARP = { Cb: true, Uo: true, Wt: true, Rb: true, Lo: true, Md: false, Sh: true, Bt: true, Re: 'mat', Ra: 'mat', Gl: 'mat', Tp: true };
// subdivisions of the strip that starts at the given row
const STRIP_SUBDIV = { Cb: 1, Uo: 1, Wt: 1, Rb: 1, Lo: 3, Md: 4, Sh: 1, Bt: 1, Re: 1, Ra: 2, Gl: 8 };

// ---------------------------------------------------------------------------
// Monotone cubic interpolation (Fritsch–Carlson). xs ascending.
function pchip(xs, ys) {
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  if (n > 2) {
    // shape-preserving end slopes
    m[0] = endSlope(h[0], h[1], d[0], d[1]);
    m[n - 1] = endSlope(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  }
  return (x) => {
    let lo = 0;
    let hi = n - 2;
    if (x <= xs[0]) lo = 0;
    else if (x >= xs[n - 1]) lo = n - 2;
    else {
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (xs[mid] <= x) lo = mid;
        else hi = mid - 1;
      }
    }
    const t = THREE.MathUtils.clamp((x - xs[lo]) / h[lo], 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h[lo] * m[lo] + (-2 * t3 + 3 * t2) * ys[lo + 1] + (t3 - t2) * h[lo] * m[lo + 1];
  };
}

function endSlope(h0, h1, d0, d1) {
  let m = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(m) !== Math.sign(d0)) m = 0;
  else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(m) > Math.abs(3 * d0)) m = 3 * d0;
  return m;
}

// Row curves, split into C0 pieces at corner stations.
function buildRowCurves() {
  const curves = {};
  for (const id of DATA_ROWS) {
    const pts = [];
    for (const s of STATIONS) {
      const v = s[id];
      if (v === undefined) continue;
      pts.push({
        x: s.x,
        z: id === 'Tp' ? 0 : v[0],
        y: id === 'Tp' ? v : v[1],
        corner: !!(s.corner && s.corner.includes(id)),
      });
    }
    pts.reverse();
    const pieces = [];
    let cur = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      cur.push(pts[i]);
      if (pts[i].corner && i < pts.length - 1) {
        pieces.push(cur);
        cur = [pts[i]];
      }
    }
    pieces.push(cur);
    const fns = pieces.map((p) => ({
      x0: p[0].x,
      x1: p[p.length - 1].x,
      fy: pchip(p.map((q) => q.x), p.map((q) => q.y)),
      fz: pchip(p.map((q) => q.x), p.map((q) => q.z)),
    }));
    const cornerXs = pts.filter((p) => p.corner).map((p) => p.x);
    curves[id] = {
      eval(x) {
        let f = fns[fns.length - 1];
        for (const c of fns) {
          if (x <= c.x1) {
            f = c;
            break;
          }
        }
        return [f.fz(x), f.fy(x)];
      },
      piece(x) {
        let n = 0;
        for (const cx of cornerXs) if (x < cx) n++;
        return n;
      },
    };
  }
  return curves;
}

export function archY(x) {
  for (const a of ARCHES) {
    const dx = (x - a.x) / a.rx;
    if (Math.abs(dx) < 1) return a.yc + a.ry * Math.sqrt(1 - dx * dx);
  }
  return -Infinity;
}

// ---------------------------------------------------------------------------
function buildColumnXs() {
  const special = [FRONT_X, REAR_X, DOOR.frontX, DOOR.tipX, DOOR.rearAnchorX, DOOR.warpEndX, GLASS.windshieldX, GLASS.rearGlassEndX, GLASS.quarterTipX, GLASS.ventEndX];
  for (const s of STATIONS) if (s.corner) special.push(s.x);
  const xs = [];
  for (let x = FRONT_X; x > REAR_X - 1e-6; x -= 0.028) xs.push(x);
  for (const a of ARCHES) {
    const n = 56;
    for (let i = 0; i <= n; i++) {
      const th = (Math.PI * i) / n;
      xs.push(a.x + a.rx * 0.9993 * Math.cos(th));
    }
    special.push(a.x + a.rx * 0.9993, a.x - a.rx * 0.9993, a.x + a.rx + 0.004, a.x - a.rx - 0.004);
  }
  const all = [...special.map((x) => ({ x, s: true })), ...xs.map((x) => ({ x, s: false }))];
  all.sort((a, b) => b.x - a.x);
  const out = [];
  for (const p of all) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.0025) {
      if (p.s && !last.s) out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out.map((p) => p.x);
}

function indexOfX(xs, x) {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  return best;
}

// ---------------------------------------------------------------------------
export function buildBody() {
  const curves = buildRowCurves();
  const X = buildColumnXs();
  const N = X.length;
  const jFront = indexOfX(X, DOOR.frontX);
  const jTip = indexOfX(X, DOOR.tipX);
  const jRear = indexOfX(X, DOOR.rearAnchorX);
  const jWarpEnd = indexOfX(X, DOOR.warpEndX);
  const jWind = indexOfX(X, GLASS.windshieldX);
  const jRearGlass = indexOfX(X, GLASS.rearGlassEndX);
  const jQuarter = indexOfX(X, GLASS.quarterTipX);
  const jVent = indexOfX(X, GLASS.ventEndX);

  const warp = (id, j) => {
    const x = X[j];
    const L = DOOR.rearLine[id];
    if (L === undefined || j < jFront || j > jWarpEnd) return x;
    const A = X[jFront];
    const Rr = X[jRear];
    const B = X[jWarpEnd];
    if (j <= jRear) return A + ((x - A) * (L - A)) / (Rr - A);
    return L + ((x - Rr) * (B - L)) / (B - Rr);
  };

  // final row layout
  const finalRows = []; // { orig, t, strip }
  const finalOfOrig = {};
  for (let r = 0; r < ROWS.length; r++) {
    const id = ROWS[r];
    finalOfOrig[id] = finalRows.length;
    finalRows.push({ orig: id, t: 0, strip: id });
    if (r < ROWS.length - 1) {
      const n = STRIP_SUBDIV[id];
      for (let k = 1; k < n; k++) finalRows.push({ orig: null, t: k / n, strip: id });
    }
  }
  const F = finalRows.length;
  const stripOfFinal = []; // for strip f (between final row f and f+1)
  for (let f = 0; f < F - 1; f++) stripOfFinal.push(finalRows[f].strip);

  // evaluate sections
  const P = [];
  for (let j = 0; j < N; j++) {
    const pts = {};
    for (const id of DATA_ROWS) {
      const xw = warp(id, j);
      const [z, y] = curves[id].eval(xw);
      pts[id] = new THREE.Vector3(xw, y, z);
    }
    pts.Cb = new THREE.Vector3(pts.Uo.x, pts.Uo.y, 0);
    const ay = archY(X[j]);
    if (ay > -Infinity) {
      const chain = ['Rb', 'Lo', 'Md', 'Sh', 'Bt'];
      let lip = null;
      for (let i = 0; i < chain.length - 1; i++) {
        const a = pts[chain[i]];
        const b = pts[chain[i + 1]];
        if (a.y <= ay && b.y >= ay) {
          const t = (ay - a.y) / Math.max(1e-6, b.y - a.y);
          lip = a.clone().lerp(b, t);
          break;
        }
      }
      if (lip) for (const id of chain.slice(0, -1)) if (pts[id].y < ay) pts[id].copy(lip);
      pts.Wt = new THREE.Vector3(pts.Uo.x, Math.max(pts.Uo.y, ay), pts.Uo.z);
    } else {
      pts.Wt = pts.Uo.clone();
    }

    const col = new Array(F);
    for (let r = 0; r < ROWS.length; r++) {
      const id = ROWS[r];
      const f0 = finalOfOrig[id];
      col[f0] = pts[id];
      if (r === ROWS.length - 1) break;
      const nid = ROWS[r + 1];
      const n = STRIP_SUBDIV[id];
      if (n <= 1) continue;
      const a = pts[id];
      const b = pts[nid];
      for (let k = 1; k < n; k++) {
        const t = k / n;
        col[f0 + k] = interpStrip(id, nid, a, b, t, pts);
      }
    }
    P.push(col);
  }

  // per-quad material & door flags
  const fLo = finalOfOrig.Lo;
  const fBt = finalOfOrig.Bt;
  const fRe = finalOfOrig.Re;
  const quadMat = [];
  const quadDoor = [];
  for (let j = 0; j < N - 1; j++) {
    const xm = (X[j] + X[j + 1]) * 0.5;
    const inArch = archY(xm) > -Infinity;
    const mats = [];
    const doors = [];
    for (let f = 0; f < F - 1; f++) {
      const s = stripOfFinal[f];
      let m = MAT.PAINT;
      switch (s) {
        case 'Cb':
          m = MAT.UNDER;
          break;
        case 'Uo':
          m = MAT.LINER;
          break;
        case 'Wt':
          m = inArch ? MAT.LINER : MAT.UNDER;
          break;
        case 'Rb':
          m = MAT.TRIM;
          break;
        case 'Bt':
          if (j >= jTip && j < jQuarter) m = j === jRear ? MAT.TRIM : MAT.GLASS;
          break;
        case 'Gl':
          if (j >= jWind && j < jRearGlass) m = MAT.GLASS;
          else if (j >= jRearGlass && j < jVent) m = MAT.TRIM;
          break;
        default:
          break;
      }
      mats.push(m);
      const isDoor = (f >= fLo && f < fBt && j >= jFront && j < jRear) || (f >= fBt && f < fRe && j >= jTip && j < jRear);
      doors.push(isDoor);
    }
    quadMat.push(mats);
    quadDoor.push(doors);
  }
  // door glass pillar: the quad behind the door rear line keeps trim; the door's
  // own last window column is glass.

  // piece keys along x (corner splits)
  const pieceKey = (j, f) => {
    const s = stripOfFinal[f];
    const a = s;
    const b = ROWS[RI[s] + 1];
    const xm = (X[j] + X[j + 1]) * 0.5;
    const pa = curves[a] ? curves[a].piece(xm) : 0;
    const pb = curves[b] ? curves[b].piece(xm) : 0;
    return pa * 31 + pb;
  };

  // quad normals (area weighted)
  const QN = [];
  for (let j = 0; j < N - 1; j++) {
    const row = [];
    for (let f = 0; f < F - 1; f++) {
      const A = P[j][f];
      const B = P[j + 1][f];
      const C = P[j + 1][f + 1];
      const D = P[j][f + 1];
      const d1 = new THREE.Vector3().subVectors(C, A);
      const d2 = new THREE.Vector3().subVectors(D, B);
      row.push(new THREE.Vector3().crossVectors(d2, d1));
    }
    QN.push(row);
  }

  const rowSmooth = (ff, j, fa, fb) => {
    // between quads (j, fa) and (j, fb) across final row ff
    const fr = finalRows[ff];
    if (!fr.orig) return true;
    const sh = ROW_SHARP[fr.orig];
    if (sh === false) return true;
    if (sh === 'mat') return quadMat[j][fa] === quadMat[j][fb];
    return false;
  };
  const colSmooth = (ja, jb, f) => quadMat[ja][f] === quadMat[jb][f] && pieceKey(ja, f) === pieceKey(jb, f);

  const tmp = new THREE.Vector3();
  const vertexNormal = (j, f, jj, ff) => {
    // normal at grid vertex (jj, ff) as seen from quad (j, f)
    const n = new THREE.Vector3().copy(QN[j][f]);
    const fo = ff === f ? f - 1 : f + 1; // vertical neighbour
    const jo = jj === j ? j - 1 : j + 1; // horizontal neighbour
    const vOk = fo >= 0 && fo < F - 1;
    const hOk = jo >= 0 && jo < N - 1;
    const vCon = vOk && rowSmooth(ff, j, f, fo);
    const hCon = hOk && colSmooth(j, jo, f);
    if (vCon) n.add(QN[j][fo]);
    if (hCon) n.add(QN[jo][f]);
    if (vOk && hOk) {
      const d1 = vCon && colSmooth(j, jo, fo);
      const d2 = hCon && rowSmooth(ff, jo, f, fo);
      if (d1 || d2) n.add(QN[jo][fo]);
    }
    const p = P[jj][ff];
    if (Math.abs(p.z) < 1e-5) n.z = 0;
    if (n.lengthSq() < 1e-14) n.set(0, 1, 0);
    return n.normalize();
  };

  // door inset (panel gap)
  const GAP = 0.0028;
  const isDoorQuad = (j, f) => j >= 0 && j < N - 1 && f >= 0 && f < F - 1 && quadDoor[j][f];
  const doorVertex = (jj, ff) => {
    const p = P[jj][ff].clone();
    const dir = new THREE.Vector3();
    let nonDoor = 0;
    for (const [qj, qf] of [[jj - 1, ff - 1], [jj, ff - 1], [jj - 1, ff], [jj, ff]]) {
      if (qj < 0 || qj >= N - 1 || qf < 0 || qf >= F - 1) continue;
      if (!quadDoor[qj][qf]) {
        const c = quadCenter(qj, qf);
        dir.add(tmp.subVectors(p, c));
        nonDoor++;
      }
    }
    if (nonDoor > 0 && dir.lengthSq() > 1e-12) p.addScaledVector(dir.normalize(), GAP);
    return p;
  };
  const quadCenter = (j, f) => new THREE.Vector3().add(P[j][f]).add(P[j + 1][f]).add(P[j + 1][f + 1]).add(P[j][f + 1]).multiplyScalar(0.25);

  // emit
  const shell = new MeshBuilder();
  const door = new MeshBuilder();
  for (let j = 0; j < N - 1; j++) {
    for (let f = 0; f < F - 1; f++) {
      if (QN[j][f].lengthSq() < 1e-12) continue;
      const m = quadMat[j][f];
      const corners = [
        [j, f],
        [j + 1, f],
        [j + 1, f + 1],
        [j, f + 1],
      ];
      const nrm = corners.map(([jj, ff]) => vertexNormal(j, f, jj, ff));
      if (quadDoor[j][f]) {
        const pos = corners.map(([jj, ff]) => doorVertex(jj, ff));
        door.quad(m, pos, nrm, false);
        if (m !== MAT.GLASS) {
          const inner = pos.map((p, i) => p.clone().addScaledVector(nrm[i], -0.055));
          door.quad(MAT.DOOR_INNER, inner, nrm.map((n) => n.clone().negate()), false, true);
        }
      } else {
        const pos = corners.map(([jj, ff]) => P[jj][ff]);
        shell.quad(m, pos, nrm, true);
      }
    }
  }

  // jambs (shell side) and door edges
  const JAMB_DEPTH = 0.075;
  for (let j = 0; j < N - 1; j++) {
    for (let f = 0; f < F - 1; f++) {
      if (!quadDoor[j][f]) continue;
      const edges = [
        { o: [j, f - 1], a: [j, f], b: [j + 1, f] },
        { o: [j, f + 1], a: [j + 1, f + 1], b: [j, f + 1] },
        { o: [j - 1, f], a: [j, f + 1], b: [j, f] },
        { o: [j + 1, f], a: [j + 1, f], b: [j + 1, f + 1] },
      ];
      for (const e of edges) {
        if (isDoorQuad(e.o[0], e.o[1])) continue;
        const pa = P[e.a[0]][e.a[1]];
        const pb = P[e.b[0]][e.b[1]];
        if (pa.distanceToSquared(pb) < 1e-10) continue;
        const na = vertexNormal(j, f, e.a[0], e.a[1]);
        const nb = vertexNormal(j, f, e.b[0], e.b[1]);
        shell.flatQuad(MAT.JAMB, [pa, pb, pb.clone().addScaledVector(nb, -JAMB_DEPTH), pa.clone().addScaledVector(na, -JAMB_DEPTH)], true);
        if (quadMat[j][f] !== MAT.GLASS) {
          const da = doorVertex(e.a[0], e.a[1]);
          const db = doorVertex(e.b[0], e.b[1]);
          door.flatQuad(MAT.DOOR_INNER, [da, db, db.clone().addScaledVector(nb, -0.055), da.clone().addScaledVector(na, -0.055)], false);
        }
      }
    }
  }

  // caps
  const frontSection = P[0];
  const rearSection = P[N - 1];
  addCap(shell, frontSection, 1, (y) => (y < frontSection[fLo].y + 1e-4 ? MAT.TRIM : MAT.PAINT), frontSection[fLo].y);
  addCap(shell, rearSection, -1, (y) => (y < 0.56 ? MAT.TRIM : MAT.PAINT), 0.56);

  // door pivot reference points
  const doorInfo = {
    front: P[jFront][fBt].clone(),
    tip: P[jTip][fBt].clone(),
    rearTop: P[jRear][fRe].clone(),
    rearBottom: P[jRear][fLo].clone(),
    frontBottom: P[jFront][fLo].clone(),
  };

  return {
    shell: shell.build(true),
    door: door.build(false),
    doorInfo,
    X,
    P,
    finalOfOrig,
    curves,
    section: (x) => sectionAt(curves, x),
    flank: (x, y) => flankPoint(curves, x, y),
  };
}

// Exact point (and outward normal) on the flank surface at station x, height y.
function flankPoint(curves, x, y) {
  const s = sectionAt(curves, x);
  const seq = [];
  for (const [id, nid] of [['Rb', 'Lo'], ['Lo', 'Md'], ['Md', 'Sh'], ['Sh', 'Bt']]) {
    for (let k = 0; k <= 24; k++) seq.push(interpStrip(id, nid, s[id], s[nid], k / 24, s));
  }
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i];
    const b = seq[i + 1];
    if ((a.y - y) * (b.y - y) <= 0 && Math.abs(b.y - a.y) > 1e-7) {
      const t = (y - a.y) / (b.y - a.y);
      const p = a.clone().lerp(b, t);
      const n = new THREE.Vector3(0, -(b.z - a.z), b.y - a.y).normalize();
      return { p, n };
    }
  }
  return { p: s.Md.clone(), n: new THREE.Vector3(0, 0, 1) };
}

function interpStrip(id, nid, a, b, t, pts) {
  if (id === 'Gl') {
    // crowned canopy / hood: quadratic with horizontal tangent at the centre line
    const c = new THREE.Vector3((a.x + b.x) * 0.5, b.y, a.z * 0.5);
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      u * u * a.y + 2 * u * t * c.y + t * t * b.y,
      u * u * a.z + 2 * u * t * c.z + t * t * b.z,
    );
  }
  if (id === 'Lo' || id === 'Md') {
    // Hermite through the soft Md row
    const L = a.distanceTo(b);
    if (L < 1e-6) return a.clone();
    const chord = new THREE.Vector3().subVectors(b, a).normalize();
    const softT = new THREE.Vector3().subVectors(pts.Sh, pts.Lo);
    if (softT.lengthSq() < 1e-10) softT.copy(chord);
    softT.normalize();
    const m0 = id === 'Md' ? softT.clone() : chord.clone();
    const m1 = id === 'Lo' ? softT.clone() : chord.clone();
    m0.multiplyScalar(L);
    m1.multiplyScalar(L);
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return new THREE.Vector3()
      .addScaledVector(a, h00)
      .addScaledVector(m0, h10)
      .addScaledVector(b, h01)
      .addScaledVector(m1, h11);
  }
  return a.clone().lerp(b, t);
}

function addCap(builder, section, dir, matFn, splitY) {
  // section: right half from centre-bottom to centre-top
  const half = section.map((p) => new THREE.Vector2(p.z, p.y));
  const full = [];
  for (const p of half) full.push(p.clone());
  for (let i = half.length - 1; i >= 0; i--) {
    if (Math.abs(half[i].x) < 1e-6) continue;
    full.push(new THREE.Vector2(-half[i].x, half[i].y));
  }
  const clean = dedupe(full);
  const x = section[0].x;
  const below = clipPoly(clean, splitY, false);
  const above = clipPoly(clean, splitY, true);
  for (const poly of [below, above]) {
    if (poly.length < 3) continue;
    const m = matFn(poly.reduce((s, p) => s + p.y, 0) / poly.length);
    const tris = THREE.ShapeUtils.triangulateShape(poly, []);
    const n = new THREE.Vector3(dir, 0, 0);
    for (const t of tris) {
      const v = t.map((i) => new THREE.Vector3(x, poly[i].y, poly[i].x));
      builder.tri(m, v, [n, n, n], n);
    }
  }
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (l && l.distanceToSquared(p) < 1e-10) continue;
    out.push(p);
  }
  if (out.length > 1 && out[0].distanceToSquared(out[out.length - 1]) < 1e-10) out.pop();
  return out;
}

function clipPoly(pts, yCut, keepAbove) {
  const inside = (p) => (keepAbove ? p.y >= yCut : p.y <= yCut);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a.clone());
    if (ia !== ib) {
      const t = (yCut - a.y) / (b.y - a.y);
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, yCut));
    }
  }
  return dedupe(out);
}

export function sectionAt(curves, x) {
  const o = {};
  for (const id of DATA_ROWS) {
    const [z, y] = curves[id].eval(x);
    o[id] = new THREE.Vector3(x, y, z);
  }
  return o;
}

// ---------------------------------------------------------------------------
class MeshBuilder {
  constructor() {
    this.groups = new Map();
  }
  g(m) {
    if (!this.groups.has(m)) this.groups.set(m, { pos: [], nrm: [] });
    return this.groups.get(m);
  }
  pushV(g, p, n) {
    g.pos.push(p.x, p.y, p.z);
    g.nrm.push(n.x, n.y, n.z);
  }
  // grid quad A B C D on the right side; default winding faces outwards
  quad(m, pos, nrm, mirror, reverse = false) {
    const g = this.g(m);
    const [A, B, C, D] = pos;
    const [nA, nB, nC, nD] = nrm;
    if (!reverse) {
      this.pushV(g, A, nA);
      this.pushV(g, C, nC);
      this.pushV(g, B, nB);
      this.pushV(g, A, nA);
      this.pushV(g, D, nD);
      this.pushV(g, C, nC);
    } else {
      this.pushV(g, A, nA);
      this.pushV(g, B, nB);
      this.pushV(g, C, nC);
      this.pushV(g, A, nA);
      this.pushV(g, C, nC);
      this.pushV(g, D, nD);
    }
    if (mirror) this.mirrorLast(g, 6);
  }
  flatQuad(m, pos, mirror) {
    const [A, B, C, D] = pos;
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, A));
    if (n.lengthSq() < 1e-14) return;
    n.normalize();
    const g = this.g(m);
    for (const p of [A, B, C, A, C, D]) this.pushV(g, p, n);
    if (mirror) this.mirrorLast(g, 6);
  }
  tri(m, v, n, faceN) {
    const g = this.g(m);
    const e1 = new THREE.Vector3().subVectors(v[1], v[0]);
    const e2 = new THREE.Vector3().subVectors(v[2], v[0]);
    const fn = new THREE.Vector3().crossVectors(e1, e2);
    const order = fn.dot(faceN) >= 0 ? [0, 1, 2] : [0, 2, 1];
    for (const i of order) this.pushV(g, v[i], n[i]);
  }
  mirrorLast(g, count) {
    const start = g.pos.length - count * 3;
    const tri = [];
    for (let i = start; i < start + count * 3; i += 3) tri.push([g.pos[i], g.pos[i + 1], g.pos[i + 2], g.nrm[i], g.nrm[i + 1], g.nrm[i + 2]]);
    for (let t = 0; t < tri.length; t += 3) {
      for (const k of [0, 2, 1]) {
        const v = tri[t + k];
        g.pos.push(v[0], v[1], -v[2]);
        g.nrm.push(v[3], v[4], -v[5]);
      }
    }
  }
  build() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const nrm = [];
    let start = 0;
    const keys = [...this.groups.keys()].sort((a, b) => a - b);
    for (const k of keys) {
      const g = this.groups.get(k);
      pos.push(...g.pos);
      nrm.push(...g.nrm);
      const count = g.pos.length / 3;
      geo.addGroup(start, count, k);
      start += count;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const uv = [];
    for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 0.25, pos[i + 1] * 0.25 + pos[i + 2] * 0.25);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }
}
