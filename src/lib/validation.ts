import { z } from "zod";

export const TAGS = ["new", "improved", "fixed"] as const;
export type Tag = (typeof TAGS)[number];
export const STATUSES = ["draft", "published"] as const;

export const RESERVED_SLUGS = new Set(["api", "dashboard", "login", "signup", "c", "rss", "admin", "static"]);

export function cleanText(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

const text = (max: number, min = 0) => z.string().transform(cleanText).pipe(z.string().min(min).max(max));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{2,39}$/, "3 à 40 caractères : lettres, chiffres ou -")
  .refine((s) => !RESERVED_SLUGS.has(s), "Ce nom est réservé");

export const projectSchema = z.object({
  name: text(60, 1),
  slug: slugSchema,
});

export const settingsSchema = z.object({
  name: text(60, 1),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (ex. #c93a22)")
    .transform((c) => c.toLowerCase()),
});

/** "2026-09-20" -> UTC midnight millis (so "today" is never in the future). Rejects impossible dates such as 2026-02-31. */
export function parseDay(input: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t;
}

export const entrySchema = z.object({
  title: text(120, 1),
  body: text(5000),
  tag: z.enum(TAGS),
  status: z.enum(STATUSES),
  day: z
    .string()
    .transform((s, ctx) => {
      const t = parseDay(s);
      if (t === null) ctx.addIssue({ code: "custom", message: "Date invalide (AAAA-MM-JJ)" });
      return t ?? 0;
    }),
});

export const signupSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((e) => e.toLowerCase()),
  password: z.string().min(8, "8 caractères minimum").max(200),
});

export const FREE_PROJECT_LIMIT = 1;
