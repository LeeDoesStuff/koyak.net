function fillRailLoops() {
  // The rails are hidden by CSS on small screens. Measuring a display:none
  // element always returns 0, so do not enter the fill loop in that state.
  if (!matchMedia('(min-width: 521px)').matches) return;

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
    // Keep a hard cap as a final safeguard for embedded previews that report
    // incomplete layout measurements while the page is starting up.
    let additions = 0;
    while (firstLoop.scrollHeight < viewportHeight + 40 && additions < 64) {
      firstLoop.append(word.cloneNode(true));
      additions += 1;
    }

    loops[1].replaceChildren(...Array.from(firstLoop.children, (item) => item.cloneNode(true)));
  });
}

fillRailLoops();

document.querySelectorAll('.social-links a').forEach((link) => {
  link.addEventListener('pointerup', () => link.blur());
});

// Measures the display's real frame rate, not any one animation's: it counts
// its own rAF callbacks, which the browser delivers once per composited frame.
const fpsMeter = document.querySelector('.fps-meter');
let fpsFrames = 0;
let fpsSince = performance.now();

function trackFps(now) {
  requestAnimationFrame(trackFps);
  fpsFrames += 1;
  const elapsed = now - fpsSince;
  if (elapsed < 500) return;
  // A backgrounded tab stops firing rAF, so the first sample on return would
  // otherwise report a frame rate averaged over the whole time away.
  if (elapsed < 2000) {
    const rate = Math.round(fpsFrames * 1000 / elapsed);
    fpsMeter.textContent = `${rate} FPS`;
    // The plasma's own guard only sees how long its JS took, so a machine
    // that is held up compositing rather than calculating would stutter
    // without ever tripping it. This watches what the display actually
    // delivers and steps the background's rate down until the game is
    // smooth again - it only ever gives frames back to the flight sim.
    if (plasmaBoost && rate > 0) {
      if (rate < 28) targetFps = Math.min(targetFps, 24);
      else if (rate < 50) targetFps = Math.min(targetFps, 30);
    }
    // Rasterising and uploading a full-viewport canvas is the plasma's real
    // cost, and it is the one thing still running on every screen here. Trade
    // resolution for frames when the display is not keeping up, and give it
    // back once it comfortably is. Requiring several samples in a row keeps a
    // single hitch from permanently dropping quality.
    if (rate > 0) {
      slowSamples = rate < 45 ? slowSamples + 1 : 0;
      fastSamples = rate > 55 ? fastSamples + 1 : 0;
      if (slowSamples >= 3 && renderScale > .5) {
        renderScale = Math.max(.5, renderScale - .25);
        slowSamples = 0;
        resize();
      } else if (fastSamples >= 30 && renderScale < 1) {
        renderScale = Math.min(1, renderScale + .25);
        fastSamples = 0;
        resize();
      }
    }
  }
  fpsFrames = 0;
  fpsSince = now;
}

if (fpsMeter) requestAnimationFrame(trackFps);

const taskClock = document.querySelector('.task-clock');
const clockFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit'
});

function updateTaskClock() {
  if (!taskClock) return;

  const now = new Date();
  taskClock.textContent = clockFormatter.format(now);
  taskClock.dateTime = now.toISOString();
}

function scheduleClockUpdate() {
  updateTaskClock();
  setTimeout(scheduleClockUpdate, 60000 - (Date.now() % 60000));
}

scheduleClockUpdate();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateTaskClock();
});

const desktopContent = {
  about: { title: 'ABOUT_ME.TXT', art: ':)', heading: 'ABOUT ME', copy: 'I\'m KOYAK. I make games, I program, I love to create.' },
  projects: { title: 'PROJECTS.EXE', type: 'projects' },
  contact: { title: 'NEW_MESSAGE.MSG', type: 'contact' },
  minesweeper: { title: 'MINESWEEPER.EXE', type: 'minesweeper' },
  tetris: { title: 'TETRIS.EXE', type: 'tetris' },
  flight: { title: 'FLIGHT_SIM.EXE', type: 'flight' }
};

const githubUsername = 'Kayyo321';

function createProjectStatus(message, className = '') {
  const status = document.createElement('p');
  status.className = `projects-status ${className}`.trim();
  status.textContent = message;
  return status;
}

function createRepositoryCard(repository) {
  const link = document.createElement('a');
  link.className = 'repo-card';
  link.href = repository.html_url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Open ${repository.name} on GitHub`);

  const header = document.createElement('span');
  header.className = 'repo-card__header';
  const name = document.createElement('strong');
  name.textContent = repository.name;
  const stars = document.createElement('span');
  stars.className = 'repo-stars';
  stars.textContent = `★ ${repository.stargazers_count}`;
  header.append(name, stars);

  const description = document.createElement('span');
  description.className = 'repo-description';
  description.textContent = repository.description || 'No description provided.';

  const metadata = document.createElement('span');
  metadata.className = 'repo-meta';
  if (repository.language) {
    const language = document.createElement('span');
    language.textContent = repository.language;
    metadata.append(language);
  }
  const forks = document.createElement('span');
  forks.textContent = `⑂ ${repository.forks_count}`;
  metadata.append(forks);

  link.append(header, description, metadata);
  return link;
}

async function loadProjects(windowElement) {
  const projectList = windowElement.querySelector('.projects-list');
  if (!projectList) return;

  try {
    const repositories = [];
    let page = 1;
    let pageResults = [];

    do {
      const response = await fetch(`https://api.github.com/users/${githubUsername}/repos?type=owner&per_page=100&page=${page}`);
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      pageResults = await response.json();
      repositories.push(...pageResults);
      page += 1;
    } while (pageResults.length === 100);

    repositories.sort((a, b) =>
      b.stargazers_count - a.stargazers_count ||
      new Date(b.updated_at) - new Date(a.updated_at) ||
      a.name.localeCompare(b.name)
    );

    projectList.replaceChildren();
    if (!repositories.length) {
      projectList.append(createProjectStatus('No public repositories found.'));
      return;
    }

    projectList.append(...repositories.map(createRepositoryCard));
    windowElement.querySelector('.projects-count').textContent = `${repositories.length} public ${repositories.length === 1 ? 'repository' : 'repositories'} · sorted by stars`;
  } catch (error) {
    projectList.replaceChildren(
      createProjectStatus('Could not load repositories right now.', 'projects-status--error')
    );
    const profileLink = document.createElement('a');
    profileLink.href = `https://github.com/${githubUsername}?tab=repositories`;
    profileLink.target = '_blank';
    profileLink.rel = 'noopener noreferrer';
    profileLink.textContent = 'View all repositories on GitHub →';
    projectList.append(profileLink);
  }
}

const retroScreen = document.querySelector('.retro-screen');
const taskList = document.querySelector('.task-list');
let windowLayer = 3;

function focusWindow(windowElement) {
  windowLayer += 1;
  windowElement.style.zIndex = windowLayer;
  document.querySelectorAll('.retro-window').forEach((item) => item.classList.toggle('is-active', item === windowElement));
  taskList.querySelectorAll('.task-item').forEach((item) => item.classList.toggle('is-active', item.dataset.windowId === windowElement.dataset.windowId));
}

function centerWindow(windowElement) {
  const usableHeight = retroScreen.clientHeight - 38;
  windowElement.style.left = `${Math.max(0, (retroScreen.clientWidth - windowElement.offsetWidth) / 2)}px`;
  windowElement.style.top = `${Math.max(0, (usableHeight - windowElement.offsetHeight) / 2)}px`;
}

