"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Textarea, Field } from "./form";

type Opts = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** Ask for a free-text reason; resolved value is the text */
  reason?: { label: string; required?: boolean; placeholder?: string };
};
type Resolver = (v: false | string) => void;

const Ctx = createContext<(o: Opts) => Promise<false | string>>(async () => false);

/** `const confirm = useConfirm(); if (await confirm({...}) !== false) …` */
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(Opts & { resolve: Resolver }) | null>(null);
  const [text, setText] = useState("");
  const ask = useCallback((o: Opts) => new Promise<false | string>((resolve) => { setText(""); setState({ ...o, resolve }); }), []);
  const close = (v: false | string) => { state?.resolve(v); setState(null); };
  const blocked = !!state?.reason?.required && text.trim().length < 3;

  return (
    <Ctx.Provider value={ask}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            {state?.destructive && <AlertTriangle className="size-5 text-destructive" />}
            {state?.title}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
            <Button variant={state?.destructive ? "destructive" : "primary"} disabled={blocked} onClick={() => close(text.trim())}>
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        <div className="text-[14px] leading-relaxed text-foreground/85">{state?.message}</div>
        {state?.reason && (
          <Field label={state.reason.label} required={state.reason.required} className="mt-4">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={state.reason.placeholder} maxLength={500} />
          </Field>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}
