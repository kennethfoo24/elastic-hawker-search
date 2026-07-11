const HERO_DISHES = [
  {
    name: "Chilli Crab",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Chilli_crab-01.jpg/500px-Chilli_crab-01.jpg",
  },
  {
    name: "Hainanese Chicken Rice",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Hainanese_chicken_rice.jpg/500px-Hainanese_chicken_rice.jpg",
  },
  {
    name: "Katong Laksa",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Katong_laksa.jpg/500px-Katong_laksa.jpg",
  },
  {
    name: "Chicken Satay",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/CHICKEN_SATAY.jpg/500px-CHICKEN_SATAY.jpg",
  },
];

/** Decorative photo collage for the hero — real, verified dish photos from the dataset. */
export function HeroCollage() {
  return (
    <div className="hidden shrink-0 grid-cols-2 gap-4 lg:grid">
      {HERO_DISHES.map((dish, i) => (
        <div
          key={dish.name}
          className={`h-[140px] w-[140px] overflow-hidden rounded-3xl border-4 border-white/25 shadow-2xl xl:h-[160px] xl:w-[160px] ${
            i % 2 === 1 ? "mt-10" : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- external hotlinked photos, decorative only */}
          <img src={dish.url} alt={dish.name} loading="lazy" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