function createWindowBody(content) {
  if (content.type === 'contact') {
    const body = document.createElement('div');
    body.className = 'window-body window-body--contact';
    body.innerHTML = `<form class="contact-form"><label for="contact-from">FROM</label><input id="contact-from" name="email" type="email" autocomplete="email" required placeholder="you@example.com"><label for="contact-subject">SUBJECT</label><input id="contact-subject" name="_subject" type="text" maxlength="120" required placeholder="What is this about?"><label for="contact-body">BODY</label><textarea id="contact-body" name="message" rows="6" maxlength="5000" required placeholder="Write your message here..."></textarea><input class="contact-trap" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"><input type="hidden" name="_template" value="table"><input type="hidden" name="_url" value="https://koyak.net"><div class="contact-actions"><span class="contact-status" role="status" aria-live="polite"></span><button class="contact-send" type="submit">SEND</button></div></form>`;
    return body;
  }

  if (content.type === 'minesweeper') {
    const body = document.createElement('div');
    body.className = 'window-body window-body--minesweeper';
    body.innerHTML = `<div class="mine-toolbar"><span class="mine-counter" aria-label="Mines remaining">010</span><button class="mine-reset" type="button" aria-label="Start a new game">🙂</button><span class="mine-timer" aria-label="Elapsed time">000</span></div><div class="mine-actions"><button class="mine-flag-mode" type="button" aria-pressed="false">🚩 FLAG: OFF</button><span>9×9 · 10 MINES</span></div><div class="mine-grid" role="grid" aria-label="Minesweeper board"></div><p class="mine-help">Click to clear · right-click or use flag mode to mark</p><div class="mine-secret" role="status"><strong>★ SECRET MODE UNLOCKED ★</strong><span class="mine-secret-note">Tetris has appeared on your desktop!</span></div>`;
    return body;
  }

  if (content.type === 'tetris') {
    const body = document.createElement('div');
    body.className = 'window-body window-body--tetris';
    body.innerHTML = `<div class="tetris-game"><canvas class="tetris-board" width="200" height="400" tabindex="0" role="img" aria-label="Tetris game board"></canvas><aside class="tetris-panel"><span class="tetris-label">SCORE</span><strong class="tetris-score">000000</strong><span class="tetris-label">LINES</span><strong class="tetris-lines">000</strong><span class="tetris-label">LEVEL</span><strong class="tetris-level">01</strong><span class="tetris-label">NEXT</span><canvas class="tetris-next" width="80" height="80" aria-label="Next piece"></canvas><button class="tetris-new" type="button">NEW GAME</button></aside></div><div class="tetris-controls" aria-label="Tetris controls"><button type="button" data-tetris-action="left" aria-label="Move left">◀</button><button type="button" data-tetris-action="rotate" aria-label="Rotate">↻</button><button type="button" data-tetris-action="right" aria-label="Move right">▶</button><button type="button" data-tetris-action="down" aria-label="Move down">▼</button><button type="button" data-tetris-action="drop" aria-label="Hard drop">DROP</button></div><p class="tetris-help">ARROWS MOVE · ↑ ROTATES · SPACE DROPS</p>`;
    return body;
  }

  if (content.type === 'projects') {
    const body = document.createElement('div');
    body.className = 'window-body window-body--projects';
    body.innerHTML = `<div class="projects-heading"><div><h2>MY REPOSITORIES</h2><p class="projects-count">Connecting to GitHub…</p></div><a href="https://github.com/${githubUsername}?tab=repositories" target="_blank" rel="noopener noreferrer">GITHUB ↗</a></div><div class="projects-list" aria-live="polite"></div>`;
    body.querySelector('.projects-list').append(createProjectStatus('Loading repositories…'));
    return body;
  }

  const body = document.createElement('div');
  body.className = 'window-body';
  body.innerHTML = `<span class="window-art" aria-hidden="true">${content.art}</span><div><h2>${content.heading}</h2><p>${content.copy}</p></div>`;
  return body;
}

function showContactConfirmation(contactWindow) {
  const existingPopup = retroScreen.querySelector('[data-window-id="message-sent"]');
  if (existingPopup) existingPopup.querySelector('.window-close').click();

  const popup = document.createElement('div');
  popup.className = 'retro-window retro-window--confirmation';
  popup.dataset.windowId = 'message-sent';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-labelledby', 'message-sent-title');
  popup.innerHTML = `<div class="window-titlebar"><span class="window-title" id="message-sent-title">MESSAGE SENT</span><span class="window-controls"><button class="window-close" type="button" aria-label="Close confirmation">×</button></span></div><div class="window-body window-body--confirmation"><span class="confirmation-icon" aria-hidden="true">✓</span><div><h2>MESSAGE SENT!</h2><p>Thanks for reaching out. Your message is on its way.</p><button class="confirmation-ok" type="button">OK</button></div></div>`;
  retroScreen.append(popup);
  centerWindow(popup);
  enableDesktopWindow(popup);
  focusWindow(popup);

  const closePopup = () => popup.querySelector('.window-close').click();
  popup.querySelector('.confirmation-ok').addEventListener('click', closePopup);
  popup.querySelector('.window-close').focus();
  popup.cleanup = () => contactWindow.querySelector('#contact-from')?.focus();
}

function startContactForm(windowElement) {
  const form = windowElement.querySelector('.contact-form');
  const sendButton = form.querySelector('.contact-send');
  const status = form.querySelector('.contact-status');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    sendButton.disabled = true;
    sendButton.textContent = 'SENDING...';
    status.textContent = '';

    try {
      const response = await fetch('https://formsubmit.co/ajax/c42d371e5f8bd75a0d70b9650bb87234', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(new FormData(form))
      });
      const result = await response.json();
      if (!response.ok || result.success === false || result.success === 'false') {
        throw new Error(result.message || `Mail service returned ${response.status}`);
      }

      form.reset();
      showContactConfirmation(windowElement);
    } catch (error) {
      const isPreview = !/(^|\.)koyak\.net$/i.test(location.hostname);
      status.textContent = isPreview
        ? 'LIVE PREVIEW BLOCKED SEND. TEST ON KOYAK.NET.'
        : 'COULD NOT SEND. PLEASE TRY AGAIN.';
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = 'SEND';
    }
  });
}

