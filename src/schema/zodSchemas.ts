import { z } from "zod";

const strongPassword =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * email and password is enough to create an user account, default username is email-gmail.com
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .min(1, "Email is required")
    .max(255, "Email too long"),

  password: z
    .string()
    .min(8, "Password should be at least 8 characters")
    .regex(
      strongPassword,
      "Password must include at least one uppercase letter, one number, and one special character.",
    ),
});

/**
 * schema for email verification of user
 * */

export const emailVerificationSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .min(1, "Email is required")
    .max(255, "Email too long"),

  token: z.string().uuid("Invalid token format").min(1, "token is required"),
});
