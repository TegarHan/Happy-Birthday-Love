/* =========================================
ELEMENTS
========================================= */

const startButton = document.getElementById("startButton");
const statusText = document.getElementById("status");
const video = document.getElementById("webcam");
const flame = document.getElementById("flame");
const candleSection = document.querySelector(".candle-section");
const celebration = document.getElementById("celebration");
const restartButton = document.getElementById("restartButton");
const continueButton = document.getElementById("continueButton");
const confettiContainer = document.getElementById("confettiContainer");
const skipButton = document.getElementById("skipButton");

let audioContext;
let analyser;
let micStream;
let rafId;
let blowFrameCount = 0;
let candleBlownOut = false;

const BLOW_THRESHOLD = 28;
const BLOW_FRAMES_NEEDED = 6;

/* =========================================
KUNCI SCROLL SAMPAI LILIN DITIUP
========================================= */

// Kunci scroll begitu halaman dimuat — user hanya bisa lihat section hero
document.documentElement.classList.add("stage-locked");

function unlockScroll() {
    document.documentElement.classList.remove("stage-locked");
}

/* =========================================
CANDLE BLOW DETECTION (via mikrofon)
========================================= */

startButton.addEventListener("click", initCamera);
restartButton.addEventListener("click", resetExperience);

continueButton.addEventListener("click", () => {
    celebration.classList.remove("show");
    unlockScroll();
    document.getElementById("intro").scrollIntoView({ behavior: "smooth" });
});

if (skipButton) {
    skipButton.addEventListener("click", () => {
        unlockScroll();
        document.getElementById("intro").scrollIntoView({ behavior: "smooth" });
    });
}

async function initCamera() {

    try {

        statusText.textContent = "Meminta akses kamera & mikrofon...";

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: true
        });

        micStream = stream;
        video.srcObject = stream;

        statusText.textContent = "Arahkan wajah ke layar, lalu tiup lilinnya 🎂";
        startButton.style.display = "none";

        setupBlowDetection(stream);

    } catch (error) {

        console.error(error);
        statusText.textContent = "Gagal: " + error.name + " — " + error.message;

        // Kalau kamera/mikrofon gagal, tampilkan opsi lewati supaya user tidak terjebak
        if (skipButton) {
            skipButton.classList.add("visible");
        }

    }

}

function setupBlowDetection(stream) {

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);

    function checkVolume() {

        if (candleBlownOut) return;

        analyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = dataArray[i] - 128;
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        if (rms > BLOW_THRESHOLD) {
            blowFrameCount++;
            if (blowFrameCount >= BLOW_FRAMES_NEEDED) {
                blowOutCandle();
                return;
            }
        } else {
            blowFrameCount = Math.max(0, blowFrameCount - 1);
        }

        rafId = requestAnimationFrame(checkVolume);

    }

    rafId = requestAnimationFrame(checkVolume);

}

function blowOutCandle() {

    candleBlownOut = true;
    cancelAnimationFrame(rafId);

    statusText.textContent = "Lilin padam! 🎉";
    flame.classList.add("extinguished");
    candleSection.classList.add("smoking");

    setTimeout(showCelebration, 1400);

}

function showCelebration() {
    celebration.classList.add("show");
    spawnConfetti();
    playHappyBirthdayTune();
}

function spawnConfetti() {

    const colors = ["#e88fb3", "#ffcfa8", "#b9a4e0", "#ffffff", "#d1668f"];
    confettiContainer.innerHTML = "";

    for (let i = 0; i < 60; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";
        piece.style.left = Math.random() * 100 + "%";
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (2.5 + Math.random() * 2) + "s";
        piece.style.animationDelay = (Math.random() * 1.5) + "s";
        piece.style.setProperty("--rotate", (Math.random() * 360) + "deg");
        confettiContainer.appendChild(piece);
    }

}

function playHappyBirthdayTune() {

    const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();

    const C = 261.63, D = 293.66, E = 329.63, F = 349.23, G = 392.0, Ah = 880.0;

    const melody = [
        [C, 0.3], [C, 0.2], [D, 0.5], [C, 0.5], [F, 0.5], [E, 1.0],
        [C, 0.3], [C, 0.2], [D, 0.5], [C, 0.5], [G, 0.5], [F, 1.0],
        [C, 0.3], [C, 0.2], [Ah, 0.5], [F, 0.5], [E, 0.5], [D, 1.0],
    ];

    let time = ctx.currentTime + 0.1;

    melody.forEach(([freq, duration]) => {

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.25, time + 0.05);
        gain.gain.linearRampToValueAtTime(0, time + duration - 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + duration);

        time += duration;

    });

}

function resetExperience() {

    candleBlownOut = false;
    blowFrameCount = 0;

    celebration.classList.remove("show");
    flame.classList.remove("extinguished");
    candleSection.classList.remove("smoking");

    statusText.textContent = "Arahkan wajah ke layar, lalu tiup lilinnya 🎂";

    if (micStream) {
        setupBlowDetection(micStream);
    }

}


