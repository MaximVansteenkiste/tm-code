import { useEffect, useId, useState } from "react";
import { T, useGT } from "gt-react";
import { create } from "zustand";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { normalizeThreadGroupName, THREAD_GROUP_NAME_MAX_LENGTH } from "./threadGroups.logic";

type Request = {
  /** The group being renamed, or null when creating one. */
  readonly currentName: string | null;
  readonly takenNames: ReadonlyArray<string>;
  readonly resolve: (name: string | null) => void;
};
const useRequest = create<{ request: Request | null }>(() => ({ request: null }));

/** Asks for a group name. Resolves null when the user cancels. */
export function requestThreadGroupName(input: {
  readonly currentName: string | null;
  readonly takenNames: ReadonlyArray<string>;
}): Promise<string | null> {
  useRequest.getState().request?.resolve(null);
  return new Promise((resolve) => useRequest.setState({ request: { ...input, resolve } }));
}

function finish(name: string | null) {
  const request = useRequest.getState().request;
  useRequest.setState({ request: null });
  request?.resolve(name);
}

export function ThreadGroupNameDialogHost() {
  const request = useRequest((state) => state.request);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- resolves a pending group name request with null when the dialog host unmounts
  useEffect(() => () => finish(null), []);
  return request ? <ThreadGroupNameDialog request={request} /> : null;
}

function ThreadGroupNameDialog({ request }: { request: Request }) {
  const gt = useGT();
  const id = useId();
  const [name, setName] = useState(request.currentName ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finish(null);
      }}
    >
      <DialogPopup className="sm:max-w-sm">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            const normalized = normalizeThreadGroupName(name);
            if (normalized === null) {
              setError(gt("Enter a name for the group."));
              return;
            }
            if (normalized !== request.currentName && request.takenNames.includes(normalized)) {
              setError(gt("This project already has a group with that name."));
              return;
            }
            finish(normalized);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {request.currentName === null ? <T>New group</T> : <T>Rename group</T>}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Label className="flex min-w-0 flex-col items-stretch" htmlFor={`${id}-name`}>
              <T context="name of a thread group">Name</T>
              <Input
                nativeInput
                id={`${id}-name`}
                autoFocus
                maxLength={THREAD_GROUP_NAME_MAX_LENGTH}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
              />
            </Label>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(null)}>
              <T>Cancel</T>
            </Button>
            <Button type="submit">
              {request.currentName === null ? (
                <T context="verb, create the group">Create</T>
              ) : (
                <T context="verb, rename the group">Rename</T>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
