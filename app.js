// ============================================
// app.js — メインロジック
// ============================================

// --- 音声エンジン ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playTone(freq, type, dur) {
    try {
        if (!audioCtx) audioCtx = new AudioCtx();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, audioCtx.currentTime);
        g.gain.setValueAtTime(0.1, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + dur);
    } catch(e) { console.log("音声エラー:", e); }
}

function playCorrect() {
    playTone(523.25, 'sine', 0.2);
    safeTimeout(() => playTone(659.25, 'sine', 0.2), 100);
    safeTimeout(() => playTone(783.99, 'sine', 0.3), 200);
}

function playWrong() {
    playTone(196, 'sawtooth', 0.3);
    safeTimeout(() => playTone(185, 'sawtooth', 0.3), 50);
}

function playTrainMove() {
    playTone(150, 'sawtooth', 0.1);
    safeTimeout(() => playTone(120, 'sawtooth', 0.1), 100);
}

function playCrossing() {
    for(let i=0; i<4; i++) {
        safeTimeout(() => playTone(880, 'sine', 0.15), i * 600);
        safeTimeout(() => playTone(740, 'sine', 0.15), i * 600 + 300);
    }
}

// --- セーブデータ ---
const SAVE_KEY = 'densha_benkyou_v1';
let state = loadState();

function defaultState() {
    return {
        totalCorrect: 0, totalLevel: 1, stamps: [], medals: [],
        weakKanji: {}, weakAddSub: {}, weakMul: {}, weakReading: {},
        todayStamps: 0, todayDate: null
    };
}

function loadState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) return { ...defaultState(), ...JSON.parse(raw) };
    } catch(e) { console.log("セーブ読込失敗:", e); }
    return defaultState();
}

function saveState() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch(e) { console.log("セーブ失敗:", e); }
}

// --- 電車の絵文字取得 ---
function getTrainEmoji() {
    const level = state.totalLevel || 1;
    let current = TRAIN_DEFS[0];
    for (const def of TRAIN_DEFS) {
        if (level >= def.minLevel) current = def;
    }
    return current.emoji;
}

// --- ゲームステート ---
let game = { mode: '', questions: [], idx: 0, sessionCorrect: 0, isAnswering: false, subStep: 0, grade: 1 };
let activeTimeouts = [];

function safeTimeout(fn, delay) {
    const id = setTimeout(() => {
        fn();
        activeTimeouts = activeTimeouts.filter(t => t !== id);
    }, delay);
    activeTimeouts.push(id);
    return id;
}

function clearAllTimeouts() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];
}

// --- 画面遷移 ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
    
    const header = document.getElementById('global-header');
    if (header) header.style.display = (id === 'home') ? 'none' : 'flex';
    
    const starCount = document.getElementById('star-count');
    if (starCount) starCount.innerText = state.totalCorrect;
    
    if (id === 'home') {
        const hero = document.querySelector('.home-hero');
        if (hero) {
            hero.innerText = getTrainEmoji();
            hero.classList.add('train-arrival');
            safeTimeout(() => hero.classList.remove('train-arrival'), 1000);
        }
    }
}

function goHome() { clearAllTimeouts(); showScreen('home'); }
function showMathSelect() { 
    clearAllTimeouts();
    const danBtn = document.querySelector('button[onclick="showDanSelect()"]');
    if (danBtn) danBtn.style.display = (game.grade === 1) ? 'none' : 'flex';
    showScreen('math-select'); 
}
function showDanSelect() { clearAllTimeouts(); showScreen('dan-select'); }

// --- 学年切替 ---
function setGrade(g) {
    game.grade = g;
    document.querySelectorAll('.grade-tab').forEach(t => {
        t.classList.toggle('active', parseInt(t.dataset.grade) === g);
    });
}

// --- 漢字クイズ開始 ---
function startKanji() {
    console.log("startKanji called. Grade:", game.grade);
    const data = game.grade === 1 ? KANJI_G1 : KANJI_G2;
    if (!data || data.length === 0) {
        alert("エラー：かんじの データが ありません");
        return;
    }
    const pool = shuffle([...data]).slice(0, QUESTIONS_PER_GAME).map(q => {
        // 選択肢(c)がない場合、他のデータの読み(a)からランダムに生成
        if (!q.c) {
            q.c = makeKanjiChoices(q.a, data);
        }
        return q;
    });
    setupGame('kanji', pool);
}

