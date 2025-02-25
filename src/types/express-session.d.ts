declare module "express-session" {
  interface SessionData {
    user: {
      username: string;
      fullName: string;
      email: string;
      isVerified: boolean;
      role: "user" | "admin";
    };
  }
}
export {};
