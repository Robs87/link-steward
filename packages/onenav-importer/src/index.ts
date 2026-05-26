export type OneNavCategory = {
  id: number;
  name: string;
  fid: number;
  property: number;
};

export type OneNavLink = {
  id: number;
  fid: number;
  title: string;
  url: string;
  description?: string;
  weight?: number;
  property?: number;
  click?: number;
  urlStandby?: string;
  fontIcon?: string;
  checkStatus?: number;
};

export type OneNavImportPreview = {
  categories: OneNavCategory[];
  links: OneNavLink[];
  warnings: string[];
};