/* =========================================
COUNTDOWN — MENUJU 17 AGUSTUS
========================================= */

function startCountdown() {

    const cdDays = document.getElementById("cdDays");
    const cdHours = document.getElementById("cdHours");
    const cdMinutes = document.getElementById("cdMinutes");
    const cdSeconds = document.getElementById("cdSeconds");
    const countdownNote = document.getElementById("countdownNote");

    function getNextAug17() {
        const now = new Date();
        let target = new Date(now.getFullYear(), 7, 17, 0, 0, 0); // bulan 7 = Agustus (0-indexed)

        // Kalau tanggal 17 Agustus tahun ini sudah lewat, pakai tahun depan
        if (target.getTime() < now.getTime()) {
            target = new Date(now.getFullYear() + 1, 7, 17, 0, 0, 0);
        }

        return target;
    }

    function tick() {

        const now = new Date();
        const target = getNextAug17();
        const diff = target.getTime() - now.getTime();

        // Kalau tepat di tanggal 17 Agustus (hari yang sama)
        const isToday =
            now.getDate() === 17 &&
            now.getMonth() === 7;

        if (isToday) {
            cdDays.textContent = "🎉";
            cdHours.textContent = "🎂";
            cdMinutes.textContent = "🎈";
            cdSeconds.textContent = "✨";
            countdownNote.textContent = "Selamat ulang tahun, Afi!";
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        cdDays.textContent = String(days).padStart(2, "0");
        cdHours.textContent = String(hours).padStart(2, "0");
        cdMinutes.textContent = String(minutes).padStart(2, "0");
        cdSeconds.textContent = String(seconds).padStart(2, "0");

        countdownNote.textContent = "Menghitung hari menuju harimu.";

        requestAnimationFrame(() => setTimeout(tick, 1000));

    }

    tick();

}

startCountdown();


/* =========================================
KOTAK HADIAH -> KOTAK MUSIK
========================================= */

const giftBox = document.getElementById("giftBox");
const giftSparkles = document.getElementById("giftSparkles");
const musicBox = document.getElementById("musicBox");
const musicBoxCore = document.getElementById("musicBoxCore");
const musicBoxHint = document.getElementById("musicBoxHint");
const musicBoxAudio = document.getElementById("musicBoxAudio");
const musicBoxPhotos = document.getElementById("musicBoxPhotos");

let slideshowInterval = null;
let slideshowIndex = 0;

// --- STAGE 1: buka kotak hadiah ---
if (giftBox) {

    giftBox.addEventListener("click", () => {

        if (giftBox.classList.contains("opening")) return;

        giftBox.classList.add("opening");
        spawnSparkles(giftSparkles);

        setTimeout(() => {
            giftBox.classList.add("hidden");
            musicBox.classList.add("revealed");
        }, 700);

    });

}

function spawnSparkles(container) {

    container.innerHTML = "";

    for (let i = 0; i < 18; i++) {

        const piece = document.createElement("div");
        piece.className = "sparkle-piece";

        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 80;

        piece.style.setProperty("--tx", Math.cos(angle) * distance + "px");
        piece.style.setProperty("--ty", Math.sin(angle) * distance + "px");
        piece.style.animationDelay = (Math.random() * 0.2) + "s";
        piece.style.background = Math.random() > 0.5 ? "var(--peach)" : "var(--rose)";

        container.appendChild(piece);

    }

    setTimeout(() => { container.innerHTML = ""; }, 1000);

}

// --- STAGE 2: tekan kotak musik untuk memutar ---
if (musicBoxCore) {

    musicBoxCore.addEventListener("click", () => {

        if (musicBox.classList.contains("playing")) {
            pauseMusicBox();
        } else {
            playMusicBox();
        }

    });

}

function playMusicBox() {

    musicBoxAudio.play()
        .then(() => {
            musicBox.classList.add("playing");
            musicBoxHint.textContent = "Tekan lagi untuk jeda";
            startPhotoSlideshow();
        })
        .catch((err) => {
            console.error(err);
            alert("Belum ada file musik di assets/musicbox-song.mp3. Tambahkan file lagunya dulu ya.");
        });

}

function pauseMusicBox() {

    musicBoxAudio.pause();
    musicBox.classList.remove("playing");
    musicBoxHint.textContent = "Tekan kotaknya untuk memutar musik";
    stopPhotoSlideshow();

}

function startPhotoSlideshow() {

    const photos = musicBoxPhotos.querySelectorAll("img");
    if (photos.length === 0) return;

    photos.forEach((img) => img.classList.remove("active"));
    slideshowIndex = 0;
    photos[0].classList.add("active");

    stopPhotoSlideshow();

    slideshowInterval = setInterval(() => {

        const currentPhotos = musicBoxPhotos.querySelectorAll("img");
        if (currentPhotos.length === 0) return;

        currentPhotos[slideshowIndex].classList.remove("active");
        slideshowIndex = (slideshowIndex + 1) % currentPhotos.length;
        currentPhotos[slideshowIndex].classList.add("active");

    }, 4000);

}

function stopPhotoSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
}
