import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, X, SwitchCamera } from 'lucide-react';
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 720 }, height: { ideal: 720 } }
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
      setFacingMode('user');
      startCamera('user');
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const toggleCamera = useCallback(() => {
    stopCamera();
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  }, [facingMode, stopCamera, startCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const outSize = 400;
    canvas.width = outSize;
    canvas.height = outSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crop to 1:1 square from center
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    // Mirror for front camera
    if (facingMode === 'user') {
      ctx.translate(outSize, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, side, side, 0, 0, outSize, outSize);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (!capturedImage) return;
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

        <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
          {!capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}

          {capturedImage && (
            <img src={capturedImage} alt="Foto capturada" className="w-full h-full object-cover" />
          )}

          {/* Circular frame overlay */}
          {!capturedImage && cameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80"
                style={{
                  width: '75%',
                  aspectRatio: '1/1',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                }}
              />
              <p className="absolute bottom-3 left-0 right-0 text-center text-white/80 text-xs font-medium">
                Enquadre o rosto na moldura
              </p>
            </div>
          )}

          {!capturedImage && !cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-2 animate-pulse" />
                <p className="text-sm">Iniciando câmera...</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 pt-2 flex gap-2 justify-center">
          {!capturedImage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button variant="outline" size="sm" onClick={toggleCamera} disabled={!cameraActive}>
                <SwitchCamera className="w-4 h-4 mr-1" />
                Trocar
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