// --- 算数クイズ開始 ---
function startMath(mode, option) {
    let pool = [];
    if (mode === 'word') {
        pool = shuffle([...WORD_PROBLEMS]).slice(0, QUESTIONS_PER_GAME);
    } else {
        for (let i = 0; i < QUESTIONS_PER_GAME; i++) {
            if (mode === 'addsub') pool.push(game.grade === 2 ? generateAddSubG2() : generateAddSub());
            else if (mode === 'mul') pool.push(generateMul(option));
        }
    }
    setupGame(mode, pool);
}

// --- ゲーム初期化 ---
function setupGame(mode, questions) {
    clearAllTimeouts();
    game = { ...game, mode, questions, idx: 0, sessionCorrect: 0, isAnswering: false, subStep: 0 };
    
    const m = document.getElementById('station-markers');
    if (m) {
        m.innerHTML = '';
        for (let i = 0; i < questions.length; i++) {
            const n = document.createElement('div');
            n.className = 'station-node';
            m.appendChild(n);
        }
    }
    
    renderQuestion();
    showScreen('game');
}

// --- 問題表示 ---
function renderQuestion() {
    const q = game.questions[game.idx];
    if (!q) {
        console.error("No question at index", game.idx);
        goHome();
        return;
    }

    const display = document.getElementById('question-display');
    const text = document.getElementById('question-text');
    const stepLabel = document.getElementById('step-label');
    const hintBubble = document.getElementById('hint-bubble');
    const hintBtn = document.getElementById('hint-btn');

    if (display) {
        display.innerHTML = '';
        display.style.fontSize = '';
    }
    if (text) text.innerText = '';
    if (stepLabel) stepLabel.innerText = '';
    if (hintBubble) hintBubble.classList.remove('show');
    if (hintBtn) hintBtn.style.display = 'none';

    if (game.mode === 'word') {
        if (text) text.innerText = game.subStep === 0 ? "しきは どれ？" : "こたえは どれ？";
        if (stepLabel) stepLabel.innerText = game.subStep === 0 ? "1/2" : "2/2";
        const div = document.createElement('div');
        div.className = 'word-problem-text';
        q.text.forEach((line, i) => {
            const l = document.createElement('div');
            l.className = 'word-line';
            l.innerHTML = `<span>${q.emojis[i]}</span><span>${line}</span>`;
            div.appendChild(l);
        });
        if (display) display.appendChild(div);
    } else if (game.mode === 'kanji') {
        if (text) text.innerText = "この かんじ なんて よむ？";
        if (display) {
            display.innerText = q.q;
            display.style.fontSize = '72px';
        }
        if (q.hint && hintBtn) hintBtn.style.display = 'block';
    } else {
        if (text) text.innerText = "こたえは どれ？";
        if (display) {
            display.innerText = q.q;
            display.style.fontSize = '48px';
        }
        if (hintBtn) hintBtn.style.display = 'block';
    }

    const choices = (game.mode === 'word') ? (game.subStep === 0 ? q.fc : q.ac) : q.c;
    const grid = document.getElementById('choice-grid');
    if (grid) {
        grid.innerHTML = '';
        shuffle([...choices]).forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.innerText = c;
            btn.onclick = () => checkAnswer(c);
            grid.appendChild(btn);
        });
    }

    const train = document.getElementById('game-train');
    if (train) {
        train.innerText = getTrainEmoji();
        const trackW = document.querySelector('.track-line').offsetWidth;
        const total = game.questions.length;
        train.style.left = (20 + (trackW / Math.max(total - 1, 1)) * game.idx) + 'px';
    }

    document.querySelectorAll('.station-node').forEach((n, i) => {
        n.classList.toggle('passed', i < game.idx);
        n.classList.toggle('current', i === game.idx);
    });

    game.isAnswering = true;
}

// --- ヒント表示 ---
function showHint() {
    const q = game.questions[game.idx];
    const bubble = document.getElementById('hint-bubble');
    if (!bubble) return;
    
    if (game.mode === 'kanji') {
        if (!q.hint) return;
        bubble.innerHTML = `<span class="hint-emoji">${q.hint}</span><span>${q.hintText}</span>`;
    } else {
        bubble.innerHTML = `<div style="margin-bottom:5px;">そろばん ヒント</div>`;
        const container = document.createElement('div');
        container.className = 'soroban-container';
        if (q.nums) {
            q.nums.forEach((n, i) => {
                container.appendChild(renderSorobanRow(n, i === 0 ? 'red' : 'blue'));
            });
        }
        bubble.appendChild(container);
        safeTimeout(() => {
            bubble.querySelectorAll('.bead-group').forEach(g => {
                g.style.transform = 'translateX(0)';
            });
        }, 50);
    }
    bubble.classList.toggle('show');
}

