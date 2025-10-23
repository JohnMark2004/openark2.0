/**
 * emailService.js
 *
 * Uses the Gmail API with OAuth 2.0 to send emails.
 * Requires Google Cloud Project setup, Gmail API enabled, OAuth credentials, and a Refresh Token.
 */
const { google } = require("googleapis");
const MailComposer = require("nodemailer/lib/mail-composer"); // To build the email
require("dotenv").config();

// --- OAuth 2.0 Client Setup ---
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GMAIL_USER_EMAIL = process.env.GMAIL_USER_EMAIL; // Your sending email address

let gmail;
let isGmailConfigured = false;

if (
  GOOGLE_CLIENT_ID &&
  GOOGLE_CLIENT_SECRET &&
  GOOGLE_REDIRECT_URI &&
  GOOGLE_REFRESH_TOKEN &&
  GMAIL_USER_EMAIL
) {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    isGmailConfigured = true;
    console.log("✅ Email Service (Gmail API) configured.");

  } catch (error) {
    console.error("❌ FAILED to configure Gmail API client:", error);
    gmail = null; // Ensure gmail is null if setup fails
  }
} else {
  console.warn(
    "⚠️ Email Service (Gmail API) is NOT fully configured. Missing OAuth credentials or Refresh Token in .env file."
  );
  gmail = null;
}

