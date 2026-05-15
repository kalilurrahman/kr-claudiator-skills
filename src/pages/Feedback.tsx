import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SeoHead } from "@/components/SeoHead";
import { Star, Send, CheckCircle2, MessageSquare } from "lucide-react";

const FEEDBACK_TYPES = ["Bug Report", "Feature Request", "Skill Suggestion", "General Praise"] as const;

export function FeedbackPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedbackType, setFeedbackType] = useState<string>(FEEDBACK_TYPES[0]);
  const [skillName, setSkillName] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = message.trim().length >= 20;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const subject = encodeURIComponent(`[KR Claudiator Skills Feedback] — ${feedbackType}`);
    const body = encodeURIComponent(
      `Name: ${name || "Not provided"}\nEmail: ${email || "Not provided"}\nFeedback Type: ${feedbackType}\nSkill Name: ${skillName || "N/A"}\nRating: ${rating}/5\n\nMessage:\n${message}`
    );
    window.open(`mailto:rahman.kalilur@outlook.com?subject=${subject}&body=${body}`, "_self");
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pt-16 md:pt-20 flex items-center justify-center">
          <div className="text-center animate-fade-in px-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Thank you!</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Your feedback email client has been opened. If it didn't open, email us directly at{" "}
              <a href="mailto:rahman.kalilur@outlook.com" className="text-primary hover:underline">
                rahman.kalilur@outlook.com
              </a>
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs text-primary hover:text-accent transition-colors"
            >
              Send another →
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SeoHead
        title="Send Feedback or Suggest a Skill | Claudiator"
        description="Report bugs, request features, or suggest a new Claude Skill for the Claudiator library. We read every message."
        canonical="https://kr-claudiator-skills.lovable.app/feedback"
      />
      <Header />
      <main className="flex-1 pt-16 md:pt-20">
        <div className="container max-w-xl mx-auto px-6 py-12 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto rounded-full gradient-hero flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Share your feedback</h1>
            <p className="text-sm text-muted-foreground">Help improve KR Claudiator Skills — your input is valued</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="your@email.com"
              />
            </div>

            {/* Feedback type */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Feedback type</label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFeedbackType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      feedbackType === type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill name */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Related skill (optional)</label>
              <input
                type="text"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., API Design, Circuit Breaker..."
              />
            </div>

            {/* Rating */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        star <= (hoverRating || rating)
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">
                Message <span className="text-destructive">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                rows={5}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Tell us what you think (minimum 20 characters)..."
              />
              <p className={`text-[10px] mt-1 ${message.length < 20 ? "text-muted-foreground" : "text-success"}`}>
                {message.length}/1000 characters {message.length < 20 && `(${20 - message.length} more needed)`}
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg gradient-hero px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Submit feedback
            </button>

            <p className="text-[10px] text-muted-foreground text-center">
              Your feedback goes directly to the creator via email. No data is stored on any server.
            </p>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
