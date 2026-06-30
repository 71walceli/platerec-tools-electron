import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { PlateResult, BoundingBox } from '../../types/api';

interface BoundingBoxCanvasProps {
  imageSrc: string;
  results: PlateResult[];
  showVehicleBoxes?: boolean;
  width?: number;
  height?: number;
  onImageClick?: () => void;
}

export interface BoundingBoxCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
}

function getConfidenceColor(score: number): string {
  if (score >= 0.9) return '#4caf50';
  if (score >= 0.7) return '#ff9800';
  if (score >= 0.5) return '#ff5722';
  return '#f44336';
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  box: BoundingBox,
  label: string,
  color: string,
  scaleX: number,
  scaleY: number,
  isDashed = false
) {
  const x = box.xmin * scaleX;
  const y = box.ymin * scaleY;
  const w = (box.xmax - box.xmin) * scaleX;
  const h = (box.ymax - box.ymin) * scaleY;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (isDashed) {
    ctx.setLineDash([6, 3]);
  }
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  if (label) {
    ctx.save();
    ctx.font = 'bold 13px monospace';
    const metrics = ctx.measureText(label);
    const labelH = 18;
    const labelW = metrics.width + 8;

    ctx.fillStyle = color;
    ctx.fillRect(x, y - labelH, labelW, labelH);

    ctx.fillStyle = '#fff';
    ctx.fillText(label, x + 4, y - 4);
    ctx.restore();
  }
}

const BoundingBoxCanvas = forwardRef<BoundingBoxCanvasRef, BoundingBoxCanvasProps>(({
  imageSrc,
  results,
  showVehicleBoxes = true,
  onImageClick,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageRef.current) return;

    const img = imageRef.current;
    const containerWidth = container.clientWidth;
    const scale = containerWidth / img.naturalWidth;
    const displayHeight = img.naturalHeight * scale;

    canvas.width = containerWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(img, 0, 0, containerWidth, displayHeight);

    const scaleX = containerWidth / img.naturalWidth;
    const scaleY = displayHeight / img.naturalHeight;

    if (showVehicleBoxes) {
      results.forEach((result) => {
        if (
          result.vehicle &&
          result.vehicle.score > 0 &&
          (result.vehicle.box.xmax > 0 || result.vehicle.box.ymax > 0)
        ) {
          const vLabel = `${result.vehicle.type} (${(result.vehicle.score * 100).toFixed(0)}%)`;
          drawBox(ctx, result.vehicle.box, vLabel, '#2196f3', scaleX, scaleY, true);
        }
      });
    }

    results.forEach((result) => {
      const color = getConfidenceColor(result.score);
      const label = `${result.plate.toUpperCase()} ${(result.score * 100).toFixed(0)}%`;
      drawBox(ctx, result.box, label, color, scaleX, scaleY);
    });
  }, [results, showVehicleBoxes]);

  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
    img.src = imageSrc;
  }, [imageSrc, draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'zoom-in',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onImageClick?.();
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: '0.75rem',
          pointerEvents: 'none',
        }}
      >
        Click for fullscreen
      </div>
    </div>
  );
});

BoundingBoxCanvas.displayName = 'BoundingBoxCanvas';

export default BoundingBoxCanvas;
