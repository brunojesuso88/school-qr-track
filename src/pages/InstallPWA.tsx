import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Share, PlusSquare, MoreVertical } from "lucide-react";
import edunexusLogo from "@/assets/edunexus-new-logo.png";

const InstallPWA = () => {
  const navigate = useNavigate();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Instalar Aplicativo</h1>
        </div>

        {/* App Preview */}
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <img
              src={edunexusLogo}
              alt="Edunexus"
              className="w-20 h-20 object-contain mx-auto mb-4"
            />
            <h2 className="text-xl font-bold text-foreground">Edunexus</h2>
            <p className="text-foreground text-sm mt-1">
              Sistema Digital de Secretaria Escolar
            </p>
          </CardContent>
        </Card>

        {/* Instructions */}
        {isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Instalar no iPhone/iPad
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Toque no botão Compartilhar</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Share className="h-4 w-4" /> Na barra inferior do Safari
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Selecione "Adicionar à Tela de Início"</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <PlusSquare className="h-4 w-4" /> Role para encontrar a opção
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Toque em "Adicionar"</p>
                  <p className="text-sm text-muted-foreground">
                    O app aparecerá na sua tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isAndroid ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Instalar no Android
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Toque no menu do navegador</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MoreVertical className="h-4 w-4" /> Os três pontos no canto superior
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Selecione "Adicionar à tela inicial"</p>
                  <p className="text-sm text-muted-foreground">
                    Ou "Instalar aplicativo"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Confirme a instalação</p>
                  <p className="text-sm text-muted-foreground">
                    O app aparecerá na sua tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Instalar no seu dispositivo
              </CardTitle>
              <CardDescription>
                Abra esta página no seu celular
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Para instalar o aplicativo, acesse esta página pelo navegador do seu celular (Safari no iPhone ou Chrome no Android) e siga as instruções.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Benefícios do app instalado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              ✅ Acesso rápido pela tela inicial
            </p>
            <p className="flex items-center gap-2">
              ✅ Funciona offline (algumas funções)
            </p>
            <p className="flex items-center gap-2">
              ✅ Experiência de app nativo
            </p>
            <p className="flex items-center gap-2">
              ✅ Carregamento mais rápido
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstallPWA;
