/** Shapes returned by GET /api/reflections/river (Reflections Web view, Life Web step 1). */

export interface WebNode {
  id: string;
  title: string;
  createdAt: string;
  sourceType: string;
  element: string | null;
  draft: boolean;
}

export interface WebThread {
  id: string;
  reflectionId: string;
  /** 'out': the member carried this Reflection into another room. 'in': it was kept from there. */
  direction: 'out' | 'in';
  gesture: string | null;
  createdAt: string;
  other: { facet: string; label: string; href: string } | null;
}

export interface WebPayload {
  nodes: WebNode[];
  threads: WebThread[];
  truncated: boolean;
}
