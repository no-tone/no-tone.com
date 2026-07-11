import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export async function GET(context) {
  const now = new Date();
  const pages = [
    {
      title: "projects",
      description: "Software engineering projects, tools, and experiments — from ML desktop apps to data dashboards.",
      link: "/projects/",
      pubDate: now,
    },
    {
      title: "tldr",
      description: "Quick-read profile and summary — what I do, what I've built, and what I'm learning.",
      link: "/tldr/",
      pubDate: now,
    },
    {
      title: "usr",
      description: "Directory-style reference page — projects, notes, and other artifacts organised for browsing.",
      link: "/usr/",
      pubDate: now,
    },
    {
      title: "cv",
      description: "Curriculum vitae — experience, education, skills, and selected work history.",
      link: "/cv/",
      pubDate: now,
    },
  ];
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: pages,
  });
}
