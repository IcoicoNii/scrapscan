// Shape every admin/resident form action returns to useActionState.
export type ActionState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      /** Success message to announce. */
      done?: string;
      /** What was typed, put back after React resets the form on an error. */
      values?: Record<string, string>;
      /** One-time secret to show (a temporary password). */
      secret?: string;
    }
  | undefined;

export const typedValues = (fd: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, typeof fd.get(k) === "string" ? String(fd.get(k)).slice(0, 500) : ""]));

export const failed = (r: { message: string; fieldErrors?: Record<string, string> }, values?: Record<string, string>): ActionState => ({
  error: r.fieldErrors && Object.keys(r.fieldErrors).length ? undefined : r.message,
  fieldErrors: r.fieldErrors,
  values,
});
