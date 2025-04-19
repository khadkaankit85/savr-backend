// this file has useful simple function
export const getUsernameFromEmail = (email: string): string =>
  email.split("@")[0];

/**
 * returns the email text to send
 */
export const getAccountVerificationEmailText = (link: string) => {
  return `
    <html>
      <head>
        <style  >
          body {
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.6;
            background-color: #f4f4f4;
            padding: 20px;
          }
          .email-container {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            max-width: 600px;
            margin: 0 auto;
          }
          h2 {
            color: #4CAF50;
          }
          p {
            font-size: 16px;
          }
          .btn {
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            font-size: 16px;
            border-radius: 5px;
            display: inline-block;
            margin-top: 20px;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #777;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <h2>Hello,</h2>
          <p>Thank you for signing up with SAVR. We're excited to have you join us!</p>
          <p>To complete your account verification, please click the link below:</p>
          <a href="${link}" class="btn">Verify Your Email</a>
          <p>This link will expire in 24 hours. If you did not create an account, please ignore this email.</p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} SAVR Team. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * checks if the passed amount of time in Milliseconds (second argument) has passed since the passed date(first argument)
 **/
export const isExpired = (
  tokenCreationDate: Date,
  timeInMilliseconds: number,
) => new Date().getTime() - tokenCreationDate.getTime() > timeInMilliseconds;
