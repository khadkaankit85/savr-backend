declare module "express-session" {
  interface SessionData {
    user: {
      username: string;
      fullName: string;
      id: string;
      email: string;
      isVerified: boolean;
      role: "user" | "admin";
    };
  }
}
export {};
