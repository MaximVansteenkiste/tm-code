import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ContextMenuSource, ProjectIconColor } from "@t3tools/contracts";
import { ChevronDownIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "~/lib/utils";
import { contextMenuSourceOf } from "../../contextMenuSource";
import { PROJECT_ICON_COLORS } from "../../projectIconColors";
import type { SidebarThreadGroup } from "../threadGroups.logic";
import { SidebarFolderStatusDot } from "./SidebarProjectFolderHeader";

export type SidebarThreadGroupSnapshot = SidebarThreadGroup<EnvironmentThreadShell>;

const SWATCH_CLASS_NAME = Object.fromEntries(
  PROJECT_ICON_COLORS.map(({ value, swatchClassName }) => [value, swatchClassName]),
) as Record<ProjectIconColor, string>;

/**
 * A thread group's header. Like a shelf header it folds its rows, and while it is
 * closed its dot says when a hidden thread needs you.
 */
export const SidebarThreadGroupHeader = memo(function SidebarThreadGroupHeader(props: {
  group: SidebarThreadGroupSnapshot;
  /** Named when the list mixes groups from several projects. */
  projectName: string | null;
  /** The tree row of the project folder this group sits in. */
  parentRow?: string;
  /** Rows the closed group leaves out. */
  hiddenThreads: readonly EnvironmentThreadShell[];
  isDropTarget: boolean;
  onToggle: (group: SidebarThreadGroupSnapshot) => void;
  onContextMenu: (
    group: SidebarThreadGroupSnapshot,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
}) {
  const { group } = props;
  return (
    <button
      type="button"
      data-testid="sidebar-thread-group"
      data-sidebar-row={group.id}
      data-sidebar-parent={props.parentRow}
      aria-expanded={!group.collapsed}
      onClick={() => props.onToggle(group)}
      onContextMenu={(event) => {
        event.preventDefault();
        props.onContextMenu(
          group,
          { x: event.clientX, y: event.clientY },
          contextMenuSourceOf(event),
        );
      }}
      className={cn(
        "flex h-8 w-full cursor-pointer items-center gap-2 rounded-(--control-radius) px-(--sidebar-row-content-inset) text-left outline-none hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        props.isDropTarget && "bg-primary/5 ring-1 ring-inset ring-primary/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          group.color === null
            ? "border border-sidebar-muted-foreground/60"
            : SWATCH_CLASS_NAME[group.color],
        )}
      />
      <span
        className={cn(
          "min-w-0 truncate text-xs font-medium",
          props.isDropTarget ? "text-primary" : "text-sidebar-foreground/90",
        )}
      >
        {group.name}
      </span>
      {props.projectName === null ? null : (
        <span className="min-w-0 shrink-[2] truncate text-xs text-sidebar-muted-foreground">
          {props.projectName}
        </span>
      )}
      <span aria-hidden className="flex-1" />
      {group.collapsed ? <SidebarFolderStatusDot threads={props.hiddenThreads} /> : null}
      <span className="shrink-0 text-xs tabular-nums text-sidebar-muted-foreground">
        {group.threads.length}
      </span>
      <ChevronDownIcon
        aria-hidden
        className={cn(
          "size-3 shrink-0 text-sidebar-muted-foreground transition-transform",
          group.collapsed && "-rotate-90",
        )}
      />
    </button>
  );
});
