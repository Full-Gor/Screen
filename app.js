class ScreenRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.startTime = null;
        this.timerInterval = null;
        this.selectedSource = 'screen';
        this.mimeType = null;
        this.fileExtension = null;

        this.initElements();
        this.initEventListeners();
        this.detectBestFormat();
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

    detectBestFormat() {
        // Prioritize MP4, fallback to WebM
        const formats = [
            { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
            { mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
            { mimeType: 'video/mp4', ext: 'mp4' },
            { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
            { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
            { mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
            { mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
            { mimeType: 'video/webm', ext: 'webm' }
        ];

        for (const format of formats) {
            if (MediaRecorder.isTypeSupported(format.mimeType)) {
                this.mimeType = format.mimeType;
                this.fileExtension = format.ext;
                console.log(`Format selected: ${format.mimeType}`);
                return;
            }
        }

        // Ultimate fallback
        this.mimeType = 'video/webm';
        this.fileExtension = 'webm';
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

        if (this.selectedSource === 'tab' && this.audioToggle.checked) {
            options.preferCurrentTab = true;
        }

        return options;
    }

    async startRecording() {
        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia(
                this.getDisplayMediaOptions()
            );

            this.preview.srcObject = this.stream;
            this.preview.classList.add('active');
            this.placeholder.classList.add('hidden');

            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopRecording();
            });

            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: this.mimeType
            });

            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };

            this.mediaRecorder.start(1000);

            this.btnStart.disabled = true;
            this.btnStop.disabled = false;
            this.recordingIndicator.classList.add('active');

            this.startTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        } catch (error) {
            console.error('Error starting recording:', error);

            if (error.name === 'NotAllowedError') {
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

        this.preview.srcObject = null;
        this.preview.classList.remove('active');
        this.placeholder.classList.remove('hidden');
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
        this.recordingIndicator.classList.remove('active');

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timer.textContent = '00:00';
    }

    async saveRecording() {
        if (this.recordedChunks.length === 0) return;

        const blob = new Blob(this.recordedChunks, { type: this.mimeType });
        const fileName = `recording-${this.getTimestamp()}.${this.fileExtension}`;

        // Try File System Access API (allows user to choose save location)
        if ('showSaveFilePicker' in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [
                        {
                            description: 'Video file',
                            accept: {
                                [this.mimeType.split(';')[0]]: [`.${this.fileExtension}`]
                            }
                        }
                    ]
                });

                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                this.recordedChunks = [];
                return;
            } catch (error) {
                // User cancelled the save dialog
                if (error.name === 'AbortError') {
                    // Still offer fallback download
                    if (confirm('Voulez-vous télécharger le fichier directement ?')) {
                        this.fallbackDownload(blob, fileName);
                    }
                    this.recordedChunks = [];
                    return;
                }
                console.error('Save file error:', error);
            }
        }

        // Fallback for browsers without File System Access API
        this.fallbackDownload(blob, fileName);
        this.recordedChunks = [];
    }

    fallbackDownload(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSecure = window.isSecureContext;
    const hasAPI = navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia;

    // Mobile devices don't support screen recording
    if (isMobile) {
        document.querySelector('main').innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem;">
                <h2 style="margin-bottom: 1rem;">Appareil non supporté</h2>
                <p style="color: var(--text-secondary);">
                    L'enregistrement d'écran n'est pas disponible sur mobile.<br>
                    Utilisez un ordinateur avec Chrome, Edge ou Firefox.
                </p>
            </div>
        `;
        return false;
    }

    // Not secure context (HTTP instead of HTTPS)
    if (!isSecure) {
        document.querySelector('main').innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem;">
                <h2 style="margin-bottom: 1rem;">Connexion non sécurisée</h2>
                <p style="color: var(--text-secondary);">
                    L'enregistrement d'écran nécessite HTTPS.<br>
                    Accédez au site via une connexion sécurisée.
                </p>
            </div>
        `;
        return false;
    }

    // API not available
    if (!hasAPI) {
        document.querySelector('main').innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem;">
                <h2 style="margin-bottom: 1rem;">Navigateur non supporté</h2>
                <p style="color: var(--text-secondary);">
                    Votre navigateur ne supporte pas l'enregistrement d'écran.<br>
                    Utilisez Chrome, Edge ou Firefox (version récente).
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
