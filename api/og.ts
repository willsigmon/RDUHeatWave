import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const SITE = {
  "siteName": "RDU Heatwave",
  "defaultTitle": "RDU Heatwave | Two Twelve Referral Team",
  "defaultSubtitle": "A Raleigh-Durham 212 Referral Network team for structured business introductions.",
  "eyebrow": "Raleigh-Durham \u2022 referral networking",
  "accent": "#E8580C",
  "bg": "#111827",
  "bg2": "#7C2D12",
  "fg": "#FFF7ED",
  "muted": "#FED7AA",
  "domainLabel": "rduheatwave.team"
};

type OgElement = { type: string; props: Record<string, unknown> };

function h(type: string, props: Record<string, unknown>, ...children: unknown[]): OgElement {
  return { type, props: { ...props, children } };
}

function clean(value: string | null, fallback: string, max = 110) {
  const text = (value || fallback).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function handler(request: Request) {
  const url = new URL(request.url);
  const title = clean(url.searchParams.get("title"), SITE.defaultTitle, 72);
  const subtitle = clean(url.searchParams.get("subtitle"), SITE.defaultSubtitle, 132);
  const eyebrow = clean(url.searchParams.get("eyebrow"), SITE.eyebrow, 72);

  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `radial-gradient(circle at 18% 12%, ${SITE.accent}55 0, transparent 30%), linear-gradient(135deg, ${SITE.bg} 0%, ${SITE.bg2} 100%)`,
          color: SITE.fg,
          padding: 72,
          fontFamily: "Arial, sans-serif",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 } },
        h("div", { style: { display: "flex", fontSize: 30, letterSpacing: 7, textTransform: "uppercase", color: SITE.muted } }, eyebrow),
        h(
          "div",
          {
            style: {
              border: `2px solid ${SITE.accent}`,
              display: "flex",
              color: SITE.fg,
              borderRadius: 999,
              padding: "10px 18px",
              fontSize: 24,
              fontWeight: 700,
            },
          },
          SITE.siteName,
        ),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 } },
        h("div", { style: { display: "flex", fontSize: 82, lineHeight: 0.96, fontWeight: 900, letterSpacing: -2 } }, title),
        h("div", { style: { display: "flex", fontSize: 38, lineHeight: 1.18, color: SITE.muted, maxWidth: 840 } }, subtitle),
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 26 } },
        h("div", { style: { display: 'flex', color: SITE.muted } }, SITE.domainLabel),
        h("div", { style: { display: 'flex', color: SITE.fg, fontWeight: 800 } }, "Built for search + sharing"),
      ),
    ) as never,
    { width: 1200, height: 630 },
  );
}
