class ScreenRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.originalStream = null;
        this.startTime = null;
        this.timerInterval = null;
        this.selectedSource = 'screen';
        this.mimeType = null;
        this.fileExtension = null;

        // Region selection
        this.regionOverlay = null;
        this.selectionBox = null;
        this.region = null;
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };

        // Canvas for region cropping
        this.canvas = null;
        this.ctx = null;
        this.videoElement = null;
        this.animationFrame = null;

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
        this.regionToggle = document.getElementById('regionToggle');
        this.sourceButtons = document.querySelectorAll('.source-btn');
        this.regionOverlay = document.getElementById('regionOverlay');
        this.selectionBox = document.getElementById('selectionBox');
    }

    initEventListeners() {
        this.btnStart.addEventListener('click', () => this.handleStart());
        this.btnStop.addEventListener('click', () => this.stopRecording());

        this.sourceButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectSource(btn));
        });

        // Region selection events
        this.regionOverlay.addEventListener('mousedown', (e) => this.onSelectionStart(e));
        this.regionOverlay.addEventListener('mousemove', (e) => this.onSelectionMove(e));
        this.regionOverlay.addEventListener('mouseup', (e) => this.onSelectionEnd(e));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.regionOverlay.classList.contains('active')) {
                this.hideRegionSelector();
            }
        });
    }

    detectBestFormat() {
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

    async handleStart() {
        if (this.regionToggle.checked) {
            await this.startRegionSelection();
        } else {
            await this.startRecording();
        }
    }

    // Region Selection Methods
    async startRegionSelection() {
        try {
            // First, get the screen stream
            this.originalStream = await navigator.mediaDevices.getDisplayMedia(
                this.getDisplayMediaOptions()
            );

            // Show the region selector overlay
            this.showRegionSelector();

        } catch (error) {
            console.error('Error getting display media:', error);
            if (error.name !== 'NotAllowedError') {
                alert('Impossible d\'accéder à l\'écran. Vérifiez les permissions.');
            }
        }
    }

    showRegionSelector() {
        this.regionOverlay.classList.add('active');
        this.selectionBox.classList.remove('active');
        this.region = null;
    }

    hideRegionSelector() {
        this.regionOverlay.classList.remove('active');
        this.selectionBox.classList.remove('active');

        // Stop the original stream if selection was cancelled
        if (this.originalStream && !this.stream) {
            this.originalStream.getTracks().forEach(track => track.stop());
            this.originalStream = null;
        }
    }

    onSelectionStart(e) {
        this.isSelecting = true;
        this.selectionStart = { x: e.clientX, y: e.clientY };
        this.selectionBox.style.left = `${e.clientX}px`;
        this.selectionBox.style.top = `${e.clientY}px`;
        this.selectionBox.style.width = '0';
        this.selectionBox.style.height = '0';
        this.selectionBox.classList.add('active');
    }

    onSelectionMove(e) {
        if (!this.isSelecting) return;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const left = Math.min(this.selectionStart.x, currentX);
        const top = Math.min(this.selectionStart.y, currentY);
        const width = Math.abs(currentX - this.selectionStart.x);
        const height = Math.abs(currentY - this.selectionStart.y);

        this.selectionBox.style.left = `${left}px`;
        this.selectionBox.style.top = `${top}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;
        this.selectionBox.setAttribute('data-size', `${width} × ${height}`);
    }

    onSelectionEnd(e) {
        if (!this.isSelecting) return;
        this.isSelecting = false;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const left = Math.min(this.selectionStart.x, currentX);
        const top = Math.min(this.selectionStart.y, currentY);
        const width = Math.abs(currentX - this.selectionStart.x);
        const height = Math.abs(currentY - this.selectionStart.y);

        // Minimum size check
        if (width < 50 || height < 50) {
            alert('Zone trop petite. Sélectionnez une zone plus grande.');
            this.selectionBox.classList.remove('active');
            return;
        }

        // Store the region coordinates (relative to screen)
        this.region = {
            x: left,
            y: top,
            width: width,
            height: height
        };

        this.hideRegionSelector();
        this.startRegionRecording();
    }

    async startRegionRecording() {
        try {
            // Create a hidden video element to play the original stream
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = this.originalStream;
            this.videoElement.muted = true;
            await this.videoElement.play();

            // Wait for video to have dimensions
            await new Promise(resolve => {
                if (this.videoElement.videoWidth > 0) {
                    resolve();
                } else {
                    this.videoElement.onloadedmetadata = resolve;
                }
            });

            // Calculate the scale factor between screen and video
            const videoTrack = this.originalStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            const videoWidth = settings.width || this.videoElement.videoWidth;
            const videoHeight = settings.height || this.videoElement.videoHeight;

            const scaleX = videoWidth / window.screen.width;
            const scaleY = videoHeight / window.screen.height;

            // Scaled region coordinates
            const scaledRegion = {
                x: Math.round(this.region.x * scaleX),
                y: Math.round(this.region.y * scaleY),
                width: Math.round(this.region.width * scaleX),
                height: Math.round(this.region.height * scaleY)
            };

            // Create canvas for cropping
            this.canvas = document.createElement('canvas');
            this.canvas.width = scaledRegion.width;
            this.canvas.height = scaledRegion.height;
            this.ctx = this.canvas.getContext('2d');

            // Start rendering loop
            const renderFrame = () => {
                if (this.ctx && this.videoElement) {
                    this.ctx.drawImage(
                        this.videoElement,
                        scaledRegion.x, scaledRegion.y,
                        scaledRegion.width, scaledRegion.height,
                        0, 0,
                        scaledRegion.width, scaledRegion.height
                    );
                }
                this.animationFrame = requestAnimationFrame(renderFrame);
            };
            renderFrame();

            // Get stream from canvas
            const canvasStream = this.canvas.captureStream(30);

            // Add audio track if present
            const audioTracks = this.originalStream.getAudioTracks();
            if (audioTracks.length > 0) {
                canvasStream.addTrack(audioTracks[0]);
            }

            this.stream = canvasStream;

            // Show preview
            this.preview.srcObject = this.stream;
            this.preview.classList.add('active');
            this.placeholder.classList.add('hidden');

            // Handle original stream ending
            this.originalStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopRecording();
            });

            // Setup MediaRecorder
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

            // Update UI
            this.btnStart.disabled = true;
            this.btnStop.disabled = false;
            this.recordingIndicator.classList.add('active');

            this.startTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        } catch (error) {
            console.error('Error starting region recording:', error);
            this.cleanupRegionRecording();
            alert('Erreur lors du démarrage de l\'enregistrement.');
        }
    }

    cleanupRegionRecording() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.srcObject = null;
            this.videoElement = null;
        }
        if (this.originalStream) {
            this.originalStream.getTracks().forEach(track => track.stop());
            this.originalStream = null;
        }
        this.canvas = null;
        this.ctx = null;
        this.region = null;
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

        // Cleanup region recording resources
        this.cleanupRegionRecording();

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
                if (error.name === 'AbortError') {
                    if (confirm('Voulez-vous télécharger le fichier directement ?')) {
                        this.fallbackDownload(blob, fileName);
                    }
                    this.recordedChunks = [];
                    return;
                }
                console.error('Save file error:', error);
            }
        }

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

    if (isMobile) {
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        document.querySelector('main').innerHTML = `
            <div style="text-align: center; padding: 2rem 1rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5; margin-bottom: 1rem;">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
                <h2 style="margin-bottom: 1rem; font-size: 1.3rem;">Non disponible sur mobile</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem; line-height: 1.6;">
                    Les navigateurs mobiles ne permettent pas<br>l'enregistrement d'écran via un site web.
                </p>
                <div style="background: var(--bg-secondary); border-radius: 12px; padding: 1.5rem; text-align: left; border: 1px solid var(--border);">
                    <p style="font-weight: 500; margin-bottom: 1rem; color: var(--text-primary);">Utilisez plutôt :</p>
                    ${isIOS ? `
                    <div style="display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem;">
                        <span style="font-size: 1.5rem;">📱</span>
                        <div>
                            <p style="font-weight: 500; color: var(--text-primary);">iPhone / iPad</p>
                            <p style="color: var(--text-secondary); font-size: 0.9rem;">Centre de contrôle → Bouton enregistrement (cercle)</p>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">
                        💡 Si absent : Réglages → Centre de contrôle → Ajouter "Enregistrement de l'écran"
                    </p>
                    ` : `
                    <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                        <span style="font-size: 1.5rem;">🤖</span>
                        <div>
                            <p style="font-weight: 500; color: var(--text-primary);">Android</p>
                            <p style="color: var(--text-secondary); font-size: 0.9rem;">Balayez vers le bas → Paramètres rapides → "Enregistrement d'écran"</p>
                        </div>
                    </div>
                    `}
                </div>
                <p style="margin-top: 2rem; color: var(--text-secondary); font-size: 0.85rem;">
                    💻 Sur ordinateur, ce site fonctionne avec Chrome, Edge ou Firefox
                </p>
            </div>
        `;
        return false;
    }

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
