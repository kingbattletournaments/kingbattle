import { getStore } from "@/lib/store";

export type LandingBanner = {
  id: string;
  imageUrl: string;
  linkUrl: string;
};

export type LandingPageData = {
  banners: LandingBanner[];
};

export async function getLandingPageData(): Promise<LandingPageData> {
  const store = getStore();
  const bannersRaw = await store.getBanners().catch(() => []);

  const banners = (bannersRaw ?? [])
    .filter((b) => b.displayPlayCarousel && b.imageUrl)
    .map((b) => ({
      id: b.id,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl ?? "",
    }));

  return { banners };
}
