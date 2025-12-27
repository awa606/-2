
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class HandTrackingService {
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;

  async initialize(videoElement: HTMLVideoElement) {
    this.video = videoElement;
    // 使用与 JS 版本一致的 WASM 加载路径 (0.10.14)
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1
    });
    console.log("HandLandmarker initialized successfully");
  }

  detect(): any {
    if (!this.handLandmarker || !this.video || this.video.readyState < 2) return null;
    
    const startTimeMs = performance.now();
    const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);
    
    if (results.landmarks && results.landmarks.length > 0) {
      return {
        landmarks: results.landmarks[0],
        detected: true
      };
    }
    return { detected: false };
  }
}

export const handTrackingService = new HandTrackingService();