function renderSorobanRow(num, color) {
    const row = document.createElement('div');
    row.className = 'soroban-row';
    const group = document.createElement('div');
    group.className = 'bead-group';
    group.style.transform = 'translateX(-200px)';
    for (let i = 0; i < 10; i++) {
        const bead = document.createElement('div');
        bead.className = 'bead';
        if (color === 'blue') bead.classList.add('blue');
        if (i >= 5) bead.style.filter = 'brightness(1.2)';
        if (i >= num) bead.style.opacity = '0.1';
        group.appendChild(bead);
    }
    row.appendChild(group);
    return row;
}

// --- 回答チェック ---
function checkAnswer(selected) {
    if (!game.isAnswering) return;
    game.isAnswering = false;

    const q = game.questions[game.idx];
    let correctVal = (game.mode === 'word') ? (game.subStep === 0 ? q.f : q.a) : q.a;
    const isCorrect = (String(selected) === String(correctVal));

    document.querySelectorAll('.choice-btn').forEach(b => {
        if (String(b.innerText) === String(correctVal)) b.classList.add('correct');
        else if (String(b.innerText) === String(selected) && !isCorrect) b.classList.add('wrong');
    });

    if (isCorrect) {
        playCorrect();
        playTrainMove();
        if (game.mode === 'word' && game.subStep === 0) {
            safeTimeout(() => { game.subStep = 1; renderQuestion(); }, 1000);
        } else {
            showPraise();
            game.sessionCorrect++;
            state.totalCorrect++;
            state.totalLevel = Math.floor(state.totalCorrect / LEVEL_UNIT) + 1;
            saveState();
            safeTimeout(() => {
                game.idx++;
                game.subStep = 0;
                if (game.idx >= game.questions.length) showClearScreen();
                else renderQuestion();
            }, CORRECT_DELAY);
        }
    } else {
        playWrong();
        if (!(game.mode === 'word' && game.subStep === 0)) {
            game.questions.splice(game.idx + 2, 0, { ...q });
        }
        safeTimeout(() => {
            if (game.mode === 'word' && game.subStep === 0) { game.subStep = 1; renderQuestion(); }
            else renderQuestion();
        }, WRONG_DELAY);
    }
}

// --- 演出 ---
function showPraise() {
    const p = PRAISES[Math.floor(Math.random() * PRAISES.length)];
    const overlay = document.getElementById('praise-overlay');
    const emoji = document.getElementById('praise-emoji');
    const text = document.getElementById('praise-text');
    if (!overlay || !emoji || !text) return;

    emoji.innerText = p.e;
    text.innerText = p.t;
    overlay.style.opacity = "1";
    emoji.style.transform = "scale(1)";
    text.style.opacity = "1";
    text.style.transform = "translateY(0)";
    for (let i = 0; i < CONFETTI_COUNT; i++) createFirework();
    safeTimeout(() => {
        overlay.style.opacity = "0";
        emoji.style.transform = "scale(0)";
        text.style.opacity = "0";
        text.style.transform = "translateY(50px)";
    }, 1200);
}

