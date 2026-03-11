import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface CameraPhotoCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File, previewUrl: string) => void;
}

export const CameraPhotoCapture = ({ open, onOpenChange, onCapture }: CameraPhotoCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      toast.error('Não foi possível acessar a câmera. Verifique as permissões.');
      onOpenChange(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      setCapturedImage(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Output size 3x4 ratio
    const outW = 300;
    const outH = 400;
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate crop area from video to maintain 3:4 ratio
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetRatio = 3 / 4;
    const videoRatio = vw / vh;

    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (videoRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (!capturedImage) return;
    // Convert data URL to File
    fetch(capturedImage)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `foto-aluno-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, capturedImage);
        onOpenChange(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Tirar Foto
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
          {/* Video feed */}
          {!capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}

          {/* Captured preview */}
          {capturedImage && (
            <img src={capturedImage} alt="Foto capturada" className="w-full h-full object-cover" />
          )}

          {/* 3x4 frame overlay - only when camera is active */}
          {!capturedImage && cameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Semi-transparent overlay */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Clear center window (3x4 ratio) */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/80 rounded-lg"
                style={{
                  width: '70%',
                  aspectRatio: '3/4',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                }}
              />

              {/* Corner markers */}
              {/* Top-left */}
              <div className="absolute left-[15%] top-[calc(50%-35%*4/3/2)]" style={{ top: 'calc(50% - 46.67%)' }}>
                <div className="w-5 h-5 border-t-3 border-l-3 border-white rounded-tl-md" style={{ borderWidth: '3px 0 0 3px' }} />
              </div>
              {/* Top-right */}
              <div className="absolute right-[15%]" style={{ top: 'calc(50% - 46.67%)' }}>
                <div className="w-5 h-5 border-white rounded-tr-md" style={{ borderWidth: '3px 3px 0 0', borderStyle: 'solid' }} />
              </div>
              {/* Bottom-left */}
              <div className="absolute left-[15%]" style={{ bottom: 'calc(50% - 46.67%)' }}>
                <div className="w-5 h-5 border-white rounded-bl-md" style={{ borderWidth: '0 0 3px 3px', borderStyle: 'solid' }} />
              </div>
              {/* Bottom-right */}
              <div className="absolute right-[15%]" style={{ bottom: 'calc(50% - 46.67%)' }}>
                <div className="w-5 h-5 border-white rounded-br-md" style={{ borderWidth: '0 3px 3px 0', borderStyle: 'solid' }} />
              </div>

              {/* Guide text */}
              <p className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-xs font-medium">
                Enquadre o rosto na moldura 3x4
              </p>
            </div>
          )}

          {/* Loading state */}
          {!capturedImage && !cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-2 animate-pulse" />
                <p className="text-sm">Iniciando câmera...</p>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-4 pt-2 flex gap-2 justify-center">
          {!capturedImage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCapture} disabled={!cameraActive}>
                <Camera className="w-4 h-4 mr-1" />
                Capturar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleRetake}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Tirar Novamente
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                <Check className="w-4 h-4 mr-1" />
                Usar esta Foto
              </Button>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};
