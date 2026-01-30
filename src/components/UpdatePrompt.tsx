import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available
                setNeedRefresh(true);
                setShowPrompt(true);
              }
            });
          }
        });

        // Check for updates periodically - every 5 minutes
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000); // Check every 5 minutes
      });

      // Listen for controller change (when new SW takes over)
      // Instead of auto-reloading, show prompt to let user choose when to update
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setNeedRefresh(true);
        setShowPrompt(true);
      });
    }
  }, []);

  const handleUpdate = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
    setShowPrompt(false);
    window.location.reload();
  };

  const handleClose = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-fade-in">
      <Card className="border-primary shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">Nova atualização disponível!</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Uma nova versão do aplicativo está disponível. Atualize para ter acesso às últimas melhorias.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleUpdate} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Atualizar agora
                </Button>
                <Button size="sm" variant="ghost" onClick={handleClose}>
                  Depois
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePrompt;
