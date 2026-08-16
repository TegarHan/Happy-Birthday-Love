/* =========================================
ELEMENTS
========================================= */

const startButton = document.getElementById("startButton");
const statusText = document.getElementById("status");
const video = document.getElementById("webcam");
const flames = document.querySelectorAll(".flame-piece");
const flameShrinks = document.querySelectorAll(".flame-shrink");
const blowMeterFill = document.getElementById("blowMeterFill");
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
let candleBlownOut = false;

let blowPower = 0;        // 0–100, terisi cepat kalau tiupan kencang
let smoothedRms = 0;      // volume yang sudah dihaluskan biar tidak jitter

const BLOW_THRESHOLD_SOFT = 13;   // di atas ini, api mulai bergoyang (tiupan pelan)
const BLOW_THRESHOLD_STRONG = 27; // di atas ini, tiupan dianggap kencang -> progress cepat naik
const BLOW_DECAY_RATE = 1.4;      // kecepatan turun saat tidak ditiup sama sekali

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
    retireHero();
});

if (skipButton) {
    skipButton.addEventListener("click", () => {
        unlockScroll();
        document.getElementById("intro").scrollIntoView({ behavior: "smooth" });
        retireHero();
    });
}

// Setelah lanjut, hilangkan section tiup lilin dari alur halaman
// supaya tidak bisa di-scroll balik ke atas lagi.
function retireHero() {
    const hero = document.getElementById("hero");
    if (!hero) return;

    setTimeout(() => {
        hero.classList.add("retired");

        // Matikan kamera & mikrofon karena sudah tidak dipakai lagi
        if (micStream) {
            micStream.getTracks().forEach((track) => track.stop());
        }
    }, 700); // beri jeda supaya animasi smooth-scroll selesai dulu
}

async function initCamera() {

    try {

        statusText.textContent = "Meminta akses kamera & mikrofon...";

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: {
                // Noise suppression & echo cancellation didesain untuk suara
                // bicara dan cenderung meredam suara tiupan/napas — matikan.
                // Auto-gain TETAP dinyalakan supaya tiupan dari jarak normal
                // (bukan nempel ke lubang mic) tetap cukup terdeteksi.
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: true
            }
        });

        micStream = stream;
        video.srcObject = stream;

        // Beberapa browser (terutama mode Incognito / versi lama) butuh
        // pemanggilan play() secara eksplisit, tidak cukup atribut autoplay saja.
        try {
            await video.play();
        } catch (playError) {
            console.error("video.play() gagal:", playError);
        }

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

    // Di beberapa mobile browser, AudioContext bisa dibuat dalam
    // status "suspended" meski sudah ada user gesture — pastikan aktif.
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);
    let lastMessageBucket = -1;

    function checkVolume() {

        if (candleBlownOut) return;

        analyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = dataArray[i] - 128;
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Haluskan volume supaya reaksi tidak lompat-lompat karena noise
        // sesaat (batuk, ngomong keras sebentar, dsb)
        smoothedRms = smoothedRms * 0.85 + rms * 0.15;

        const isSoftBlow = smoothedRms >= BLOW_THRESHOLD_SOFT && smoothedRms < BLOW_THRESHOLD_STRONG;
        const isStrongBlow = smoothedRms >= BLOW_THRESHOLD_STRONG;

        if (isStrongBlow) {
            // Tiupan kencang: progress naik cepat, bisa langsung padam
            const t = Math.min(1, (smoothedRms - BLOW_THRESHOLD_STRONG) / 35);
            blowPower += 14 + t * 16; // ~14–30 per frame -> padam dalam hitungan sepersekian detik
        } else if (isSoftBlow) {
            // Tiupan pelan: api cuma bergoyang, progress tidak bertambah
            blowPower += 0;
        } else {
            // Tidak ditiup sama sekali: perlahan kembali normal
            blowPower -= BLOW_DECAY_RATE;
        }

        blowPower = Math.max(0, Math.min(100, blowPower));

        updateBlowVisuals(blowPower, isSoftBlow, isStrongBlow);

        // Pesan status berubah sesuai kondisi
        const bucket = isStrongBlow ? 4 : (isSoftBlow ? 1 : 0);
        if (bucket !== lastMessageBucket) {
            lastMessageBucket = bucket;
            statusText.textContent = getBlowMessage(bucket, blowPower);
        }

        if (blowPower >= 100) {
            blowOutCandle();
            return;
        }

        rafId = requestAnimationFrame(checkVolume);

    }

    rafId = requestAnimationFrame(checkVolume);

}

function getBlowMessage(bucket, power) {
    if (bucket === 4) return "Terus, sedikit lagi! 🔥";
    if (bucket === 1) return "Apinya goyang! Tiup lebih kencang untuk memadamkannya";
    return "Arahkan wajah ke layar, lalu tiup lilinnya 🎂";
}

function updateBlowVisuals(power, isSoftBlow, isStrongBlow) {

    const ratio = power / 100;
    const scale = 1 - ratio * 0.75;
    const opacity = 1 - ratio * 0.85;

    flameShrinks.forEach((wrap) => {
        wrap.style.transform = `scale(${scale})`;
        wrap.style.opacity = opacity;
    });

    if (blowMeterFill) {
        blowMeterFill.style.width = power + "%";
    }

    candleSection.classList.toggle("wavering-soft", isSoftBlow);
    candleSection.classList.toggle("wavering-strong", isStrongBlow);

}

function blowOutCandle() {

    candleBlownOut = true;
    cancelAnimationFrame(rafId);

    statusText.textContent = "Lilin padam! 🎉";
    flames.forEach((f) => f.classList.add("extinguished"));
    candleSection.classList.add("smoking");
    candleSection.classList.remove("wavering-soft", "wavering-strong");

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
    blowPower = 0;
    smoothedRms = 0;

    celebration.classList.remove("show");
    flames.forEach((f) => f.classList.remove("extinguished"));
    candleSection.classList.remove("smoking");
    candleSection.classList.remove("wavering-soft", "wavering-strong");
    updateBlowVisuals(0, false, false);

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
BUKET TULIP — POP-UP SAAT SCROLL KE INTRO
========================================= */

const tulipBouquet = document.getElementById("tulipBouquet");

if (tulipBouquet && "IntersectionObserver" in window) {

    const tulipObserver = new IntersectionObserver((entries) => {

        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                tulipBouquet.classList.add("popped");
                tulipObserver.unobserve(entry.target); // cukup sekali saja
            }
        });

    }, { threshold: 0.4 });

    tulipObserver.observe(tulipBouquet);

}


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
