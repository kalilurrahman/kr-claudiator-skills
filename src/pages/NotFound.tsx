import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-16 md:pt-20 flex items-center justify-center">
        <div className="text-center px-6 animate-fade-in">
          <div className="text-7xl font-bold text-gradient-brand mb-4">404</div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Skill not found</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link
            to="/skills"
            className="inline-flex items-center gap-2 rounded-full gradient-hero px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg glow-on-hover transition-all hover:-translate-y-0.5"
          >
            Browse Skills Library →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
