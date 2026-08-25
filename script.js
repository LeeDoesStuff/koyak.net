function fillRailLoops() {
  const viewportHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
    window.screen?.height || 0
  );

  document.querySelectorAll('.side-rail').forEach((rail) => {
    const loops = rail.querySelectorAll('.rail-loop');
    const firstLoop = loops[0];
    if (!firstLoop || loops.length < 2) return;

    const word = firstLoop.querySelector('span');
    if (!word) return;

    // Each half of the track must cover the screen so the loop is full from
    // its very first frame, including on tall displays.
    while (firstLoop.scrollHeight < viewportHeight + 40) {
      firstLoop.append(word.cloneNode(true));
    }

    loops[1].replaceChildren(...Array.from(firstLoop.children, (item) => item.cloneNode(true)));
  });
}

fillRailLoops();

document.querySelectorAll('.social-links a').forEach((link) => {
  link.addEventListener('pointerup', () => link.blur());
});

const canvas = document.querySelector('.plasma');
const ctx = canvas.getContext('2d', { alpha: false });
let width = 0;
let height = 0;
let start = performance.now();
let last = start;
let flow = 3.2;
let phase = 0;

function resize() {
  // One canvas pixel becomes a visible block when CSS scales the mist up.
  // Keeping this in CSS pixels makes the effect consistent across displays.
  const pixelSize = innerWidth <= 520 ? 7 : 10;
  width = innerWidth;
  height = innerHeight;
  canvas.width = Math.max(1, Math.ceil(width / pixelSize));
  canvas.height = Math.max(1, Math.ceil(height / pixelSize));
}

function draw(now) {
  const elapsed = (now - start) / 1000;
  const delta = Math.min((now - last) / 1000, .05);
  last = now;

  // Smoothly lerp from an energetic entrance to a slow, ambient drift.
  const targetSpeed = .28;
  flow += (targetSpeed - flow) * (1 - Math.exp(-delta * .48));
  phase += delta * flow;

  const w = canvas.width;
  const h = canvas.height;
  const image = ctx.createImageData(w, h);
  const data = image.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const ny = y / h;
      const fold = Math.sin(nx * 19 + phase * 2.1 + Math.sin(ny * 8 - phase));
      const curl = Math.cos(ny * 15 - phase * 1.3 + Math.sin(nx * 12 + phase) * 2);
      const wave = Math.sin((nx + ny) * 12 + fold * 2 + curl + phase);
      const rawHue = ((wave * 48 + nx * 250 - ny * 110 + phase * 38) % 360 + 360) % 360;
      const hue = Math.round(rawHue / 12) * 12;
      const light = Math.round((30 + 15 * Math.sin(fold + curl + phase * .5)) / 4) * 4;
      const chroma = 1 - Math.abs(((hue / 60) % 2) - 1);
      const m = light / 100 - (.82 * light / 100) / 2;
      const c = .82 * light / 100;
      let r = 0, g = 0, b = 0;
      if (hue < 60) [r,g,b]=[c,c*chroma,0]; else if(hue<120) [r,g,b]=[c*chroma,c,0]; else if(hue<180) [r,g,b]=[0,c,c*chroma]; else if(hue<240) [r,g,b]=[0,c*chroma,c]; else if(hue<300) [r,g,b]=[c*chroma,0,c]; else [r,g,b]=[c,0,c*chroma];
      const i = (y * w + x) * 4;
      data[i] = (r + m) * 255; data[i+1] = (g + m) * 255; data[i+2] = (b + m) * 255; data[i+3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(draw);
}

addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(draw);
