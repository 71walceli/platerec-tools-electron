import React, { useRef, useEffect, useCallback } from 'react';
import { PlateResult, BoundingBox } from '../../types/api';

interface BoundingBoxCanvasProps {
  imageSrc: string;
  results: PlateResult[];
  showVehicleBoxes?: boolean;
  width?: number;
  height?: number;
}

/** Color based on confidence score */
function getConfidenceColor(score: number): string {
  if (score >= 0.9) return '#4caf50'; // green
  if (score >= 0.7) return '#ff9800'; // orange
  if (score >= 0.5) return '#ff5722'; // deep orange
  return '#f44336'; // red
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

  // Label background
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

const BoundingBoxCanvas: React.FC<BoundingBoxCanvasProps> = ({
  imageSrc,
  results,
  showVehicleBoxes = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

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

    // Draw image
    ctx.drawImage(img, 0, 0, containerWidth, displayHeight);

    const scaleX = containerWidth / img.naturalWidth;
    const scaleY = displayHeight / img.naturalHeight;

    // Draw vehicle boxes first (behind plate boxes)
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

    // Draw plate boxes
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

  // Redraw on window resize
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%' }}
      />
    </div>
  );
};

export default BoundingBoxCanvas;
