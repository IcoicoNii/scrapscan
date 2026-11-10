"use client";

import { useId } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  variant?: "pill" | "box";
  labelHidden?: boolean;
  hint?: string;
};

/** Visible-or-screen-reader label, linked error text, and aria-invalid wiring in one place. */
export function TextField({ label, error, hint, variant = "box", labelHidden = false, className = "", ...rest }: Props) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className={labelHidden ? "sr-only" : "mb-1 block text-sm font-semibold"}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${variant === "pill" ? "field-pill" : "field-box"} ${className}`}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 px-2 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1.5 px-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
