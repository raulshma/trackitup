import type { TemplateCatalogItem } from "@/types/trackitup";

export const trackItUpTemplateCatalog: TemplateCatalogItem[] = [
  {
    id: "template-reef-official",
    name: "Advanced Reef",
    summary:
      "Official multi-metric aquarium schema with routines, thresholds, and inventory.",
    category: "Aquarium",
    origin: "official",
    importMethods: ["local", "deep-link", "qr-code"],
    supportedFieldTypes: [
      "text",
      "rich-text",
      "number",
      "unit",
      "checkbox",
      "tags",
      "media",
      "formula",
    ],
  },
  {
    id: "template-plants-official",
    name: "Plant Care Starter",
    summary:
      "Official plant template with reminders, notes, and asset lifecycle tracking.",
    category: "Gardening",
    origin: "official",
    importMethods: ["local", "deep-link"],
    supportedFieldTypes: [
      "text",
      "rich-text",
      "number",
      "slider",
      "tags",
      "media",
      "location",
    ],
  },
  {
    id: "template-foraging-community",
    name: "Foraging Log Pro",
    summary:
      "Community template tuned for location-tagged finds, photos, and markdown notes.",
    category: "Outdoor",
    origin: "community",
    importMethods: ["deep-link", "qr-code"],
    supportedFieldTypes: [
      "text",
      "rich-text",
      "tags",
      "media",
      "location",
      "formula",
    ],
  },
];
