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
  tetris: { title: 'TETRIS.EXE', type: 'tetris' }
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
    body.innerHTML = `<div class="mine-toolbar"><span class="mine-counter" aria-label="Mines remaining">010</span><button class="mine-reset" type="button" aria-label="Start a new game">🙂</button><span class="mine-timer" aria-label="Elapsed time">000</span></div><div class="mine-actions"><button class="mine-flag-mode" type="button" aria-pressed="false">🚩 FLAG: OFF</button><span>9×9 · 10 MINES</span></div><div class="mine-grid" role="grid" aria-label="Minesweeper board"></div><p class="mine-help">Click to clear · right-click or use flag mode to mark</p><div class="mine-secret" role="status"><strong>★ SECRET MODE UNLOCKED ★</strong><span>Tetris has appeared on your desktop!</span></div>`;
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
      document.body.classList.add('minesweeper-victory');
      document.querySelector('[data-window="tetris"]')?.removeAttribute('hidden');
      secret.classList.add('is-visible');
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

function resize() {
  width = innerWidth;
  // The canvas uses the large viewport in CSS, so size its drawing buffer to
  // that same stable area instead of the smaller, browser-chrome-dependent
  // innerHeight. Scrolling can then only crop/reveal it, never rescale it.
  height = Math.max(1, Math.ceil(canvas.getBoundingClientRect().height));
  // The geometry is deliberately pixel-snapped, so extra device pixels add
  // substantial work without improving the intended visual style.
  const ratio = 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  // Phones need fewer cells, not smaller ones: the canvas remains pixelated
  // while using a fraction of the CPU/GPU work in embedded previews.
  cellSize = Math.round((width <= 520 ? 24 : width <= 900 ? 22 : 20) * qualityScale);
  targetFps = width <= 520 ? 12 : width <= 900 ? 18 : 24;
  columns = Math.ceil(width / cellSize) + 8;
  rows = Math.ceil(height / cellSize) + 8;
  const vertexCount = (rows + 1) * (columns + 1);
  if (vertices.length !== vertexCount) {
    // Reuse vertex records between frames. The old implementation allocated
    // thousands of nested arrays and objects on every draw, eventually
    // producing visible garbage-collection pauses on long-running tabs.
    vertices = Array.from({ length: vertexCount }, () => ({ x: 0, y: 0, depth: 0, terrain: 0 }));
  }
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
  const frameInterval = 1000 / targetFps;
  if (now - lastFrame < frameInterval) {
    frameRequest = requestAnimationFrame(draw);
    return;
  }
  lastFrame = now;
  const delta = Math.min((now - last) / 1000, .05);
  last = now;
  const renderStarted = performance.now();

  // Smoothly lerp from an energetic entrance to a slow, ambient drift.
  const targetSpeed = .72;
  flow += (targetSpeed - flow) * (1 - Math.exp(-delta * .48));
  phase += delta * flow;

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

  // Embedded previews often have limited CPU/GPU resources. If several
  // frames are expensive, lower only the mesh resolution; the full animated
  // effect and all of its colors remain intact.
  if (performance.now() - renderStarted > 34) {
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

addEventListener('resize', () => {
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