function createFirework() {
    const f = document.createElement('div');
    f.className = 'firework';
    f.style.left = '50%'; f.style.top = '50%';
    f.style.backgroundColor = `hsl(${Math.random()*360}, 100%, 50%)`;
    document.body.appendChild(f);
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 200;
    f.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) scale(0)`, opacity: 0 }
    ], { duration: 1000, easing: 'ease-out' }).onfinish = () => f.remove();
}

// --- クリア画面 ---
function showClearScreen() {
    playCrossing();
    const today = new Date().toISOString().split('T')[0];
    if (state.todayDate !== today) { state.todayStamps = 0; state.todayDate = today; }
    state.todayStamps++;
    if (!state.stamps.includes(today)) state.stamps.push(today);
    MEDAL_DEFS.forEach(m => { if (!state.medals.includes(m.id) && m.check(state)) state.medals.push(m.id); });
    saveState();

    const medal = state.totalLevel >= 10 ? '👑' : state.totalLevel >= 5 ? '🥇' : state.totalLevel >= 3 ? '🥈' : '🥉';
    const medalEl = document.getElementById('clear-medal');
    if (medalEl) medalEl.innerText = medal;
    const correctEl = document.getElementById('clear-correct');
    if (correctEl) correctEl.innerText = game.sessionCorrect;
    const totalEl = document.getElementById('clear-total');
    if (totalEl) totalEl.innerText = game.questions.length;
    const levelEl = document.getElementById('clear-level');
    if (levelEl) levelEl.innerText = state.totalLevel;
    showScreen('clear');
}

// --- ごほうび画面 ---
function showRecord() {
    const grid = document.getElementById('stamp-grid');
    if (grid) {
        grid.innerHTML = '';
        for (let i = 0; i < 10; i++) {
            const cell = document.createElement('div');
            cell.className = 'stamp-cell' + (i < state.todayStamps ? ' earned' : '');
            cell.innerText = i < state.todayStamps ? '🎫' : '';
            grid.appendChild(cell);
        }
    }
    const list = document.getElementById('medal-list');
    if (list) {
        list.innerHTML = '';
        MEDAL_DEFS.forEach(m => {
            const item = document.createElement('div');
            const earned = state.medals.includes(m.id);
            item.className = 'medal-item' + (earned ? '' : ' locked');
            item.innerHTML = `<span class="medal-emoji">${earned ? m.emoji : '🔒'}</span><span class="medal-label">${m.label}</span>`;
            list.appendChild(item);
        });
    }
    const sCorrect = document.getElementById('stat-correct');
    if (sCorrect) sCorrect.innerText = state.totalCorrect;
    const sLevel = document.getElementById('stat-level');
    if (sLevel) sLevel.innerText = state.totalLevel;
    const sDays = document.getElementById('stat-days');
    if (sDays) sDays.innerText = state.stamps.length;
    showScreen('record');
}

function resetData() {
    if (confirm('ほんとうに きろくを ぜんぶ けしますか？')) {
        state = defaultState();
        saveState();
        goHome();
    }
}

// --- 算数問題生成 ---
function generateAddSub() {
    const isAdd = Math.random() > 0.5;
    let a, b, ans;
    if (isAdd) { ans = Math.floor(Math.random() * 9) + 2; a = Math.floor(Math.random() * (ans - 1)) + 1; b = ans - a; }
    else { a = Math.floor(Math.random() * 9) + 2; b = Math.floor(Math.random() * (a - 1)) + 1; ans = a - b; }
    return { q: `${a} ${isAdd ? '＋' : '－'} ${b} ＝ ？`, a: ans, c: makeNumChoices(ans, 0, 10), nums: [a, b] };
}

function generateAddSubG2() {
    const isAdd = Math.random() > 0.5;
    let a, b, ans;
    if (isAdd) { a = Math.floor(Math.random() * 15) + 3; b = Math.floor(Math.random() * 10) + 1; ans = a + b; if (ans > 20) { b = 20 - a; ans = 20; } }
    else { a = Math.floor(Math.random() * 11) + 10; b = Math.floor(Math.random() * (a - 1)) + 1; if (b > 10) b = 10; ans = a - b; }
    return { q: `${a} ${isAdd ? '＋' : '－'} ${b} ＝ ？`, a: ans, c: makeNumChoices(ans, 0, 30), nums: [a, b] };
}

function generateMul(dan) {
    const d = (dan === 'all') ? (Math.floor(Math.random() * 8) + 2) : dan;
    const b = Math.floor(Math.random() * 9) + 1;
    const ans = d * b;
    return { q: `${d} × ${b} ＝ ？`, a: ans, c: makeNumChoices(ans, 1, 81), nums: [d, b] };
}

function makeKanjiChoices(ans, allData) {
    const s = new Set([ans]);
    const uniqueReadings = [...new Set(allData.map(d => d.a))];
    while (s.size < 4 && s.size < uniqueReadings.length) {
        const r = uniqueReadings[Math.floor(Math.random() * uniqueReadings.length)];
        s.add(r);
    }
    return shuffle([...s]);
}

function makeNumChoices(ans, min, max) {
    const s = new Set([ans]);
    while (s.size < 4) {
        const d = Math.floor(Math.random() * 11) - 5;
        const v = ans + (d === 0 ? 3 : d);
        if (v >= min && v <= max) s.add(v);
    }
    return [...s];
}

// --- なぞりがき ---
let traceState = { kanji: [], idx: 0, drawing: false, svgCache: {}, animating: false };

function kanjiVgUrl(char) {
    const hex = char.charCodeAt(0).toString(16).padStart(5, '0');
    return `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;
}

