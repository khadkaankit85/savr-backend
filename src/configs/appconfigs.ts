//configs file, for whatever reason, envs were not loding so dotend is imported here as well
import dotenv from "dotenv";
dotenv.config();

const rawEnv = process.env.ENVIRONMENT;
const environment: "dev" | "prod" =
  rawEnv === "prod" || rawEnv === "dev" ? rawEnv : "dev";

const databaseUrl = process.env.DATABASE_URL;
const oauthClientId = process.env.GOOGLE_OAUTHCLIENT;
const oauthClientSecret = process.env.GOOGLE_OAUTHSECRET;
const frontendUrl = process.env.FRONTEND_URL;
const backendUrl = process.env.BACKEND_URL;
const emailThatSendsOtp = process.env.EMAIL_ADDRESS;
const emailPassword = process.env.EMAIL_PASSWORD;
//we rarely define port in .env file or environment variable as it is managed by hosting provider most of the time
const port = process.env.PORT as number | undefined;
const sessionSecret = process.env.SESSION_SECRET_TOKEN;
const chromePathForDev = process.env.CHROME_PATH;
const openAIAPIKey = process.env.OPENAI_API_KEY;

//if compulsory envs are missing
if (
  !oauthClientId ||
  !oauthClientSecret ||
  !emailThatSendsOtp ||
  !emailPassword ||
  !sessionSecret ||
  !openAIAPIKey
) {
  throw new Error(
    "please check for compulsory envs in your environment variable, check envsample for required envs",
  );
}

//if prod compulsory envs are missing
if (environment === "prod" && (!databaseUrl || !frontendUrl)) {
  console.error("Missing required environment variables in production mode.");
  throw new Error("Missing environment variables in production.");
}

type Config = {
  frontendUrl: string;

  /**
   * The URL of the database used by the application.
   * In development mode, your device should have a runnning mongodb instance, on port 27017
   *
   * @example "mongodb://localhost:27017/savr" // for local development
   * @example "mongodb://prod-db.example.com:27017/mydb" // for production
   */
  databaseUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  emailThatSendsOtp: string;
  emailPassword: string;
  port: number;
  sessionSecret: string;
  environment: "dev" | "prod";
  backendUrl: string;
  chromePathForDev?: string;
  openAIAPIKey: string;
};

const constConfig = {
  oauthClientId,
  oauthClientSecret,
  emailThatSendsOtp,
  emailPassword,
  sessionSecret,
  environment,
  openAIAPIKey,
};

const prodConfig: Config = {
  frontendUrl: frontendUrl!,
  databaseUrl: databaseUrl!,
  port: port!,
  backendUrl: backendUrl!,
  ...constConfig,
};

const devConfig: Config = {
  frontendUrl: "http://localhost:5173",
  databaseUrl: "mongodb://localhost:27017/savr",
  backendUrl: "http://localhost:3000",
  port: port || 3000,
  chromePathForDev,
  ...constConfig,
};

export const appConfigs: Config =
  environment === "prod" ? prodConfig : devConfig;

if (environment !== "prod") {
  const configEntries = Object.entries(appConfigs);

  let boxContent = `
  ┌───────────────────────────────────────────────────────────┐
  │ 📢 [DEV MODE] Loading environment variables...            │
  │ (This log won't appear in production)                    │
  ├───────────────────────────────────────────────────────────┤
  │ 🔧 Current App Configuration:                             │
  │                                                           │
  `;
  configEntries.forEach(([key, value]) => {
    boxContent += `  │ ${key.padEnd(30)}: ${String(value).padEnd(40)} │\n`;
  });

  boxContent += `
  └───────────────────────────────────────────────────────────┘
  `;

  console.log(boxContent);
  console.log("The path of your chrome for development is ", chromePathForDev);
}
