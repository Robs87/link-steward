export type Role = "owner" | "member";

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

export type SetupStatusResponse = {
  ownerExists: boolean;
};

export type AuthResponse = {
  user: PublicUser;
};
