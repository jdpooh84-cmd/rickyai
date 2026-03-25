import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Check, Share2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) setIsInstalled(true);

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground mb-2">Already Installed!</h1>
          <p className="text-muted-foreground">RickyAI is installed on your device. You can open it from your home screen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative p-6">
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-hero flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl font-bold text-primary-foreground">R</span>
          </div>

          <h1 className="text-2xl font-bold font-display text-foreground mb-2">Install RickyAI</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Get instant access from your home screen. Works offline, loads fast, feels like a native app.
          </p>

          <div className="space-y-3 mb-6 text-left">
            {["Works on iPhone, Android, and desktop", "No app store needed", "Access your strategy on the go", "Push notifications for action items"].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-secondary-foreground">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          {deferredPrompt ? (
            <Button variant="hero" size="lg" className="w-full" onClick={handleInstall}>
              <Download className="w-4 h-4" /> Install RickyAI
            </Button>
          ) : isIOS ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-card border border-border text-left space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" /> Install on iPhone / iPad
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Tap the <Share2 className="w-3 h-3 inline" /> <strong>Share</strong> button at the bottom of Safari</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                  <li>Tap <strong>"Add"</strong> in the top right</li>
                </ol>
              </div>
              <p className="text-[10px] text-muted-foreground">Must use Safari for iOS installation</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-card border border-border text-left space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" /> Install on Your Device
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open your browser menu (⋮ three dots)</li>
                  <li>Tap <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong></li>
                  <li>Confirm the installation</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallApp;
