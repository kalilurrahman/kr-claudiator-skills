import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function SkillRequestBanner() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="pb-10">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Can't find the skill you need?
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Request it — we'll build it and add it to the library.
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg gradient-hero px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow glow-on-hover transition-all"
            >
              Request a Skill →
            </button>
          </div>
        </div>
      </section>
      {open && <SkillRequestModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SkillRequestModal({ onClose }: { onClose: () => void }) {
  const [skillName, setSkillName] = useState("");
  const [description, setDescription] = useState("");
  const [useCase, setUseCase] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = skillName.trim();
    const desc = description.trim();
    if (!name || !desc) {
      toast.error("Please fill in skill name and description.");
      return;
    }
    if (desc.length > 300) {
      toast.error("Description must be 300 characters or fewer.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("skill_requests").insert({
      skill_name: name.slice(0, 200),
      description: desc,
      use_case: useCase.trim().slice(0, 500) || null,
      email: email.trim().slice(0, 255) || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't submit. Please try again.");
      return;
    }
    toast.success("Thanks! We'll review your request.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 animate-fade-in"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1.5 text-muted-foreground hover:text-foreground rounded-md"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-base font-semibold text-foreground">Request a Skill</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Tell us what you need — we'll add it to the library.
        </p>
        <div className="space-y-3">
          <Field label="Skill name *">
            <input
              required
              maxLength={200}
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="e.g. Kubernetes Migration Playbook"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label={`What it should do * (${description.length}/300)`}>
            <textarea
              required
              maxLength={300}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the skill's purpose…"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </Field>
          <Field label="Your use case">
            <input
              maxLength={500}
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="How will you use it?"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label="Email (optional)">
            <input
              type="email"
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg gradient-hero px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
