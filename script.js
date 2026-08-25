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

const desktopContent = {
  about: { title: 'ABOUT_ME.TXT', art: ':)', heading: 'HI, I\'M KOYAK', copy: 'I make colorful digital things, experiments, and tiny worlds for the web.' },
  projects: { title: 'PROJECTS.EXE', art: '★', heading: 'MY PROJECTS', copy: 'New work is loading. Check back soon—or visit my GitHub from the profile bar above.' },
  contact: { title: 'CONTACT.MSG', art: '@', heading: 'SAY HELLO', copy: 'The quickest way to reach me is through one of the profile links above.' }
};

const retroScreen = document.querySelector('.retro-screen');
const taskList = document.querySelector('.task-list');
let windowLayer = 3;

function focusWindow(windowElement) {
  windowLayer += 1;
  windowElement.style.zIndex = windowLayer;
  document.querySelectorAll('.retro-window').forEach((item) => item.classList.toggle('is-active', item === windowElement));
  taskList.querySelectorAll('.task-item').forEach((item) => item.classList.toggle('is-active', item.dataset.windowId === windowElement.dataset.windowId));
}

function addTaskbarItem(windowElement) {
  const taskItem = document.createElement('button');
  taskItem.className = 'task-item';
  taskItem.type = 'button';
  taskItem.dataset.windowId = windowElement.dataset.windowId;
  taskItem.textContent = windowElement.querySelector('.window-title').textContent;
  taskItem.setAttribute('aria-label', `Focus ${taskItem.textContent}`);
  taskItem.addEventListener('click', () => focusWindow(windowElement));
  taskList.append(taskItem);
}

function enableDesktopWindow(windowElement) {
  const titlebar = windowElement.querySelector('.window-titlebar');
  const closeButton = windowElement.querySelector('.window-close');

  windowElement.style.left = `${Math.max(0, Math.min(retroScreen.clientWidth - windowElement.offsetWidth, windowElement.offsetLeft))}px`;
  windowElement.style.top = `${Math.max(0, Math.min(retroScreen.clientHeight - 38 - windowElement.offsetHeight, windowElement.offsetTop))}px`;

  addTaskbarItem(windowElement);
  closeButton.addEventListener('click', () => {
    taskList.querySelector(`[data-window-id="${windowElement.dataset.windowId}"]`)?.remove();
    windowElement.remove();
    const topWindow = Array.from(retroScreen.querySelectorAll('.retro-window')).sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0))[0];
    if (topWindow) focusWindow(topWindow);
  });
  windowElement.addEventListener('pointerdown', () => focusWindow(windowElement));
  titlebar.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.window-controls')) return;
    event.preventDefault();
    focusWindow(windowElement);
    titlebar.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = windowElement.offsetLeft;
    const startTop = windowElement.offsetTop;

    const moveWindow = (moveEvent) => {
      const maxLeft = retroScreen.clientWidth - windowElement.offsetWidth;
      const maxTop = retroScreen.clientHeight - 38 - windowElement.offsetHeight;
      windowElement.style.left = `${Math.max(0, Math.min(maxLeft, startLeft + moveEvent.clientX - startX))}px`;
      windowElement.style.top = `${Math.max(0, Math.min(maxTop, startTop + moveEvent.clientY - startY))}px`;
    };
    titlebar.addEventListener('pointermove', moveWindow);
    const stopMoving = () => titlebar.removeEventListener('pointermove', moveWindow);
    titlebar.addEventListener('pointerup', stopMoving, { once: true });
    titlebar.addEventListener('pointercancel', stopMoving, { once: true });
  });
}

document.querySelectorAll('.retro-window').forEach((windowElement) => {
  enableDesktopWindow(windowElement);
  focusWindow(windowElement);
});

document.querySelectorAll('.desktop-icon').forEach((icon) => {
  icon.addEventListener('click', () => {
    document.querySelectorAll('.desktop-icon').forEach((item) => item.classList.remove('is-selected'));
    icon.classList.add('is-selected');
    const content = desktopContent[icon.dataset.window];
    if (!content) return;
    const existingWindow = retroScreen.querySelector(`[data-window-id="${icon.dataset.window}"]`);
    if (existingWindow) {
      focusWindow(existingWindow);
      return;
    }
    const windowElement = document.createElement('div');
    const offset = retroScreen.querySelectorAll('.retro-window').length * 24;
    windowElement.className = 'retro-window';
    windowElement.dataset.windowId = icon.dataset.window;
    windowElement.setAttribute('role', 'region');
    windowElement.style.left = `${Math.min(retroScreen.clientWidth - 320, 150 + offset)}px`;
    windowElement.style.top = `${Math.min(245, 70 + offset)}px`;
    windowElement.innerHTML = `<div class="window-titlebar"><span class="window-title">${content.title}</span><span class="window-controls"><i aria-hidden="true">_</i><i aria-hidden="true">□</i><button class="window-close" type="button" aria-label="Close window">×</button></span></div><div class="window-body"><span class="window-art" aria-hidden="true">${content.art}</span><div><h2>${content.heading}</h2><p>${content.copy}</p></div></div>`;
    retroScreen.append(windowElement);
    enableDesktopWindow(windowElement);
    focusWindow(windowElement);
  });
});

const canvas = document.querySelector('.plasma');
const ctx = canvas.getContext('2d', { alpha: false });
let width = 0;
let height = 0;
let last = performance.now();
let lastFrame = 0;
let flow = 4.6;
let phase = 0;
let cellSize = 28;
let columns = 0;
let rows = 0;
let verticalOverscan = 0;
let scrollingUntil = 0;
let frameRequest = 0;
let targetFps = 30;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function hash(x, y) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const top = hash(ix, iy) * (1 - ux) + hash(ix + 1, iy) * ux;
  const bottom = hash(ix, iy + 1) * (1 - ux) + hash(ix + 1, iy + 1) * ux;
  return top * (1 - uy) + bottom * uy;
}

