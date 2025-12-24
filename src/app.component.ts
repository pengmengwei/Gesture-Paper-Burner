import { Component, ElementRef, ViewChild, AfterViewInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GestureService, GestureType } from './services/gesture.service';
import { AudioService } from './services/audio.service';

type PaperState = 'IDLE' | 'ACTIVE' | 'CRUMPLED_1' | 'CRUMPLED_2' | 'CRUMPLED_FINAL' | 'BURNING' | 'ASHES';

interface Spark {
  x: number;      // % position
  y: number;      // % position
  tx: number;     // translate X (px)
  ty: number;     // translate Y (px)
  scale: number;
  delay: string;  // animation delay
  duration: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: []
})
export class AppComponent implements AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  gestureService = inject(GestureService);
  audioService = inject(AudioService);

  // App State
  paperState = signal<PaperState>('IDLE');
  fileName = signal<string>('');
  fileType = signal<string>('');
  
  // Visual Effects State
  isShaking = signal(false);
  sparks = signal<Spark[]>([]);
  
  // Interaction Logic State
  private gestureHoldCounter = 0;
  private canCrumple = true; 

  // Computed visuals
  currentMessage = computed(() => {
    const s = this.paperState();
    if (s === 'IDLE') return 'Click or Drag a file here';
    if (s === 'ACTIVE') return 'Make a FIST to crumple (0/3)';
    if (s === 'CRUMPLED_1') return 'Release & Fist again! (1/3)';
    if (s === 'CRUMPLED_2') return 'One more time! (2/3)';
    if (s === 'CRUMPLED_FINAL') return 'Bring OPEN HAND close to BURN IT!';
    if (s === 'BURNING') return 'Burning...';
    if (s === 'ASHES') return 'Gone. Reload or click to reset.';
    return '';
  });

  constructor() {
    effect(() => {
      const gesture = this.gestureService.currentGesture();
      const proximity = this.gestureService.handProximity();
      
      this.handleGameLoop(gesture, proximity);
    });
  }

  ngAfterViewInit() {
    this.gestureService.initialize(
      this.videoElement.nativeElement,
      this.canvasElement.nativeElement
    );
  }

  handleGameLoop(gesture: GestureType, proximity: number) {
    if (gesture === 'OPEN_PALM' || gesture === 'NONE') {
      this.canCrumple = true;
    }

    // Crumpling Logic
    if (gesture === 'FIST' && this.canCrumple) {
       this.gestureHoldCounter++;
       if (this.gestureHoldCounter > 5) {
         this.triggerCrumple();
         this.gestureHoldCounter = 0;
         this.canCrumple = false;
       }
    } else {
      this.gestureHoldCounter = 0;
    }

    // Burning Logic
    if (this.paperState() === 'CRUMPLED_FINAL') {
      if (gesture === 'OPEN_PALM' && proximity > 0.15) {
        this.burnPaper();
      }
    }
  }

  triggerCrumple() {
    const current = this.paperState();
    let changed = false;

    if (current === 'ACTIVE') {
      this.paperState.set('CRUMPLED_1');
      changed = true;
    } else if (current === 'CRUMPLED_1') {
      this.paperState.set('CRUMPLED_2');
      changed = true;
    } else if (current === 'CRUMPLED_2') {
      this.paperState.set('CRUMPLED_FINAL');
      changed = true;
    }

    if (changed) {
      this.audioService.playCrumple();
      // Trigger Shake Animation
      this.isShaking.set(true);
      setTimeout(() => this.isShaking.set(false), 400); 
    }
  }

  burnPaper() {
    if (this.paperState() === 'BURNING' || this.paperState() === 'ASHES') return;
    
    this.paperState.set('BURNING');
    this.audioService.playBurn();
    this.generateSparks();
    
    setTimeout(() => {
      this.paperState.set('ASHES');
      this.sparks.set([]); // Clear sparks
    }, 2500);
  }

  generateSparks() {
    const newSparks: Spark[] = [];
    for (let i = 0; i < 40; i++) {
      newSparks.push({
        x: 50 + (Math.random() * 40 - 20),
        y: 60 + (Math.random() * 20 - 10),
        tx: (Math.random() * 200 - 100),
        ty: -(Math.random() * 200 + 100),
        scale: Math.random() * 1.5 + 0.5,
        delay: `${Math.random() * 0.5}s`,
        duration: `${Math.random() * 1 + 0.5}s`
      });
    }
    this.sparks.set(newSparks);
  }

  // --- Interaction Handlers ---
  
  triggerUpload() {
    if (this.paperState() === 'IDLE') {
      // Initialize audio context on first user interaction
      this.audioService.init();
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
    input.value = ''; // Reset input
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    this.audioService.init();

    if (this.paperState() !== 'IDLE') return;

    if (event.dataTransfer?.files?.length) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  private handleFile(file: File) {
    this.fileName.set(file.name);
    this.fileType.set(file.type);
    this.paperState.set('ACTIVE');
    this.audioService.startMusic(); // Start cute background music
  }

  reset() {
    this.paperState.set('IDLE');
    this.fileName.set('');
    this.sparks.set([]);
    this.audioService.stopMusic();
  }
}