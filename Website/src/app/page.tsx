import type { Metadata } from "next";
import { brand, resolveMeta } from "@config/brand";
import { getLandingPageData } from "@/lib/landing-data";
import LandingPage from "@/components/landing/LandingPage";
import "./landing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: resolveMeta(brand.meta.title),
  description: resolveMeta(brand.meta.description),
};

export default async function HomePage() {
  const data = await getLandingPageData();
  return <LandingPage data={data} />;
}
