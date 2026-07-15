// Types from deovr-json-schema (inlined for standalone app)
export enum ScreenType {
  Flat = "flat",
  Dome = "dome",
  Sphere = "sphere",
  Fisheye = "fisheye",
  MKX200 = "mkx200",
  RF52 = "rf52",
}

export enum StereoMode {
  SideBySide = "sbs",
  TopBottom = "tb",
  OverUnder = "OverUnder",
  Mono = "mono",
}

export type VideoSource = {
  resolution: number;
  url: string;
  height?: number;
  width?: number;
  size?: {
    w?: number;
    h?: number;
    size?: number;
  };
};

export type VideoEncoding = {
  name: "h264" | "h265" | string;
  videoSources: VideoSource[];
};

export type SingleVideoJson = {
  id: number;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  videoLength?: number;
  videoPreview?: string;
  date?: number;
  fps?: number;
  screenType?: ScreenType;
  stereoMode?: StereoMode;
  id3d?: boolean;
  viewAngle?: 180 | 360;
  encodings: VideoEncoding[];
};

// Source JSON types (subset used for parsing)
interface SourceMedia {
  id: string;
  width: number | null;
  height: number | null;
  size: number | null;
  length: number | null;
  type: string;
  name: string | null;
  path: string;
}

interface SourceTierSources {
  [quality: string]: SourceMedia;
}

interface SourceItem {
  __type: string;
  id: string;
  name: string;
  publishedAt: number;
  time: number;
  fov: number | null;
  stereo: string | null;
  description: string;
  previewImage: SourceMedia | null;
  shortVideo: SourceMedia | null;
  categories: Array<{ id: string; slug: string; name: string }>;
  sources: {
    free?: SourceTierSources;
    paid?: SourceTierSources;
  };
}

export interface SourceJson {
  status: { code: number; message: string };
  data: { item: SourceItem };
}

/**
 * Simple djb2-style hash to convert a UUID string to a positive integer
 * suitable for DeoVR's numeric `id` field.
 * The iteration length is capped at 36 (the standard UUID length) as a
 * defensive measure against non-UUID strings from untrusted input.
 */
function uuidToNumber(uuid: string): number {
  let hash = 5381;
  // Standard UUIDs are 36 characters (e.g. "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx").
  // Cap at 36 to guard against unexpectedly long strings from untrusted input.
  const len = Math.min(uuid.length, 36);
  for (let i = 0; i < len; i++) {
    hash = ((hash << 5) + hash + uuid.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Infer screen type from category slugs.
 * VRPorn categories like "180", "360" map to DeoVR screenType/viewAngle.
 */
function inferScreenMeta(
  categorySlugs: string[],
  fov: number | null
): Pick<SingleVideoJson, "screenType" | "viewAngle" | "id3d" | "stereoMode" | "fps"> {
  const has = (slug: string) => categorySlugs.includes(slug);

  let screenType: ScreenType = ScreenType.Dome;
  let viewAngle: 180 | 360 = 180;

  if (has("360") || fov === 360) {
    screenType = ScreenType.Sphere;
    viewAngle = 360;
  } else if (has("180") || fov === 180) {
    screenType = ScreenType.Dome;
    viewAngle = 180;
  } else if (has("flat")) {
    screenType = ScreenType.Flat;
  } else if (has("fisheye")) {
    screenType = ScreenType.Fisheye;
  }

  const id3d = has("3d");
  // VRPorn.com 3D content is side-by-side stereo; the source API does not expose
  // the stereo layout explicitly (the `stereo` field is always null in observed data),
  // so SideBySide is the safe default for 180° VR content from this platform.
  const stereoMode: StereoMode | undefined = id3d ? StereoMode.SideBySide : undefined;
  const fps = has("60-fps") ? 60 : undefined;

  return { screenType, viewAngle, id3d: id3d ? true : undefined, stereoMode, fps };
}

/**
 * Convert a tier of video sources (e.g. sources.free or sources.paid) into
 * an array of DeoVR VideoSource objects, sorted by resolution ascending.
 */
function tierToVideoSources(tier: SourceTierSources): VideoSource[] {
  return Object.values(tier)
    .filter((s) => s.height != null)
    .map((s): VideoSource => ({
      resolution: s.height as number,
      url: s.path,
      height: s.height ?? undefined,
      width: s.width ?? undefined,
      size:
        s.width != null || s.height != null || s.size != null
          ? { w: s.width ?? undefined, h: s.height ?? undefined, size: s.size ?? undefined }
          : undefined,
    }))
    .sort((a, b) => a.resolution - b.resolution);
}

/**
 * Parse a VRPorn.com API response into a DeoVR SingleVideoJson object.
 *
 * Mapping:
 *   data.item.name            → title
 *   data.item.id (UUID)       → id (hashed to number)
 *   data.item.previewImage    → thumbnailUrl
 *   data.item.time            → videoLength (seconds)
 *   data.item.description     → description
 *   data.item.publishedAt     → date (unix timestamp)
 *   data.item.shortVideo      → videoPreview
 *   data.item.sources.free    → encodings[0] ("free") videoSources
 *   data.item.sources.paid    → encodings[1] ("paid") videoSources (if present)
 *   categories: 180/360/3d/60-fps → screenType / viewAngle / id3d / stereoMode / fps
 */
export function parseSourceToDeoVR(source: SourceJson): SingleVideoJson {
  const item = source.data.item;
  const categorySlugs = item.categories.map((c) => c.slug);

  const screenMeta = inferScreenMeta(categorySlugs, item.fov);

  const encodings: VideoEncoding[] = [];

  if (item.sources.free && Object.keys(item.sources.free).length > 0) {
    encodings.push({
      // Use "free" as the encoding name since the actual codec is not provided by the source API
      name: "free",
      videoSources: tierToVideoSources(item.sources.free),
    });
  }

  if (item.sources.paid && Object.keys(item.sources.paid).length > 0) {
    encodings.push({
      // Use "paid" as the encoding name since the actual codec is not provided by the source API
      name: "paid",
      videoSources: tierToVideoSources(item.sources.paid),
    });
  }

  return {
    id: uuidToNumber(item.id),
    title: item.name,
    description: item.description || undefined,
    thumbnailUrl: item.previewImage?.path || undefined,
    videoPreview: item.shortVideo?.path || undefined,
    videoLength: item.time || undefined,
    date: item.publishedAt || undefined,
    ...screenMeta,
    encodings,
  };
}
