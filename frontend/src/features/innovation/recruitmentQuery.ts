/** Keep campus query parameters separate from owner drafts and form data. */
export function recruitmentQuery(values: Record<string, string | string[] | undefined>, detail = false): string {
  const params = new URLSearchParams();
  const keys = detail ? ["achievement_offset", "recruitment_offset"] : ["q", "direction", "stage", "beginner_friendly", "recruiting_only", "offset"];
  for (const key of keys) { const value = values[key]; if (typeof value === "string" && value !== "") params.set(key, value); }
  return params.toString();
}

/** Only same-list public filters travel with a detail link; never an arbitrary URL. */
export function campusDiscoveryHref(kind: 'projects' | 'recruitments', query: string, id?: string): string {
  const context = recruitmentQuery(Object.fromEntries(new URLSearchParams(query)));
  return `/innovation/${kind}${id ? `/${encodeURIComponent(id)}` : ''}${context ? `?${context}` : ''}`;
}
