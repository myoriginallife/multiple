(() => {
  "use strict";

  // ---------- 상태 ----------
  const state = {
    selectedDans: new Set([2, 3, 4, 5]),
    questionCount: 15,
    questions: [],
    currentIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    locked: false,
  };

  const MASCOTS = ["🦊", "🐰", "🐼", "🐸", "🐯", "🦁", "🐨"];
  const CHEERS = ["참 잘했어요! 👏", "정답이에요! 😄", "최고예요! ⭐", "완벽해요! 🎯", "멋져요! 🌟"];
  const CONSOLES = ["아쉬워요! 다시 해봐요 💪", "괜찮아요, 다음엔 맞출 거예요!", "조금만 더 힘내요! 🙂"];

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

  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");
  const progressEl = document.getElementById("progress");
  const totalEl = document.getElementById("total");
  const progressBar = document.getElementById("progressBar");
  const questionEl = document.getElementById("question");
  const choicesEl = document.getElementById("choices");
  const feedbackEl = document.getElementById("feedback");
  const mascotEl = document.getElementById("mascot");

  const resultTitle = document.getElementById("resultTitle");
  const resultCorrect = document.getElementById("resultCorrect");
  const resultAccuracy = document.getElementById("resultAccuracy");
  const resultBestStreak = document.getElementById("resultBestStreak");
  const resultScore = document.getElementById("resultScore");
  const resultBadge = document.getElementById("resultBadge");
  const retryBtn = document.getElementById("retryBtn");
  const homeBtn = document.getElementById("homeBtn");

  // ---------- 화면 전환 ----------
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ---------- 시작 화면: 단 선택 ----------
  function buildDanGrid() {
    danGrid.innerHTML = "";
    for (let dan = 2; dan <= 9; dan++) {
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
      danGrid.appendChild(btn);
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
      let candidate = answer + offset;
      if (candidate < 0 || candidate === answer) continue;
      choices.add(candidate);
    }
    return shuffle([...choices]);
  }

  function buildQuestions() {
    const dans = [...state.selectedDans];
    const questions = [];
    for (let i = 0; i < state.questionCount; i++) {
      const dan = dans[randInt(0, dans.length - 1)];
      const multiplier = randInt(1, 9);
      const answer = dan * multiplier;
      questions.push({
        a: dan,
        b: multiplier,
        answer,
        choices: makeChoices(answer),
      });
    }
    return questions;
  }

  // ---------- 게임 시작 ----------
  startBtn.addEventListener("click", () => {
    if (state.selectedDans.size === 0) {
      startError.textContent = "단을 최소 1개 이상 선택해주세요! 🙏";
      return;
    }
    startError.textContent = "";

    state.questions = buildQuestions();
    state.currentIndex = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.correctCount = 0;

    totalEl.textContent = String(state.questionCount);
    showScreen("game");
    renderQuestion();
  });

  // ---------- 문제 렌더링 ----------
  function renderQuestion() {
    state.locked = false;
    const q = state.questions[state.currentIndex];

    scoreEl.textContent = String(state.score);
    streakEl.textContent = String(state.streak);
    progressEl.textContent = String(state.currentIndex + 1);
    progressBar.style.width = `${(state.currentIndex / state.questionCount) * 100}%`;

    mascotEl.textContent = MASCOTS[randInt(0, MASCOTS.length - 1)];
    questionEl.textContent = `${q.a} × ${q.b} = ?`;
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";

    choicesEl.innerHTML = "";
    q.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = String(choice);
      btn.addEventListener("click", () => handleAnswer(choice, btn, q));
      choicesEl.appendChild(btn);
    });
  }

  function handleAnswer(choice, btn, q) {
    if (state.locked) return;
    state.locked = true;

    const buttons = [...choicesEl.querySelectorAll(".choice-btn")];
    buttons.forEach((b) => (b.disabled = true));

    const isCorrect = choice === q.answer;

    if (isCorrect) {
      btn.classList.add("correct");
      state.score += 10 + state.streak * 2;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.correctCount += 1;
      feedbackEl.textContent = CHEERS[randInt(0, CHEERS.length - 1)];
      feedbackEl.className = "feedback correct";
    } else {
      btn.classList.add("wrong");
      const correctBtn = buttons.find((b) => Number(b.textContent) === q.answer);
      if (correctBtn) correctBtn.classList.add("correct");
      state.streak = 0;
      feedbackEl.textContent = `${CONSOLES[randInt(0, CONSOLES.length - 1)]} 정답: ${q.answer}`;
      feedbackEl.className = "feedback wrong";
    }

    scoreEl.textContent = String(state.score);
    streakEl.textContent = String(state.streak);

    setTimeout(() => {
      state.currentIndex += 1;
      if (state.currentIndex >= state.questions.length) {
        finishGame();
      } else {
        renderQuestion();
      }
    }, 1100);
  }

  // ---------- 결과 화면 ----------
  function finishGame() {
    progressBar.style.width = "100%";
    const accuracy = Math.round((state.correctCount / state.questionCount) * 100);

    resultCorrect.textContent = `${state.correctCount} / ${state.questionCount}`;
    resultAccuracy.textContent = `${accuracy}%`;
    resultBestStreak.textContent = String(state.bestStreak);
    resultScore.textContent = String(state.score);

    let title, badge;
    if (accuracy === 100) {
      title = "🏆 완벽해요!";
      badge = "구구단 마스터 뱃지 획득! 🥇";
    } else if (accuracy >= 80) {
      title = "🎉 아주 잘했어요!";
      badge = "실력자 뱃지 획득! 🥈";
    } else if (accuracy >= 50) {
      title = "👍 잘하고 있어요!";
      badge = "계속 연습해봐요! 🥉";
    } else {
      title = "💪 다시 도전해봐요!";
      badge = "조금만 더 연습하면 금방 늘 거예요!";
    }
    resultTitle.textContent = title;
    resultBadge.textContent = badge;

    showScreen("result");
  }

  retryBtn.addEventListener("click", () => {
    state.currentIndex = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.correctCount = 0;
    state.questions = buildQuestions();
    totalEl.textContent = String(state.questionCount);
    showScreen("game");
    renderQuestion();
  });

  homeBtn.addEventListener("click", () => {
    showScreen("start");
  });

  // ---------- 초기화 ----------
  buildDanGrid();
  showScreen("start");
})();
