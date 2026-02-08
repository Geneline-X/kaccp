import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/infra/db/prisma';
import { sendResetPasswordEmail } from '@/lib/infra/email/email';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            // For security, don't reveal if user exists or not
            return NextResponse.json({ message: 'If an account exists with that email, a reset link has been sent.' });
        }

        // Generate random token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour from now

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: token,
                resetTokenExpiry: expiry,
            },
        });

        await sendResetPasswordEmail(user.email, token);

        return NextResponse.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
