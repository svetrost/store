import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Пароль должен содержать минимум 8 символов")
  .max(100, "Пароль слишком длинный")
  .regex(/[a-z]/, "Пароль должен содержать строчную букву")
  .regex(/[A-Z]/, "Пароль должен содержать заглавную букву")
  .regex(/\d/, "Пароль должен содержать цифру")
  .regex(/[^A-Za-z0-9]/, "Пароль должен содержать спецсимвол");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Логин должен содержать минимум 3 символа")
  .max(50, "Логин слишком длинный")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Логин может содержать только буквы, цифры, точку, дефис и подчёркивание"
  )
  .transform((value) => value.toLowerCase());

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название должно содержать минимум 2 символа")
    .max(200, "Название слишком длинное"),
  quantity: z.coerce
    .number()
    .int("Количество должно быть целым числом")
    .min(0, "Количество не может быть отрицательным")
    .max(1_000_000, "Слишком большое количество"),
  note: z
    .string()
    .trim()
    .max(300, "Комментарий слишком длинный")
    .optional()
    .or(z.literal("")),
});

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название должно содержать минимум 2 символа")
    .max(200, "Название слишком длинное"),
  quantity: z.coerce
    .number()
    .int("Количество должно быть целым числом")
    .min(0, "Количество не может быть отрицательным")
    .max(1_000_000, "Слишком большое количество"),
  note: z
    .string()
    .trim()
    .max(300, "Комментарий слишком длинный")
    .optional()
    .or(z.literal("")),
});

export const createMovementSchema = z.object({
  barcode: z
    .string()
    .trim()
    .min(3, "Укажи штрих-код товара")
    .max(120, "Штрих-код слишком длинный"),
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce
    .number()
    .int("Количество должно быть целым числом")
    .min(1, "Количество должно быть больше нуля")
    .max(1_000_000, "Слишком большое количество"),
  note: z
    .string()
    .trim()
    .max(300, "Комментарий слишком длинный")
    .optional()
    .or(z.literal("")),
  source: z.enum(["MANUAL", "SCAN"]).optional().default("MANUAL"),
});

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(100, "Имя слишком длинное"),
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["ADMIN", "USER"]),
  isActive: z.boolean(),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(100, "Имя слишком длинное"),
  username: usernameSchema,
  password: passwordSchema.optional().or(z.literal("")),
  role: z.enum(["ADMIN", "USER"]),
  isActive: z.boolean(),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(100, "Имя слишком длинное"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Укажи текущий пароль"),
  newPassword: passwordSchema,
});