class ScreenRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.startTime = null;
        this.timerInterval = null;
        this.selectedSource = 'screen';

        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.preview = document.getElementById('preview');
        this.placeholder = document.getElementById('placeholder');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.timer = document.getElementById('timer');
        this.btnStart = document.getElementById('btnStart');
        this.btnStop = document.getElementById('btnStop');
        this.audioToggle = document.getElementById('audioToggle');
        this.sourceButtons = document.querySelectorAll('.source-btn');
    }

    initEventListeners() {
        this.btnStart.addEventListener('click', () => this.startRecording());
        this.btnStop.addEventListener('click', () => this.stopRecording());

        this.sourceButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectSource(btn));
        });
    }

    selectSource(btn) {
        this.sourceButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedSource = btn.dataset.source;
    }

    getDisplayMediaOptions() {
        const options = {
            video: {
                cursor: 'always',
                displaySurface: this.selectedSource === 'screen' ? 'monitor' :
                               this.selectedSource === 'window' ? 'window' : 'browser'
            },
            audio: this.audioToggle.checked
        };

        // For tab capture, prefer current tab audio
        if (this.selectedSource === 'tab' && this.audioToggle.checked) {
            options.preferCurrentTab = true;
        }

        return options;
    }

    async startRecording() {
        try {
            // Get screen stream
            this.stream = await navigator.mediaDevices.getDisplayMedia(
                this.getDisplayMediaOptions()
            );

            // Show preview
            this.preview.srcObject = this.stream;
            this.preview.classList.add('active');
            this.placeholder.classList.add('hidden');

            // Handle stream ending (user clicks "Stop sharing")
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopRecording();
            });

            // Setup MediaRecorder
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };

            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second

            // Update UI
            this.btnStart.disabled = true;
            this.btnStop.disabled = false;
            this.recordingIndicator.classList.add('active');

            // Start timer
            this.startTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        } catch (error) {
            console.error('Error starting recording:', error);

            if (error.name === 'NotAllowedError') {
                // User cancelled the screen picker
                return;
            }

            alert('Impossible de démarrer l\'enregistrement. Vérifiez les permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Reset UI
        this.preview.srcObject = null;
        this.preview.classList.remove('active');
        this.placeholder.classList.remove('hidden');
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
        this.recordingIndicator.classList.remove('active');

        // Stop timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timer.textContent = '00:00';
    }

    saveRecording() {
        if (this.recordedChunks.length === 0) return;

        const blob = new Blob(this.recordedChunks, {
            type: this.getSupportedMimeType()
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${this.getTimestamp()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.recordedChunks = [];
    }

    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'video/webm';
    }

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        this.timer.textContent = `${minutes}:${seconds}`;
    }

    getTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    }
}

// Check browser support
function checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        document.querySelector('main').innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem;">
                <h2 style="margin-bottom: 1rem;">Navigateur non supporté</h2>
                <p style="color: var(--text-secondary);">
                    Votre navigateur ne supporte pas l'enregistrement d'écran.<br>
                    Utilisez Chrome, Edge ou Firefox sur ordinateur.
                </p>
            </div>
        `;
        return false;
    }
    return true;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (checkBrowserSupport()) {
        new ScreenRecorder();
    }
});
