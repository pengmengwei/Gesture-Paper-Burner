import { Injectable, signal } from '@angular/core';
import { FilesetResolver, HandLandmarker, DrawingUtils } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/+esm';

export type GestureType = 'NONE' | 'FIST' | 'OPEN_PALM';

@Injectable({
  providedIn: 'root'
})
export class GestureService {
  private handLandmarker: HandLandmarker | undefined;
  private video: HTMLVideoElement | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private lastVideoTime = -1;
  private animationFrameId: number | null = null;

  // Signals for state
  public isCameraReady = signal(false);
  public currentGesture = signal<GestureType>('NONE');
  public handProximity = signal<number>(0); // 0 to 1, 1 is very close (large hand)

  async initialize(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.canvasCtx = this.canvas.getContext('2d');

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
    );

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1
    });

    this.startCamera();
  }

  private startCamera() {
    if (!this.video) return;

    const constraints = {
      video: {
        width: 1280,
        height: 720,
        facingMode: 'user' // selfie camera
      }
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      if (this.video) {
        this.video.srcObject = stream;
        this.video.addEventListener('loadeddata', () => {
          this.isCameraReady.set(true);
          this.predictWebcam();
        });
      }
    }).catch(err => {
      console.error('Camera access denied:', err);
    });
  }

  private predictWebcam = () => {
    if (!this.handLandmarker || !this.video || !this.canvas || !this.canvasCtx) return;

    let startTimeMs = performance.now();
    
    if (this.lastVideoTime !== this.video.currentTime) {
      this.lastVideoTime = this.video.currentTime;
      const detections = this.handLandmarker.detectForVideo(this.video, startTimeMs);
      
      this.canvasCtx.save();
      this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      if (detections.landmarks && detections.landmarks.length > 0) {
        const landmarks = detections.landmarks[0];
        this.processGesture(landmarks);
        
        // Draw landmarks
        const drawingUtils = new DrawingUtils(this.canvasCtx);
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
          color: '#00FF00',
          lineWidth: 2
        });
        drawingUtils.drawLandmarks(landmarks, {
          color: '#FF0000',
          lineWidth: 1
        });
      } else {
        this.currentGesture.set('NONE');
        this.handProximity.set(0);
      }
      this.canvasCtx.restore();
    }

    this.animationFrameId = requestAnimationFrame(this.predictWebcam);
  }

  private processGesture(landmarks: any[]) {
    // 1. Calculate Bounding Box Area for Proximity
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    landmarks.forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });
    const width = maxX - minX;
    const height = maxY - minY;
    const area = width * height; 
    
    // Normalize area roughly. 0.05 is far, 0.3+ is close.
    let proximity = Math.min(Math.max((area - 0.05) / 0.25, 0), 1);
    this.handProximity.set(proximity);

    // 2. Detect Fist vs Palm
    // Simple heuristic: If fingertips are close to wrist/palm base, it's a fist.
    // Tips: 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
    // Wrist: 0
    // MCPs (Knuckles): 5, 9, 13, 17
    
    const wrist = landmarks[0];
    const tips = [8, 12, 16, 20];
    const mcps = [5, 9, 13, 17];
    
    let curledCount = 0;
    
    tips.forEach((tipIdx, i) => {
      const tip = landmarks[tipIdx];
      const mcp = landmarks[mcps[i]];
      // Distance from tip to wrist vs mcp to wrist
      const dTip = this.dist(tip, wrist);
      const dMcp = this.dist(mcp, wrist);
      
      // If tip is significantly closer to wrist than extended, it's curled
      // Or simply: is tip below the PIP joint? (Assuming upright hand)
      // Let's use distance ratio. If Tip is close to MCP, it's curled.
      
      // Better check: Is the tip closer to the wrist than the PIP joint (tipIdx - 2)?
      const pip = landmarks[tipIdx - 2];
      const dPip = this.dist(pip, wrist);
      
      if (dTip < dPip) {
        curledCount++;
      }
    });

    if (curledCount >= 3) {
      this.currentGesture.set('FIST');
    } else if (curledCount === 0) {
      this.currentGesture.set('OPEN_PALM');
    } else {
      this.currentGesture.set('NONE');
    }
  }

  private dist(a: any, b: any) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
  }
}