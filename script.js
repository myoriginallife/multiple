(() => {
  "use strict";

  // ---------- 영속 데이터 (코인/최고 콤보/단별 별점) ----------
  const STORAGE_KEY = "gugudanBattle_v1";

  function loadProgress() {
    const fallback = { totalCoins: 0, bestCombo: 0, danStars: {}, collectedAnimals: [] };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      return Object.assign(fallback, JSON.parse(raw));
    } catch (e) {
      return fallback;
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch (e) {
      /* 저장 실패해도 게임은 계속 진행 */
    }
  }

  // ---------- 상태 ----------
  const state = {
    selectedDans: new Set([2, 3, 4, 5]),
    questionCount: 15,
    queue: [],
    pos: 0,
    clearedIds: new Set(),
    everWrong: new Set(),
    wrongCounts: new Map(),
    coinsThisRun: 0,
    streak: 0,
    bestStreakRun: 0,
    locked: false,
    questionStartTime: 0,
    currentAnimal: null,
    friendsThisRun: new Set(),
    newlyCollected: new Set(),
    progress: loadProgress(),
  };

  const TIME_LIMIT = 7000;
  const ANIMALS = ["🐰", "🐼", "🦊", "🐶", "🐱", "🐻", "🐨", "🐹", "🦁", "🐷"];
  const CHEERS = ["참 잘했어요! 👏", "정답이에요! 😄", "최고예요! ⭐", "완벽해요! 🎯", "친구가 됐어요! 💕"];
  const CONSOLES = ["아쉬워요! 다시 도전!", "괜찮아요, 다음엔 맞출 거예요!", "조금만 더 힘내요! 🙂"];

  // ---------- 요소 ----------
  const screens = {
    start: document.getElementById("screen-start"),
    game: document.getElementById("screen-game"),
    result: document.getElementById("screen-result"),
  };

  const danGrid = document.getElementById("danGrid");
  const countGrid = document.getElementById("countGrid");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const selectNoneBtn = document.getElementById("selectNoneBtn");
  const startBtn = document.getElementById("startBtn");
  const startError = document.getElementById("startError");
  const totalCoinsEl = document.getElementById("totalCoins");
  const bestComboEverEl = document.getElementById("bestComboEver");

  const coinsEl = document.getElementById("coins");
  const streakEl = document.getElementById("streak");
  const comboHud = document.getElementById("comboHud");
  const progressEl = document.getElementById("progress");
  const totalEl = document.getElementById("total");
  const progressBar = document.getElementById("progressBar");
  const animalEl = document.getElementById("animal");
  const heartFx = document.getElementById("heartFx");
  const timerBar = document.getElementById("timerBar");
  const animalDex = document.getElementById("animalDex");
  const questionEl = document.getElementById("question");
  const choicesEl = document.getElementById("choices");
  const feedbackEl = document.getElementById("feedback");
  const comboPopup = document.getElementById("comboPopup");

  const resultTitle = document.getElementById("resultTitle");
  const starsRow = document.getElementById("starsRow");
  const resultDans = document.getElementById("resultDans");
  const resultAccuracy = document.getElementById("resultAccuracy");
  const resultBestStreak = document.getElementById("resultBestStreak");
  const resultCoins = document.getElementById("resultCoins");
  const resultBadge = document.getElementById("resultBadge");
  const newFriendsEl = document.getElementById("newFriends");
  const shareBtn = document.getElementById("shareBtn");
  const retryBtn = document.getElementById("retryBtn");
  const homeBtn = document.getElementById("homeBtn");
  const homeBtnGame = document.getElementById("homeBtnGame");
  const toastEl = document.getElementById("toast");

  // ---------- 파티클(콘페티) ----------
  const fxCanvas = document.getElementById("fx");
  const fxCtx = fxCanvas.getContext("2d");
  let particles = [];

  function resizeFx() {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeFx);
  resizeFx();

  function burst(x, y, count) {
    const colors = ["#ff7043", "#26c6da", "#ffca28", "#ab47bc", "#66bb6a"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 4 + Math.random() * 4,
        color: colors[randInt(0, colors.length - 1)],
        life: 1,
      });
    }
  }

  function tickFx() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    particles.forEach((p) => {
      p.vy += 0.15;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.018;
      fxCtx.globalAlpha = Math.max(p.life, 0);
      fxCtx.fillStyle = p.color;
      fxCtx.fillRect(p.x, p.y, p.size, p.size);
    });
    particles = particles.filter((p) => p.life > 0 && p.y < fxCanvas.height + 50);
    fxCtx.globalAlpha = 1;
    requestAnimationFrame(tickFx);
  }
  requestAnimationFrame(tickFx);

  function burstAt(el, count) {
    const rect = el.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
  }

  // ---------- 토스트 ----------
  let toastTimer = null;
  function showToast(msg, duration) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration || 2600);
  }

  // ---------- 화면 전환 ----------
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ---------- 메타 스탯 / 단 선택 ----------
  function updateMetaStats() {
    totalCoinsEl.textContent = String(state.progress.totalCoins);
    bestComboEverEl.textContent = String(state.progress.bestCombo);
    renderAnimalDex();
  }

  function renderAnimalDex() {
    animalDex.innerHTML = "";
    animalDex.style.gridTemplateColumns = `repeat(${Math.ceil(ANIMALS.length / 2)}, 1fr)`;
    const collected = new Set(state.progress.collectedAnimals || []);
    ANIMALS.forEach((animal) => {
      const slot = document.createElement("div");
      const has = collected.has(animal);
      slot.className = `dex-slot ${has ? "collected" : "locked"}`;
      slot.textContent = has ? animal : "❔";
      animalDex.appendChild(slot);
    });
  }

  function buildDanGrid() {
    danGrid.innerHTML = "";
    for (let dan = 2; dan <= 9; dan++) {
      const wrap = document.createElement("div");
      wrap.className = "dan-btn-wrap";

      const btn = document.createElement("button");
      btn.className = "dan-btn";
      btn.textContent = `${dan}단`;
      btn.dataset.dan = String(dan);
      if (state.selectedDans.has(dan)) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        if (state.selectedDans.has(dan)) {
          state.selectedDans.delete(dan);
          btn.classList.remove("selected");
        } else {
          state.selectedDans.add(dan);
          btn.classList.add("selected");
        }
      });

      const stars = document.createElement("div");
      stars.className = "dan-stars";
      const best = state.progress.danStars[dan] || 0;
      stars.textContent = "★".repeat(best) + "☆".repeat(3 - best);

      wrap.appendChild(btn);
      wrap.appendChild(stars);
      danGrid.appendChild(wrap);
    }
  }

  selectAllBtn.addEventListener("click", () => {
    state.selectedDans = new Set([2, 3, 4, 5, 6, 7, 8, 9]);
    buildDanGrid();
  });

  selectNoneBtn.addEventListener("click", () => {
    state.selectedDans.clear();
    buildDanGrid();
  });

  countGrid.querySelectorAll(".count-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      countGrid.querySelectorAll(".count-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.questionCount = Number(btn.dataset.count);
    });
  });

  // ---------- 문제 생성 ----------
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function makeChoices(answer) {
    const choices = new Set([answer]);
    while (choices.size < 4) {
      const offset = randInt(-10, 10);
      const candidate = answer + offset;
      if (candidate < 0 || candidate === answer) continue;
      choices.add(candidate);
    }
    return shuffle([...choices]);
  }

  function buildQueue() {
    const dans = [...state.selectedDans];
    const queue = [];
    for (let i = 0; i < state.questionCount; i++) {
      const dan = dans[randInt(0, dans.length - 1)];
      const multiplier = randInt(1, 9);
      const answer = dan * multiplier;
      queue.push({ id: i, a: dan, b: multiplier, answer });
    }
    return queue;
  }

  // ---------- 게임 시작 ----------
  startBtn.addEventListener("click", () => {
    if (state.selectedDans.size === 0) {
      startError.textContent = "단을 최소 1개 이상 선택해주세요! 🙏";
      return;
    }
    startError.textContent = "";

    state.queue = buildQueue();
    state.pos = 0;
    state.clearedIds = new Set();
    state.everWrong = new Set();
    state.wrongCounts = new Map();
    state.coinsThisRun = 0;
    state.streak = 0;
    state.bestStreakRun = 0;
    state.friendsThisRun = new Set();
    state.newlyCollected = new Set();

    totalEl.textContent = String(state.questionCount);
    showScreen("game");
    renderQuestion();
  });

  // ---------- 문제 렌더링 ----------
  function clearTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
  }

  function startTimer() {
    clearTimer();
    state.questionStartTime = performance.now();
    timerBar.style.width = "100%";
    timerBar.style.background = "var(--correct)";
    state.timerInterval = setInterval(() => {
      const elapsed = performance.now() - state.questionStartTime;
      const pct = Math.max(0, 1 - elapsed / TIME_LIMIT);
      timerBar.style.width = `${pct * 100}%`;
      if (pct < 0.3) timerBar.style.background = "var(--wrong)";
      else if (pct < 0.6) timerBar.style.background = "var(--gold)";
      if (elapsed >= TIME_LIMIT) {
        clearTimer();
        handleAnswer(null, null, state.queue[state.pos], true);
      }
    }, 100);
  }

  function renderQuestion() {
    if (state.pos >= state.queue.length) {
      finishGame();
      return;
    }
    state.locked = false;
    const q = state.queue[state.pos];
    q.choices = makeChoices(q.answer);

    coinsEl.textContent = String(state.coinsThisRun);
    streakEl.textContent = String(state.streak);
    progressEl.textContent = String(state.clearedIds.size);
    progressBar.style.width = `${(state.clearedIds.size / state.questionCount) * 100}%`;

    state.currentAnimal = ANIMALS[randInt(0, ANIMALS.length - 1)];
    animalEl.textContent = state.currentAnimal;
    animalEl.style.opacity = "1";
    animalEl.style.transform = "";
    animalEl.classList.remove("happy", "shy");

    questionEl.textContent = `${q.a} × ${q.b} = ?`;
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";

    choicesEl.innerHTML = "";
    q.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = String(choice);
      btn.addEventListener("click", () => handleAnswer(choice, btn, q, false));
      choicesEl.appendChild(btn);
    });

    startTimer();
  }

  function pulseHud() {
    comboHud.classList.remove("pulse");
    void comboHud.offsetWidth;
    comboHud.classList.add("pulse");
  }

  function popFriend() {
    animalEl.classList.remove("happy");
    void animalEl.offsetWidth;
    animalEl.classList.add("happy");
    heartFx.textContent = ["💕", "✨", "⭐", "💫"][randInt(0, 3)];
    heartFx.classList.remove("show");
    void heartFx.offsetWidth;
    heartFx.classList.add("show");
  }

  function shyAway() {
    animalEl.classList.remove("shy");
    void animalEl.offsetWidth;
    animalEl.classList.add("shy");
  }

  function showComboPopup(n) {
    if (n < 5 || n % 5 !== 0) return;
    let msg;
    if (n >= 15) msg = `🔥 ${n} 콤보! 전설이다!!`;
    else if (n >= 10) msg = `⚡ ${n} 콤보! 대박!`;
    else msg = `✨ ${n} 콤보!`;
    comboPopup.textContent = msg;
    comboPopup.classList.remove("show");
    void comboPopup.offsetWidth;
    comboPopup.classList.add("show");
    burstAt(animalEl, 22);
  }

  function handleAnswer(choice, btn, q, timedOut) {
    if (state.locked) return;
    state.locked = true;
    clearTimer();

    const buttons = [...choicesEl.querySelectorAll(".choice-btn")];
    buttons.forEach((b) => (b.disabled = true));

    const isCorrect = !timedOut && choice === q.answer;

    if (isCorrect) {
      popFriend();
      btn.classList.add("correct");

      const elapsed = performance.now() - state.questionStartTime;
      const speedBonus = elapsed < 2000 ? 5 : 0;
      const comboBonus = state.streak * 2;
      const coinsEarned = 10 + comboBonus + speedBonus;
      state.coinsThisRun += coinsEarned;

      state.streak += 1;
      state.bestStreakRun = Math.max(state.bestStreakRun, state.streak);
      pulseHud();
      showComboPopup(state.streak);

      state.clearedIds.add(q.id);
      if (!state.progress.collectedAnimals.includes(state.currentAnimal)) {
        state.progress.collectedAnimals.push(state.currentAnimal);
        state.newlyCollected.add(state.currentAnimal);
      }
      state.friendsThisRun.add(state.currentAnimal);

      feedbackEl.textContent = `${CHEERS[randInt(0, CHEERS.length - 1)]} +${coinsEarned} 하트`;
      feedbackEl.className = "feedback correct";
    } else {
      shyAway();
      if (btn) btn.classList.add("wrong");
      const correctBtn = buttons.find((b) => Number(b.textContent) === q.answer);
      if (correctBtn) correctBtn.classList.add("correct");

      state.streak = 0;
      state.everWrong.add(q.id);

      const wrongCount = (state.wrongCounts.get(q.id) || 0) + 1;
      state.wrongCounts.set(q.id, wrongCount);

      if (wrongCount <= 2) {
        const insertPos = Math.min(state.pos + 3, state.queue.length);
        state.queue.splice(insertPos, 0, { id: q.id, a: q.a, b: q.b, answer: q.answer });
      } else {
        state.clearedIds.add(q.id);
      }

      const prefix = timedOut ? "시간 초과!" : CONSOLES[randInt(0, CONSOLES.length - 1)];
      feedbackEl.textContent = `${prefix} 정답: ${q.answer}`;
      feedbackEl.className = "feedback wrong";
    }

    coinsEl.textContent = String(state.coinsThisRun);
    streakEl.textContent = String(state.streak);
    progressEl.textContent = String(state.clearedIds.size);
    progressBar.style.width = `${(state.clearedIds.size / state.questionCount) * 100}%`;

    setTimeout(() => {
      state.pos += 1;
      renderQuestion();
    }, 1100);
  }

  // ---------- 결과 화면 ----------
  function computeStars(accuracy) {
    if (accuracy >= 90) return 3;
    if (accuracy >= 70) return 2;
    if (accuracy >= 40) return 1;
    return 0;
  }

  function finishGame() {
    clearTimer();
    progressBar.style.width = "100%";

    const accuracy = Math.round(((state.questionCount - state.everWrong.size) / state.questionCount) * 100);
    const stars = computeStars(accuracy);

    const dansSorted = [...state.selectedDans].sort((a, b) => a - b);
    resultDans.textContent = `${dansSorted.join(", ")}단`;
    resultAccuracy.textContent = `${accuracy}%`;
    resultBestStreak.textContent = String(state.bestStreakRun);
    resultCoins.textContent = String(state.coinsThisRun);

    starsRow.querySelectorAll(".star").forEach((el, i) => {
      el.classList.toggle("filled", i < stars);
      el.textContent = i < stars ? "★" : "☆";
    });

    newFriendsEl.innerHTML = "";
    state.friendsThisRun.forEach((animal) => {
      const span = document.createElement("span");
      span.textContent = animal;
      newFriendsEl.appendChild(span);
    });

    let title, badge;
    if (stars === 3) {
      title = "🏆 완벽한 우정!";
      badge = "구구단 마스터 뱃지 획득! 최고예요 🥇";
    } else if (stars === 2) {
      title = "🎉 멋진 성공!";
      badge = "실력자 뱃지 획득! 조금만 더 하면 별 3개예요 🥈";
    } else if (stars === 1) {
      title = "👍 성공했어요!";
      badge = "계속 도전하면 금방 늘 거예요 🥉";
    } else {
      title = "💪 다시 도전해봐요!";
      badge = "포기하지 마세요, 다음엔 더 잘할 수 있어요!";
    }
    resultTitle.textContent = title;
    resultBadge.textContent = badge;

    if (state.newlyCollected.size > 0) {
      const names = [...state.newlyCollected].join(" ");
      setTimeout(() => showToast(`새로운 친구를 만났어요! ${names}`), 400);
    }

    // 영속 데이터 갱신
    state.progress.totalCoins += state.coinsThisRun;
    state.progress.bestCombo = Math.max(state.progress.bestCombo, state.bestStreakRun);
    if (state.selectedDans.size === 1) {
      const dan = [...state.selectedDans][0];
      state.progress.danStars[dan] = Math.max(state.progress.danStars[dan] || 0, stars);
    }
    saveProgress();
    updateMetaStats();

    if (stars > 0) {
      const rect = starsRow.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 40);
    }

    showScreen("result");
  }

  retryBtn.addEventListener("click", () => {
    state.queue = buildQueue();
    state.pos = 0;
    state.clearedIds = new Set();
    state.everWrong = new Set();
    state.wrongCounts = new Map();
    state.coinsThisRun = 0;
    state.streak = 0;
    state.bestStreakRun = 0;
    state.friendsThisRun = new Set();
    state.newlyCollected = new Set();

    totalEl.textContent = String(state.questionCount);
    showScreen("game");
    renderQuestion();
  });

  function goHome() {
    clearTimer();
    state.locked = true;
    buildDanGrid();
    updateMetaStats();
    showScreen("start");
  }

  homeBtn.addEventListener("click", goHome);
  homeBtnGame.addEventListener("click", goHome);

  // ---------- 결과 공유 ----------
  shareBtn.addEventListener("click", async () => {
    const stars = starsRow.querySelectorAll(".star.filled").length;
    const text =
      `🐾 구구단 동물 친구 결과!\n` +
      `${"⭐".repeat(stars)}${"☆".repeat(3 - stars)} ${resultDans.textContent} 도전\n` +
      `정답률 ${resultAccuracy.textContent} · 최고 콤보 ${resultBestStreak.textContent} · 하트 ${resultCoins.textContent}개\n\n` +
      `나도 도전해보기 👉`;

    const shareData = { title: "구구단 동물 친구 결과", text, url: location.href };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${location.href}`);
      showToast("결과가 복사되었어요! 친구에게 붙여넣기 해보세요 📋");
    } catch (e) {
      showToast("이 브라우저에서는 공유하기를 지원하지 않아요 😅");
    }
  });

  // ---------- 초기화 ----------
  buildDanGrid();
  updateMetaStats();
  showScreen("start");
})();
