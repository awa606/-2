
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface Memory {
  id: string;
  url: string;
  position: [number, number, number];
}

export interface HandTrackingResult {
  landmarks: HandLandmark[];
  detected: boolean;
}