function showTrace() {
    traceState.kanji = game.grade === 1 ? [...TRACE_KANJI_G1] : [...TRACE_KANJI_G2];
    traceState.idx = 0;
    showScreen('trace');
    renderTrace();
}

async function renderTrace() {
    const k = traceState.kanji[traceState.idx];
    const traceCounter = document.getElementById('trace-counter');
    if (traceCounter) traceCounter.innerText = `${traceState.idx + 1} / ${traceState.kanji.length}`;
    const allKanji = [...KANJI_G1, ...KANJI_G2];
    const found = allKanji.find(d => d.q === k);
    const traceReading = document.getElementById('trace-reading');
    if (traceReading) traceReading.innerText = found ? `よみ: ${found.a}` : '';
    
    const guideText = document.getElementById('trace-guide');
    const svgContainer = document.getElementById('trace-svg-container');
    if (guideText) guideText.style.opacity = '1';
    if (svgContainer) svgContainer.style.opacity = '1';

    await loadStrokeGuide(k);
    clearCanvas();
    const btnJudge = document.getElementById('btn-trace-judge');
    const btnNext = document.getElementById('btn-trace-next');
    const hanamaru = document.getElementById('hanamaru-overlay');
    if (btnJudge) btnJudge.style.display = 'flex';
    if (btnNext) btnNext.style.display = 'none';
    if (hanamaru) hanamaru.classList.remove('hanamaru-anime');
}

async function loadStrokeGuide(kanji) {
    const container = document.getElementById('trace-svg-container');
    const guideText = document.getElementById('trace-guide');
    const statusEl = document.getElementById('trace-status');
    if (container) container.innerHTML = '';
    if (guideText) { guideText.innerText = kanji; guideText.style.display = 'flex'; }
    if (traceState.svgCache[kanji]) { displaySvgStrokes(traceState.svgCache[kanji], container, guideText); return; }
    try {
        if (statusEl) statusEl.innerText = 'よみこみちゅう...';
        const res = await fetch(kanjiVgUrl(kanji));
        if (!res.ok) throw new Error('SVGなし');
        const svgText = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const strokes = [];
        doc.querySelectorAll('path').forEach(p => { const d = p.getAttribute('d'); if (d) strokes.push(d); });
        if (strokes.length > 0) {
            traceState.svgCache[kanji] = strokes;
            displaySvgStrokes(strokes, container, guideText);
            if (statusEl) statusEl.innerText = `${strokes.length}かく`;
        }
    } catch (e) { console.log('KanjiVGエラー:', e); }
}

function displaySvgStrokes(strokes, container, guideText) {
    if (guideText) guideText.style.display = 'none';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 109 109');
    svg.style.width = '100%'; svg.style.height = '100%';
    svg.style.position = 'absolute'; svg.style.pointerEvents = 'none';
    strokes.forEach((d, i) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#ccc');
        path.setAttribute('stroke-width', '4'); path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
        const startMatch = d.match(/[Mm]\s*([\d.]+)[,\s]+([\d.]+)/);
        if (startMatch) {
            const numEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            numEl.setAttribute('x', parseFloat(startMatch[1]) - 2); numEl.setAttribute('y', parseFloat(startMatch[2]) - 2);
            numEl.setAttribute('font-size', '8'); numEl.setAttribute('fill', '#ff7675');
            numEl.textContent = i + 1; svg.appendChild(numEl);
        }
    });
    if (container) container.appendChild(svg);
}

async function playStrokeAnimation() {
    if (traceState.animating) return;
    const k = traceState.kanji[traceState.idx];
    const strokes = traceState.svgCache[k];
    if (!strokes) return;
    traceState.animating = true;
    clearCanvas();
    try {
        const svg = document.getElementById('trace-svg-container').querySelector('svg');
        if (!svg) throw new Error('SVGなし');
        const paths = svg.querySelectorAll('path');
        paths.forEach(p => { p.setAttribute('stroke', '#eee'); p.style.strokeDasharray = ''; });
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            const len = path.getTotalLength();
            if (len <= 0) continue;
            path.setAttribute('stroke', '#e74c3c');
            path.style.strokeDasharray = len;
            path.style.strokeDashoffset = len;
            await new Promise(resolve => {
                const anim = path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 600, fill: 'forwards' });
                const safety = setTimeout(() => { finish(); }, 1000);
                function finish() {
                    clearTimeout(safety);
                    path.style.strokeDashoffset = '0';
                    path.setAttribute('stroke', '#1a3a5c');
                    resolve();
                }
                anim.onfinish = finish;
            });
            await new Promise(r => setTimeout(r, 200));
        }
        await new Promise(r => setTimeout(r, 600));
        paths.forEach(p => p.setAttribute('stroke', '#ccc'));
    } catch (e) { console.error('Anim Error:', e); }
    finally { traceState.animating = false; }
}

