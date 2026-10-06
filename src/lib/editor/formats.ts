import type { ExportSettings } from "./types";

export interface FormatMeta {
  value: ExportSettings["format"];
  label: string;
  extension: string;
  mime: string;
  lossy: boolean;
  supportsTransparency: boolean;
  blurb: string;
}

/** Export targets offered in the UI, shared by the inspector and the dialog. */
export const EXPORT_FORMATS: FormatMeta[] = [
  {
    value: "png",
    label: "PNG — lossless",
    extension: "png",
    mime: "image/png",
    lossy: false,
    supportsTransparency: true,
    blurb: "Best for archiving and further editing.",
  },
  {
    value: "jpeg",
    label: "JPEG — smallest",
    extension: "jpg",
    mime: "image/jpeg",
    lossy: true,
    supportsTransparency: false,
    blurb: "Ideal for apps, print shops and email.",
  },
  {
    value: "webp",
    label: "WebP — modern",
    extension: "webp",
    mime: "image/webp",
    lossy: true,
    supportsTransparency: true,
    blurb: "Around 30% smaller than JPEG at the same look.",
  },
  {
    value: "pdf",
    label: "PDF — document",
    extension: "pdf",
    mime: "application/pdf",
    lossy: false,
    supportsTransparency: false,
    blurb: "Multi-page PDF, one page per document page.",
  },
];

export function formatMeta(format: ExportSettings["format"]): FormatMeta {
  return EXPORT_FORMATS.find((item) => item.value === format) ?? EXPORT_FORMATS[0];
}

/** Preview resolutions offered in the export dialog. */
export const SCALE_PRESETS = [0.5, 1, 1.5, 2, 3] as const;