function startMinesweeper(windowElement) {
  const rows = 9;
  const columns = 9;
  const mineTotal = 10;
  const board = windowElement.querySelector('.mine-grid');
  const mineCounter = windowElement.querySelector('.mine-counter');
  const timer = windowElement.querySelector('.mine-timer');
  const reset = windowElement.querySelector('.mine-reset');
  const flagModeButton = windowElement.querySelector('.mine-flag-mode');
  const secret = windowElement.querySelector('.mine-secret');
  let cells = [];
  let started = false;
  let finished = false;
  let flagMode = false;
  let seconds = 0;
  let timerId = 0;

  // Window removal does not stop timers automatically. Give the desktop
  // window lifecycle an explicit way to release this game's interval.
  windowElement.cleanup = () => clearInterval(timerId);

  const neighbors = (index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const result = [];
    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
        if (!rowStep && !columnStep) continue;
        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns) result.push(nextRow * columns + nextColumn);
      }
    }
    return result;
  };

  const updateCounter = () => {
    const flags = cells.filter((cell) => cell.flagged).length;
    mineCounter.textContent = String(Math.max(0, mineTotal - flags)).padStart(3, '0');
  };

  const placeMines = (safeIndex) => {
    const forbidden = new Set([safeIndex, ...neighbors(safeIndex)]);
    const choices = cells.map((_, index) => index).filter((index) => !forbidden.has(index));
    for (let placed = 0; placed < mineTotal; placed += 1) {
      const choice = Math.floor(Math.random() * choices.length);
      cells[choices.splice(choice, 1)[0]].mine = true;
    }
    cells.forEach((cell, index) => {
      cell.nearby = neighbors(index).filter((neighbor) => cells[neighbor].mine).length;
    });
  };

  const endGame = (won) => {
    finished = true;
    clearInterval(timerId);
    reset.textContent = won ? '😎' : '😵';
    reset.setAttribute('aria-label', won ? 'You won! Start a new game' : 'Game over. Start a new game');
    if (won) {
      cells.forEach((cell) => { if (cell.mine) cell.flagged = true; });
      unlockSecretMode();
    }
    cells.forEach((cell) => {
      if (cell.mine) {
        cell.button.classList.add(won ? 'is-flagged' : 'is-mine');
        cell.button.textContent = won ? '🚩' : '✹';
      } else if (cell.flagged && !won) {
        cell.button.classList.add('is-wrong');
        cell.button.textContent = '×';
      }
    });
    updateCounter();
  };

  const checkWin = () => {
    if (cells.filter((cell) => cell.revealed).length === rows * columns - mineTotal) endGame(true);
  };

  const reveal = (index) => {
    const cell = cells[index];
    if (finished || cell.revealed || cell.flagged) return;
    if (!started) {
      started = true;
      placeMines(index);
      timerId = setInterval(() => {
        seconds = Math.min(999, seconds + 1);
        timer.textContent = String(seconds).padStart(3, '0');
      }, 1000);
    }
    cell.revealed = true;
    cell.button.classList.add('is-revealed');
    cell.button.setAttribute('aria-label', cell.mine ? 'Mine' : cell.nearby ? `${cell.nearby} nearby mines` : 'Empty');
    if (cell.mine) {
      cell.button.classList.add('is-hit');
      endGame(false);
      return;
    }
    if (cell.nearby) {
      cell.button.textContent = cell.nearby;
      cell.button.dataset.count = cell.nearby;
    } else {
      neighbors(index).forEach(reveal);
    }
    checkWin();
  };

  const toggleFlag = (index) => {
    const cell = cells[index];
    if (finished || cell.revealed) return;
    cell.flagged = !cell.flagged;
    cell.button.classList.toggle('is-flagged', cell.flagged);
    cell.button.textContent = cell.flagged ? '🚩' : '';
    cell.button.setAttribute('aria-label', cell.flagged ? 'Flagged cell' : 'Hidden cell');
    updateCounter();
  };

  const newGame = () => {
    clearInterval(timerId);
    started = false;
    finished = false;
    seconds = 0;
    timer.textContent = '000';
    reset.textContent = '🙂';
    reset.setAttribute('aria-label', 'Start a new game');
    board.replaceChildren();
    cells = Array.from({ length: rows * columns }, (_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mine-cell';
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', 'Hidden cell');
      button.addEventListener('click', () => flagMode ? toggleFlag(index) : reveal(index));
      button.addEventListener('contextmenu', (event) => { event.preventDefault(); toggleFlag(index); });
      board.append(button);
      return { button, mine: false, nearby: 0, revealed: false, flagged: false };
    });
    updateCounter();
  };

  flagModeButton.addEventListener('click', () => {
    flagMode = !flagMode;
    flagModeButton.setAttribute('aria-pressed', String(flagMode));
    flagModeButton.textContent = `🚩 FLAG: ${flagMode ? 'ON' : 'OFF'}`;
  });
  reset.addEventListener('click', newGame);
  newGame();
}

function startTetris(windowElement) {
  const canvas = windowElement.querySelector('.tetris-board');
  const nextCanvas = windowElement.querySelector('.tetris-next');
  const context = canvas.getContext('2d');
  const nextContext = nextCanvas.getContext('2d');
  const scoreDisplay = windowElement.querySelector('.tetris-score');
  const linesDisplay = windowElement.querySelector('.tetris-lines');
  const levelDisplay = windowElement.querySelector('.tetris-level');
  const colors = ['#000', '#24d9ff', '#ffe44a', '#a855f7', '#4ade80', '#ff405c', '#4f7cff', '#ff9d32'];
  const shapes = [
    [[1, 1, 1, 1]],
    [[2, 2], [2, 2]],
    [[0, 3, 0], [3, 3, 3]],
    [[0, 4, 4], [4, 4, 0]],
    [[5, 5, 0], [0, 5, 5]],
    [[6, 0, 0], [6, 6, 6]],
    [[0, 0, 7], [7, 7, 7]]
  ];
  let board;
  let piece;
  let nextPiece;
  let score;
  let lines;
  let level;
  let gameOver;
  let lastTime;
  let dropTime;
  let animationId;

  const randomPiece = () => {
    const shape = shapes[Math.floor(Math.random() * shapes.length)].map((row) => [...row]);
    return { shape, x: Math.floor((10 - shape[0].length) / 2), y: 0 };
  };

  const collides = (candidate, offsetX = 0, offsetY = 0, shape = candidate.shape) => shape.some((row, y) => row.some((value, x) => {
    if (!value) return false;
    const boardX = candidate.x + x + offsetX;
    const boardY = candidate.y + y + offsetY;
    return boardX < 0 || boardX >= 10 || boardY >= 20 || (boardY >= 0 && board[boardY][boardX]);
  }));

  const drawBlock = (ctx, x, y, value, size) => {
    ctx.fillStyle = colors[value];
    ctx.fillRect(x * size, y * size, size, size);
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 2);
    ctx.fillRect(x * size + 1, y * size + 1, 2, size - 2);
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.strokeRect(x * size + .5, y * size + .5, size - 1, size - 1);
  };

  const draw = () => {
    context.fillStyle = '#090b18';
    context.fillRect(0, 0, 200, 400);
    context.strokeStyle = 'rgba(255,255,255,.055)';
    for (let x = 0; x <= 10; x += 1) { context.beginPath(); context.moveTo(x * 20, 0); context.lineTo(x * 20, 400); context.stroke(); }
    for (let y = 0; y <= 20; y += 1) { context.beginPath(); context.moveTo(0, y * 20); context.lineTo(200, y * 20); context.stroke(); }
    board.forEach((row, y) => row.forEach((value, x) => { if (value) drawBlock(context, x, y, value, 20); }));
    piece.shape.forEach((row, y) => row.forEach((value, x) => { if (value) drawBlock(context, piece.x + x, piece.y + y, value, 20); }));
    if (gameOver) {
      context.fillStyle = 'rgba(0,0,50,.86)';
      context.fillRect(15, 155, 170, 88);
      context.fillStyle = '#fff36b';
      context.font = '700 14px Silkscreen, monospace';
      context.textAlign = 'center';
      context.fillText('GAME OVER', 100, 190);
      context.fillStyle = '#fff';
      context.font = '8px Silkscreen, monospace';
      context.fillText('PRESS NEW GAME', 100, 217);
    }
  };

  const drawNext = () => {
    nextContext.fillStyle = '#090b18';
    nextContext.fillRect(0, 0, 80, 80);
    const size = 16;
    const startX = (5 - nextPiece.shape[0].length) / 2;
    const startY = (5 - nextPiece.shape.length) / 2;
    nextPiece.shape.forEach((row, y) => row.forEach((value, x) => { if (value) drawBlock(nextContext, startX + x, startY + y, value, size); }));
  };

  const updateStats = () => {
    scoreDisplay.textContent = String(score).padStart(6, '0');
    linesDisplay.textContent = String(lines).padStart(3, '0');
    levelDisplay.textContent = String(level).padStart(2, '0');
  };

  const spawn = () => {
    piece = nextPiece;
    piece.x = Math.floor((10 - piece.shape[0].length) / 2);
    piece.y = 0;
    nextPiece = randomPiece();
    drawNext();
    if (collides(piece)) gameOver = true;
  };

  const lock = () => {
    piece.shape.forEach((row, y) => row.forEach((value, x) => { if (value && piece.y + y >= 0) board[piece.y + y][piece.x + x] = value; }));
    let cleared = 0;
    for (let y = 19; y >= 0; y -= 1) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(10).fill(0));
        cleared += 1;
        y += 1;
      }
    }
    if (cleared) {
      lines += cleared;
      score += [0, 100, 300, 500, 800][cleared] * level;
      level = Math.floor(lines / 10) + 1;
      updateStats();
    }
    spawn();
  };

  const moveDown = (manual = false) => {
    if (gameOver) return;
    if (!collides(piece, 0, 1)) {
      piece.y += 1;
      if (manual) { score += 1; updateStats(); }
    } else lock();
    dropTime = 0;
    draw();
  };

  const act = (action) => {
    if (gameOver) return;
    if (action === 'left' && !collides(piece, -1)) piece.x -= 1;
    if (action === 'right' && !collides(piece, 1)) piece.x += 1;
    if (action === 'down') moveDown(true);
    if (action === 'rotate') {
      const rotated = piece.shape[0].map((_, index) => piece.shape.map((row) => row[index]).reverse());
      for (const kick of [0, -1, 1, -2, 2]) {
        if (!collides(piece, kick, 0, rotated)) { piece.x += kick; piece.shape = rotated; break; }
      }
    }
    if (action === 'drop') {
      let distance = 0;
      while (!collides(piece, 0, 1)) { piece.y += 1; distance += 1; }
      score += distance * 2;
      updateStats();
      lock();
      dropTime = 0;
    }
    draw();
  };

  const loop = (time = 0) => {
    const delta = time - lastTime;
    lastTime = time;
    if (!gameOver) {
      dropTime += Math.min(delta, 100);
      if (dropTime > Math.max(90, 800 - (level - 1) * 65)) moveDown();
    }
    draw();
    animationId = requestAnimationFrame(loop);
  };

  const newGame = () => {
    board = Array.from({ length: 20 }, () => Array(10).fill(0));
    score = 0; lines = 0; level = 1; gameOver = false; dropTime = 0; lastTime = performance.now();
    nextPiece = randomPiece();
    spawn();
    updateStats();
    canvas.focus();
  };

  const onKeyDown = (event) => {
    if (!windowElement.isConnected || !windowElement.classList.contains('is-active')) return;
    const actions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate', ' ': 'drop' };
    if (!actions[event.key]) return;
    event.preventDefault();
    act(actions[event.key]);
  };
  document.addEventListener('keydown', onKeyDown);
  windowElement.querySelectorAll('[data-tetris-action]').forEach((button) => button.addEventListener('click', () => { act(button.dataset.tetrisAction); canvas.focus(); }));
  windowElement.querySelector('.tetris-new').addEventListener('click', newGame);
  windowElement.cleanup = () => { cancelAnimationFrame(animationId); document.removeEventListener('keydown', onKeyDown); };
  newGame();
  animationId = requestAnimationFrame(loop);
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
    windowElement.cleanup?.();
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
  centerWindow(windowElement);
  enableDesktopWindow(windowElement);
  focusWindow(windowElement);
});

