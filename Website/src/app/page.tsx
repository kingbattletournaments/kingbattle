import type { Metadata } from "next";
import { brand, resolveMeta } from "@config/brand";
import LandingPage from "@/components/landing/LandingPage";
import "./landing.css";

export const metadata: Metadata = {
  title: resolveMeta(brand.meta.title),
  description: resolveMeta(brand.meta.description),
};

export default function HomePage() {
  return <LandingPage />;
}