function fbm(x, y) {
  let value = 0;
  let amplitude = .56;
  for (let octave = 0; octave < 3; octave++) {
    value += noise(x, y) * amplitude;
    x = x * 2.03 + 19.1;
    y = y * 2.03 - 7.7;
    amplitude *= .48;
  }
  return value;
}

function resize() {
  width = innerWidth;
  // Mobile browser chrome changes the visual viewport while scrolling. Render
  // well beyond both vertical edges so newly revealed space is already filled.
  verticalOverscan = Math.max(140, Math.round(innerHeight * .18));
  height = innerHeight + verticalOverscan * 2;
  // The geometry is deliberately pixel-snapped, so extra device pixels add
  // substantial work without improving the intended visual style.
  const ratio = 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.top = `${-verticalOverscan}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  // Phones need fewer cells, not smaller ones: the canvas remains pixelated
  // while using a fraction of the CPU/GPU work in embedded previews.
  cellSize = width <= 520 ? 22 : width <= 900 ? 19 : 17;
  targetFps = width <= 520 ? 15 : width <= 900 ? 24 : 30;
  columns = Math.ceil(width / cellSize) + 8;
  rows = Math.ceil(height / cellSize) + 8;
}

function vertex(column, row, time) {
  const baseX = (column - 4) * cellSize;
  const baseY = (row - 4) * cellSize;
  const nx = column * .115;
  const ny = row * .115;

  // A slow terrain field supplies depth; a second field twists the shared
  // corners so adjacent pixels stretch together without opening seams.
  const terrain = fbm(nx + time * .07, ny - time * .045);
  const ridge = Math.abs(fbm(nx * 1.7 - time * .055, ny * 1.7 + time * .04) - .5);
  const depth = (terrain - .48) * 2.2 - ridge * .42;
  const warpX = (fbm(nx * 2.8 + 41 + time * .1, ny * 2.8) - .5) * cellSize * .9;
  const warpY = (fbm(nx * 2.8, ny * 2.8 - 53 - time * .08) - .5) * cellSize * .9;
  const perspective = 1 + depth * .06;

  return {
    x: width * .5 + (baseX - width * .5) * perspective + warpX,
    y: height * .5 + (baseY - height * .5) * perspective + warpY - depth * cellSize * 1.15,
    depth,
    terrain
  };
}

function colorFor(p0, p1, p2, p3, x, y, time) {
  const depth = (p0.depth + p1.depth + p2.depth + p3.depth) * .25;
  const terrain = (p0.terrain + p1.terrain + p2.terrain + p3.terrain) * .25;
  const colorValley = noise(x * .19 + time * .075, y * .19 - time * .055);
  const fineValleys = noise(x * .34 - time * .045 + 73, y * .34 + time * .06 - 28);
  const colorField = colorValley + fineValleys * .5 + terrain * .32;
  const contour = Math.floor(colorField * 15) / 15;
  const hue = (contour * 510 + x * 4.7 - y * 2.3 + time * 16 + 360) % 360;
  const sparkle = Math.pow(Math.max(0, fineValleys - .56) / .44, 1.4);
  const light = Math.max(13, Math.min(72, 25 + depth * 17 + colorValley * 18 + sparkle * 24));
  const saturation = Math.max(88, Math.min(100, 96 + depth * 3));
  return `hsl(${hue} ${saturation}% ${light}%)`;
}

function pixelSnap(value) {
  return Math.round(value / 2) * 2;
}

function draw(now) {
  const frameInterval = now < scrollingUntil ? Math.max(50, 1000 / targetFps) : 1000 / targetFps;
  if (now - lastFrame < frameInterval) {
    frameRequest = requestAnimationFrame(draw);
    return;
  }
  lastFrame = now;
  const delta = Math.min((now - last) / 1000, .05);
  last = now;

  // Smoothly lerp from an energetic entrance to a slow, ambient drift.
  const targetSpeed = .72;
  flow += (targetSpeed - flow) * (1 - Math.exp(-delta * .48));
  phase += delta * flow;

  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, width, height);

  const vertices = Array.from({ length: rows + 1 }, (_, y) =>
    Array.from({ length: columns + 1 }, (_, x) => vertex(x, y, phase))
  );

  ctx.setLineDash([4, 2]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(1, 3, 8, .38)';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const p0 = vertices[y][x];
      const p1 = vertices[y][x + 1];
      const p2 = vertices[y + 1][x + 1];
      const p3 = vertices[y + 1][x];
      ctx.beginPath();
      ctx.moveTo(pixelSnap(p0.x), pixelSnap(p0.y));
      ctx.lineTo(pixelSnap(p1.x), pixelSnap(p1.y));
      ctx.lineTo(pixelSnap(p2.x), pixelSnap(p2.y));
      ctx.lineTo(pixelSnap(p3.x), pixelSnap(p3.y));
      ctx.closePath();
      ctx.fillStyle = colorFor(p0, p1, p2, p3, x, y, phase);
      ctx.fill();

      // One snapped, dashed pass keeps the pixel-art seam at half the former
      // draw-call cost. Depth is already carried by the fill luminance.
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  if (!reducedMotion.matches && !document.hidden) frameRequest = requestAnimationFrame(draw);
}

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
}, { passive: true });
addEventListener('scroll', () => { scrollingUntil = performance.now() + 140; }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameRequest);
  } else if (!reducedMotion.matches) {
    last = performance.now();
    frameRequest = requestAnimationFrame(draw);
  }
});
resize();
frameRequest = requestAnimationFrame(draw);
