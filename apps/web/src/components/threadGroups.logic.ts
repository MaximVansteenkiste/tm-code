import { ProjectIconColor } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

/**
 * A thread joins a group by carrying this tag, so membership lives on the server and
 * follows the thread to every device. The name is the group's identity within a project.
 */
const THREAD_GROUP_TAG_PREFIX = "group:";
const THREAD_TAG_MAX_LENGTH = 64;
export const THREAD_GROUP_NAME_MAX_LENGTH = THREAD_TAG_MAX_LENGTH - THREAD_GROUP_TAG_PREFIX.length;

export const THREAD_GROUP_COLOR_CHOICES = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const satisfies ReadonlyArray<ProjectIconColor>;

/** What this device remembers about a group. A group no thread carries exists only here. */
const StoredThreadGroup = Schema.Struct({
  name: Schema.String,
  color: Schema.NullOr(ProjectIconColor),
  collapsed: Schema.Boolean,
});
type StoredThreadGroup = typeof StoredThreadGroup.Type;

/** Stored groups by sidebar project key, in the order the user arranged them. */
export const StoredThreadGroupsByProject = Schema.Record(
  Schema.String,
  Schema.Array(StoredThreadGroup),
);
export type StoredThreadGroupsByProject = typeof StoredThreadGroupsByProject.Type;

export interface SidebarThreadGroup<TThread> {
  readonly id: string;
  readonly projectKey: string;
  readonly name: string;
  readonly color: ProjectIconColor | null;
  readonly collapsed: boolean;
  readonly threads: readonly TThread[];
}

export function threadGroupId(projectKey: string, name: string): string {
  return `thread-group:${projectKey}:${name}`;
}

export function threadGroupTag(name: string): string {
  return `${THREAD_GROUP_TAG_PREFIX}${name}`;
}

/** Trims and flattens a typed name into one a thread tag accepts, or null when nothing is left. */
export function normalizeThreadGroupName(input: string): string | null {
  const name = input
    .replace(/[\p{Cc}\s]+/gu, " ")
    .trim()
    .slice(0, THREAD_GROUP_NAME_MAX_LENGTH)
    .trim();
  return name.length > 0 ? name : null;
}

export function threadGroupTags(tags: ReadonlyArray<string> | undefined): string[] {
  return (tags ?? []).filter(
    (tag) => tag.startsWith(THREAD_GROUP_TAG_PREFIX) && tag.length > THREAD_GROUP_TAG_PREFIX.length,
  );
}

/** The group a thread shows in. A thread tagged twice by another client shows in the first. */
export function threadGroupName(tags: ReadonlyArray<string> | undefined): string | null {
  return threadGroupTags(tags)[0]?.slice(THREAD_GROUP_TAG_PREFIX.length) ?? null;
}

/** Tag writes that leave a thread in `name` alone, or in no group for null. */
export function planThreadGroupAssignment(
  tags: ReadonlyArray<string> | undefined,
  name: string | null,
): Array<{ readonly tag: string; readonly tagged: boolean }> {
  const target = name === null ? null : threadGroupTag(name);
  const current = threadGroupTags(tags);
  return [
    // Add before removing, so a failed second write leaves the thread grouped.
    ...(target !== null && !current.includes(target) ? [{ tag: target, tagged: true }] : []),
    ...current.filter((tag) => tag !== target).map((tag) => ({ tag, tagged: false })),
  ];
}

/**
 * A project's groups: the ones this device stored, in their order, then any that only
 * its threads carry (tagged on another device), by name.
 */
export function resolveThreadGroups(
  projectKey: string,
  stored: ReadonlyArray<StoredThreadGroup> | undefined,
  taggedNames: Iterable<string>,
): Array<Omit<SidebarThreadGroup<never>, "threads">> {
  const known = new Map((stored ?? []).map((group) => [group.name, group] as const));
  const discovered = [...new Set(taggedNames)]
    .filter((name) => !known.has(name))
    .toSorted((left, right) => left.localeCompare(right));
  return [...known.keys(), ...discovered].map((name) => ({
    id: threadGroupId(projectKey, name),
    projectKey,
    name,
    color: known.get(name)?.color ?? null,
    collapsed: known.get(name)?.collapsed ?? false,
  }));
}

function hasThreadGroupNamed(
  groups: ReadonlyArray<{ readonly name: string }>,
  name: string,
): boolean {
  return groups.some((group) => group.name === name);
}

function updateProjectGroups(
  stored: StoredThreadGroupsByProject,
  projectKey: string,
  update: (groups: ReadonlyArray<StoredThreadGroup>) => ReadonlyArray<StoredThreadGroup>,
): StoredThreadGroupsByProject {
  const next = update(stored[projectKey] ?? []);
  if (next.length > 0) return { ...stored, [projectKey]: next };
  const { [projectKey]: _removed, ...rest } = stored;
  return rest;
}

/** Stores a group this device has not arranged yet, keeping the order the sidebar shows. */
function withStoredGroup(
  groups: ReadonlyArray<StoredThreadGroup>,
  shown: ReadonlyArray<{ readonly name: string }>,
  name: string,
): ReadonlyArray<StoredThreadGroup> {
  const stored = new Map(groups.map((group) => [group.name, group] as const));
  const order = hasThreadGroupNamed(shown, name) ? shown.map((group) => group.name) : [name];
  const ordered = [
    ...groups.map((group) => group.name),
    ...order.filter((entry) => !stored.has(entry)),
  ];
  return ordered.map(
    (entry) => stored.get(entry) ?? { name: entry, color: null, collapsed: false },
  );
}

export function storeThreadGroup(
  stored: StoredThreadGroupsByProject,
  projectKey: string,
  name: string,
): StoredThreadGroupsByProject {
  return updateProjectGroups(stored, projectKey, (groups) => withStoredGroup(groups, [], name));
}

export function updateStoredThreadGroup(
  stored: StoredThreadGroupsByProject,
  group: { readonly projectKey: string; readonly name: string },
  shown: ReadonlyArray<{ readonly name: string }>,
  patch: Partial<StoredThreadGroup>,
): StoredThreadGroupsByProject {
  return updateProjectGroups(stored, group.projectKey, (groups) =>
    withStoredGroup(groups, shown, group.name).map((entry) =>
      entry.name === group.name ? { ...entry, ...patch } : entry,
    ),
  );
}

export function moveStoredThreadGroup(
  stored: StoredThreadGroupsByProject,
  group: { readonly projectKey: string; readonly name: string },
  shown: ReadonlyArray<{ readonly name: string }>,
  direction: "up" | "down",
): StoredThreadGroupsByProject {
  return updateProjectGroups(stored, group.projectKey, (groups) => {
    const next = [...withStoredGroup(groups, shown, group.name)];
    const from = next.findIndex((entry) => entry.name === group.name);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= next.length) return next;
    [next[from], next[to]] = [next[to]!, next[from]!];
    return next;
  });
}

export function removeStoredThreadGroup(
  stored: StoredThreadGroupsByProject,
  group: { readonly projectKey: string; readonly name: string },
): StoredThreadGroupsByProject {
  return updateProjectGroups(stored, group.projectKey, (groups) =>
    groups.filter((entry) => entry.name !== group.name),
  );
}
