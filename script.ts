import { Peer } from 'peerjs';
import type * as PeerJS from 'peerjs';
import { customAlphabet } from 'nanoid';

const overlaycanvas = document.getElementById('stream-overlay') as HTMLCanvasElement;
const octx = overlaycanvas.getContext('2d')!;

const status = document.getElementById('status') as HTMLSpanElement;

const nanoid = customAlphabet('6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz', 12);

let mediaStream: MediaStream | null = null;
let audioStream: MediaStream | null = null;

let stream: MediaStream | null = null;
let vidstream: HTMLVideoElement = document.createElement('video');
document.body.appendChild(vidstream);
vidstream.hidden = true;
vidstream.muted = true;

let peer: Peer | null = null;

const muteIcon = new Image();
muteIcon.src = 'mic-off.png';


function drawOverlay() {
    octx.scale(-1, 1);
    octx.translate(-overlaycanvas.width, 0);
    octx.drawImage(vidstream, 0, 0);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    const muted = stream?.getAudioTracks().some(track => !track.enabled);
    const paused = mediaStream?.getVideoTracks().some(track => !track.enabled);
    if (muted) {
        octx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        octx.arc(overlaycanvas.width - 70, 70, 50, 0, 2 * Math.PI);
        octx.fill();
        octx.fillStyle = 'white';
        octx.drawImage(muteIcon, overlaycanvas.width - 100, 40, 60, 60);
    }
    if (paused) {
        octx.fillStyle = 'white';
        octx.font = '64px "Inter", sans-serif';
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText('No Video', overlaycanvas.width / 2, overlaycanvas.height / 2);
    }
    if (document.visibilityState == 'hidden') {
        octx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        octx.fillRect(0, 0, overlaycanvas.width, overlaycanvas.height);
    }
    requestAnimationFrame(drawOverlay);
}

drawOverlay();

document.getElementById('exit')!.addEventListener('click', () => {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    document.getElementById('app')!.hidden = true;
    document.getElementById('start')!.hidden = false;
    peer?.destroy();
    peer = null;
});

