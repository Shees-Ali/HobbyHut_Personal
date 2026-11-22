import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ModalController } from '@ionic/angular';

/** Longest side of the saved picture, in pixels. */
const OUTPUT_SIZE = 1080;
const MAX_ZOOM = 4;
const MAX_FRAME_SIZE = 360;

/**
 * Opens the photo editor for `file`. Resolves with the cropped square JPEG, or null if the
 * user cancelled. Rejects if the image could not be read or cropped.
 */
export async function cropProfilePhoto(
  modalController: ModalController,
  file: Blob,
): Promise<Blob | null> {
  const modal = await modalController.create({
    component: PhotoCropperComponent,
    componentProps: { file },
    backdropDismiss: false,
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role === 'error') {
    throw new Error('Could not read or crop the photo');
  }
  return role === 'confirm' && data instanceof Blob ? data : null;
}

/**
 * Full-screen editor where the user drags and zooms a photo inside a square frame,
 * like the profile photo editors on LinkedIn and similar apps.
 */
@Component({
  selector: 'app-photo-cropper',
  templateUrl: './photo-cropper.component.html',
  styleUrls: ['./photo-cropper.component.scss'],
})
export class PhotoCropperComponent implements AfterViewInit, OnDestroy {
  @Input() file: Blob;

  @ViewChild('stage', { static: true }) stageRef: ElementRef<HTMLElement>;
  @ViewChild('image', { static: true }) imageRef: ElementRef<HTMLImageElement>;

  readonly maxZoom = MAX_ZOOM;
  ready = false;
  isSaving = false;

  /** Size of the square frame on screen, in CSS pixels. */
  frameSize = 0;
  zoom = 1;
  /** Top-left corner of the image relative to the frame, in CSS pixels. */
  offsetX = 0;
  offsetY = 0;

  private objectUrl: string | null = null;
  private naturalWidth = 0;
  private naturalHeight = 0;
  private pointers = new Map<number, { x: number; y: number }>();

  constructor(private modalController: ModalController) {}

  ngAfterViewInit() {
    // Set directly: Angular's sanitizer would rewrite a blob: URL bound with [src].
    this.objectUrl = URL.createObjectURL(this.file);
    this.imageRef.nativeElement.src = this.objectUrl;
  }

  ngOnDestroy() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
  }

  get imageWidth(): number {
    return this.naturalWidth * this.scale;
  }

  get imageHeight(): number {
    return this.naturalHeight * this.scale;
  }

  get imageTransform(): string {
    return `translate3d(${this.offsetX}px, ${this.offsetY}px, 0)`;
  }

  /** CSS pixels per image pixel. At zoom 1 the short side exactly fills the frame. */
  private get scale(): number {
    const shortSide = Math.min(this.naturalWidth, this.naturalHeight) || 1;
    return (this.frameSize / shortSide) * this.zoom;
  }

  onImageLoad() {
    const img = this.imageRef.nativeElement;
    this.naturalWidth = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;
    if (!this.naturalWidth || !this.naturalHeight) {
      this.onImageError();
      return;
    }
    this.frameSize = this.measureFrame();
    this.zoom = 1;
    this.offsetX = (this.frameSize - this.imageWidth) / 2;
    this.offsetY = (this.frameSize - this.imageHeight) / 2;
    this.ready = true;
  }

  onImageError() {
    this.modalController.dismiss(null, 'error');
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.ready) {
      return;
    }
    const newSize = this.measureFrame();
    const ratio = newSize / this.frameSize;
    this.frameSize = newSize;
    this.offsetX *= ratio;
    this.offsetY *= ratio;
    this.clampOffset();
  }

  onZoomInput(event: Event) {
    const value = Number((event as CustomEvent).detail?.value);
    if (isFinite(value) && Math.abs(value - this.zoom) > 0.001) {
      this.zoomAround(value, this.frameSize / 2, this.frameSize / 2);
    }
  }

  zoomBy(step: number) {
    this.zoomAround(this.zoom + step, this.frameSize / 2, this.frameSize / 2);
  }

  onPointerDown(event: PointerEvent) {
    if (!this.ready) {
      return;
    }
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  onPointerMove(event: PointerEvent) {
    const previous = this.pointers.get(event.pointerId);
    if (!this.ready || !previous) {
      return;
    }
    event.preventDefault();
    const others = [...this.pointers.entries()].filter(([id]) => id !== event.pointerId);
    const current = { x: event.clientX, y: event.clientY };

    if (others.length === 0) {
      // One finger: drag.
      this.offsetX += current.x - previous.x;
      this.offsetY += current.y - previous.y;
      this.clampOffset();
    } else {
      // Two fingers: pinch to zoom around their midpoint, and follow the midpoint.
      const other = others[0][1];
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const newDistance = Math.hypot(current.x - other.x, current.y - other.y);
      const rect = this.stageRef.nativeElement.getBoundingClientRect();
      const oldMid = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
      const newMid = { x: (current.x + other.x) / 2, y: (current.y + other.y) / 2 };
      this.offsetX += newMid.x - oldMid.x;
      this.offsetY += newMid.y - oldMid.y;
      if (oldDistance > 0) {
        this.zoomAround(
          this.zoom * (newDistance / oldDistance),
          newMid.x - rect.left,
          newMid.y - rect.top,
        );
      } else {
        this.clampOffset();
      }
    }
    this.pointers.set(event.pointerId, current);
  }

  onPointerUp(event: PointerEvent) {
    this.pointers.delete(event.pointerId);
  }

  onWheel(event: WheelEvent) {
    if (!this.ready) {
      return;
    }
    event.preventDefault();
    const rect = this.stageRef.nativeElement.getBoundingClientRect();
    this.zoomAround(
      this.zoom * Math.exp(-event.deltaY * 0.0015),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }

  cancel() {
    this.modalController.dismiss(null, 'cancel');
  }

  async save() {
    if (!this.ready || this.isSaving) {
      return;
    }
    this.isSaving = true;
    try {
      const blob = await this.renderCrop();
      await this.modalController.dismiss(blob, 'confirm');
    } catch (err) {
      console.error('Could not crop profile photo', err);
      await this.modalController.dismiss(null, 'error');
    } finally {
      this.isSaving = false;
    }
  }

  /** Draws the part of the image inside the frame onto a square canvas. */
  private renderCrop(): Promise<Blob> {
    const scale = this.scale;
    const sourceX = -this.offsetX / scale;
    const sourceY = -this.offsetY / scale;
    const sourceSize = this.frameSize / scale;
    const outputSize = Math.max(1, Math.min(OUTPUT_SIZE, Math.round(sourceSize)));

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return Promise.reject(new Error('Canvas is not available'));
    }
    // JPEG has no transparency; keep transparent PNGs from turning black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, outputSize, outputSize);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      this.imageRef.nativeElement,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
        'image/jpeg',
        0.9,
      );
    });
  }

  /** Changes the zoom while keeping the point (x, y) of the frame still. */
  private zoomAround(zoom: number, x: number, y: number) {
    const oldScale = this.scale;
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const newScale = this.scale;
    this.offsetX = x - ((x - this.offsetX) / oldScale) * newScale;
    this.offsetY = y - ((y - this.offsetY) / oldScale) * newScale;
    this.clampOffset();
  }

  /** Keeps the frame fully covered by the image. */
  private clampOffset() {
    const minX = Math.min(0, this.frameSize - this.imageWidth);
    const minY = Math.min(0, this.frameSize - this.imageHeight);
    this.offsetX = Math.min(0, Math.max(minX, this.offsetX));
    this.offsetY = Math.min(0, Math.max(minY, this.offsetY));
  }

  private measureFrame(): number {
    const width = this.stageRef.nativeElement.parentElement?.clientWidth || window.innerWidth;
    return Math.floor(Math.min(width - 32, MAX_FRAME_SIZE, window.innerHeight * 0.55));
  }
}
