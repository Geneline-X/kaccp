import nodemailer from 'nodemailer';

export async function sendResetPasswordEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/speaker/login/reset?token=${token}`;

  // Log the request to the server console for monitoring
  console.log(`[EmailService] Password reset requested for: ${email}`);

  // In development or if the log is needed, the link is available here:
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DevLink]: ${resetLink}`);
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;

  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      await transporter.sendMail({
        from: `"KACCP Platform" <${gmailUser}>`,
        to: email,
        subject: 'Reset your password - KACCP',
        html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
                        <h2 style="color: #1e40af;">Password Reset Request</h2>
                        <p>Hello,</p>
                        <p>You requested a password reset for your KACCP account. Click the button below to set a new password. This link will expire in 1 hour.</p>
                        <div style="margin: 30px 0; text-align: center;">
                            <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e1e1e1;">
                        <p style="font-size: 12px; color: #9ca3af;">If the button above doesn't work, copy and paste this link into your browser:</p>
                        <p style="font-size: 12px; color: #2563eb; word-break: break-all;">${resetLink}</p>
                    </div>
                `,
      });
      console.log('✅ Email sent successfully via Gmail');
    } catch (error) {
      console.error('❌ Failed to send email via Gmail:', error);
    }
  } else {
    console.log('⚠️ GMAIL_USER or GMAIL_APP_PASS not found in .env, skipping live email send.');
  }

  return { success: true };
}
