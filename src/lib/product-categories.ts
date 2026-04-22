import type { ProductCategory } from "@prisma/client";

export const PRODUCT_CATEGORIES: Array<{
  value: ProductCategory;
  slug: string;
  label: string;
  description: string;
}> = [
  {
    value: "STRUCTURES",
    slug: "structures",
    label: "Конструктив",
    description: "Фермы, стойки, подвесы и элементы конструкции.",
  },
  {
    value: "LIGHTING",
    slug: "lighting",
    label: "Световые приборы",
    description: "Прожекторы, головы, заливающий и сценический свет.",
  },
  {
    value: "SOUND",
    slug: "sound",
    label: "Звуковые приборы",
    description: "Акустика, усилители, пульты, микрофоны и радиосистемы.",
  },
  {
    value: "SCREENS",
    slug: "screens",
    label: "Экраны",
    description: "LED-экраны, панели, телевизоры, проекторы.",
  },
  {
    value: "TEXTILE",
    slug: "textile",
    label: "Текстиль",
    description: "Задники, занавесы, скатерти, чехлы и тканевые элементы.",
  },
  {
    value: "SPECIAL_EFFECTS",
    slug: "special-effects",
    label: "Спецэффекты",
    description: "Дым, haze, конфетти, CO2, снег и спецмашины.",
  },
  {
    value: "COMMUTATION",
    slug: "commutation",
    label: "Коммутация",
    description: "Кабели, переходники, разветвители, силовая и сигнальная разводка.",
  },
  {
    value: "ADDITIONAL_EQUIPMENT",
    slug: "additional-equipment",
    label: "Доп. оборудование",
    description: "Прочее оборудование, не попавшее в основные категории.",
  },
];

export function getProductCategoryBySlug(slug: string) {
  return PRODUCT_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export function getProductCategoryByValue(value: ProductCategory) {
  return PRODUCT_CATEGORIES.find((category) => category.value === value) ?? null;
}