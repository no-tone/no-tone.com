import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

// The site is a single-page desktop (projects / cv / about are panels, not
// routes), so the feed carries one canonical entry rather than dead links.
export async function GET(context) {
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: [
      {
        title: "no-tone",
        description:
          "The desktop-style portfolio of a software engineer — projects, cv, about and contact, navigated through an interactive dotted globe.",
        link: "/",
        pubDate: new Date("2026-07-12T00:00:00Z"),
      },
    ],
  });
}
