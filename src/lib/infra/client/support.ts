/**
 * Who a would-be contributor contacts to get an account. Accounts are created by
 * admins only, so the login pages show this instead of a "Register" link.
 * Override per deployment with NEXT_PUBLIC_SUPPORT_CONTACT.
 */
export const SUPPORT_CONTACT = process.env.NEXT_PUBLIC_SUPPORT_CONTACT || '073787064'
