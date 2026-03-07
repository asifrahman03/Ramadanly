import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ramadanly",
    short_name: "Ramadanly",
    description: "Prayer discipline tracker with reminder notifications.",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#09080b",
    theme_color: "#4a1115",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
