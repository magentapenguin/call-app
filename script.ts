import { Peer } from 'peerjs';
import type * as PeerJS from 'peerjs';
import { customAlphabet } from 'nanoid';

const status = document.getElementById('status') as HTMLSpanElement;

const nanoid = customAlphabet('6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz', 20);

let stream: MediaStream | null = null;

let peer: Peer | null = null;

document.getElementById('exit')!.addEventListener('click', () => {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    document.getElementById('app')!.hidden = true;
    document.getElementById('start')!.hidden = false;
    peer?.destroy();
    peer = null;
});

document.getElementById('start')!.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { min: 1024, ideal: 1280, max: 1920 },
                height: { min: 576, ideal: 720, max: 1080 },
                frameRate: { ideal: 15, max: 30 }
            }, audio: true
        });
    }
    catch (err) {
        console.error('Error accessing media devices.', err);
        return;
    }
    document.getElementById('start')!.hidden = true;
    document.getElementById('app')!.hidden = false;

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
        if (!stream) return;
        stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
        pauseBtn.textContent = stream.getVideoTracks().some(track => track.enabled) ? 'Pause Video' : 'Resume Video';
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
    document.getElementById('peer-id-share')!.addEventListener('click', () => {
        if (!peer) return;
        navigator.share({ title: 'Join my video call', text: 'Join my video call', url: location.origin + location.pathname + '#' + peer.id });
    });
    disconnectBtn.addEventListener('click', () => {
        closeCall();
    });
});