document.querySelectorAll('.desktop-icon').forEach((icon) => {
  icon.addEventListener('click', () => {
    document.querySelectorAll('.desktop-icon').forEach((item) => item.classList.remove('is-selected'));
    icon.classList.add('is-selected');
    const content = desktopContent[icon.dataset.window];
    if (!content) return;
    if (content.type === 'flight') {
      startFlightSim();
      return;
    }
    const existingWindow = retroScreen.querySelector(`[data-window-id="${icon.dataset.window}"]`);
    if (existingWindow) {
      focusWindow(existingWindow);
      return;
    }
    const windowElement = document.createElement('div');
    windowElement.className = 'retro-window';
    windowElement.dataset.windowId = icon.dataset.window;
    windowElement.setAttribute('role', 'region');
    windowElement.innerHTML = `<div class="window-titlebar"><span class="window-title">${content.title}</span><span class="window-controls"><i aria-hidden="true">_</i><i aria-hidden="true">□</i><button class="window-close" type="button" aria-label="Close window">×</button></span></div>`;
    windowElement.append(createWindowBody(content));
    if (content.type === 'projects') windowElement.classList.add('retro-window--projects');
    if (content.type === 'contact') windowElement.classList.add('retro-window--contact');
    if (content.type === 'minesweeper') windowElement.classList.add('retro-window--minesweeper');
    if (content.type === 'tetris') windowElement.classList.add('retro-window--tetris');
    retroScreen.append(windowElement);
    centerWindow(windowElement);
    enableDesktopWindow(windowElement);
    focusWindow(windowElement);
    if (content.type === 'projects') loadProjects(windowElement);
    if (content.type === 'contact') startContactForm(windowElement);
    if (content.type === 'minesweeper') startMinesweeper(windowElement);
    if (content.type === 'tetris') startTetris(windowElement);
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
let frameRequest = 0;
let targetFps = 30;
let plasmaBoost = false;
let plasmaVictory = false;
// The mesh is drawn in CSS pixels and the canvas is stretched back over the
// viewport, so dropping this shrinks how many pixels get rasterised and
// uploaded without moving a single cell on screen. The art is pixel-art and
// upscales with image-rendering:pixelated, so the cells stay crisp squares.
let renderScale = 1;
let slowSamples = 0;
let fastSamples = 0;
let qualityScale = 1;
let slowFrames = 0;
let vertices = [];

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

function setPlasmaBoost(boosted) {
  plasmaBoost = boosted;
  resize();
}

function resize() {
  // A viewport can momentarily measure nothing while the page is settling.
  // Sizing to that gives a 1x1 buffer stretched over the whole screen, which
  // reads as a solid black frame; keep the last good size and wait for the
  // resize that reports a real one.
  if (!innerWidth) return;
  width = innerWidth;
  // The canvas uses the large viewport in CSS, so size its drawing buffer to
  // that same stable area instead of the smaller, browser-chrome-dependent
  // innerHeight. Scrolling can then only crop/reveal it, never rescale it.
  height = Math.max(1, Math.ceil(canvas.getBoundingClientRect().height));
  // The geometry is deliberately pixel-snapped, so extra device pixels add
  // substantial work without improving the intended visual style.
  const ratio = renderScale;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  // Phones need fewer cells, not smaller ones: the canvas remains pixelated
  // while using a fraction of the CPU/GPU work in embedded previews.
  cellSize = Math.round((width <= 520 ? 24 : width <= 900 ? 22 : 20) * qualityScale);
  // As wallpaper this is deliberately slow: it saves battery and nobody reads
  // a background at 60fps. In the flight sim it IS the playfield, and a frame
  // costs about 4ms, so there it runs at the display's rate instead.
  targetFps = plasmaBoost ? 60 : width <= 520 ? 12 : width <= 900 ? 18 : 24;
  columns = Math.ceil(width / cellSize) + 8;
  rows = Math.ceil(height / cellSize) + 8;
  const vertexCount = (rows + 1) * (columns + 1);
  if (vertices.length !== vertexCount) {
    // Reuse vertex records between frames. The old implementation allocated
    // thousands of nested arrays and objects on every draw, eventually
    // producing visible garbage-collection pauses on long-running tabs.
    vertices = Array.from({ length: vertexCount }, () => ({ x: 0, y: 0, depth: 0, terrain: 0 }));
  }

  renderMesh();
}

function updateVertex(column, row, time, point) {
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

  point.x = width * .5 + (baseX - width * .5) * perspective + warpX;
  point.y = height * .5 + (baseY - height * .5) * perspective + warpY - depth * cellSize * 1.15;
  point.depth = depth;
  point.terrain = terrain;
}

// The same vertical displacement updateVertex() gives a mesh corner, sampled
// at an arbitrary screen point. Anything that should sit on the plasma - the
// flight sim's plane - can offset itself by this and follow the waves exactly.
function plasmaOffsetAt(x, y) {
  const nx = (x / cellSize + 4) * .115;
  const ny = (y / cellSize + 4) * .115;
  const terrain = fbm(nx + phase * .07, ny - phase * .045);
  const ridge = Math.abs(fbm(nx * 1.7 - phase * .055, ny * 1.7 + phase * .04) - .5);
  const depth = (terrain - .48) * 2.2 - ridge * .42;
  return -depth * cellSize * 1.15;
}

// Both of the plasma's colour treatments used to be CSS filters on a
// full-viewport canvas, so the GPU re-ran them over every composited frame -
// and the victory one switched on the moment the secret unlocked and never
// switched off again, still running once the flight sim pushes this to 60fps.
// They are folded into the colour the mesh is painted with instead.
//
// The matrices below are the Filter Effects definitions of saturate() and
// hue-rotate(). Each stage clamps before the next one runs, which is what
// Chrome's own filter chain does - checked against canvas2d's identical
// filter string over 4096 colours, worst channel error 4/255.
function saturateMatrix(amount) {
  return [
    0.213 + 0.787 * amount, 0.715 - 0.715 * amount, 0.072 - 0.072 * amount,
    0.213 - 0.213 * amount, 0.715 + 0.285 * amount, 0.072 - 0.072 * amount,
    0.213 - 0.213 * amount, 0.715 - 0.715 * amount, 0.072 + 0.928 * amount
  ];
}

function hueRotateMatrix(degrees) {
  const cos = Math.cos(degrees * Math.PI / 180);
  const sin = Math.sin(degrees * Math.PI / 180);
  return [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072
  ];
}

// filter:saturate(1.28) contrast(1.12), formerly on .plasma
const ambientTint = { stages: [saturateMatrix(1.28)], contrast: 1.12 };
// filter:hue-rotate(150deg) saturate(2.3) contrast(1.2), formerly on
// body.minesweeper-victory .plasma
const victoryTint = { stages: [hueRotateMatrix(150), saturateMatrix(2.3)], contrast: 1.2 };

function clampChannel(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function tinted(tint, hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const second = chroma * (1 - Math.abs(sector % 2 - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (sector < 1) { red = chroma; green = second; }
  else if (sector < 2) { red = second; green = chroma; }
  else if (sector < 3) { green = chroma; blue = second; }
  else if (sector < 4) { green = second; blue = chroma; }
  else if (sector < 5) { red = second; blue = chroma; }
  else { red = chroma; blue = second; }
  const base = lightness - chroma * .5;
  red += base;
  green += base;
  blue += base;

  for (const matrix of tint.stages) {
    const nextRed = matrix[0] * red + matrix[1] * green + matrix[2] * blue;
    const nextGreen = matrix[3] * red + matrix[4] * green + matrix[5] * blue;
    const nextBlue = matrix[6] * red + matrix[7] * green + matrix[8] * blue;
    red = clampChannel(nextRed);
    green = clampChannel(nextGreen);
    blue = clampChannel(nextBlue);
  }

  const contrast = tint.contrast;
  red = clampChannel((red - .5) * contrast + .5);
  green = clampChannel((green - .5) * contrast + .5);
  blue = clampChannel((blue - .5) * contrast + .5);
  return `rgb(${(red * 255) | 0} ${(green * 255) | 0} ${(blue * 255) | 0})`;
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
  return tinted(plasmaVictory ? victoryTint : ambientTint, hue, saturation * .01, light * .01);
}

function pixelSnap(value) {
  return Math.round(value / 2) * 2;
}

function draw(now) {
  const frameInterval = 1000 / targetFps;
  if (now - lastFrame < frameInterval) {
    frameRequest = requestAnimationFrame(draw);
    return;
  }
  lastFrame = now;
  plasmaVictory = document.body.classList.contains('minesweeper-victory');
  const delta = Math.min((now - last) / 1000, .05);
  last = now;
  const renderStarted = performance.now();

  // Smoothly lerp from an energetic entrance to a slow, ambient drift.
  const targetSpeed = .72;
  flow += (targetSpeed - flow) * (1 - Math.exp(-delta * .48));
  phase += delta * flow;

  renderMesh();

  // Embedded previews often have limited CPU/GPU resources. If several
  // frames are expensive, lower only the mesh resolution; the full animated
  // effect and all of its colors remain intact.
  if (performance.now() - renderStarted > (plasmaBoost ? 14 : 34)) {
    slowFrames += 1;
    if (slowFrames >= 4 && qualityScale < 1.6) {
      qualityScale = Math.min(1.6, qualityScale + .2);
      slowFrames = 0;
      resize();
    }
  } else {
    slowFrames = Math.max(0, slowFrames - 1);
  }
  if (!document.hidden) frameRequest = requestAnimationFrame(draw);
}

// Paints the mesh at whatever the current phase is. Kept separate from draw()
// so resize() can repaint immediately: assigning canvas.width wipes the canvas,
// and with the frame rate throttled the next scheduled paint can be up to a
// twelfth of a second away. That gap showed the near-black page underneath as
// a full-screen black flash - most visibly in the flight sim, where the plasma
// is the entire screen.
function renderMesh() {
  // Nothing to paint until a resize has reported a real viewport and built
  // the grid. Leaving the canvas untouched here keeps whatever was last on it.
  if (!vertices.length) return;

  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x <= columns; x += 1) {
      updateVertex(x, y, phase, vertices[y * (columns + 1) + x]);
    }
  }

  ctx.setLineDash([4, 2]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(1, 3, 8, .38)';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const topLeft = y * (columns + 1) + x;
      const p0 = vertices[topLeft];
      const p1 = vertices[topLeft + 1];
      const p3 = vertices[topLeft + columns + 1];
      const p2 = vertices[topLeft + columns + 2];
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
}

addEventListener('resize', () => {
  // Belt and braces: the media query above reports the new answer on its own,
  // but not every environment delivers its change event.
  showFlightIcon();
  // Mobile browser chrome emits height-only resize events during scrolling.
  // Let CSS scale the fixed canvas through those events so the animation is
  // never cleared or restarted just because the user scrolled.
  if (innerWidth !== width) resize();
}, { passive: true });
document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(frameRequest);
  if (document.hidden) {
    frameRequest = 0;
  } else {
    last = performance.now();
    frameRequest = requestAnimationFrame(draw);
  }
});
resize();
frameRequest = requestAnimationFrame(draw);

// The flight sim is aimed with a mouse and needs desktop room, so it is never
// offered on touch/phone layouts even after the minesweeper secret is found.
const flightUnlockQuery = matchMedia('(min-width: 640px) and (pointer: fine)');
let flightUnlocked = false;

// Winning is what earns the icon; whether it can be shown is a separate
// question that gets asked again whenever the answer can change. Deciding it
// once at the moment of the win meant a window that was narrow just then -
// or a viewport still reporting nothing - locked the reward away for the rest
// of the session, with no way to earn it back.
// Secret mode: won at minesweeper, or typed for. Both routes land here so
// there is only one description of what unlocking actually does.
function unlockSecretMode() {
  document.body.classList.add('minesweeper-victory');
  document.querySelector('[data-window="tetris"]')?.removeAttribute('hidden');
  unlockFlightSim();
  // Only there to be revealed if the minesweeper window happens to be open.
  document.querySelector('.mine-secret')?.classList.add('is-visible');
}

const secretWord = 'koyak';
let typedKeys = '';

document.addEventListener('keydown', (event) => {
  // Whatever the visitor is filling in gets to keep its keystrokes - the
  // contact form spells this word rather often.
  const target = event.target;
  if (target instanceof Element && (target.closest('input, textarea, select') || target.isContentEditable)) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
  // A rolling window, so the word still counts after a false start.
  typedKeys = (typedKeys + event.key.toLowerCase()).slice(-secretWord.length);
  if (typedKeys === secretWord) unlockSecretMode();
});

function unlockFlightSim() {
  flightUnlocked = true;
  showFlightIcon();
}

function showFlightIcon() {
  const icon = document.querySelector('[data-window="flight"]');
  if (!icon) return;
  icon.hidden = !(flightUnlocked && flightUnlockQuery.matches);
  if (icon.hidden) return;
  const note = document.querySelector('.mine-secret-note');
  if (note) note.textContent = 'Tetris and Flight Sim have appeared on your desktop!';
}

flightUnlockQuery.addEventListener('change', showFlightIcon);

const flightEnemyTypes = {
  diamond: { hp: 3, size: 62, score: 100, glow: '#24d9ff', fireEvery: 1500, pattern: 'drift' },
  hex: { hp: 5, size: 74, score: 180, glow: '#a855f7', fireEvery: 1900, pattern: 'weave' },
  triangle: { hp: 2, size: 54, score: 120, glow: '#4ade80', fireEvery: 1100, pattern: 'dive' },
  star: { hp: 10, size: 92, score: 320, glow: '#ffe44a', fireEvery: 260, pattern: 'hover' },
  cross: { hp: 4, size: 66, score: 200, glow: '#ff405c', fireEvery: 1400, pattern: 'sweep' }
};

// The enemies and the plane were DOM elements: fifteen composited layers,
// each hosting the same animated GIF behind a clip-path, plus an SVG whose
// drop-shadow was re-rasterised on every frame it moved. They are drawn onto
// the canvas that was already there instead - one layer, no filters, and the
// GIF decoded once. The outlines below are the clip-path polygons and the
// plane's <rect>s, carried over unchanged.
const flightShapes = {
  diamond: [[.5, 0], [1, .5], [.5, 1], [0, .5]],
  hex: [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]],
  triangle: [[.5, 1], [0, .04], [1, .04]],
  star: [[.5, 0], [.61, .35], [.98, .35], [.68, .57], [.79, .91], [.5, .70], [.21, .91], [.32, .57], [.02, .35], [.39, .35]],
  cross: [[.33, 0], [.67, 0], [.67, .33], [1, .33], [1, .67], [.67, .67], [.67, 1], [.33, 1], [.33, .67], [0, .67], [0, .33], [.33, .33]]
};

const flightShapePaths = Object.fromEntries(Object.entries(flightShapes).map(([kind, points]) => {
  const path = new Path2D();
  points.forEach(([x, y], index) => (index ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return [kind, path];
}));

// x, y, width, height in the plane's original 32x32 viewBox.
const flightPlaneHull = [[13, 2, 6, 27], [3, 15, 26, 7], [7, 25, 18, 5]];
const flightPlaneParts = [
  ['#cfd8e6', 14, 3, 4, 25], ['#cfd8e6', 4, 16, 24, 5], ['#cfd8e6', 8, 26, 16, 3],
  ['#ff174f', 15, 1, 2, 3], ['#24d9ff', 14, 8, 4, 4],
  ['#ff174f', 5, 17, 5, 3], ['#ff174f', 22, 17, 5, 3]
];

// Pfp.gif is 220x166 and the elements used background-size:cover on a square,
// which crops to the centred 166x166 of the source.
const flightSourceCrop = [27, 0, 166, 166];

// The glow the enemies used to get from a CSS drop-shadow, stamped once.
const flightSprites = new Map();

function flightGlowSprite(color, size) {
  let sprite = flightSprites.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  ((paint) => {
    const halo = paint.createRadialGradient(size / 2, size / 2, size * .2, size / 2, size / 2, size / 2);
    halo.addColorStop(0, color);
    halo.addColorStop(1, 'transparent');
    paint.fillStyle = halo;
    paint.fillRect(0, 0, size, size);
  })(sprite.getContext('2d'));
  flightSprites.set(color, sprite);
  return sprite;
}

function startFlightSim() {
  if (document.querySelector('.flight-sim')) return;

  const overlay = document.createElement('div');
  overlay.className = 'flight-sim';
  overlay.innerHTML = `<canvas class="flight-canvas"></canvas>
<img class="flight-source" src="Imgs/Pfp.gif" alt="" aria-hidden="true">
<div class="flight-hud"><span>SCORE <b class="flight-score">000000</b></span><span>WAVE <b class="flight-wave">00</b></span><span>PLANES <b class="flight-lives">AAA</b></span><span class="flight-hint">ESC TO EXIT</span></div>
<div class="flight-over" hidden><div class="retro-window retro-window--confirmation flight-over-window"><div class="window-titlebar"><span class="window-title">FLIGHT_SIM.EXE</span><span class="window-controls"><button class="window-close flight-quit" type="button" aria-label="Exit flight sim">&times;</button></span></div><div class="window-body window-body--confirmation"><span class="confirmation-icon flight-over-icon" aria-hidden="true">&#10041;</span><div><h2>SHOT DOWN</h2><p class="flight-final"></p><button class="confirmation-ok flight-again" type="button">PLAY AGAIN</button> <button class="confirmation-ok flight-quit" type="button">EXIT</button></div></div></div></div>`;
  document.body.append(overlay);
  document.body.classList.add('flight-mode');
  setPlasmaBoost(true);

  const canvas = overlay.querySelector('.flight-canvas');
  const context = canvas.getContext('2d');
  // A GIF only advances its frames while it is being painted somewhere, so
  // this one stays in the page at a size and opacity nobody can see, and every
  // enemy is drawn from it.
  const pfp = overlay.querySelector('.flight-source');
  const scoreDisplay = overlay.querySelector('.flight-score');
  const waveDisplay = overlay.querySelector('.flight-wave');
  const livesDisplay = overlay.querySelector('.flight-lives');
  const overPanel = overlay.querySelector('.flight-over');
  const finalDisplay = overlay.querySelector('.flight-final');

  let viewWidth = innerWidth;
  let viewHeight = innerHeight;
  let enemies = [];
  let enemyShots = [];
  let planeShots = [];
  let sparks = [];
  let pointerPlaced = false;
  let pointerX = viewWidth / 2;
  let pointerY = viewHeight * .74;
  let planeX = pointerX;
  let planeY = pointerY;
  let bank = 0;
  let score = 0;
  let wave = 0;
  let lives = 3;
  let invulnerable = 0;
  let fireCooldown = 0;
  let waveBreak = .8;
  let over = false;
  let clock = performance.now();
  let previous = clock;
  let animationId = 0;

  const resizeView = () => {
    // A viewport can measure zero while the page is still settling, and
    // clamping the pointer to that would park the plane in the corner for the
    // whole run. Until the mouse has actually moved, the plane is (re)centred
    // against whatever size we end up with.
    viewWidth = Math.max(1, innerWidth);
    viewHeight = Math.max(1, innerHeight);
    canvas.width = viewWidth;
    canvas.height = viewHeight;
    context.imageSmoothingEnabled = false;
    if (pointerPlaced) {
      pointerX = Math.min(pointerX, viewWidth);
      pointerY = Math.min(pointerY, viewHeight);
      return;
    }
    pointerX = viewWidth / 2;
    pointerY = viewHeight * .74;
    planeX = pointerX;
    planeY = pointerY;
  };

  const updateHud = () => {
    scoreDisplay.textContent = String(score).padStart(6, '0');
    waveDisplay.textContent = String(wave).padStart(2, '0');
    livesDisplay.textContent = '▲'.repeat(Math.max(0, lives)) || '—';
  };

  const burst = (x, y, color, count) => {
    if (sparks.length > 240) return;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .3 + Math.random() * .4, size: 3 + Math.random() * 4, color });
    }
  };

  const spawnEnemy = (kind, index, count) => {
    const type = flightEnemyTypes[kind];
    const lane = index < 0 ? .5 : (index + .5) / count;
    enemies.push({
      shape: flightShapePaths[kind],
      type,
      size: type.size,
      radius: type.size * .42,
      x: 70 + lane * Math.max(1, viewWidth - 140),
      y: -type.size - Math.random() * 240 - (index < 0 ? 140 : 0),
      hp: type.hp + Math.floor(wave / 3),
      age: Math.random() * 3,
      spin: (Math.random() < .5 ? -1 : 1) * (26 + Math.random() * 42),
      angle: Math.random() * Math.PI * 2,
      turn: Math.random() < .5 ? -1 : 1,
      cooldown: 500 + Math.random() * type.fireEvery,
      speed: 48 + Math.random() * 26 + wave * 3,
      homeY: 80 + Math.random() * 150,
      flash: 0
    });
  };

  const spawnWave = () => {
    wave += 1;
    const roster = ['diamond', 'triangle'];
    if (wave >= 2) roster.push('cross');
    if (wave >= 3) roster.push('hex');
    const count = Math.min(4 + wave, 15);
    for (let index = 0; index < count; index += 1) {
      spawnEnemy(roster[Math.floor(Math.random() * roster.length)], index, count);
    }
    if (wave >= 3 && wave % 3 === 0) spawnEnemy('star', -1, count);
    updateHud();
  };

  const shoot = (x, y, angle, speed, color, radius) => {
    // Bullet hell only stays fun while it stays readable, and an unbounded
    // spray is what turns a busy screen into a slideshow.
    if (enemyShots.length > 360) return;
    enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, color });
  };

  const fireEnemy = (enemy) => {
    const boost = 1 + wave * .04;
    const aim = Math.atan2(planeY - enemy.y, planeX - enemy.x);
    const glow = enemy.type.glow;
    if (enemy.type.pattern === 'drift') shoot(enemy.x, enemy.y, aim, 195 * boost, glow, 7);
    if (enemy.type.pattern === 'weave') {
      for (let arm = 0; arm < 8; arm += 1) shoot(enemy.x, enemy.y, enemy.angle + arm * Math.PI / 4, 155 * boost, glow, 6);
      enemy.angle += .38;
    }
    if (enemy.type.pattern === 'dive') {
      for (const spread of [-.22, 0, .22]) shoot(enemy.x, enemy.y, aim + spread, 245 * boost, glow, 6);
    }
    if (enemy.type.pattern === 'hover') {
      for (const arm of [0, Math.PI]) shoot(enemy.x, enemy.y, enemy.angle + arm, 175 * boost, glow, 7);
      enemy.angle += .58;
    }
    if (enemy.type.pattern === 'sweep') {
      for (const spread of [-.13, .13]) shoot(enemy.x, enemy.y, aim + spread, 215 * boost, glow, 7);
    }
  };

  const moveEnemy = (enemy, delta) => {
    enemy.age += delta;
    if (enemy.type.pattern === 'drift') {
      enemy.y += enemy.speed * delta;
      enemy.x += Math.sin(enemy.age * .9) * 46 * delta;
    } else if (enemy.type.pattern === 'weave') {
      enemy.y += enemy.speed * .78 * delta;
      enemy.x += Math.cos(enemy.age * 1.5) * 120 * delta;
    } else if (enemy.type.pattern === 'dive') {
      enemy.y += enemy.speed * 2.1 * delta;
    } else if (enemy.type.pattern === 'hover') {
      enemy.y += (enemy.homeY - enemy.y) * Math.min(1, delta * .8);
      enemy.x += Math.sin(enemy.age * .6) * 130 * delta;
    } else {
      enemy.y += (enemy.homeY - enemy.y) * Math.min(1, delta * 1.1);
      enemy.x += enemy.turn * (110 + wave * 6) * delta;
      if (enemy.x < enemy.radius || enemy.x > viewWidth - enemy.radius) enemy.turn *= -1;
    }
    enemy.x = Math.max(enemy.radius, Math.min(viewWidth - enemy.radius, enemy.x));
  };

  const killEnemy = (enemy) => {
    enemy.dead = true;
    score += enemy.type.score;
    burst(enemy.x, enemy.y, enemy.type.glow, 16);
    updateHud();
  };

  const endRun = () => {
    over = true;
    overlay.classList.add('is-over');
    finalDisplay.textContent = `FINAL SCORE ${String(score).padStart(6, '0')} · WAVE ${String(wave).padStart(2, '0')}`;
    overPanel.hidden = false;
    overPanel.querySelector('.flight-again').focus();
  };

  const hitPlayer = () => {
    lives -= 1;
    invulnerable = 2;
    burst(planeX, planeY, '#ff405c', 26);
    // Clear the pocket the player died in, otherwise they respawn straight
    // back into the same wall of bullets.
    enemyShots = enemyShots.filter((shot) => (shot.x - planeX) ** 2 + (shot.y - planeY) ** 2 > 240 ** 2);
    updateHud();
    if (lives <= 0) endRun();
  };

  const update = (delta) => {
    for (let index = sparks.length - 1; index >= 0; index -= 1) {
      const spark = sparks[index];
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      spark.vy += 160 * delta;
      spark.life -= delta;
      if (spark.life <= 0) sparks.splice(index, 1);
    }

    // The plane sits on the plasma: the pointer picks the spot, and the
    // terrain under that spot decides how high the wave carries it. The raw
    // field only swings about 25px, so it is exaggerated to stay readable
    // under a plane this big - retune this if the mesh scale ever changes.
    const previousX = planeX;
    planeX += (pointerX - planeX) * Math.min(1, delta * 20);
    const targetY = pointerY + plasmaOffsetAt(pointerX, pointerY) * 1.8;
    planeY += (targetY - planeY) * Math.min(1, delta * 14);
    bank += (Math.max(-26, Math.min(26, (planeX - previousX) / Math.max(delta, .001) * .05)) - bank) * Math.min(1, delta * 10);
    if (invulnerable > 0) invulnerable -= delta;

    if (over) return;

    fireCooldown -= delta * 1000;
    if (fireCooldown <= 0) {
      fireCooldown = 105;
      planeShots.push({ x: planeX - 15, y: planeY - 26 }, { x: planeX + 15, y: planeY - 26 });
    }

    if (!enemies.length) {
      waveBreak -= delta;
      if (waveBreak <= 0) {
        spawnWave();
        waveBreak = 2.2;
      }
    }

    enemies.forEach((enemy) => {
      moveEnemy(enemy, delta);
      if (enemy.flash > 0) enemy.flash -= delta;
      enemy.cooldown -= delta * 1000;
      if (enemy.cooldown <= 0 && enemy.y > 10) {
        enemy.cooldown = enemy.type.fireEvery * (.7 + Math.random() * .6);
        fireEnemy(enemy);
      }
      if (enemy.y > viewHeight + enemy.size) enemy.dead = true;
      if (invulnerable <= 0 && (enemy.x - planeX) ** 2 + (enemy.y - planeY) ** 2 < (enemy.radius + 10) ** 2) hitPlayer();
    });

    for (let index = planeShots.length - 1; index >= 0; index -= 1) {
      const shot = planeShots[index];
      shot.y -= 760 * delta;
      if (shot.y < -30) {
        planeShots.splice(index, 1);
        continue;
      }
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        if ((shot.x - enemy.x) ** 2 + (shot.y - enemy.y) ** 2 > (enemy.radius + 5) ** 2) continue;
        enemy.hp -= 1;
        enemy.flash = .1;
        burst(shot.x, shot.y, enemy.type.glow, 3);
        planeShots.splice(index, 1);
        if (enemy.hp <= 0) killEnemy(enemy);
        break;
      }
    }

    for (let index = enemyShots.length - 1; index >= 0; index -= 1) {
      const shot = enemyShots[index];
      shot.x += shot.vx * delta;
      shot.y += shot.vy * delta;
      if (shot.x < -40 || shot.x > viewWidth + 40 || shot.y < -40 || shot.y > viewHeight + 40) {
        enemyShots.splice(index, 1);
        continue;
      }
      // A small player hitbox is what makes a dense pattern survivable.
      if (invulnerable <= 0 && (shot.x - planeX) ** 2 + (shot.y - planeY) ** 2 < (shot.r + 7) ** 2) {
        enemyShots.splice(index, 1);
        hitPlayer();
      }
    }

    enemies = enemies.filter((enemy) => !enemy.dead);
  };

  const draw = () => {
    context.clearRect(0, 0, viewWidth, viewHeight);

    // The glow the enemies used to get from a CSS drop-shadow, painted once
    // per enemy underneath them instead of re-blurred on every frame.
    context.globalAlpha = .5;
    for (const enemy of enemies) {
      const halo = enemy.size * 1.9;
      context.drawImage(flightGlowSprite(enemy.type.glow, 128), Math.round(enemy.x - halo / 2), Math.round(enemy.y - halo / 2), halo, halo);
    }
    context.globalAlpha = 1;

    for (const shot of planeShots) {
      context.fillStyle = '#fff36b';
      context.fillRect(shot.x - 4, shot.y - 12, 8, 20);
      context.fillStyle = '#fff';
      context.fillRect(shot.x - 2, shot.y - 8, 4, 12);
    }

    for (const shot of enemyShots) {
      context.fillStyle = 'rgba(4,6,12,.7)';
      context.fillRect(shot.x - shot.r - 2, shot.y - shot.r - 2, shot.r * 2 + 4, shot.r * 2 + 4);
      context.fillStyle = shot.color;
      context.fillRect(shot.x - shot.r, shot.y - shot.r, shot.r * 2, shot.r * 2);
      context.fillStyle = '#fff';
      context.fillRect(shot.x - shot.r * .34, shot.y - shot.r * .34, shot.r * .68, shot.r * .68);
    }

    for (const spark of sparks) {
      context.globalAlpha = Math.max(0, Math.min(1, spark.life * 2.4));
      context.fillStyle = spark.color;
      context.fillRect(spark.x - spark.size / 2, spark.y - spark.size / 2, spark.size, spark.size);
    }
    context.globalAlpha = 1;

    const artReady = pfp.complete && pfp.naturalWidth > 0;
    for (const enemy of enemies) {
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(enemy.age * enemy.spin * Math.PI / 180);
      context.scale(enemy.size, enemy.size);
      context.translate(-.5, -.5);
      context.clip(enemy.shape);
      if (artReady) context.drawImage(pfp, flightSourceCrop[0], flightSourceCrop[1], flightSourceCrop[2], flightSourceCrop[3], 0, 0, 1, 1);
      else { context.fillStyle = enemy.type.glow; context.fillRect(0, 0, 1, 1); }
      if (enemy.flash > 0) {
        context.fillStyle = 'rgba(255,255,255,.9)';
        context.fillRect(0, 0, 1, 1);
      }
      context.restore();
    }

    const blink = invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0;
    if (!over) {
      context.save();
      context.globalAlpha = blink ? .3 : 1;
      context.translate(planeX, planeY);
      context.rotate(bank * Math.PI / 180);
      context.scale(3.25, 3.25);
      context.translate(-16, -16);
      // Stands in for the drop-shadow the SVG used to carry.
      context.fillStyle = 'rgba(0,0,0,.45)';
      for (const part of flightPlaneHull) context.fillRect(part[0], part[1] + 2.5, part[2], part[3]);
      context.fillStyle = '#090b12';
      for (const part of flightPlaneHull) context.fillRect(part[0], part[1], part[2], part[3]);
      for (const part of flightPlaneParts) {
        context.fillStyle = part[0];
        context.fillRect(part[1], part[2], part[3], part[4]);
      }
      if (Math.floor(clock / 180) % 2 === 0) {
        context.fillStyle = '#ffb02e';
        context.fillRect(14, 29, 4, 3);
      }
      context.restore();
    }

    if (!over) {
      context.fillStyle = blink ? '#ff405c' : '#fff';
      context.fillRect(planeX - 3, planeY - 3, 6, 6);
    }
  };

  const step = (now) => {
    animationId = requestAnimationFrame(step);
    const delta = Math.min((now - previous) / 1000, .05);
    previous = now;
    clock = now;
    update(delta);
    draw();
  };

  const restart = () => {
    enemies = [];
    enemyShots = [];
    planeShots = [];
    sparks = [];
    score = 0;
    wave = 0;
    lives = 3;
    invulnerable = 0;
    waveBreak = .8;
    over = false;
    overPanel.hidden = true;
    overlay.classList.remove('is-over');
    updateHud();
  };

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  function close() {
    cancelAnimationFrame(animationId);
    removeEventListener('resize', resizeView);
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    document.body.classList.remove('flight-mode');
    setPlasmaBoost(false);
    document.querySelector('[data-window="flight"]')?.focus();
  }

  overlay.addEventListener('pointermove', (event) => {
    pointerPlaced = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  overlay.querySelector('.flight-again').addEventListener('click', restart);
  overlay.querySelectorAll('.flight-quit').forEach((button) => button.addEventListener('click', close));
  addEventListener('resize', resizeView, { passive: true });
  document.addEventListener('keydown', onKeyDown);

  resizeView();
  updateHud();
  animationId = requestAnimationFrame(step);
}

// Every so often a Mizzlebip flaps across the page. Clicking one pops it: it
// bursts, tumbles to the bottom of the screen and is erased, and a copy of it
// takes up residence in the fake desktop's taskbar tray.
const mizzlebipSky = document.querySelector('.mizzlebip-sky');
const mizzlebipTray = document.querySelector('.task-tray');
const mizzlebipTrayLimit = 8;
const mizzlebipGravity = 1500;
const mizzlebipFlap = -330;
let mizzlebip = null;
let mizzlebipFrame = 0;
let mizzlebipLast = 0;

function scheduleMizzlebip(delay) {
  setTimeout(spawnMizzlebip, delay);
}

function catchMizzlebip() {
  if (!mizzlebipTray || mizzlebipTray.childElementCount >= mizzlebipTrayLimit) return;
  const icon = document.createElement('img');
  icon.src = 'Imgs/Mizzlebip.png';
  icon.alt = 'Caught Mizzlebip';
  mizzlebipTray.append(icon);
}

function despawnMizzlebip(nextDelay) {
  if (!mizzlebip) return;
  cancelAnimationFrame(mizzlebipFrame);
  mizzlebip.element.remove();
  mizzlebip = null;
  scheduleMizzlebip(nextDelay);
}

function flyMizzlebip(now) {
  const bird = mizzlebip;
  if (!bird) return;
  mizzlebipFrame = requestAnimationFrame(flyMizzlebip);

  // The flight sim takes the whole screen, so anything out here is invisible
  // and has no business still animating.
  if (document.body.classList.contains('flight-mode')) {
    despawnMizzlebip(20000);
    return;
  }

  const delta = Math.min((now - mizzlebipLast) / 1000, .05);
  mizzlebipLast = now;

  bird.vy += mizzlebipGravity * delta;

  if (bird.popped) {
    bird.pop = Math.max(0, bird.pop - delta * 6);
    bird.tilt += bird.tumble * delta;
  } else {
    bird.x += bird.vx * delta;
    // Flapping only when it has sunk far enough below the line it came in on
    // keeps the bob tight and stops it wandering off the top or bottom.
    if (bird.y > bird.lane + 26) bird.vy = mizzlebipFlap;
    bird.tilt = Math.max(-18, Math.min(40, bird.vy * .05));
  }

  bird.y += bird.vy * delta;

  const scale = 1 + bird.pop * .55;
  bird.element.style.transform = `translate3d(${bird.x - 17}px, ${bird.y - 28}px, 0) rotate(${bird.tilt}deg) scale(${bird.facing * scale}, ${scale})`;

  const goneSideways = !bird.popped && (bird.x < -140 || bird.x > innerWidth + 140);
  const goneDown = bird.popped && bird.y > innerHeight + 90;
  if (goneSideways || goneDown) despawnMizzlebip(24000 + Math.random() * 32000);
}

function popMizzlebip() {
  const bird = mizzlebip;
  if (!bird || bird.popped) return;
  bird.popped = true;
  bird.pop = 1;
  bird.vy = -260;
  bird.tumble = (Math.random() < .5 ? -1 : 1) * (200 + Math.random() * 180);
  bird.element.disabled = true;
  bird.element.style.pointerEvents = 'none';
  catchMizzlebip();
}

function spawnMizzlebip() {
  // One at a time, and not while the page is hidden or the flight sim owns
  // the screen - just come back and try again later.
  if (mizzlebip || !mizzlebipSky || document.hidden || document.body.classList.contains('flight-mode')) {
    scheduleMizzlebip(12000);
    return;
  }

  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'mizzlebip';
  element.setAttribute('aria-label', 'Catch Mizzlebip');
  const art = document.createElement('img');
  art.src = 'Imgs/Mizzlebip.png';
  art.alt = '';
  element.append(art);
  element.addEventListener('click', popMizzlebip);
  mizzlebipSky.append(element);

  const headingLeft = Math.random() < .5;
  const lane = 90 + Math.random() * Math.max(60, innerHeight * .45);
  mizzlebip = {
    element,
    x: headingLeft ? innerWidth + 90 : -90,
    y: lane,
    lane,
    vx: (headingLeft ? -1 : 1) * (105 + Math.random() * 70),
    vy: mizzlebipFlap,
    // The art faces one way; mirror it when it is travelling the other.
    facing: headingLeft ? -1 : 1,
    tilt: 0,
    tumble: 0,
    popped: false,
    pop: 0
  };

  mizzlebipLast = performance.now();
  mizzlebipFrame = requestAnimationFrame(flyMizzlebip);
}

if (mizzlebipSky) scheduleMizzlebip(9000 + Math.random() * 14000);
