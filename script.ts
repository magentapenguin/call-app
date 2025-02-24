import { Peer } from 'peerjs';
import type * as PeerJS from 'peerjs';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz', 20);

let stream: MediaStream | null = null;

let peer: Peer | null = null;

document.getElementById('exit')!.addEventListener('click', () => {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    document.getElementById('app')!.hidden = true;
    document.getElementById('start')!.hidden = false;

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
    });

    peer.on('call', call => {
        currentCall = call;
        console.log('Incoming call');
        if (!stream) return;
        call.answer(stream);
        call.on('stream', stream => {
            const video = document.getElementById('remote-video') as HTMLVideoElement | null;
            video!.hidden = false;
            if (video) {
                video.srcObject = stream;
                video.play();
            }
        });
    });

    let currentCall: PeerJS.MediaConnection | null = null;

    const form = document.getElementById('peer-form') as HTMLFormElement | null;
    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const data = new FormData(form);
            const id = data.get('peer-id') as string;
            console.log('Connecting to', id);
            if (!stream) return;
            if (currentCall) {
                currentCall.close();
            }
            if (!peer) return;
            currentCall = peer.call(id, stream);
            currentCall.on('stream', stream => {
                const video = document.getElementById('remote-video') as HTMLVideoElement | null;
                if (video) {
                    video.srcObject = stream;
                    video.addEventListener('loadedmetadata', () => {
                        video.play();
                    }, { once: true });
                }
            });
        });
    }
});