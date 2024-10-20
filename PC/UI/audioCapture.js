const { spawn } = require('child_process');
const EventEmitter = require('events');

class AudioCapture extends EventEmitter {
    constructor() {
        super();
        this.ffmpeg = null;
        this.audioData = Buffer.alloc(0); // Ensure audioData is initialized
    }

    startCapture(sampleRate) {
        const ffmpegCommand = [
            '-f', 'dshow', // Windows
            '-i', 'audio=Stereo Mix (Realtek(R) Audio)', // Adjust the input device name
            '-ar', sampleRate.toString(), // Sample rate
            '-ac', '1', // Set to mono
            '-f', 'wav', // Output format
            '-'
        ];

        this.ffmpeg = spawn('ffmpeg', ffmpegCommand);

        this.ffmpeg.stdout.on('data', (chunk) => {
            console.log('local Audio chunk received:', chunk.length);
            this.audioData = Buffer.concat([this.audioData, chunk]);
            this.emit('data', chunk);
        });

        this.ffmpeg.stderr.on('data', (data) => {
            console.error(`FFmpeg error: ${data}`);
        });

        this.ffmpeg.on('close', (code) => {
            console.log(`FFmpeg process exited with code: ${code}`);
        });

        console.log('Audio capture started.');
    }

    stopCapture() {
        if (this.ffmpeg) {
            this.ffmpeg.stdout.removeAllListeners('data');
            this.ffmpeg.stderr.removeAllListeners('data');
            this.ffmpeg.removeAllListeners('close');
            this.ffmpeg.kill();
            console.log('Audio capture stopped.');
            this.ffmpeg = null;
        }
    }

    getAudioData() { 
        return this.audioData;
    }
}


module.exports = AudioCapture;


