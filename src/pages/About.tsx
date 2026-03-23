import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";

export function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-16 md:pt-20">
        <div className="container max-w-4xl mx-auto px-6 py-12 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold text-gradient-brand mb-2">About KR Claudiator Skills</h1>
          <p className="text-muted-foreground mb-10">AI Prompt Engineering for Enterprise Teams</p>

          {/* What is it */}
          <section className="glass-card p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">What is Claudiator?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              KR Claudiator Skills is a curated, open-source library of productivity prompts for <strong className="text-foreground">Claude Code</strong> and <strong className="text-foreground">Claude CoWork</strong>. 
              Each skill is a battle-tested prompt template designed for enterprise engineering teams — covering software development, DevOps, data analytics, AI/ML, security, system design, testing, and API integration.
            </p>
          </section>

          {/* How to use */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-foreground mb-4">How to use this library</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Browse or search", desc: "Find a skill by category, tag, or keyword in the Skills Library." },
                { step: "2", title: "Read & customise", desc: "Open the full prompt, review the template, and tweak for your context." },
                { step: "3", title: "Copy or download", desc: "Copy to clipboard or download as .MD, .PDF, or .TXT — then paste into Claude." },
              ].map((item) => (
                <div key={item.step} className="glass-card p-5 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full gradient-hero flex items-center justify-center text-primary-foreground font-bold text-sm mb-3">
                    {item.step}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Frameworks */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-foreground mb-4">Frameworks by Kalilur Rahman</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-6 gradient-border">
                <h3 className="text-base font-bold text-primary mb-2">ACUITAS</h3>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">AI Quality Engineering — 7 Pillars</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A comprehensive framework for ensuring quality in AI systems — covering Accuracy, Consistency, Usability, Integrity, Timeliness, Auditability, and Scalability.
                </p>
              </div>
              <div className="glass-card p-6 gradient-border">
                <h3 className="text-base font-bold text-accent mb-2">CLARITY</h3>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">AI Product Management — 7 Disciplines</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A structured approach to AI product management — encompassing Context, Leverage, Architecture, Risks, Integration, Testing, and Yield optimisation.
                </p>
              </div>
            </div>
          </section>

          {/* Creator */}
          <section className="glass-card p-6 mb-10">
            <h2 className="text-lg font-semibold text-foreground mb-3">About the Creator</h2>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <h3 className="text-base font-bold text-primary mb-1">Kalilur Rahman</h3>
                <p className="text-xs text-muted-foreground mb-3">Global IT Executive · AI Thought Leader · Kaggle Legacy Grandmaster</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  With decades of enterprise IT leadership experience, Kalilur bridges the gap between cutting-edge AI capabilities and practical business outcomes. 
                  His work spans AI quality engineering, product management frameworks, and open-source tools that empower engineering teams worldwide.
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "Portfolio", href: "https://kalilurrahman.lovable.app" },
                    { label: "LinkedIn", href: "https://www.linkedin.com/in/kalilurrahman/" },
                    { label: "GitHub", href: "https://github.com/kalilurrahman" },
                    { label: "Thinkers360", href: "https://www.thinkers360.com/tl/kalilurrahman" },
                  ].map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-accent transition-colors"
                    >
                      {link.label} →
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="text-center">
            <Link
              to="/skills"
              className="inline-flex items-center gap-2 rounded-full gradient-hero px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg glow-on-hover transition-all hover:-translate-y-0.5"
            >
              Browse All Skills →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
