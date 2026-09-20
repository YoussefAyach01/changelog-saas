"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createLimiter } from "@/lib/ratelimit";
import { currentUser, endSession, startSession } from "@/lib/session";
import { parseOrigins } from "@/lib/cors";
import {
  ConflictError,
  addEntry,
  createProject,
  createUser,
  deleteEntry,
  getOwnedProject,
  getUserByEmail,
  listProjects,
  updateEntry,
  updateProject,
} from "@/lib/repo";
import {
  FREE_PROJECT_LIMIT,
  entrySchema,
  projectSchema,
  settingsSchema,
  signupSchema,
} from "@/lib/validation";

const authLimiter = createLimiter(10, 15 * 60 * 1000);
const DUMMY_HASH = hashPassword("not-a-real-password");

const str = (f: FormData, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : "");
const enc = encodeURIComponent;

async function clientKey() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function signup(form: FormData) {
  if (!authLimiter(`auth:${await clientKey()}`))
    redirect(`/signup?error=${enc("Trop d'essais. Réessayez dans 15 minutes.")}`);
  const parsed = signupSchema.safeParse({
    email: str(form, "email"),
    password: str(form, "password"),
  });
  if (!parsed.success) redirect(`/signup?error=${enc(parsed.error.issues[0].message)}`);
  let userId: number;
  try {
    userId = createUser(getDb(), parsed.data.email, hashPassword(parsed.data.password));
  } catch (e) {
    if (e instanceof ConflictError)
      redirect(`/signup?error=${enc("Un compte existe déjà avec cet email")}`);
    throw e;
  }
  await startSession(userId);
  redirect("/dashboard");
}

export async function login(form: FormData) {
  if (!authLimiter(`auth:${await clientKey()}`))
    redirect(`/login?error=${enc("Trop d'essais. Réessayez dans 15 minutes.")}`);
  const user = getUserByEmail(getDb(), str(form, "email").trim().toLowerCase());
  const ok = verifyPassword(str(form, "password"), user?.pw_hash ?? DUMMY_HASH) && !!user;
  if (!ok || !user) redirect(`/login?error=${enc("Email ou mot de passe incorrect")}`);
  await startSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/");
}

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

async function requireProject(form: FormData) {
  const user = await requireUser();
  const id = Number(str(form, "projectId"));
  const project = getOwnedProject(getDb(), user.id, id);
  if (!project) redirect("/dashboard");
  return {
    user,
    project,
    back: (m: string, k: "ok" | "err" = "ok") =>
      redirect(`/dashboard/${project.id}?${k}=${enc(m)}`),
  };
}

export async function newProject(form: FormData) {
  const user = await requireUser();
  const db = getDb();
  if (user.plan !== "pro" && listProjects(db, user.id).length >= FREE_PROJECT_LIMIT)
    redirect(`/dashboard?err=${enc("Le plan gratuit est limité à 1 projet")}`);
  const parsed = projectSchema.safeParse({ name: str(form, "name"), slug: str(form, "slug") });
  if (!parsed.success) redirect(`/dashboard?err=${enc(parsed.error.issues[0].message)}`);
  try {
    const id = createProject(db, user.id, parsed.data.slug, parsed.data.name);
    redirect(`/dashboard/${id}?ok=${enc("Projet créé")}`);
  } catch (e) {
    if (e instanceof ConflictError)
      redirect(`/dashboard?err=${enc("Ce nom d'adresse est déjà pris")}`);
    throw e;
  }
}

export async function saveSettings(form: FormData) {
  const { user, project, back } = await requireProject(form);
  const { origins, invalid } = parseOrigins(str(form, "origins"));
  if (invalid.length) back(`Site invalide : ${invalid[0]} (ex. https://monsite.ma)`, "err");
  const parsed = settingsSchema.safeParse({ name: str(form, "name"), accent: str(form, "accent") });
  if (!parsed.success) back(parsed.error.issues[0].message, "err");
  else {
    updateProject(getDb(), user.id, project.id, { ...parsed.data, origins: origins.join("\n") });
    back("Réglages enregistrés");
  }
}

function entryFields(form: FormData) {
  return entrySchema.safeParse({
    title: str(form, "title"),
    body: str(form, "body"),
    tag: str(form, "tag"),
    status: str(form, "status"),
    day: str(form, "day"),
  });
}

export async function createEntry(form: FormData) {
  const { project, back } = await requireProject(form);
  const p = entryFields(form);
  if (!p.success) back(p.error.issues[0].message, "err");
  else {
    const { day, ...rest } = p.data;
    addEntry(getDb(), project.id, { ...rest, publishedAt: day });
    back(p.data.status === "published" ? "Nouveauté publiée" : "Brouillon enregistré");
  }
}

export async function saveEntry(form: FormData) {
  const { project, back } = await requireProject(form);
  const p = entryFields(form);
  if (!p.success) back(p.error.issues[0].message, "err");
  else {
    const { day, ...rest } = p.data;
    updateEntry(getDb(), project.id, Number(str(form, "id")), { ...rest, publishedAt: day });
    back("Nouveauté enregistrée");
  }
}

export async function removeEntry(form: FormData) {
  const { project, back } = await requireProject(form);
  deleteEntry(getDb(), project.id, Number(str(form, "id")));
  back("Nouveauté supprimée");
}