// Helper function to encode email for Gmail API
const encodeMessage = (message) => {
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// Helper function to create the raw email message
const createMail = async (options) => {
  const mailComposer = new MailComposer(options);
  const message = await mailComposer.compile().build();
  return encodeMessage(message);
};

/**
 * Sends an email using the Gmail API.
 * @param {object} options - Mail options (to, subject, text, html)
 * @returns {Promise<boolean>} True on success, false on failure
 */
async function sendMailWithGmailAPI(options) {
  if (!isGmailConfigured || !gmail) {
    console.log(" MOCK EMAIL (Not Sent - Gmail API not configured):");
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    return false; // Indicate failure if not configured
  }

  try {
    const rawMessage = await createMail({
      from: GMAIL_USER_EMAIL, // Send FROM the authorized user
      ...options,
    });

    await gmail.users.messages.send({
      userId: "me", // 'me' refers to the authenticated user (GMAIL_USER_EMAIL)
      requestBody: {
        raw: rawMessage,
      },
    });
    return true; // Indicate success
  } catch (error) {
    console.error(`❌ Gmail API send failed for ${options.to}:`, error.response ? error.response.data : error.message);
    return false; // Indicate failure
  }
}


// --- sendPendingEmail function (using Gmail API) ---
async function sendPendingEmail(email, name = "") {
  console.log(`[EmailService] Attempting to send PENDING email to: ${email} via Gmail API`);

  const greeting = name ? `Hi ${name},` : "Hi there,";
  const subject = "Your OpenArk Registration is Pending";
  const plainText = `${greeting}\n\nThank you for registering an account at OpenArk. Your registration is currently pending review by an administrator.\n\nYou will receive another email once your account has been approved.\n\nBest regards,\nThe OpenArk Team`;

  // --- 🎨 HTML content for the pending email ---
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: 'Montserrat', sans-serif; background-color: #f3f4f6; color: #1f2937; }
        table { border-collapse: collapse; }
        .container { background-color: #f3f4f6; padding: 40px 20px; width: 100%; }
        .content-table { background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
        .header { padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #9A3F3F 0%, #B84545 100%); }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; }
        .body { padding: 40px; font-size: 15px; line-height: 1.6; }
        .body p { margin: 0 0 20px; }
        .highlight-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0; }
        .highlight-box p { margin: 0; color: #92400e; font-size: 14px; }
        .footer { padding: 30px 40px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
        .footer p { margin: 0; color: #6b7280; font-size: 12px; }
        @media (max-width: 640px) {
            .container { padding: 20px 10px; }
            .header { padding: 30px 20px; }
            .body { padding: 30px 20px; font-size: 14px; }
            .header h1 { font-size: 20px; }
        }
    </style>
</head>
<body>
    <table class="container" width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table class="content-table" width="100%" cellpadding="0" cellspacing="0">
                    <!-- Header -->
                    <tr>
                        <td class="header">
                            <h1>Registration Pending</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td class="body">
                            <p>${greeting}</p>
                            <p>Thank you for registering an account with <strong>OpenArk</strong>. We're excited to have you join our community!</p>

                            <div class="highlight-box">
                                <p>
                                    <strong>Your account registration is currently pending review by an administrator.</strong>
                                </p>
                            </div>

                            <p>You will receive another email notification as soon as your account has been approved. Please allow some time for the review process.</p>

                            <p style="margin-bottom: 0;">If you did not initiate this registration, please disregard this email.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td class="footer">
                            <p>© ${new Date().getFullYear()} OpenArk. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
  // --- 🎨 End of Pending HTML ---

  const mailOptions = {
    to: email,
    subject: subject,
    text: plainText,
    html: htmlContent,
  };

  const success = await sendMailWithGmailAPI(mailOptions);

  if (success) {
    console.log(`✅ [EmailService] PENDING email SENT successfully to ${email} via Gmail API`);
  } else {
    // Error is already logged in sendMailWithGmailAPI
    console.error(`[EmailService] FAILED to send PENDING email to ${email} via Gmail API.`);
  }
  return success;
}

/**
 * Sends an email using the Gmail API and notifies admin.
 * @param {object} options - Mail options (to, subject, text, html)
 * @param {string} emailType - Description like "PENDING" or "APPROVAL" for admin notification
 * @returns {Promise<boolean>} True on success of primary email, false on failure
 */
async function sendMailWithGmailAPI(options, emailType = "Notification") {
  if (!isGmailConfigured || !gmail) {
    console.log(" MOCK EMAIL (Not Sent - Gmail API not configured):");
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    return false; // Indicate failure if not configured
  }

  // --- Send PRIMARY email to the user ---
  try {
    const rawMessage = await createMail({
      from: GMAIL_USER_EMAIL, // Send FROM the authorized user
      ...options,
    });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });

    // --- Send ADMIN NOTIFICATION email (if primary succeeded) ---
    // Use try...catch for notification so its failure doesn't affect main result
    try {
        const adminSubject = `[OpenArk Admin] ${emailType} Email Sent`;
        const adminText = `An email (${emailType}) was successfully sent to:\n\nUser: ${options.to}\nSubject: ${options.subject}\n\nTimestamp: ${new Date().toLocaleString()}`;
        const adminHtml = `<p>An email (<b>${emailType}</b>) was successfully sent to:</p>
                           <ul>
                             <li><b>User:</b> ${options.to}</li>
                             <li><b>Subject:</b> ${options.subject}</li>
                           </ul>
                           <p>Timestamp: ${new Date().toLocaleString()}</p>`;

        const adminRawMessage = await createMail({
            from: GMAIL_USER_EMAIL,
            to: GMAIL_USER_EMAIL, // Send notification to self
            subject: adminSubject,
            text: adminText,
            html: adminHtml,
        });

        await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: adminRawMessage,
            },
        });
        console.log(`✉️ [EmailService] Admin notification sent successfully regarding email to ${options.to}`);

    } catch (adminNotifyError) {
        console.error(`⚠️ [EmailService] FAILED to send ADMIN notification regarding email to ${options.to}:`, adminNotifyError.response ? adminNotifyError.response.data : adminNotifyError.message);
        // We log this error but don't return false, as the main email succeeded.
    }

    return true; // Indicate success of primary email

  } catch (primaryError) {
    console.error(`❌ Gmail API send failed for ${options.to}:`, primaryError.response ? primaryError.response.data : primaryError.message);
    return false; // Indicate failure of primary email
  }
}


// --- sendApprovalEmail function (using Gmail API) ---
async function sendApprovalEmail(email, name = "") {
  console.log(`[EmailService] Attempting to send APPROVAL email to: ${email} via Gmail API`);

  const greeting = name ? `Hi ${name},` : "Hi there,";
  const subject = "Your OpenArk Account is Now Active!";
  const plainText = `${greeting}\n\nGood news! Your account registration for OpenArk has been approved by an administrator.\n\nYou can now log in and access all features.\n\nWelcome aboard!\n\nBest regards,\nThe OpenArk Team`;

  // --- ✨ ADDED: HTML content for the approval email ---
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* ... existing styles ... */
        /* --- MODIFIED: Header background to match website --- */
        .header { padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #9A3F3F 0%, #B84545 100%); } /* Using Maroon */
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; }
        /* ... existing styles ... */
        /* --- MODIFIED: Login button background to match website --- */
        .login-button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #9A3F3F 0%, #B84545 100%); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: 600; margin-top: 10px; box-shadow: 0 4px 10px rgba(154, 63, 63, 0.3); } /* Using Maroon */
        /* ... existing styles ... */
        @media (max-width: 640px) {
            /* ... existing media query styles ... */
            .header h1 { font-size: 20px; }
            .login-button { padding: 10px 20px; font-size: 14px;}
        }
    </style>
</head>
<body>
    <table class="container" width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table class="content-table" width="100%" cellpadding="0" cellspacing="0">
                    <!-- Header -->
                    <tr>
                        <td class="header">
                            <h1>Account Approved!</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td class="body">
                            <p>${greeting}</p>
                            <p>Good news! Your account registration for <strong>OpenArk</strong> has been reviewed and approved by an administrator.</p>

                            <div class="success-box">
                                <p>
                                    <strong>Your account is now active!</strong> You can log in using the email and password you registered with.
                                </p>
                            </div>

                            <p>Welcome to the OpenArk library. We hope you find the resources helpful for your studies.</p>

                            <!-- Optional: Add a direct link to the login page -->
                            <p style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL || '#'}" class="login-button">Log In to OpenArk</a>
                            </p>

                            <p style="margin-bottom: 0;">If you have any questions, feel free to reply to this email.</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td class="footer">
                            <p>© ${new Date().getFullYear()} OpenArk. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
  // --- ✨ End of Added HTML ---

  const mailOptions = {
    to: email,
    subject: subject,
    text: plainText,
    html: htmlContent,
  };

  const success = await sendMailWithGmailAPI(mailOptions);

  if (success) {
    console.log(`✅ [EmailService] APPROVAL email SENT successfully to ${email} via Gmail API`);
  } else {
    // Error is already logged in sendMailWithGmailAPI
    console.error(`[EmailService] FAILED to send APPROVAL email to ${email} via Gmail API.`);
  }
  return success;
}

module.exports = { sendPendingEmail, sendApprovalEmail };

