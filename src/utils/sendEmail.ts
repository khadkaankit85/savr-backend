import nodemailer, { SendMailOptions } from "nodemailer";
import { appConfigs } from "../configs/appconfigs";

/**
 * sends email with nodemailer:)
 */
const sendEmailWithNodemailer = async (
  destinationEmail: string,
  emailHeader: string,
  emailBody: string,
) => {
  const user = appConfigs.emailThatSendsOtp;
  const pass = appConfigs.emailPassword;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for port 465, false for other ports
    auth: {
      user,
      pass,
    },
  });

  const mailOptions: SendMailOptions = {
    from: user,
    to: destinationEmail,
    subject: emailHeader,
    html: emailBody,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (e) {
    //console.log(e);
    return false;
  }
};

/**
 * sends email asynchoronously, can be extended by adding other email service provider
 * */
const sendEmail = async (
  destinationEmail: string,
  emailHeader: string,
  emailBody: string,
): Promise<boolean> => {
  const sentWithNodemailer = await sendEmailWithNodemailer(
    destinationEmail,
    emailHeader,
    emailBody,
  );
  return sentWithNodemailer;
};

export default sendEmail;
