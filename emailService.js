/**
 * emailService.js
 *
 * This service handles sending transactional emails for user registration and approval.
 * It's based on the 'otp_email.js' example you provided.
 */

const nodemailer = require("nodemailer");
require("dotenv").config(); // Make sure to load .env variables

// --- Transporter Configuration ---
// We read these from your .env file
const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || "587", 10);
const user = process.env.SMTP_USER2;
const passwd = process.env.SMTP_PASS2;
const emailFrom = process.env.EMAIL_FROM || user;

let transporter;

// Initialize the transporter
if (host && user && passwd) {
  transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: false, // Use STARTTLS (true for port 465)
    auth: {
      user: user,
      pass: passwd,
    },
    connectionTimeout: 10000,
  });

  console.log("✅ Email Service (Nodemailer) transporter configured.");
} else {
  console.warn(
    "⚠️ Email Service is NOT configured. Missing SMTP_HOST, SMTP_USER2, or SMTP_PASS2 in .env file."
  );
  // Create a mock transporter if not configured, to prevent crashes
  transporter = {
    sendMail: () =>
      Promise.resolve(
        console.log(
          "Email not sent (service not configured). Skipping."
        )
      ),
  };
}

/**
 * Sends a "Pending Approval" email to a new user.
 *
 * @param {string} email - Recipient's email address
 * @param {string} name - Recipient's name for personalization
 * @returns {Promise<boolean>} True if email sent successfully, False otherwise
 */
async function sendPendingEmail(email, name = "") {
  if (!transporter) return false;

  const greeting = name ? `Hi ${name},` : "Hi there,";
  const subject = "Your OpenArk Registration is Pending";

  // Plain text version
  const plainText = `${greeting}

Thank you for registering an account at OpenArk.
Your account is now pending approval from an administrator.

We will send you another email as soon as your account is activated.

Best regards,
The OpenArk Team
`;

  // HTML version
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #9A3F3F 0%, #C9A227 100%);">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Registration Pending</h1>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>
                            <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                                Thank you for registering an account at <strong style="color: #1f2937;">OpenArk</strong>.
                            </p>
                            
                            <!-- Status Box -->
                            <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                                <div style="font-size: 20px; font-weight: 700; color: #92400e;">
                                    Your account is pending approval.
                                </div>
                            </div>
                            
                            <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                                An administrator will review your request shortly. We will send you another email as soon as your account is activated.
                            </p>
                            
                            <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                If you didn't register for this account, please ignore this email.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                                © 2025 OpenArk. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  // Email options
  const mailOptions = {
    from: emailFrom,
    to: email,
    subject: subject,
    text: plainText,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Pending email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send pending email to ${email}:`, error);
    return false;
  }
}

/**
 * Sends an "Account Approved" email to a user.
 *
 * @param {string} email - Recipient's email address
 * @param {string} name - Recipient's name for personalization
 * @returns {Promise<boolean>} True if email sent successfully, False otherwise
 */
async function sendApprovalEmail(email, name = "") {
  if (!transporter) return false;

  const greeting = name ? `Hi ${name},` : "Hi there,";
  const subject = "Your OpenArk Account is Now Active!";

  // Plain text version
  const plainText = `${greeting}

Good news! Your account for OpenArk has been approved by an administrator.
You can now log in to access the library.

If you have any questions, feel free to reply to this email.

Best regards,
The OpenArk Team
`;

  // HTML version
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Account Approved!</h1>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                                ${greeting}
                            </p>
                            <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                                Good news! Your account for <strong style="color: #1f2937;">OpenArk</strong> has been approved.
                            </p>
                            
                            <!-- Status Box -->
                            <div style="background-color: #dcfce7; border: 2px solid #22c55e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                                <div style="font-size: 20px; font-weight: 700; color: #15803d;">
                                    You can now log in!
                                </div>
                            </div>
                            
                            <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                If you have any questions, feel free to reply to this email.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                                © 2025 OpenArk. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  // Email options
  const mailOptions = {
    from: emailFrom,
    to: email,
    subject: subject,
    text: plainText,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Approval email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send approval email to ${email}:`, error);
    return false;
  }
}

// Export the functions for server.js to use
module.exports = { sendPendingEmail, sendApprovalEmail };
