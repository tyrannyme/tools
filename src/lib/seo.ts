export const siteUrl = "https://tools.tyranny.me";
export const siteName = "Tools by Tyranny";

interface PageSeo {
  title: string;
  description: string;
  path: string;
  /** Path of a 1200x630 preview image, relative to the site root. */
  image?: string;
}

/** Title, description, canonical URL, and social preview tags for a page. */
export function seo({ title, description, path, image = "/og/home.png" }: PageSeo) {
  const url = siteUrl + path;
  const imageUrl = siteUrl + image;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteName },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: imageUrl },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@tyrannyme" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
