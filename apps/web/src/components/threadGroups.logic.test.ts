import { describe, expect, it } from "vite-plus/test";

import {
  moveStoredThreadGroup,
  normalizeThreadGroupName,
  planThreadGroupAssignment,
  removeStoredThreadGroup,
  resolveThreadGroups,
  storeThreadGroup,
  THREAD_GROUP_NAME_MAX_LENGTH,
  threadGroupName,
  threadGroupTag,
  updateStoredThreadGroup,
  type StoredThreadGroupsByProject,
} from "./threadGroups.logic";

const stored: StoredThreadGroupsByProject = {
  project: [
    { name: "Galeno", color: "blue", collapsed: true },
    { name: "Catena", color: null, collapsed: false },
  ],
};
const names = (state: StoredThreadGroupsByProject) =>
  (state.project ?? []).map((group) => group.name);

describe("thread group names", () => {
  it.each([
    ["  Galeno  ", "Galeno"],
    ["two\nlines\there", "two lines here"],
    ["   ", null],
    ["x".repeat(80), "x".repeat(THREAD_GROUP_NAME_MAX_LENGTH)],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeThreadGroupName(input)).toBe(expected);
  });

  it("reads a thread's group from its tags and ignores other tags", () => {
    expect(threadGroupName(["recording", threadGroupTag("Galeno"), threadGroupTag("Later")])).toBe(
      "Galeno",
    );
    expect(threadGroupName(["recording", "group:"])).toBeNull();
    expect(threadGroupName(undefined)).toBeNull();
  });
});

describe("planThreadGroupAssignment", () => {
  it.each([
    ["joins a group", ["recording"], "Galeno", [{ tag: "group:Galeno", tagged: true }]],
    [
      "adds the new group before leaving the old one",
      ["group:Galeno"],
      "Catena",
      [
        { tag: "group:Catena", tagged: true },
        { tag: "group:Galeno", tagged: false },
      ],
    ],
    ["writes nothing when already there", ["group:Galeno"], "Galeno", []],
    [
      "leaves every group",
      ["group:Galeno", "recording", "group:Catena"],
      null,
      [
        { tag: "group:Galeno", tagged: false },
        { tag: "group:Catena", tagged: false },
      ],
    ],
  ])("%s", (_name, tags, target, writes) => {
    expect(planThreadGroupAssignment(tags, target)).toEqual(writes);
  });
});

describe("resolveThreadGroups", () => {
  it("lists stored groups in their order, then groups only threads carry, by name", () => {
    const groups = resolveThreadGroups("project", stored.project, [
      "Sol",
      "Galeno",
      "Astra",
      "Sol",
    ]);
    expect(groups.map((group) => group.name)).toEqual(["Galeno", "Catena", "Astra", "Sol"]);
    expect(groups[0]).toMatchObject({ color: "blue", collapsed: true });
    expect(groups[2]).toMatchObject({ color: null, collapsed: false });
    expect(new Set(groups.map((group) => group.id)).size).toBe(4);
  });
});

describe("stored thread groups", () => {
  it("adds a group once and drops a project with no groups left", () => {
    const added = storeThreadGroup(storeThreadGroup({}, "project", "Galeno"), "project", "Galeno");
    expect(names(added)).toEqual(["Galeno"]);
    expect(removeStoredThreadGroup(added, { projectKey: "project", name: "Galeno" })).toEqual({});
  });

  it("stores a group another device created at the place the sidebar shows it", () => {
    const shown = [{ name: "Galeno" }, { name: "Catena" }, { name: "Astra" }, { name: "Sol" }];
    const moved = moveStoredThreadGroup(
      stored,
      { projectKey: "project", name: "Sol" },
      shown,
      "up",
    );
    expect(names(moved)).toEqual(["Galeno", "Catena", "Sol", "Astra"]);
  });

  it("keeps the order when a group is already first or last", () => {
    const shown = [{ name: "Galeno" }, { name: "Catena" }];
    const group = { projectKey: "project", name: "Galeno" };
    expect(names(moveStoredThreadGroup(stored, group, shown, "up"))).toEqual(["Galeno", "Catena"]);
    expect(names(moveStoredThreadGroup(stored, group, shown, "down"))).toEqual([
      "Catena",
      "Galeno",
    ]);
  });

  it("renames in place, keeping color and fold", () => {
    const renamed = updateStoredThreadGroup(
      stored,
      { projectKey: "project", name: "Galeno" },
      [{ name: "Galeno" }, { name: "Catena" }],
      { name: "Pergamum" },
    );
    expect(renamed.project).toEqual([
      { name: "Pergamum", color: "blue", collapsed: true },
      { name: "Catena", color: null, collapsed: false },
    ]);
  });
});
