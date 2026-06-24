/**
 * King Battle public website branding & download links.
 */

export const brand = {
  appName: "King Battle",

  tagline: "Play Free Fire. Win Real Coins.",

  hero: {
    typedPhrases: ["Play Free Fire", "Win Real Coins", "Join Daily Cups"],
    subtitle:
      "King Battle is a secure tournament platform built for fair, skill-based Free Fire competitions. Download the app and start winning today.",
  },

  /** Direct APK download URL. Set via NEXT_PUBLIC_APK_DOWNLOAD_URL when hosting the APK. */
  download: {
    apkUrl: process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL ?? "",
    buttonLabel: "Download Now !!",
  },

  features: [
    {
      title: "Daily Tournaments",
      description: "Solo, duo, and squad matches with live schedules and instant room details.",
      icon: "🏆",
    },
    {
      title: "Real Coin Rewards",
      description: "Win prize pools, per-kill bonuses, and rank rewards you can withdraw.",
      icon: "💰",
    },
    {
      title: "Fair & Secure",
      description: "Verified entries, transparent results, and admin-managed payouts.",
      icon: "🛡️",
    },
    {
      title: "Refer & Earn",
      description: "Invite friends with your username and earn when they join paid matches.",
      icon: "🤝",
    },
  ],

  howToPlay: {
    title: "How To Play",
    subtitle: "Begin your game now",
    steps: [
      { title: "Download App", description: "Install King Battle and create your account." },
      { title: "Add Coins", description: "Deposit via UPI and join your favourite tournament." },
      { title: "Play & Win", description: "Enter the room, compete, and claim your rewards." },
    ],
  },

  prizes: {
    title: "Money Prizes",
    description:
      "Once you win your first tournament, request a withdrawal from your King Battle wallet. Keep playing to win bigger prizes. Supported payout methods include UPI, GPay, and Paytm.",
    methods: ["UPI", "GPay", "Paytm"],
  },

  footer: {
    copyright: "King Battle. All rights reserved.",
    adminPath: "/admin/login",
  },

  meta: {
    title: "{appName} — Free Fire Tournament App",
    description:
      "Download King Battle — daily Free Fire tournaments, real coin prizes, leaderboards, and instant withdrawals.",
  },

  colors: {
    dark: "#363636",
    accent: "#22c55e",
    accentHover: "#16a34a",
    accentAlt: "#f07873",
  },
} as const;

export type BrandConfig = typeof brand;

export function resolveMeta(str: string): string {
  return str.replace(/\{appName\}/g, brand.appName).replace(/\{tagline\}/g, brand.tagline);
}
