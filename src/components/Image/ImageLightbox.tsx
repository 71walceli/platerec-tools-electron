import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PlateResult } from '../../types/api';

interface ImageLightboxProps {
  imageSrc: string;
  results: PlateResult[];
  showVehicleBoxes: boolean;
  open: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

interface ZoomPanState {
  zoom: number;
  panX: number;
  panY: number;
}

function getConfidenceColor(score: number): string {
  if (score >= 0.9) return '#4caf50';
  if (score >= 0.7) return '#ff9800';
  if (score >= 0.5) return '#ff5722';
  return '#f44336';
}

function drawBoxes(
  ctx: CanvasRenderingContext2D,
  results: PlateResult[],
  showVehicleBoxes: boolean,
  imageScale: number,
  imageOffsetX: number,
  imageOffsetY: number,
  zoom: number,
  panX: number,
  panY: number
) {
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  if (showVehicleBoxes) {
    results.forEach((result) => {
      if (
        result.vehicle &&
        result.vehicle.score > 0 &&
        (result.vehicle.box.xmax > 0 || result.vehicle.box.ymax > 0)
      ) {
        const color = '#2196f3';
        const label = `${result.vehicle.type} (${(result.vehicle.score * 100).toFixed(0)}%)`;
        const box = result.vehicle.box;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 3 / zoom]);
        ctx.strokeRect(imageOffsetX + box.xmin * imageScale, imageOffsetY + box.ymin * imageScale, (box.xmax - box.xmin) * imageScale, (box.ymax - box.ymin) * imageScale);
        ctx.restore();

        const labelText = label;
        const fontSize = 13 / zoom;
        ctx.font = `bold ${fontSize}px monospace`;
        const metrics = ctx.measureText(labelText);
        const labelH = 18 / zoom;
        const labelW = metrics.width + 8 / zoom;

        ctx.fillStyle = color;
        ctx.fillRect(imageOffsetX + box.xmin * imageScale, imageOffsetY + box.ymin * imageScale - labelH, labelW, labelH);
        ctx.fillStyle = '#fff';
        ctx.fillText(labelText, imageOffsetX + box.xmin * imageScale + 4 / zoom, imageOffsetY + box.ymin * imageScale - 4 / zoom);
      }
    });
  }

  results.forEach((result) => {
    const color = getConfidenceColor(result.score);
    const label = `${result.plate.toUpperCase()} ${(result.score * 100).toFixed(0)}%`;
    const box = result.box;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(imageOffsetX + box.xmin * imageScale, imageOffsetY + box.ymin * imageScale, (box.xmax - box.xmin) * imageScale, (box.ymax - box.ymin) * imageScale);
    ctx.restore();

    const labelText = label;
    const fontSize = 13 / zoom;
    ctx.font = `bold ${fontSize}px monospace`;
    const metrics = ctx.measureText(labelText);
    const labelH = 18 / zoom;
    const labelW = metrics.width + 8 / zoom;

    ctx.fillStyle = color;
    ctx.fillRect(imageOffsetX + box.xmin * imageScale, imageOffsetY + box.ymin * imageScale - labelH, labelW, labelH);
    ctx.fillStyle = '#fff';
    ctx.fillText(labelText, imageOffsetX + box.xmin * imageScale + 4 / zoom, imageOffsetY + box.ymin * imageScale - 4 / zoom);
  });

  ctx.restore();
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  imageSrc,
  results,
  showVehicleBoxes,
  open,
  onClose,
  onPrevious,
  onNext,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [zoomPan, setZoomPan] = useState<ZoomPanState>({ zoom: 1, panX: 0, panY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!open) {
      setZoomPan({ zoom: 1, panX: 0, panY: 0 });
    }
  }, [open]);

  useEffect(() => {
    setZoomPan({ zoom: 1, panX: 0, panY: 0 });
  }, [imageSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imageRef.current;
    if (!canvas || !container || !img) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const imageScale = Math.min(containerWidth / img.naturalWidth, containerHeight / img.naturalHeight);
    const imageWidth = img.naturalWidth * imageScale;
    const imageHeight = img.naturalHeight * imageScale;
    const imageOffsetX = (containerWidth - imageWidth) / 2;
    const imageOffsetY = (containerHeight - imageHeight) / 2;
    const { zoom, panX, panY } = zoomPan;

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, imageOffsetX, imageOffsetY, imageWidth, imageHeight);
    ctx.restore();

    drawBoxes(
      ctx,
      results,
      showVehicleBoxes,
      imageScale,
      imageOffsetX,
      imageOffsetY,
      zoom,
      panX,
      panY
    );
  }, [zoomPan, results, showVehicleBoxes]);

  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      draw();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (open) draw();
  }, [open, draw]);

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [open, draw]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoomPan.zoom * delta, 1), 20);

    if (newZoom === 1) {
      setZoomPan({ zoom: 1, panX: 0, panY: 0 });
    } else {
      const zoomRatio = newZoom / zoomPan.zoom;
      const newPanX = mouseX - (mouseX - zoomPan.panX) * zoomRatio;
      const newPanY = mouseY - (mouseY - zoomPan.panY) * zoomRatio;
      setZoomPan({ zoom: newZoom, panX: newPanX, panY: newPanY });
    }
  }, [zoomPan]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomPan.zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [zoomPan.zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setZoomPan((prev) => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.ctrlKey) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomPan((previous) => ({
          ...previous,
          zoom: Math.min(previous.zoom * 1.1, 20),
        }));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomPan((previous) => {
          const zoom = Math.max(previous.zoom * 0.9, 1);
          return zoom === 1 ? { zoom: 1, panX: 0, panY: 0 } : { ...previous, zoom };
        });
      }
      return;
    }

    const panAmount = 60;
    if (zoomPan.zoom > 1) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setZoomPan((previous) => ({ ...previous, panX: previous.panX + panAmount }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setZoomPan((previous) => ({ ...previous, panX: previous.panX - panAmount }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setZoomPan((previous) => ({ ...previous, panY: previous.panY + panAmount }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setZoomPan((previous) => ({ ...previous, panY: previous.panY - panAmount }));
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onPrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNext();
    }
  }, [onClose, onNext, onPrevious, zoomPan.zoom]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const cursorStyle = zoomPan.zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default';

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10001,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#fff',
            fontSize: 24,
            width: 40,
            height: 40,
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          cursor: cursorStyle,
          position: 'relative',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {zoomPan.zoom > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: '0.75rem',
            pointerEvents: 'none',
          }}
        >
          {Math.round(zoomPan.zoom * 100)}% - Drag or use arrows to pan
        </div>
      )}
      {zoomPan.zoom === 1 && imageDimensions.width > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: '0.75rem',
            pointerEvents: 'none',
          }}
        >
          Scroll or Ctrl+/- to zoom | Arrows to navigate | {imageDimensions.width}×{imageDimensions.height}
        </div>
      )}
    </div>
  );
};

export default ImageLightbox;
