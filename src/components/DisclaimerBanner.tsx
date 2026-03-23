import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export function DisclaimerBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("claudiator_disclaimer_dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("claudiator_disclaimer_dismissed", "true");
  };

  if (!visible) return null;

  return (
    <div className="fixed top-14 md:top-16 left-0 right-0 z-40 bg-warning/10 border-b border-warning/30 animate-fade-in">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="flex-1 text-xs text-foreground/80 leading-relaxed">
          <strong>Disclaimer:</strong> These AI prompts are provided for guidance purposes only.
          Outcomes generated using these prompts are entirely at the user's own risk.
          Kalilur Rahman and KR Claudiator Skills accept no liability for any decisions made based on AI-generated content.
        </p>
        <button
          onClick={handleDismiss}
          className="shrink-0 px-3 py-1 text-[10px] font-semibold bg-warning/20 text-warning rounded-lg hover:bg-warning/30 transition-colors"
        >
          Got it
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
