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
  /** `at` is set only for Journal and Dream ends, which are named by kind and date, never by their words. */
  other: { facet: string; label: string; href: string; at?: string | null } | null;
}

export interface WebPayload {
  nodes: WebNode[];
  threads: WebThread[];
  truncated: boolean;
}
