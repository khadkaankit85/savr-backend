import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { appConfigs } from "./appconfigs";
import User from "../schema/userSchema";
import crypto from "node:crypto";
import type { SessionUser } from "../types/others";

passport.use(
  new GoogleStrategy(
    {
      clientID: appConfigs.oauthClientId,
      clientSecret: appConfigs.oauthClientSecret,
      callbackURL: `${appConfigs.backendUrl}/api/user/authentication/withgoogle/callback`,
      scope: ["email", "profile"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const existingUser = await User.findOne({ email: profile._json.email });

        if (existingUser) {
          const dataToBeSent: SessionUser = {
            username: existingUser.username,
            fullName: existingUser.fullName,
            email: existingUser.email,
            isVerified: existingUser.additionalInfo?.isVerified || true,
            role: existingUser.additionalInfo?.role || "user",
            id: existingUser._id.toString(),
          };
          return done(null, dataToBeSent);
        }

        // If no existing user, create a new user
        const temproaryUsername = profile.displayName || profile._json.email;
        const token = crypto.randomUUID();
        //        const url = `${appConfigs.frontendUrl}/api/user/accountverification?username=${temproaryUsername}&token=${token}`;

        const newUser = new User({
          username: temproaryUsername,
          fullName: profile.displayName || temproaryUsername,
          email: profile._json.email,
          password: crypto.randomUUID(),
          role: "user",
          additionalInfo: {
            image: profile.photos ? profile.photos[0].value : null,
            token: { value: token },
            isVerified: true,
            googleId: profile.id,
          },
        });

        await newUser.save();
        /*

        try {
          const emailSent = sendEmail(
            profile._json.email!,
            "Savr Account Verification",
            getAccountVerificationEmailText(url),
          );
          console.log(
            "Verification email sent to: ",
            profile._json.email,
            await emailSent,
          );
        } catch (e) {
          console.error("Failed to send verification email:", e);
        }
        */

        const dataToBeSent: SessionUser = {
          username: newUser.username,
          fullName: newUser.fullName,
          email: newUser.email,
          isVerified: newUser.additionalInfo?.isVerified || true,
          role: newUser.additionalInfo?.role || "user",
          id: newUser._id.toString(),
        };

        done(null, dataToBeSent);
      } catch (error) {
        console.error("Error during Google OAuth:", error);
        return done(error, false);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser(async (user: Express.User, done) => {
  done(null, user);
});
