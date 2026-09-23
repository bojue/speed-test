/**
 * Content-type markers shared by the webmaster and engineer report views.
 *
 * Icon geometry is taken from Lucide (lucide-react, ISC licensed) so the markers
 * stay visually consistent with the other inline icons in the report.
 */

export interface IconShape {
  tag: 'path' | 'rect' | 'circle';
  attrs: Record<string, string | number>;
}

const CONTENT_TYPE_ICONS: Record<string, IconShape[]> = {
  html: [
    { tag: 'path', attrs: { d: 'm18 16 4-4-4-4' } },
    { tag: 'path', attrs: { d: 'm6 8-4 4 4 4' } },
    { tag: 'path', attrs: { d: 'm14.5 4-5 16' } },
  ],
  script: [
    { tag: 'path', attrs: { d: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1' } },
    { tag: 'path', attrs: { d: 'M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1' } },
  ],
  stylesheet: [
    { tag: 'circle', attrs: { cx: 13.5, cy: 6.5, r: 0.5, fill: 'currentColor', stroke: 'none' } },
    { tag: 'circle', attrs: { cx: 17.5, cy: 10.5, r: 0.5, fill: 'currentColor', stroke: 'none' } },
    { tag: 'circle', attrs: { cx: 8.5, cy: 7.5, r: 0.5, fill: 'currentColor', stroke: 'none' } },
    { tag: 'circle', attrs: { cx: 6.5, cy: 12.5, r: 0.5, fill: 'currentColor', stroke: 'none' } },
    {
      tag: 'path',
      attrs: {
        d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z',
      },
    },
  ],
  image: [
    { tag: 'rect', attrs: { width: 18, height: 18, x: 3, y: 3, rx: 2, ry: 2 } },
    { tag: 'circle', attrs: { cx: 9, cy: 9, r: 2 } },
    { tag: 'path', attrs: { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' } },
  ],
  font: [
    { tag: 'path', attrs: { d: 'M12 4v16' } },
    { tag: 'path', attrs: { d: 'M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2' } },
    { tag: 'path', attrs: { d: 'M9 20h6' } },
  ],
  other: [
    { tag: 'path', attrs: { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' } },
    { tag: 'path', attrs: { d: 'M14 2v4a2 2 0 0 0 2 2h4' } },
  ],
};

/** Icon geometry for a resource type, falling back to a generic file icon */
export function contentTypeIcon(type: string): IconShape[] {
  return CONTENT_TYPE_ICONS[type] || CONTENT_TYPE_ICONS.other;
}

/** Tailwind text color class used as the icon stroke for a resource type */
export function contentTypeTextColor(type: string): string {
  switch (type) {
    case 'script': return 'text-[#fbc02d]';
    case 'image': return 'text-[#70c144]';
    case 'stylesheet': return 'text-[#42a5f5]';
    case 'font': return 'text-[#ab47bc]';
    case 'html': return 'text-[#ff8a65]';
    default: return 'text-[#9e9e9e]';
  }
}
