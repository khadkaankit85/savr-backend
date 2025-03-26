declare module "express-session" {
  interface SessionData {
    passport: {
      user?: {
        _id: string;
        username: string;
        fullName: string;
        email: string;
        isVerified: boolean;
        role: "user" | "admin";
      };
    };
  }
}
export {};
