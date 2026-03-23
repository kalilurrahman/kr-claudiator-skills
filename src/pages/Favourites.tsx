import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SkillCard } from "@/components/SkillCard";
import { SkillModal } from "@/components/SkillModal";
import { getFavourites } from "@/lib/favourites";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import type { Skill, SkillsIndex, CategoryData } from "@/types/skills.types";

export function FavouritesPage() {
  const [favouriteSkills, setFavouriteSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavourites = async () => {
      const favIds = getFavourites();
      if (favIds.length === 0) {
        setLoading(false);
        return;
      }

      const indexRes = await fetch("/data/skills-index.json");
      const index: SkillsIndex = await indexRes.json();

      const allSkills: Skill[] = [];
      for (const cat of index.categories) {
        const res = await fetch(cat.dataFile);
        const data: CategoryData = await res.json();
        allSkills.push(...data.skills);
      }

      setFavouriteSkills(allSkills.filter((s) => favIds.includes(s.id)));
      setLoading(false);
    };

    loadFavourites();

    const handler = () => {
      const ids = getFavourites();
      setFavouriteSkills((prev) => prev.filter((s) => ids.includes(s.id)));
    };
    window.addEventListener("favourites-updated", handler);
    return () => window.removeEventListener("favourites-updated", handler);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-16 md:pt-20">
        <div className="container max-w-6xl mx-auto px-4 py-8 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <Heart className="w-5 h-5 text-destructive fill-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">My favourites</h1>
            <p className="text-sm text-muted-foreground">
              {favouriteSkills.length > 0
                ? `${favouriteSkills.length} skill${favouriteSkills.length !== 1 ? "s" : ""} saved`
                : "Skills you love, all in one place"}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
          ) : favouriteSkills.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favouriteSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onClick={() => setSelectedSkill(skill)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground mb-4">
                No favourites yet. Browse skills and tap the heart icon to save them here.
              </p>
              <Link
                to="/skills"
                className="inline-flex items-center gap-2 rounded-full gradient-hero px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg"
              >
                Browse Skills →
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {selectedSkill && (
        <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
