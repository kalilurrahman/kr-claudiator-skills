import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { BackToTop } from "@/components/BackToTop";
import { HomePage } from "./pages/Index";
import { SkillsBrowser } from "./pages/SkillsBrowser";

const AboutPage = lazy(() => import("./pages/About").then((m) => ({ default: m.AboutPage })));
const FeedbackPage = lazy(() => import("./pages/Feedback").then((m) => ({ default: m.FeedbackPage })));
const FavouritesPage = lazy(() => import("./pages/Favourites").then((m) => ({ default: m.FavouritesPage })));
const NotFoundPage = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient();

function LazyFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-8 h-8 rounded-full gradient-hero animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <DisclaimerBanner />
        <BackToTop />
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/skills" element={<SkillsBrowser />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/favourites" element={<FavouritesPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export { App as default };
