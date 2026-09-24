export interface SiteSettings {
  businessName: string;
  slogan: string;
  /** Somente dígitos, com DDI, usado nos links wa.me (ex.: 554896410338). */
  whatsapp: string;
  /** Telefone formatado para exibição. */
  phone: string;
  /** Usuário do Instagram, sem @. */
  instagram: string;
  facebook: string;
  email: string;
  city: string;
  state: string;
  address: string;
  openingHours: string;
  showSoldVehicles: boolean;
  sellVehicleCta: string;
  repasseDescription: string;
}

export type SiteSettingsKey = keyof SiteSettings;