document.getElementById('start')!.addEventListener('click', async () => {
    document.getElementById('start')!.hidden = true;
    try {
        let tmpStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { min: 1024, ideal: 1280, max: 1280 },
                height: { min: 576, ideal: 720, max: 720 },
                frameRate: { ideal: 30, max: 45 }
            }, audio: true
        });
        mediaStream = new MediaStream();
        audioStream = new MediaStream();
        stream = new MediaStream();
        tmpStream.getTracks().forEach(track => {
            if (track.kind === 'video') {
                mediaStream?.addTrack(track);
            } else if (track.kind === 'audio') {
                audioStream?.addTrack(track);
            }
        });
        vidstream.srcObject = mediaStream;
        vidstream.play();
        overlaycanvas.width = mediaStream.getVideoTracks()[0].getSettings().width!;
        overlaycanvas.height = mediaStream.getVideoTracks()[0].getSettings().height!;
        overlaycanvas.captureStream(30).getTracks().forEach(track => {
            stream?.addTrack(track);
        });
        audioStream.getTracks().forEach(track => {
            stream?.addTrack(track);
        });
    }
    catch (err) {
        console.error('Error accessing media devices.', err);
        alert('Error accessing media devices. ' + err.message);
        document.getElementById('start')!.hidden = false;
        return;
    }

    const video = document.getElementById('local-video') as HTMLVideoElement | null;
    video!.hidden = false;
    if (video) {
        video.srcObject = stream;
        video.play();
    }

    peer = new Peer(nanoid());

    peer.on('open', id => {
        console.log('My peer ID is: ' + id);
        document.getElementById('peer-id-display')!.textContent = id;
        status.textContent = 'Ready';
        status.classList.add('ready');
        document.getElementById('app')!.hidden = false;
    });

    peer.on('call', call => {
        currentCall = call;
        console.log('Incoming call');
        if (!stream) return;
        call.answer(stream);
        initCall();
    });

    const form = document.getElementById('peer-form') as HTMLFormElement;
    const connectBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    connectBtn.disabled = false;
    const disconnectBtn = document.getElementById('disconnect') as HTMLButtonElement;
    disconnectBtn.disabled = true;
    const muteBtn = document.getElementById('mute') as HTMLButtonElement;
    muteBtn.addEventListener('click', () => {
        if (!stream) return;
        stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
        muteBtn.textContent = stream.getAudioTracks().some(track => track.enabled) ? 'Mute Audio' : 'Unmute Audio';
    });
    const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
    pauseBtn.addEventListener('click', () => {
        if (!mediaStream) return;
        mediaStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
        pauseBtn.textContent = mediaStream.getVideoTracks().some(track => track.enabled) ? 'Pause Video' : 'Resume Video';
    });

    function closeCall() {
        if (currentCall) {
            currentCall.close();
            currentCall = null;
        }
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        status.textContent = 'Ready';
        status.classList.remove('connected');
        status.classList.add('ready');
    }

    function initCall() {
        if (!currentCall) return;
        status.textContent = 'Connected to ' + currentCall.peer;
        status.classList.remove('ready');
        status.classList.add('connected');
        currentCall.on('stream', stream => {
            const video = document.getElementById('remote-video') as HTMLVideoElement | null;
            if (video) {
                video.srcObject = stream;
                video.play();
            }
        });
        currentCall.on('close', () => {
            console.log('Call closed');
            closeCall();
        });
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
    }

    peer.on('error', err => {
        // Handle error
        console.error(err);
        closeCall();
        alert(err.message);
    });

    peer.on('disconnected', () => {
        console.log('Peer disconnected');
        closeCall();
        // Reconnect
        peer?.reconnect();
    });

    let currentCall: PeerJS.MediaConnection | null = null;

    if (location.hash) {
        const id = location.hash.slice(1);
        const autojoindialog = document.getElementById('auto-join-dialog') as HTMLDialogElement | null;
        if (autojoindialog) {
            autojoindialog.showModal();
        }
        document.getElementById('auto-join-yes')!.addEventListener('click', () => {
            if (!stream) return;
            closeCall();
            if (!peer) return;
            currentCall = peer.call(id, stream);
            initCall();
            if (autojoindialog) {
                autojoindialog.close();
            }
        });
        document.getElementById('auto-join-no')!.addEventListener('click', () => {
            if (autojoindialog) {
                autojoindialog.close();
                location.hash = '';
            }
        });
        document.getElementById('auto-join-id')!.textContent = id;
    }

    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const data = new FormData(form);
            const id = data.get('peer-id') as string;
            console.log('Connecting to', id);
            if (!stream) return;
            closeCall();
            if (!peer) return;
            currentCall = peer.call(id, stream);
            initCall();
        });
    }
    document.getElementById('peer-id-copy')!.addEventListener('click', () => {
        if (!peer) return;
        navigator.clipboard.writeText(peer.id);
    });

    const shareErrorDialog = document.getElementById('share-error') as HTMLDialogElement;
    const shareErrorClose = document.getElementById('share-error-close') as HTMLButtonElement;
    shareErrorClose.addEventListener('click', () => {
        shareErrorDialog.close();
    });
    const shareErrorMsg = document.getElementById('share-error-message') as HTMLParagraphElement;
    const shareCopyBtn = document.getElementById('share-error-copy') as HTMLButtonElement;
    shareCopyBtn.addEventListener('click', () => {
        const url = document.getElementById('share-error-copy-text') as HTMLSpanElement;
        navigator.clipboard.writeText(url.innerText);
    });


    document.getElementById('peer-id-share')!.addEventListener('click', () => {
        if (!peer) return;
        if (!navigator.share) {
            shareErrorMsg.textContent = 'Your browser does not support the Web Share API.';
            const url = document.getElementById('share-error-copy-text') as HTMLSpanElement;
            url.textContent = location.origin + location.pathname + '#' + peer.id;
            shareErrorDialog.showModal();
            return;
        }
        navigator.share({ title: 'Join my video call', text: 'Join call', url: location.origin + location.pathname + '#' + peer.id });
    });
    disconnectBtn.addEventListener('click', () => {
        closeCall();
    });
});