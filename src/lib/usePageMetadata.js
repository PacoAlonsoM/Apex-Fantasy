import { useEffect } from "react";
import { BRAND_NAME } from "@/src/constants/design";

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertLink(selector, rel, href) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  element.setAttribute("rel", rel);
  element.setAttribute("href", href);
}

export default function usePageMetadata({ title, description, path }) {
  useEffect(() => {
    const fullTitle = `${title} | ${BRAND_NAME}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: description,
    });

    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: fullTitle,
    });

    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: description,
    });

    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: fullTitle,
    });

    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: description,
    });

    if (siteUrl) {
      const baseUrl = siteUrl.replace(/\/+$/, "");
      upsertMeta('meta[property="og:url"]', {
        property: "og:url",
        content: `${baseUrl}${path}`,
      });

      upsertLink('link[rel="canonical"]', "canonical", `${baseUrl}${path}`);
    }
  }, [description, path, title]);
}