function judgeTrace() {
    const score = checkTraceQuality();
    const statusEl = document.getElementById('trace-status');
    if (score > 40) {
        if (statusEl) { statusEl.innerText = "はなまる！！"; statusEl.style.color = "#ff3f34"; }
        playCorrect(); showHanamaru();
        state.totalCorrect++; saveState();
        const starCount = document.getElementById('star-count');
        if (starCount) starCount.innerText = state.totalCorrect;
        document.getElementById('btn-trace-judge').style.display = 'none';
        document.getElementById('btn-trace-next').style.display = 'flex';
    } else {
        if (statusEl) { statusEl.innerText = "もっと かいてみよう！"; statusEl.style.color = "#ff7675"; }
        playWrong();
    }
}

function showHanamaru() {
    const el = document.getElementById('hanamaru-overlay');
    if (!el) return;
    el.classList.remove('hanamaru-anime');
    void el.offsetWidth;
    el.classList.add('hanamaru-anime');
}

function checkTraceQuality() {
    const canvas = document.getElementById('trace-canvas');
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const svg = document.getElementById('trace-svg-container').querySelector('svg');
    if (!svg) return 100;
    const paths = svg.querySelectorAll('path');
    let totalPoints = 0, coveredPoints = 0;
    paths.forEach(path => {
        const length = path.getTotalLength();
        for (let i = 0; i <= 15; i++) {
            const pt = path.getPointAtLength(length * (i / 15));
            const x = (pt.x / 109) * canvas.width, y = (pt.y / 109) * canvas.height;
            if (isPointCovered(imgData, x, y, canvas.width, canvas.height)) coveredPoints++;
            totalPoints++;
        }
    });
    return (coveredPoints / totalPoints) * 100;
}

function isPointCovered(data, x, y, w, h) {
    const px = Math.floor(x), py = Math.floor(y);
    const idx = (py * w + px) * 4 + 3;
    return data[idx] > 50;
}

function clearCanvas() {
    const canvas = document.getElementById('trace-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a3a5c'; ctx.lineWidth = 10; ctx.lineCap = 'round';
}

function nextTrace() { traceState.idx++; if (traceState.idx >= traceState.kanji.length) traceState.idx = 0; renderTrace(); }
function prevTrace() { traceState.idx--; if (traceState.idx < 0) traceState.idx = traceState.kanji.length - 1; renderTrace(); }

function initTraceCanvas() {
    const canvas = document.getElementById('trace-canvas');
    if (!canvas) return;
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) };
    }
    canvas.addEventListener('touchstart', (e) => {
        if (traceState.animating) return; e.preventDefault();
        traceState.drawing = true;
        
        // 書き始めたらガイドを薄くして記憶を促す
        const guideText = document.getElementById('trace-guide');
        const svgContainer = document.getElementById('trace-svg-container');
        if (guideText) guideText.style.opacity = '0.1';
        if (svgContainer) svgContainer.style.opacity = '0.2';

        const ctx = canvas.getContext('2d'); const p = getPos(e);
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        if (!traceState.drawing) return; e.preventDefault();
        const ctx = canvas.getContext('2d'); const p = getPos(e);
        ctx.lineTo(p.x, p.y); ctx.stroke();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { traceState.drawing = false; });
}

function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

function createClouds() {
    for (let i = 0; i < 5; i++) {
        const c = document.body.appendChild(document.createElement('div'));
        c.className = 'cloud';
        const s = 50 + Math.random() * 100;
        c.style.width = s + 'px'; c.style.height = s * 0.6 + 'px';
        c.style.top = (Math.random() * 60) + '%';
        c.style.animation = `moveCloud ${25 + Math.random() * 20}s linear infinite`;
        c.style.animationDelay = `-${Math.random() * 25}s`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    createClouds();
    initTraceCanvas();
    const today = new Date().toISOString().split('T')[0];
    if (state.todayDate !== today) { state.todayStamps = 0; state.todayDate = today; saveState(); }
    const starCount = document.getElementById('star-count');
    if (starCount) starCount.innerText = state.totalCorrect;
});
