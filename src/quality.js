// Phones get a lighter render: lower resolution cap, 2x MSAA and smaller shadow maps.
// Tablets and touch laptops keep the full settings.
const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

export const MOBILE = coarse && Math.min(screen.width, screen.height) < 820;

export const QUALITY = {
  maxPixelRatio: MOBILE ? 1.5 : 2,
  samples: MOBILE ? 2 : 4,
  shadowSize: MOBILE ? 1024 : 2048,
};
