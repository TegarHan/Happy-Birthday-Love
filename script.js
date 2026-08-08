const startButton = document.getElementById("startButton");
const statusText = document.getElementById("status");
const video = document.getElementById("webcam");
const flame = document.getElementById("flame");
const candleSection = document.querySelector(".candle-section");
const celebration = document.getElementById("celebration");
const restartButton = document.getElementById("restartButton");
const confettiContainer = document.getElementById("confettiContainer");

let audioContext;
let analyser;
let micStream;
let rafId;
let blowFrameCount = 0;
let candleBlownOut = false;

const BLOW_THRESHOLD = 28;       // sensitivitas volume tiupan
const BLOW_FRAMES_NEEDED = 6;    // jumlah frame berturut-turut agar tidak salah deteksi

startButton.addEventListener("click", initCamera);
restartButton.addEventListener("click", resetExperience);

async function initCamera() {

    try {

        statusText.textContent =
            "Meminta akses kamera & mikrofon...";

        const stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: "user" // penting untuk kamera depan
            },

            audio: true // dibutuhkan untuk mendeteksi tiupan

        });

        micStream = stream;
        video.srcObject = stream;

        statusText.textContent =
            "Arahkan wajah ke layar, lalu tiup lilinnya 🎂";

        startButton.style.display = "none";

        setupBlowDetection(stream);

    } catch (error) {

        console.error(error);

        // Tampilkan detail error asli supaya mudah didiagnosis dari HP
        statusText.textContent =
            "Gagal: " + error.name + " — " + error.message;

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

        // Hitung RMS (root-mean-square) sebagai indikator volume tiupan
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

    const colors = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#ffffff"];

    confettiContainer.innerHTML = "";

    for (let i = 0; i < 60; i++) {

        const piece = document.createElement("div");
        piece.className = "confetti-piece";

        piece.style.left = Math.random() * 100 + "%";
        piece.style.background =
            colors[Math.floor(Math.random() * colors.length)];

        piece.style.animationDuration = (2.5 + Math.random() * 2) + "s";
        piece.style.animationDelay = (Math.random() * 1.5) + "s";
        piece.style.setProperty("--rotate", (Math.random() * 360) + "deg");

        confettiContainer.appendChild(piece);

    }

}

// Melodi "Happy Birthday to You" disintesis langsung di browser (tidak perlu file audio)
function playHappyBirthdayTune() {

    const ctx =
        audioContext ||
        new (window.AudioContext || window.webkitAudioContext)();

    const C = 261.63, D = 293.66, E = 329.63, F = 349.23, G = 392.0, A = 440.0, Ah = 880.0;

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

    statusText.textContent =
        "Arahkan wajah ke layar, lalu tiup lilinnya 🎂";

    if (micStream) {
        setupBlowDetection(micStream);
    }

}
