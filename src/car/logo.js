// Tesla "T" emblem as a canvas path, drawn inside a size x size box at (x, y).
export function drawTeslaT(g, x, y, size) {
  g.save();
  g.translate(x, y);
  g.scale(size / 100, size / 100);
  g.beginPath();
  // thin arc above the T
  g.moveTo(6, 17);
  g.quadraticCurveTo(50, 1, 94, 17);
  g.quadraticCurveTo(50, 8, 6, 17);
  g.closePath();
  // crossbar curving into the stem
  g.moveTo(4, 24);
  g.quadraticCurveTo(50, 9, 96, 24);
  g.lineTo(86, 32);
  g.quadraticCurveTo(68, 25, 57, 30);
  g.lineTo(51.5, 96);
  g.lineTo(48.5, 96);
  g.lineTo(43, 30);
  g.quadraticCurveTo(32, 25, 14, 32);
  g.closePath();
  g.fill();
  g.restore();
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
